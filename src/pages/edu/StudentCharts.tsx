/** Talaba bosh sahifasi grafiklari — faqat bazadagi haqiqiy ma'lumot, oddiy HTML/CSS bilan */
import { useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, FileQuestion, ShieldCheck, UserX } from "lucide-react";
import { Card, CardHead, Empty } from "../../components/kit";
import { cn } from "../../lib/utils";
import { fmtDateShort } from "./homeUtils";

const SHORT_DAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh"];

/** Sichqoncha/barmoq ostidagi kichik maslahat oynasi */
function Tip({ show, children, className }: { show: boolean; children: React.ReactNode; className?: string }) {
  if (!show) return null;
  return <div className={cn("pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-ts-line bg-ts-card px-2.5 py-1.5 text-xs shadow-lg", className)}>{children}</div>;
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ts-sub">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} /> {i.label}
        </span>
      ))}
    </div>
  );
}

/* ── 1. Fanlar bo'yicha ballar: JN (30) + ON (20) + YN (50) = 100 ── */
type SubjectRow = { code: string; name: string; teacher: string; jn: number | null; on: number | null; yn: number | null };
const PARTS = [
  { key: "jn", label: "Joriy (30)", color: "var(--viz-1)" },
  { key: "on", label: "Oraliq (20)", color: "var(--viz-2)" },
  { key: "yn", label: "Yakuniy (50)", color: "var(--viz-3)" },
] as const;

export function SubjectScoresChart({ rows, action }: { rows: SubjectRow[]; action?: React.ReactNode }) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <Card className="ts-viz">
      <CardHead title="Fanlarim" desc="Ballar · 100 ballik tizim" action={action} />
      <div className="space-y-4 p-4">
        <Legend items={PARTS.map((p) => ({ label: p.label, color: p.color }))} />
        {rows.map((r) => {
          const graded = r.jn !== null;
          const total = (r.jn ?? 0) + (r.on ?? 0) + (r.yn ?? 0);
          return (
            <div key={r.code} className="relative" onMouseEnter={() => setHover(r.code)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === r.code ? null : r.code)}>
              <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  {r.name} <span className="text-xs text-ts-muted">· {r.teacher}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-ts-sub">{graded ? <><span className="font-semibold text-ts-fg">{total}</span> / 100</> : "Baholanmagan"}</span>
              </div>
              <div className="flex h-2.5 gap-0.5 overflow-hidden rounded bg-[var(--viz-track)]">
                {graded &&
                  PARTS.map((p) => {
                    const v = r[p.key] ?? 0;
                    return v > 0 ? <div key={p.key} className="h-full first:rounded-l last:rounded-r" style={{ width: `${v}%`, background: p.color }} /> : null;
                  })}
              </div>
              <Tip show={hover === r.code && graded} className="right-0 top-full mt-1.5">
                {PARTS.map((p) => (
                  <div key={p.key} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
                    <span className="text-ts-sub">{p.label}</span>
                    <span className="ml-auto pl-3 font-medium tabular-nums">{r[p.key] ?? "—"}</span>
                  </div>
                ))}
              </Tip>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ── 2. Davomat taqsimoti (holat ranglari + belgi + matn) ── */
type Att = { present: number; late: number; excused: number; absent: number };
const MARKS = [
  { key: "present", label: "Keldi", color: "var(--viz-good)", icon: CheckCircle2 },
  { key: "late", label: "Kechikdi", color: "var(--viz-warning)", icon: Clock },
  { key: "excused", label: "Sababli", color: "var(--viz-serious)", icon: ShieldCheck },
  { key: "absent", label: "Kelmadi", color: "var(--viz-critical)", icon: UserX },
] as const;

export function AttendanceChart({ data }: { data: Att }) {
  const total = data.present + data.late + data.excused + data.absent;
  return (
    <Card className="ts-viz">
      <CardHead title="Davomat" desc={total ? `${total} ta belgilangan dars` : undefined} />
      {total === 0 ? (
        <Empty text="Davomat hali belgilanmagan" icon={CalendarDays} />
      ) : (
        <div className="space-y-4 p-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums tracking-tight">{Math.round(((total - data.absent) / total) * 100)}%</span>
            <span className="text-sm text-ts-sub">qatnashgan</span>
          </div>
          <div className="flex h-3 gap-0.5 overflow-hidden rounded">
            {MARKS.map((m) => (data[m.key] > 0 ? <div key={m.key} title={`${m.label}: ${data[m.key]}`} className="h-full first:rounded-l last:rounded-r" style={{ width: `${(data[m.key] / total) * 100}%`, background: m.color }} /> : null))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {MARKS.map((m) => (
              <div key={m.key} className="flex items-center gap-2 text-sm">
                <m.icon className="h-4 w-4 shrink-0" style={{ color: m.color }} />
                <span className="text-ts-sub">{m.label}</span>
                <span className="ml-auto font-medium tabular-nums">{data[m.key]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/* ── 3. Haftalik yuklama (bitta qator — legend shart emas) ── */
export function WeekLoadChart({ load, today }: { load: number[]; today: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...load);
  const total = load.reduce((a, b) => a + b, 0);
  return (
    <Card className="ts-viz">
      <CardHead title="Haftalik darslar" desc={`Jami ${total} ta para`} />
      <div className="flex h-36 items-end gap-2 px-4 pb-3 pt-6">
        {load.map((n, i) => (
          <div key={i} className="relative flex h-full flex-1 flex-col items-center justify-end gap-1.5" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="text-xs font-medium tabular-nums text-ts-sub">{n || ""}</span>
            <div className="w-full max-w-8 rounded-t" style={{ height: `${(n / max) * 100}%`, minHeight: n ? 4 : 0, background: i === today ? "var(--viz-1)" : "var(--viz-1-soft)" }} />
            <span className={cn("text-xs", i === today ? "font-semibold text-ts-fg" : "text-ts-muted")}>{SHORT_DAYS[i]}</span>
            <Tip show={hover === i} className="bottom-full left-1/2 -translate-x-1/2">
              {n ? `${n} ta para` : "Dars yo'q"}
              {i === today ? " · bugun" : ""}
            </Tip>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── 4. Test natijalari vaqt bo'yicha ── */
export function TestScoresChart({ tests }: { tests: { title: string; score: number; at: string }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const avg = tests.length ? Math.round(tests.reduce((a, t) => a + t.score, 0) / tests.length) : 0;
  return (
    <Card className="ts-viz">
      <CardHead title="Test natijalari" desc={tests.length ? `${tests.length} ta test · o'rtacha ${avg}%` : undefined} />
      {tests.length === 0 ? (
        <Empty text="Hali test topshirilmagan" icon={FileQuestion} />
      ) : (
        <div className="relative px-4 pb-3 pt-4">
          {/* 50% va 100% chiziqlari */}
          <div className="relative h-32">
            {[100, 50].map((g) => (
              <div key={g} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${g}%` }}>
                <div className="h-px flex-1 bg-[var(--viz-grid)]" />
                <span className="w-8 text-right text-[10px] tabular-nums text-ts-muted">{g}%</span>
              </div>
            ))}
            <div className="absolute inset-y-0 left-0 right-10 flex items-end gap-2">
              {tests.map((t, i) => (
                <div key={i} className="relative flex h-full flex-1 items-end justify-center" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <div className="w-full max-w-8 rounded-t" style={{ height: `${Math.max(t.score, 2)}%`, background: "var(--viz-1)" }} />
                  <Tip show={hover === i} className="bottom-full left-1/2 mb-1 -translate-x-1/2">
                    <div className="font-medium">{t.title}</div>
                    <div className="text-ts-sub">
                      {fmtDateShort(t.at)} · <span className="font-semibold text-ts-fg">{t.score}%</span>
                    </div>
                  </Tip>
                </div>
              ))}
            </div>
          </div>
          <div className="mr-10 mt-1.5 flex gap-2">
            {tests.map((t, i) => (
              <span key={i} className="flex-1 text-center text-[10px] text-ts-muted">{fmtDateShort(t.at)}</span>
            ))}
          </div>
          {tests.some((t) => t.score < 55) && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-ts-sub">
              <AlertTriangle className="h-3.5 w-3.5" style={{ color: "var(--viz-critical)" }} /> 55% dan past natijalar bor
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ── 5. Semestrlar bo'yicha GPA (kamida 2 semestr bo'lsa) ── */
export function GpaHistoryChart({ rows }: { rows: { name: string; gpa: number | null; cumulative: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (rows.length < 2) return null;
  const W = 300, H = 110, P = 12;
  const x = (i: number) => P + (i * (W - 2 * P)) / (rows.length - 1);
  const y = (v: number) => H - P - (v / 4) * (H - 2 * P);
  const pts = rows.map((r, i) => `${x(i)},${y(r.cumulative)}`).join(" ");
  return (
    <Card className="ts-viz">
      <CardHead title="GPA dinamikasi" desc="Umumiy GPA semestrlar bo'yicha" />
      <div className="relative p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="GPA dinamikasi">
          {[2, 3, 4].map((g) => (
            <line key={g} x1={P} x2={W - P} y1={y(g)} y2={y(g)} stroke="var(--viz-grid)" strokeWidth={1} />
          ))}
          <polyline points={pts} fill="none" stroke="var(--viz-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {rows.map((r, i) => (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <circle cx={x(i)} cy={y(r.cumulative)} r={12} fill="transparent" />
              <circle cx={x(i)} cy={y(r.cumulative)} r={4} fill="var(--viz-1)" stroke="var(--ts-card)" strokeWidth={2} />
            </g>
          ))}
        </svg>
        {hover !== null && (
          <div className="absolute left-4 top-2 rounded-lg border border-ts-line bg-ts-card px-2.5 py-1.5 text-xs shadow-lg">
            <div className="font-medium">{rows[hover].name}</div>
            <div className="text-ts-sub">
              Umumiy <span className="font-semibold text-ts-fg">{rows[hover].cumulative.toFixed(2)}</span> · semestr {rows[hover].gpa?.toFixed(2) ?? "—"}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
