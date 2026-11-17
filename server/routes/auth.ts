import { Router } from "express";
import { db, writeAudit } from "../db";
import {
  burnPasswordCheck,
  clearSessionCookie,
  effectivePermissions,
  hashPassword,
  revokeSessions,
  loginFailed,
  loginLocked,
  loginSucceeded,
  requireAuth,
  setSessionCookie,
  verifyPassword,
} from "../auth";
import { HttpError, body, h, str } from "../http";

import type { Role } from "../../src/types";

export const authRouter = Router();

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string;
  timezone: string;
  currency: string;
  primary_color: string;
  seats: number;
  created_at: string;
  updated_at: string;
}

export function orgView(o: OrgRow) {
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    organizationType: o.type,
    email: o.email ?? undefined,
    phone: o.phone ?? undefined,
    address: o.address ?? undefined,
    country: o.country,
    timezone: o.timezone,
    currency: o.currency,
    status: o.status,
    primaryColor: o.primary_color,
    reportedHeadcount: o.seats,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  };
}

interface MemberRow {
  id: string;
  org_id: string;
  role: Role;
  is_owner: number;
  joined_at: string;
  org_status: string;
}

function usableMemberships(userId: string) {
  const rows = db
    .prepare(
      `SELECT m.id, m.org_id, m.role, m.is_owner, m.joined_at, o.status AS org_status
       FROM memberships m JOIN organizations o ON o.id = m.org_id
       WHERE m.user_id = ? AND m.status = 'active'`,
    )
    .all(userId) as unknown as MemberRow[];
  return { all: rows, usable: rows.filter((m) => m.org_status !== "suspended" || m.role === "super_admin") };
}

/** Frontend uchun sessiya holati: foydalanuvchi, tashkilotlar, joriy rol, modullar. */
export function sessionView(userId: string, orgId: string | null) {
  const user = db.prepare("SELECT id, email, name FROM users WHERE id = ?").get(userId) as { id: string; email: string; name: string };
  const { usable } = usableMemberships(userId);
  const current = usable.find((m) => m.org_id === orgId) ?? null;
  const orgs = usable.length
    ? (db.prepare(`SELECT * FROM organizations WHERE id IN (${usable.map(() => "?").join(",")})`).all(...usable.map((m) => m.org_id)) as unknown as OrgRow[])
    : [];
  const modules = current
    ? (db.prepare("SELECT module_key FROM org_modules WHERE org_id = ? AND enabled = 1").all(current.org_id) as { module_key: string }[]).map((r) => r.module_key)
    : [];
  return {
    user: { id: user.id, email: user.email, name: user.name, role: current?.role ?? null, isPlatformAdmin: current?.role === "super_admin" },
    organization: current ? orgView(orgs.find((o) => o.id === current.org_id)!) : null,
    organizations: orgs.map(orgView),
    memberships: usable.map((m) => ({ id: m.id, userId, organizationId: m.org_id, role: m.role, status: "active", isOwner: !!m.is_owner, joinedAt: m.joined_at })),
    modules,
    permissions: current ? effectivePermissions(current.org_id, current.role) : [],
    mustChangePassword: !!(db.prepare("SELECT must_change_password m FROM users WHERE id = ?").get(userId) as { m: number }).m,
  };
}

authRouter.post(
  "/login",
  h((req, res) => {
    const b = body(req);
    const email = str(b, "email", { max: 200 }).toLowerCase();
    const password = str(b, "password", { max: 200 });
    const key = `${email}|${req.ip}`;
    if (loginLocked(key)) throw new HttpError(429, "TOO_MANY_ATTEMPTS", "Juda ko'p noto'g'ri urinish. 15 daqiqadan so'ng qayta urinib ko'ring.");

    const user = db.prepare("SELECT id, name, password_hash FROM users WHERE email = ? AND is_active = 1").get(email) as { id: string; name: string; password_hash: string } | undefined;
    if (!user) {
      burnPasswordCheck(password);
      loginFailed(key);
      throw new HttpError(401, "INVALID_CREDENTIALS", "Email yoki parol noto'g'ri.");
    }
    if (!verifyPassword(password, user.password_hash)) {
      loginFailed(key);
      throw new HttpError(401, "INVALID_CREDENTIALS", "Email yoki parol noto'g'ri.");
    }

    const { all, usable } = usableMemberships(user.id);
    if (all.length === 0) throw new HttpError(403, "NO_MEMBERSHIP", "Tashkilotga a'zolik topilmadi.");
    if (usable.length === 0) throw new HttpError(403, "ORG_SUSPENDED", "Tashkilot faoliyati vaqtincha to'xtatilgan. Tashkilot rahbariyati yoki TIZIMS yordam xizmati bilan bog'laning.");

    loginSucceeded(key);
    db.prepare("UPDATE users SET last_login_at = strftime('%Y-%m-%d %H:%M', 'now', 'localtime') WHERE id = ?").run(user.id);
    const orgId = usable.length === 1 ? usable[0].org_id : null;
    setSessionCookie(res, user.id, orgId);
    if (orgId) writeAudit({ scope: "tenant", orgId, actorId: user.id, actorName: user.name, action: "LOGIN", object: "Session", objectId: user.id, ip: req.ip });
    res.json(sessionView(user.id, orgId));
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  h((req, res) => {
    res.json(sessionView(req.auth!.user.id, req.auth!.orgId));
  }),
);

authRouter.post(
  "/switch",
  requireAuth,
  h((req, res) => {
    const orgId = str(body(req), "organizationId", { max: 100 });
    const { usable } = usableMemberships(req.auth!.user.id);
    if (!usable.some((m) => m.org_id === orgId)) throw new HttpError(403, "FORBIDDEN", "Bu tashkilotga kirish taqiqlangan.");
    setSessionCookie(res, req.auth!.user.id, orgId);
    res.json(sessionView(req.auth!.user.id, orgId));
  }),
);

authRouter.post(
  "/password",
  requireAuth,
  h((req, res) => {
    const b = body(req);
    const current = str(b, "current", { max: 200 });
    const next = str(b, "next", { min: 8, max: 200 });
    if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) throw new HttpError(400, "VALIDATION_ERROR", "Yangi parolda harf va raqam bo'lishi kerak.");
    if (next === current) throw new HttpError(400, "VALIDATION_ERROR", "Yangi parol eskisidan farq qilishi kerak.");
    const a = req.auth!;
    const key = `pw|${a.user.id}`;
    if (loginLocked(key)) throw new HttpError(429, "TOO_MANY_ATTEMPTS", "Juda ko'p noto'g'ri urinish. 15 daqiqadan so'ng qayta urinib ko'ring.");
    const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(a.user.id) as { password_hash: string };
    if (!verifyPassword(current, row.password_hash)) {
      loginFailed(key);
      throw new HttpError(400, "INVALID_CREDENTIALS", "Joriy parol noto'g'ri.");
    }
    loginSucceeded(key);
    db.prepare("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?").run(hashPassword(next), a.user.id);
    // Boshqa qurilmalardagi sessiyalar yopiladi; joriy sessiya yangi cookie bilan davom etadi
    revokeSessions(a.user.id);
    if (a.orgId) writeAudit({ scope: "tenant", orgId: a.orgId, actorId: a.user.id, actorName: a.user.name, action: "PASSWORD_CHANGE", object: "User", objectId: a.user.id, ip: req.ip });
    setSessionCookie(res, a.user.id, a.orgId);
    res.json(sessionView(a.user.id, a.orgId));
  }),
);

/** Boshqa barcha qurilmalardagi sessiyalarni yopish (joriy sessiya qoladi) */
authRouter.post(
  "/sessions/revoke-others",
  requireAuth,
  h((req, res) => {
    const a = req.auth!;
    revokeSessions(a.user.id);
    setSessionCookie(res, a.user.id, a.orgId);
    if (a.orgId) writeAudit({ scope: "tenant", orgId: a.orgId, actorId: a.user.id, actorName: a.user.name, action: "REVOKE_SESSIONS", object: "User", objectId: a.user.id, ip: req.ip });
    res.json({ success: true });
  }),
);

authRouter.post(
  "/logout",
  h((req, res) => {
    if (req.auth?.orgId) writeAudit({ scope: "tenant", orgId: req.auth.orgId, actorId: req.auth.user.id, actorName: req.auth.user.name, action: "LOGOUT", object: "Session", objectId: req.auth.user.id, ip: req.ip });
    clearSessionCookie(res);
    res.json({ success: true });
  }),
);
