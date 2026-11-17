/**
 * Tashkilot egasi bosh sahifasi — butun tashkilot holati va ega qarorini kutayotgan ishlar.
 * Barcha raqamlar /api/org/overview dan (bazadagi haqiqiy ma'lumot).
 */
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Download,
  GraduationCap,
  KeyRound,
  LifeBuoy,
  MessageSquareWarning,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import { Avatar, Btn, Card, CardHead, Empty, Page, Pill, Progress, QueryState, Stat, Table, Td, fmtDate, type Tone } from "../components/kit";
import { useApi } from "../lib/api";
import { cn, roleLabel } from "../lib/utils";
import { downloadCsv } from "./EducationDashboard";

type Overview = {
  organization: { name: string; slug: string; type: string };
  education: boolean;
  kpi: { students: number; studentsTotal: number; onLeave: number; gpa: number; attendance: number; staff: number; accounts: number; groups: number; faculties: number };
  attention: {
    supportAccess: number;
    dataRequests: number;
    newComplaints: number;
    overdueTasks: number;
    pendingPasswords: number;
    atRiskStudents: number;
    billingOverdue: boolean;
    openTickets: number;
  };
  faculties: { id: string; name: string; dean: string; groups: number; departments: number; students: number; gpa: number; attendance: number; atRisk: number }[];
  complaints: { new: number; review: number; resolved: number; rejected: number };
  tasks: { open: number; overdue: number; done: number };
  members: { byRole: Record<string, number>; suspended: number };
  subscription: { plan: string; planKey: string; seats: number; monthly: number; billing: "paid" | "overdue" | "trial"; paidUntil: string | null; modules: string[] };
  recent: { at: string; actor: string; action: string; object: string; objectId: string; detail: string }[];
};

const MODULE_NAMES: Record<string, string> = {
  education: "Ta'lim",
  finance: "Moliya",
  documents: "Hujjatlar",
  analytics: "Analitika",
  crm: "CRM",
  shop: "Do'kon",
  pharmacy: "Apteka",
  warehouse: "Ombor",
};

const ROLE_ORDER = ["owner", "rector", "dept_head", "advisor", "teacher", "student", "parent"];

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Xayrli tun" : h < 12 ? "Xayrli tong" : h < 18 ? "Xayrli kun" : "Xayrli kech";
}

export function OwnerDashboardPage() {
  const { user } = useApp();
  const nav = useNavigate();
  const q = useApi<Overview>("/org/overview");
  const d = q.data;

  const attention = d
    ? [
        { n: d.attention.supportAccess, tone: "violet" as Tone, icon: KeyRound, title: "Yordam rejimi so'rovi", text: "TIZIMS jamoasi tashkilotingizga kirish uchun ruxsat so'ramoqda", to: "/organization" },
        { n: d.attention.dataRequests, tone: "red" as Tone, icon: ShieldCheck, title: "Ma'lumot so'rovi", text: "Eksport yoki o'chirish tasdig'ingizni kutmoqda", to: "/organization" },
        { n: d.attention.billingOverdue ? 1 : 0, tone: "red" as Tone, icon: CreditCard, title: "To'lov muddati o'tgan", text: "Xizmat to'xtab qolmasligi uchun hisob-fakturani to'lang", to: "/billing" },
        { n: d.attention.newComplaints, tone: "amber" as Tone, icon: MessageSquareWarning, title: "Yangi murojaatlar", text: "Hali ko'rib chiqilmagan shikoyat va murojaatlar", to: "/complaints" },
        { n: d.attention.overdueTasks, tone: "amber" as Tone, icon: CalendarClock, title: "Muddati o'tgan vazifalar", text: "Bajarilmagan va muddati o'tgan topshiriqlar", to: "/tasks/all" },
        { n: d.attention.atRiskStudents, tone: "red" as Tone, icon: AlertTriangle, title: "Yuqori xavfdagi talabalar", text: "Past GPA, davomat yoki akademik qarzdorlik", to: "/insights" },
        { n: d.attention.pendingPasswords, tone: "blue" as Tone, icon: UserPlus, title: "Hali kirmagan akkauntlar", text: "Vaqtinchalik parol bilan hali tizimga kirmagan", to: "/members" },
        { n: d.attention.openTickets, tone: "blue" as Tone, icon: LifeBuoy, title: "TIZIMS yordamidagi so'rovlar", text: "Ochiq texnik so'rovlaringiz", to: "/support" },
      ].filter((a) => a.n > 0)
    : [];

  function exportReport() {
    if (!d) return;
    downloadCsv(`${d.organization.slug}-hisobot-${new Date().toISOString().slice(0, 10)}`, [
      ["Ko'rsatkich", "Qiymat"],
      ["Faol talabalar", d.kpi.students],
      ["Akademik ta'tilda", d.kpi.onLeave],
      ["O'rtacha GPA", d.kpi.gpa],
      ["O'rtacha davomat, %", d.kpi.attendance],
      ["Faol xodimlar", d.kpi.staff],
      ["Yuqori xavfdagi talabalar", d.attention.atRiskStudents],
      ["Yangi murojaatlar", d.complaints.new],
      ["Ochiq vazifalar", d.tasks.open],
      ["Muddati o'tgan vazifalar", d.tasks.overdue],
      [],
      ["Fakultet", "Talabalar", "GPA", "Davomat %", "Yuqori xavf"],
      ...d.faculties.map((f) => [f.name, f.students, f.gpa, f.attendance, f.atRisk]),
    ]);
  }

  return (
    <Page
      title={`${greeting()}, ${user?.name.split(" ")[0] ?? ""}`}
      subtitle={d ? `${d.organization.name} · ${new Date().toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" })}` : undefined}
      actions={
        <>
          {d?.education && (
            <Btn onClick={() => nav("/analytics")}>
              <BarChart3 className="h-4 w-4" /> Ta'lim analitikasi
            </Btn>
          )}
          <Btn onClick={exportReport} disabled={!d}>
            <Download className="h-4 w-4" /> Hisobot
          </Btn>
          <Btn variant="primary" onClick={() => nav("/members")}>
            <UserPlus className="h-4 w-4" /> Foydalanuvchi qo'shish
          </Btn>
        </>
      }
    >
      <QueryState error={q.error} loading={q.loading && !d} onRetry={q.reload}>
        {d && (
          <>
            {/* ── Asosiy ko'rsatkichlar ── */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {d.education ? (
                <>
                  <Stat label="Faol talabalar" value={d.kpi.students.toLocaleString("ru-RU")} hint={`${d.kpi.groups} guruh · ${d.kpi.faculties} fakultet · ${d.kpi.onLeave} ta akademik ta'tilda`} icon={GraduationCap} />
                  <Stat label="O'rtacha GPA" value={d.kpi.gpa.toFixed(2)} delta={d.kpi.gpa >= 3.5 ? "Yaxshi" : d.kpi.gpa >= 3 ? "O'rtacha" : "Past"} tone={d.kpi.gpa >= 3.5 ? "green" : d.kpi.gpa >= 3 ? "amber" : "red"} hint="Faol talabalar bo'yicha" icon={BarChart3} />
                  <Stat label="O'rtacha davomat" value={`${d.kpi.attendance}%`} delta={d.kpi.attendance >= 90 ? "Yaxshi" : d.kpi.attendance >= 80 ? "Diqqat" : "Past"} tone={d.kpi.attendance >= 90 ? "green" : d.kpi.attendance >= 80 ? "amber" : "red"} hint="Semestr boshidan" icon={UserCheck} />
                </>
              ) : (
                <Stat label="Ta'lim moduli" value="O'chiq" hint="Tarifingizda yoqilmagan" icon={GraduationCap} />
              )}
              <Stat label="Faol xodimlar" value={d.kpi.staff} hint={`Jami ${d.kpi.accounts} ta tizim akkaunti`} icon={Users} />
            </div>

            {/* ── Qaror kutayotganlar ── */}
            <Card>
              <CardHead title="Sizning qaroringiz kerak" desc={attention.length ? `${attention.length} ta yo'nalish bo'yicha diqqat talab qilinadi` : "Hammasi joyida — kutilayotgan ish yo'q"} />
              <div className="p-4">
                {attention.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> Tasdiq kutayotgan so'rov, yangi murojaat yoki muddati o'tgan vazifa yo'q.
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {attention.map((a) => (
                      <button key={a.title} type="button" onClick={() => nav(a.to)} className="group flex items-start gap-3 rounded-md border border-ts-line p-3 text-left transition hover:bg-ts-hover">
                        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", toneBg(a.tone))}>
                          <a.icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="text-lg font-semibold tabular-nums">{a.n}</span>
                            <span className="truncate text-sm font-medium">{a.title}</span>
                          </span>
                          <span className="block text-xs text-ts-sub">{a.text}</span>
                        </span>
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ts-muted opacity-0 transition group-hover:opacity-100" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              {/* ── Fakultetlar ── */}
              {d.education ? (
                <Card className="overflow-hidden">
                  <CardHead title="Fakultetlar kesimida" desc="Faol talabalar bo'yicha o'zlashtirish va davomat" action={<Btn size="sm" variant="ghost" onClick={() => nav("/structure")}>Tuzilma <ArrowRight className="h-3.5 w-3.5" /></Btn>} className="pb-4" />
                  {d.faculties.length === 0 ? (
                    <Empty text="Fakultet kiritilmagan" />
                  ) : (
                    <Table head={["Fakultet", "Talabalar", "GPA", "Davomat", "Yuqori xavf"]} minWidth={640}>
                      {d.faculties.map((f) => (
                        <tr key={f.id}>
                          <Td>
                            <div className="font-medium">{f.name}</div>
                            <div className="text-xs text-ts-sub">
                              {f.dean} · {f.groups} guruh · {f.departments} kafedra
                            </div>
                          </Td>
                          <Td className="tabular-nums">{f.students}</Td>
                          <Td className="tabular-nums">{f.students ? f.gpa.toFixed(2) : "—"}</Td>
                          <Td className="w-40">
                            {f.students ? (
                              <div className="flex items-center gap-2">
                                <Progress value={f.attendance} tone={f.attendance < 80 ? "red" : f.attendance < 90 ? "amber" : "green"} />
                                <span className="w-9 text-xs tabular-nums text-ts-sub">{f.attendance}%</span>
                              </div>
                            ) : (
                              "—"
                            )}
                          </Td>
                          <Td>{f.atRisk ? <Pill tone="red">{f.atRisk} ta</Pill> : <span className="text-ts-muted">—</span>}</Td>
                        </tr>
                      ))}
                    </Table>
                  )}
                </Card>
              ) : (
                <Card className="p-4 text-sm text-ts-sub">Ta'lim moduli yoqilmagan. Yoqish uchun "Obuna va to'lovlar" bo'limidan tarifni o'zgartirishni so'rang.</Card>
              )}

              {/* ── Obuna ── */}
              <Card>
                <CardHead title="Obuna" action={<Btn size="sm" variant="ghost" onClick={() => nav("/billing")}>Batafsil <ArrowRight className="h-3.5 w-3.5" /></Btn>} />
                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">{d.subscription.plan}</span>
                    <Pill tone={d.subscription.billing === "paid" ? "green" : d.subscription.billing === "trial" ? "blue" : "red"} dot>
                      {d.subscription.billing === "paid" ? "To'langan" : d.subscription.billing === "trial" ? "Sinov" : "Qarzdorlik"}
                    </Pill>
                  </div>
                  <Row k="Litsenziya o'rinlari" v={d.subscription.seats.toLocaleString("ru-RU")} />
                  <Row k="Faol akkauntlar" v={String(d.kpi.accounts)} />
                  <Row k="Oylik to'lov" v={d.subscription.billing === "trial" ? "Sinov muddati" : `${d.subscription.monthly.toLocaleString("ru-RU")} so'm`} />
                  <Row k="To'langan muddat" v={d.subscription.paidUntil ? fmtDate(d.subscription.paidUntil) : "—"} />
                  <div>
                    <div className="mb-1.5 text-xs text-ts-sub">Yoqilgan modullar</div>
                    <div className="flex flex-wrap gap-1.5">
                      {d.subscription.modules.map((m) => (
                        <Pill key={m}>{MODULE_NAMES[m] ?? m}</Pill>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {/* ── Murojaatlar va vazifalar ── */}
              <Card>
                <CardHead title="Murojaatlar va vazifalar" />
                <div className="space-y-4 p-4">
                  {d.education && (
                    <Distribution
                      title="Murojaatlar"
                      to="/complaints"
                      onNav={nav}
                      parts={[
                        { label: "Yangi", n: d.complaints.new, tone: "blue" },
                        { label: "Jarayonda", n: d.complaints.review, tone: "amber" },
                        { label: "Hal qilingan", n: d.complaints.resolved, tone: "green" },
                        { label: "Rad etilgan", n: d.complaints.rejected, tone: "gray" },
                      ]}
                    />
                  )}
                  <Distribution
                    title="Vazifalar"
                    to="/tasks/all"
                    onNav={nav}
                    parts={[
                      { label: "Muddati o'tgan", n: d.tasks.overdue, tone: "red" },
                      { label: "Jarayonda", n: d.tasks.open - d.tasks.overdue, tone: "blue" },
                      { label: "Bajarilgan", n: d.tasks.done, tone: "green" },
                    ]}
                  />
                </div>
              </Card>

              {/* ── Xodimlar tarkibi ── */}
              <Card>
                <CardHead title="Akkauntlar tarkibi" action={<Btn size="sm" variant="ghost" onClick={() => nav("/members")}>Boshqarish <ArrowRight className="h-3.5 w-3.5" /></Btn>} />
                <div className="space-y-2.5 p-4">
                  {ROLE_ORDER.filter((r) => d.members.byRole[r]).map((r) => {
                    const n = d.members.byRole[r];
                    const max = Math.max(...Object.values(d.members.byRole));
                    return (
                      <div key={r} className="grid grid-cols-[130px_minmax(0,1fr)_32px] items-center gap-2 text-sm">
                        <span className="truncate">{roleLabel(r).replace(" (Advisor)", "")}</span>
                        <Progress value={(n / max) * 100} />
                        <span className="text-right tabular-nums text-ts-sub">{n}</span>
                      </div>
                    );
                  })}
                  {d.members.suspended > 0 && <div className="pt-1 text-xs text-ts-sub">{d.members.suspended} ta akkaunt to'xtatilgan</div>}
                </div>
              </Card>

              {/* ── So'nggi faollik ── */}
              <Card>
                <CardHead title="So'nggi o'zgarishlar" action={<Btn size="sm" variant="ghost" onClick={() => nav("/audit")}>Audit <ArrowRight className="h-3.5 w-3.5" /></Btn>} />
                <div className="space-y-1 p-2">
                  {d.recent.length === 0 && <Empty text="Hozircha yozuv yo'q" icon={ClipboardList} />}
                  {d.recent.map((a, i) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-md px-2 py-1.5">
                      <Avatar name={a.actor} size={26} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">
                          <span className="font-medium">{a.actor}</span> <span className="text-ts-sub">· {a.action.toLowerCase()} · {a.object}</span>
                        </div>
                        <div className="truncate text-xs text-ts-muted">
                          {a.at}
                          {a.detail && ` · ${a.detail}`}
                        </div>
                      </div>
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

function toneBg(t: Tone) {
  return {
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    red: "bg-red-500/10 text-red-600 dark:text-red-400",
    gray: "bg-ts-chip text-ts-sub",
    violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  }[t];
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-ts-sub">{k}</span>
      <span className="font-medium tabular-nums">{v}</span>
    </div>
  );
}

const BAR: Record<Tone, string> = { blue: "bg-blue-500", green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", gray: "bg-ts-muted", violet: "bg-violet-500" };

function Distribution({ title, parts, to, onNav }: { title: string; parts: { label: string; n: number; tone: Tone }[]; to: string; onNav: (to: string) => void }) {
  const total = parts.reduce((a, p) => a + p.n, 0);
  return (
    <button type="button" onClick={() => onNav(to)} className="block w-full text-left">
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="font-medium">{title}</span>
        <span className="tabular-nums text-ts-sub">{total}</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-ts-track">
        {parts.map((p) => (p.n > 0 ? <div key={p.label} className={BAR[p.tone]} style={{ width: `${(p.n / (total || 1)) * 100}%` }} /> : null))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ts-sub">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", BAR[p.tone])} />
            {p.label} {p.n}
          </span>
        ))}
      </div>
    </button>
  );
}
