/**
 * E'lonlar va bloglar (posts) hamda onlayn testlar.
 * Auditoriya va natijalar serverda tekshiriladi: talaba faqat o'ziga tegishli e'lon/testni ko'radi,
 * test javoblari serverda baholanadi, to'g'ri javoblar talabaga yuborilmaydi.
 */
import { Router, type NextFunction, type Request, type Response } from "express";
import { db, getDoc, listDocs, putDoc, deleteDoc, wantsNotification } from "../db";
import { moduleEnabled } from "../auth";
import { HttpError, auditTenant, body, bool, forbidden, h, has, invalid, newId, notFound, nowStamp, num, oneOf, str, strArray } from "../http";
import { STUDENT_LINKS } from "../../src/core/access";
import { FEATURE_MANAGE_PERMISSION, accessOf, type FeatureKey } from "../../src/core/features";
import { TEACHERS, type Group, type Student, type Subject } from "../../src/data/academic";

export const contentRouter = Router();

/** /posts/:id va /tests/:id yo'llari: sessiya va ta'lim moduli majburiy (kind oldindan ma'lum emas) */
function requireEduSession(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(new HttpError(401, "UNAUTHORIZED", "Tizimga kiring."));
  if (!req.auth.orgId || !req.auth.role) return next(new HttpError(403, "NO_TENANT", "Tashkilot tanlanmagan."));
  if (!moduleEnabled(req.auth.orgId, "education")) return next(new HttpError(403, "MODULE_DISABLED", "Ta'lim moduli yoqilmagan."));
  next();
}
contentRouter.use(["/posts/:id", "/tests/:id"], requireEduSession);

const org = (req: Request) => req.auth!.orgId!;
const uid = (req: Request) => req.auth!.user.id;
const role = (req: Request) => req.auth!.role!;

function feature(key: FeatureKey) {
  const a = (req: Request) => accessOf(req.auth?.role ?? undefined, key);
  return {
    access: a,
    /** Modulga kirish: ta'lim moduli + rol */
    any: (req: Request, _res: Response, next: NextFunction) => {
      if (!req.auth) return next(new HttpError(401, "UNAUTHORIZED", "Tizimga kiring."));
      if (!req.auth.orgId || !moduleEnabled(req.auth.orgId, "education")) return next(new HttpError(403, "MODULE_DISABLED", "Ta'lim moduli yoqilmagan."));
      if (!a(req)) return next(forbidden("Bu bo'limga ruxsat yo'q."));
      next();
    },
    /** Boshqaruv: manage darajasi + rollar matritsasidagi ruxsat */
    manage: (req: Request, _res: Response, next: NextFunction) => {
      const perm = FEATURE_MANAGE_PERMISSION[key];
      if (a(req) !== "manage" || (perm && !req.auth!.permissions.includes(perm))) return next(forbidden("Bu amal uchun ruxsat yo'q."));
      next();
    },
  };
}

/** Talaba/ota-ona — bog'langan talabaning guruhi */
function viewerGroup(req: Request): string | null {
  if (role(req) !== "student" && role(req) !== "parent") return null;
  const links = { ...STUDENT_LINKS, ...(getDoc<Record<string, string>>(org(req), "settings", "student_links") ?? {}) };
  const sid = links[uid(req)];
  return sid ? (getDoc<Student>(org(req), "students", sid)?.group ?? null) : null;
}

const isLearner = (req: Request) => role(req) === "student" || role(req) === "parent";

/* ═════════════════ E'lonlar va bloglar ═════════════════ */

export type Post = {
  id: string;
  kind: "news" | "blog";
  title: string;
  body: string;
  audience: "all" | "students" | "staff";
  groups: string[];
  pinned: boolean;
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt?: string;
  likes: string[];
};

const kindFeature = (k: Post["kind"]) => feature(k === "news" ? "news" : "blog");

function canSee(req: Request, p: Post) {
  if (kindFeature(p.kind).access(req) === "manage") return true;
  if (isLearner(req)) {
    if (p.audience === "staff") return false;
    if (p.groups.length === 0) return true;
    const g = viewerGroup(req);
    return !!g && p.groups.includes(g);
  }
  return p.audience !== "students";
}

function postView(req: Request, p: Post) {
  const { likes, ...rest } = p;
  return { ...rest, likes: likes.length, likedByMe: likes.includes(uid(req)), canEdit: kindFeature(p.kind).access(req) === "manage" };
}

const kindOf = (req: Request): Post["kind"] => (req.query.kind === "blog" || body(req).kind === "blog" ? "blog" : "news");
const withKind = (fn: "any" | "manage") => (req: Request, res: Response, next: NextFunction) => kindFeature(kindOf(req))[fn](req, res, next);

contentRouter.get(
  "/posts",
  withKind("any"),
  h((req, res) => {
    const k = kindOf(req);
    const list = listDocs<Post>(org(req), "posts")
      .filter((p) => p.kind === k && canSee(req, p))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt));
    res.json(list.map((p) => postView(req, p)));
  }),
);

function parsePostBody(req: Request, groupIds: Set<string>) {
  const b = body(req);
  const groups = has(b, "groups") ? strArray(b, "groups") : [];
  const bad = groups.filter((g) => !groupIds.has(g));
  if (bad.length) throw invalid(`Guruh topilmadi: ${bad.join(", ")}`);
  return {
    title: str(b, "title", { min: 4, max: 160 }),
    body: str(b, "body", { min: 10, max: 10000 }),
    audience: oneOf(b, "audience", ["all", "students", "staff"] as const),
    groups,
    pinned: bool(b, "pinned"),
  };
}

contentRouter.post(
  "/posts",
  withKind("any"),
  withKind("manage"),
  h((req, res) => {
    const groupIds = new Set(listDocs<Group>(org(req), "groups").map((g) => g.id));
    const p: Post = { id: newId("p"), kind: kindOf(req), ...parsePostBody(req, groupIds), authorId: uid(req), authorName: req.auth!.user.name, createdAt: nowStamp(), likes: [] };
    if (p.audience === "staff" && p.groups.length) throw invalid("Xodimlarga e'londa guruh tanlanmaydi.");
    putDoc(org(req), "posts", p.id, p);
    auditTenant(req, "CREATE", p.kind === "news" ? "Announcement" : "BlogPost", p.id, { newValue: p.title });
    if (p.kind === "news" && p.audience !== "staff") notifyStudents(req, p);
    res.status(201).json(postView(req, p));
  }),
);

/** Yangi e'lon — auditoriyadagi talaba/ota-ona akkauntlariga xabar ("E'lonlar" sozlamasi hisobga olinadi) */
function notifyStudents(req: Request, p: Post) {
  const links = { ...STUDENT_LINKS, ...(getDoc<Record<string, string>>(org(req), "settings", "student_links") ?? {}) };
  const ins = db.prepare("INSERT INTO notifications (id, org_id, for_user_id, data) VALUES (?, ?, ?, ?)");
  for (const [userId, sid] of Object.entries(links)) {
    const st = getDoc<Student>(org(req), "students", sid);
    if (!st || (p.groups.length && !p.groups.includes(st.group))) continue;
    if (!db.prepare("SELECT 1 FROM memberships WHERE user_id = ? AND org_id = ? AND status = 'active'").get(userId, org(req))) continue;
    if (!wantsNotification(org(req), userId, "news")) continue;
    const id = newId("n");
    ins.run(id, org(req), userId, JSON.stringify({ id, title: "Yangi e'lon", body: p.title, time: nowStamp(), read: false, channel: "inapp", forUserId: userId, link: "/news" }));
  }
}

function loadPost(req: Request) {
  const p = getDoc<Post>(org(req), "posts", String(req.params.id));
  if (!p || !canSee(req, p)) throw notFound("Post");
  return p;
}

contentRouter.patch(
  "/posts/:id",
  h((req, res) => {
    const p = loadPost(req);
    if (kindFeature(p.kind).access(req) !== "manage") throw forbidden();
    const groupIds = new Set(listDocs<Group>(org(req), "groups").map((g) => g.id));
    const next: Post = { ...p, ...parsePostBody(req, groupIds), updatedAt: nowStamp() };
    putDoc(org(req), "posts", p.id, next);
    auditTenant(req, "UPDATE", p.kind === "news" ? "Announcement" : "BlogPost", p.id, { newValue: next.title });
    res.json(postView(req, next));
  }),
);

contentRouter.delete(
  "/posts/:id",
  h((req, res) => {
    const p = loadPost(req);
    if (kindFeature(p.kind).access(req) !== "manage") throw forbidden();
    deleteDoc(org(req), "posts", p.id);
    auditTenant(req, "DELETE", p.kind === "news" ? "Announcement" : "BlogPost", p.id, { oldValue: p.title });
    res.json({ success: true });
  }),
);

contentRouter.post(
  "/posts/:id/like",
  h((req, res) => {
    if (!req.auth?.orgId) throw new HttpError(401, "UNAUTHORIZED", "Tizimga kiring.");
    const p = loadPost(req);
    if (!kindFeature(p.kind).access(req)) throw forbidden();
    const liked = p.likes.includes(uid(req));
    const next = { ...p, likes: liked ? p.likes.filter((x) => x !== uid(req)) : [...p.likes, uid(req)] };
    putDoc(org(req), "posts", p.id, next);
    res.json(postView(req, next));
  }),
);

/* ═════════════════ Onlayn testlar ═════════════════ */

export type TestQuestion = { text: string; options: string[]; correct: number };
export type OnlineTest = {
  id: string;
  title: string;
  subject: string;
  groups: string[];
  durationMin: number;
  opensAt: string; // "YYYY-MM-DDTHH:MM"
  closesAt: string;
  questions: TestQuestion[];
  status: "draft" | "published" | "closed";
  createdBy: string;
  createdAt: string;
};
type Attempt = { testId: string; userId: string; studentId: string; studentName: string; group: string; startedAt: number; deadline: number; answers: number[] | null; score: number | null; correct: number | null; submittedAt: number | null };

const tests = feature("tests");
const nowIso = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const GRACE_MS = 60_000; // tarmoq kechikishi uchun 1 daqiqa

function linkedStudentOf(req: Request) {
  const links = { ...STUDENT_LINKS, ...(getDoc<Record<string, string>>(org(req), "settings", "student_links") ?? {}) };
  const sid = links[uid(req)];
  return sid ? getDoc<Student>(org(req), "students", sid) : undefined;
}

function testState(t: OnlineTest) {
  const n = nowIso();
  if (t.status === "draft") return "draft";
  if (t.status === "closed" || n >= t.closesAt) return "closed";
  if (n < t.opensAt) return "upcoming";
  return "open";
}

contentRouter.get(
  "/tests",
  tests.any,
  h((req, res) => {
    const all = listDocs<OnlineTest>(org(req), "tests");
    const attempts = listDocs<Attempt>(org(req), "test_attempts");
    if (tests.access(req) === "manage") {
      res.json(
        all
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((t) => {
            const done = attempts.filter((a) => a.testId === t.id && a.score !== null);
            return { ...t, state: testState(t), attempts: done.length, avgScore: done.length ? Math.round(done.reduce((s, a) => s + (a.score ?? 0), 0) / done.length) : null };
          }),
      );
      return;
    }
    const st = linkedStudentOf(req);
    if (!st) {
      res.json([]);
      return;
    }
    res.json(
      all
        .filter((t) => t.status !== "draft" && t.groups.includes(st.group))
        .sort((a, b) => a.opensAt.localeCompare(b.opensAt))
        .map((t) => {
          const a = attempts.find((x) => x.testId === t.id && x.userId === uid(req));
          const state = testState(t);
          // Savollar va to'g'ri javoblar ro'yxatda yuborilmaydi
          return {
            id: t.id,
            title: t.title,
            subject: t.subject,
            durationMin: t.durationMin,
            opensAt: t.opensAt,
            closesAt: t.closesAt,
            questions: t.questions.length,
            state,
            attempt: a ? { submitted: a.submittedAt !== null, score: a.score, correct: a.correct, inProgress: a.submittedAt === null && Date.now() < a.deadline + GRACE_MS, deadline: a.deadline } : null,
          };
        }),
    );
  }),
);

function parseTest(req: Request): Omit<OnlineTest, "id" | "createdBy" | "createdAt" | "status"> {
  const b = body(req);
  const subject = str(b, "subject", { max: 20 });
  const sub = getDoc<Subject>(org(req), "subjects", subject);
  if (!sub) throw invalid("Fan topilmadi.");
  const groups = strArray(b, "groups");
  if (!groups.length) throw invalid("Kamida bitta guruh tanlang.");
  const bad = groups.filter((g) => !sub.groups.includes(g));
  if (bad.length) throw invalid(`${sub.name} fani ${bad.join(", ")} guruhiga biriktirilmagan.`);
  const DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  const opensAt = str(b, "opensAt", { pattern: DT });
  const closesAt = str(b, "closesAt", { pattern: DT });
  if (closesAt <= opensAt) throw invalid("Yopilish vaqti ochilishdan keyin bo'lishi kerak.");
  if (!Array.isArray(b.questions) || b.questions.length === 0) throw invalid("Kamida bitta savol kiriting.");
  if (b.questions.length > 100) throw invalid("Ko'pi bilan 100 ta savol.");
  const questions = (b.questions as Record<string, unknown>[]).map((q, i) => {
    const text = str(q, "text", { min: 2, max: 1000 });
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) throw invalid(`${i + 1}-savol: 2–6 ta variant bo'lishi kerak.`);
    const options = (q.options as unknown[]).map((o) => String(o ?? "").trim());
    if (options.some((o) => !o || o.length > 300)) throw invalid(`${i + 1}-savol: variantlar bo'sh yoki juda uzun.`);
    const correct = num(q, "correct", { min: 0, max: options.length - 1, int: true });
    return { text, options, correct };
  });
  return { title: str(b, "title", { min: 3, max: 160 }), subject, groups, durationMin: num(b, "durationMin", { min: 1, max: 240, int: true }), opensAt, closesAt, questions };
}

contentRouter.post(
  "/tests",
  tests.any,
  tests.manage,
  h((req, res) => {
    const t: OnlineTest = { id: newId("test"), ...parseTest(req), status: body(req).publish === true ? "published" : "draft", createdBy: req.auth!.user.name, createdAt: nowStamp() };
    putDoc(org(req), "tests", t.id, t);
    auditTenant(req, "CREATE", "Test", t.id, { newValue: `${t.title} · ${t.questions.length} savol · ${t.groups.join(", ")}` });
    res.status(201).json({ ...t, state: testState(t), attempts: 0, avgScore: null });
  }),
);

contentRouter.patch(
  "/tests/:id",
  tests.any,
  tests.manage,
  h((req, res) => {
    const t = getDoc<OnlineTest>(org(req), "tests", String(req.params.id));
    if (!t) throw notFound("Test");
    const status = oneOf(body(req), "status", ["published", "closed"] as const);
    if (status === "published" && t.status !== "draft") throw invalid("Faqat qoralamani e'lon qilish mumkin.");
    const next = { ...t, status };
    putDoc(org(req), "tests", t.id, next);
    auditTenant(req, status === "published" ? "PUBLISH" : "CLOSE", "Test", t.id, { newValue: t.title });
    res.json({ ...next, state: testState(next) });
  }),
);

contentRouter.get(
  "/tests/:id/results",
  tests.any,
  tests.manage,
  h((req, res) => {
    const t = getDoc<OnlineTest>(org(req), "tests", String(req.params.id));
    if (!t) throw notFound("Test");
    const attempts = listDocs<Attempt>(org(req), "test_attempts").filter((a) => a.testId === t.id);
    // Har bir savol bo'yicha to'g'ri javob berganlar ulushi — qaysi mavzu qiyinligini ko'rsatadi
    const done = attempts.filter((a) => a.answers);
    const perQuestion = t.questions.map((q, i) => ({ index: i, text: q.text, correctRate: done.length ? Math.round((done.filter((a) => a.answers![i] === q.correct).length / done.length) * 100) : null }));
    res.json({
      test: { ...t, state: testState(t) },
      attempts: attempts.map((a) => ({ studentId: a.studentId, name: a.studentName, group: a.group, score: a.score, correct: a.correct, submittedAt: a.submittedAt ? new Date(a.submittedAt).toISOString() : null, inProgress: a.submittedAt === null })),
      perQuestion,
    });
  }),
);

/** Testni boshlash — bitta urinish; savollar to'g'ri javobsiz qaytariladi */
contentRouter.post(
  "/tests/:id/start",
  tests.any,
  h((req, res) => {
    if (tests.access(req) !== "own" || role(req) !== "student") throw forbidden("Testni faqat talaba topshiradi.");
    const t = getDoc<OnlineTest>(org(req), "tests", String(req.params.id));
    const st = linkedStudentOf(req);
    if (!t || !st || t.status === "draft" || !t.groups.includes(st.group)) throw notFound("Test");
    const key = `${t.id}:${uid(req)}`;
    let a = getDoc<Attempt>(org(req), "test_attempts", key);
    if (!a) {
      if (testState(t) !== "open") throw invalid(testState(t) === "upcoming" ? `Test ${t.opensAt.replace("T", " ")} da ochiladi.` : "Test yopilgan.");
      const startedAt = Date.now();
      const closeMs = new Date(t.closesAt).getTime();
      a = { testId: t.id, userId: uid(req), studentId: st.id, studentName: st.name, group: st.group, startedAt, deadline: Math.min(startedAt + t.durationMin * 60_000, closeMs), answers: null, score: null, correct: null, submittedAt: null };
      putDoc(org(req), "test_attempts", key, a);
    } else if (a.submittedAt !== null) throw invalid("Siz bu testni topshirgansiz — qayta topshirib bo'lmaydi.");
    else if (Date.now() > a.deadline + GRACE_MS) throw invalid("Vaqt tugagan.");
    res.json({ id: t.id, title: t.title, deadline: a.deadline, serverNow: Date.now(), questions: t.questions.map((q) => ({ text: q.text, options: q.options })) });
  }),
);

contentRouter.post(
  "/tests/:id/submit",
  tests.any,
  h((req, res) => {
    const t = getDoc<OnlineTest>(org(req), "tests", String(req.params.id));
    if (!t) throw notFound("Test");
    const key = `${t.id}:${uid(req)}`;
    const a = getDoc<Attempt>(org(req), "test_attempts", key);
    if (!a) throw invalid("Avval testni boshlang.");
    if (a.submittedAt !== null) throw invalid("Test allaqachon topshirilgan.");
    const b = body(req);
    if (!Array.isArray(b.answers) || b.answers.length !== t.questions.length) throw invalid("Javoblar soni savollar soniga mos emas.");
    // Muddatdan keyin kelgan javoblar ham saqlanadi, lekin "kechikkan" deb 0 ball — tarmoq uchun 1 daqiqa imtiyoz
    const late = Date.now() > a.deadline + GRACE_MS;
    const answers = (b.answers as unknown[]).map((x) => (typeof x === "number" && Number.isInteger(x) ? x : -1));
    const correct = late ? 0 : t.questions.reduce((s, q, i) => s + (answers[i] === q.correct ? 1 : 0), 0);
    const score = Math.round((correct / t.questions.length) * 100);
    putDoc(org(req), "test_attempts", key, { ...a, answers, correct, score, submittedAt: Date.now() });
    auditTenant(req, "SUBMIT", "Test", t.id, { newValue: `${correct}/${t.questions.length} (${score}%)${late ? " · kechikkan" : ""}` });
    res.json({ correct, total: t.questions.length, score, late });
  }),
);

/* ═════════════════ Talaba / ota-ona bosh sahifasi ═════════════════ */

type LessonDoc = { id: string; day: number; slot: number; subject: string; group: string; teacherId: string; room: string; type: string; archived?: boolean };
type GradeDoc = { studentId: string; subject: string; jn: number; on: number; yn: number | null };
type AttendanceDoc = { lessonId: string; date: string; marks: Record<string, string> };
type AssignmentDoc = { id: string; subject: string; title: string; due: string; maxScore: number };
type SemesterResultDoc = { studentId: string; semesterId: string; semesterName: string; semesterGpa: number | null; cumulativeGpa: number; newDebts: number };

const mySubjects = feature("mySubjects");

function teacherNameById(id: string) {
  const u = db.prepare("SELECT name FROM users WHERE id = ?").get(id) as { name: string } | undefined;
  return u?.name ?? TEACHERS.find((t) => t.id === id)?.name ?? "—";
}

/** Bitta so'rovda: bugun, diqqat talab qiladiganlar, ko'rsatkichlar, fanlar, natijalar, e'lonlar — hammasi bazadan */
contentRouter.get(
  "/my/home",
  mySubjects.any,
  h((req, res) => {
    const st = linkedStudentOf(req);
    if (!st) throw notFound("Talaba");
    const o = org(req);
    const group = getDoc<Group>(o, "groups", st.group);
    const subjects = listDocs<Subject>(o, "subjects").filter((x) => x.groups.includes(st.group));
    const names = Object.fromEntries(subjects.map((x) => [x.code, x.name]));
    const now = new Date();
    const dayIdx = now.getDay() === 0 ? -1 : now.getDay() - 1;
    const p2 = (n: number) => String(n).padStart(2, "0");
    const todayStr = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`;
    const soon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3);
    const soonStr = `${soon.getFullYear()}-${p2(soon.getMonth() + 1)}-${p2(soon.getDate())}`;

    // Bugungi darslar
    const lessons = listDocs<LessonDoc>(o, "lessons").filter((l) => !l.archived && l.group === st.group);
    const today = lessons
      .filter((l) => l.day === dayIdx)
      .sort((a, b) => a.slot - b.slot)
      .map((l) => ({ slot: l.slot, subject: names[l.subject] ?? l.subject, room: l.room, type: l.type, teacher: teacherNameById(l.teacherId) }));
    // Ertangi birinchi dars (bugun dars tugagan bo'lsa ko'rsatish uchun)
    const nextDay = [1, 2, 3, 4, 5, 6].map((k) => (dayIdx + k) % 7).find((d) => d <= 5 && d >= 0 && lessons.some((l) => l.day === d));
    const nextDayFirst =
      nextDay !== undefined
        ? lessons.filter((l) => l.day === nextDay).sort((a, b) => a.slot - b.slot).map((l) => ({ day: nextDay, slot: l.slot, subject: names[l.subject] ?? l.subject, room: l.room }))[0]
        : null;

    // Joriy ballar
    const grades = listDocs<GradeDoc>(o, "grades").filter((g) => g.studentId === st.id);
    const subjectRows = subjects.map((x) => {
      const g = grades.find((r) => r.subject === x.code);
      return { code: x.code, name: x.name, teacher: teacherNameById(x.teacherId), credits: x.credits, jn: g?.jn ?? null, on: g?.on ?? null, yn: g?.yn ?? null };
    });
    const graded = subjectRows.filter((r) => r.jn !== null);
    const currentPct = graded.length ? Math.round((graded.reduce((a, r) => a + (r.jn ?? 0) + (r.on ?? 0), 0) / (graded.length * 50)) * 100) : null;

    // Belgilangan davomat
    const allLessons = listDocs<LessonDoc>(o, "lessons");
    const marks = listDocs<AttendanceDoc>(o, "attendance")
      .filter((a) => a.marks[st.id])
      .map((a) => ({ date: a.date, mark: a.marks[st.id], subject: names[allLessons.find((l) => l.id === a.lessonId)?.subject ?? ""] ?? "—" }));
    const absent = marks.filter((m) => m.mark === "absent");
    const attendanceRate = marks.length ? Math.round(((marks.length - absent.length) / marks.length) * 100) : null;

    // Testlar
    const attempts = listDocs<{ testId: string; userId: string; studentId: string; score: number | null; submittedAt: number | null }>(o, "test_attempts").filter((a) => a.studentId === st.id);
    const tests = listDocs<OnlineTest>(o, "tests").filter((t) => t.status !== "draft" && t.groups.includes(st.group));
    const openTests = tests
      .filter((t) => testState(t) === "open" && !attempts.some((a) => a.testId === t.id && a.submittedAt !== null))
      .map((t) => ({ id: t.id, title: t.title, closesAt: t.closesAt, durationMin: t.durationMin, questions: t.questions.length }));
    const testResults = attempts
      .filter((a) => a.submittedAt !== null)
      .sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0))
      .slice(0, 3)
      .map((a) => ({ title: tests.find((t) => t.id === a.testId)?.title ?? "Test", score: a.score, at: new Date(a.submittedAt!).toISOString().slice(0, 10) }));

    // Topshiriqlar (talaba akkauntining topshirgani)
    const submitted = new Set(listDocs<{ assignmentId: string; userId: string }>(o, "submissions").filter((x) => x.userId === uid(req)).map((x) => x.assignmentId));
    const assignments = listDocs<AssignmentDoc>(o, "assignments").filter((a) => names[a.subject]);
    const pending = assignments.filter((a) => !submitted.has(a.id)).sort((a, b) => a.due.localeCompare(b.due));

    // E'lonlar
    const news = listDocs<Post>(o, "posts")
      .filter((p) => p.kind === "news" && p.audience !== "staff" && (p.groups.length === 0 || p.groups.includes(st.group)))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3)
      .map((p) => ({ id: p.id, title: p.title, createdAt: p.createdAt, pinned: p.pinned }));

    const semesters = listDocs<SemesterResultDoc>(o, "semester_results").filter((r) => r.studentId === st.id).sort((a, b) => b.semesterId.localeCompare(a.semesterId));

    res.json({
      student: { id: st.id, name: st.name, group: st.group, status: st.status },
      group: group ? { direction: group.direction, course: group.course } : null,
      today: { dayIndex: dayIdx, date: todayStr, lessons: today, nextDayFirst },
      kpi: {
        gpa: st.gpa,
        currentPct,
        gradedSubjects: graded.length,
        totalSubjects: subjects.length,
        attendanceRate,
        markedLessons: marks.length,
        absences: absent.length,
        credits: st.creditsEarned ?? Math.max(0, ((group?.course ?? 1) - 1) * 60),
        creditsTotal: 240,
        debt: st.debt,
      },
      attention: {
        openTests,
        dueSoon: pending.filter((a) => a.due >= todayStr && a.due <= soonStr).slice(0, 3).map((a) => ({ id: a.id, title: a.title, subject: names[a.subject], due: a.due })),
        overdue: pending.filter((a) => a.due < todayStr).length,
        recentAbsences: absent.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3),
      },
      subjects: subjectRows,
      results: { tests: testResults, lastSemester: semesters[0] ? { name: semesters[0].semesterName, gpa: semesters[0].semesterGpa, debts: semesters[0].newDebts } : null },
      news,
      charts: {
        // Davomat taqsimoti (belgilangan darslar bo'yicha)
        attendance: { present: marks.filter((m) => m.mark === "present").length, late: marks.filter((m) => m.mark === "late").length, excused: marks.filter((m) => m.mark === "excused").length, absent: absent.length },
        // Haftalik dars yuklamasi: Du..Sh
        weekLoad: [0, 1, 2, 3, 4, 5].map((d) => lessons.filter((l) => l.day === d).length),
        // Test natijalari — vaqt bo'yicha (oxirgi 8 ta)
        tests: attempts
          .filter((a) => a.submittedAt !== null)
          .sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0))
          .slice(-8)
          .map((a) => ({ title: tests.find((t) => t.id === a.testId)?.title ?? "Test", score: a.score ?? 0, at: new Date(a.submittedAt!).toISOString().slice(0, 10) })),
        // Semestrlar bo'yicha GPA
        gpaHistory: [...semesters].reverse().map((r) => ({ name: r.semesterName, gpa: r.semesterGpa, cumulative: r.cumulativeGpa })),
      },
    });
  }),
);

/* ═════════════════ Demo kontent ═════════════════ */

export function seedContent(orgId: string) {
  if (listDocs(orgId, "posts").length === 0) {
    const base = { groups: [] as string[], authorId: "u3", authorName: "Rektor A. Qodirov", likes: [] as string[] };
    const posts: Post[] = [
      { ...base, id: "p-news-1", kind: "news", title: "Oraliq nazorat haftaligi — 20-noyabrdan", body: "Hurmatli talabalar! 20–30-noyabr kunlari oraliq nazorat haftaligi o'tkaziladi. Jadval 'Baholar va imtihonlar' bo'limida e'lon qilindi. Davomati 75% dan past talabalar nazoratga kiritilmaydi.", audience: "students", pinned: true, createdAt: "2026-11-14 09:00" },
      { ...base, id: "p-news-2", kind: "news", title: "B-blokda ta'mirlash ishlari", body: "B-204 xonasida ta'mirlash ishlari olib borilmoqda. Shu xonadagi darslar boshqa xonalarga ko'chirildi — yangilangan jadvalni tekshiring.", audience: "all", pinned: false, createdAt: "2026-11-15 10:15" },
      { ...base, id: "p-news-3", kind: "news", title: "Kafedra yig'ilishi", body: "Barcha kafedra mudirlari juma kuni soat 15:00 da majlislar zalida yig'ilishga taklif qilinadi.", audience: "staff", pinned: false, createdAt: "2026-11-13 12:00" },
      { ...base, id: "p-blog-1", kind: "blog", title: "IT-21 talabalari xalqaro hakatonda g'olib bo'ldi", body: "Sun'iy intellekt yo'nalishi talabalari Jasmina Aliyeva va Diyora Nematova 'AI for Agriculture' hakatonida 1-o'rinni egalladi. Ular ekinlar kasalligini rasm orqali aniqlovchi model yaratishdi.\n\nTabriklaymiz!", audience: "all", pinned: false, createdAt: "2026-11-10 16:30", authorName: "Malika Yusupova", authorId: "u-ts-advisor" },
      { ...base, id: "p-blog-2", kind: "blog", title: "Kutubxonaga 200 ta yangi e-kitob qo'shildi", body: "Elektron kutubxonamiz dasturlash, sun'iy intellekt va agronomiya bo'yicha 200 ta yangi nashr bilan boyidi. 'LMS va kutubxona' bo'limida qidiring.", audience: "all", pinned: false, createdAt: "2026-11-08 11:00", authorName: "Malika Yusupova", authorId: "u-ts-advisor" },
    ];
    for (const p of posts) putDoc(orgId, "posts", p.id, p);
  }
  if (listDocs(orgId, "tests").length === 0 && getDoc(orgId, "subjects", "CS-301")) {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const iso = (x: Date) => `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
    const t: OnlineTest = {
      id: "test-cs301-1",
      title: "Neyron tarmoqlar — 1-mavzu testi",
      subject: "CS-301",
      groups: ["IT-21", "IT-22"],
      durationMin: 15,
      opensAt: iso(new Date(d.getTime() - 86400000)),
      closesAt: iso(new Date(d.getTime() + 14 * 86400000)),
      status: "published",
      createdBy: "Malika Yusupova",
      createdAt: nowStamp(),
      questions: [
        { text: "Perseptron qanday faollashtirish funksiyasidan foydalanadi?", options: ["Sigmoid", "Pog'onali (step) funksiya", "ReLU", "Softmax"], correct: 1 },
        { text: "Backpropagation algoritmi nimani hisoblaydi?", options: ["Ma'lumotlarni normallashtiradi", "Xatolik gradientlarini", "Neyronlar sonini", "O'rganish tezligini"], correct: 1 },
        { text: "Qaysi funksiya ko'p sinfli klassifikatsiyada chiqish qatlamida ishlatiladi?", options: ["Softmax", "Tanh", "Step", "Linear"], correct: 0 },
        { text: "Overfitting'ga qarshi qaysi usul ishlatiladi?", options: ["O'rganish tezligini oshirish", "Dropout", "Epoxalar sonini oshirish", "Qatlamlarni ko'paytirish"], correct: 1 },
      ],
    };
    putDoc(orgId, "tests", t.id, t);
  }
}

