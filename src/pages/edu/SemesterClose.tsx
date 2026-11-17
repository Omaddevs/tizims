/** Semestrni yopish: oldindan ko'rish → tasdiq (semestr nomini yozish) → natija. Hisob-kitob serverda. */
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Download, GraduationCap, Lock, TrendingUp } from "lucide-react";
import { Btn, Modal, Pill, QueryState, ScopeNote, Table, Tabs, Td, TextInput } from "../../components/kit";
import { api, errorText, useApi } from "../../lib/api";
import { cn } from "../../lib/utils";
import { downloadCsv } from "../EducationDashboard";
import type { Semester } from "../../data/academic";

type Preview = {
  semester: Semester;
  next: Semester;
  pairs: { subject: string; name: string; group: string; students: number; graded: number; missingFinal: number; excluded: boolean }[];
  results: {
    studentId: string;
    name: string;
    group: string;
    semesterGpa: number | null;
    cumulativeGpa: number;
    creditsPassed: number;
    creditsAttempted: number;
    newDebts: number;
    outcome: "continue" | "promote" | "graduate" | "not_graduated";
    subjects: { name: string; reason?: string; passed: boolean }[];
  }[];
  promotedGroups: { id: string; from: number; to: number }[];
  summary: { students: number; gpa: number; failed: number; newDebts: number; missingFinals: number; excludedPairs: number; graduate: number; notGraduated: number; promoted: number };
};

const OUTCOME: Record<Preview["results"][number]["outcome"], { label: string; tone: "gray" | "blue" | "green" | "red" }> = {
  continue: { label: "Davom etadi", tone: "gray" },
  promote: { label: "Keyingi kursga", tone: "blue" },
  graduate: { label: "Bitiradi", tone: "green" },
  not_graduated: { label: "Bitirmaydi (qarz)", tone: "red" },
};

export function SemesterCloseModal({ onClose, onClosed }: { onClose: () => void; onClosed: (msg: string) => void }) {
  const q = useApi<Preview>("/edu/semesters/close-preview");
  const [tab, setTab] = useState<"issues" | "students">("issues");
  const [confirm, setConfirm] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const d = q.data;
  const problems = d ? d.pairs.filter((p) => p.excluded || p.missingFinal > 0) : [];

  async function close() {
    if (!d) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ next: Semester; summary: Preview["summary"] }>("/edu/semesters/close", { body: { confirm } });
      onClosed(`${d.semester.name} yopildi · ${r.next.name} boshlandi`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function exportPreview() {
    if (!d) return;
    downloadCsv(`semestr-${d.semester.id}-natijalar`, [
      ["Talaba ID", "Talaba", "Guruh", "Semestr GPA", "Umumiy GPA", "O'tgan kredit", "Yangi qarz", "Natija", "Qarz sabablari"],
      ...d.results.map((r) => [r.studentId, r.name, r.group, r.semesterGpa ?? "—", r.cumulativeGpa, `${r.creditsPassed}/${r.creditsAttempted}`, r.newDebts, OUTCOME[r.outcome].label, r.subjects.filter((x) => !x.passed).map((x) => `${x.name}: ${x.reason}`).join("; ")]),
    ]);
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={d ? `Semestrni yopish · ${d.semester.name}` : "Semestrni yopish"}
      footer={
        <>
          {d && (
            <Btn className="mr-auto" onClick={exportPreview}>
              <Download className="h-4 w-4" /> Natijalar (CSV)
            </Btn>
          )}
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn variant="danger" disabled={!d || !ack || confirm !== d.semester.name || busy} onClick={close}>
            <Lock className="h-4 w-4" /> {busy ? "Yopilmoqda..." : "Semestrni yopish"}
          </Btn>
        </>
      }
    >
      <QueryState error={q.error} loading={q.loading && !d} onRetry={q.reload}>
        {d && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="Talabalar" value={d.summary.students} />
              <Tile label="O'rtacha semestr GPA" value={d.summary.gpa.toFixed(2)} />
              <Tile label="Qarzga tushadi" value={d.summary.failed} hint={`${d.summary.newDebts} ta fan`} tone={d.summary.failed ? "red" : undefined} />
              {d.semester.kind === "spring" ? (
                <Tile label="Bitiradi / kurs o'tadi" value={`${d.summary.graduate} / ${d.summary.promoted}`} hint={d.summary.notGraduated ? `${d.summary.notGraduated} ta qarz sababli bitirmaydi` : undefined} tone="green" />
              ) : (
                <Tile label="Keyingi semestr" value={d.next.name.split(" · ")[1]} hint={d.next.name.split(" · ")[0]} />
              )}
            </div>

            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { key: "issues", label: "Diqqat talab qiladi", count: problems.length },
                { key: "students", label: "Talabalar natijasi", count: d.results.length },
              ]}
            />

            {tab === "issues" && (
              <div className="max-h-[36vh] space-y-2 overflow-auto">
                {problems.length === 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> Barcha fanlar bo'yicha yakuniy baholar kiritilgan.
                  </div>
                )}
                {problems.map((p) => (
                  <div key={`${p.subject}-${p.group}`} className={cn("flex items-start gap-3 rounded-md border p-3 text-sm", p.excluded ? "border-amber-500/30 bg-amber-500/5" : "border-red-500/30 bg-red-500/5")}>
                    <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", p.excluded ? "text-amber-500" : "text-red-500")} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {p.name} · {p.group}
                      </div>
                      <div className="text-xs text-ts-sub">
                        {p.excluded
                          ? "Bu fan umuman baholanmagan — semestr GPA'sidan chiqariladi (qarz hisoblanmaydi)."
                          : `${p.missingFinal} talabada yakuniy nazorat bahosi yo'q — bu talabalarga fan bo'yicha akademik qarz yoziladi.`}
                      </div>
                    </div>
                  </div>
                ))}
                {d.promotedGroups.length > 0 && (
                  <div className="rounded-md border border-ts-line p-3 text-sm">
                    <div className="mb-1.5 flex items-center gap-1.5 font-medium">
                      <TrendingUp className="h-4 w-4" /> Kurs ko'chirish
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {d.promotedGroups.map((g) => (
                        <Pill key={g.id} tone="blue">
                          {g.id}: {g.from} → {g.to}-kurs
                        </Pill>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "students" && (
              <div className="max-h-[36vh] overflow-auto rounded-md border border-ts-line">
                <Table head={["Talaba", "Guruh", "Semestr GPA", "Umumiy GPA", "Kredit", "Qarz", "Natija"]} minWidth={760}>
                  {d.results.map((r) => (
                    <tr key={r.studentId}>
                      <Td>
                        <div className="font-medium">{r.name}</div>
                        {r.newDebts > 0 && <div className="truncate text-xs text-red-500">{r.subjects.filter((x) => !x.passed).map((x) => x.name).join(", ")}</div>}
                      </Td>
                      <Td>{r.group}</Td>
                      <Td className="tabular-nums">{r.semesterGpa?.toFixed(2) ?? "—"}</Td>
                      <Td className="tabular-nums">{r.cumulativeGpa.toFixed(2)}</Td>
                      <Td className="tabular-nums text-ts-sub">
                        {r.creditsPassed}/{r.creditsAttempted}
                      </Td>
                      <Td>{r.newDebts ? <Pill tone="red">{r.newDebts}</Pill> : <span className="text-ts-muted">—</span>}</Td>
                      <Td>
                        <Pill tone={OUTCOME[r.outcome].tone}>{OUTCOME[r.outcome].label}</Pill>
                      </Td>
                    </tr>
                  ))}
                </Table>
              </div>
            )}

            <div className="space-y-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <div className="flex items-start gap-2 text-sm">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                <div>
                  <b>Bu amal qaytarib bo'lmaydi.</b> Natijalar arxivlanadi, talabalarning umumiy GPA, kredit va qarzlari yangilanadi
                  {d.semester.kind === "spring" ? ", guruhlar keyingi kursga o'tadi, bitiruvchilar \"Bitirgan\" holatiga o'tadi" : ""}, baholash jurnallari yangi semestr uchun tozalanadi
                  va <b>{d.next.name}</b> boshlanadi.
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="h-4 w-4" />
                Yuqoridagi ogohlantirishlarni ko'rib chiqdim
              </label>
              <div>
                <div className="mb-1 text-xs text-ts-sub">
                  Tasdiqlash uchun semestr nomini yozing: <b className="text-ts-fg">{d.semester.name}</b>
                </div>
                <TextInput value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={d.semester.name} />
              </div>
            </div>
            {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
            <ScopeNote>
              GPA 4 ballik: 5 → 4.0, 4 → 3.0, 3 → 2.0, 2 → 0 (kredit bilan tortiladi). Jami 55 dan past yoki yakuniy bahosi yo'q fan — akademik qarz. <GraduationCap className="inline h-3 w-3" /> Bitirish — oxirgi kursda va qarzsiz.
            </ScopeNote>
          </>
        )}
      </QueryState>
    </Modal>
  );
}

function Tile({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "red" | "green" }) {
  return (
    <div className="rounded-md border border-ts-line p-3">
      <div className="text-xs text-ts-sub">{label}</div>
      <div className={cn("mt-0.5 text-lg font-semibold tabular-nums", tone === "red" && "text-red-600 dark:text-red-400", tone === "green" && "text-emerald-600 dark:text-emerald-400")}>{value}</div>
      {hint && <div className="text-[11px] text-ts-muted">{hint}</div>}
    </div>
  );
}
