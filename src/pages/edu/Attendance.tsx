import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCheck, Clock, Save, UserCheck, UserX, Users } from "lucide-react";
import { Avatar, Btn, Card, CardHead, Empty, Page, Pill, Progress, QueryState, ScopeNote, SelectBox, Stat, Table, Td, fmtDate, useToast, type Tone } from "../../components/kit";
import { api, errorText, useApi } from "../../lib/api";
import { cn } from "../../lib/utils";
import {
  ATTENDANCE_LABEL,
  ATTENDANCE_TREND,
  DAYS,
  GROUPS,
  SLOTS,
  subjectByCode,
  type AttendanceMark,
  type Lesson,
  type Student,
} from "../../data/academic";
import { useScope } from "./scope";

const MARK_TONE: Record<AttendanceMark, Tone> = { present: "green", late: "amber", excused: "blue", absent: "red" };
const MARKS: AttendanceMark[] = ["present", "late", "excused", "absent"];

export function AttendancePage() {
  const s = useScope("attendance");
  if (s.revoked && (s.isTeacher || s.role === "advisor")) {
    return (
      <Page title={s.title} subtitle={s.description}>
        <ScopeNote>Bu bo'lim uchun ruxsatingiz tashkilot egasi tomonidan o'chirilgan. Ruxsat kerak bo'lsa, tashkilot rahbariyatiga murojaat qiling.</ScopeNote>
      </Page>
    );
  }
  return (
    <Page title={s.title} subtitle={s.description}>
      {s.isManage ? <TeacherAttendance /> : s.isOwn ? <OwnAttendance parent={s.isParent} name={s.me?.name ?? ""} /> : <OverviewAttendance facultyGroups={s.facultyGroups} />}
    </Page>
  );
}

/* ───────── O'qituvchi: davomat belgilash ───────── */

type Sheet = Record<string, AttendanceMark>;
type SheetResponse = { lesson: Lesson; date: string; roster: Student[]; marks: Sheet | null; savedAt: string | null };

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function TeacherAttendance() {
  const s = useScope("attendance");
  const [toast, showToast] = useToast();
  const lessonsQ = useApi<Lesson[]>("/edu/lessons");
  const mine = (lessonsQ.data ?? []).slice().sort((a, b) => a.day - b.day || a.slot - b.slot);
  const [picked, setPicked] = useState("");
  const [date, setDate] = useState(todayLocal);
  const lessonId = picked || mine[0]?.id || "";
  const sheetQ = useApi<SheetResponse>(lessonId ? `/edu/attendance/sheet?lessonId=${encodeURIComponent(lessonId)}&date=${date}` : null);
  const [draft, setDraft] = useState<Sheet>({});
  const [saving, setSaving] = useState(false);
  const sheet = sheetQ.data;
  const roster = sheet?.roster ?? [];
  const lesson = sheet?.lesson ?? mine.find((l) => l.id === lessonId);

  // Saqlangan varaq kelganda — qoralamani shu bilan to'ldirish
  useEffect(() => {
    setDraft(sheet?.marks ?? {});
  }, [sheet]);

  const counts = MARKS.map((m) => roster.filter((r) => (draft[r.id] ?? "present") === m).length);

  async function save() {
    setSaving(true);
    try {
      const marks = Object.fromEntries(roster.map((r) => [r.id, draft[r.id] ?? "present"]));
      const res = await api<{ savedAt: string }>("/edu/attendance/sheet", { method: "PUT", body: { lessonId, date, marks } });
      sheetQ.setData(sheet ? { ...sheet, marks, savedAt: res.savedAt } : sheet);
      showToast("Davomat saqlandi");
    } catch (e) {
      showToast(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  if (lessonsQ.error || lessonsQ.loading) return <QueryState error={lessonsQ.error} loading={lessonsQ.loading} onRetry={lessonsQ.reload}>{null}</QueryState>;
  if (!lesson) return <Empty text="Sizga biriktirilgan dars topilmadi" />;

  return (
    <>
      <ScopeNote>{s.isTeacher ? "Davomat faqat o'z darslaringiz uchun belgilanadi." : "Nazoratchi sifatida barcha guruhlar darslari uchun davomat belgilaysiz."} Saqlangan o'zgarishlar audit logga yoziladi va 3 marta ketma-ket kelmagan talabaning ota-onasiga xabar ketadi.</ScopeNote>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {MARKS.map((m, i) => (
          <Stat key={m} label={ATTENDANCE_LABEL[m]} value={counts[i]} hint={`${roster.length} talabadan`} icon={m === "present" ? UserCheck : m === "absent" ? UserX : m === "late" ? Clock : CheckCheck} />
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="text-base font-medium">{subjectByCode(lesson.subject)?.name}</div>
            <div className="text-sm text-ts-sub">
              {lesson.group} · {DAYS[lesson.day]}, {SLOTS[lesson.slot]} · {lesson.room}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SelectBox className="h-8 w-auto" value={lessonId} onChange={(e) => setPicked(e.target.value)}>
              {mine.map((l) => (
                <option key={l.id} value={l.id}>
                  {DAYS[l.day].slice(0, 3)} {SLOTS[l.slot].slice(0, 5)} · {l.group} · {subjectByCode(l.subject)?.name}
                </option>
              ))}
            </SelectBox>
            <input type="date" value={date} max={todayLocal()} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-8 rounded-md border border-ts-line2 bg-ts-input px-2 text-sm text-ts-fg outline-none" />
            <Btn onClick={() => setDraft(Object.fromEntries(roster.map((r) => [r.id, "present" as AttendanceMark])))}>
              <CheckCheck className="h-4 w-4" /> Hammasi keldi
            </Btn>
            <Btn variant="primary" disabled={saving || !roster.length} onClick={save}>
              <Save className="h-4 w-4" /> {saving ? "Saqlanmoqda..." : "Saqlash"}
            </Btn>
          </div>
        </div>
        {sheet?.savedAt && <div className="border-t border-ts-line bg-emerald-500/5 px-4 py-2 text-xs text-emerald-600 dark:text-emerald-400">Saqlangan: {sheet.savedAt} · o'zgartirib qayta saqlash mumkin</div>}
        <QueryState error={sheetQ.error} loading={sheetQ.loading && !sheet} onRetry={sheetQ.reload}>
          <Table head={["Talaba", "ID", "Semestr davomati", "Belgilash"]} minWidth={720}>
            {roster.map((r) => {
              const cur = draft[r.id] ?? "present";
              return (
                <tr key={r.id}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.name} size={28} />
                      <span className="font-medium">{r.name}</span>
                    </div>
                  </Td>
                  <Td className="text-ts-sub">{r.id}</Td>
                  <Td className="w-44">
                    <div className="flex items-center gap-2">
                      <Progress value={r.attendance} tone={r.attendance < 75 ? "red" : r.attendance < 85 ? "amber" : "green"} />
                      <span className="w-9 text-xs tabular-nums text-ts-sub">{r.attendance}%</span>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex gap-1">
                      {MARKS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setDraft((d) => ({ ...d, [r.id]: m }))}
                          className={cn(
                            "h-7 rounded-md border px-2.5 text-xs font-medium transition",
                            cur === m ? cn("border-transparent", toneSolid(MARK_TONE[m])) : "border-ts-line2 text-ts-sub hover:bg-ts-hover",
                          )}
                        >
                          {ATTENDANCE_LABEL[m]}
                        </button>
                      ))}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        </QueryState>
      </Card>
      {toast}
    </>
  );
}

function toneSolid(t: Tone) {
  return { green: "bg-emerald-500 text-white", amber: "bg-amber-500 text-white", blue: "bg-blue-500 text-white", red: "bg-red-500 text-white", gray: "bg-ts-inv text-ts-invfg", violet: "bg-violet-500 text-white" }[t];
}

/* ───────── Rahbariyat / dekan / maslahatchi: umumiy ko'rinish ───────── */

function OverviewAttendance({ facultyGroups }: { facultyGroups: string[] | null }) {
  const groups = GROUPS.filter((g) => !facultyGroups || facultyGroups.includes(g.id));
  const sq = useApi<Student[]>("/edu/students");
  const students = (sq.data ?? []).filter((st) => groups.some((g) => g.id === st.group) && st.status === "active");
  const avg = Math.round((groups.reduce((a, g) => a + g.attendance * g.students, 0) / groups.reduce((a, g) => a + g.students, 0)) * 10) / 10;
  const low = students.filter((st) => st.attendance < 80).sort((a, b) => a.attendance - b.attendance);
  const max = Math.max(...ATTENDANCE_TREND.map((t) => t.value));

  return (
    <>
      {facultyGroups && <ScopeNote>Faqat o'z fakultetingiz (Axborot texnologiyalari) guruhlari ko'rsatilmoqda.</ScopeNote>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="O'rtacha davomat" value={`${avg}%`} delta="+1.4%" tone="green" hint="Joriy semestr" icon={UserCheck} />
        <Stat label="Bugun kelmaganlar" value="184" delta="-8%" tone="green" hint="Kechagiga nisbatan" icon={UserX} />
        <Stat label="Kechikkanlar" value="46" hint="Bugun, 1-juftlik" icon={Clock} />
        <Stat label="Xavf ostida" value={low.length} delta="< 80%" tone="red" hint="Davomati past talabalar" icon={AlertTriangle} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHead title="Haftalik dinamika" desc="So'nggi 11 hafta, %" />
          <div className="flex h-56 items-end gap-2 px-4 pb-4 pt-6">
            {ATTENDANCE_TREND.map((t) => (
              <div key={t.week} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[11px] tabular-nums text-ts-sub opacity-0 transition group-hover:opacity-100">{t.value}%</span>
                <div className="w-full rounded-t-md bg-ts-blue3 opacity-70 transition group-hover:opacity-100" style={{ height: `${((t.value - 80) / (max - 80)) * 85 + 10}%` }} />
                <span className="text-[10px] text-ts-muted">{t.week.replace("-hafta", "")}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="overflow-hidden">
          <CardHead title="Guruhlar kesimida" desc="Semestr davomati" className="pb-4" />
          <Table head={["Guruh", "Talabalar", "Davomat", ""]} minWidth={420}>
            {groups
              .slice()
              .sort((a, b) => a.attendance - b.attendance)
              .map((g) => (
                <tr key={g.id}>
                  <Td className="font-medium">{g.id}</Td>
                  <Td className="text-ts-sub">{g.students}</Td>
                  <Td className="w-48">
                    <div className="flex items-center gap-2">
                      <Progress value={g.attendance} tone={g.attendance < 80 ? "red" : g.attendance < 88 ? "amber" : "green"} />
                      <span className="w-9 text-xs tabular-nums">{g.attendance}%</span>
                    </div>
                  </Td>
                  <Td>{g.attendance < 80 && <Pill tone="red">Diqqat</Pill>}</Td>
                </tr>
              ))}
          </Table>
        </Card>
      </div>
      <Card className="overflow-hidden">
        <CardHead title="Davomati past talabalar" desc="80% dan past — kurator va ota-onaga avtomatik xabar yuborilgan" className="pb-4" />
        {low.length === 0 ? (
          <Empty text="Davomati past talaba yo'q" />
        ) : (
          <Table head={["Talaba", "Guruh", "Davomat", "Ota-ona", "Holat"]}>
            {low.map((st) => (
              <tr key={st.id}>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={st.name} size={28} />
                    <span className="font-medium">{st.name}</span>
                  </div>
                </Td>
                <Td>{st.group}</Td>
                <Td className="tabular-nums text-red-500">{st.attendance}%</Td>
                <Td className="text-ts-sub">{st.parent}</Td>
                <Td>
                  <Pill tone={st.attendance < 65 ? "red" : "amber"} dot>
                    {st.attendance < 65 ? "Chetlashtirish xavfi" : "Ogohlantirilgan"}
                  </Pill>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}

/* ───────── Talaba / ota-ona: o'z davomati ───────── */

type MyAttendance = {
  student: { id: string; name: string; group: string };
  semesterRate: number;
  marked: { total: number; present: number; late: number; excused: number; absent: number; rate: number | null };
  records: { date: string; subject: string; type: string | null; slot: number | null; mark: AttendanceMark }[];
};

function OwnAttendance({ parent, name }: { parent: boolean; name: string }) {
  const q = useApi<MyAttendance>("/edu/attendance/my");
  const d = q.data;
  const bySubject = useMemo(() => {
    const map = new Map<string, { total: number; ok: number; absent: number }>();
    for (const l of d?.records ?? []) {
      const cur = map.get(l.subject) ?? { total: 0, ok: 0, absent: 0 };
      cur.total++;
      if (l.mark === "absent") cur.absent++;
      else cur.ok++;
      map.set(l.subject, cur);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].ok / a[1].total - b[1].ok / b[1].total);
  }, [d]);

  return (
    <QueryState error={q.error} loading={q.loading && !d} onRetry={q.reload}>
      {d && (
        <>
          {parent && <ScopeNote>Farzandingiz {name} davomati. Dars qoldirilsa ilova orqali xabar olasiz.</ScopeNote>}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Semestr davomati"
              value={`${d.marked.rate ?? d.semesterRate}%`}
              tone={(d.marked.rate ?? d.semesterRate) >= 90 ? "green" : (d.marked.rate ?? d.semesterRate) >= 75 ? "amber" : "red"}
              delta={(d.marked.rate ?? d.semesterRate) < 75 ? "Xavf" : undefined}
              hint={d.marked.total ? `${d.marked.total} ta belgilangan darsdan` : "Hali belgilangan dars yo'q"}
              icon={UserCheck}
            />
            <Stat label="Qoldirilgan (sababsiz)" value={d.marked.absent} tone={d.marked.absent ? "red" : undefined} icon={UserX} />
            <Stat label="Kechikkan" value={d.marked.late} icon={Clock} />
            <Stat label="Sababli" value={d.marked.excused} hint="Ma'lumotnoma bilan" icon={CheckCheck} />
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="overflow-hidden">
              <CardHead title="Davomat jurnali" desc="O'qituvchi yoki nazoratchi belgilagan darslar" className="pb-4" />
              {d.records.length === 0 ? (
                <Empty text="Hali belgilangan dars yo'q — darslarda davomat belgilangach shu yerda ko'rinadi" />
              ) : (
                <Table head={["Sana", "Fan", "Juftlik", "Holat"]} minWidth={460}>
                  {d.records.map((l, i) => (
                    <tr key={i}>
                      <Td className="whitespace-nowrap text-ts-sub">{fmtDate(l.date)}</Td>
                      <Td>
                        <div className="font-medium">{subjectByCode(l.subject)?.name ?? l.subject}</div>
                        {l.type && <div className="text-xs text-ts-muted">{l.type}</div>}
                      </Td>
                      <Td className="text-ts-sub">{l.slot !== null ? `${l.slot + 1} · ${SLOTS[l.slot].slice(0, 5)}` : "—"}</Td>
                      <Td>
                        <Pill tone={MARK_TONE[l.mark]} dot>
                          {ATTENDANCE_LABEL[l.mark]}
                        </Pill>
                      </Td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
            <Card>
              <CardHead title="Fanlar bo'yicha" desc="Qatnashish foizi" />
              <div className="space-y-4 p-4">
                {bySubject.length === 0 && <div className="text-sm text-ts-sub">Ma'lumot yo'q</div>}
                {bySubject.map(([code, v]) => {
                  const pct = Math.round((v.ok / v.total) * 100);
                  return (
                    <div key={code}>
                      <div className="mb-1.5 flex justify-between text-sm">
                        <span>{subjectByCode(code)?.name ?? code}</span>
                        <span className="tabular-nums text-ts-sub">
                          {pct}% {v.absent ? <span className="text-red-500">· {v.absent} qoldirilgan</span> : null}
                        </span>
                      </div>
                      <Progress value={pct} tone={pct < 75 ? "red" : pct < 90 ? "amber" : "green"} />
                    </div>
                  );
                })}
                <div className="flex items-start gap-2 rounded-md bg-ts-tile p-3 text-xs text-ts-sub">
                  <Users className="mt-px h-3.5 w-3.5 shrink-0" />
                  Davomat 75% dan tushsa, fan bo'yicha yakuniy nazoratga kiritilmaslik xavfi paydo bo'ladi.
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </QueryState>
  );
}
