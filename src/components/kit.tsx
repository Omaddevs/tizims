/**
 * Ta'lim modullari uchun umumiy UI to'plami — dashboard bilan bir xil ko'rinish
 * (ts-* tokenlar: yorug' va qorong'i rejimda avtomatik moslashadi).
 */
import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ArrowLeft, ChevronRight, Info, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { cn } from "../lib/utils";

export type Tone = "blue" | "green" | "amber" | "red" | "gray" | "violet";

const TONES: Record<Tone, string> = {
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  red: "bg-red-500/10 text-red-600 dark:text-red-400",
  gray: "bg-ts-chip text-ts-sub",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

const DOTS: Record<Tone, string> = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  gray: "bg-ts-muted",
  violet: "bg-violet-500",
};

export function Page({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  const { organization } = useApp();
  return (
    <div className="space-y-4 text-ts-fg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-medium tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-ts-sub">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {!actions && (
            <div className="hidden items-center gap-1.5 text-sm text-ts-sub sm:flex">
              <span className="uppercase">{organization?.slug}</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-ts-fg">{title}</span>
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-lg border border-ts-line bg-ts-card text-sm text-ts-fg", className)}>{children}</div>;
}

export function CardHead({ title, desc, action, className }: { title: ReactNode; desc?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-4 pt-4", className)}>
      <div className="min-w-0">
        <div className="text-base font-medium tracking-tight">{title}</div>
        {desc && <div className="mt-0.5 text-sm text-ts-sub">{desc}</div>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, delta, hint, icon: Icon, tone }: { label: string; value: ReactNode; delta?: string; hint?: string; icon?: typeof Info; tone?: Tone }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ts-sub">{label}</span>
        {Icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-ts-line2 bg-ts-input">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
        {delta && <Pill tone={tone ?? "gray"}>{delta}</Pill>}
      </div>
      {hint && <div className="text-xs text-ts-sub">{hint}</div>}
    </Card>
  );
}

export function Pill({ tone = "gray", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-xs font-medium", TONES[tone], className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", DOTS[tone])} />}
      {children}
    </span>
  );
}

export function Btn({
  variant = "outline",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "ghost" | "danger"; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-all active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
        variant === "primary" && "bg-ts-inv text-ts-invfg hover:opacity-90",
        variant === "outline" && "border border-ts-line2 bg-ts-input text-ts-fg hover:bg-ts-hover",
        variant === "ghost" && "text-ts-fg hover:bg-ts-hover",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        className,
      )}
      {...props}
    />
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { key: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn("ts-scroll-none inline-flex max-w-full gap-1 overflow-x-auto rounded-lg bg-ts-chip p-1", className)}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={cn(
            "flex h-7 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
            value === t.key ? "bg-ts-card text-ts-fg shadow-sm" : "text-ts-sub hover:text-ts-fg",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="text-xs text-ts-muted">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <label className={cn("flex h-8 items-center gap-2 rounded-md border border-ts-line2 bg-ts-input px-2.5 text-ts-sub focus-within:border-ts-sub", className)}>
      <Search className="h-4 w-4 shrink-0" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-full w-full min-w-0 bg-transparent text-sm text-ts-fg outline-none placeholder:text-ts-muted" />
      {value && (
        <button type="button" onClick={() => onChange("")} className="text-ts-muted hover:text-ts-fg">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </label>
  );
}

const fieldCls = "w-full rounded-md border border-ts-line2 bg-ts-input px-2.5 text-sm text-ts-fg outline-none placeholder:text-ts-muted focus:border-ts-sub";

export function TextInput({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldCls, "h-9", className)} {...p} />;
}

export function TextArea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldCls, "py-2", className)} {...p} />;
}

export function SelectBox({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldCls, "h-9", className)} {...p} />;
}

export function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ts-sub">{label}</span>
      {children}
    </label>
  );
}

export function Table({ head, children, minWidth = 640 }: { head: ReactNode[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead>
          <tr className="bg-ts-tile">
            {head.map((h, i) => (
              <th key={i} className="h-10 whitespace-nowrap px-3 font-medium text-ts-fg first:pl-4 last:pr-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={cn("border-t border-ts-line px-3 py-2.5 align-middle first:pl-4 last:pr-4", className)}>
      {children}
    </td>
  );
}

export function Progress({ value, tone = "blue", className }: { value: number; tone?: Tone; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-ts-track", className)}>
      <div className={cn("h-full rounded-full transition-all duration-500", DOTS[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const parts = name.replace(/^(Dr\.|Prof\.|Rektor|Dekan)\s*/i, "").split(/\s+/).filter(Boolean);
  const ini = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full border border-ts-line bg-ts-chip text-xs font-medium text-ts-sub" style={{ width: size, height: size }}>
      {ini || "?"}
    </span>
  );
}

export function Empty({ text, icon: Icon = Info }: { text: string; icon?: typeof Info }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center text-sm text-ts-sub">
      <Icon className="h-5 w-5 text-ts-muted" />
      {text}
    </div>
  );
}

/** Foydalanuvchiga ko'rish doirasini tushuntiruvchi kichik izoh. */
export function ScopeNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-ts-line bg-ts-tile px-3 py-2 text-xs text-ts-sub">
      <Info className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-[8vh]" onClick={onClose}>
      <div className={cn("ts-pop w-full rounded-lg border border-ts-line2 bg-ts-card text-ts-fg shadow-2xl", wide ? "max-w-4xl" : "max-w-lg")} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-ts-line px-4 py-3">
          <h3 className="text-base font-medium">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-ts-muted hover:bg-ts-hover hover:text-ts-fg">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ts-line px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2600);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = msg ? (
    <div className="ts-pop fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-md bg-ts-inv px-4 py-2 text-sm font-medium text-ts-invfg shadow-xl">{msg}</div>
  ) : null;
  return [node, show] as const;
}

/** API so'rovi holati: xato bo'lsa — qayta urinish tugmasi bilan xabar; yuklanayotganda — skelet. */
export function QueryState({ error, loading, onRetry, children }: { error: string | null; loading: boolean; onRetry: () => void; children: ReactNode }) {
  if (error)
    return (
      <Card className="flex flex-wrap items-center gap-3 border-red-500/30 bg-red-500/5 p-4 text-sm">
        <Info className="h-4 w-4 shrink-0 text-red-500" />
        <span className="min-w-0 flex-1">{error}</span>
        <Btn size="sm" onClick={onRetry}>
          Qayta urinish
        </Btn>
      </Card>
    );
  if (loading)
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-ts-tile" />
        ))}
      </div>
    );
  return <>{children}</>;
}

/* ───────── Batafsil ko'rinish (detail) uchun ───────── */

/** Batafsil sahifa sarlavhasi: orqaga, belgi/avatar, nom, kichik ma'lumot, belgilar, amallar */
export function DetailHeader({
  back,
  backLabel,
  media,
  title,
  subtitle,
  badges,
  actions,
}: {
  back: string;
  backLabel: string;
  media?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  const nav = useNavigate();
  return (
    <div className="space-y-3">
      <button type="button" onClick={() => (window.history.length > 1 ? nav(-1) : nav(back))} className="inline-flex items-center gap-1.5 text-sm text-ts-sub transition hover:text-ts-fg">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </button>
      <Card className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
        {media}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <div className="mt-0.5 text-sm text-ts-sub">{subtitle}</div>}
          {badges && <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </Card>
    </div>
  );
}

/** Kalit — qiymat ro'yxati (profil ma'lumotlari) */
export function KeyValues({ items, cols = 2 }: { items: [string, ReactNode][]; cols?: 1 | 2 | 3 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3 p-4 text-sm", cols === 3 ? "sm:grid-cols-3" : cols === 2 ? "sm:grid-cols-2" : "")}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-ts-sub">{k}</dt>
          <dd className="mt-0.5 truncate font-medium">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Vaqt chizig'i — o'zgarishlar tarixi */
export function Timeline({ items, empty = "Hozircha yozuv yo'q" }: { items: { at: string; title: ReactNode; text?: ReactNode; tone?: Tone }[]; empty?: string }) {
  if (items.length === 0) return <Empty text={empty} />;
  return (
    <ol className="relative space-y-4 p-4 pl-8">
      <span className="absolute bottom-6 left-[19px] top-6 w-px bg-ts-line" />
      {items.map((it, i) => (
        <li key={i} className="relative">
          <span className={cn("absolute -left-[17px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-ts-card", DOTS[it.tone ?? "gray"])} />
          <div className="text-sm">{it.title}</div>
          {it.text && <div className="mt-0.5 whitespace-pre-wrap text-sm text-ts-sub">{it.text}</div>}
          <div className="mt-0.5 text-xs text-ts-muted">{it.at}</div>
        </li>
      ))}
    </ol>
  );
}

/** O'ng tomondan ochiladigan panel — ro'yxatdan chiqmasdan batafsil ko'rish */
export function Drawer({ open, onClose, title, subtitle, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/40" onClick={onClose}>
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-ts-line2 bg-ts-card text-ts-fg shadow-2xl" style={{ animation: "ts-drawer .22s cubic-bezier(.22,1,.36,1)" }} onClick={(e) => e.stopPropagation()}>
        <style>{"@keyframes ts-drawer{from{transform:translateX(24px);opacity:.4}to{transform:none;opacity:1}}"}</style>
        <div className="flex items-start gap-3 border-b border-ts-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold">{title}</div>
            {subtitle && <div className="mt-0.5 text-sm text-ts-sub">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-ts-muted hover:bg-ts-hover hover:text-ts-fg" aria-label="Yopish">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-ts-line px-5 py-3">{footer}</div>}
      </aside>
    </div>
  );
}

export function fmtDate(iso: string) {
  const months = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d}-${months[m - 1]}, ${y}`;
}
