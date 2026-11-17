/**
 * Tashkilot rahbariyati: a'zolar (akkauntlar va rollar), tashkilot profili, obuna, TIZIMS yordamiga murojaat,
 * ma'lumot eksporti so'rovi. Har bir amal rollar matritsasidagi ruxsat bilan tekshiriladi va auditga yoziladi.
 */
import { Router, type Request } from "express";
import { randomBytes } from "node:crypto";
import { PLATFORM, db, getDoc, listDocs, putDoc, tx, writeAudit } from "../db";
import { hashPassword, requireOrg, requirePermission, requireRoles, revokeSessions } from "../auth";
import { auditTenant, body, forbidden, h, has, invalid, newId, notFound, nowStamp, oneOf, str, today } from "../http";
import { STUDENT_LINKS } from "../../src/core/access";
import { PLANS, type DataRequest, type PlanKey, type Ticket, type TicketPriority } from "../../src/data/platform";
import { riskOf, type Complaint, type ComplaintStatus, type Faculty, type Group, type Student, type Subject } from "../../src/data/academic";
import type { Role } from "../../src/types";

export const ownerRouter = Router();
ownerRouter.use(requireOrg);

const org = (req: Request) => req.auth!.orgId!;
const orgRow = (id: string) =>
  db.prepare("SELECT id, name, slug, type, plan, seats, status, billing, paid_until, email, phone, address, primary_color FROM organizations WHERE id = ?").get(id) as {
    id: string;
    name: string;
    slug: string;
    type: string;
    plan: PlanKey;
    seats: number;
    status: string;
    billing: string;
    paid_until: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    primary_color: string;
  };

/** Ega bera oladigan rollar (super admin — faqat platforma) */
const ASSIGNABLE: Role[] = ["owner", "rector", "dept_head", "advisor", "teacher", "student", "parent"];

/* ───────── A'zolar ───────── */

interface MemberRow {
  user_id: string;
  name: string;
  email: string;
  role: Role;
  status: string;
  is_owner: number;
  joined_at: string;
  last_login_at: string | null;
  must_change_password: number;
  other_orgs: number;
}

function studentLinks(orgId: string): Record<string, string> {
  return { ...STUDENT_LINKS, ...(getDoc<Record<string, string>>(orgId, "settings", "student_links") ?? {}) };
}

function listMembers(orgId: string) {
  const rows = db
    .prepare(
      `SELECT m.user_id, u.name, u.email, m.role, m.status, m.is_owner, m.joined_at, u.last_login_at, u.must_change_password,
        (SELECT COUNT(*) FROM memberships x WHERE x.user_id = m.user_id AND x.org_id != m.org_id) AS other_orgs
       FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.org_id = ? AND m.role != 'super_admin'
       ORDER BY m.status, CASE m.role WHEN 'owner' THEN 0 WHEN 'rector' THEN 1 WHEN 'dept_head' THEN 2 WHEN 'advisor' THEN 3 WHEN 'teacher' THEN 4 ELSE 5 END, u.name`,
    )
    .all(orgId) as unknown as MemberRow[];
  const links = studentLinks(orgId);
  return rows.map((r) => ({
    id: r.user_id,
    name: r.name,
    email: r.email,
    role: r.role,
    status: r.status,
    isOwner: !!r.is_owner,
    joinedAt: r.joined_at,
    lastLoginAt: r.last_login_at,
    pendingPassword: !!r.must_change_password,
    sharedAccount: r.other_orgs > 0,
    studentId: links[r.user_id] ?? null,
  }));
}

function activeOwners(orgId: string) {
  return (db.prepare("SELECT COUNT(*) c FROM memberships WHERE org_id = ? AND role = 'owner' AND status = 'active'").get(orgId) as { c: number }).c;
}

const tempPassword = () => randomBytes(9).toString("base64url").replace(/[-_]/g, "x").slice(0, 12);

ownerRouter.get(
  "/members/manage",
  requirePermission("core.users.manage"),
  h((req, res) => {
    res.json({ members: listMembers(org(req)), students: listDocs<Student>(org(req), "students").map((s) => ({ id: s.id, name: s.name, group: s.group })) });
  }),
);

function validateStudentLink(req: Request, role: Role, studentId: string) {
  if (role !== "student" && role !== "parent") return null;
  if (!studentId) throw invalid("Talaba yoki ota-ona uchun bog'langan talabani tanlang.");
  if (!getDoc<Student>(org(req), "students", studentId)) throw invalid("Talaba topilmadi.");
  return studentId;
}

ownerRouter.post(
  "/members",
  requirePermission("core.users.manage"),
  h((req, res) => {
    const b = body(req);
    const email = str(b, "email", { max: 160, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }).toLowerCase();
    const role = oneOf(b, "role", ASSIGNABLE);
    if (role === "owner" && req.auth!.role !== "owner") throw forbidden("Ega rolini faqat ega bera oladi.");
    const studentId = validateStudentLink(req, role, str(b, "studentId", { optional: true, max: 30 }));
    const existing = db.prepare("SELECT id, name FROM users WHERE email = ?").get(email) as { id: string; name: string } | undefined;

    let password: string | null = null;
    const userId = existing?.id ?? `u-${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
    tx(() => {
      if (!existing) {
        const name = str(b, "name", { min: 3, max: 120 });
        password = tempPassword();
        db.prepare("INSERT INTO users (id, email, password_hash, name, must_change_password) VALUES (?, ?, ?, ?, 1)").run(userId, email, hashPassword(password), name);
      } else if (db.prepare("SELECT 1 FROM memberships WHERE user_id = ? AND org_id = ?").get(userId, org(req))) {
        throw invalid("Bu foydalanuvchi tashkilotda allaqachon bor.");
      }
      db.prepare("INSERT INTO memberships (id, user_id, org_id, role, status, is_owner, joined_at) VALUES (?, ?, ?, ?, 'active', ?, ?)").run(newId("ms"), userId, org(req), role, role === "owner" ? 1 : 0, today());
      if (studentId) putDoc(org(req), "settings", "student_links", { ...(getDoc<Record<string, string>>(org(req), "settings", "student_links") ?? {}), [userId]: studentId });
    });
    auditTenant(req, "CREATE", "Member", email, { newValue: `${role}${existing ? " (mavjud akkaunt)" : ""}` });
    const member = listMembers(org(req)).find((m) => m.id === userId)!;
    // Vaqtinchalik parol faqat shu javobda bir marta qaytariladi va bazada saqlanmaydi (faqat hash)
    res.status(201).json({ member, tempPassword: password });
  }),
);

ownerRouter.patch(
  "/members/:userId",
  requirePermission("core.users.manage"),
  h((req, res) => {
    const userId = String(req.params.userId);
    const m = db.prepare("SELECT role, status FROM memberships WHERE user_id = ? AND org_id = ?").get(userId, org(req)) as { role: Role; status: string } | undefined;
    if (!m || m.role === "super_admin") throw notFound("A'zo");
    if (userId === req.auth!.user.id) throw forbidden("O'z rolingiz yoki holatingizni o'zgartira olmaysiz.");
    const b = body(req);
    const role = has(b, "role") ? oneOf(b, "role", ASSIGNABLE) : m.role;
    const status = has(b, "status") ? oneOf(b, "status", ["active", "suspended"] as const) : (m.status as "active" | "suspended");
    if ((role === "owner" || m.role === "owner") && req.auth!.role !== "owner") throw forbidden("Ega rolini faqat ega o'zgartira oladi.");
    const losingOwner = m.role === "owner" && m.status === "active" && (role !== "owner" || status !== "active");
    if (losingOwner && activeOwners(org(req)) <= 1) throw forbidden("Tashkilotda kamida bitta faol ega qolishi kerak.");
    const studentId = has(b, "studentId") || role !== m.role ? validateStudentLink(req, role, str(b, "studentId", { optional: true, max: 30 })) : undefined;

    tx(() => {
      db.prepare("UPDATE memberships SET role = ?, status = ?, is_owner = ? WHERE user_id = ? AND org_id = ?").run(role, status, role === "owner" ? 1 : 0, userId, org(req));
      if (studentId !== undefined) {
        const links = { ...(getDoc<Record<string, string>>(org(req), "settings", "student_links") ?? {}) };
        if (studentId) links[userId] = studentId;
        else delete links[userId];
        putDoc(org(req), "settings", "student_links", links);
      }
    });
    if (role !== m.role) auditTenant(req, "UPDATE", "Member", userId, { oldValue: `role: ${m.role}`, newValue: `role: ${role}` });
    if (status !== m.status) auditTenant(req, status === "suspended" ? "SUSPEND" : "ACTIVATE", "Member", userId, { oldValue: m.status, newValue: status });
    res.json(listMembers(org(req)).find((x) => x.id === userId));
  }),
);

/** Foydalanuvchi kartasi: akkaunt, a'zoliklar, rol tarixi, u qilgan amallar, vazifalari */
ownerRouter.get(
  "/members/:userId",
  requirePermission("core.users.manage"),
  h((req, res) => {
    const userId = String(req.params.userId);
    if (userId === "manage") throw notFound("A'zo");
    const member = listMembers(org(req)).find((m) => m.id === userId);
    if (!member) throw notFound("A'zo");
    const otherOrgs = (db.prepare("SELECT COUNT(*) c FROM memberships WHERE user_id = ? AND org_id != ?").get(userId, org(req)) as { c: number }).c;
    const changes = db
      .prepare("SELECT actor_name, action, old_value, new_value, at FROM audit_log WHERE scope = 'tenant' AND org_id = ? AND object = 'Member' AND object_id IN (?, ?) ORDER BY id DESC LIMIT 20")
      .all(org(req), userId, member.email) as { actor_name: string; action: string; old_value: string | null; new_value: string | null; at: string }[];
    const activity = db
      .prepare("SELECT action, object, object_id, new_value, detail, at FROM audit_log WHERE scope = 'tenant' AND org_id = ? AND actor_id = ? ORDER BY id DESC LIMIT 15")
      .all(org(req), userId) as { action: string; object: string; object_id: string; new_value: string | null; detail: string | null; at: string }[];
    const tasks = (db.prepare("SELECT data FROM tasks WHERE org_id = ? AND assignee_id = ?").all(org(req), userId) as { data: string }[]).map((r) => JSON.parse(r.data) as { id: string; title: string; due: string; done: boolean; status: string; priority: string });
    const student = member.studentId ? getDoc<Student>(org(req), "students", member.studentId) : undefined;
    const subjects = listDocs<Subject>(org(req), "subjects").filter((x) => x.teacherId === userId).map((x) => ({ code: x.code, name: x.name, groups: x.groups, credits: x.credits }));
    res.json({
      member,
      subjects,
      otherOrgs,
      student: student ? { id: student.id, name: student.name, group: student.group } : null,
      tasks: { open: tasks.filter((t) => !t.done).length, overdue: tasks.filter((t) => !t.done && t.due < today()).length, done: tasks.filter((t) => t.done).length, recent: tasks.filter((t) => !t.done).slice(0, 5) },
      changes: changes.map((c) => ({ at: c.at, by: c.actor_name, action: c.action, from: c.old_value, to: c.new_value })),
      activity: activity.map((a) => ({ at: a.at, action: a.action, object: a.object, objectId: a.object_id, detail: a.new_value ?? a.detail ?? "" })),
    });
  }),
);

ownerRouter.post(
  "/members/:userId/reset-password",
  requirePermission("core.users.manage"),
  h((req, res) => {
    const userId = String(req.params.userId);
    const m = db.prepare("SELECT role FROM memberships WHERE user_id = ? AND org_id = ?").get(userId, org(req)) as { role: Role } | undefined;
    if (!m || m.role === "super_admin") throw notFound("A'zo");
    if (userId === req.auth!.user.id) throw forbidden("O'z parolingizni profil menyusidan o'zgartiring.");
    // Boshqa tashkilotga ham a'zo akkaunt parolini tiklash — o'sha tashkilotdagi akkauntni egallashga olib keladi
    const other = (db.prepare("SELECT COUNT(*) c FROM memberships WHERE user_id = ? AND org_id != ?").get(userId, org(req)) as { c: number }).c;
    if (other > 0) throw forbidden("Bu akkaunt boshqa tashkilotlarga ham a'zo — parolni faqat foydalanuvchining o'zi yoki TIZIMS yordami tiklaydi.");
    const password = tempPassword();
    db.prepare("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?").run(hashPassword(password), userId);
    revokeSessions(userId); // eski parol bilan ochilgan sessiyalar darhol yopiladi
    auditTenant(req, "RESET_PASSWORD", "Member", userId);
    res.json({ tempPassword: password });
  }),
);

/* ───────── Tashkilot profili ───────── */

ownerRouter.patch(
  "/settings",
  requirePermission("core.org.manage"),
  h((req, res) => {
    const b = body(req);
    const o = orgRow(org(req));
    const next = {
      name: has(b, "name") ? str(b, "name", { min: 3, max: 160 }) : o.name,
      email: has(b, "email") ? str(b, "email", { optional: true, max: 160, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }) || null : o.email,
      phone: has(b, "phone") ? str(b, "phone", { optional: true, max: 30, pattern: /^[+\d\s()-]+$/ }) || null : o.phone,
      address: has(b, "address") ? str(b, "address", { optional: true, max: 240 }) || null : o.address,
      primary_color: has(b, "primaryColor") ? str(b, "primaryColor", { pattern: /^#[0-9a-fA-F]{6}$/ }) : o.primary_color,
    };
    db.prepare("UPDATE organizations SET name = ?, email = ?, phone = ?, address = ?, primary_color = ?, updated_at = datetime('now') WHERE id = ?").run(next.name, next.email, next.phone, next.address, next.primary_color, o.id);
    const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => next[k] !== o[k]);
    if (changed.length) auditTenant(req, "UPDATE", "Organization", o.slug, { newValue: changed.join(", ") });
    res.json({ ...orgRow(o.id) });
  }),
);

/* ───────── Obuna ───────── */

ownerRouter.get(
  "/billing",
  requirePermission("core.billing.view"),
  h((req, res) => {
    const o = orgRow(org(req));
    const plan = PLANS.find((p) => p.key === o.plan)!;
    const invoices = listDocs<{ id: string; tenant: string; amount: number; date: string; status: string }>(PLATFORM, "invoices").filter((i) => i.tenant === o.slug).reverse();
    const requests = listDocs<Ticket>(PLATFORM, "tickets").filter((t) => t.tenant === o.slug && t.subject.startsWith("Tarifni o'zgartirish"));
    const accounts = (db.prepare("SELECT COUNT(*) c FROM memberships WHERE org_id = ? AND status = 'active' AND role != 'super_admin'").get(o.id) as { c: number }).c;
    res.json({
      plan: o.plan,
      plans: PLANS,
      seats: o.seats,
      accounts,
      monthly: o.billing === "trial" ? 0 : o.seats * plan.price,
      billing: o.billing,
      paidUntil: o.paid_until,
      invoices,
      pendingPlanRequest: requests.find((t) => t.status !== "resolved")?.subject ?? null,
    });
  }),
);

ownerRouter.post(
  "/billing/plan-request",
  requirePermission("core.billing.view"),
  h((req, res) => {
    const o = orgRow(org(req));
    const b = body(req);
    const plan = oneOf(b, "plan", PLANS.map((p) => p.key));
    if (plan === o.plan) throw invalid("Bu sizning joriy tarifingiz.");
    const open = listDocs<Ticket>(PLATFORM, "tickets").some((t) => t.tenant === o.slug && t.status !== "resolved" && t.subject.startsWith("Tarifni o'zgartirish"));
    if (open) throw invalid("Tarif bo'yicha so'rovingiz allaqachon ko'rib chiqilmoqda.");
    const t = createTicket(req, o.slug, `Tarifni o'zgartirish: ${o.plan} → ${plan}`, str(b, "note", { optional: true, max: 1000 }) || "Izohsiz", "normal");
    auditTenant(req, "PLAN_REQUEST", "Organization", o.slug, { oldValue: o.plan, newValue: plan });
    res.status(201).json(t);
  }),
);

/* ───────── TIZIMS yordamiga murojaat ───────── */

function createTicket(req: Request, slug: string, subject: string, text: string, priority: TicketPriority) {
  const all = listDocs<Ticket>(PLATFORM, "tickets");
  const n = Math.max(482, ...all.map((t) => Number(t.id.replace(/\D/g, "")) || 0)) + 1;
  const t: Ticket = {
    id: `SUP-${n}`,
    tenant: slug,
    author: req.auth!.user.name,
    subject,
    body: text,
    priority,
    status: "open",
    createdAt: nowStamp(),
    sla: priority === "urgent" ? "1 soat" : priority === "high" ? "4 soat" : "1 kun",
    replies: [],
  };
  putDoc(PLATFORM, "tickets", t.id, t);
  writeAudit({ scope: "platform", actorId: req.auth!.user.id, actorName: `${req.auth!.user.name} (${slug})`, action: "Yordam", object: t.id, objectId: t.id, detail: `Yangi so'rov: ${subject}`, ip: req.ip });
  return t;
}

ownerRouter.get(
  "/tickets",
  requirePermission("core.support.manage"),
  h((req, res) => {
    const slug = orgRow(org(req)).slug;
    res.json(listDocs<Ticket>(PLATFORM, "tickets").filter((t) => t.tenant === slug).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }),
);

ownerRouter.post(
  "/tickets",
  requirePermission("core.support.manage"),
  h((req, res) => {
    const b = body(req);
    const t = createTicket(req, orgRow(org(req)).slug, str(b, "subject", { min: 4, max: 160 }), str(b, "body", { min: 10, max: 4000 }), oneOf(b, "priority", ["urgent", "high", "normal"] as const));
    auditTenant(req, "CREATE", "SupportTicket", t.id, { newValue: t.subject });
    res.status(201).json(t);
  }),
);

ownerRouter.post(
  "/tickets/:id/reply",
  requirePermission("core.support.manage"),
  h((req, res) => {
    const slug = orgRow(org(req)).slug;
    const t = getDoc<Ticket>(PLATFORM, "tickets", String(req.params.id));
    if (!t || t.tenant !== slug) throw notFound("So'rov");
    if (t.status === "resolved") throw invalid("So'rov yopilgan. Yangi so'rov yarating.");
    const next: Ticket = { ...t, status: "open", replies: [...t.replies, { by: `${req.auth!.user.name} (${slug})`, text: str(body(req), "text", { min: 2, max: 4000 }), at: nowStamp() }] };
    putDoc(PLATFORM, "tickets", t.id, next);
    res.json(next);
  }),
);

/* ───────── Ma'lumot eksporti / o'chirish so'rovi (faqat ega) ───────── */

ownerRouter.post(
  "/data-requests",
  requirePermission("core.org.manage"),
  h((req, res) => {
    if (req.auth!.role !== "owner") throw forbidden("Faqat tashkilot egasi so'rov yubora oladi.");
    const o = orgRow(org(req));
    const b = body(req);
    const kind = oneOf(b, "kind", ["export", "delete"] as const);
    if (kind === "delete" && str(b, "confirm", { max: 40 }) !== o.slug) throw invalid(`Tasdiqlash uchun "${o.slug}" deb yozing.`);
    const all = listDocs<DataRequest>(PLATFORM, "data_requests");
    if (all.some((d) => d.tenant === o.slug && d.kind === kind && (d.status === "processing" || d.status === "awaiting_owner"))) throw invalid("Bunday so'rov allaqachon jarayonda.");
    const n = Math.max(9, ...all.map((d) => Number(d.id.replace(/\D/g, "")) || 0)) + 1;
    // Ega o'zi yuborgani uchun tasdiq allaqachon bor — darhol jarayonga
    const d: DataRequest = { id: `DR-${n}`, tenant: o.slug, kind, reason: str(b, "reason", { min: 5, max: 300 }), requestedBy: `${req.auth!.user.name} (ega)`, requestedAt: today(), status: "processing" };
    putDoc(PLATFORM, "data_requests", d.id, d);
    auditTenant(req, "DATA_REQUEST", "DataRequest", d.id, { newValue: kind });
    writeAudit({ scope: "platform", actorId: req.auth!.user.id, actorName: `${req.auth!.user.name} (ega)`, action: "Ma'lumotlar", object: o.slug, objectId: d.id, detail: `${kind === "export" ? "Eksport" : "O'chirish"} so'rovi yuborildi`, ip: req.ip });
    res.status(201).json(d);
  }),
);

/* ───────── Ega bosh sahifasi: tashkilot holati (barcha raqamlar bazadan) ───────── */

ownerRouter.get(
  "/overview",
  requireRoles("owner"),
  h((req, res) => {
    const orgId = org(req);
    const o = orgRow(orgId);
    const plan = PLANS.find((p) => p.key === o.plan)!;
    const modules = (db.prepare("SELECT module_key FROM org_modules WHERE org_id = ? AND enabled = 1").all(orgId) as { module_key: string }[]).map((r) => r.module_key);
    const education = modules.includes("education");
    const t = today();

    // ── Ta'lim ko'rsatkichlari ──
    const students = education ? listDocs<Student>(orgId, "students") : [];
    const active = students.filter((s) => s.status === "active");
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : 0);
    const groups = education ? listDocs<Group>(orgId, "groups") : [];
    const faculties = education ? listDocs<Faculty>(orgId, "faculties") : [];
    const facultyRows = faculties.map((f) => {
      const ids = new Set(groups.filter((g) => g.faculty === f.id).map((g) => g.id));
      const st = active.filter((s) => ids.has(s.group));
      return {
        id: f.id,
        name: f.name,
        dean: f.dean,
        groups: ids.size,
        departments: f.departments.length,
        students: st.length,
        gpa: avg(st.filter((s) => s.gpa > 0).map((s) => s.gpa)),
        attendance: Math.round(avg(st.map((s) => s.attendance))),
        atRisk: st.filter((s) => riskOf(s) === "high").length,
      };
    });
    const complaints = education ? listDocs<Complaint>(orgId, "complaints") : [];
    const complaintCounts = { new: 0, review: 0, resolved: 0, rejected: 0 } as Record<ComplaintStatus, number>;
    complaints.forEach((c) => complaintCounts[c.status]++);

    // ── Xodimlar ──
    const memberRows = db.prepare("SELECT m.role, m.status, u.must_change_password p FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? AND m.role != 'super_admin'").all(orgId) as { role: Role; status: string; p: number }[];
    const byRole: Record<string, number> = {};
    memberRows.filter((m) => m.status === "active").forEach((m) => (byRole[m.role] = (byRole[m.role] ?? 0) + 1));

    // ── Vazifalar ──
    const tasks = (db.prepare("SELECT data FROM tasks WHERE org_id = ?").all(orgId) as { data: string }[]).map((r) => JSON.parse(r.data) as { done: boolean; due: string; status: string; archived?: boolean });
    const openTasks = tasks.filter((x) => !x.done && !x.archived);

    // ── Ega tasdig'ini kutayotganlar ──
    const pendingAccess = listDocs<{ tenant: string; status: string }>(PLATFORM, "access").filter((x) => x.tenant === o.slug && x.status === "pending").length;
    const pendingData = listDocs<DataRequest>(PLATFORM, "data_requests").filter((d) => d.tenant === o.slug && d.status === "awaiting_owner").length;
    const openTickets = listDocs<Ticket>(PLATFORM, "tickets").filter((x) => x.tenant === o.slug && x.status !== "resolved");

    const audit = db
      .prepare("SELECT actor_name, action, object, object_id, new_value, detail, at FROM audit_log WHERE scope = 'tenant' AND org_id = ? AND action NOT IN ('LOGIN','LOGOUT') ORDER BY id DESC LIMIT 8")
      .all(orgId) as { actor_name: string; action: string; object: string; object_id: string; new_value: string | null; detail: string | null; at: string }[];

    res.json({
      organization: { name: o.name, slug: o.slug, type: o.type },
      education,
      kpi: {
        students: active.length,
        studentsTotal: students.length,
        onLeave: students.filter((s) => s.status === "leave").length,
        gpa: avg(active.filter((s) => s.gpa > 0).map((s) => s.gpa)),
        attendance: Math.round(avg(active.map((s) => s.attendance)) * 10) / 10,
        staff: memberRows.filter((m) => m.status === "active" && m.role !== "student" && m.role !== "parent").length,
        accounts: memberRows.filter((m) => m.status === "active").length,
        groups: groups.length,
        faculties: faculties.length,
      },
      attention: {
        supportAccess: pendingAccess,
        dataRequests: pendingData,
        newComplaints: complaintCounts.new,
        overdueTasks: openTasks.filter((x) => x.due < t).length,
        pendingPasswords: memberRows.filter((m) => m.status === "active" && m.p).length,
        atRiskStudents: active.filter((s) => riskOf(s) === "high").length,
        billingOverdue: o.billing === "overdue",
        openTickets: openTickets.length,
      },
      faculties: facultyRows,
      complaints: complaintCounts,
      tasks: { open: openTasks.length, overdue: openTasks.filter((x) => x.due < t).length, done: tasks.filter((x) => x.done).length },
      members: { byRole, suspended: memberRows.filter((m) => m.status !== "active").length },
      subscription: { plan: plan.name, planKey: o.plan, seats: o.seats, monthly: o.billing === "trial" ? 0 : o.seats * plan.price, billing: o.billing, paidUntil: o.paid_until, modules },
      recent: audit.map((a) => ({ at: a.at, actor: a.actor_name, action: a.action, object: a.object, objectId: a.object_id, detail: a.new_value ?? a.detail ?? "" })),
    });
  }),
);
