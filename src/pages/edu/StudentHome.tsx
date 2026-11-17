/**
 * Talaba / ota-ona bosh sahifasi — faqat haqiqiy ma'lumot (/api/edu/my/home):
 * hozirgi/keyingi dars, diqqat talab qiladiganlar, ko'rsatkichlar, fanlar, natijalar, e'lonlar.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, BookOpen, CalendarDays, CheckCircle2, ClipboardList, Clock, FileQuestion, GraduationCap, MapPin, Megaphone, Pin, UserCheck, UserX } from "lucide-react";
import { useApp } from "../../store/AppContext";
import { Card, CardHead, Empty, Pill, Progress, QueryState, type Tone } from "../../components/kit";
import { useApi } from "../../lib/api";
import { cn } from "../../lib/utils";
import { DAYS, SLOTS, fmtDateShort } from "./homeUtils";
import { AttendanceChart, GpaHistoryChart, SubjectScoresChart, TestScoresChart, WeekLoadChart } from "./StudentCharts";

type Home = {
  student: { id: string; name: string; group: string; status: string };
  group: { direction: string; course: number } | null;
  today: { dayIndex: number; date: string; lessons: { slot: number; subject: string; room: string; type: string; teacher: string }[]; nextDayFirst: { day: number; slot: number; subject: string; room: string } | null };
  kpi: { gpa: number; currentPct: number | null; gradedSubjects: number; totalSubjects: number; attendanceRate: number | null; markedLessons: number; absences: number; credits: number; creditsTotal: number; debt: number };
  attention: {
    openTests: { id: string; title: string; closesAt: string; durationMin: number; questions: number }[];
    dueSoon: { id: string; title: string; subject: string; due: string }[];
    overdue: number;
    recentAbsences: { date: string; subject: string }[];
  };
  subjects: { code: string; name: string; teacher: string; credits: number; jn: number | null; on: number | null; yn: number | null }[];
  results: { tests: { title: string; score: number | null; at: string }[]; lastSemester: { name: string; gpa: number | null; debts: number } | null };
  news: { id: string; title: string; createdAt: string; pinned: boolean }[];
  charts: {
    attendance: { present: number; late: number; excused: number; absent: number };
    weekLoad: number[];
    tests: { title: string; score: number; at: string }[];
    gpaHistory: { name: string; gpa: number | null; cumulative: number }[];
  };
};

const RANGES = SLOTS.map((s) => {
  const [a, b] = s.split("–");
  const m = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5));
  return { start: m(a), end: m(b), from: a, to: b };
});

const MONTHS_LONG = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];

function greeting(h: number) {
  return h < 5 ? "Xayrli tun" : h < 12 ? "Xayrli tong" : h < 18 ? "Xayrli kun" : "Xayrli kech";
}

const scoreTone = (pct: number): Tone => (pct >= 86 ? "green" : pct >= 71 ? "blue" : pct >= 55 ? "amber" : "red");

export function StudentHomePage() {
  const { user } = useApp();
  const nav = useNavigate();
  const parent = user?.role === "parent";
  const q = useApi<Home>("/edu/my/home");
  const d = q.data;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const minutes = now.getHours() * 60 + now.getMinutes();

  // Hozirgi va keyingi dars (bugungi darslar ichidan)
  const lessons = d?.today.lessons ?? [];
  const current = lessons.find((l) => minutes >= RANGES[l.slot].start && minutes < RANGES[l.slot].end);
  const next = lessons.find((l) => RANGES[l.slot].start > minutes);
  const firstName = (parent ? d?.student.name : user?.name)?.split(" ")[0] ?? "";

  const attentionCount = d ? d.attention.openTests.length + d.attention.dueSoon.length + (d.attention.overdue ? 1 : 0) + (d.kpi.debt ? 1 : 0) : 0;

  return (
    <div className="space-y-5 text-ts-fg">
      <div>
        <h1 className="hidden text-xl font-semibold tracking-tight lg:block">
          {greeting(now.getHours())}
          {!parent && firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-sm text-ts-sub lg:mt-0.5">
          {parent && d ? `Farzandingiz: ${d.student.name} · ` : ""}
          {d ? `${d.student.group}${d.group ? ` · ${d.group.direction}, ${d.group.course}-kurs` : ""} · ` : ""}
          {d && d.today.dayIndex >= 0 ? DAYS[d.today.dayIndex] : "Yakshanba"}, {now.getDate()}-{MONTHS_LONG[now.getMonth()]}
        </p>
      </div>

      <QueryState error={q.error} loading={q.loading && !d} onRetry={q.reload}>
        {d && (
          <>
            {/* ── Hozir / keyingi dars ── */}
            <button type="button" onClick={() => nav("/timetable")} className="ts-hero block w-full overflow-hidden rounded-3xl p-5 text-left text-white">
              {current ? (
                <>
                  <div className="flex items-center gap-2 text-xs font-medium text-white/70">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                    Hozir darsda · tugashiga {RANGES[current.slot].end - minutes} daqiqa
                  </div>
                  <LessonHero l={current} />
                </>
              ) : next ? (
                <>
                  <div className="text-xs font-medium text-white/70">
                    Keyingi dars · {RANGES[next.slot].start - minutes < 60 ? `${RANGES[next.slot].start - minutes} daqiqadan so'ng` : `soat ${RANGES[next.slot].from} da`}
                  </div>
                  <LessonHero l={next} />
                </>
              ) : (
                <>
                  <div className="text-xs font-medium text-white/70">{lessons.length ? "Bugungi darslar tugadi" : "Bugun dars yo'q"}</div>
                  {d.today.nextDayFirst ? (
                    <div className="mt-2">
                      <div className="text-lg font-semibold">{d.today.nextDayFirst.subject}</div>
                      <div className="mt-1 text-sm text-white/70">
                        {DAYS[d.today.nextDayFirst.day]}, {RANGES[d.today.nextDayFirst.slot].from} · {d.today.nextDayFirst.room}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-lg font-semibold">Dam oling</div>
                  )}
                </>
              )}
            </button>

            {/* ── Diqqat ── */}
            {attentionCount > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ts-muted">Diqqat</h2>
                {d.attention.openTests.map((t) => (
                  <Attention key={t.id} icon={FileQuestion} tone="blue" title={t.title} text={`${t.questions} savol · ${t.durationMin} daqiqa · ${t.closesAt.replace("T", " ")} gacha`} action={parent ? undefined : "Boshlash"} onClick={() => nav("/tests")} />
                ))}
                {d.attention.dueSoon.map((a) => (
                  <Attention key={a.id} icon={ClipboardList} tone="amber" title={a.title} text={`${a.subject} · muddat ${fmtDateShort(a.due)}`} onClick={() => nav("/lms?tab=assignments")} />
                ))}
                {d.attention.overdue > 0 && <Attention icon={AlertTriangle} tone="red" title={`${d.attention.overdue} ta topshiriq muddati o'tgan`} text="Topshirilmagan" onClick={() => nav("/lms?tab=assignments")} />}
                {d.kpi.debt > 0 && <Attention icon={GraduationCap} tone="red" title={`${d.kpi.debt} ta akademik qarz`} text="Qayta topshirish kerak — kurator bilan bog'laning" onClick={() => nav("/grades")} />}
              </section>
            )}

            {/* ── Ko'rsatkichlar ── */}
            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Kpi icon={GraduationCap} label="GPA" value={d.kpi.gpa ? d.kpi.gpa.toFixed(2) : "—"} hint="Umumiy, 4 ballik" onClick={() => nav("/grades")} />
              <Kpi
                icon={BookOpen}
                label="Joriy ball"
                value={d.kpi.currentPct !== null ? `${d.kpi.currentPct}%` : "—"}
                hint={d.kpi.gradedSubjects ? `${d.kpi.gradedSubjects}/${d.kpi.totalSubjects} fan baholangan` : "Hali baholanmagan"}
                tone={d.kpi.currentPct !== null ? scoreTone(d.kpi.currentPct) : undefined}
                onClick={() => nav("/grades")}
              />
              <Kpi
                icon={d.kpi.absences ? UserX : UserCheck}
                label="Davomat"
                value={d.kpi.attendanceRate !== null ? `${d.kpi.attendanceRate}%` : "—"}
                hint={d.kpi.markedLessons ? `${d.kpi.markedLessons} darsdan · ${d.kpi.absences} qoldirilgan` : "Hali belgilanmagan"}
                tone={d.kpi.attendanceRate === null ? undefined : d.kpi.attendanceRate >= 90 ? "green" : d.kpi.attendanceRate >= 75 ? "amber" : "red"}
                onClick={() => nav("/attendance")}
              />
              <Kpi icon={CheckCircle2} label="Kreditlar" value={`${d.kpi.credits}/${d.kpi.creditsTotal}`} hint="O'zlashtirilgan" progress={(d.kpi.credits / d.kpi.creditsTotal) * 100} onClick={() => nav("/grades")} />
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-4">
                {/* ── Bugungi darslar ── */}
                <Card>
                  <CardHead title="Bugungi darslar" desc={lessons.length ? `${lessons.length} ta dars` : undefined} action={<LinkBtn onClick={() => nav("/timetable")}>Jadval</LinkBtn>} />
                  {lessons.length === 0 ? (
                    <Empty text="Bugun dars yo'q" icon={CalendarDays} />
                  ) : (
                    <div className="space-y-1 p-2">
                      {lessons.map((l) => {
                        const r = RANGES[l.slot];
                        const isNow = l === current;
                        const past = minutes >= r.end;
                        return (
                          <div key={l.slot} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5", isNow && "bg-blue-500/10", past && "opacity-50")}>
                            <div className="w-12 shrink-0 text-xs tabular-nums text-ts-sub">
                              <div className="font-semibold text-ts-fg">{r.from}</div>
                              {r.to}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{l.subject}</div>
                              <div className="truncate text-xs text-ts-sub">
                                {l.type} · {l.teacher}
                              </div>
                            </div>
                            <Pill tone={isNow ? "blue" : "gray"}>
                              <MapPin className="h-3 w-3" /> {l.room}
                            </Pill>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

                <SubjectScoresChart rows={d.subjects} action={<LinkBtn onClick={() => nav("/my-subjects")}>Barchasi</LinkBtn>} />
                <TestScoresChart tests={d.charts.tests} />
              </div>

              <div className="space-y-4">
                <AttendanceChart data={d.charts.attendance} />
                <WeekLoadChart load={d.charts.weekLoad} today={d.today.dayIndex} />
                <GpaHistoryChart rows={d.charts.gpaHistory} />
                {d.results.lastSemester && d.charts.gpaHistory.length < 2 && (
                  <Card>
                    <CardHead title="Oxirgi semestr" />
                    <div className="flex items-center gap-3 p-4">
                      <GraduationCap className="h-4 w-4 shrink-0 text-ts-sub" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{d.results.lastSemester.name}</div>
                        <div className="text-xs text-ts-muted">{d.results.lastSemester.debts ? `${d.results.lastSemester.debts} ta qarz` : "Qarzsiz"}</div>
                      </div>
                      <Pill>{d.results.lastSemester.gpa?.toFixed(2) ?? "—"}</Pill>
                    </div>
                  </Card>
                )}

                {/* ── E'lonlar ── */}
                <Card>
                  <CardHead title="E'lonlar" action={<LinkBtn onClick={() => nav("/news")}>Barchasi</LinkBtn>} />
                  {d.news.length === 0 ? (
                    <Empty text="E'lon yo'q" icon={Megaphone} />
                  ) : (
                    <div className="divide-y divide-ts-line">
                      {d.news.map((n) => (
                        <button key={n.id} type="button" onClick={() => nav("/news")} className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-ts-hover">
                          {n.pinned ? <Pin className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> : <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-ts-sub" />}
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium leading-snug">{n.title}</span>
                            <span className="block text-xs text-ts-muted">{n.createdAt}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </Card>

                {/* ── Qoldirilgan darslar ── */}
                {d.attention.recentAbsences.length > 0 && (
                  <Card>
                    <CardHead title="Qoldirilgan darslar" action={<LinkBtn onClick={() => nav("/attendance")}>Davomat</LinkBtn>} />
                    <div className="space-y-2 p-4">
                      {d.attention.recentAbsences.map((a, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 text-sm">
                          <span className="truncate">{a.subject}</span>
                          <span className="shrink-0 text-xs text-red-500">{fmtDateShort(a.date)}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}

function LessonHero({ l }: { l: Home["today"]["lessons"][number] }) {
  return (
    <div className="mt-2">
      <div className="text-xl font-semibold leading-snug">{l.subject}</div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/80">
        <span className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" /> {RANGES[l.slot].from}–{RANGES[l.slot].to}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4" /> {l.room}
        </span>
        <span className="truncate">{l.teacher}</span>
      </div>
    </div>
  );
}

function Attention({ icon: Icon, tone, title, text, action, onClick }: { icon: typeof Clock; tone: Tone; title: string; text: string; action?: string; onClick: () => void }) {
  const bg = { blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400", amber: "bg-amber-500/10 text-amber-600", red: "bg-red-500/10 text-red-600 dark:text-red-400", green: "bg-emerald-500/10 text-emerald-600", gray: "bg-ts-chip text-ts-sub", violet: "bg-violet-500/10 text-violet-600" }[tone];
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-ts-line bg-ts-card p-3 text-left transition hover:bg-ts-hover">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", bg)}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-ts-sub">{text}</span>
      </span>
      {action ? <span className="shrink-0 rounded-full bg-ts-inv px-3 py-1.5 text-xs font-semibold text-ts-invfg">{action}</span> : <ArrowRight className="h-4 w-4 shrink-0 text-ts-muted" />}
    </button>
  );
}

function Kpi({ icon: Icon, label, value, hint, tone, progress, onClick }: { icon: typeof Clock; label: string; value: string; hint: string; tone?: Tone; progress?: number; onClick: () => void }) {
  const color = tone ? { green: "text-emerald-600 dark:text-emerald-400", blue: "text-blue-600 dark:text-blue-400", amber: "text-amber-600", red: "text-red-600 dark:text-red-400", gray: "", violet: "" }[tone] : "";
  return (
    <button type="button" onClick={onClick} className="flex flex-col rounded-2xl border border-ts-line bg-ts-card p-4 text-left transition hover:bg-ts-hover">
      <span className="flex items-center gap-1.5 text-xs font-medium text-ts-sub">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className={cn("mt-2 text-2xl font-semibold tabular-nums tracking-tight", color)}>{value}</span>
      {progress !== undefined && <Progress value={progress} className="mt-2" />}
      <span className="mt-1 truncate text-xs text-ts-muted">{hint}</span>
    </button>
  );
}

function LinkBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 text-sm font-medium text-ts-sub hover:text-ts-fg">
      {children} <ArrowRight className="h-3.5 w-3.5" />
    </button>
  );
}
