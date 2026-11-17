/** Talaba / ota-ona: fanlar, mas'ul o'qituvchilar, kurator, haftalik darslar va joriy ballar */
import { BookOpen, CalendarDays, GraduationCap, Mail, UserRound, Users } from "lucide-react";
import { Avatar, Card, CardHead, Empty, Page, Pill, Progress, QueryState, ScopeNote, Stat } from "../../components/kit";
import { useApi } from "../../lib/api";
import { DAYS_SHORT, SLOTS } from "../../data/academic";
import { useScope } from "./scope";

type MySubjects = {
  student: { id: string; name: string; group: string };
  group: { id: string; direction: string; course: number } | null;
  faculty: { name: string; dean: string } | null;
  curator: { name: string; email: string | null } | null;
  subjects: {
    code: string;
    name: string;
    credits: number;
    hours: number;
    progress: number;
    teacher: { id: string; name: string; email: string | null; degree: string | null; department: string | null };
    grades: { jn: number; on: number; yn: number | null } | null;
    lessons: { day: number; slot: number; room: string; type: string }[];
  }[];
};

export function MySubjectsPage() {
  const s = useScope("mySubjects");
  const q = useApi<MySubjects>("/edu/my/subjects");
  const d = q.data;
  const credits = d?.subjects.reduce((a, x) => a + x.credits, 0) ?? 0;
  const teachers = d ? new Set(d.subjects.map((x) => x.teacher.id)).size : 0;
  const perWeek = d?.subjects.reduce((a, x) => a + x.lessons.length, 0) ?? 0;

  return (
    <Page title={s.title} subtitle={s.description}>
      {s.isParent && d && <ScopeNote>Farzandingiz {d.student.name} — {d.student.group} guruhi fanlari va o'qituvchilari.</ScopeNote>}
      <QueryState error={q.error} loading={q.loading && !d} onRetry={q.reload}>
        {d && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Fanlar" value={d.subjects.length} hint={`${credits} kredit`} icon={BookOpen} />
              <Stat label="O'qituvchilar" value={teachers} icon={UserRound} />
              <Stat label="Haftalik darslar" value={perWeek} hint={`${perWeek * 2} akademik soat`} icon={CalendarDays} />
              <Stat label="Guruh" value={d.student.group} hint={d.group ? `${d.group.direction} · ${d.group.course}-kurs` : undefined} icon={Users} />
            </div>

            <Card>
              <CardHead title="Mas'ul shaxslar" desc="Savol yoki muammo bo'lsa — shu kishilarga murojaat qiling" />
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                {d.curator && (
                  <Contact role="Guruh kuratori" name={d.curator.name} email={d.curator.email} hint="Davomat, intizom, umumiy masalalar" />
                )}
                {d.faculty && <Contact role="Fakultet dekani" name={d.faculty.dean} email={null} hint={d.faculty.name} />}
              </div>
            </Card>

            {d.subjects.length === 0 ? (
              <Card>
                <Empty text="Guruhingizga hali fan biriktirilmagan" icon={GraduationCap} />
              </Card>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {d.subjects.map((x) => {
                  const cur = x.grades ? x.grades.jn + x.grades.on : null;
                  return (
                    <Card key={x.code} className="flex flex-col">
                      <div className="flex items-start justify-between gap-3 p-4 pb-3">
                        <div className="min-w-0">
                          <div className="text-base font-medium">{x.name}</div>
                          <div className="text-xs text-ts-sub">
                            {x.code} · {x.credits} kredit · {x.hours} soat
                          </div>
                        </div>
                        {cur !== null ? (
                          <div className="text-right">
                            <div className="text-lg font-semibold tabular-nums">{cur + (x.grades?.yn ?? 0)}</div>
                            <div className="text-[11px] text-ts-muted">{x.grades?.yn === null ? "joriy ball / 50" : "jami / 100"}</div>
                          </div>
                        ) : (
                          <Pill>Baholanmagan</Pill>
                        )}
                      </div>
                      <div className="px-4">
                        <div className="mb-1 flex justify-between text-xs text-ts-sub">
                          <span>Kurs o'tilishi</span>
                          <span className="tabular-nums">{x.progress}%</span>
                        </div>
                        <Progress value={x.progress} />
                      </div>
                      <div className="mt-3 flex items-center gap-3 border-t border-ts-line px-4 py-3">
                        <Avatar name={x.teacher.name} size={34} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{x.teacher.name}</div>
                          <div className="truncate text-xs text-ts-sub">{[x.teacher.degree, x.teacher.department].filter(Boolean).join(" · ") || "Mas'ul o'qituvchi"}</div>
                        </div>
                        {x.teacher.email && (
                          <a href={`mailto:${x.teacher.email}`} className="flex items-center gap-1 rounded-md border border-ts-line2 px-2.5 py-1 text-xs font-medium hover:bg-ts-hover">
                            <Mail className="h-3.5 w-3.5" /> Yozish
                          </a>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 border-t border-ts-line px-4 py-3">
                        {x.lessons.length === 0 ? (
                          <span className="text-xs text-ts-muted">Jadvalda dars yo'q</span>
                        ) : (
                          x.lessons.map((l, i) => (
                            <Pill key={i}>
                              {DAYS_SHORT[l.day]} {SLOTS[l.slot].slice(0, 5)} · {l.room} · {l.type}
                            </Pill>
                          ))
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </QueryState>
    </Page>
  );
}

function Contact({ role, name, email, hint }: { role: string; name: string; email: string | null; hint: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-ts-line p-3">
      <Avatar name={name} size={38} />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-ts-sub">{role}</div>
        <div className="truncate font-medium">{name}</div>
        <div className="truncate text-xs text-ts-muted">{hint}</div>
      </div>
      {email && (
        <a href={`mailto:${email}`} className="rounded-md border border-ts-line2 p-2 hover:bg-ts-hover" title={email}>
          <Mail className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}
