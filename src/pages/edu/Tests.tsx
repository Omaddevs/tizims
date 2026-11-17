/**
 * Onlayn testlar. Boshqaruv: test tuzish, e'lon qilish, natijalar (savol bo'yicha tahlil).
 * Talaba: bitta urinish, vaqt server soati bo'yicha, javoblar serverda baholanadi.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, CheckCircle2, Clock, FileQuestion, Lock, Play, Plus, Send, Trash2, Trophy } from "lucide-react";
import { Btn, Card, Drawer, Empty, FieldLabel, Modal, Page, Pill, Progress, QueryState, SelectBox, Stat, Table, Td, TextInput, useToast, type Tone } from "../../components/kit";
import { api, errorText, useApi } from "../../lib/api";
import { useSubjects } from "../../lib/subjects";
import { cn } from "../../lib/utils";
import { subjectByCode } from "../../data/academic";
import { useScope } from "./scope";

type State = "draft" | "upcoming" | "open" | "closed";
const STATE: Record<State, { label: string; tone: Tone }> = { draft: { label: "Qoralama", tone: "gray" }, upcoming: { label: "Kutilmoqda", tone: "blue" }, open: { label: "Ochiq", tone: "green" }, closed: { label: "Yopilgan", tone: "gray" } };
const fmt = (iso: string) => iso.replace("T", " ");

type AdminTest = { id: string; title: string; subject: string; groups: string[]; durationMin: number; opensAt: string; closesAt: string; questions: unknown[]; state: State; attempts: number; avgScore: number | null; createdBy: string };
type StudentTest = { id: string; title: string; subject: string; durationMin: number; opensAt: string; closesAt: string; questions: number; state: State; attempt: { submitted: boolean; score: number | null; correct: number | null; inProgress: boolean; deadline: number } | null };

export function TestsPage() {
  const s = useScope("tests");
  return s.isManage ? <ManageTests /> : <StudentTests />;
}

/* ═════════════════ Boshqaruv ═════════════════ */

function ManageTests() {
  const s = useScope("tests");
  const [toast, showToast] = useToast();
  const q = useApi<AdminTest[]>("/edu/tests");
  const list = q.data ?? [];
  const [creating, setCreating] = useState(false);
  const [resultsId, setResultsId] = useState<string | null>(null);

  async function setStatus(t: AdminTest, status: "published" | "closed") {
    if (status === "closed" && !window.confirm("Test yopilsinmi? Talabalar endi topshira olmaydi.")) return;
    try {
      const next = await api<AdminTest>(`/edu/tests/${t.id}`, { method: "PATCH", body: { status } });
      q.setData(list.map((x) => (x.id === t.id ? { ...x, ...next } : x)));
      showToast(status === "published" ? "Test e'lon qilindi" : "Test yopildi");
    } catch (e) {
      showToast(errorText(e));
    }
  }

  return (
    <Page
      title={s.title}
      subtitle={s.description}
      actions={
        <Btn variant="primary" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Test tuzish
        </Btn>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Testlar" value={list.length} icon={FileQuestion} />
        <Stat label="Hozir ochiq" value={list.filter((t) => t.state === "open").length} icon={Play} />
        <Stat label="Topshirishlar" value={list.reduce((a, t) => a + t.attempts, 0)} icon={CheckCircle2} />
        <Stat
          label="O'rtacha natija"
          value={(() => {
            const w = list.filter((t) => t.avgScore !== null);
            return w.length ? `${Math.round(w.reduce((a, t) => a + (t.avgScore ?? 0), 0) / w.length)}%` : "—";
          })()}
          icon={Trophy}
        />
      </div>
      <QueryState error={q.error} loading={q.loading && !q.data} onRetry={q.reload}>
        <Card className="overflow-hidden">
          {list.length === 0 ? (
            <Empty text="Hali test yo'q" icon={FileQuestion} />
          ) : (
            <Table head={["Test", "Guruhlar", "Muddat", "Holat", "Topshirgan", "O'rtacha", ""]} minWidth={960}>
              {list.map((t) => (
                <tr key={t.id}>
                  <Td>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-ts-sub">
                      {subjectByCode(t.subject)?.name ?? t.subject} · {t.questions.length} savol · {t.durationMin} daqiqa
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {t.groups.map((g) => (
                        <Pill key={g}>{g}</Pill>
                      ))}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-ts-sub">
                    {fmt(t.opensAt)}
                    <br />— {fmt(t.closesAt)}
                  </Td>
                  <Td>
                    <Pill tone={STATE[t.state].tone} dot>
                      {STATE[t.state].label}
                    </Pill>
                  </Td>
                  <Td className="tabular-nums">{t.attempts}</Td>
                  <Td className="tabular-nums">{t.avgScore !== null ? `${t.avgScore}%` : "—"}</Td>
                  <Td className="whitespace-nowrap text-right">
                    <div className="flex justify-end gap-1.5">
                      {t.state === "draft" && (
                        <Btn size="sm" variant="primary" onClick={() => void setStatus(t, "published")}>
                          E'lon qilish
                        </Btn>
                      )}
                      {(t.state === "open" || t.state === "upcoming") && (
                        <Btn size="sm" variant="ghost" onClick={() => void setStatus(t, "closed")}>
                          <Lock className="h-3.5 w-3.5" /> Yopish
                        </Btn>
                      )}
                      <Btn size="sm" onClick={() => setResultsId(t.id)}>
                        <BarChart3 className="h-3.5 w-3.5" /> Natijalar
                      </Btn>
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </QueryState>
      {creating && (
        <TestBuilder
          onClose={() => setCreating(false)}
          onSaved={(t, published) => {
            q.setData([t, ...list]);
            setCreating(false);
            showToast(published ? "Test e'lon qilindi" : "Qoralama saqlandi");
          }}
        />
      )}
      {resultsId && <ResultsDrawer id={resultsId} onClose={() => setResultsId(null)} />}
      {toast}
    </Page>
  );
}

type Draft = { text: string; options: string[]; correct: number };
const blank = (): Draft => ({ text: "", options: ["", "", "", ""], correct: 0 });
const isoLocal = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function TestBuilder({ onClose, onSaved }: { onClose: () => void; onSaved: (t: AdminTest, published: boolean) => void }) {
  const { list: catalog } = useSubjects();
  const now = new Date();
  const [f, setF] = useState({ title: "", subject: "", groups: [] as string[], durationMin: 20, opensAt: isoLocal(now), closesAt: isoLocal(new Date(now.getTime() + 7 * 86400000)) });
  const [qs, setQs] = useState<Draft[]>([blank()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subject = catalog.find((x) => x.code === f.subject);
  const validQ = qs.every((q) => q.text.trim() && q.options.filter((o) => o.trim()).length >= 2 && q.options[q.correct]?.trim());
  const ok = f.title.trim().length >= 3 && subject && f.groups.length > 0 && f.closesAt > f.opensAt && validQ;

  const upd = (i: number, d: Partial<Draft>) => setQs((xs) => xs.map((x, j) => (j === i ? { ...x, ...d } : x)));

  async function save(publish: boolean) {
    setSaving(true);
    setError(null);
    try {
      // Bo'sh variantlar olib tashlanadi, to'g'ri javob indeksi moslashtiriladi
      const questions = qs.map((q) => {
        const kept = q.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o);
        return { text: q.text.trim(), options: kept.map((x) => x.o), correct: kept.findIndex((x) => x.i === q.correct) };
      });
      const t = await api<AdminTest>("/edu/tests", { body: { ...f, title: f.title.trim(), questions, publish } });
      onSaved(t, publish);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Test tuzish"
      footer={
        <>
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn disabled={!ok || saving} onClick={() => void save(false)}>
            Qoralama
          </Btn>
          <Btn variant="primary" disabled={!ok || saving} onClick={() => void save(true)}>
            <Send className="h-4 w-4" /> E'lon qilish
          </Btn>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldLabel label="Test nomi">
          <TextInput value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Masalan: 2-mavzu bo'yicha nazorat" />
        </FieldLabel>
        <FieldLabel label="Fan">
          <SelectBox value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value, groups: [] })}>
            <option value="">— tanlang —</option>
            {catalog.map((x) => (
              <option key={x.code} value={x.code}>
                {x.name}
              </option>
            ))}
          </SelectBox>
        </FieldLabel>
      </div>
      {subject && (
        <div>
          <div className="mb-1.5 text-xs font-medium text-ts-sub">Guruhlar</div>
          <div className="flex flex-wrap gap-1.5">
            {subject.groups.map((g) => {
              const on = f.groups.includes(g);
              return (
                <button key={g} type="button" onClick={() => setF({ ...f, groups: on ? f.groups.filter((x) => x !== g) : [...f.groups, g] })} className={on ? "rounded-md bg-ts-inv px-2.5 py-1 text-xs font-medium text-ts-invfg" : "rounded-md border border-ts-line2 px-2.5 py-1 text-xs text-ts-sub hover:bg-ts-hover"}>
                  {g}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <FieldLabel label="Davomiyligi (daqiqa)">
          <TextInput type="number" min={1} max={240} value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: Math.max(1, Number(e.target.value) || 1) })} />
        </FieldLabel>
        <FieldLabel label="Ochiladi">
          <TextInput type="datetime-local" value={f.opensAt} onChange={(e) => setF({ ...f, opensAt: e.target.value })} />
        </FieldLabel>
        <FieldLabel label="Yopiladi">
          <TextInput type="datetime-local" value={f.closesAt} onChange={(e) => setF({ ...f, closesAt: e.target.value })} />
        </FieldLabel>
      </div>

      <div className="space-y-3">
        {qs.map((q, i) => (
          <div key={i} className="rounded-lg border border-ts-line p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ts-chip text-xs font-semibold">{i + 1}</span>
              <TextInput value={q.text} onChange={(e) => upd(i, { text: e.target.value })} placeholder="Savol matni" />
              {qs.length > 1 && (
                <Btn size="sm" variant="ghost" onClick={() => setQs((xs) => xs.filter((_, j) => j !== i))} title="Savolni o'chirish">
                  <Trash2 className="h-3.5 w-3.5" />
                </Btn>
              )}
            </div>
            <div className="grid gap-1.5 pl-8 sm:grid-cols-2">
              {q.options.map((o, k) => (
                <label key={k} className={cn("flex items-center gap-2 rounded-md border px-2 py-1", q.correct === k ? "border-emerald-500/50 bg-emerald-500/5" : "border-ts-line")}>
                  <input type="radio" name={`c-${i}`} checked={q.correct === k} onChange={() => upd(i, { correct: k })} className="h-3.5 w-3.5 accent-emerald-600" title="To'g'ri javob" />
                  <input value={o} onChange={(e) => upd(i, { options: q.options.map((x, j) => (j === k ? e.target.value : x)) })} placeholder={`${String.fromCharCode(65 + k)} variant`} className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-ts-muted" />
                </label>
              ))}
            </div>
          </div>
        ))}
        <Btn onClick={() => setQs((xs) => [...xs, blank()])}>
          <Plus className="h-4 w-4" /> Savol qo'shish
        </Btn>
      </div>
      <div className="text-xs text-ts-sub">To'g'ri javobni variant yonidagi doirachani belgilab ko'rsating. Bo'sh variantlar saqlanmaydi. To'g'ri javoblar talabaga hech qachon yuborilmaydi.</div>
      {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
    </Modal>
  );
}

type Results = {
  test: AdminTest & { questions: { text: string }[] };
  attempts: { studentId: string; name: string; group: string; score: number | null; correct: number | null; submittedAt: string | null; inProgress: boolean }[];
  perQuestion: { index: number; text: string; correctRate: number | null }[];
};

function ResultsDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useApi<Results>(`/edu/tests/${id}/results`);
  const d = q.data;
  const done = d?.attempts.filter((a) => a.score !== null) ?? [];
  return (
    <Drawer open onClose={onClose} title={d?.test.title ?? "Natijalar"} subtitle={d ? `${done.length} talaba topshirdi · ${d.test.groups.join(", ")}` : undefined}>
      <QueryState error={q.error} loading={q.loading && !d} onRetry={q.reload}>
        {d && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Topshirdi", done.length],
                ["O'rtacha", done.length ? `${Math.round(done.reduce((a, x) => a + (x.score ?? 0), 0) / done.length)}%` : "—"],
                ["Eng yuqori", done.length ? `${Math.max(...done.map((x) => x.score ?? 0))}%` : "—"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border border-ts-line p-3">
                  <div className="text-xs text-ts-sub">{k}</div>
                  <div className="text-lg font-semibold tabular-nums">{v}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ts-muted">Savollar bo'yicha (to'g'ri javob ulushi)</div>
              <div className="space-y-2.5">
                {d.perQuestion.map((p) => (
                  <div key={p.index}>
                    <div className="mb-1 flex justify-between gap-2 text-sm">
                      <span className="truncate">
                        {p.index + 1}. {p.text}
                      </span>
                      <span className="shrink-0 tabular-nums text-ts-sub">{p.correctRate ?? "—"}%</span>
                    </div>
                    <Progress value={p.correctRate ?? 0} tone={(p.correctRate ?? 0) < 50 ? "red" : (p.correctRate ?? 0) < 75 ? "amber" : "green"} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-ts-muted">Talabalar</div>
              {d.attempts.length === 0 ? (
                <Empty text="Hali hech kim boshlamagan" />
              ) : (
                <div className="divide-y divide-ts-line rounded-md border border-ts-line">
                  {[...d.attempts].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).map((a) => (
                    <div key={a.studentId} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{a.name}</span>
                        <span className="text-xs text-ts-sub">{a.group}</span>
                      </span>
                      {a.inProgress ? <Pill tone="blue">Yechmoqda</Pill> : <Pill tone={(a.score ?? 0) >= 86 ? "green" : (a.score ?? 0) >= 55 ? "blue" : "red"}>{a.score}% · {a.correct} to'g'ri</Pill>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </QueryState>
    </Drawer>
  );
}

/* ═════════════════ Talaba ═════════════════ */

function StudentTests() {
  const s = useScope("tests");
  const q = useApi<StudentTest[]>("/edu/tests");
  const list = q.data ?? [];
  const [running, setRunning] = useState<string | null>(null);
  const [toast, showToast] = useToast();

  return (
    <Page title={s.title} subtitle={s.description}>
      <QueryState error={q.error} loading={q.loading && !q.data} onRetry={q.reload}>
        {list.length === 0 ? (
          <Card>
            <Empty text="Hozircha siz uchun test yo'q" icon={FileQuestion} />
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {list.map((t) => {
              const a = t.attempt;
              const done = a?.submitted;
              return (
                <Card key={t.id} className="flex flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-ts-sub">{subjectByCode(t.subject)?.name ?? t.subject}</div>
                    </div>
                    {done ? (
                      <Pill tone={(a?.score ?? 0) >= 86 ? "green" : (a?.score ?? 0) >= 55 ? "blue" : "red"}>{a?.score}%</Pill>
                    ) : (
                      <Pill tone={STATE[t.state].tone} dot>
                        {STATE[t.state].label}
                      </Pill>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ts-sub">
                    <span className="flex items-center gap-1">
                      <FileQuestion className="h-3.5 w-3.5" /> {t.questions} savol
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> {t.durationMin} daqiqa
                    </span>
                    <span>
                      {fmt(t.opensAt)} — {fmt(t.closesAt)}
                    </span>
                  </div>
                  <div className="mt-4">
                    {done ? (
                      <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" /> Topshirildi · {a?.correct}/{t.questions} to'g'ri
                      </div>
                    ) : t.state === "open" ? (
                      <Btn variant="primary" onClick={() => setRunning(t.id)}>
                        <Play className="h-4 w-4" /> {a?.inProgress ? "Davom ettirish" : "Testni boshlash"}
                      </Btn>
                    ) : t.state === "upcoming" ? (
                      <div className="text-sm text-ts-sub">{fmt(t.opensAt)} da ochiladi</div>
                    ) : (
                      <div className="text-sm text-ts-muted">Muddat tugagan — topshirilmagan</div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </QueryState>
      {running && (
        <TestRunner
          id={running}
          onClose={() => setRunning(null)}
          onDone={(r) => {
            setRunning(null);
            void q.reload();
            showToast(`Natija: ${r.correct}/${r.total} to'g'ri (${r.score}%)${r.late ? " · vaqt tugaganidan keyin yuborildi" : ""}`);
          }}
          onError={(m) => {
            setRunning(null);
            showToast(m);
          }}
        />
      )}
      {toast}
    </Page>
  );
}

type Started = { id: string; title: string; deadline: number; serverNow: number; questions: { text: string; options: string[] }[] };
type Submitted = { correct: number; total: number; score: number; late: boolean };

function TestRunner({ id, onClose, onDone, onError }: { id: string; onClose: () => void; onDone: (r: Submitted) => void; onError: (m: string) => void }) {
  const [data, setData] = useState<Started | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [tick, setTick] = useState(Date.now());
  const [sending, setSending] = useState(false);
  const offset = useRef(0);
  const sent = useRef(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Faqat bir marta boshlanadi (test ID o'zgarmaguncha)
  useEffect(() => {
    api<Started>(`/edu/tests/${id}/start`, { method: "POST" })
      .then((d) => {
        offset.current = d.serverNow - Date.now(); // qurilma soati noto'g'ri bo'lsa ham to'g'ri hisoblash
        setData(d);
        setAnswers(d.questions.map(() => -1));
      })
      .catch((e) => onErrorRef.current(errorText(e)));
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [id]);

  const left = data ? Math.max(0, Math.floor((data.deadline - (tick + offset.current)) / 1000)) : 0;
  const answered = answers.filter((a) => a >= 0).length;

  const submit = useMemo(
    () => async (force = false) => {
      if (!data || sent.current) return;
      if (!force && answered < data.questions.length && !window.confirm(`${data.questions.length - answered} ta savolga javob berilmagan. Topshirasizmi?`)) return;
      sent.current = true;
      setSending(true);
      try {
        onDone(await api<Submitted>(`/edu/tests/${id}/submit`, { body: { answers } }));
      } catch (e) {
        sent.current = false;
        setSending(false);
        onError(errorText(e));
      }
    },
    [data, answered, answers, id, onDone, onError],
  );

  // Vaqt tugasa — avtomatik topshirish
  useEffect(() => {
    if (data && left === 0) void submit(true);
  }, [data, left, submit]);

  return (
    <Modal
      open
      wide
      onClose={() => window.confirm("Oynani yopsangiz ham vaqt davom etadi. Yopasizmi?") && onClose()}
      title={data?.title ?? "Test yuklanmoqda..."}
      footer={
        data ? (
          <>
            <span className="mr-auto text-sm text-ts-sub">
              {answered}/{data.questions.length} javob berildi
            </span>
            <Btn variant="primary" disabled={sending} onClick={() => void submit()}>
              <Send className="h-4 w-4" /> {sending ? "Yuborilmoqda..." : "Topshirish"}
            </Btn>
          </>
        ) : undefined
      }
    >
      {data && (
        <>
          <div className={cn("sticky top-0 z-10 flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium", left < 60 ? "bg-red-500/10 text-red-600" : "bg-ts-tile")}>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Qolgan vaqt
            </span>
            <span className="font-mono text-base tabular-nums">
              {String(Math.floor(left / 60)).padStart(2, "0")}:{String(left % 60).padStart(2, "0")}
            </span>
          </div>
          <div className="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
            {data.questions.map((q, i) => (
              <div key={i} className="rounded-lg border border-ts-line p-3">
                <div className="mb-2 text-sm font-medium">
                  {i + 1}. {q.text}
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {q.options.map((o, k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setAnswers((a) => a.map((x, j) => (j === i ? k : x)))}
                      className={cn("flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition", answers[i] === k ? "border-ts-inv bg-ts-inv text-ts-invfg" : "border-ts-line hover:bg-ts-hover")}
                    >
                      <span className="font-semibold">{String.fromCharCode(65 + k)}.</span> {o}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
