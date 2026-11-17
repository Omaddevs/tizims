/**
 * Super admin API — faqat platforma darajasi. Tashkilot ichki ma'lumotlari (baho, xabar, murojaat) bu yerda yo'q.
 * Har bir o'zgarish platforma auditiga yoziladi.
 */
import { Router } from "express";
import { PLATFORM, db, getDoc, listDocs, putDoc, tx } from "../db";
import { requirePlatform } from "../auth";
import { auditPlatform, body, forbidden, h, has, invalid, notFound, nowStamp, num, oneOf, str, strArray, today } from "../http";
import { expireAccess } from "./org";
import { MODULES } from "../../src/core/catalog";
import {
  BACKUPS,
  INCIDENTS,
  INTEGRATIONS,
  MRR_HISTORY,
  PLANS,
  SECURITY_EVENTS,
  SECURITY_POLICIES,
  SERVICES,
  STAFF_ROLES,
  UPTIME_30D,
  type Announcement,
  type Audience,
  type DataRequest,
  type FeatureFlag,
  type Maintenance,
  type PlanKey,
  type Promo,
  type StaffMember,
  type StaffRole,
  type SupportAccess,
  type Ticket,
} from "../../src/data/platform";

export const platformRouter = Router();
platformRouter.use(requirePlatform);

const MODULE_KEYS = MODULES.map((m) => m.key);
const PLAN_KEYS = PLANS.map((p) => p.key);
const ORG_TYPES = ["university", "school", "shop", "pharmacy", "company", "clinic", "restaurant", "agency", "other"] as const;

/* ───────── Tashkilotlar ───────── */

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  plan: PlanKey;
  seats: number;
  owner_name: string | null;
  owner_email: string | null;
  storage_gb: number;
  storage_limit_gb: number;
  api_calls: number;
  paid_until: string | null;
  billing: string;
  created_at: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

function tenantView(o: OrgRow) {
  const modules = (db.prepare("SELECT module_key FROM org_modules WHERE org_id = ? AND enabled = 1").all(o.id) as { module_key: string }[]).map((r) => r.module_key);
  const members = db
    .prepare("SELECT m.id, u.name, m.role FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? AND m.status = 'active' ORDER BY m.is_owner DESC, u.name")
    .all(o.id) as { id: string; name: string; role: string }[];
  return {
    id: o.id,
    name: o.name,
    slug: o.slug,
    type: o.type,
    status: o.status,
    plan: o.plan,
    seats: o.seats,
    owner: o.owner_name ?? "—",
    ownerEmail: o.owner_email ?? "",
    modules,
    createdAt: o.created_at,
    storageGb: o.storage_gb,
    storageLimitGb: o.storage_limit_gb,
    apiCalls: o.api_calls,
    paidUntil: o.paid_until ?? "",
    billing: o.billing,
    email: o.email ?? undefined,
    phone: o.phone ?? undefined,
    address: o.address ?? undefined,
    members,
  };
}

const loadOrg = (id: string) => db.prepare("SELECT * FROM organizations WHERE id = ?").get(id) as OrgRow | undefined;

platformRouter.get(
  "/tenants",
  h((_req, res) => {
    const rows = db.prepare("SELECT * FROM organizations ORDER BY created_at DESC").all() as unknown as OrgRow[];
    res.json(rows.map(tenantView));
  }),
);

platformRouter.post(
  "/tenants",
  h((req, res) => {
    const b = body(req);
    const name = str(b, "name", { min: 3, max: 160 });
    const slug = str(b, "slug", { pattern: /^[a-z0-9-]{3,32}$/ });
    if (db.prepare("SELECT 1 FROM organizations WHERE slug = ?").get(slug)) throw invalid(`${slug}.tizims.uz band.`);
    const type = oneOf(b, "type", ORG_TYPES);
    const plan = oneOf(b, "plan", PLAN_KEYS);
    const owner = str(b, "owner", { min: 3, max: 120 });
    const ownerEmail = str(b, "ownerEmail", { max: 160, pattern: /^\S+@\S+\.\S+$/ });
    const trial = bool(b.trial);
    const modules: string[] = type === "university" || type === "school" ? ["education", "analytics"] : type === "shop" ? ["shop", "crm", "warehouse"] : ["crm"];
    const id = `org-${Date.now().toString(36)}`;
    const until = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    tx(() => {
      db.prepare(
        `INSERT INTO organizations (id, name, slug, type, status, plan, seats, owner_name, owner_email, email, storage_gb, storage_limit_gb, api_calls, paid_until, billing, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, ?, 0, ?, ?, ?)`,
      ).run(id, name, slug, type, trial ? "trial" : "active", plan, owner, ownerEmail, ownerEmail, plan === "enterprise" ? 1000 : plan === "business" ? 50 : 5, until, trial ? "trial" : "paid", today());
      const ins = db.prepare("INSERT INTO org_modules (org_id, module_key, enabled) VALUES (?, ?, 1)");
      modules.forEach((k) => ins.run(id, k));
      putDoc(PLATFORM, "api_limits", slug, { slug, perMinute: plan === "enterprise" ? 1200 : plan === "business" ? 300 : 120, used24h: 0, keys: 0, blocked: 0 });
    });
    auditPlatform(req, "Tashkilot", slug, `Yangi tashkilot yaratildi (${plan}${trial ? ", 30 kunlik sinov" : ""})`);
    res.status(201).json(tenantView(loadOrg(id)!));
  }),
);

function bool(v: unknown) {
  return v === true;
}

platformRouter.patch(
  "/tenants/:id",
  h((req, res) => {
    const o = loadOrg(String(req.params.id));
    if (!o) throw notFound("Tashkilot");
    const b = body(req);
    const changes: string[] = [];
    tx(() => {
      if (has(b, "status")) {
        const status = oneOf(b, "status", ["active", "trial", "suspended"] as const);
        if (status !== o.status) {
          db.prepare("UPDATE organizations SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, o.id);
          changes.push(status === "suspended" ? "To'xtatildi — foydalanuvchilar kira olmaydi" : `Holat: ${status}`);
        }
      }
      if (has(b, "plan")) {
        const plan = oneOf(b, "plan", PLAN_KEYS);
        if (plan !== o.plan) {
          db.prepare("UPDATE organizations SET plan = ?, updated_at = datetime('now') WHERE id = ?").run(plan, o.id);
          changes.push(`Tarif: ${o.plan} → ${plan}`);
        }
      }
      if (has(b, "modules")) {
        const next = strArray(b, "modules", MODULE_KEYS);
        const cur = (db.prepare("SELECT module_key FROM org_modules WHERE org_id = ? AND enabled = 1").all(o.id) as { module_key: string }[]).map((r) => r.module_key);
        const on = next.filter((k) => !cur.includes(k));
        const off = cur.filter((k) => !next.includes(k));
        const up = db.prepare(
          "INSERT INTO org_modules (org_id, module_key, enabled) VALUES (?, ?, ?) ON CONFLICT (org_id, module_key) DO UPDATE SET enabled = excluded.enabled",
        );
        on.forEach((k) => up.run(o.id, k, 1));
        off.forEach((k) => up.run(o.id, k, 0));
        if (on.length) changes.push(`${on.join(", ")} moduli yoqildi`);
        if (off.length) changes.push(`${off.join(", ")} moduli o'chirildi`);
      }
    });
    for (const c of changes) auditPlatform(req, c.startsWith("Tarif") ? "Tarif" : c.includes("modul") ? "Modul" : "Tashkilot", o.slug, c);
    res.json(tenantView(loadOrg(o.id)!));
  }),
);

/** Tashkilot egasiga ilova ichida bildirishnoma (eslatma, qo'llanma, bog'lanish) */
platformRouter.post(
  "/tenants/:id/notify",
  h((req, res) => {
    const o = loadOrg(String(req.params.id));
    if (!o) throw notFound("Tashkilot");
    const b = body(req);
    const title = str(b, "title", { min: 3, max: 120 });
    const text = str(b, "body", { min: 3, max: 1000 });
    const owners = db.prepare("SELECT user_id FROM memberships WHERE org_id = ? AND status = 'active' AND (is_owner = 1 OR role = 'owner')").all(o.id) as { user_id: string }[];
    if (owners.length === 0) throw invalid("Bu tashkilot egasining tizimda akkaunti yo'q.");
    const ins = db.prepare("INSERT INTO notifications (id, org_id, for_user_id, data) VALUES (?, ?, ?, ?)");
    for (const ow of owners) {
      const id = `n-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      ins.run(id, o.id, ow.user_id, JSON.stringify({ id, title: `TIZIMS: ${title}`, body: text, time: nowStamp(), read: false, channel: "inapp", forUserId: ow.user_id, link: "/organization" }));
    }
    auditPlatform(req, "Xabar", o.slug, `Egaga bildirishnoma: ${title}`);
    res.json({ sent: owners.length });
  }),
);

/* ───────── Obunalar ───────── */

platformRouter.get(
  "/billing",
  h((_req, res) => {
    res.json({ plans: PLANS, invoices: listDocs(PLATFORM, "invoices").reverse(), mrrHistory: MRR_HISTORY, promos: listDocs<Promo>(PLATFORM, "promos").reverse() });
  }),
);

platformRouter.post(
  "/promos",
  h((req, res) => {
    const b = body(req);
    const code = str(b, "code", { pattern: /^[A-Z0-9]{4,16}$/ });
    if (getDoc(PLATFORM, "promos", code)) throw invalid("Bu kod allaqachon mavjud.");
    const expires = str(b, "expires", { pattern: /^\d{4}-\d{2}-\d{2}$/ });
    if (expires < today()) throw invalid("Muddat o'tgan sana bo'lmasin.");
    const p: Promo = {
      code,
      discount: num(b, "discount", { min: 1, max: 90, int: true }),
      months: num(b, "months", { min: 1, max: 24, int: true }),
      audience: str(b, "audience", { min: 2, max: 80 }),
      used: 0,
      limit: num(b, "limit", { min: 1, max: 100000, int: true }),
      expires,
      active: true,
    };
    putDoc(PLATFORM, "promos", code, p);
    auditPlatform(req, "Promo", code, `${p.discount}% · ${p.months} oy · ${p.limit} ta`);
    res.status(201).json(p);
  }),
);

platformRouter.patch(
  "/promos/:code",
  h((req, res) => {
    const p = getDoc<Promo>(PLATFORM, "promos", String(req.params.code));
    if (!p) throw notFound("Promo-kod");
    const active = body(req).active === true;
    putDoc(PLATFORM, "promos", p.code, { ...p, active });
    auditPlatform(req, "Promo", p.code, active ? "Yoqildi" : "O'chirildi");
    res.json({ ...p, active });
  }),
);

/* ───────── Yordam markazi ───────── */

platformRouter.get(
  "/tickets",
  h((_req, res) => {
    res.json(listDocs<Ticket>(PLATFORM, "tickets").sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }),
);

platformRouter.post(
  "/tickets/:id/reply",
  h((req, res) => {
    const t = getDoc<Ticket>(PLATFORM, "tickets", String(req.params.id));
    if (!t) throw notFound("So'rov");
    if (t.status === "resolved") throw invalid("So'rov yopilgan.");
    const text = str(body(req), "text", { min: 2, max: 4000 });
    const next: Ticket = { ...t, status: "pending", replies: [...t.replies, { by: `TIZIMS yordam · ${req.auth!.user.name}`, text, at: nowStamp() }] };
    putDoc(PLATFORM, "tickets", t.id, next);
    auditPlatform(req, "Yordam", t.id, "Javob yuborildi");
    res.json(next);
  }),
);

platformRouter.patch(
  "/tickets/:id",
  h((req, res) => {
    const t = getDoc<Ticket>(PLATFORM, "tickets", String(req.params.id));
    if (!t) throw notFound("So'rov");
    const status = oneOf(body(req), "status", ["open", "pending", "resolved"] as const);
    const next = { ...t, status };
    putDoc(PLATFORM, "tickets", t.id, next);
    auditPlatform(req, "Yordam", t.id, `Holat: ${status}`);
    res.json(next);
  }),
);

platformRouter.get(
  "/access",
  h((_req, res) => {
    res.json(expireAccess(listDocs<SupportAccess>(PLATFORM, "access")).reverse());
  }),
);

platformRouter.post(
  "/access",
  h((req, res) => {
    const b = body(req);
    const tenant = str(b, "tenant", { max: 40 });
    if (!db.prepare("SELECT 1 FROM organizations WHERE slug = ?").get(tenant)) throw notFound("Tashkilot");
    const all = listDocs<SupportAccess>(PLATFORM, "access");
    if (all.some((x) => x.tenant === tenant && (x.status === "pending" || x.status === "active"))) throw invalid("Bu tashkilot uchun ochiq so'rov allaqachon bor.");
    const n = Math.max(31, ...all.map((x) => Number(x.id.replace(/\D/g, "")) || 0)) + 1;
    const x: SupportAccess & { hours: number } = {
      id: `ACC-${n}`,
      tenant,
      reason: str(b, "reason", { min: 5, max: 300 }),
      ticket: str(b, "ticket", { optional: true, max: 20 }) || undefined,
      status: "pending",
      requestedAt: nowStamp(),
      hours: num(b, "hours", { min: 1, max: 8, int: true }),
    };
    putDoc(PLATFORM, "access", x.id, x);
    auditPlatform(req, "Yordam rejimi", tenant, `${x.hours} soatlik faqat-o'qish kirish so'raldi: ${x.reason}`);
    res.status(201).json(x);
  }),
);

/* ───────── E'lonlar va texnik ishlar ───────── */

const AUDIENCES: Audience[] = ["all", "education", "business", "owners"];

platformRouter.get(
  "/announcements",
  h((_req, res) => {
    res.json({ announcements: listDocs<Announcement>(PLATFORM, "announcements").reverse(), maintenance: listDocs<Maintenance>(PLATFORM, "maintenance").reverse() });
  }),
);

platformRouter.post(
  "/announcements",
  h((req, res) => {
    const b = body(req);
    const publish = b.publish === true;
    const all = listDocs<Announcement>(PLATFORM, "announcements");
    const n = Math.max(12, ...all.map((x) => Number(x.id.replace(/\D/g, "")) || 0)) + 1;
    const a: Announcement = {
      id: `ANN-${n}`,
      title: str(b, "title", { min: 4, max: 160 }),
      body: str(b, "body", { min: 6, max: 2000 }),
      audience: oneOf(b, "audience", AUDIENCES),
      tone: oneOf(b, "tone", ["info", "success", "warning"] as const),
      channels: strArray(b, "channels", ["banner", "email", "telegram"]) as Announcement["channels"],
      status: publish ? "published" : "draft",
      createdAt: today(),
      reach: publish ? reachOf(oneOf(b, "audience", AUDIENCES)) : undefined,
    };
    if (a.channels.length === 0) throw invalid("Kamida bitta kanal tanlang.");
    putDoc(PLATFORM, "announcements", a.id, a);
    auditPlatform(req, "E'lon", a.id, `${publish ? "E'lon qilindi" : "Qoralama"}: ${a.title}`);
    res.status(201).json(a);
  }),
);

/** E'lon qamrovi — tanlangan auditoriyadagi faol foydalanuvchilar soni */
function reachOf(aud: Audience) {
  const where = aud === "education" ? "AND o.type IN ('university','school')" : aud === "business" ? "AND o.type NOT IN ('university','school')" : "";
  if (aud === "owners") return (db.prepare("SELECT COUNT(*) c FROM organizations WHERE status != 'suspended'").get() as { c: number }).c;
  return (db.prepare(`SELECT COALESCE(SUM(o.seats), 0) c FROM organizations o WHERE o.status != 'suspended' ${where}`).get() as { c: number }).c;
}

platformRouter.patch(
  "/announcements/:id",
  h((req, res) => {
    const a = getDoc<Announcement>(PLATFORM, "announcements", String(req.params.id));
    if (!a) throw notFound("E'lon");
    const status = oneOf(body(req), "status", ["published", "archived"] as const);
    if (status === "published" && a.status !== "draft") throw invalid("Faqat qoralamani e'lon qilish mumkin.");
    const next: Announcement = { ...a, status, reach: status === "published" ? reachOf(a.audience) : a.reach };
    putDoc(PLATFORM, "announcements", a.id, next);
    auditPlatform(req, "E'lon", a.id, status === "published" ? "E'lon qilindi" : "Arxivlandi");
    res.json(next);
  }),
);

const DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

platformRouter.post(
  "/maintenance",
  h((req, res) => {
    const b = body(req);
    const start = str(b, "start", { pattern: DT });
    const end = str(b, "end", { pattern: DT });
    if (end <= start) throw invalid("Tugash vaqti boshlanishdan keyin bo'lishi kerak.");
    const all = listDocs<Maintenance>(PLATFORM, "maintenance");
    const n = Math.max(7, ...all.map((x) => Number(x.id.replace(/\D/g, "")) || 0)) + 1;
    const m: Maintenance = { id: `MNT-${n}`, title: str(b, "title", { min: 4, max: 160 }), start, end, services: strArray(b, "services").slice(0, 10), status: "scheduled" };
    putDoc(PLATFORM, "maintenance", m.id, m);
    auditPlatform(req, "Texnik ish", m.id, `${m.title}: ${start.replace("T", " ")} — ${end.replace("T", " ")}`);
    res.status(201).json(m);
  }),
);

platformRouter.patch(
  "/maintenance/:id",
  h((req, res) => {
    const m = getDoc<Maintenance>(PLATFORM, "maintenance", String(req.params.id));
    if (!m) throw notFound("Texnik ish");
    const status = oneOf(body(req), "status", ["in_progress", "done", "cancelled"] as const);
    const allowed: Record<Maintenance["status"], Maintenance["status"][]> = { scheduled: ["in_progress", "cancelled"], in_progress: ["done"], done: [], cancelled: [] };
    if (!allowed[m.status].includes(status)) throw invalid("Bu holatga o'tkazib bo'lmaydi.");
    const next = { ...m, status };
    putDoc(PLATFORM, "maintenance", m.id, next);
    auditPlatform(req, "Texnik ish", m.id, `Holat: ${status}`);
    res.json(next);
  }),
);

/* ───────── Monitoring va xavfsizlik (ko'rsatkichlar) ───────── */

platformRouter.get(
  "/monitoring",
  h((_req, res) => {
    res.json({ services: SERVICES, incidents: INCIDENTS, uptime: UPTIME_30D, backups: BACKUPS });
  }),
);

platformRouter.post(
  "/backups",
  h((req, res) => {
    auditPlatform(req, "Monitoring", "backup", "Qo'lda zaxira nusxa navbatga qo'yildi");
    res.status(202).json({ queued: true });
  }),
);

platformRouter.get(
  "/security",
  h((_req, res) => {
    const saved = getDoc<Record<string, boolean>>(PLATFORM, "settings", "policies") ?? {};
    res.json({ policies: SECURITY_POLICIES.map((p) => ({ ...p, on: saved[p.key] ?? p.on })), events: SECURITY_EVENTS, integrations: INTEGRATIONS });
  }),
);

platformRouter.patch(
  "/security/policies/:key",
  h((req, res) => {
    const p = SECURITY_POLICIES.find((x) => x.key === String(req.params.key));
    if (!p) throw notFound("Siyosat");
    const on = body(req).on === true;
    const saved = getDoc<Record<string, boolean>>(PLATFORM, "settings", "policies") ?? {};
    putDoc(PLATFORM, "settings", "policies", { ...saved, [p.key]: on });
    auditPlatform(req, "Xavfsizlik", p.key, `${p.name}: ${on ? "yoqildi" : "o'chirildi"}`);
    res.json({ ...p, on });
  }),
);

/* ───────── Platforma jamoasi ───────── */

const STAFF_KEYS = STAFF_ROLES.map((r) => r.key);

platformRouter.get(
  "/staff",
  h((_req, res) => {
    res.json(listDocs<StaffMember>(PLATFORM, "staff"));
  }),
);

platformRouter.post(
  "/staff",
  h((req, res) => {
    const b = body(req);
    const email = str(b, "email", { max: 160, pattern: /^[^\s@]+@tizims\.ai$/i }).toLowerCase();
    if (listDocs<StaffMember>(PLATFORM, "staff").some((s) => s.email === email)) throw invalid("Bu email allaqachon jamoada.");
    const role = oneOf(b, "role", STAFF_KEYS) as StaffRole;
    if (role === "owner") throw forbidden("Bosh administrator rolini taklif orqali berib bo'lmaydi.");
    const s: StaffMember = { id: `s-${Date.now().toString(36)}`, name: str(b, "name", { min: 3, max: 120 }), email, role, mfa: false, lastSeen: "—", status: "invited" };
    putDoc(PLATFORM, "staff", s.id, s);
    auditPlatform(req, "Jamoa", email, `Taklif yuborildi: ${STAFF_ROLES.find((r) => r.key === role)?.name}`);
    res.status(201).json(s);
  }),
);

platformRouter.patch(
  "/staff/:id",
  h((req, res) => {
    const s = getDoc<StaffMember>(PLATFORM, "staff", String(req.params.id));
    if (!s) throw notFound("Xodim");
    if (s.role === "owner") throw forbidden("Bosh administratorni bu yerdan o'zgartirib bo'lmaydi.");
    const b = body(req);
    const next = { ...s };
    if (has(b, "role")) {
      next.role = oneOf(b, "role", STAFF_KEYS) as StaffRole;
      if (next.role === "owner") throw forbidden("Bosh administrator rolini berib bo'lmaydi.");
    }
    if (has(b, "status")) next.status = oneOf(b, "status", ["active", "disabled"] as const);
    putDoc(PLATFORM, "staff", s.id, next);
    if (next.role !== s.role) auditPlatform(req, "Jamoa", s.email, `Rol: ${s.role} → ${next.role}`);
    if (next.status !== s.status) auditPlatform(req, "Jamoa", s.email, next.status === "disabled" ? "Kirish o'chirildi" : "Kirish tiklandi");
    res.json(next);
  }),
);

/* ───────── Funksiya bayroqlari ───────── */

platformRouter.get(
  "/flags",
  h((_req, res) => {
    res.json(listDocs<FeatureFlag>(PLATFORM, "flags"));
  }),
);

platformRouter.patch(
  "/flags/:key",
  h((req, res) => {
    const f = getDoc<FeatureFlag>(PLATFORM, "flags", String(req.params.key));
    if (!f) throw notFound("Funksiya");
    const b = body(req);
    const next = { ...f };
    if (has(b, "stage")) next.stage = oneOf(b, "stage", ["off", "pilot", "on"] as const);
    if (has(b, "tenants")) {
      const slugs = (db.prepare("SELECT slug FROM organizations").all() as { slug: string }[]).map((r) => r.slug);
      next.tenants = strArray(b, "tenants", slugs);
    }
    if (next.stage === "pilot" && next.tenants.length === 0) throw invalid("Pilot uchun kamida bitta tashkilot tanlang.");
    putDoc(PLATFORM, "flags", f.key, next);
    auditPlatform(req, "Reliz", f.key, next.stage === "pilot" ? `Pilot: ${next.tenants.join(", ")}` : next.stage === "on" ? "Hammaga yoqildi" : "O'chirildi");
    res.json(next);
  }),
);

/* ───────── API limitlar va ma'lumot so'rovlari ───────── */

platformRouter.get(
  "/api-limits",
  h((_req, res) => {
    res.json(listDocs(PLATFORM, "api_limits"));
  }),
);

platformRouter.patch(
  "/api-limits/:slug",
  h((req, res) => {
    const slug = String(req.params.slug);
    if (!db.prepare("SELECT 1 FROM organizations WHERE slug = ?").get(slug)) throw notFound("Tashkilot");
    const cur = getDoc<{ slug: string; perMinute: number; used24h: number; keys: number; blocked: number }>(PLATFORM, "api_limits", slug) ?? { slug, perMinute: 0, used24h: 0, keys: 0, blocked: 0 };
    const perMinute = num(body(req), "perMinute", { min: 0, max: 10000, int: true });
    putDoc(PLATFORM, "api_limits", slug, { ...cur, perMinute });
    auditPlatform(req, "API", slug, perMinute ? `Limit: ${cur.perMinute} → ${perMinute} so'rov/daqiqa` : "API kirish o'chirildi");
    res.json({ ...cur, perMinute });
  }),
);

platformRouter.get(
  "/data-requests",
  h((_req, res) => {
    res.json(listDocs<DataRequest>(PLATFORM, "data_requests").reverse());
  }),
);

platformRouter.patch(
  "/data-requests/:id",
  h((req, res) => {
    const d = getDoc<DataRequest>(PLATFORM, "data_requests", String(req.params.id));
    if (!d) throw notFound("So'rov");
    const status = oneOf(body(req), "status", ["processing", "ready", "done", "rejected"] as const);
    // Ega tasdig'isiz eksport/o'chirish boshlanmaydi
    const allowed: Record<DataRequest["status"], DataRequest["status"][]> = { awaiting_owner: ["rejected"], processing: ["ready"], ready: ["done"], done: [], rejected: [] };
    if (!allowed[d.status].includes(status)) throw invalid(d.status === "awaiting_owner" ? "Tashkilot egasi tasdiqlamaguncha jarayon boshlanmaydi." : "Bu holatga o'tkazib bo'lmaydi.");
    const next = { ...d, status };
    putDoc(PLATFORM, "data_requests", d.id, next);
    auditPlatform(req, "Ma'lumotlar", d.id, `${d.kind === "export" ? "Eksport" : "O'chirish"}: ${status}`);
    res.json(next);
  }),
);

/* ───────── Platforma auditi ───────── */

platformRouter.get(
  "/audit",
  h((_req, res) => {
    const rows = db.prepare("SELECT id, actor_name, action, object, detail, ip, at FROM audit_log WHERE scope = 'platform' ORDER BY id DESC LIMIT 1000").all() as Record<string, string | number | null>[];
    res.json(rows.map((r) => ({ id: r.id, at: r.at, actor: r.actor_name, action: r.action, target: r.object, detail: r.detail ?? "", ip: r.ip ?? "" })));
  }),
);
