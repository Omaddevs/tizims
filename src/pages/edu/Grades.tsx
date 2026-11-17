import { useEffect, useState } from "react";
import { Award, BookOpen, CalendarClock, GraduationCap, Save, TrendingUp } from "lucide-react";
import { Avatar, Btn, Card, CardHead, Page, Pill, Progress, QueryState, ScopeNote, SelectBox, Stat, Table, Td, fmtDate, useToast, type Tone } from "../../components/kit";
import { api, errorText, useApi } from "../../lib/api";
import { cn } from "../../lib/utils";
import { EXAMS, GROUPS, PAST_SEMESTERS, allSubjects, subjectByCode, teacherName, toMark, type GradeRow, type Student } from "../../data/academic";
import { useScope } from "./scope";

const MARK_TONE: Record<number, Tone> = { 5: "green", 4: "blue", 3: "amber", 2: "red" };
const total = (g: { jn: number; on: number; yn: number | null }) => g.jn + g.on + (g.yn ?? 0);
/** Yakuniy hali qo'yilmagan bo'lsa — JN+ON natijasidan 100 ballik taxmin. */
const projected = (g: { jn: number; on: number; yn: number | null }) => (g.yn === null ? (g.jn + g.on) * 2 : total(g));

export function GradesPage() {
  const s = useScope("grades");
  if (s.revoked && (s.isTeacher || s.role === "advisor")) {
    return (
      <Page title={s.title} subtitle={s.description}>
        <ScopeNote>Bu bo'lim uchun ruxsatingiz tashkilot egasi tomonidan o'chirilgan. Ruxsat kerak bo'lsa, tashkilot rahbariyatiga murojaat qiling.</ScopeNote>
      </Page>
    );
  }
  return (
    <Page title={s.title} subtitle={s.description}>
      {s.isManage ? <TeacherGrades /> : s.isOwn ? <OwnGrades parent={s.isParent} name={s.me?.name ?? ""} group={s.studentGroup ?? ""} /> : <OverviewGrades facultyGroups={s.facultyGroups} />}
    </Page>
  );
}

function Exams({ groups, title }: { groups: string[] | null; title: string }) {
  const list = EXAMS.filter((e) => !groups || groups.includes(e.group)).sort((a, b) => a.date.localeCompare(b.date));
  return (
    <Card>
      <CardHead title={title} desc="Imtihonlar jadvali" />
      <div className="space-y-2 p-4">
        {list.map((e) => (
          <div key={e.id} className="flex items-center gap-3 rounded-md border border-ts-line p-3">
            <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md bg-ts-chip leading-none">
              <span className="text-base font-semibold">{Number(e.date.slice(8, 10))}</span>
              <span className="text-[10px] uppercase text-ts-sub">{fmtDate(e.date).split("-")[1]?.split(",")[0]}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{subjectByCode(e.subject)?.name}</div>
              <div className="text-xs text-ts-sub">
                {e.kind} · {e.group} · {e.time} · {e.room}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ───────── O'qituvchi: baholash jurnali ───────── */

function TeacherGrades() {
  const s = useScope("grades");
  const [toast, showToast] = useToast();
  // O'qituvchi — o'z fanlari; nazoratchi — barcha fan va guruhlar
  const source = s.isTeacher ? s.mySubjects : allSubjects();
  const pairs = source.flatMap((sub) => sub.groups.map((g) => ({ key: `${sub.code}|${g}`, subject: sub.code, group: g })));
  const [pair, setPair] = useState(pairs[0]?.key ?? "");
  const [subject, group] = pair.split("|");
  const q = useApi<(GradeRow & { name?: string })[]>(subject ? `/edu/grades?subject=${encodeURIComponent(subject)}&group=${encodeURIComponent(group)}` : null);
  const [list, setList] = useState<(GradeRow & { name?: string })[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setList(q.data ?? []);
    setDirty(false);
  }, [q.data]);

  function set(studentId: string, field: "jn" | "on" | "yn", raw: string, max: number) {
    const v = raw === "" ? null : Math.max(0, Math.min(max, Math.round(Number(raw) || 0)));
    setList((rs) => rs.map((r) => (r.studentId === studentId ? { ...r, [field]: field === "yn" ? v : (v ?? 0) } : r)));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const saved = await api<(GradeRow & { name?: string })[]>("/edu/grades", { method: "PUT", body: { subject, group, rows: list.map(({ name: _n, ...r }) => r) } });
      q.setData(saved);
      showToast("Baholar saqlandi · audit logga yozildi");
    } catch (e) {
      showToast(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  const avg = list.length ? Math.round((list.reduce((a, r) => a + total(r), 0) / list.length) * 10) / 10 : 0;
  const dist = [5, 4, 3, 2].map((m) => list.filter((r) => toMark(projected(r)) === m).length);

  return (
    <>
      <ScopeNote>Baholar 100 ballik tizimda: joriy nazorat (JN) 30, oraliq (ON) 20, yakuniy (YN) 50 ball. Saqlangan baho o'zgartirilsa, audit logga yoziladi.</ScopeNote>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="O'rtacha ball" value={avg} hint={`${group} · ${subjectByCode(subject)?.name}`} icon={TrendingUp} />
        <Stat label="A'lo (86+)" value={dist[0]} icon={Award} />
        <Stat label="Yaxshi / qoniqarli" value={`${dist[1]} / ${dist[2]}`} icon={GraduationCap} />
        <Stat label="Qoniqarsiz (< 55)" value={dist[3]} delta={dist[3] ? "Qayta topshirish" : undefined} tone="red" icon={BookOpen} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <div className="text-base font-medium">Baholash jurnali</div>
              <div className="text-sm text-ts-sub">{dirty ? "Saqlanmagan o'zgarishlar bor" : "Katakchaga bosib ballni kiriting"}</div>
            </div>
            <div className="flex items-center gap-2">
              <SelectBox
                className="h-8 w-auto"
                value={pair}
                onChange={(e) => {
                  if (dirty && !window.confirm("Saqlanmagan o'zgarishlar yo'qoladi. Davom etasizmi?")) return;
                  setPair(e.target.value);
                }}
              >
                {pairs.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.group} · {subjectByCode(p.subject)?.name}
                  </option>
                ))}
              </SelectBox>
              <Btn variant="primary" disabled={!dirty || saving} onClick={save}>
                <Save className="h-4 w-4" /> {saving ? "Saqlanmoqda..." : "Saqlash"}
              </Btn>
            </div>
          </div>
          <QueryState error={q.error} loading={q.loading && !q.data} onRetry={q.reload}>
            <Table head={["Talaba", "JN (30)", "ON (20)", "YN (50)", "Jami", "Baho"]} minWidth={680}>
              {list.map((r) => {
                const name = r.name ?? r.studentId;
                const t = total(r);
                const m = toMark(projected(r));
                return (
                  <tr key={r.studentId}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={name} size={28} />
                        <span className="font-medium">{name}</span>
                      </div>
                    </Td>
                    <Td>
                      <ScoreInput value={r.jn} max={30} onChange={(v) => set(r.studentId, "jn", v, 30)} />
                    </Td>
                    <Td>
                      <ScoreInput value={r.on} max={20} onChange={(v) => set(r.studentId, "on", v, 20)} />
                    </Td>
                    <Td>
                      <ScoreInput value={r.yn} max={50} onChange={(v) => set(r.studentId, "yn", v, 50)} placeholder="—" />
                    </Td>
                    <Td className="font-medium tabular-nums">{t}</Td>
                    <Td>
                      <Pill tone={MARK_TONE[m]}>{r.yn === null ? `${m} (taxminiy)` : m}</Pill>
                    </Td>
                  </tr>
                );
              })}
            </Table>
          </QueryState>
        </Card>
        <Exams groups={s.isTeacher ? s.myGroups : null} title={s.isTeacher ? "Mening imtihonlarim" : "Imtihonlar jadvali"} />
      </div>
      {toast}
    </>
  );
}

function ScoreInput({ value, max, onChange, placeholder }: { value: number | null; max: number; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="number"
      min={0}
      max={max}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-16 rounded-md border border-ts-line2 bg-ts-input px-2 text-sm tabular-nums text-ts-fg outline-none placeholder:text-ts-muted focus:border-ts-sub"
    />
  );
}

/* ───────── Rahbariyat: o'zlashtirish ko'rinishi ───────── */

function OverviewGrades({ facultyGroups }: { facultyGroups: string[] | null }) {
  const groups = GROUPS.filter((g) => !facultyGroups || facultyGroups.includes(g.id));
  const gq = useApi<GradeRow[]>("/edu/grades");
  const sq = useApi<Student[]>("/edu/students");
  const dist = [5, 4, 3, 2].map((m) => (gq.data ?? []).filter((r) => toMark(projected(r)) === m).length);
  const sum = dist.reduce((a, b) => a + b, 0) || 1;
  const debtors = (sq.data ?? []).filter((st) => st.debt > 0 && groups.some((g) => g.id === st.group));
  const avgGpa = (groups.reduce((a, g) => a + g.gpa, 0) / groups.length).toFixed(2);

  return (
    <>
      {facultyGroups && <ScopeNote>Faqat o'z fakultetingiz guruhlari ko'rsatilmoqda.</ScopeNote>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="O'rtacha GPA" value={avgGpa} delta="+0.08" tone="green" icon={GraduationCap} />
        <Stat label="A'lochilar" value={`${Math.round((dist[0] / sum) * 100)}%`} hint="Oraliq natijalar bo'yicha" icon={Award} />
        <Stat label="Akademik qarzdorlar" value={debtors.length} delta="Diqqat" tone="red" icon={BookOpen} />
        <Stat label="Yaqin imtihonlar" value={EXAMS.length} hint="Keyingi 30 kun" icon={CalendarClock} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <CardHead title="Guruhlar o'zlashtirishi" desc="GPA va baholar taqsimoti" className="pb-4" />
          <Table head={["Guruh", "Yo'nalish", "Kurs", "GPA", ""]} minWidth={520}>
            {groups.map((g) => (
              <tr key={g.id}>
                <Td className="font-medium">{g.id}</Td>
                <Td className="text-ts-sub">{g.direction}</Td>
                <Td>{g.course}</Td>
                <Td className="tabular-nums">{g.gpa.toFixed(2)}</Td>
                <Td className="w-48">
                  <Progress value={(g.gpa / 4) * 100} tone={g.gpa < 3.2 ? "amber" : "green"} />
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card>
          <CardHead title="Baholar taqsimoti" desc="Joriy semestr" />
          <div className="space-y-3 p-4">
            {[5, 4, 3, 2].map((m, i) => (
              <div key={m}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span>{m === 5 ? "A'lo (5)" : m === 4 ? "Yaxshi (4)" : m === 3 ? "Qoniqarli (3)" : "Qoniqarsiz (2)"}</span>
                  <span className="tabular-nums text-ts-sub">{Math.round((dist[i] / sum) * 100)}%</span>
                </div>
                <Progress value={(dist[i] / sum) * 100} tone={MARK_TONE[m]} />
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHead title="Akademik qarzdorlar" desc="Qayta topshirishi kerak bo'lgan fanlar soni" className="pb-4" />
          <Table head={["Talaba", "Guruh", "GPA", "Qarz"]} minWidth={420}>
            {debtors.map((st) => (
              <tr key={st.id}>
                <Td className="font-medium">{st.name}</Td>
                <Td>{st.group}</Td>
                <Td className="tabular-nums">{st.gpa.toFixed(2)}</Td>
                <Td>
                  <Pill tone={st.debt >= 2 ? "red" : "amber"}>{st.debt} fan</Pill>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
        <Exams groups={facultyGroups} title="Yaqinlashayotgan imtihonlar" />
      </div>
    </>
  );
}

/* ───────── Talaba / ota-ona ───────── */

function OwnGrades({ parent, name, group }: { parent: boolean; name: string; group: string }) {
  const max = 4;
  const q = useApi<{ results: { subject: string; jn: number; on: number; yn: number | null }[]; semesters: { name: string; gpa: number | null }[] }>("/edu/grades/my");
  const results = q.data?.results ?? [];
  // Yopilgan semestrlar natijasi (bazadan); hali yo'q bo'lsa — avvalgi semestrlar namunasi
  const closed = (q.data?.semesters ?? []).filter((x) => x.gpa !== null).map((x) => ({ name: x.name, gpa: x.gpa as number }));
  const gpaHistory = closed.length ? closed : PAST_SEMESTERS;
  const subjects = allSubjects().filter((x) => x.groups.includes(group));
  return (
    <>
      {parent && <ScopeNote>Farzandingiz {name} baholari. Yangi baho qo'yilganda Telegram orqali xabar olasiz.</ScopeNote>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="GPA" value="3.78" delta="+0.04" tone="green" hint="Guruhda 3-o'rin" icon={GraduationCap} />
        <Stat label="Kreditlar" value="96/240" hint="Shu semestrda 21 kredit" icon={BookOpen} />
        <Stat label="Akademik qarz" value="0" delta="Toza" tone="green" icon={Award} />
        <Stat label="Keyingi imtihon" value={fmtDate(EXAMS.filter((e) => e.group === group).sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? "")} icon={CalendarClock} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden">
          <CardHead title="Joriy semestr natijalari" desc="Yakuniy nazorat hali o'tkazilmagan" className="pb-4" />
          <Table head={["Fan", "O'qituvchi", "JN", "ON", "YN", "Jami", "Holat"]} minWidth={680}>
            {results.map((r) => {
              const sub = subjectByCode(r.subject);
              const t = total(r);
              return (
                <tr key={r.subject}>
                  <Td className="font-medium">{sub?.name}</Td>
                  <Td className="text-ts-sub">{sub ? teacherName(sub.teacherId) : "—"}</Td>
                  <Td className="tabular-nums">{r.jn}/30</Td>
                  <Td className="tabular-nums">{r.on}/20</Td>
                  <Td className="tabular-nums text-ts-muted">{r.yn ?? "—"}/50</Td>
                  <Td className="font-medium tabular-nums">{t}/50</Td>
                  <Td>
                    <Pill tone={t >= 43 ? "green" : t >= 36 ? "blue" : "amber"}>{t >= 43 ? "A'lo" : t >= 36 ? "Yaxshi" : "Diqqat"}</Pill>
                  </Td>
                </tr>
              );
            })}
          </Table>
          <div className="border-t border-ts-line px-4 py-2.5 text-xs text-ts-sub">{subjects.length} ta fan · baholar o'qituvchi tomonidan saqlangach shu yerda ko'rinadi</div>
        </Card>
        <Card>
          <CardHead title="GPA dinamikasi" desc="Semestrlar kesimida" />
          <div className="flex h-56 items-end gap-3 px-4 pb-4 pt-6">
            {gpaHistory.map((p, i) => (
              <div key={p.name} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[11px] tabular-nums text-ts-sub">{p.gpa.toFixed(2)}</span>
                <div className={cn("w-full rounded-t-md", i === gpaHistory.length - 1 ? "bg-ts-blue3" : "bg-ts-blue2")} style={{ height: `${Math.max(6, ((p.gpa - 2) / (max - 2)) * 85 + 10)}%` }} title={p.name} />
                <span className="text-[10px] text-ts-muted">{i + 1}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Exams groups={[group]} title={parent ? "Farzandim imtihonlari" : "Mening imtihonlarim"} />
    </>
  );
}
