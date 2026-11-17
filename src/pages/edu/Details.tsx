/** Batafsil ko'rinishlar: talaba kartasi, guruh, fakultet. Ma'lumot serverdan, rol doirasi serverda tekshiriladi. */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowRight, BookOpen, CalendarDays, GraduationCap, Landmark, Layers, ShieldAlert, UserCheck, Users } from "lucide-react";
import { useApp } from "../../store/AppContext";
import { Avatar, Btn, Card, CardHead, DetailHeader, Empty, KeyValues, Pill, Progress, QueryState, SelectBox, Stat, Table, Tabs, Td, Timeline, fmtDate, useToast, type Tone } from "../../components/kit";
import { api, errorText, useApi } from "../../lib/api";
import { cn, roleLabel } from "../../lib/utils";
import { accessOf } from "../../core/features";
import { ATTENDANCE_LABEL, DAYS, SLOTS, STUDENT_STATUS_LABEL, subjectByCode, toMark, type AttendanceMark, type Faculty, type Group, type Lesson, type Student, type StudentStatus } from "../../data/academic";

type Risk = "high" | "medium" | "low";
const RISK: Record<Risk, { label: string; tone: Tone }> = { high: { label: "Yuqori xavf", tone: "red" }, medium: { label: "O'rta xavf", tone: "amber" }, low: { label: "Xavf past", tone: "green" } };
const STATUS_TONE: Record<StudentStatus, Tone> = { active: "green", leave: "amber", expelled: "red", graduated: "gray" };
const MARK_TONE: Record<AttendanceMark, Tone> = { present: "green", late: "amber", excused: "blue", absent: "red" };
const ACTION_TEXT: Record<string, string> = { CREATE: "Yaratildi", UPDATE: "O'zgartirildi", SUSPEND: "To'xtatildi", ACTIVATE: "Tiklandi" };

function LinkCell({ to, children }: { to?: string; children: React.ReactNode }) {
  const nav = useNavigate();
  if (!to) return <>{children}</>;
  return (
    <button type="button" onClick={() => nav(to)} className="text-left font-medium hover:underline">
      {children}
    </button>
  );
}

/* ═════════════════ Talaba kartasi ═════════════════ */

type StudentDetail = {
  student: Student;
  group: { id: string; direction: string; course: number; curator: string } | null;
  faculty: { id: string; name: string; dean: string } | null;
  risk: Risk;
  subjects: { code: string; name: string; credits: number; teacher: string; jn: number | null; on: number | null; yn: number | null }[];
  attendance: { date: string; subject: string; mark: AttendanceMark }[];
  accounts: { id: string; name: string; email: string; role: string; status: string; lastLoginAt: string | null }[];
  history: { at: string; by: string; action: string; from: string | null; to: string | null }[];
  semesters: { semesterId: string; name: string; gpa: number | null; cumulativeGpa: number; creditsPassed: number; newDebts: number; subjects: { name: string; total: number | null; mark: number | null; passed: boolean; reason?: string }[] }[];
};

export function StudentDetailPage() {
  const { id = "" } = useParams();
  const { user, can } = useApp();
  const nav = useNavigate();
  const [toast, showToast] = useToast();
  const q = useApi<StudentDetail>(`/edu/students/${encodeURIComponent(id)}`);
  const [tab, setTab] = useState<"overview" | "grades" | "semesters" | "attendance" | "history">("overview");
  const d = q.data;
  const canManage = accessOf(user?.role, "people") === "manage" && can("edu.students.manage");
  const canAcademic = !!accessOf(user?.role, "academic");

  async function setStatus(status: StudentStatus) {
    if (!d) return;
    if (status === "expelled" && !window.confirm(`${d.student.name} chetlashtirilsinmi? Bu amal audit logga yoziladi.`)) return;
    try {
      const st = await api<Student>(`/edu/students/${d.student.id}`, { method: "PATCH", body: { status } });
      q.setData({ ...d, student: st, history: [{ at: "Hozir", by: user?.name ?? "", action: "UPDATE", from: d.student.status, to: status }, ...d.history] });
      showToast(`Holat: ${STUDENT_STATUS_LABEL[status]}`);
    } catch (e) {
      showToast(errorText(e));
    }
  }

  return (
    <div className="space-y-4 text-ts-fg">
      <QueryState error={q.error} loading={q.loading && !d} onRetry={q.reload}>
        {d && (
          <>
            <DetailHeader
              back="/people"
              backLabel="Talabalar"
              media={<Avatar name={d.student.name} size={56} />}
              title={d.student.name}
              subtitle={
                <>
                  {d.student.id} · {d.student.group}
                  {d.group && ` · ${d.group.direction}, ${d.group.course}-kurs`}
                </>
              }
              badges={
                <>
                  <Pill tone={STATUS_TONE[d.student.status]} dot>
                    {STUDENT_STATUS_LABEL[d.student.status]}
                  </Pill>
                  <Pill>{d.student.funding}</Pill>
                  <Pill tone={RISK[d.risk].tone}>{RISK[d.risk].label}</Pill>
                </>
              }
              actions={
                <>
                  {canAcademic && d.group && (
                    <Btn onClick={() => nav(`/academic/groups/${d.group!.id}`)}>
                      <Users className="h-4 w-4" /> Guruh
                    </Btn>
                  )}
                  {canManage && (
                    <SelectBox className="h-8 w-auto" value={d.student.status} onChange={(e) => void setStatus(e.target.value as StudentStatus)}>
                      {(Object.keys(STUDENT_STATUS_LABEL) as StudentStatus[]).map((k) => (
                        <option key={k} value={k}>
                          {STUDENT_STATUS_LABEL[k]}
                        </option>
                      ))}
                    </SelectBox>
                  )}
                </>
              }
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="GPA" value={d.student.gpa ? d.student.gpa.toFixed(2) : "—"} tone={d.student.gpa >= 3.5 ? "green" : d.student.gpa >= 3 ? "amber" : "red"} delta={d.student.gpa ? (d.student.gpa >= 3.5 ? "Yaxshi" : d.student.gpa >= 3 ? "O'rtacha" : "Past") : undefined} icon={GraduationCap} />
              <Stat label="Semestr davomati" value={`${d.student.attendance}%`} tone={d.student.attendance >= 90 ? "green" : d.student.attendance >= 80 ? "amber" : "red"} delta={d.student.attendance < 75 ? "Xavf" : undefined} icon={UserCheck} />
              <Stat label="Akademik qarz" value={d.student.debt} hint={d.student.debt ? "Qayta topshirish kerak" : "Qarzdorlik yo'q"} icon={BookOpen} />
              <Stat label="Fanlar" value={d.subjects.length} hint={`${d.subjects.reduce((a, s) => a + s.credits, 0)} kredit`} icon={Layers} />
            </div>

            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { key: "overview", label: "Umumiy" },
                { key: "grades", label: "Joriy baholar", count: d.subjects.length },
                { key: "semesters", label: "Semestrlar", count: d.semesters.length },
                { key: "attendance", label: "Davomat", count: d.attendance.length },
                { key: "history", label: "Tarix", count: d.history.length },
              ]}
            />

            {tab === "overview" && (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="space-y-4">
                  <Card>
                    <CardHead title="Ma'lumotlar" />
                    <KeyValues
                      items={[
                        ["Talaba ID", d.student.id],
                        ["Guruh", d.student.group],
                        ["Fakultet", d.faculty?.name ?? "—"],
                        ["Dekan", d.faculty?.dean ?? "—"],
                        ["Kurator", d.group?.curator ?? "—"],
                        ["Ta'lim shakli", d.student.funding],
                        ["Telefon", d.student.phone],
                        ["Ota-ona", d.student.parent],
                      ]}
                    />
                  </Card>
                  <Card>
                    <CardHead title="Tizim akkauntlari" desc="Talaba va ota-ona kabinetlari" />
                    {d.accounts.length === 0 ? (
                      <Empty text="Bog'langan akkaunt yo'q — 'Foydalanuvchilar' bo'limida talaba yoki ota-ona akkaunti yarating" />
                    ) : (
                      <div className="divide-y divide-ts-line">
                        {d.accounts.map((a) => (
                          <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                            <Avatar name={a.name} size={30} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{a.name}</div>
                              <div className="truncate text-xs text-ts-sub">
                                {roleLabel(a.role)} · {a.email} · {a.lastLoginAt ? `oxirgi kirish ${a.lastLoginAt}` : "hali kirmagan"}
                              </div>
                            </div>
                            {a.status !== "active" && <Pill tone="red">To'xtatilgan</Pill>}
                            {can("core.users.manage") && (
                              <Btn size="sm" variant="ghost" onClick={() => nav(`/members/${a.id}`)}>
                                <ArrowRight className="h-3.5 w-3.5" />
                              </Btn>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
                <Card>
                  <CardHead title="Xavf tahlili" desc="GPA, davomat va qarzdorlik asosida" />
                  <div className="space-y-3 p-4">
                    <RiskRow label="GPA" ok={d.student.gpa >= 3} warn={d.student.gpa >= 2.5} value={d.student.gpa ? d.student.gpa.toFixed(2) : "—"} hint="3.0 dan past — diqqat" />
                    <RiskRow label="Davomat" ok={d.student.attendance >= 85} warn={d.student.attendance >= 70} value={`${d.student.attendance}%`} hint="75% dan past — yakuniyga kiritilmaslik xavfi" />
                    <RiskRow label="Akademik qarz" ok={d.student.debt === 0} warn={d.student.debt < 2} value={`${d.student.debt} fan`} hint="2 va undan ko'p — jiddiy" />
                    <div className={cn("flex items-start gap-2 rounded-md p-3 text-sm", d.risk === "high" ? "bg-red-500/10 text-red-700 dark:text-red-300" : d.risk === "medium" ? "bg-amber-500/10 text-amber-800 dark:text-amber-200" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}>
                      {d.risk === "low" ? <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                      {d.risk === "high"
                        ? "Kurator va ota-ona bilan uchrashuv, individual o'quv reja tavsiya etiladi."
                        : d.risk === "medium"
                          ? "Kurator nazoratida. Davomat va oraliq natijalarni kuzating."
                          : "Ko'rsatkichlar me'yorda."}
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {tab === "grades" && (
              <Card className="overflow-hidden">
                <Table head={["Fan", "O'qituvchi", "Kredit", "JN (30)", "ON (20)", "YN (50)", "Jami", "Baho"]} minWidth={820}>
                  {d.subjects.map((s) => {
                    const has = s.jn !== null;
                    const total = (s.jn ?? 0) + (s.on ?? 0) + (s.yn ?? 0);
                    const proj = s.yn === null ? ((s.jn ?? 0) + (s.on ?? 0)) * 2 : total;
                    const mark = toMark(proj);
                    return (
                      <tr key={s.code}>
                        <Td>
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-ts-muted">{s.code}</div>
                        </Td>
                        <Td className="text-ts-sub">{s.teacher}</Td>
                        <Td className="tabular-nums">{s.credits}</Td>
                        <Td className="tabular-nums">{s.jn ?? "—"}</Td>
                        <Td className="tabular-nums">{s.on ?? "—"}</Td>
                        <Td className="tabular-nums text-ts-muted">{s.yn ?? "—"}</Td>
                        <Td className="font-medium tabular-nums">{has ? total : "—"}</Td>
                        <Td>{has ? <Pill tone={mark === 5 ? "green" : mark === 4 ? "blue" : mark === 3 ? "amber" : "red"}>{s.yn === null ? `${mark} (taxminiy)` : mark}</Pill> : <span className="text-xs text-ts-muted">Baholanmagan</span>}</Td>
                      </tr>
                    );
                  })}
                </Table>
              </Card>
            )}

            {tab === "semesters" && (
              <div className="space-y-3">
                {d.semesters.length === 0 && (
                  <Card>
                    <Empty text="Hali yopilgan semestr yo'q — semestr yopilganda natijalar shu yerda saqlanadi" icon={GraduationCap} />
                  </Card>
                )}
                {[...d.semesters].reverse().map((x) => (
                  <Card key={x.semesterId} className="overflow-hidden">
                    <div className="flex flex-wrap items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{x.name}</div>
                        <div className="text-xs text-ts-sub">
                          {x.creditsPassed} kredit o'zlashtirildi{x.newDebts ? ` · ${x.newDebts} ta qarz` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold tabular-nums">{x.gpa?.toFixed(2) ?? "—"}</div>
                        <div className="text-[11px] text-ts-muted">semestr GPA · umumiy {x.cumulativeGpa.toFixed(2)}</div>
                      </div>
                    </div>
                    <Table head={["Fan", "Jami", "Baho", "Holat"]} minWidth={520}>
                      {x.subjects.map((sub) => (
                        <tr key={sub.name}>
                          <Td className="font-medium">{sub.name}</Td>
                          <Td className="tabular-nums">{sub.total ?? "—"}</Td>
                          <Td>{sub.mark ? <Pill tone={sub.mark === 5 ? "green" : sub.mark === 4 ? "blue" : sub.mark === 3 ? "amber" : "red"}>{sub.mark}</Pill> : "—"}</Td>
                          <Td>{sub.passed ? <Pill tone="green">O'zlashtirdi</Pill> : <span className="text-xs text-red-500">{sub.reason}</span>}</Td>
                        </tr>
                      ))}
                    </Table>
                  </Card>
                ))}
              </div>
            )}

            {tab === "attendance" && (
              <Card className="overflow-hidden">
                <div className="flex flex-wrap gap-2 p-4">
                  {(Object.keys(ATTENDANCE_LABEL) as AttendanceMark[]).map((m) => (
                    <Pill key={m} tone={MARK_TONE[m]} dot>
                      {ATTENDANCE_LABEL[m]}: {d.attendance.filter((a) => a.mark === m).length}
                    </Pill>
                  ))}
                </div>
                {d.attendance.length === 0 ? (
                  <Empty text="O'qituvchilar tizimda davomat belgilagach, yozuvlar shu yerda chiqadi" icon={CalendarDays} />
                ) : (
                  <Table head={["Sana", "Fan", "Holat"]} minWidth={480}>
                    {d.attendance.map((a, i) => (
                      <tr key={i}>
                        <Td className="whitespace-nowrap text-ts-sub">{fmtDate(a.date)}</Td>
                        <Td className="font-medium">{subjectByCode(a.subject)?.name ?? a.subject}</Td>
                        <Td>
                          <Pill tone={MARK_TONE[a.mark]} dot>
                            {ATTENDANCE_LABEL[a.mark]}
                          </Pill>
                        </Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </Card>
            )}

            {tab === "history" && (
              <Card>
                <Timeline
                  empty="O'zgarish tarixi yo'q"
                  items={d.history.map((h) => ({
                    at: h.at,
                    tone: h.to === "expelled" ? "red" : h.action === "CREATE" ? "green" : "blue",
                    title: (
                      <>
                        <span className="font-medium">{h.by}</span> · {ACTION_TEXT[h.action] ?? h.action}
                      </>
                    ),
                    text: h.from || h.to ? `${h.from ? STUDENT_STATUS_LABEL[h.from as StudentStatus] ?? h.from : ""}${h.from ? " → " : ""}${STUDENT_STATUS_LABEL[h.to as StudentStatus] ?? h.to ?? ""}` : undefined,
                  }))}
                />
              </Card>
            )}
          </>
        )}
      </QueryState>
      {toast}
    </div>
  );
}

function RiskRow({ label, value, ok, warn, hint }: { label: string; value: string; ok: boolean; warn: boolean; hint: string }) {
  const tone: Tone = ok ? "green" : warn ? "amber" : "red";
  return (
    <div className="flex items-center gap-3">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", tone === "green" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-red-500")} />
      <div className="min-w-0 flex-1">
        <div className="text-sm">{label}</div>
        <div className="text-xs text-ts-muted">{hint}</div>
      </div>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

/* ═════════════════ Guruh ═════════════════ */

type GroupDetail = {
  group: Group;
  faculty: { id: string; name: string; dean: string } | null;
  stats: { students: number; gpa: number; attendance: number; atRisk: number };
  students: { id: string; name: string; status: StudentStatus; gpa: number; attendance: number; risk: Risk; funding: string }[];
  subjects: { code: string; name: string; credits: number; hours: number; progress: number; teacher: string }[];
  lessons: Lesson[];
};

export function GroupDetailPage() {
  const { id = "" } = useParams();
  const { user } = useApp();
  const nav = useNavigate();
  const q = useApi<GroupDetail>(`/edu/groups/${encodeURIComponent(id)}`);
  const [tab, setTab] = useState<"students" | "subjects" | "schedule">("students");
  const d = q.data;
  const canPeople = !!accessOf(user?.role, "people");
  const canStructure = !!accessOf(user?.role, "structure");

  return (
    <div className="space-y-4 text-ts-fg">
      <QueryState error={q.error} loading={q.loading && !d} onRetry={q.reload}>
        {d && (
          <>
            <DetailHeader
              back="/academic"
              backLabel="O'quv jarayoni"
              media={
                <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-ts-chip text-base font-semibold">
                  <Users className="h-6 w-6" />
                </span>
              }
              title={`${d.group.id} guruhi`}
              subtitle={`${d.group.direction} · ${d.group.course}-kurs · Kurator: ${d.group.curator}`}
              badges={
                d.faculty && (
                  <button type="button" disabled={!canStructure} onClick={() => nav(`/structure/${d.faculty!.id}`)} className="disabled:cursor-default">
                    <Pill>
                      <Landmark className="h-3 w-3" /> {d.faculty.name}
                    </Pill>
                  </button>
                )
              }
              actions={
                <Btn onClick={() => nav("/timetable")}>
                  <CalendarDays className="h-4 w-4" /> Dars jadvali
                </Btn>
              }
            />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Faol talabalar" value={d.stats.students} icon={Users} />
              <Stat label="O'rtacha GPA" value={d.stats.gpa ? d.stats.gpa.toFixed(2) : "—"} icon={GraduationCap} />
              <Stat label="O'rtacha davomat" value={`${d.stats.attendance}%`} tone={d.stats.attendance < 80 ? "red" : "green"} delta={d.stats.attendance < 80 ? "Past" : undefined} icon={UserCheck} />
              <Stat label="Yuqori xavf" value={d.stats.atRisk} tone="red" delta={d.stats.atRisk ? "Diqqat" : undefined} icon={AlertTriangle} />
            </div>
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { key: "students", label: "Talabalar", count: d.students.length },
                { key: "subjects", label: "Fanlar", count: d.subjects.length },
                { key: "schedule", label: "Haftalik jadval", count: d.lessons.length },
              ]}
            />
            {tab === "students" && (
              <Card className="overflow-hidden">
                {d.students.length === 0 ? (
                  <Empty text="Guruhda talaba yo'q" />
                ) : (
                  <Table head={["Talaba", "Ta'lim shakli", "GPA", "Davomat", "Xavf", "Holat"]} minWidth={760}>
                    {d.students.map((s) => (
                      <tr key={s.id}>
                        <Td>
                          <div className="flex items-center gap-2.5">
                            <Avatar name={s.name} size={28} />
                            <div>
                              <LinkCell to={canPeople ? `/people/${s.id}` : undefined}>{s.name}</LinkCell>
                              <div className="text-xs text-ts-muted">{s.id}</div>
                            </div>
                          </div>
                        </Td>
                        <Td className="text-ts-sub">{s.funding}</Td>
                        <Td className="tabular-nums">{s.gpa ? s.gpa.toFixed(2) : "—"}</Td>
                        <Td className="w-36">
                          <div className="flex items-center gap-2">
                            <Progress value={s.attendance} tone={s.attendance < 75 ? "red" : s.attendance < 85 ? "amber" : "green"} />
                            <span className="w-9 text-xs tabular-nums text-ts-sub">{s.attendance}%</span>
                          </div>
                        </Td>
                        <Td>
                          <Pill tone={RISK[s.risk].tone}>{RISK[s.risk].label.replace(" xavf", "").replace("Xavf ", "")}</Pill>
                        </Td>
                        <Td>
                          <Pill tone={STATUS_TONE[s.status]} dot>
                            {STUDENT_STATUS_LABEL[s.status]}
                          </Pill>
                        </Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </Card>
            )}
            {tab === "subjects" && (
              <Card className="overflow-hidden">
                <Table head={["Fan", "O'qituvchi", "Kredit", "Soat", "O'tilgan"]} minWidth={680}>
                  {d.subjects.map((s) => (
                    <tr key={s.code}>
                      <Td>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-ts-muted">{s.code}</div>
                      </Td>
                      <Td className="text-ts-sub">{s.teacher}</Td>
                      <Td className="tabular-nums">{s.credits}</Td>
                      <Td className="tabular-nums">{s.hours}</Td>
                      <Td className="w-44">
                        <div className="flex items-center gap-2">
                          <Progress value={s.progress} />
                          <span className="w-9 text-xs tabular-nums text-ts-sub">{s.progress}%</span>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </Table>
              </Card>
            )}
            {tab === "schedule" && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {DAYS.map((day, di) => {
                  const ls = d.lessons.filter((l) => l.day === di).sort((a, b) => a.slot - b.slot);
                  return (
                    <Card key={day} className="p-4">
                      <div className="mb-2 text-sm font-medium">{day}</div>
                      {ls.length === 0 ? (
                        <div className="text-xs text-ts-muted">Dars yo'q</div>
                      ) : (
                        <div className="space-y-2">
                          {ls.map((l) => (
                            <div key={l.id} className="rounded-md bg-ts-tile p-2.5 text-sm">
                              <div className="flex justify-between text-xs text-ts-sub">
                                <span>{SLOTS[l.slot]}</span>
                                <span>{l.room}</span>
                              </div>
                              <div className="mt-0.5 font-medium">{subjectByCode(l.subject)?.name}</div>
                              <div className="text-xs text-ts-muted">{l.type}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </QueryState>
    </div>
  );
}

/* ═════════════════ Fakultet ═════════════════ */

type FacultyDetail = {
  faculty: Faculty;
  stats: { groups: number; students: number; gpa: number; attendance: number; atRisk: number };
  groups: { id: string; direction: string; course: number; curator: string; students: number; gpa: number; attendance: number; atRisk: number }[];
};

export function FacultyDetailPage() {
  const { id = "" } = useParams();
  const { user } = useApp();
  const nav = useNavigate();
  const q = useApi<FacultyDetail>(`/edu/faculties/${encodeURIComponent(id)}`);
  const d = q.data;
  const canAcademic = !!accessOf(user?.role, "academic");
  return (
    <div className="space-y-4 text-ts-fg">
      <QueryState error={q.error} loading={q.loading && !d} onRetry={q.reload}>
        {d && (
          <>
            <DetailHeader
              back="/structure"
              backLabel="Tashkiliy tuzilma"
              media={
                <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-ts-chip">
                  <Landmark className="h-6 w-6" />
                </span>
              }
              title={d.faculty.name}
              subtitle={`Dekan: ${d.faculty.dean}`}
              badges={
                <>
                  <Pill>{d.faculty.departments.length} kafedra</Pill>
                  <Pill>{d.stats.groups} guruh</Pill>
                </>
              }
            />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Faol talabalar" value={d.stats.students} icon={Users} />
              <Stat label="O'rtacha GPA" value={d.stats.gpa ? d.stats.gpa.toFixed(2) : "—"} icon={GraduationCap} />
              <Stat label="O'rtacha davomat" value={`${d.stats.attendance}%`} icon={UserCheck} />
              <Stat label="Yuqori xavf" value={d.stats.atRisk} tone="red" delta={d.stats.atRisk ? "Diqqat" : undefined} icon={AlertTriangle} />
            </div>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
              <Card className="overflow-hidden">
                <CardHead title="Guruhlar" desc="Faol talabalar bo'yicha" className="pb-4" />
                {d.groups.length === 0 ? (
                  <Empty text="Guruh yo'q" />
                ) : (
                  <Table head={["Guruh", "Kurs", "Talabalar", "GPA", "Davomat", "Xavf"]} minWidth={640}>
                    {d.groups.map((g) => (
                      <tr key={g.id} onClick={() => canAcademic && nav(`/academic/groups/${g.id}`)} className={cn(canAcademic && "cursor-pointer transition hover:bg-ts-hover")}>
                        <Td>
                          <div className="font-medium">{g.id}</div>
                          <div className="text-xs text-ts-sub">{g.direction}</div>
                        </Td>
                        <Td>{g.course}</Td>
                        <Td className="tabular-nums">{g.students}</Td>
                        <Td className="tabular-nums">{g.students ? g.gpa.toFixed(2) : "—"}</Td>
                        <Td className="w-36">
                          {g.students ? (
                            <div className="flex items-center gap-2">
                              <Progress value={g.attendance} tone={g.attendance < 80 ? "red" : g.attendance < 90 ? "amber" : "green"} />
                              <span className="w-9 text-xs tabular-nums text-ts-sub">{g.attendance}%</span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </Td>
                        <Td>{g.atRisk ? <Pill tone="red">{g.atRisk}</Pill> : <span className="text-ts-muted">—</span>}</Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </Card>
              <Card>
                <CardHead title="Kafedralar" />
                <div className="space-y-2 p-4">
                  {d.faculty.departments.map((dep) => (
                    <div key={dep.id} className="rounded-md border border-ts-line p-3">
                      <div className="font-medium">{dep.name}</div>
                      <div className="mt-0.5 text-xs text-ts-sub">Mudir: {dep.head}</div>
                      <div className="mt-2 flex gap-3 text-xs text-ts-sub">
                        <span>{dep.teachers} o'qituvchi</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}

