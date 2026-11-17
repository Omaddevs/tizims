/**
 * Semestrni yopish: yakuniy baholardan semestr GPA, kreditlar va akademik qarzlar;
 * bahorgi semestrda — kurs ko'chirish va bitiruvchilar. Oldindan ko'rish va yopish BIR XIL hisob-kitobdan foydalanadi.
 */
import { Router, type Request } from "express";
import { db, getDoc, listDocs, putDoc, deleteDoc, tx, wantsNotification } from "../db";
import { requireFeature, requireRoles } from "../auth";
import { auditTenant, body, forbidden, h, invalid, newId, notFound, nowStamp, str } from "../http";
import { STUDENT_LINKS } from "../../src/core/access";
import { MARK_POINTS, MAX_COURSE, toMark, type GradeRow, type Group, type Semester, type Student, type Subject } from "../../src/data/academic";

export const semesterRouter = Router();

const org = (req: Request) => req.auth!.orgId!;
const r2 = (n: number) => Math.round(n * 100) / 100;

type SubjectResult = { code: string; name: string; credits: number; total: number | null; mark: number | null; passed: boolean; reason?: string };
type StudentResult = {
  studentId: string;
  name: string;
  group: string;
  subjects: SubjectResult[];
  semesterGpa: number | null;
  creditsAttempted: number;
  creditsPassed: number;
  newDebts: number;
  cumulativeGpa: number;
  creditsEarned: number;
  outcome: "continue" | "promote" | "graduate" | "not_graduated";
};

function activeSemester(orgId: string) {
  return listDocs<Semester>(orgId, "semesters").find((s) => s.status === "active");
}

function nextSemesterOf(s: Semester): Semester {
  const year = Number(s.id.slice(0, 4));
  return s.kind === "fall"
    ? { id: `${year}-2`, name: `${year}–${year + 1} · Bahorgi semestr`, start: `${year + 1}-02-03`, end: `${year + 1}-06-20`, weeks: 18, current: 1, status: "active", kind: "spring" }
    : { id: `${year + 1}-1`, name: `${year + 1}–${year + 2} · Kuzgi semestr`, start: `${year + 1}-09-02`, end: `${year + 2}-01-15`, weeks: 18, current: 1, status: "active", kind: "fall" };
}

/** Hisob-kitob — o'zgartirmaydi */
function compute(orgId: string, sem: Semester) {
  const students = listDocs<Student>(orgId, "students").filter((s) => s.status === "active");
  const groups = listDocs<Group>(orgId, "groups");
  const subjects = listDocs<Subject>(orgId, "subjects");
  const grades = listDocs<GradeRow>(orgId, "grades");

  // Fan × guruh holati: hech kim baholamagan juftliklar hisobdan chiqariladi (butun guruh "yiqilmasligi" uchun)
  const pairs = subjects.flatMap((x) =>
    x.groups.map((g) => {
      const roster = students.filter((s) => s.group === g);
      const rows = grades.filter((r) => r.subject === x.code && roster.some((s) => s.id === r.studentId));
      const missingFinal = roster.filter((s) => {
        const r = rows.find((y) => y.studentId === s.id);
        return !r || r.yn === null;
      }).length;
      return { subject: x.code, name: x.name, group: g, students: roster.length, graded: rows.length, missingFinal, excluded: roster.length > 0 && rows.length === 0 };
    }),
  ).filter((p) => p.students > 0);

  const results: StudentResult[] = students.map((st) => {
    const group = groups.find((g) => g.id === st.group);
    const subs: SubjectResult[] = subjects
      .filter((x) => x.groups.includes(st.group) && !pairs.find((p) => p.subject === x.code && p.group === st.group)?.excluded)
      .map((x) => {
        const r = grades.find((y) => y.subject === x.code && y.studentId === st.id);
        if (!r) return { code: x.code, name: x.name, credits: x.credits, total: null, mark: null, passed: false, reason: "Baho kiritilmagan" };
        if (r.yn === null) return { code: x.code, name: x.name, credits: x.credits, total: r.jn + r.on, mark: null, passed: false, reason: "Yakuniy nazorat bahosi yo'q" };
        const total = r.jn + r.on + r.yn;
        const mark = toMark(total);
        return { code: x.code, name: x.name, credits: x.credits, total, mark, passed: mark > 2, reason: mark > 2 ? undefined : "Qoniqarsiz (55 dan past)" };
      });
    const attempted = subs.reduce((a, x) => a + x.credits, 0);
    const passed = subs.filter((x) => x.passed).reduce((a, x) => a + x.credits, 0);
    const points = subs.reduce((a, x) => a + (x.mark ? MARK_POINTS[x.mark] : 0) * x.credits, 0);
    const semGpa = attempted ? r2(points / attempted) : null;
    const prevCredits = st.creditsEarned ?? Math.max(0, ((group?.course ?? 1) - 1) * 60);
    // Umumiy GPA: avvalgi o'rtacha (yig'ilgan kreditlar bo'yicha) + shu semestr
    const cumulative = semGpa === null ? st.gpa : prevCredits + attempted ? r2(((st.gpa || 0) * prevCredits + semGpa * attempted) / (prevCredits + attempted)) : semGpa;
    const newDebts = subs.filter((x) => !x.passed).length;
    const totalDebt = st.debt + newDebts;
    let outcome: StudentResult["outcome"] = "continue";
    if (sem.kind === "spring" && group) outcome = group.course >= MAX_COURSE ? (totalDebt === 0 ? "graduate" : "not_graduated") : "promote";
    return {
      studentId: st.id,
      name: st.name,
      group: st.group,
      subjects: subs,
      semesterGpa: semGpa,
      creditsAttempted: attempted,
      creditsPassed: passed,
      newDebts,
      cumulativeGpa: cumulative,
      creditsEarned: prevCredits + passed,
      outcome,
    };
  });

  const withGpa = results.filter((r) => r.semesterGpa !== null);
  const promotedGroups = sem.kind === "spring" ? groups.filter((g) => g.course < MAX_COURSE && students.some((s) => s.group === g.id)).map((g) => ({ id: g.id, from: g.course, to: g.course + 1 })) : [];
  return {
    semester: sem,
    next: nextSemesterOf(sem),
    pairs,
    results,
    promotedGroups,
    summary: {
      students: results.length,
      gpa: withGpa.length ? r2(withGpa.reduce((a, r) => a + (r.semesterGpa ?? 0), 0) / withGpa.length) : 0,
      failed: results.filter((r) => r.newDebts > 0).length,
      newDebts: results.reduce((a, r) => a + r.newDebts, 0),
      missingFinals: pairs.reduce((a, p) => a + (p.excluded ? 0 : p.missingFinal), 0),
      excludedPairs: pairs.filter((p) => p.excluded).length,
      graduate: results.filter((r) => r.outcome === "graduate").length,
      notGraduated: results.filter((r) => r.outcome === "not_graduated").length,
      promoted: results.filter((r) => r.outcome === "promote").length,
    },
  };
}

semesterRouter.get(
  "/semesters",
  requireFeature("academic"),
  h((req, res) => {
    res.json(listDocs<Semester>(org(req), "semesters").sort((a, b) => b.id.localeCompare(a.id)));
  }),
);

/** Oldindan ko'rish — hech narsa o'zgarmaydi */
semesterRouter.get(
  "/semesters/close-preview",
  requireFeature("academic", ["manage"]),
  requireRoles("owner", "rector"),
  h((req, res) => {
    const sem = activeSemester(org(req));
    if (!sem) throw notFound("Faol semestr");
    res.json(compute(org(req), sem));
  }),
);

/** Semestrni yopish — qaytarib bo'lmaydi; bitta tranzaksiyada */
semesterRouter.post(
  "/semesters/close",
  requireFeature("academic", ["manage"]),
  requireRoles("owner", "rector"),
  h((req, res) => {
    const orgId = org(req);
    const sem = activeSemester(orgId);
    if (!sem) throw notFound("Faol semestr");
    if (str(body(req), "confirm", { max: 120 }) !== sem.name) throw invalid(`Tasdiqlash uchun semestr nomini aynan yozing: "${sem.name}"`);
    const c = compute(orgId, sem);
    if (c.results.length === 0) throw forbidden("Faol talaba yo'q — yopadigan narsa yo'q.");
    const at = nowStamp();

    tx(() => {
      const groups = listDocs<Group>(orgId, "groups");
      for (const r of c.results) {
        // 1) Natijalar arxivi (keyinchalik o'zgarmaydi)
        putDoc(orgId, "semester_results", `${sem.id}:${r.studentId}`, { semesterId: sem.id, semesterName: sem.name, ...r, closedAt: at });
        // 2) Talaba yozuvi
        const st = getDoc<Student>(orgId, "students", r.studentId)!;
        putDoc(orgId, "students", st.id, {
          ...st,
          gpa: r.cumulativeGpa,
          debt: st.debt + r.newDebts,
          creditsEarned: r.creditsEarned,
          status: r.outcome === "graduate" ? "graduated" : st.status,
        });
      }
      // 3) Bahorgi semestr — kurs ko'chirish
      for (const p of c.promotedGroups) {
        const g = groups.find((x) => x.id === p.id)!;
        putDoc(orgId, "groups", g.id, { ...g, course: p.to });
      }
      // 4) Baholash jurnallari yangi semestr uchun tozalanadi (natijalar arxivda)
      for (const g of listDocs<GradeRow>(orgId, "grades")) deleteDoc(orgId, "grades", `${g.subject}:${g.studentId}`);
      // 5) Semestrlar
      putDoc(orgId, "semesters", sem.id, {
        ...sem,
        status: "closed",
        current: sem.weeks,
        closedAt: at,
        closedBy: req.auth!.user.name,
        stats: { students: c.summary.students, gpa: c.summary.gpa, failed: c.summary.failed, promoted: c.summary.promoted, graduated: c.summary.graduate, excluded: c.summary.excludedPairs },
      } satisfies Semester);
      if (!getDoc(orgId, "semesters", c.next.id)) putDoc(orgId, "semesters", c.next.id, c.next);
    });

    // 6) Talabalarga natija (akkaunti bo'lganlarga)
    const links: Record<string, string> = { ...STUDENT_LINKS, ...(getDoc<Record<string, string>>(orgId, "settings", "student_links") ?? {}) };
    const ins = db.prepare("INSERT INTO notifications (id, org_id, for_user_id, data) VALUES (?, ?, ?, ?)");
    for (const [userId, studentId] of Object.entries(links)) {
      const r = c.results.find((x) => x.studentId === studentId);
      if (!r || !db.prepare("SELECT 1 FROM memberships WHERE user_id = ? AND org_id = ? AND status = 'active'").get(userId, orgId)) continue;
      if (!wantsNotification(orgId, userId, "grades")) continue;
      const id = newId("n");
      const text = `${sem.name} yakunlandi. Semestr GPA: ${r.semesterGpa ?? "—"}, umumiy GPA: ${r.cumulativeGpa}.${r.newDebts ? ` Akademik qarz: ${r.newDebts} fan.` : ""}${r.outcome === "graduate" ? " Tabriklaymiz — o'qishni tamomladingiz!" : ""}`;
      ins.run(id, orgId, userId, JSON.stringify({ id, title: "Semestr natijalari", body: text, time: at, read: false, channel: "inapp", forUserId: userId, link: "/grades" }));
    }

    auditTenant(req, "CLOSE", "Semester", sem.id, {
      newValue: `${c.summary.students} talaba · o'rtacha GPA ${c.summary.gpa} · ${c.summary.failed} talabada qarz${c.promotedGroups.length ? ` · ${c.promotedGroups.length} guruh kurs ko'chdi` : ""}${c.summary.graduate ? ` · ${c.summary.graduate} bitiruvchi` : ""}`,
    });
    res.json({ closed: sem.id, next: c.next, summary: c.summary });
  }),
);

/** Talabaning semestrlar tarixi */
export function semesterHistory(orgId: string, studentId: string) {
  return listDocs<StudentResult & { semesterId: string; semesterName: string }>(orgId, "semester_results")
    .filter((r) => r.studentId === studentId)
    .sort((a, b) => a.semesterId.localeCompare(b.semesterId))
    .map((r) => ({ semesterId: r.semesterId, name: r.semesterName, gpa: r.semesterGpa, cumulativeGpa: r.cumulativeGpa, creditsPassed: r.creditsPassed, newDebts: r.newDebts, subjects: r.subjects }));
}
