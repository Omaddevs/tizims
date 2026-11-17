/** Tashkilot darajasi: vazifalar, bildirishnomalar, audit, sozlamalar, e'lon banneri, yordam rejimi tasdiqlari. */
import { unreadMessages } from "./chat";
import { Router } from "express";
import { PLATFORM, db, getDoc, listDocs, prefsOf, putDoc, writeAudit, type NotifyTopic } from "../db";
import { requireOrg, requirePermission, requireRoles } from "../auth";
import { auditTenant, body, forbidden, h, has, localStamp, notFound, oneOf, str, strArray, today } from "../http";
import { EDU_ONLY_ROLES, MODULES } from "../../src/core/catalog";
import { accessOf } from "../../src/core/features";
import { ORG_ADMIN_ROLES, noteVisible, taskVisibleTo } from "../../src/core/access";
import type { NotificationItem, Priority, Role, Task, TaskStatus } from "../../src/types";
import type { Announcement, DataRequest, Maintenance, SupportAccess } from "../../src/data/platform";

export const orgRouter = Router();
orgRouter.use(requireOrg);
// Super admin — faqat platforma darajasi: tashkilot ichki API'lari (vazifa, audit, a'zolar...) yopiq
orgRouter.use((req, _res, next) => {
  if (req.auth?.isPlatformAdmin && req.path !== "/banner") return next(forbidden("Super admin tashkilot ichki ma'lumotlarini ko'rmaydi. Kerak bo'lsa — Yordam rejimi."));
  next();
});

const PRIORITIES: Priority[] = ["critical", "urgent", "high", "medium", "low"];
const STATUSES: TaskStatus[] = ["pending", "in_progress", "done", "failed"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function dueLabelFor(due: string) {
  const t = today();
  const tm = localStamp(new Date(Date.now() + 86400000)).slice(0, 10);
  if (due === t) return "Bugun";
  if (due === tm) return "Ertaga";
  if (due < t) return "Kechikkan";
  const months = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];
  const [, m, d] = due.split("-").map(Number);
  return `${d} ${months[m - 1]}`;
}

function memberOf(orgId: string, userId: string) {
  return db
    .prepare("SELECT u.id, u.name, m.role FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? AND m.user_id = ? AND m.status = 'active'")
    .get(orgId, userId) as { id: string; name: string; role: Role } | undefined;
}

function loadTask(orgId: string, id: string) {
  const r = db.prepare("SELECT data FROM tasks WHERE org_id = ? AND id = ?").get(orgId, id) as { data: string } | undefined;
  return r ? (JSON.parse(r.data) as Task) : undefined;
}

function saveTask(orgId: string, t: Task) {
  db.prepare("UPDATE tasks SET data = ?, owner_id = ?, assignee_id = ?, updated_at = datetime('now') WHERE org_id = ? AND id = ?").run(JSON.stringify(t), t.ownerId ?? null, t.assigneeId ?? null, orgId, t.id);
}

const me = (req: Parameters<typeof requireOrg>[0]) => ({ id: req.auth!.user.id, role: req.auth!.role! });

/* ───────── Vazifalar ───────── */

orgRouter.get(
  "/tasks",
  h((req, res) => {
    const rows = db.prepare("SELECT data FROM tasks WHERE org_id = ? ORDER BY number DESC").all(req.auth!.orgId) as { data: string }[];
    // Muddat yorlig'i ("Bugun", "Kechikkan"...) saqlanmaydi — har safar bugungi sanaga nisbatan hisoblanadi
    res.json(rows.map((r) => JSON.parse(r.data) as Task).filter((t) => taskVisibleTo(t, me(req))).map((t) => ({ ...t, dueLabel: dueLabelFor(t.due) })));
  }),
);

orgRouter.post(
  "/tasks",
  h((req, res) => {
    const a = req.auth!;
    const b = body(req);
    const title = str(b, "title", { min: 2, max: 200 });
    const due = str(b, "due", { pattern: DATE });
    const priority = oneOf(b, "priority", PRIORITIES);
    const category = str(b, "category", { optional: true, max: 60 }) || "Umumiy";
    let assigneeId = str(b, "assigneeId", { optional: true, max: 100 }) || a.user.id;
    // Kabinet rollari faqat o'zlariga vazifa yaratadi
    if (EDU_ONLY_ROLES.includes(a.role!)) assigneeId = a.user.id;
    const assignee = memberOf(a.orgId!, assigneeId);
    if (!assignee) throw notFound("Mas'ul xodim");

    const number = ((db.prepare("SELECT MAX(number) n FROM tasks WHERE org_id = ?").get(a.orgId) as { n: number | null }).n ?? 0) + 1;
    const task: Task = {
      id: `t-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      number,
      title,
      description: str(b, "description", { optional: true, max: 4000 }) || undefined,
      note: str(b, "note", { optional: true, max: 2000 }) || undefined,
      due,
      dueLabel: dueLabelFor(due),
      priority,
      status: "pending",
      done: false,
      category,
      ownerId: a.user.id,
      assigneeId: assignee.id,
      assigneeName: assignee.name,
      tags: has(b, "tags") ? strArray(b, "tags").slice(0, 10) : undefined,
      createdAt: today(),
      organizationId: a.orgId!,
      subtasks: [],
      comments: [],
      files: [],
    };
    db.prepare("INSERT INTO tasks (id, org_id, number, owner_id, assignee_id, data) VALUES (?, ?, ?, ?, ?, ?)").run(task.id, a.orgId, number, task.ownerId ?? null, task.assigneeId ?? null, JSON.stringify(task));
    auditTenant(req, "CREATE", "Task", task.id, { newValue: title });
    res.status(201).json(task);
  }),
);

orgRouter.patch(
  "/tasks/:id",
  h((req, res) => {
    const a = req.auth!;
    const t = loadTask(a.orgId!, String(req.params.id));
    if (!t || !taskVisibleTo(t, me(req))) throw notFound("Vazifa");
    const b = body(req);
    const next: Task = { ...t };
    if (has(b, "title")) next.title = str(b, "title", { min: 2, max: 200 });
    if (has(b, "description")) next.description = str(b, "description", { optional: true, max: 4000 }) || undefined;
    if (has(b, "note")) next.note = str(b, "note", { optional: true, max: 2000 }) || undefined;
    if (has(b, "category")) next.category = str(b, "category", { max: 60 });
    if (has(b, "priority")) next.priority = oneOf(b, "priority", PRIORITIES);
    if (has(b, "due")) {
      next.due = str(b, "due", { pattern: DATE });
      next.dueLabel = dueLabelFor(next.due);
    }
    if (has(b, "tags")) next.tags = strArray(b, "tags").slice(0, 10);
    if (has(b, "archived")) next.archived = b.archived === true;
    if (has(b, "assigneeId")) {
      const id = str(b, "assigneeId", { max: 100 });
      if (EDU_ONLY_ROLES.includes(a.role!) && id !== a.user.id) throw forbidden("Vazifani boshqaga biriktira olmaysiz.");
      const m = memberOf(a.orgId!, id);
      if (!m) throw notFound("Mas'ul xodim");
      next.assigneeId = m.id;
      next.assigneeName = m.name;
    }
    if (has(b, "status")) {
      next.status = oneOf(b, "status", STATUSES);
      next.done = next.status === "done";
    }
    if (has(b, "done")) {
      next.done = b.done === true;
      if (next.done) next.status = "done";
      else if (t.status === "done") next.status = "pending";
    }
    saveTask(a.orgId!, next);
    if (t.status !== next.status) auditTenant(req, "UPDATE", "Task", t.id, { oldValue: `status: ${t.status}`, newValue: `status: ${next.status}` });
    else auditTenant(req, "UPDATE", "Task", t.id, { newValue: next.title });
    res.json({ ...next, dueLabel: dueLabelFor(next.due) });
  }),
);

orgRouter.delete(
  "/tasks/:id",
  h((req, res) => {
    const a = req.auth!;
    const t = loadTask(a.orgId!, String(req.params.id));
    if (!t || !taskVisibleTo(t, me(req))) throw notFound("Vazifa");
    if (EDU_ONLY_ROLES.includes(a.role!) && t.ownerId !== a.user.id) throw forbidden("Faqat o'zingiz yaratgan vazifani o'chira olasiz.");
    db.prepare("DELETE FROM tasks WHERE org_id = ? AND id = ?").run(a.orgId, t.id);
    auditTenant(req, "DELETE", "Task", t.id, { oldValue: t.title });
    res.json({ success: true });
  }),
);

orgRouter.post(
  "/tasks/:id/subtasks/:sid/toggle",
  h((req, res) => {
    const a = req.auth!;
    const t = loadTask(a.orgId!, String(req.params.id));
    if (!t || !taskVisibleTo(t, me(req))) throw notFound("Vazifa");
    const sid = String(req.params.sid);
    if (!t.subtasks?.some((s) => s.id === sid)) throw notFound("Kichik vazifa");
    const subtasks = t.subtasks.map((s) => {
      if (s.id !== sid) return s;
      const done = !s.done;
      return { ...s, done, doneAt: done ? new Date().toLocaleDateString("ru-RU") : undefined };
    });
    const allDone = subtasks.every((s) => s.done);
    const next: Task = { ...t, subtasks, done: allDone ? true : t.done, status: allDone ? "done" : t.status === "done" ? "in_progress" : t.status };
    saveTask(a.orgId!, next);
    res.json({ ...next, dueLabel: dueLabelFor(next.due) });
  }),
);

/* ───────── A'zolar (vazifa biriktirish uchun) ───────── */

orgRouter.get(
  "/members",
  h((req, res) => {
    const a = req.auth!;
    if (EDU_ONLY_ROLES.includes(a.role!)) {
      res.json([{ id: a.user.id, name: a.user.name, email: a.user.email, role: a.role }]);
      return;
    }
    const rows = db
      .prepare("SELECT u.id, u.name, u.email, m.role FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? AND m.status = 'active' ORDER BY u.name")
      .all(a.orgId);
    res.json(rows);
  }),
);

/* ───────── Bildirishnomalar ───────── */

orgRouter.get(
  "/notifications",
  h((req, res) => {
    const a = req.auth!;
    const rows = db
      .prepare(
        `SELECT n.data, (SELECT 1 FROM notification_reads r WHERE r.notification_id = n.id AND r.user_id = ?) AS is_read
         FROM notifications n WHERE n.org_id = ? AND (n.for_user_id IS NULL OR n.for_user_id = ?) ORDER BY n.created_at DESC, n.rowid`,
      )
      .all(a.user.id, a.orgId, a.user.id) as { data: string; is_read: number | null }[];
    res.json(
      rows
        .map((r) => ({ ...(JSON.parse(r.data) as NotificationItem), read: !!r.is_read }))
        .filter((n) => noteVisible(n, a.user.id, a.role!)),
    );
  }),
);

orgRouter.post(
  "/notifications/read-all",
  h((req, res) => {
    const a = req.auth!;
    db.prepare(
      `INSERT OR IGNORE INTO notification_reads (notification_id, user_id)
       SELECT id, ? FROM notifications WHERE org_id = ? AND (for_user_id IS NULL OR for_user_id = ?)`,
    ).run(a.user.id, a.orgId, a.user.id);
    res.json({ success: true });
  }),
);

orgRouter.post(
  "/notifications/:id/read",
  h((req, res) => {
    const a = req.auth!;
    const n = db.prepare("SELECT id FROM notifications WHERE id = ? AND org_id = ? AND (for_user_id IS NULL OR for_user_id = ?)").get(String(req.params.id), a.orgId, a.user.id);
    if (!n) throw notFound("Bildirishnoma");
    db.prepare("INSERT OR IGNORE INTO notification_reads (notification_id, user_id) VALUES (?, ?)").run(String(req.params.id), a.user.id);
    res.json({ success: true });
  }),
);

/* ───────── Audit va sozlamalar (rahbariyat) ───────── */

orgRouter.get(
  "/audit",
  requirePermission("core.audit.view"),
  h((req, res) => {
    const rows = db
      .prepare("SELECT id, actor_name, action, object, object_id, old_value, new_value, detail, ip, at FROM audit_log WHERE scope = 'tenant' AND org_id = ? ORDER BY id DESC LIMIT 500")
      .all(req.auth!.orgId) as Record<string, string | number | null>[];
    res.json(
      rows.map((r) => ({
        id: String(r.id),
        user: r.actor_name,
        action: r.action,
        object: r.object,
        objectId: r.object_id,
        oldValue: r.old_value ?? undefined,
        newValue: r.new_value ?? r.detail ?? undefined,
        date: r.at,
        ip: r.ip ?? "—",
      })),
    );
  }),
);

orgRouter.get(
  "/settings",
  requireRoles(...ORG_ADMIN_ROLES),
  h((req, res) => {
    const a = req.auth!;
    const org = db.prepare("SELECT id, name, slug, type, plan, status, currency, primary_color, seats, email, phone, address FROM organizations WHERE id = ?").get(a.orgId) as Record<string, unknown>;
    const enabled = (db.prepare("SELECT module_key FROM org_modules WHERE org_id = ? AND enabled = 1").all(a.orgId) as { module_key: string }[]).map((r) => r.module_key);
    const members = db.prepare("SELECT m.role, COUNT(*) c FROM memberships m WHERE m.org_id = ? AND m.status = 'active' GROUP BY m.role").all(a.orgId) as { role: string; c: number }[];
    res.json({ organization: org, modules: MODULES.map((m) => ({ key: m.key, name: m.name, enabled: enabled.includes(m.key) })), members });
  }),
);

/* ───────── Yordam rejimi: ega tasdiqlaydi yoki rad etadi ───────── */

function orgSlug(orgId: string) {
  return (db.prepare("SELECT slug FROM organizations WHERE id = ?").get(orgId) as { slug: string }).slug;
}

/** Muddati o'tgan faol sessiyalarni yopadi */
export function expireAccess(list: SupportAccess[]) {
  const now = Date.now();
  return list.map((x) => {
    if (x.status === "active" && x.expiresAt && Date.parse(x.expiresAt.replace(" ", "T")) < now) {
      const y = { ...x, status: "expired" as const };
      putDoc(PLATFORM, "access", y.id, y);
      return y;
    }
    return x;
  });
}

orgRouter.get(
  "/support-access",
  requireRoles(...ORG_ADMIN_ROLES),
  h((req, res) => {
    const slug = orgSlug(req.auth!.orgId!);
    res.json(expireAccess(listDocs<SupportAccess>(PLATFORM, "access")).filter((x) => x.tenant === slug).reverse());
  }),
);

orgRouter.post(
  "/support-access/:id/decision",
  requireRoles(...ORG_ADMIN_ROLES),
  h((req, res) => {
    const a = req.auth!;
    const slug = orgSlug(a.orgId!);
    const x = getDoc<SupportAccess & { hours?: number }>(PLATFORM, "access", String(req.params.id));
    if (!x || x.tenant !== slug) throw notFound("So'rov");
    const b = body(req);
    const decision = oneOf(b, "decision", ["approve", "deny", "revoke"] as const);
    if (decision !== "revoke" && x.status !== "pending") throw forbidden("So'rov allaqachon ko'rib chiqilgan.");
    if (decision === "revoke" && x.status !== "active") throw forbidden("Faqat faol sessiyani bekor qilish mumkin.");
    const hours = x.hours ?? 2;
    const end = new Date(Date.now() + hours * 3600000);
    const next: SupportAccess =
      decision === "approve"
        ? { ...x, status: "active", expiresAt: localStamp(end) }
        : decision === "deny"
          ? { ...x, status: "denied" }
          : { ...x, status: "expired" };
    putDoc(PLATFORM, "access", x.id, next);
    const label = decision === "approve" ? `${hours} soatga tasdiqlandi` : decision === "deny" ? "rad etildi" : "ega tomonidan bekor qilindi";
    auditTenant(req, "SUPPORT_ACCESS", "SupportAccess", x.id, { newValue: label });
    writeAudit({ scope: "platform", actorId: a.user.id, actorName: `${a.user.name} (ega)`, action: "Yordam rejimi", object: slug, objectId: x.id, detail: `So'rov ${label}`, ip: req.ip });
    res.json(next);
  }),
);

/* ───────── Ma'lumot eksport / o'chirish so'rovlari: ega tasdiqlaydi ───────── */

orgRouter.get(
  "/data-requests",
  requireRoles("owner"),
  h((req, res) => {
    const slug = orgSlug(req.auth!.orgId!);
    res.json(listDocs<DataRequest>(PLATFORM, "data_requests").filter((d) => d.tenant === slug).reverse());
  }),
);

orgRouter.post(
  "/data-requests/:id/decision",
  requireRoles("owner"),
  h((req, res) => {
    const a = req.auth!;
    const slug = orgSlug(a.orgId!);
    const d = getDoc<DataRequest>(PLATFORM, "data_requests", String(req.params.id));
    if (!d || d.tenant !== slug) throw notFound("So'rov");
    if (d.status !== "awaiting_owner") throw forbidden("So'rov allaqachon ko'rib chiqilgan.");
    const decision = oneOf(body(req), "decision", ["approve", "deny"] as const);
    const next: DataRequest = { ...d, status: decision === "approve" ? "processing" : "rejected" };
    putDoc(PLATFORM, "data_requests", d.id, next);
    auditTenant(req, "DATA_REQUEST", "DataRequest", d.id, { newValue: `${d.kind}: ${decision === "approve" ? "tasdiqlandi" : "rad etildi"}` });
    writeAudit({ scope: "platform", actorId: a.user.id, actorName: `${a.user.name} (ega)`, action: "Ma'lumotlar", object: slug, objectId: d.id, detail: `${d.kind === "export" ? "Eksport" : "O'chirish"} so'rovi ${decision === "approve" ? "tasdiqlandi" : "rad etildi"}`, ip: req.ip });
    res.json(next);
  }),
);

/* ───────── Mening sozlamalarim ───────── */

const TOPICS: NotifyTopic[] = ["schedule", "grades", "assignments", "news", "messages"];

orgRouter.get(
  "/me/preferences",
  h((req, res) => {
    res.json(prefsOf(req.auth!.orgId!, req.auth!.user.id));
  }),
);

orgRouter.put(
  "/me/preferences",
  h((req, res) => {
    const b = body(req);
    const next = Object.fromEntries(TOPICS.map((t) => [t, b[t] !== false])) as Record<NotifyTopic, boolean>;
    putDoc(req.auth!.orgId!, "prefs", req.auth!.user.id, next);
    res.json(next);
  }),
);

/* ───────── Menyu belgilari (haqiqiy sonlar) ───────── */

orgRouter.get(
  "/badges",
  h((req, res) => {
    const a = req.auth!;
    const t = today();
    const tasks = (db.prepare("SELECT data FROM tasks WHERE org_id = ?").all(a.orgId) as { data: string }[])
      .map((r) => JSON.parse(r.data) as Task)
      .filter((x) => taskVisibleTo(x, me(req)));
    const mine = tasks.filter((x) => !x.done && !x.archived && (x.assigneeId === a.user.id || x.ownerId === a.user.id));
    const allOpen = tasks.filter((x) => !x.done && !x.archived);
    const unread = (db
      .prepare(
        `SELECT COUNT(*) c FROM notifications n WHERE n.org_id = ? AND (n.for_user_id IS NULL OR n.for_user_id = ?)
         AND NOT EXISTS (SELECT 1 FROM notification_reads r WHERE r.notification_id = n.id AND r.user_id = ?)`,
      )
      .get(a.orgId, a.user.id, a.user.id) as { c: number }).c;
    const edu = !!(db.prepare("SELECT 1 FROM org_modules WHERE org_id = ? AND module_key = 'education' AND enabled = 1").get(a.orgId));
    const canComplaints = edu && accessOf(a.role!, "complaints") === "manage" && a.permissions.includes("edu.complaints.manage");
    const newComplaints = canComplaints ? listDocs<{ status: string }>(a.orgId!, "complaints").filter((c) => c.status === "new").length : 0;

    let attention = 0;
    if (a.role === "owner") {
      const slug = orgSlug(a.orgId!);
      const o = db.prepare("SELECT billing FROM organizations WHERE id = ?").get(a.orgId) as { billing: string };
      attention =
        listDocs<SupportAccess>(PLATFORM, "access").filter((x) => x.tenant === slug && x.status === "pending").length +
        listDocs<DataRequest>(PLATFORM, "data_requests").filter((d) => d.tenant === slug && d.status === "awaiting_owner").length +
        newComplaints +
        allOpen.filter((x) => x.due < t).length +
        (o.billing === "overdue" ? 1 : 0);
    }
    res.json({ messages: a.role ? unreadMessages(a.orgId!, a.user.id, a.role) : 0, myTasks: mine.length, myOverdue: mine.filter((x) => x.due < t).length, overdueTasks: allOpen.filter((x) => x.due < t).length, unread, newComplaints, attention });
  }),
);

/* ───────── Platforma e'lonlari banneri ───────── */

orgRouter.get(
  "/banner",
  h((req, res) => {
    const a = req.auth!;
    if (a.isPlatformAdmin) {
      res.json({ announcements: [], maintenance: null });
      return;
    }
    const org = db.prepare("SELECT type FROM organizations WHERE id = ?").get(a.orgId) as { type: string };
    const isEdu = org.type === "university" || org.type === "school";
    const anns = listDocs<Announcement>(PLATFORM, "announcements").filter(
      (x) =>
        x.status === "published" &&
        x.channels.includes("banner") &&
        (x.audience === "all" || (x.audience === "education" && isEdu) || (x.audience === "business" && !isEdu) || (x.audience === "owners" && a.role === "owner")),
    );
    res.json({ announcements: anns.reverse(), maintenance: upcoming(listDocs<Maintenance>(PLATFORM, "maintenance")) ?? null });
  }),
);

export function upcoming(list: Maintenance[], now = new Date()) {
  const week = now.getTime() + 7 * 86400000;
  return list
    .filter((m) => (m.status === "scheduled" || m.status === "in_progress") && new Date(m.end).getTime() > now.getTime() && new Date(m.start).getTime() < week)
    .sort((x, y) => x.start.localeCompare(y.start))[0];
}
