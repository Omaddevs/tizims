/**
 * Ta'lim modullari API. Har bir so'rovda rol bo'yicha doira serverda tekshiriladi:
 *  o'qituvchi → o'z fanlari/guruhlari, talaba/ota-ona → bog'langan talaba, dekan → o'z fakulteti.
 */
import { Router, type Request } from "express";
import { db, getDoc, listDocs, putDoc, tx, wantsNotification } from "../db";
import { access, permissionMatrix, requireFeature } from "../auth";
import { semesterHistory } from "./semester";
import { LOCKED_ROLES } from "../../src/core/features";
import { auditPlatform, auditTenant, body, bool, forbidden, h, has, invalid, newId, notFound, nowStamp, num, oneOf, str, strArray, today } from "../http";
import { DEAN_FACULTY, STUDENT_LINKS } from "../../src/core/access";
import { PERMISSIONS } from "../../src/core/catalog";
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_DEPARTMENTS,
  COMPLAINT_ROUTE,
  MY_RESULTS,
  ROOMS,
  riskOf,
  TEACHERS,
  type Assignment,
  type AttendanceMark,
  type Complaint,
  type ComplaintStatus,
  type Faculty,
  type GradeRow,
  type Group,
  type Lesson,
  type Material,
  type Student,
  type StudentStatus,
  type Subject,
} from "../../src/data/academic";
import type { Role } from "../../src/types";

export const eduRouter = Router();

const org = (req: Request) => req.auth!.orgId!;
/** Nazoratchi barcha guruhlar uchun davomat va baho kiritadi (o'qituvchi — faqat o'z fanlari/darslari) */
const allClasses = (req: Request) => req.auth!.role === "advisor";
const uid = (req: Request) => req.auth!.user.id;
const role = (req: Request) => req.auth!.role!;

/* ───────── Doira yordamchilari ───────── */

/** Fanlar — bazadan (tashkilot egasi/dekan boshqaradi) */
const subjectsOf = (req: Request) => listDocs<Subject>(org(req), "subjects");
const teacherSubjects = (req: Request) => subjectsOf(req).filter((s) => s.teacherId === uid(req));

/** O'qituvchi ismi: tizim akkaunti bo'lsa — undan, aks holda eski ro'yxatdan */
function teacherNameOf(id: string) {
  const u = db.prepare("SELECT name FROM users WHERE id = ?").get(id) as { name: string } | undefined;
  return u?.name ?? TEACHERS.find((t) => t.id === id)?.name ?? "Biriktirilmagan";
}
const students = (req: Request) => listDocs<Student>(org(req), "students");
const groups = (req: Request) => listDocs<Group>(org(req), "groups");

/** Talaba/ota-ona akkauntining talaba yozuviga bog'lanishi: tashkilot egasi belgilaydi (+ demo bog'lanishlar) */
const studentLinks = (req: Request): Record<string, string> => ({ ...STUDENT_LINKS, ...(getDoc<Record<string, string>>(org(req), "settings", "student_links") ?? {}) });

function linkedStudent(req: Request): Student | undefined {
  const id = studentLinks(req)[uid(req)];
  return id ? getDoc<Student>(org(req), "students", id) : undefined;
}

/** Dekan uchun — o'z fakulteti guruhlari; boshqalar uchun null (cheklov yo'q). */
function facultyGroups(req: Request): string[] | null {
  if (role(req) !== "dept_head") return null;
  const f = DEAN_FACULTY[uid(req)];
  return groups(req)
    .filter((g) => g.faculty === f)
    .map((g) => g.id);
}

/* ───────── Murojaatlar ───────── */

type HistoryEntry = { at: string; by: string; text: string; kind: "created" | "status" | "department" | "answer" };
type StoredComplaint = Complaint & { authorId: string | null; history?: HistoryEntry[] };

const STATUS_TEXT: Record<ComplaintStatus, string> = { new: "Yangi", review: "Ko'rib chiqilmoqda", resolved: "Hal qilindi", rejected: "Rad etildi" };

function publicComplaint(c: StoredComplaint, viewerId: string) {
  const { authorId, history, ...rest } = c;
  const mine = authorId === viewerId;
  const author = c.anonymous && !mine ? "Anonim" : c.author;
  // Tarix: yaratilish yozuvi har doim birinchi; anonim muallif ismi tarixda ham yashiriladi
  const timeline: HistoryEntry[] = [{ at: c.date, by: author, text: `Murojaat yuborildi → ${c.department}`, kind: "created" }, ...(history ?? [])];
  return { ...rest, author, mine, history: timeline };
}

eduRouter.get(
  "/complaints",
  requireFeature("complaints"),
  h((req, res) => {
    let list = listDocs<StoredComplaint>(org(req), "complaints");
    if (access(req, "complaints") === "own") list = list.filter((c) => c.authorId === uid(req));
    res.json(list.map((c) => publicComplaint(c, uid(req))).sort((a, b) => b.date.localeCompare(a.date)));
  }),
);

eduRouter.post(
  "/complaints",
  requireFeature("complaints", ["own"]),
  h((req, res) => {
    const b = body(req);
    const category = oneOf(b, "category", COMPLAINT_CATEGORIES);
    const anonymous = bool(b, "anonymous");
    const existing = listDocs<StoredComplaint>(org(req), "complaints");
    const n = Math.max(120, ...existing.map((c) => Number(c.id.replace(/\D/g, "")) || 0)) + 1;
    const c: StoredComplaint = {
      id: `CMP-${n}`,
      title: str(b, "title", { min: 4, max: 160 }),
      body: str(b, "body", { min: 6, max: 4000 }),
      category,
      department: COMPLAINT_ROUTE[category] ?? "Talabalar bilan ishlash bo'limi",
      author: anonymous ? "Anonim" : req.auth!.user.name,
      authorRole: role(req),
      status: "new",
      date: today(),
      anonymous,
      authorId: uid(req),
    };
    putDoc(org(req), "complaints", c.id, c);
    auditTenant(req, "CREATE", "Complaint", c.id, { newValue: `${category} → ${c.department}` });
    res.status(201).json(publicComplaint(c, uid(req)));
  }),
);

eduRouter.patch(
  "/complaints/:id",
  requireFeature("complaints", ["manage"]),
  h((req, res) => {
    const c = getDoc<StoredComplaint>(org(req), "complaints", String(req.params.id));
    if (!c) throw notFound("Murojaat");
    const b = body(req);
    const next = { ...c };
    if (has(b, "status")) next.status = oneOf(b, "status", ["new", "review", "resolved", "rejected"] as ComplaintStatus[]);
    if (has(b, "department")) next.department = oneOf(b, "department", COMPLAINT_DEPARTMENTS);
    if (has(b, "answer")) next.answer = str(b, "answer", { optional: true, max: 4000 }) || undefined;
    const by = req.auth!.user.name;
    const at = nowStamp();
    const add: HistoryEntry[] = [];
    if (next.department !== c.department) add.push({ at, by, kind: "department", text: `Bo'lim: ${c.department} → ${next.department}` });
    if (next.status !== c.status) add.push({ at, by, kind: "status", text: `Holat: ${STATUS_TEXT[c.status]} → ${STATUS_TEXT[next.status]}` });
    if ((next.answer ?? "") !== (c.answer ?? "") && next.answer) add.push({ at, by, kind: "answer", text: next.answer });
    next.history = [...(c.history ?? []), ...add];
    putDoc(org(req), "complaints", c.id, next);
    if (c.status !== next.status) auditTenant(req, "UPDATE", "Complaint", c.id, { oldValue: c.status, newValue: next.status });
    res.json(publicComplaint(next, uid(req)));
  }),
);

/* ───────── Baholar ───────── */

function rosterFor(req: Request, group: string) {
  return students(req).filter((s) => s.group === group && s.status !== "expelled");
}

eduRouter.get(
  "/grades",
  requireFeature("grades", ["manage", "view"]),
  h((req, res) => {
    const subject = typeof req.query.subject === "string" ? req.query.subject : "";
    const group = typeof req.query.group === "string" ? req.query.group : "";
    const scope = facultyGroups(req);
    const all = listDocs<GradeRow>(org(req), "grades");

    if (!subject) {
      if (access(req, "grades") === "manage") throw invalid("Fan va guruhni tanlang.");
      const allowed = new Set(students(req).filter((s) => !scope || scope.includes(s.group)).map((s) => s.id));
      res.json(all.filter((g) => allowed.has(g.studentId)));
      return;
    }
    const sub = subjectsOf(req).find((s) => s.code === subject);
    if (!sub || !sub.groups.includes(group)) throw notFound("Fan yoki guruh");
    if (access(req, "grades") === "manage" && !allClasses(req) && sub.teacherId !== uid(req)) throw forbidden("Bu fan sizga biriktirilmagan.");
    if (scope && !scope.includes(group)) throw forbidden("Bu guruh sizning fakultetingizga tegishli emas.");
    res.json(rosterFor(req, group).map((st) => ({ ...(all.find((g) => g.studentId === st.id && g.subject === subject) ?? { studentId: st.id, subject, jn: 0, on: 0, yn: null }), name: st.name })));
  }),
);

eduRouter.get(
  "/grades/my",
  requireFeature("grades", ["own"]),
  h((req, res) => {
    const st = linkedStudent(req);
    if (!st) throw notFound("Talaba");
    const stored = listDocs<GradeRow>(org(req), "grades").filter((g) => g.studentId === st.id);
    const subjects = subjectsOf(req).filter((s) => s.groups.includes(st.group));
    res.json({
      semesters: semesterHistory(org(req), st.id),
      student: { id: st.id, name: st.name, group: st.group, gpa: st.gpa },
      results: subjects.map((s) => {
        const g = stored.find((x) => x.subject === s.code) ?? MY_RESULTS.find((x) => x.subject === s.code);
        return { subject: s.code, jn: g?.jn ?? 0, on: g?.on ?? 0, yn: g?.yn ?? null };
      }),
    });
  }),
);

eduRouter.put(
  "/grades",
  requireFeature("grades", ["manage"]),
  h((req, res) => {
    const b = body(req);
    const subject = str(b, "subject", { max: 20 });
    const group = str(b, "group", { max: 20 });
    const sub = subjectsOf(req).find((s) => s.code === subject);
    if (!sub || !sub.groups.includes(group)) throw notFound("Fan yoki guruh");
    if (!allClasses(req) && sub.teacherId !== uid(req)) throw forbidden("Bu fan sizga biriktirilmagan.");
    if (!Array.isArray(b.rows)) throw invalid('"rows" ro\'yxat bo\'lishi kerak.');
    const rosterList = rosterFor(req, group);
    const roster = new Set(rosterList.map((s) => s.id));
    const rows = (b.rows as Record<string, unknown>[]).map((r) => {
      const studentId = str(r, "studentId", { max: 30 });
      if (!roster.has(studentId)) throw invalid(`${studentId} bu guruhda emas.`);
      const yn = r.yn === null || r.yn === undefined || r.yn === "" ? null : num(r, "yn", { min: 0, max: 50, int: true });
      return { studentId, subject, jn: num(r, "jn", { min: 0, max: 30, int: true }), on: num(r, "on", { min: 0, max: 20, int: true }), yn } satisfies GradeRow;
    });
    tx(() => rows.forEach((r) => putDoc(org(req), "grades", `${subject}:${r.studentId}`, r)));
    auditTenant(req, "UPDATE", "Grades", `${group}/${subject}`, { newValue: `${rows.length} talaba bahosi saqlandi` });
    res.json(rows.map((r) => ({ ...r, name: rosterList.find((s) => s.id === r.studentId)?.name })));
  }),
);

/* ───────── Davomat ───────── */

const MARKS: AttendanceMark[] = ["present", "late", "excused", "absent"];
/** Faol darslar (arxivlanganlar jadvalda ko'rinmaydi, lekin davomat tarixi uchun saqlanadi) */
const lessons = (req: Request) => listDocs<Lesson>(org(req), "lessons").filter((l) => !l.archived);
const allLessonsWithArchive = (req: Request) => listDocs<Lesson>(org(req), "lessons");

eduRouter.get(
  "/attendance/sheet",
  requireFeature("attendance", ["manage"]),
  h((req, res) => {
    const lessonId = String(req.query.lessonId ?? "");
    const date = String(req.query.date ?? today());
    const lesson = lessons(req).find((l) => l.id === lessonId);
    if (!lesson || (!allClasses(req) && lesson.teacherId !== uid(req))) throw notFound("Dars");
    const sheet = getDoc<{ marks: Record<string, AttendanceMark>; savedAt: string }>(org(req), "attendance", `${lessonId}:${date}`);
    res.json({ lesson, date, roster: rosterFor(req, lesson.group), marks: sheet?.marks ?? null, savedAt: sheet?.savedAt ?? null });
  }),
);

eduRouter.put(
  "/attendance/sheet",
  requireFeature("attendance", ["manage"]),
  h((req, res) => {
    const b = body(req);
    const lessonId = str(b, "lessonId", { max: 40 });
    const date = str(b, "date", { pattern: /^\d{4}-\d{2}-\d{2}$/ });
    if (date > today()) throw invalid("Kelajak sanasi uchun davomat belgilab bo'lmaydi.");
    const lesson = lessons(req).find((l) => l.id === lessonId);
    if (!lesson || (!allClasses(req) && lesson.teacherId !== uid(req))) throw notFound("Dars");
    const roster = rosterFor(req, lesson.group);
    const raw = (b.marks && typeof b.marks === "object" ? b.marks : {}) as Record<string, unknown>;
    const marks: Record<string, AttendanceMark> = {};
    for (const st of roster) {
      const m = raw[st.id] ?? "present";
      if (!MARKS.includes(m as AttendanceMark)) throw invalid(`${st.id} uchun belgi noto'g'ri.`);
      marks[st.id] = m as AttendanceMark;
    }
    for (const k of Object.keys(raw)) if (!roster.some((s) => s.id === k)) throw invalid(`${k} bu darsda emas.`);
    const doc = { lessonId, date, marks, savedAt: nowStamp(), by: uid(req) };
    putDoc(org(req), "attendance", `${lessonId}:${date}`, doc);
    const absent = Object.values(marks).filter((m) => m === "absent").length;
    auditTenant(req, "UPDATE", "Attendance", `${lesson.group}/${date}`, { newValue: `${roster.length} talaba, ${absent} kelmagan` });
    res.json(doc);
  }),
);

/** Talaba / ota-ona: o'qituvchi yoki nazoratchi belgilagan haqiqiy davomat */
eduRouter.get(
  "/attendance/my",
  requireFeature("attendance", ["own"]),
  h((req, res) => {
    const st = linkedStudent(req);
    if (!st) throw notFound("Talaba");
    const all = allLessonsWithArchive(req);
    const records = listDocs<AttendanceDoc>(org(req), "attendance")
      .filter((a) => a.marks[st.id])
      .map((a) => {
        const l = all.find((x) => x.id === a.lessonId);
        return { date: a.date, subject: l?.subject ?? "—", type: l?.type ?? null, slot: l?.slot ?? null, mark: a.marks[st.id] };
      })
      .sort((x, y) => y.date.localeCompare(x.date) || (y.slot ?? 0) - (x.slot ?? 0));
    const count = (m: AttendanceMark) => records.filter((r) => r.mark === m).length;
    const attended = records.length - count("absent");
    res.json({
      student: { id: st.id, name: st.name, group: st.group },
      semesterRate: st.attendance,
      marked: { total: records.length, present: count("present"), late: count("late"), excused: count("excused"), absent: count("absent"), rate: records.length ? Math.round((attended / records.length) * 100) : null },
      records,
    });
  }),
);

/** Talaba / ota-ona: fanlar, mas'ul o'qituvchilar (aloqa bilan), kurator, haftalik darslar va joriy ballar */
eduRouter.get(
  "/my/subjects",
  requireFeature("mySubjects", ["own"]),
  h((req, res) => {
    const st = linkedStudent(req);
    if (!st) throw notFound("Talaba");
    const g = getDoc<Group>(org(req), "groups", st.group);
    const faculty = g ? getDoc<Faculty>(org(req), "faculties", g.faculty) : undefined;
    const ls = lessons(req).filter((l) => l.group === st.group);
    const grades = listDocs<GradeRow>(org(req), "grades").filter((r) => r.studentId === st.id);
    const teacherInfo = (id: string) => {
      const u = db.prepare("SELECT name, email FROM users WHERE id = ?").get(id) as { name: string; email: string } | undefined;
      const legacy = TEACHERS.find((t) => t.id === id);
      return { id, name: u?.name ?? legacy?.name ?? "Biriktirilmagan", email: u?.email ?? legacy?.email ?? null, degree: legacy?.degree ?? null, department: legacy?.department ?? null };
    };
    res.json({
      student: { id: st.id, name: st.name, group: st.group },
      group: g ? { id: g.id, direction: g.direction, course: g.course } : null,
      faculty: faculty ? { name: faculty.name, dean: faculty.dean } : null,
      curator: g ? { name: g.curator, email: TEACHERS.find((t) => t.name === g.curator)?.email ?? null } : null,
      subjects: subjectsOf(req)
        .filter((x) => x.groups.includes(st.group))
        .map((x) => {
          const r = grades.find((y) => y.subject === x.code);
          const mine = ls.filter((l) => l.subject === x.code).sort((a, b) => a.day - b.day || a.slot - b.slot);
          return {
            code: x.code,
            name: x.name,
            credits: x.credits,
            hours: x.hours,
            progress: x.progress,
            teacher: teacherInfo(x.teacherId),
            grades: r ? { jn: r.jn, on: r.on, yn: r.yn } : null,
            lessons: mine.map((l) => ({ day: l.day, slot: l.slot, room: l.room, type: l.type })),
          };
        }),
    });
  }),
);

/* ───────── Dars jadvali ───────── */

eduRouter.get(
  "/lessons",
  requireFeature("timetable"),
  h((req, res) => {
    let list = lessons(req);
    if (role(req) === "teacher") list = list.filter((l) => l.teacherId === uid(req));
    else if (role(req) === "student" || role(req) === "parent") {
      const st = linkedStudent(req);
      list = st ? list.filter((l) => l.group === st.group) : [];
    } else {
      const scope = facultyGroups(req);
      if (scope) list = list.filter((l) => scope.includes(l.group));
    }
    res.json(list);
  }),
);

const LESSON_TYPES = ["Ma'ruza", "Amaliy", "Laboratoriya", "Seminar"] as const;

/** Bir vaqtda (kun + juftlik) xona, o'qituvchi yoki guruh ikki joyda bo'lmasligi kerak */
function lessonConflicts(req: Request, l: Pick<Lesson, "day" | "slot" | "room" | "teacherId" | "group">, exceptId?: string) {
  const same = lessons(req).filter((x) => x.id !== exceptId && x.day === l.day && x.slot === l.slot);
  const out: string[] = [];
  const room = same.find((x) => x.room === l.room);
  if (room) out.push(`${l.room} xonasi band (${room.group})`);
  if (same.some((x) => x.teacherId === l.teacherId)) out.push(`${teacherNameOf(l.teacherId)} bu vaqtda boshqa darsda`);
  if (same.some((x) => x.group === l.group)) out.push(`${l.group} guruhining bu vaqtda boshqa darsi bor`);
  return out;
}

function checkRoom(room: string) {
  const r = ROOMS.find((x) => x.id === room);
  if (!r) throw invalid("Xona topilmadi.");
  if (r.status === "repair") throw invalid(`${room} ta'mirda.`);
}

/** Jadval o'zgarishi haqida — dars o'qituvchisi va guruh talabalari (akkauntlari)ga */
function notifyLesson(req: Request, l: Lesson, text: string) {
  const ins = db.prepare("INSERT INTO notifications (id, org_id, for_user_id, data) VALUES (?, ?, ?, ?)");
  const targets = new Set<string>([l.teacherId]);
  for (const [userId, studentId] of Object.entries(studentLinks(req))) {
    const st = getDoc<Student>(org(req), "students", studentId);
    if (st?.group === l.group) targets.add(userId);
  }
  for (const u of targets) {
    if (!db.prepare("SELECT 1 FROM memberships WHERE user_id = ? AND org_id = ? AND status = 'active'").get(u, org(req))) continue;
    if (!wantsNotification(org(req), u, "schedule")) continue;
    const id = newId("n");
    ins.run(id, org(req), u, JSON.stringify({ id, title: "Jadval o'zgarishi", body: text, time: nowStamp(), read: false, channel: "inapp", forUserId: u, link: "/timetable" }));
  }
}

const DAY_NAMES = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const when = (l: Pick<Lesson, "day" | "slot">) => `${DAY_NAMES[l.day]}, ${l.slot + 1}-juftlik`;

/** Tanlangan vaqtda nima band — tafsilotsiz (dekan boshqa fakultet darslarini ko'rmaydi) */
eduRouter.get(
  "/lessons/availability",
  requireFeature("timetable", ["manage"]),
  h((req, res) => {
    const day = num(req.query as Record<string, unknown>, "day", { min: 0, max: 5, int: true });
    const slot = num(req.query as Record<string, unknown>, "slot", { min: 0, max: 4, int: true });
    const except = typeof req.query.except === "string" ? req.query.except : undefined;
    const same = lessons(req).filter((x) => x.id !== except && x.day === day && x.slot === slot);
    res.json({
      rooms: ROOMS.map((r) => ({ id: r.id, type: r.type, capacity: r.capacity, status: r.status === "repair" ? "repair" : same.some((x) => x.room === r.id) ? "busy" : "free" })),
      busyTeachers: Array.from(new Set(same.map((x) => x.teacherId))),
      busyGroups: Array.from(new Set(same.map((x) => x.group))),
    });
  }),
);

eduRouter.post(
  "/lessons",
  requireFeature("timetable", ["manage"]),
  h((req, res) => {
    const b = body(req);
    const subject = subjectsOf(req).find((x) => x.code === str(b, "subject", { max: 20 }));
    if (!subject) throw notFound("Fan");
    const group = str(b, "group", { max: 20 });
    if (!subject.groups.includes(group)) throw invalid(`${subject.name} fani ${group} guruhiga biriktirilmagan.`);
    const room = str(b, "room", { max: 20 });
    checkRoom(room);
    const l: Lesson = {
      id: newId("l"),
      day: num(b, "day", { min: 0, max: 5, int: true }),
      slot: num(b, "slot", { min: 0, max: 4, int: true }),
      subject: subject.code,
      group,
      // O'qituvchi — fanga biriktirilgan o'qituvchi (fanlar bo'limida boshqariladi)
      teacherId: subject.teacherId,
      room,
      type: oneOf(b, "type", LESSON_TYPES),
    };
    const conflicts = lessonConflicts(req, l);
    if (conflicts.length) throw invalid(`To'qnashuv: ${conflicts.join("; ")}.`);
    putDoc(org(req), "lessons", l.id, l);
    auditTenant(req, "CREATE", "Lesson", `${group}/${l.day}/${l.slot}`, { newValue: `${subject.name}, ${when(l)}, ${room}` });
    notifyLesson(req, l, `${group}: yangi dars — ${subject.name}, ${when(l)}, ${room}.`);
    res.status(201).json(l);
  }),
);

eduRouter.patch(
  "/lessons/:id",
  requireFeature("timetable", ["manage"]),
  h((req, res) => {
    const l = lessons(req).find((x) => x.id === String(req.params.id));
    if (!l) throw notFound("Dars");
    const b = body(req);
    const next: Lesson = { ...l };
    if (has(b, "day")) next.day = num(b, "day", { min: 0, max: 5, int: true });
    if (has(b, "slot")) next.slot = num(b, "slot", { min: 0, max: 4, int: true });
    if (has(b, "type")) next.type = oneOf(b, "type", LESSON_TYPES);
    if (has(b, "room")) {
      next.room = str(b, "room", { max: 20 });
      if (next.room !== l.room) checkRoom(next.room);
    }
    const conflicts = lessonConflicts(req, next, l.id);
    if (conflicts.length) throw invalid(`To'qnashuv: ${conflicts.join("; ")}.`);
    putDoc(org(req), "lessons", l.id, next);
    const changes = [
      next.day !== l.day || next.slot !== l.slot ? `vaqt: ${when(l)} → ${when(next)}` : null,
      next.room !== l.room ? `xona: ${l.room} → ${next.room}` : null,
      next.type !== l.type ? `tur: ${l.type} → ${next.type}` : null,
    ].filter(Boolean) as string[];
    if (changes.length) {
      auditTenant(req, "UPDATE", "Lesson", `${l.group}/${l.day}/${l.slot}`, { oldValue: `${when(l)}, ${l.room}`, newValue: changes.join("; ") });
      notifyLesson(req, next, `${l.group}: ${subjectsOf(req).find((x) => x.code === l.subject)?.name ?? l.subject} — ${changes.join(", ")}.`);
    }
    res.json(next);
  }),
);

/** Darsni olib tashlash — arxivlanadi (belgilangan davomat tarixi saqlanadi) */
eduRouter.delete(
  "/lessons/:id",
  requireFeature("timetable", ["manage"]),
  h((req, res) => {
    const l = lessons(req).find((x) => x.id === String(req.params.id));
    if (!l) throw notFound("Dars");
    putDoc(org(req), "lessons", l.id, { ...l, archived: true });
    const name = subjectsOf(req).find((x) => x.code === l.subject)?.name ?? l.subject;
    auditTenant(req, "DELETE", "Lesson", `${l.group}/${l.day}/${l.slot}`, { oldValue: `${name}, ${when(l)}, ${l.room}` });
    notifyLesson(req, l, `${l.group}: ${name} darsi (${when(l)}) jadvaldan olib tashlandi.`);
    res.json({ success: true });
  }),
);

/* ───────── LMS ───────── */

function lmsSubjects(req: Request) {
  if (role(req) === "teacher") return teacherSubjects(req);
  if (role(req) === "student") {
    const st = linkedStudent(req);
    return st ? subjectsOf(req).filter((s) => s.groups.includes(st.group)) : [];
  }
  return subjectsOf(req);
}

type Submission = { assignmentId: string; userId: string; file: string; at: string };

eduRouter.get(
  "/lms",
  requireFeature("lms"),
  h((req, res) => {
    const codes = lmsSubjects(req).map((s) => s.code);
    const subs = listDocs<Submission>(org(req), "submissions");
    res.json({
      subjects: codes,
      materials: listDocs<Material>(org(req), "materials").filter((m) => codes.includes(m.subject)),
      assignments: listDocs<Assignment>(org(req), "assignments").filter((a) => codes.includes(a.subject)),
      submitted: Object.fromEntries(subs.filter((s) => s.userId === uid(req)).map((s) => [s.assignmentId, s.file])),
    });
  }),
);

function ownSubject(req: Request, code: string) {
  const s = teacherSubjects(req).find((x) => x.code === code);
  if (!s) throw forbidden("Bu fan sizga biriktirilmagan.");
  return s;
}

eduRouter.post(
  "/lms/materials",
  requireFeature("lms", ["manage"]),
  h((req, res) => {
    const b = body(req);
    const sub = ownSubject(req, str(b, "subject", { max: 20 }));
    const kind = oneOf(b, "kind", ["PDF", "Video", "Slayd", "Havola"] as const);
    const m: Material = { id: newId("m"), subject: sub.code, title: str(b, "title", { min: 3, max: 200 }), kind, size: kind === "Video" ? "— min" : kind === "Havola" ? "havola" : "1.0 MB", week: num(b, "week", { min: 1, max: 18, int: true }) };
    putDoc(org(req), "materials", m.id, m);
    auditTenant(req, "CREATE", "Material", m.id, { newValue: m.title });
    res.status(201).json(m);
  }),
);

eduRouter.post(
  "/lms/assignments",
  requireFeature("lms", ["manage"]),
  h((req, res) => {
    const b = body(req);
    const sub = ownSubject(req, str(b, "subject", { max: 20 }));
    const due = str(b, "due", { pattern: /^\d{4}-\d{2}-\d{2}$/ });
    if (due < today()) throw invalid("Muddat o'tgan sana bo'lmasin.");
    const total = students(req).filter((s) => sub.groups.includes(s.group) && s.status === "active").length;
    const a: Assignment = { id: newId("a"), subject: sub.code, title: str(b, "title", { min: 3, max: 200 }), due, maxScore: num(b, "maxScore", { min: 1, max: 100, int: true }), submitted: 0, total };
    putDoc(org(req), "assignments", a.id, a);
    auditTenant(req, "CREATE", "Assignment", a.id, { newValue: a.title });
    res.status(201).json(a);
  }),
);

eduRouter.post(
  "/lms/assignments/:id/submit",
  requireFeature("lms", ["own"]),
  h((req, res) => {
    const a = getDoc<Assignment>(org(req), "assignments", String(req.params.id));
    if (!a || !lmsSubjects(req).some((s) => s.code === a.subject)) throw notFound("Topshiriq");
    const key = `${a.id}:${uid(req)}`;
    if (getDoc(org(req), "submissions", key)) throw invalid("Bu topshiriq allaqachon yuborilgan.");
    const file = str(body(req), "file", { min: 1, max: 200 });
    tx(() => {
      putDoc(org(req), "submissions", key, { assignmentId: a.id, userId: uid(req), file, at: nowStamp() } satisfies Submission);
      putDoc(org(req), "assignments", a.id, { ...a, submitted: a.submitted + 1 });
    });
    auditTenant(req, "SUBMIT", "Assignment", a.id, { newValue: file });
    res.status(201).json({ assignmentId: a.id, file });
  }),
);

eduRouter.post(
  "/lms/assignments/:id/remind",
  requireFeature("lms", ["manage"]),
  h((req, res) => {
    const a = getDoc<Assignment>(org(req), "assignments", String(req.params.id));
    if (!a) throw notFound("Topshiriq");
    const sub = ownSubject(req, a.subject);
    const done = new Set(listDocs<Submission>(org(req), "submissions").filter((s) => s.assignmentId === a.id).map((s) => s.userId));
    // Talaba akkauntlari (demo: STUDENT_LINKS) — topshirmaganlarga bildirishnoma
    const targets = Object.entries(studentLinks(req))
      .filter(([userId, studentId]) => {
        const st = getDoc<Student>(org(req), "students", studentId);
        return st && sub.groups.includes(st.group) && !done.has(userId) && db.prepare("SELECT 1 FROM memberships WHERE user_id = ? AND org_id = ? AND role = 'student'").get(userId, org(req));
      })
      .map(([userId]) => userId);
    const ins = db.prepare("INSERT INTO notifications (id, org_id, for_user_id, data) VALUES (?, ?, ?, ?)");
    for (const u of targets.filter((x) => wantsNotification(org(req), x, "assignments"))) {
      const id = newId("n");
      ins.run(id, org(req), u, JSON.stringify({ id, title: "Topshiriq eslatmasi", body: `${sub.name}: "${a.title}" — muddat ${a.due}.`, time: nowStamp(), read: false, channel: "inapp", forUserId: u, link: "/lms" }));
    }
    auditTenant(req, "REMIND", "Assignment", a.id, { newValue: `${targets.length} talabaga eslatma` });
    res.json({ sent: targets.length });
  }),
);

/* ───────── AI tahlil: xavf ostidagi talabalar (rol doirasida) ───────── */

eduRouter.get(
  "/insights/risk",
  requireFeature("insights", ["manage", "view", "own"]),
  h((req, res) => {
    if (role(req) === "student" || role(req) === "parent") throw forbidden("Faqat o'z natijalaringiz uchun tavsiyalar mavjud.");
    let list = students(req).filter((s) => s.status !== "expelled");
    if (role(req) === "teacher") {
      const mine = new Set(teacherSubjects(req).flatMap((s) => s.groups));
      list = list.filter((s) => mine.has(s.group));
    } else {
      const scope = facultyGroups(req);
      if (scope) list = list.filter((s) => scope.includes(s.group));
    }
    // Faqat tahlil uchun kerakli maydonlar (telefon, ota-ona ma'lumoti chiqmaydi)
    res.json(list.map((s) => ({ id: s.id, name: s.name, group: s.group, gpa: s.gpa, attendance: s.attendance, debt: s.debt })));
  }),
);

/* ───────── Batafsil ko'rinishlar ───────── */

type AttendanceDoc = { lessonId: string; date: string; marks: Record<string, AttendanceMark>; savedAt: string };

/** Talaba kartasi: profil, baholar, belgilangan davomat, bog'langan akkauntlar, tarix */
eduRouter.get(
  "/students/:id",
  requireFeature("people"),
  h((req, res) => {
    const st = getDoc<Student>(org(req), "students", String(req.params.id));
    const scope = facultyGroups(req);
    if (!st || (scope && !scope.includes(st.group))) throw notFound("Talaba");
    const group = getDoc<Group>(org(req), "groups", st.group);
    const faculty = group ? getDoc<Faculty>(org(req), "faculties", group.faculty) : undefined;
    const grades = listDocs<GradeRow>(org(req), "grades").filter((g) => g.studentId === st.id);
    const subjects = subjectsOf(req).filter((x) => x.groups.includes(st.group)).map((x) => {
      const g = grades.find((r) => r.subject === x.code);
      return { code: x.code, name: x.name, credits: x.credits, teacher: teacherNameOf(x.teacherId), jn: g?.jn ?? null, on: g?.on ?? null, yn: g?.yn ?? null };
    });
    const allLessons = allLessonsWithArchive(req);
    const attendance = listDocs<AttendanceDoc>(org(req), "attendance")
      .filter((a) => a.marks[st.id])
      .map((a) => {
        const l = allLessons.find((x) => x.id === a.lessonId);
        return { date: a.date, subject: l?.subject ?? "—", mark: a.marks[st.id] };
      })
      .sort((x, y) => y.date.localeCompare(x.date));
    const links = studentLinks(req);
    const linkedIds = Object.entries(links).filter(([, sid]) => sid === st.id).map(([u]) => u);
    const accounts = linkedIds.length
      ? (db
          .prepare(`SELECT u.id, u.name, u.email, m.role, m.status, u.last_login_at FROM users u JOIN memberships m ON m.user_id = u.id AND m.org_id = ? WHERE u.id IN (${linkedIds.map(() => "?").join(",")})`)
          .all(org(req), ...linkedIds) as { id: string; name: string; email: string; role: string; status: string; last_login_at: string | null }[])
      : [];
    const history = db
      .prepare("SELECT actor_name, action, old_value, new_value, at FROM audit_log WHERE scope = 'tenant' AND org_id = ? AND object = 'Student' AND object_id = ? ORDER BY id DESC LIMIT 20")
      .all(org(req), st.id) as { actor_name: string; action: string; old_value: string | null; new_value: string | null; at: string }[];
    res.json({
      student: st,
      group: group ? { id: group.id, direction: group.direction, course: group.course, curator: group.curator } : null,
      faculty: faculty ? { id: faculty.id, name: faculty.name, dean: faculty.dean } : null,
      risk: riskOf(st),
      subjects,
      attendance,
      accounts: accounts.map((a) => ({ id: a.id, name: a.name, email: a.email, role: a.role, status: a.status, lastLoginAt: a.last_login_at })),
      history: history.map((x) => ({ at: x.at, by: x.actor_name, action: x.action, from: x.old_value, to: x.new_value })),
      semesters: semesterHistory(org(req), st.id),
    });
  }),
);

/** Guruh sahifasi: talabalar, fanlar, jadval, ko'rsatkichlar */
eduRouter.get(
  "/groups/:id",
  requireFeature("academic"),
  h((req, res) => {
    const g = getDoc<Group>(org(req), "groups", String(req.params.id));
    if (!g) throw notFound("Guruh");
    if (role(req) === "teacher" && !teacherSubjects(req).some((s) => s.groups.includes(g.id))) throw notFound("Guruh");
    const scope = facultyGroups(req);
    if (scope && !scope.includes(g.id)) throw notFound("Guruh");
    const faculty = getDoc<Faculty>(org(req), "faculties", g.faculty);
    // O'qituvchi talabalar bazasiga kira olmaydi — faqat ism va asosiy ko'rsatkichlar
    const list = students(req)
      .filter((s) => s.group === g.id)
      .map((s) => ({ id: s.id, name: s.name, status: s.status, gpa: s.gpa, attendance: s.attendance, risk: riskOf(s), funding: s.funding }));
    const active = list.filter((s) => s.status === "active");
    const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : 0);
    res.json({
      group: withLiveStats(g, students(req)),
      faculty: faculty ? { id: faculty.id, name: faculty.name, dean: faculty.dean } : null,
      stats: { students: active.length, gpa: mean(active.filter((s) => s.gpa > 0).map((s) => s.gpa)), attendance: Math.round(mean(active.map((s) => s.attendance))), atRisk: active.filter((s) => s.risk === "high").length },
      students: list,
      subjects: subjectsOf(req).filter((x) => x.groups.includes(g.id)).map((x) => ({ code: x.code, name: x.name, credits: x.credits, hours: x.hours, progress: x.progress, teacher: teacherNameOf(x.teacherId) })),
      lessons: lessons(req).filter((l) => l.group === g.id),
    });
  }),
);

/** Fakultet sahifasi: kafedralar, guruhlar va ko'rsatkichlar */
eduRouter.get(
  "/faculties/:id",
  requireFeature("structure"),
  h((req, res) => {
    const f = getDoc<Faculty>(org(req), "faculties", String(req.params.id));
    if (!f) throw notFound("Fakultet");
    const all = students(req).filter((s) => s.status === "active");
    const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : 0);
    const gs = groups(req)
      .filter((g) => g.faculty === f.id)
      .map((g) => {
        const st = all.filter((s) => s.group === g.id);
        return { id: g.id, direction: g.direction, course: g.course, curator: g.curator, students: st.length, gpa: mean(st.filter((s) => s.gpa > 0).map((s) => s.gpa)), attendance: Math.round(mean(st.map((s) => s.attendance))), atRisk: st.filter((s) => riskOf(s) === "high").length };
      });
    const st = all.filter((s) => gs.some((g) => g.id === s.group));
    res.json({
      faculty: facultyLive(f, groups(req), students(req)),
      stats: { groups: gs.length, students: st.length, gpa: mean(st.filter((s) => s.gpa > 0).map((s) => s.gpa)), attendance: Math.round(mean(st.map((s) => s.attendance))), atRisk: st.filter((s) => riskOf(s) === "high").length },
      groups: gs,
    });
  }),
);

/* ───────── Talabalar analitikasi (kontingent sifati — qabulsiz) ───────── */

eduRouter.get(
  "/analytics",
  requireFeature("people", ["manage", "view"]),
  h((req, res) => {
    const scope = facultyGroups(req);
    const all = students(req).filter((s) => !scope || scope.includes(s.group));
    const active = all.filter((s) => s.status === "active");
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const graded = active.filter((s) => s.gpa > 0);
    const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

    const bucket = <T,>(xs: T[], defs: { label: string; test: (x: T) => boolean }[]) => defs.map((d) => ({ label: d.label, n: xs.filter(d.test).length }));

    // Guruhlar
    const gs = groups(req).filter((g) => !scope || scope.includes(g.id));
    const groupRows = gs
      .map((g) => {
        const st = active.filter((s) => s.group === g.id);
        return {
          id: g.id,
          direction: g.direction,
          course: g.course,
          students: st.length,
          gpa: r2(mean(st.filter((s) => s.gpa > 0).map((s) => s.gpa))),
          attendance: Math.round(mean(st.map((s) => s.attendance))),
          debtors: st.filter((s) => s.debt > 0).length,
          atRisk: st.filter((s) => riskOf(s) === "high").length,
        };
      })
      .sort((a, b) => b.gpa - a.gpa);

    // Fanlar: joriy (JN+ON) natijalar bazadagi baholardan
    const allowed = new Set(active.map((s) => s.id));
    const grades = listDocs<GradeRow>(org(req), "grades").filter((g) => allowed.has(g.studentId));
    const subjects = subjectsOf(req).map((x) => {
      const rows = grades.filter((g) => g.subject === x.code);
      const projected = rows.map((g) => (g.yn === null ? (g.jn + g.on) * 2 : g.jn + g.on + g.yn));
      return {
        code: x.code,
        name: x.name,
        teacher: teacherNameOf(x.teacherId),
        graded: rows.length,
        avg: Math.round(mean(projected)),
        failing: projected.filter((p) => p < 55).length,
        excellent: projected.filter((p) => p >= 86).length,
      };
    })
      .filter((x) => x.graded > 0)
      .sort((a, b) => a.avg - b.avg);

    // Xavf ostidagilar — sabablari bilan
    const risky = active
      .map((s) => ({
        id: s.id,
        name: s.name,
        group: s.group,
        gpa: s.gpa,
        attendance: s.attendance,
        debt: s.debt,
        risk: riskOf(s),
        reasons: [s.gpa > 0 && s.gpa < 3 ? `GPA ${s.gpa.toFixed(2)}` : null, s.attendance < 85 ? `davomat ${s.attendance}%` : null, s.debt > 0 ? `${s.debt} ta qarz` : null].filter(Boolean) as string[],
      }))
      .filter((s) => s.risk !== "low")
      .sort((a, b) => (a.risk === b.risk ? a.gpa - b.gpa : a.risk === "high" ? -1 : 1));

    // O'qituvchilar belgilagan davomat (tizimdagi haqiqiy yozuvlar)
    const sheets = listDocs<AttendanceDoc>(org(req), "attendance");
    const marks = sheets.flatMap((sh) => Object.entries(sh.marks).filter(([sid]) => allowed.has(sid)).map(([, m]) => ({ date: sh.date, m })));
    const byDay = new Map<string, { total: number; present: number }>();
    marks.forEach(({ date, m }) => {
      const d = byDay.get(date) ?? { total: 0, present: 0 };
      d.total++;
      if (m !== "absent") d.present++;
      byDay.set(date, d);
    });

    // Semestr maqsadlari — haqiqiy ulushlar
    const assignments = listDocs<Assignment>(org(req), "assignments");
    const subTotal = assignments.reduce((a, x) => a + x.total, 0);

    res.json({
      scope: scope ? "faculty" : "organization",
      kpi: {
        active: active.length,
        total: all.length,
        gpa: r2(mean(graded.map((s) => s.gpa))),
        attendance: Math.round(mean(active.map((s) => s.attendance)) * 10) / 10,
        debtors: active.filter((s) => s.debt > 0).length,
        atRisk: active.filter((s) => riskOf(s) === "high").length,
      },
      gpaBuckets: bucket(graded, [
        { label: "2.5 dan past", test: (s) => s.gpa < 2.5 },
        { label: "2.5 – 3.0", test: (s) => s.gpa >= 2.5 && s.gpa < 3 },
        { label: "3.0 – 3.5", test: (s) => s.gpa >= 3 && s.gpa < 3.5 },
        { label: "3.5 – 4.0", test: (s) => s.gpa >= 3.5 },
      ]),
      attendanceBuckets: bucket(active, [
        { label: "70% dan past", test: (s) => s.attendance < 70 },
        { label: "70 – 80%", test: (s) => s.attendance >= 70 && s.attendance < 80 },
        { label: "80 – 90%", test: (s) => s.attendance >= 80 && s.attendance < 90 },
        { label: "90% va yuqori", test: (s) => s.attendance >= 90 },
      ]),
      status: {
        active: active.length,
        leave: all.filter((s) => s.status === "leave").length,
        expelled: all.filter((s) => s.status === "expelled").length,
        graduated: all.filter((s) => s.status === "graduated").length,
      },
      funding: { grant: active.filter((s) => s.funding === "Grant").length, contract: active.filter((s) => s.funding === "Kontrakt").length },
      groups: groupRows,
      subjects,
      atRisk: risky.slice(0, 10),
      marked: {
        total: marks.length,
        present: marks.filter((x) => x.m === "present").length,
        late: marks.filter((x) => x.m === "late").length,
        excused: marks.filter((x) => x.m === "excused").length,
        absent: marks.filter((x) => x.m === "absent").length,
        days: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([date, d]) => ({ date, rate: pct(d.present, d.total), total: d.total })),
      },
      goals: [
        { key: "attendance", title: "Davomat", subtitle: "85% va yuqori", value: pct(active.filter((s) => s.attendance >= 85).length, active.length) },
        { key: "gpa", title: "O'zlashtirish", subtitle: "GPA ≥ 3.0", value: pct(graded.filter((s) => s.gpa >= 3).length, graded.length) },
        { key: "debt", title: "Qarzsiz talabalar", subtitle: "Akademik qarz yo'q", value: pct(active.filter((s) => s.debt === 0).length, active.length) },
        { key: "assignments", title: "Topshiriqlar", subtitle: "Topshirilgan ishlar ulushi", value: pct(assignments.reduce((a, x) => a + x.submitted, 0), subTotal) },
      ],
    });
  }),
);

/* ───────── Fanlar va o'qituvchilar ───────── */

type TeacherAccount = { id: string; name: string; email: string; status: string };

/** Tashkilotdagi o'qituvchi akkauntlari */
function teacherAccounts(req: Request): TeacherAccount[] {
  return db
    .prepare("SELECT u.id, u.name, u.email, m.status FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? AND m.role = 'teacher' ORDER BY u.name")
    .all(org(req)) as TeacherAccount[];
}

function subjectView(req: Request, x: Subject) {
  const acc = db.prepare("SELECT m.status FROM memberships m WHERE m.user_id = ? AND m.org_id = ? AND m.role = 'teacher'").get(x.teacherId, org(req)) as { status: string } | undefined;
  return { ...x, teacherName: teacherNameOf(x.teacherId), teacherAccount: acc ? (acc.status === "active" ? "active" : "suspended") : "none" };
}

/** Fanlar katalogi — barcha ta'lim rollari uchun (nomlar, kreditlar); o'zgartirish faqat boshqaruvda */
eduRouter.get(
  "/subjects",
  requireFeature("timetable"),
  h((req, res) => {
    res.json(subjectsOf(req).map((x) => subjectView(req, x)));
  }),
);

/** O'qituvchilar: tizim akkauntlari + akkaunti yo'q eski ro'yxat; yuklama va fanlar soni bilan */
eduRouter.get(
  "/teachers",
  requireFeature("people"),
  h((req, res) => {
    const subs = subjectsOf(req);
    const ls = lessons(req);
    const load = (id: string) => ls.filter((l) => l.teacherId === id).length * 2;
    const accounts = teacherAccounts(req).map((t) => ({ id: t.id, name: t.name, email: t.email, account: t.status === "active" ? "active" : "suspended", subjects: subs.filter((x) => x.teacherId === t.id).map((x) => x.code), load: load(t.id), department: null as string | null }));
    const legacy = TEACHERS.filter((t) => !accounts.some((a) => a.id === t.id)).map((t) => ({ id: t.id, name: t.name, email: t.email, account: "none", subjects: subs.filter((x) => x.teacherId === t.id).map((x) => x.code), load: load(t.id), department: t.department }));
    res.json([...accounts, ...legacy]);
  }),
);

/** Dekan faqat o'z fakulteti guruhlari bilan ishlaydi */
function checkGroups(req: Request, list: string[]) {
  const existing = new Set(groups(req).map((g) => g.id));
  const bad = list.filter((g) => !existing.has(g));
  if (bad.length) throw invalid(`Guruh topilmadi: ${bad.join(", ")}`);
  const scope = facultyGroups(req);
  if (scope && list.some((g) => !scope.includes(g))) throw forbidden("Faqat o'z fakultetingiz guruhlarini biriktira olasiz.");
}

function checkTeacher(req: Request, teacherId: string) {
  const t = db.prepare("SELECT m.status FROM memberships m WHERE m.user_id = ? AND m.org_id = ? AND m.role = 'teacher'").get(teacherId, org(req)) as { status: string } | undefined;
  if (!t) throw invalid("O'qituvchi akkaunti topilmadi. Avval 'Foydalanuvchilar' bo'limida o'qituvchi qo'shing.");
  if (t.status !== "active") throw invalid("Bu o'qituvchi akkaunti to'xtatilgan.");
}

function notifyTeacher(req: Request, teacherId: string, text: string) {
  const id = newId("n");
  db.prepare("INSERT INTO notifications (id, org_id, for_user_id, data) VALUES (?, ?, ?, ?)").run(
    id,
    org(req),
    teacherId,
    JSON.stringify({ id, title: "Yangi fan biriktirildi", body: text, time: nowStamp(), read: false, channel: "inapp", forUserId: teacherId, link: "/academic" }),
  );
}

eduRouter.post(
  "/subjects",
  requireFeature("academic", ["manage"]),
  h((req, res) => {
    const b = body(req);
    const code = str(b, "code", { max: 12 }).toUpperCase();
    if (!/^[A-Z]{2,4}-\d{3}$/.test(code)) throw invalid("Fan kodi formati: CS-401");
    if (getDoc(org(req), "subjects", code)) throw invalid(`${code} kodli fan allaqachon bor.`);
    const groupList = strArray(b, "groups");
    if (groupList.length === 0) throw invalid("Kamida bitta guruh tanlang.");
    checkGroups(req, groupList);
    const teacherId = str(b, "teacherId", { max: 80 });
    checkTeacher(req, teacherId);
    const x: Subject = {
      code,
      name: str(b, "name", { min: 3, max: 120 }),
      credits: num(b, "credits", { min: 1, max: 12, int: true }),
      hours: num(b, "hours", { min: 15, max: 300, int: true }),
      teacherId,
      groups: groupList,
      progress: 0,
    };
    putDoc(org(req), "subjects", code, x);
    auditTenant(req, "CREATE", "Subject", code, { newValue: `${x.name} → ${teacherNameOf(teacherId)} (${groupList.join(", ")})` });
    notifyTeacher(req, teacherId, `${x.name} (${code}) — ${groupList.join(", ")} guruhlari. Baholash jurnali va LMS'da paydo bo'ldi.`);
    res.status(201).json(subjectView(req, x));
  }),
);

eduRouter.patch(
  "/subjects/:code",
  requireFeature("academic", ["manage"]),
  h((req, res) => {
    const x = getDoc<Subject>(org(req), "subjects", String(req.params.code));
    if (!x) throw notFound("Fan");
    checkGroups(req, x.groups); // dekan boshqa fakultet fanini o'zgartira olmaydi
    const b = body(req);
    const next: Subject = { ...x };
    if (has(b, "name")) next.name = str(b, "name", { min: 3, max: 120 });
    if (has(b, "credits")) next.credits = num(b, "credits", { min: 1, max: 12, int: true });
    if (has(b, "hours")) next.hours = num(b, "hours", { min: 15, max: 300, int: true });
    if (has(b, "groups")) {
      next.groups = strArray(b, "groups");
      if (next.groups.length === 0) throw invalid("Kamida bitta guruh qolishi kerak.");
      checkGroups(req, next.groups);
    }
    if (has(b, "teacherId")) {
      next.teacherId = str(b, "teacherId", { max: 80 });
      if (next.teacherId !== x.teacherId) checkTeacher(req, next.teacherId);
    }
    let movedLessons = 0;
    tx(() => {
      putDoc(org(req), "subjects", x.code, next);
      // O'qituvchi almashsa — fanning darslari ham yangi o'qituvchiga o'tadi (davomat huquqi bilan birga)
      if (next.teacherId !== x.teacherId) {
        for (const l of lessons(req).filter((l) => l.subject === x.code)) {
          putDoc(org(req), "lessons", l.id, { ...l, teacherId: next.teacherId });
          movedLessons++;
        }
      }
    });
    if (next.teacherId !== x.teacherId) {
      auditTenant(req, "ASSIGN", "Subject", x.code, { oldValue: teacherNameOf(x.teacherId), newValue: `${teacherNameOf(next.teacherId)} · ${movedLessons} dars ko'chdi` });
      notifyTeacher(req, next.teacherId, `${next.name} (${x.code}) — ${next.groups.join(", ")} guruhlari sizga biriktirildi.`);
    } else auditTenant(req, "UPDATE", "Subject", x.code, { newValue: `${next.name} · ${next.groups.join(", ")}` });
    res.json({ ...subjectView(req, next), movedLessons });
  }),
);

/* ───────── Talabalarni ommaviy import qilish (Excel / CSV) ───────── */

const IMPORT_MAX = 5000;

type ImportInput = { name?: unknown; group?: unknown; funding?: unknown; phone?: unknown; parent?: unknown; row?: unknown };
type ImportRow = {
  row: number;
  status: "ok" | "error" | "duplicate";
  errors: string[];
  warnings: string[];
  data: { name: string; group: string; funding: "Grant" | "Kontrakt"; phone: string; parent: string };
};

const text = (v: unknown) => (v === undefined || v === null ? "" : String(v)).replace(/\s+/g, " ").trim();

/** Telefon: 9 xonali yoki 998 bilan — "+998 90 123 45 67" ko'rinishiga */
function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  const n = d.length === 9 ? `998${d}` : d;
  if (n.length !== 12 || !n.startsWith("998")) return null;
  return `+${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5, 8)} ${n.slice(8, 10)} ${n.slice(10)}`;
}

function normalizeFunding(raw: string): "Grant" | "Kontrakt" | null {
  const v = raw.toLowerCase();
  if (!v) return null;
  if (v.includes("grant") || v.includes("davlat")) return "Grant";
  if (v.includes("kontr") || v.includes("contr") || v.includes("to'lov") || v.includes("tolov") || v.includes("pullik")) return "Kontrakt";
  return null;
}

function validateImport(req: Request, input: ImportInput[]): ImportRow[] {
  const existingGroups = new Set(groups(req).map((g) => g.id));
  const scope = facultyGroups(req);
  const existing = new Set(students(req).map((s) => `${s.name.toLowerCase()}|${s.group}`));
  const seen = new Set<string>();
  return input.map((r, i) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const name = text(r.name);
    const group = text(r.group).toUpperCase();
    const fundingRaw = text(r.funding);
    const phoneRaw = text(r.phone);
    const parent = text(r.parent).slice(0, 120);

    if (!name) errors.push("F.I.Sh. bo'sh");
    else if (name.split(" ").length < 2) errors.push("Familiya va ism kerak");
    else if (name.length > 120) errors.push("F.I.Sh. juda uzun");
    if (!group) errors.push("Guruh bo'sh");
    else if (!existingGroups.has(group)) errors.push(`"${group}" guruhi topilmadi`);
    else if (scope && !scope.includes(group)) errors.push(`"${group}" sizning fakultetingizda emas`);

    let funding = normalizeFunding(fundingRaw);
    if (!funding) {
      if (fundingRaw) errors.push(`Ta'lim shakli noma'lum: "${fundingRaw}" (Grant yoki Kontrakt)`);
      else {
        funding = "Kontrakt";
        warnings.push("Ta'lim shakli ko'rsatilmagan — Kontrakt deb olindi");
      }
    }
    let phone = "—";
    if (phoneRaw) {
      const p = normalizePhone(phoneRaw);
      if (p) phone = p;
      else errors.push(`Telefon noto'g'ri: "${phoneRaw}"`);
    } else warnings.push("Telefon ko'rsatilmagan");

    const key = `${name.toLowerCase()}|${group}`;
    let status: ImportRow["status"] = errors.length ? "error" : "ok";
    if (status === "ok" && existing.has(key)) {
      status = "duplicate";
      errors.push("Bu talaba guruhda allaqachon bor");
    } else if (status === "ok" && seen.has(key)) {
      status = "duplicate";
      errors.push("Faylda takrorlangan");
    }
    if (status === "ok") seen.add(key);
    const rowNo = typeof r.row === "number" && Number.isInteger(r.row) && r.row > 0 ? r.row : i + 2;
    return { row: rowNo, status, errors, warnings, data: { name, group, funding: funding ?? "Kontrakt", phone, parent: parent || "—" } };
  });
}

eduRouter.post(
  "/students/import",
  requireFeature("people", ["manage"]),
  h((req, res) => {
    const b = body(req);
    if (!Array.isArray(b.rows)) throw invalid('"rows" ro\'yxat bo\'lishi kerak.');
    if (b.rows.length === 0) throw invalid("Faylda talaba topilmadi.");
    if (b.rows.length > IMPORT_MAX) throw invalid(`Bir martada ${IMPORT_MAX} tagacha talaba yuklash mumkin.`);
    // Mijozdan kelgan natijaga ishonmaymiz — saqlashda ham to'liq qayta tekshiriladi
    const checked = validateImport(req, b.rows as ImportInput[]);
    const ok = checked.filter((r) => r.status === "ok");
    const summary = { total: checked.length, ok: ok.length, errors: checked.filter((r) => r.status === "error").length, duplicates: checked.filter((r) => r.status === "duplicate").length };

    if (b.dryRun !== false) {
      res.json({ summary, rows: checked });
      return;
    }
    if (ok.length === 0) throw invalid("Saqlanadigan to'g'ri qator yo'q.");
    let n = Math.max(4834, ...students(req).map((s) => Number(s.id.replace(/\D/g, "")) || 0));
    const ids: string[] = [];
    tx(() => {
      for (const r of ok) {
        n += 1;
        const st: Student = { id: `TLB-${n}`, name: r.data.name, group: r.data.group, funding: r.data.funding, phone: r.data.phone, parent: r.data.parent, gpa: 0, attendance: 100, status: "active", debt: 0 };
        putDoc(org(req), "students", st.id, st);
        ids.push(st.id);
      }
    });
    const byGroup = ok.reduce<Record<string, number>>((a, r) => ((a[r.data.group] = (a[r.data.group] ?? 0) + 1), a), {});
    auditTenant(req, "IMPORT", "Student", `${ids[0]}…${ids[ids.length - 1]}`, {
      newValue: `${ids.length} talaba import qilindi (${Object.entries(byGroup).map(([g, c]) => `${g}: ${c}`).join(", ")})${summary.errors + summary.duplicates ? `; ${summary.errors + summary.duplicates} qator o'tkazib yuborildi` : ""}`,
    });
    res.status(201).json({ summary: { ...summary, created: ids.length }, ids });
  }),
);

/* ───────── Talabalar ───────── */

eduRouter.get(
  "/students",
  requireFeature("people"),
  h((req, res) => {
    const scope = facultyGroups(req);
    res.json(students(req).filter((s) => !scope || scope.includes(s.group)));
  }),
);

eduRouter.post(
  "/students",
  requireFeature("people", ["manage"]),
  h((req, res) => {
    const b = body(req);
    const name = str(b, "name", { min: 5, max: 120 });
    if (name.split(/\s+/).length < 2) throw invalid("Familiya va ismni kiriting.");
    const group = str(b, "group", { max: 20 });
    const scope = facultyGroups(req);
    if (!groups(req).some((g) => g.id === group) || (scope && !scope.includes(group))) throw invalid("Guruh noto'g'ri.");
    const all = students(req);
    const n = Math.max(4834, ...all.map((s) => Number(s.id.replace(/\D/g, "")) || 0)) + 1;
    const st: Student = {
      id: `TLB-${n}`,
      name,
      group,
      funding: oneOf(b, "funding", ["Grant", "Kontrakt"] as const),
      phone: str(b, "phone", { min: 7, max: 30, pattern: /^[+\d\s()-]+$/ }),
      parent: str(b, "parent", { optional: true, max: 120 }) || "—",
      gpa: 0,
      attendance: 100,
      status: "active",
      debt: 0,
    };
    putDoc(org(req), "students", st.id, st);
    auditTenant(req, "CREATE", "Student", st.id, { newValue: `${name} (${group})` });
    res.status(201).json(st);
  }),
);

eduRouter.patch(
  "/students/:id",
  requireFeature("people", ["manage"]),
  h((req, res) => {
    const st = getDoc<Student>(org(req), "students", String(req.params.id));
    const scope = facultyGroups(req);
    if (!st || (scope && !scope.includes(st.group))) throw notFound("Talaba");
    const status = oneOf(body(req), "status", ["active", "leave", "expelled", "graduated"] as StudentStatus[]);
    const next = { ...st, status };
    putDoc(org(req), "students", st.id, next);
    auditTenant(req, "UPDATE", "Student", st.id, { oldValue: st.status, newValue: status });
    res.json(next);
  }),
);

/* ───────── Guruhlar ───────── */

eduRouter.get(
  "/groups",
  requireFeature("academic"),
  h((req, res) => {
    let list = groups(req);
    if (role(req) === "teacher") {
      const mine = new Set(teacherSubjects(req).flatMap((s) => s.groups));
      list = list.filter((g) => mine.has(g.id));
    } else {
      const scope = facultyGroups(req);
      if (scope) list = list.filter((g) => scope.includes(g.id));
    }
    res.json(list.map((g) => withLiveStats(g, students(req))));
  }),
);

/** Guruh ko'rsatkichlari har doim bazadagi faol talabalardan hisoblanadi (hujjatdagi eski raqamlar emas) */
function withLiveStats(g: Group, all: Student[]): Group {
  const st = all.filter((s) => s.group === g.id && s.status === "active");
  const graded = st.filter((s) => s.gpa > 0);
  return {
    ...g,
    students: st.length,
    gpa: graded.length ? Math.round((graded.reduce((a, s) => a + s.gpa, 0) / graded.length) * 100) / 100 : 0,
    attendance: st.length ? Math.round(st.reduce((a, s) => a + s.attendance, 0) / st.length) : 0,
  };
}

/** Kafedra o'qituvchilari — o'qituvchilar ro'yxatidagi kafedra nomi bo'yicha */
function departmentTeachers(depName: string) {
  return TEACHERS.filter((t) => depName.toLowerCase().startsWith(t.department.toLowerCase())).length;
}

/** Fakultet: haqiqiy faol talabalar soni va kafedralar bo'yicha o'qituvchilar */
function facultyLive(f: Faculty, gs: Group[], all: Student[]) {
  const ids = new Set(gs.filter((g) => g.faculty === f.id).map((g) => g.id));
  return {
    ...f,
    liveStudents: all.filter((s) => ids.has(s.group) && s.status === "active").length,
    liveGroups: ids.size,
    departments: f.departments.map((d) => ({ ...d, teachers: departmentTeachers(d.name) })),
  };
}

eduRouter.post(
  "/groups",
  requireFeature("academic", ["manage"]),
  h((req, res) => {
    const b = body(req);
    const id = str(b, "id", { max: 12 }).toUpperCase();
    if (!/^[A-Z]{2,4}-\d{2,3}$/.test(id)) throw invalid("Guruh kodi formati: IT-24");
    if (getDoc(org(req), "groups", id)) throw invalid(`${id} guruhi allaqachon mavjud.`);
    const faculty = str(b, "faculty", { max: 40 });
    if (!getDoc(org(req), "faculties", faculty)) throw invalid("Fakultet topilmadi.");
    if (role(req) === "dept_head" && DEAN_FACULTY[uid(req)] !== faculty) throw forbidden("Faqat o'z fakultetingizga guruh qo'sha olasiz.");
    const curator = oneOf(b, "curator", [...TEACHERS.map((t) => t.name), ...teacherAccounts(req).map((t) => t.name)]);
    const g: Group = { id, faculty, direction: str(b, "direction", { min: 2, max: 80 }), course: num(b, "course", { min: 1, max: 6, int: true }), curator, students: 0, attendance: 100, gpa: 0 };
    putDoc(org(req), "groups", id, g);
    auditTenant(req, "CREATE", "Group", id, { newValue: `${g.direction}, ${g.course}-kurs` });
    res.status(201).json(withLiveStats(g, students(req)));
  }),
);

/* ───────── Tashkiliy tuzilma ───────── */

eduRouter.get(
  "/faculties",
  requireFeature("structure"),
  h((req, res) => {
    const gs = groups(req);
    const all = students(req);
    res.json(listDocs<Faculty>(org(req), "faculties").map((f) => facultyLive(f, gs, all)));
  }),
);

eduRouter.post(
  "/faculties/:id/departments",
  requireFeature("structure", ["manage"]),
  h((req, res) => {
    const f = getDoc<Faculty>(org(req), "faculties", String(req.params.id));
    if (!f) throw notFound("Fakultet");
    const b = body(req);
    const name = str(b, "name", { min: 3, max: 120 });
    if (f.departments.some((d) => d.name.toLowerCase() === name.toLowerCase())) throw invalid("Bunday kafedra bor.");
    const next: Faculty = { ...f, departments: [...f.departments, { id: newId("d"), name, head: str(b, "head", { min: 3, max: 120 }), teachers: 0, students: 0 }] };
    putDoc(org(req), "faculties", f.id, next);
    auditTenant(req, "CREATE", "Department", f.id, { newValue: name });
    res.status(201).json(facultyLive(next, groups(req), students(req)));
  }),
);

/* ───────── Rollar va ruxsatlar ───────── */

const EDITABLE_ROLES: Role[] = ["owner", "rector", "dept_head", "advisor", "teacher", "student", "parent"];
const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

const matrixFor = (req: Request) => permissionMatrix(req.auth!.isPlatformAdmin ? null : org(req));

eduRouter.get(
  "/roles/permissions",
  requireFeature("roles"),
  h((req, res) => {
    res.json({ matrix: matrixFor(req), level: req.auth!.isPlatformAdmin ? "platform" : "organization", locked: req.auth!.isPlatformAdmin ? ["super_admin"] : LOCKED_ROLES });
  }),
);

eduRouter.put(
  "/roles/permissions",
  requireFeature("roles", ["manage"]),
  h((req, res) => {
    const b = body(req);
    const r = oneOf(b, "role", EDITABLE_ROLES);
    if (!req.auth!.isPlatformAdmin && LOCKED_ROLES.includes(r)) throw forbidden("Ega rolining ruxsatlarini tashkilot darajasida o'zgartirib bo'lmaydi.");
    const keys = strArray(b, "keys", PERMISSION_KEYS);
    if (keys.includes("platform.admin")) throw forbidden("Platforma ruxsatini berib bo'lmaydi.");
    const [scopeOrg, docId] = req.auth!.isPlatformAdmin ? ["_platform", "role_templates"] : [org(req), "role_permissions"];
    const cur = getDoc<Record<string, string[]>>(scopeOrg, "settings", docId) ?? {};
    putDoc(scopeOrg, "settings", docId, { ...cur, [r]: keys });
    if (req.auth!.isPlatformAdmin) auditPlatform(req, "Rol shablonlari", r, `${keys.length} ta ruxsat`);
    else auditTenant(req, "UPDATE", "RolePermissions", r, { newValue: `${keys.length} ta ruxsat` });
    res.json({ matrix: matrixFor(req), level: req.auth!.isPlatformAdmin ? "platform" : "organization", locked: req.auth!.isPlatformAdmin ? ["super_admin"] : LOCKED_ROLES });
  }),
);

eduRouter.post(
  "/roles/permissions/reset",
  requireFeature("roles", ["manage"]),
  h((req, res) => {
    const [scopeOrg, docId] = req.auth!.isPlatformAdmin ? ["_platform", "role_templates"] : [org(req), "role_permissions"];
    putDoc(scopeOrg, "settings", docId, {});
    if (req.auth!.isPlatformAdmin) auditPlatform(req, "Rol shablonlari", "barcha rollar", "Standart holatga qaytarildi");
    else auditTenant(req, "RESET", "RolePermissions", docId);
    res.json({ matrix: matrixFor(req), level: req.auth!.isPlatformAdmin ? "platform" : "organization", locked: req.auth!.isPlatformAdmin ? ["super_admin"] : LOCKED_ROLES });
  }),
);
