/**
 * Bo'sh bazani demo ma'lumotlar bilan to'ldiradi (frontenddagi demo fayllardan — bitta manba).
 * Faqat `users` jadvali bo'sh bo'lganda ishlaydi. Qayta to'ldirish: `npm run db:reset`.
 */
import { PLATFORM, db, getDoc, putDoc, tx, writeAudit } from "./db";
import { hashPassword } from "./auth";
import { AUDIT, NOTIFICATIONS, TASKS, USERS } from "../src/data/seed";
import { MEMBERSHIPS, ORGANIZATIONS } from "../src/core/seed";
import { ORG_IAU } from "../src/core/ids";
import {
  ANNOUNCEMENTS,
  API_LIMITS,
  DATA_REQUESTS,
  FEATURE_FLAGS,
  INVOICES,
  MAINTENANCES,
  PLATFORM_AUDIT,
  PROMOS,
  SECURITY_POLICIES,
  STAFF,
  SUPPORT_ACCESS,
  TENANTS,
  TICKETS,
} from "../src/data/platform";
import { ASSIGNMENTS, COMPLAINTS, FACULTIES, GRADES, GROUPS, LESSONS, MATERIALS, SEMESTERS, STUDENTS, SUBJECTS } from "../src/data/academic";
import { countDocs } from "./db";
import { seedContent } from "./routes/content";

/**
 * Migratsiya: fanlar avval faylda edi — mavjud bazalarga bir marta ko'chiriladi.
 * Shundan keyin fan va o'qituvchi biriktiruvi faqat bazada boshqariladi.
 */
export function ensureSubjects() {
  if (!db.prepare("SELECT 1 FROM organizations WHERE id = ?").get(ORG_IAU)) return false;
  let changed = false;
  if (countDocs(ORG_IAU, "subjects") === 0) {
    for (const s of SUBJECTS) putDoc(ORG_IAU, "subjects", s.code, s);
    changed = true;
  }
  // Semestrlar ham bazaga (yopish jarayoni ularni o'zgartiradi)
  if (countDocs(ORG_IAU, "semesters") === 0) {
    for (const s of SEMESTERS) putDoc(ORG_IAU, "semesters", s.id, s);
    changed = true;
  }
  if (ensureChatPeople()) changed = true;
  if (countDocs(ORG_IAU, "posts") === 0 || countDocs(ORG_IAU, "tests") === 0) {
    seedContent(ORG_IAU);
    changed = true;
  }
  return changed;
}

/**
 * Xabarlar uchun: fan o'qituvchilari va dekan o'rinbosari tizimga kira oladigan akkauntlar bo'lsin
 * (talaba ularga hujjat yubora olishi uchun). Lavozimlar "profiles" to'plamida.
 */
const CHAT_PEOPLE = [
  { id: "t-nodira", email: "n.karimova@iau.uz", name: "Prof. Nodira Karimova", role: "teacher", password: "teacher123" },
  { id: "t-bekzod", email: "b.tursunov@iau.uz", name: "Bekzod Tursunov", role: "teacher", password: "teacher123" },
  { id: "t-kamola", email: "k.ergasheva@iau.uz", name: "Kamola Ergasheva", role: "teacher", password: "teacher123" },
  { id: "t-alisher", email: "a.rasulov@iau.uz", name: "Dr. Alisher Rasulov", role: "teacher", password: "teacher123" },
  { id: "u-deputy", email: "deputy@tizims.ai", name: "Dilshod Mirzayev", role: "dept_head", password: "deputy123" },
];
const PROFILES: Record<string, { position: string; faculty?: string }> = {
  u3: { position: "Rektor" },
  u5: { position: "Dekan · Axborot texnologiyalari fakulteti", faculty: "f-it" },
  "u-deputy": { position: "Dekan o'rinbosari (o'quv ishlari) · AT fakulteti", faculty: "f-it" },
  "u-ts-advisor": { position: "Nazoratchi · O'quv bo'limi" },
  "u-ts-owner": { position: "Tashkilot rahbari" },
};

function ensureChatPeople() {
  let changed = false;
  const hasUser = db.prepare("SELECT 1 FROM users WHERE id = ? OR email = ?");
  const insUser = db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)");
  const insM = db.prepare("INSERT INTO memberships (id, user_id, org_id, role, status, is_owner) VALUES (?, ?, ?, ?, 'active', 0)");
  for (const p of CHAT_PEOPLE) {
    if (hasUser.get(p.id, p.email)) continue;
    insUser.run(p.id, p.email, hashPassword(p.password), p.name);
    insM.run(`m-${p.id}`, p.id, ORG_IAU, p.role);
    changed = true;
  }
  for (const [id, prof] of Object.entries(PROFILES)) {
    if (getDoc(ORG_IAU, "profiles", id)) continue;
    putDoc(ORG_IAU, "profiles", id, prof);
    changed = true;
  }
  return changed;
}

/** Demo murojaat mualliflarini akkauntlarga bog'lash */
const AUTHOR_IDS: Record<string, string> = {
  "Jasmina Aliyeva": "u-ts-student",
  "Bahrom Aliyev": "u-ts-parent",
  "Dr. Sardor Rahimov": "u-ts-teacher",
  "Javohir Karimov": "demo-student-javohir",
};

export function seedIfEmpty() {
  const { c } = db.prepare("SELECT COUNT(*) c FROM users").get() as { c: number };
  if (c > 0) return false;

  tx(() => {
    const insUser = db.prepare("INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)");
    for (const u of USERS) insUser.run(u.id, u.email, hashPassword(u.password), u.name);

    const insOrg = db.prepare(
      `INSERT INTO organizations (id, name, slug, type, status, plan, seats, owner_name, owner_email, email, phone, address, primary_color,
        storage_gb, storage_limit_gb, api_calls, paid_until, billing, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const t of TENANTS) {
      const o = ORGANIZATIONS.find((x) => x.id === t.id);
      insOrg.run(t.id, t.name, t.slug, t.type, t.status, t.plan, t.seats, t.owner, t.ownerEmail, o?.email ?? t.ownerEmail, o?.phone ?? null, o?.address ?? null, o?.primaryColor ?? "#0984E3", t.storageGb, t.storageLimitGb, t.apiCalls, t.paidUntil, t.billing, t.createdAt);
    }

    const insM = db.prepare("INSERT INTO memberships (id, user_id, org_id, role, status, is_owner, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const m of MEMBERSHIPS) insM.run(m.id, m.userId, m.organizationId, m.role, m.status, m.isOwner ? 1 : 0, m.joinedAt);

    const insMod = db.prepare("INSERT INTO org_modules (org_id, module_key, enabled) VALUES (?, ?, 1)");
    for (const t of TENANTS) for (const k of t.modules) insMod.run(t.id, k);

    const insTask = db.prepare("INSERT INTO tasks (id, org_id, number, owner_id, assignee_id, data) VALUES (?, ?, ?, ?, ?, ?)");
    for (const t of TASKS) insTask.run(t.id, ORG_IAU, t.number, t.ownerId ?? null, t.assigneeId ?? null, JSON.stringify({ ...t, organizationId: ORG_IAU }));

    const insNote = db.prepare("INSERT INTO notifications (id, org_id, for_user_id, data) VALUES (?, ?, ?, ?)");
    for (const n of NOTIFICATIONS) insNote.run(n.id, ORG_IAU, n.forUserId ?? null, JSON.stringify({ ...n, organizationId: ORG_IAU }));
    const insRead = db.prepare("INSERT INTO notification_reads (notification_id, user_id) VALUES (?, ?)");
    for (const n of NOTIFICATIONS.filter((x) => x.read)) for (const u of USERS) insRead.run(n.id, u.id);

    for (const a of AUDIT)
      db.prepare(
        "INSERT INTO audit_log (scope, org_id, actor_name, action, object, object_id, old_value, new_value, ip, at) VALUES ('tenant', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(ORG_IAU, a.user, a.action, a.object, a.objectId, a.oldValue ?? null, a.newValue ?? null, a.ip, a.date);
    for (const a of [...PLATFORM_AUDIT].reverse())
      db.prepare("INSERT INTO audit_log (scope, actor_name, action, object, object_id, detail, at) VALUES ('platform', ?, ?, ?, ?, ?, ?)").run(a.actor, a.action, a.target, a.target, a.detail, a.at);

    // ── Platforma hujjatlari ──
    for (const t of TICKETS) putDoc(PLATFORM, "tickets", t.id, t);
    for (const a of SUPPORT_ACCESS) putDoc(PLATFORM, "access", a.id, a);
    for (const a of ANNOUNCEMENTS) putDoc(PLATFORM, "announcements", a.id, a);
    for (const m of MAINTENANCES) putDoc(PLATFORM, "maintenance", m.id, m);
    for (const s of STAFF) putDoc(PLATFORM, "staff", s.id, s);
    for (const f of FEATURE_FLAGS) putDoc(PLATFORM, "flags", f.key, f);
    for (const p of PROMOS) putDoc(PLATFORM, "promos", p.code, p);
    for (const [slug, l] of Object.entries(API_LIMITS)) putDoc(PLATFORM, "api_limits", slug, { slug, ...l });
    for (const d of DATA_REQUESTS) putDoc(PLATFORM, "data_requests", d.id, d);
    for (const i of INVOICES) putDoc(PLATFORM, "invoices", i.id, i);
    putDoc(PLATFORM, "settings", "policies", Object.fromEntries(SECURITY_POLICIES.map((p) => [p.key, p.on])));

    // ── IAU ta'lim ma'lumotlari ──
    for (const x of COMPLAINTS) putDoc(ORG_IAU, "complaints", x.id, { ...x, authorId: AUTHOR_IDS[x.author] ?? null });
    for (const g of GRADES) putDoc(ORG_IAU, "grades", `${g.subject}:${g.studentId}`, g);
    for (const l of LESSONS) putDoc(ORG_IAU, "lessons", l.id, l);
    for (const s of STUDENTS) putDoc(ORG_IAU, "students", s.id, s);
    for (const g of GROUPS) putDoc(ORG_IAU, "groups", g.id, g);
    for (const f of FACULTIES) putDoc(ORG_IAU, "faculties", f.id, f);
    for (const m of MATERIALS) putDoc(ORG_IAU, "materials", m.id, m);
    for (const a of ASSIGNMENTS) putDoc(ORG_IAU, "assignments", a.id, a);
    putDoc(ORG_IAU, "submissions", "a4:u-ts-student", { assignmentId: "a4", userId: "u-ts-student", file: "uy-vazifa-6.pdf", at: "2026-11-15 21:40" });
  });

  ensureSubjects();
  writeAudit({ scope: "platform", actorName: "Tizim", action: "Tizim", object: "database", detail: "Demo ma'lumotlar bilan to'ldirildi" });
  return true;
}
