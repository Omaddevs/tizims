/**
 * Talabalar analitikasi — mavjud kontingent sifati (qabul to'xtatilgan holat uchun).
 * Barcha raqamlar /api/edu/analytics dan; dekan uchun — o'z fakulteti.
 */
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, BookOpen, CalendarCheck, Download, GraduationCap, UserCheck, Users } from "lucide-react";
import { useApp } from "../../store/AppContext";
import { Avatar, Btn, Card, CardHead, Empty, Page, Pill, Progress, QueryState, ScopeNote, Stat, Table, Td, fmtDate, type Tone } from "../../components/kit";
import { useApi } from "../../lib/api";
import { cn } from "../../lib/utils";
import { downloadCsv } from "../EducationDashboard";

type Bucket = { label: string; n: number };
type Analytics = {
  scope: "faculty" | "organization";
  kpi: { active: number; total: number; gpa: number; attendance: number; debtors: number; atRisk: number };
  gpaBuckets: Bucket[];
  attendanceBuckets: Bucket[];
  status: { active: number; leave: number; expelled: number; graduated: number };
  funding: { grant: number; contract: number };
  groups: { id: string; direction: string; course: number; students: number; gpa: number; attendance: number; debtors: number; atRisk: number }[];
  subjects: { code: string; name: string; teacher: string; graded: number; avg: number; failing: number; excellent: number }[];
  atRisk: { id: string; name: string; group: string; gpa: number; attendance: number; debt: number; risk: "high" | "medium"; reasons: string[] }[];
  marked: { total: number; present: number; late: number; excused: number; absent: number; days: { date: string; rate: number; total: number }[] };
  goals: { key: string; title: string; subtitle: string; value: number }[];
};

const BUCKET_TONES = ["bg-red-500", "bg-amber-500", "bg-blue-500", "bg-emerald-500"];

export function StudentAnalyticsPage() {
  const { organization } = useApp();
  const nav = useNavigate();
  const q = useApi<Analytics>("/edu/analytics");
  const d = q.data;

  function exportCsv() {
    if (!d) return;
    downloadCsv(`talabalar-analitikasi-${new Date().toISOString().slice(0, 10)}`, [
      ["Guruh", "Yo'nalish", "Kurs", "Faol talabalar", "GPA", "Davomat %", "Qarzdorlar", "Yuqori xavf"],
      ...d.groups.map((g) => [g.id, g.direction, g.course, g.students, g.gpa, g.attendance, g.debtors, g.atRisk]),
      [],
      ["Fan", "O'qituvchi", "Baholangan", "O'rtacha (100)", "Qoniqarsiz", "A'lo"],
      ...d.subjects.map((x) => [x.name, x.teacher, x.graded, x.avg, x.failing, x.excellent]),
      [],
      ["Xavf ostidagi talaba", "Guruh", "GPA", "Davomat %", "Qarz", "Sabab"],
      ...d.atRisk.map((s) => [s.name, s.group, s.gpa, s.attendance, s.debt, s.reasons.join("; ")]),
    ]);
  }

  return (
    <Page
      title="Talabalar analitikasi"
      subtitle={d ? `${d.scope === "faculty" ? "Fakultetingiz" : organization?.name} · mavjud kontingent sifati` : undefined}
      actions={
        <>
          <Btn onClick={() => nav("/people")}>
            <Users className="h-4 w-4" /> Talabalar ro'yxati
          </Btn>
          <Btn onClick={exportCsv} disabled={!d}>
            <Download className="h-4 w-4" /> CSV
          </Btn>
        </>
      }
    >
      <QueryState error={q.error} loading={q.loading && !d} onRetry={q.reload}>
        {d && (
          <>
            {/* ── Ko'rsatkichlar ── */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Faol talabalar" value={d.kpi.active} hint={`Jami ro'yxatda ${d.kpi.total} · grant ${d.funding.grant}, kontrakt ${d.funding.contract}`} icon={Users} />
              <Stat label="O'rtacha GPA" value={d.kpi.gpa.toFixed(2)} delta={d.kpi.gpa >= 3.5 ? "Yaxshi" : d.kpi.gpa >= 3 ? "O'rtacha" : "Past"} tone={d.kpi.gpa >= 3.5 ? "green" : d.kpi.gpa >= 3 ? "amber" : "red"} icon={GraduationCap} />
              <Stat label="O'rtacha davomat" value={`${d.kpi.attendance}%`} delta={d.kpi.attendance >= 90 ? "Yaxshi" : d.kpi.attendance >= 80 ? "Diqqat" : "Past"} tone={d.kpi.attendance >= 90 ? "green" : d.kpi.attendance >= 80 ? "amber" : "red"} icon={UserCheck} />
              <Stat label="Akademik qarzdorlar" value={d.kpi.debtors} delta={d.kpi.atRisk ? `${d.kpi.atRisk} yuqori xavf` : undefined} tone="red" hint={`${pct(d.kpi.debtors, d.kpi.active)}% faol talabalar`} icon={AlertTriangle} />
            </div>

            {/* ── Taqsimotlar ── */}
            <div className="grid gap-4 xl:grid-cols-3">
              <Card>
                <CardHead title="O'zlashtirish taqsimoti" desc="GPA oraliqlari bo'yicha" />
                <Histogram buckets={d.gpaBuckets} />
              </Card>
              <Card>
                <CardHead title="Davomat taqsimoti" desc="Semestr davomati bo'yicha" />
                <Histogram buckets={d.attendanceBuckets} />
              </Card>
              <Card>
                <CardHead title="Kontingent tarkibi" desc="Holat va ta'lim shakli" />
                <div className="space-y-4 p-4">
                  <Split
                    parts={[
                      { label: "Faol", n: d.status.active, tone: "green" },
                      { label: "Akademik ta'til", n: d.status.leave, tone: "amber" },
                      { label: "Chetlashtirilgan", n: d.status.expelled, tone: "red" },
                      { label: "Bitirgan", n: d.status.graduated, tone: "gray" },
                    ]}
                  />
                  <Split
                    parts={[
                      { label: "Grant", n: d.funding.grant, tone: "blue" },
                      { label: "Kontrakt", n: d.funding.contract, tone: "violet" },
                    ]}
                  />
                  <ScopeNote>Qabul to'xtatilgan — kontingent faqat akademik ta'til, chetlashtirish va bitirish hisobiga o'zgaradi. Har bir talabani saqlab qolish muhim.</ScopeNote>
                </div>
              </Card>
            </div>

            {/* ── Guruhlar reytingi ── */}
            <Card className="overflow-hidden">
              <CardHead title="Guruhlar reytingi" desc="Faol talabalar bo'yicha · guruh sahifasini ochish uchun bosing" className="pb-4" />
              {d.groups.length === 0 ? (
                <Empty text="Guruh yo'q" />
              ) : (
                <Table head={["#", "Guruh", "Talabalar", "GPA", "Davomat", "Qarzdorlar", "Yuqori xavf"]} minWidth={760}>
                  {d.groups.map((g, i) => (
                    <tr key={g.id} onClick={() => nav(`/academic/groups/${g.id}`)} className="cursor-pointer transition hover:bg-ts-hover">
                      <Td className="w-10 text-ts-muted">{i + 1}</Td>
                      <Td>
                        <div className="font-medium">{g.id}</div>
                        <div className="text-xs text-ts-sub">
                          {g.direction} · {g.course}-kurs
                        </div>
                      </Td>
                      <Td className="tabular-nums">{g.students}</Td>
                      <Td className="w-40">
                        <div className="flex items-center gap-2">
                          <Progress value={(g.gpa / 4) * 100} tone={g.gpa >= 3.5 ? "green" : g.gpa >= 3 ? "blue" : "amber"} />
                          <span className="w-9 text-xs tabular-nums">{g.students ? g.gpa.toFixed(2) : "—"}</span>
                        </div>
                      </Td>
                      <Td className="w-40">
                        <div className="flex items-center gap-2">
                          <Progress value={g.attendance} tone={g.attendance < 80 ? "red" : g.attendance < 90 ? "amber" : "green"} />
                          <span className="w-9 text-xs tabular-nums">{g.students ? `${g.attendance}%` : "—"}</span>
                        </div>
                      </Td>
                      <Td>{g.debtors ? <Pill tone="amber">{g.debtors}</Pill> : <span className="text-ts-muted">—</span>}</Td>
                      <Td>{g.atRisk ? <Pill tone="red">{g.atRisk}</Pill> : <span className="text-ts-muted">—</span>}</Td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              {/* ── Fanlar ── */}
              <Card className="overflow-hidden">
                <CardHead title="Fanlar bo'yicha o'zlashtirish" desc="Joriy va oraliq natijalardan 100 ballik taxmin · eng zaifi yuqorida" className="pb-4" />
                {d.subjects.length === 0 ? (
                  <Empty text="O'qituvchilar baho kiritgach chiqadi" icon={BookOpen} />
                ) : (
                  <Table head={["Fan", "O'rtacha", "Qoniqarsiz", "A'lo"]} minWidth={520}>
                    {d.subjects.map((x) => (
                      <tr key={x.code}>
                        <Td>
                          <div className="font-medium">{x.name}</div>
                          <div className="text-xs text-ts-sub">
                            {x.teacher} · {x.graded} talaba
                          </div>
                        </Td>
                        <Td className="w-36">
                          <div className="flex items-center gap-2">
                            <Progress value={x.avg} tone={x.avg < 55 ? "red" : x.avg < 71 ? "amber" : "green"} />
                            <span className="w-8 text-xs tabular-nums">{x.avg}</span>
                          </div>
                        </Td>
                        <Td>{x.failing ? <Pill tone="red">{x.failing}</Pill> : <span className="text-ts-muted">0</span>}</Td>
                        <Td className="tabular-nums text-ts-sub">{x.excellent}</Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </Card>

              {/* ── Xavf ostidagilar ── */}
              <Card>
                <CardHead title="Xavf ostidagi talabalar" desc="Chetlashish xavfi — erta aralashuv kerak" action={<Btn size="sm" variant="ghost" onClick={() => nav("/insights")}>AI tahlil <ArrowRight className="h-3.5 w-3.5" /></Btn>} />
                <div className="divide-y divide-ts-line">
                  {d.atRisk.length === 0 && <Empty text="Xavf ostidagi talaba yo'q" />}
                  {d.atRisk.map((s) => (
                    <button key={s.id} type="button" onClick={() => nav(`/people/${s.id}`)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-ts-hover">
                      <Avatar name={s.name} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{s.name}</span>
                        <span className="block truncate text-xs text-ts-sub">
                          {s.group} · {s.reasons.join(" · ")}
                        </span>
                      </span>
                      <Pill tone={s.risk === "high" ? "red" : "amber"}>{s.risk === "high" ? "Yuqori" : "O'rta"}</Pill>
                    </button>
                  ))}
                </div>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              {/* ── Belgilangan davomat ── */}
              <Card>
                <CardHead title="O'qituvchilar belgilagan davomat" desc={d.marked.total ? `Tizimda ${d.marked.total} ta yozuv · kunlik qatnashish foizi` : "Tizimdagi haqiqiy yozuvlar"} />
                {d.marked.total === 0 ? (
                  <Empty text="O'qituvchilar 'Davomat belgilash' orqali belgilagach, dinamika shu yerda chiqadi" icon={CalendarCheck} />
                ) : (
                  <div className="p-4">
                    <div className="flex h-40 items-end gap-2">
                      {d.marked.days.map((x) => (
                        <div key={x.date} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${fmtDate(x.date)}: ${x.rate}% (${x.total} ta belgi)`}>
                          <span className="text-[11px] tabular-nums text-ts-sub">{x.rate}%</span>
                          <div className={cn("w-full max-w-[48px] rounded-t-md", x.rate < 80 ? "bg-amber-500" : "bg-ts-blue3")} style={{ height: `${Math.max(6, x.rate)}%` }} />
                          <span className="text-[10px] text-ts-muted">{x.date.slice(8)}.{x.date.slice(5, 7)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Pill tone="green" dot>
                        Keldi {d.marked.present}
                      </Pill>
                      <Pill tone="amber" dot>
                        Kechikdi {d.marked.late}
                      </Pill>
                      <Pill tone="blue" dot>
                        Sababli {d.marked.excused}
                      </Pill>
                      <Pill tone="red" dot>
                        Kelmadi {d.marked.absent}
                      </Pill>
                    </div>
                  </div>
                )}
              </Card>

              {/* ── Semestr maqsadlari ── */}
              <Card>
                <CardHead title="Semestr maqsadlari" desc="Haqiqiy ulushlar" />
                <div className="space-y-4 p-4">
                  {d.goals.map((g) => (
                    <div key={g.key}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">{g.title}</span>
                        <span className="text-sm tabular-nums">{g.value}%</span>
                      </div>
                      <Progress value={g.value} tone={g.value >= 80 ? "green" : g.value >= 60 ? "blue" : "amber"} />
                      <div className="mt-1 text-xs text-ts-muted">{g.subtitle}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </>
        )}
      </QueryState>
    </Page>
  );
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

function Histogram({ buckets }: { buckets: Bucket[] }) {
  const total = buckets.reduce((a, b) => a + b.n, 0);
  const max = Math.max(1, ...buckets.map((b) => b.n));
  return (
    <div className="p-4">
      <div className="flex h-36 items-end gap-3">
        {buckets.map((b, i) => (
          <div key={b.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-xs font-medium tabular-nums">{b.n}</span>
            <div className={cn("w-full rounded-t-md opacity-85", BUCKET_TONES[i])} style={{ height: `${Math.max(4, (b.n / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3">
        {buckets.map((b) => (
          <div key={b.label} className="flex-1 text-center">
            <div className="text-[11px] text-ts-sub">{b.label}</div>
            <div className="text-[11px] tabular-nums text-ts-muted">{pct(b.n, total)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const SPLIT_BG: Record<Tone, string> = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", gray: "bg-ts-muted", blue: "bg-blue-500", violet: "bg-violet-500" };

function Split({ parts }: { parts: { label: string; n: number; tone: Tone }[] }) {
  const total = parts.reduce((a, p) => a + p.n, 0);
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-ts-track">
        {parts.map((p) => (p.n ? <div key={p.label} className={SPLIT_BG[p.tone]} style={{ width: `${(p.n / (total || 1)) * 100}%` }} /> : null))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ts-sub">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", SPLIT_BG[p.tone])} />
            {p.label} <span className="tabular-nums text-ts-fg">{p.n}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
