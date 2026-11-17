/**
 * Autentifikatsiya: scrypt parollar, HMAC-imzolangan sessiya tokeni (httpOnly cookie),
 * login urinishlarini cheklash va har so'rovda sessiyani bazadan qayta tekshirish.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { NextFunction, Request, Response } from "express";
import { PLATFORM, db, getDoc } from "./db";
import { ROLE_PERMISSIONS } from "../src/core/catalog";
import { FEATURE_MANAGE_PERMISSION, LOCKED_ROLES, accessOf, type Access, type FeatureKey } from "../src/core/features";
import type { Role } from "../src/types";
import { HttpError } from "./http";

/* ───────── Parollar ───────── */

export function hashPassword(plain: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(plain: string, stored: string) {
  const [kind, saltB64, hashB64] = stored.split("$");
  if (kind !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = scryptSync(plain, Buffer.from(saltB64, "base64url"), expected.length, { N: 16384, r: 8, p: 1 });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Mavjud bo'lmagan foydalanuvchi uchun ham bir xil vaqt sarflash (email mavjudligini oshkor qilmaslik). */
const DUMMY_HASH = hashPassword("timing-equalizer");
export function burnPasswordCheck(plain: string) {
  verifyPassword(plain, DUMMY_HASH);
}

/* ───────── Sessiya tokeni ───────── */

function loadSecret(): Buffer {
  if (process.env.SESSION_SECRET) return Buffer.from(process.env.SESSION_SECRET);
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET muhit o'zgaruvchisi production'da majburiy");
  const file = resolve(process.cwd(), "server/data/.session-secret");
  if (process.env.DB_PATH === ":memory:") return randomBytes(32);
  if (existsSync(file)) return Buffer.from(readFileSync(file, "utf8"), "base64url");
  mkdirSync(dirname(file), { recursive: true });
  const s = randomBytes(32);
  writeFileSync(file, s.toString("base64url"), { mode: 0o600 });
  return s;
}

const SECRET = loadSecret();
export const COOKIE = "tizims_session";
const TTL_SECONDS = 8 * 3600; // 8 soat

export interface SessionPayload {
  uid: string;
  org: string | null;
  exp: number;
  /** Sessiya versiyasi — bazadagi bilan mos kelmasa, sessiya bekor qilingan */
  sv?: number;
}

export function signSession(uid: string, org: string | null, sv = 0) {
  const payload: SessionPayload = { uid, org, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS, sv };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", SECRET).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    return p.exp > Date.now() / 1000 ? p : null;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, uid: string, org: string | null) {
  const sv = (db.prepare("SELECT session_version v FROM users WHERE id = ?").get(uid) as { v: number } | undefined)?.v ?? 0;
  res.cookie(COOKIE, signSession(uid, org, sv), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: TTL_SECONDS * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE, { path: "/" });
}

function readCookie(req: Request, name: string) {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

/** Foydalanuvchining barcha sessiyalarini bekor qilish (parol o'zgarganda / tiklanganda) */
export function revokeSessions(uid: string) {
  db.prepare("UPDATE users SET session_version = session_version + 1 WHERE id = ?").run(uid);
}

/* ───────── Login urinishlarini cheklash ───────── */

const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

export function loginLocked(key: string) {
  const a = attempts.get(key);
  return !!a && a.count >= MAX_ATTEMPTS && a.until > Date.now();
}

export function loginFailed(key: string) {
  const a = attempts.get(key);
  const fresh = !a || a.until < Date.now();
  attempts.set(key, { count: fresh ? 1 : a!.count + 1, until: Date.now() + LOCK_MS });
}

export function loginSucceeded(key: string) {
  attempts.delete(key);
}

export function resetLoginLimits() {
  attempts.clear();
}

/* ───────── Ruxsatlar: tashkilot sozlamasi → platforma shabloni → standart ───────── */

export function permissionMatrix(orgId: string | null): Record<string, string[]> {
  const templates = getDoc<Record<string, string[]>>(PLATFORM, "settings", "role_templates") ?? {};
  const overrides = orgId ? (getDoc<Record<string, string[]>>(orgId, "settings", "role_permissions") ?? {}) : {};
  return Object.fromEntries(
    (Object.keys(ROLE_PERMISSIONS) as Role[]).map((r) => [r, (!LOCKED_ROLES.includes(r) && overrides[r]) || templates[r] || ROLE_PERMISSIONS[r]]),
  );
}

export function effectivePermissions(orgId: string | null, role: Role): string[] {
  // Super admin: faqat platforma va rol shablonlari. Tashkilot ichki ruxsatlari berilmaydi.
  if (role === "super_admin") return ["platform.admin", "core.users.manage"];
  return permissionMatrix(orgId)[role] ?? [];
}

/* ───────── So'rov konteksti ───────── */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthContext {
  user: AuthUser;
  orgId: string | null;
  role: Role | null;
  isPlatformAdmin: boolean;
  permissions: string[];
  /** Vaqtinchalik parol bilan kirgan — avval parolni almashtirishi shart */
  mustChangePassword: boolean;
}

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthContext;
  }
}

/**
 * Har so'rovda: token imzosi → foydalanuvchi faolmi → a'zolik faolmi → tashkilot to'xtatilmaganmi.
 * Shu tufayli tashkilot to'xtatilsa yoki a'zolik bekor qilinsa, sessiya darhol yaroqsiz bo'ladi.
 */
export function loadSession(req: Request, _res: Response, next: NextFunction) {
  const p = verifySession(readCookie(req, COOKIE));
  if (!p) return next();
  const row = db.prepare("SELECT id, email, name, must_change_password, session_version FROM users WHERE id = ? AND is_active = 1").get(p.uid) as
    | (AuthUser & { must_change_password: number; session_version: number })
    | undefined;
  if (!row || row.session_version !== (p.sv ?? 0)) return next();
  const user: AuthUser = { id: row.id, email: row.email, name: row.name };
  let role: Role | null = null;
  let orgId: string | null = null;
  if (p.org) {
    const m = db
      .prepare(
        `SELECT m.role, o.status FROM memberships m JOIN organizations o ON o.id = m.org_id
         WHERE m.user_id = ? AND m.org_id = ? AND m.status = 'active'`,
      )
      .get(user.id, p.org) as { role: Role; status: string } | undefined;
    if (m && (m.status !== "suspended" || m.role === "super_admin")) {
      role = m.role;
      orgId = p.org;
    }
  }
  req.auth = { user, orgId, role, isPlatformAdmin: role === "super_admin", permissions: role ? effectivePermissions(orgId, role) : [], mustChangePassword: !!row.must_change_password };
  next();
}

/** Vaqtinchalik parol bilan kirganlar uchun — parol almashtirilmaguncha ma'lumot API'lari yopiq. */
export function requirePasswordChanged(req: Request, _res: Response, next: NextFunction) {
  if (req.auth?.mustChangePassword) return next(new HttpError(403, "PASSWORD_CHANGE_REQUIRED", "Davom etish uchun avval parolingizni o'zgartiring."));
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(new HttpError(401, "UNAUTHORIZED", "Tizimga kiring."));
  next();
}

/** Tashkilot tanlangan bo'lishi shart. */
export function requireOrg(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(new HttpError(401, "UNAUTHORIZED", "Tizimga kiring."));
  if (!req.auth.orgId || !req.auth.role) return next(new HttpError(403, "NO_TENANT", "Tashkilot tanlanmagan."));
  next();
}

export function requirePlatform(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(new HttpError(401, "UNAUTHORIZED", "Tizimga kiring."));
  if (!req.auth.isPlatformAdmin) return next(new HttpError(403, "FORBIDDEN", "Faqat platforma administratori uchun."));
  next();
}

/** Rollar matritsasidagi ruxsat (tashkilot egasi o'zgartira oladi) */
export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth?.role) return next(new HttpError(401, "UNAUTHORIZED", "Tizimga kiring."));
    if (!req.auth.permissions.includes(permission)) return next(new HttpError(403, "FORBIDDEN", "Rolingizda bu amal uchun ruxsat yo'q. Tashkilot egasiga murojaat qiling."));
    next();
  };
}

export function requireRoles(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth?.role || !roles.includes(req.auth.role)) return next(new HttpError(403, "FORBIDDEN", "Bu amal uchun ruxsat yo'q."));
    next();
  };
}

export function moduleEnabled(orgId: string, key: string) {
  const r = db.prepare("SELECT enabled FROM org_modules WHERE org_id = ? AND module_key = ?").get(orgId, key) as { enabled: number } | undefined;
  return !!r?.enabled;
}

/** Ta'lim moduli yoqilgan va rolga modulga kirish berilgan bo'lishi shart. `levels` — ruxsat etilgan darajalar. */
export function requireFeature(key: FeatureKey, levels?: Access[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const a = req.auth;
    // Sessiya yo'q yoki bekor qilingan — 401 (frontend login sahifasiga qaytaradi)
    if (!a) return next(new HttpError(401, "UNAUTHORIZED", "Tizimga kiring."));
    if (!a.orgId || !a.role) return next(new HttpError(403, "NO_TENANT", "Tashkilot tanlanmagan."));
    if (!moduleEnabled(a.orgId, "education")) return next(new HttpError(403, "MODULE_DISABLED", "Ta'lim moduli yoqilmagan."));
    const access = accessOf(a.role, key);
    if (!access || (levels && !levels.includes(access))) return next(new HttpError(403, "FORBIDDEN", "Bu bo'limga ruxsat yo'q."));
    // O'zgartirish amallari — rollar matritsasidagi ruxsat ham bo'lishi shart
    const perm = FEATURE_MANAGE_PERMISSION[key];
    if (levels?.length === 1 && levels[0] === "manage" && perm && !a.permissions.includes(perm)) {
      return next(new HttpError(403, "FORBIDDEN", "Rolingizda bu amal uchun ruxsat yo'q. Tashkilot egasiga murojaat qiling."));
    }
    next();
  };
}

export const access = (req: Request, key: FeatureKey) => accessOf(req.auth?.role ?? undefined, key);
