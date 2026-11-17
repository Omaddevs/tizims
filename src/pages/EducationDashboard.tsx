import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Award,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock,
  DoorOpen,
  Download,
  Ellipsis,
  EllipsisVertical,
  Eye,
  EyeOff,
  Gift,
  Globe,
  GraduationCap,
  Mail,
  Megaphone,
  Search,
  Share2,
  SlidersHorizontal,
  User as UserIcon,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import { cn } from "../lib/utils";
import { useIsMobile } from "../lib/useMedia";
import { eduRouteAllowed } from "../core/catalog";
import { accessOf } from "../core/features";
import { useApi } from "../lib/api";
import type { Student } from "../data/academic";
import { GlobalSearchBar } from "../components/GlobalSearchBar";
import {
  dashboardFor,
  type Acquisition,
  type DashboardConfig,
  type Directory,
  type DirectoryRow,
  type Goal,
  type Growth,
  type IconKey,
  type Kpi,
  type RowStatus,
} from "../data/education";

const ICONS: Record<IconKey, typeof Users> = {
  users: Users,
  userCheck: UserCheck,
  userPlus: UserPlus,
  cap: GraduationCap,
  book: BookOpen,
  calendar: CalendarDays,
  wallet: Wallet,
  door: DoorOpen,
  search: Search,
  share: Share2,
  mail: Mail,
  globe: Globe,
  megaphone: Megaphone,
  gift: Gift,
  clipboard: ClipboardCheck,
  award: Award,
  clock: Clock,
};

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/* ───────────── Primitives (shadcn/PaceUI bilan bir xil o'lchamlar) ───────────── */

function Card({ className, children, style }: { className?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={style} className={cn("flex flex-col rounded-lg border border-ts-line bg-ts-card text-sm text-ts-fg", className)}>
      {children}
    </div>
  );
}

function Badge({ children, primary, className, title }: { children: ReactNode; primary?: boolean; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
        primary ? "bg-ts-blue text-white" : "bg-ts-chip text-ts-fg",
        className,
      )}
    >
      {children}
    </span>
  );
}

function IconButton({
  children,
  onClick,
  title,
  ghost,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  ghost?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ts-fg transition-all active:translate-y-px",
        ghost ? "hover:bg-ts-hover" : "border border-ts-line2 bg-ts-input hover:bg-ts-hover",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Dropdown({ children, onClose, className }: { children: ReactNode; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const t = setTimeout(() => document.addEventListener("mousedown", h), 0);
    document.addEventListener("keydown", k);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [onClose]);
  return (
    <div ref={ref} className={cn("ts-pop absolute z-30 min-w-[168px] rounded-lg border border-ts-line bg-ts-card p-1 shadow-xl", className)}>
      {children}
    </div>
  );
}

function MenuItem({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-ts-hover", danger ? "text-ts-red" : "text-ts-fg")}
    >
      {children}
    </button>
  );
}

function useMenu() {
  const [open, setOpen] = useState(false);
  return { open, toggle: () => setOpen((v) => !v), close: () => setOpen(false) };
}

/** CSV eksport: ";" ajratuvchi (O'zbekiston/RU sozlamalaridagi Excel shu bilan to'g'ri ochadi) va UTF-8 BOM */
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = `${name}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Darhol bekor qilinsa ayrim brauzerlarda yuklab olish to'xtab qoladi
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

/* ───────────── Page ───────────── */

const LIVE_STATUS: Record<string, RowStatus> = { active: "active", leave: "warning", expelled: "suspended", graduated: "inactive" };

export function EducationDashboardPage() {
  const { user, organization, hasModule } = useApp();
  const base = useMemo(() => dashboardFor(user?.role ?? "rector"), [user?.role]);
  // Talabalar ro'yxati — "Talabalar va xodimlar" bilan bir manba (API). Holat faqat o'sha sahifada o'zgaradi.
  const live = hasModule("education") && !!accessOf(user?.role, "people") && base.directory.columns[1] === "Talaba";
  const sq = useApi<Student[]>(live ? "/edu/students" : null);
  const cfg = useMemo(() => {
    if (!live || !sq.data) return base;
    const rows: DirectoryRow[] = sq.data.map((st) => {
      const demo = base.directory.rows.find((r) => r.id === st.id);
      return { id: st.id, name: st.name, email: demo?.email ?? `${st.group} guruhi`, plan: st.funding, status: LIVE_STATUS[st.status] ?? "active", date: demo?.date ?? "—" };
    });
    const canAssign = ["owner", "rector", "dept_head"].includes(user?.role ?? "");
    return { ...base, directory: { ...base.directory, rows, canChangeStatus: false, profileLink: "/people", canAssign } };
  }, [base, live, sq.data, user?.role]);
  const [toast, setToast] = useState<string | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  if (isMobile) {
    return (
      <MobileDashboard
        cfg={cfg}
        role={user?.role ?? ""}
        storageKey={`tizims-edu-dir-v2:${user?.id ?? "anon"}`}
        toast={toast}
        onToast={setToast}
      />
    );
  }

  return (
    <div className="text-ts-fg">
      <div className="flex items-center justify-between">
        <p className="ts-reveal text-lg font-medium sm:text-xl">{cfg.title}</p>
        <nav className="ts-reveal max-sm:hidden" style={delay(60)}>
          <ol className="flex items-center gap-1.5 text-sm text-ts-sub sm:gap-2.5">
            <li>{organization?.slug?.toUpperCase() ?? "TIZIMS"}</li>
            <li>
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li className="text-ts-fg">{cfg.title}</li>
          </ol>
        </nav>
      </div>

      <div className="mt-4 grid gap-4 sm:mt-5 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
        {cfg.kpis.map((k, i) => (
          <KpiCard key={k.title} kpi={k} style={delay(80 + i * 70)} />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-7">
        <div className="xl:col-span-4">
          <AcquisitionCard data={cfg.acquisition} onToast={setToast} />
        </div>
        <div className="xl:col-span-3">
          <GrowthCard data={cfg.growth} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DirectoryCard data={cfg.directory} storageKey={`tizims-edu-dir-v2:${user?.id ?? "anon"}`} onToast={setToast} />
        </div>
        <GoalsCard title={cfg.goalsTitle} goals={cfg.goals} />
      </div>

      {toast && (
        <div className="ts-pop fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg border border-ts-line bg-ts-card px-4 py-2.5 text-sm text-ts-fg shadow-xl">
          <Check className="h-4 w-4 text-emerald-500" /> {toast}
        </div>
      )}
    </div>
  );
}

/* ───────────── KPI ───────────── */

function KpiCard({ kpi, style }: { kpi: Kpi; style?: CSSProperties }) {
  const Icon = ICONS[kpi.icon];
  const menu = useMenu();
  const nav = useNavigate();
  return (
    <Card className="ts-reveal relative gap-2 py-4" style={style}>
      <div className="flex items-center justify-between px-4">
        <div className="whitespace-nowrap text-base font-medium leading-snug">{kpi.title}</div>
        <IconButton title="Amallar" onClick={menu.toggle}>
          <Ellipsis className="h-4 w-4" />
        </IconButton>
        {menu.open && (
          <Dropdown onClose={menu.close} className="right-4 top-12">
            <MenuItem onClick={() => nav(kpi.link)}>Batafsil ko'rish</MenuItem>
            <MenuItem
              onClick={() => {
                downloadCsv(kpi.title, [["Ko'rsatkich", "Qiymat", "O'zgarish"], [kpi.title, kpi.value, kpi.delta]]);
                menu.close();
              }}
            >
              CSV eksport
            </MenuItem>
          </Dropdown>
        )}
      </div>
      <div className="flex flex-col gap-4 px-4">
        <div className="flex items-center gap-2">
          <span className="text-3xl font-semibold">{kpi.value}</span>
          <Badge>{kpi.delta}</Badge>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-ts-line bg-ts-tile px-3 py-2 text-sm">
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate font-medium">{kpi.caption}</span>
        </div>
      </div>
    </Card>
  );
}

/* ───────────── Rolling number (NumberFlow uslubi) ───────────── */

export function RollingNumber({ value }: { value: number }) {
  const chars = String(value).split("");
  return (
    <span className="inline-flex tabular-nums">
      {chars.map((c, idx) => {
        const key = chars.length - idx;
        if (!/\d/.test(c)) return <span key={`s${key}`}>{c}</span>;
        const d = Number(c);
        return (
          <span key={key} className="ts-digit">
            <span style={{ transform: `translateY(-${d}em)` }}>
              {Array.from({ length: 10 }, (_, n) => (
                <span key={n}>{n}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function useLive(base: number) {
  const [value, setValue] = useState(base);
  const [trend, setTrend] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    setValue(base);
    const step = Math.max(1, Math.round(base * 0.025));
    const id = setInterval(() => {
      setValue((v) => {
        const next = Math.max(1, v + Math.round((Math.random() - 0.42) * step * 2));
        setTrend(next > v ? "up" : next < v ? "down" : null);
        return next;
      });
    }, 2600);
    return () => clearInterval(id);
  }, [base]);
  return { value, trend };
}

/* ───────────── Acquisition (stream chart) ───────────── */

const STREAM_PATHS = [
  {
    d: "M 0 43 C 50 43, 50 37, 100 37 C 150 37, 150 27, 200 27 C 250 27, 250 39, 300 39 C 375 39, 375 16, 450 16 C 500 16, 500 25, 550 25 C 575 25, 575 31, 600 31 L 600 69 C 575 69, 575 75, 550 75 C 500 75, 500 84, 450 84 C 375 84, 375 61, 300 61 C 250 61, 250 73, 200 73 C 150 73, 150 63, 100 63 C 50 63, 50 57, 0 57 Z",
    cls: "opacity-10 hover:opacity-30",
  },
  {
    d: "M 0 45 C 50 45, 50 41, 100 41 C 150 41, 150 32, 200 32 C 250 32, 250 42, 300 42 C 375 42, 375 24, 450 24 C 500 24, 500 31, 550 31 C 575 31, 575 36, 600 36 L 600 64 C 575 64, 575 69, 550 69 C 500 69, 500 76, 450 76 C 375 76, 375 58, 300 58 C 250 58, 250 68, 200 68 C 150 68, 150 59, 100 59 C 50 59, 50 55, 0 55 Z",
    cls: "opacity-40 hover:opacity-60",
  },
  {
    d: "M 0 47 C 50 47, 50 45, 100 45 C 150 45, 150 37, 200 37 C 250 37, 250 45, 300 45 C 375 45, 375 32, 450 32 C 500 32, 500 37, 550 37 C 575 37, 575 41, 600 41 L 600 59 C 575 59, 575 63, 550 63 C 500 63, 500 68, 450 68 C 375 68, 375 55, 300 55 C 250 55, 250 63, 200 63 C 150 63, 150 55, 100 55 C 50 55, 50 53, 0 53 Z",
    cls: "opacity-80 hover:opacity-100",
  },
];

function AcquisitionCard({ data, onToast }: { data: Acquisition; onToast: (m: string) => void }) {
  const live = useLive(data.liveBase);
  const menu = useMenu();
  const positions = ["16.6%", "50%", "83.3%"];
  return (
    <Card className="h-full gap-4 overflow-hidden py-4">
      <div className="flex justify-between px-4">
        <div className="ts-reveal" style={delay(200)}>
          <div className="text-lg font-medium">{data.title}</div>
          <div className="text-sm text-ts-sub">{data.description}</div>
        </div>
        <div className="ts-pop relative" style={delay(260)}>
          <IconButton title="Amallar" onClick={menu.toggle}>
            <EllipsisVertical className="h-4 w-4" />
          </IconButton>
          {menu.open && (
            <Dropdown onClose={menu.close} className="right-0 top-10">
              <MenuItem
                onClick={() => {
                  downloadCsv(data.title, [
                    ["Ko'rsatkich", "Qiymat"],
                    ...data.stats.map((s) => [s.label, s.value + s.suffix]),
                    [data.liveLabel, live.value],
                    ...data.badges.map((b, i) => [`Bosqich ${i + 1}`, `${data.topHint} ${b.top} / ${data.bottomHint} ${b.bottom}`]),
                  ]);
                  onToast("Hisobot yuklab olindi");
                  menu.close();
                }}
              >
                CSV eksport
              </MenuItem>
            </Dropdown>
          )}
        </div>
      </div>
      <div className="px-4 pt-4">
        <div className="flex flex-wrap gap-6 xl:gap-12">
          {data.stats.map((s, i) => (
            <div key={s.label} className="ts-reveal flex flex-col gap-1" style={delay(300 + i * 80)}>
              <span className="inline-flex h-9 items-center text-3xl font-semibold tabular-nums tracking-tight">
                <span>{s.value}</span>
                <span>{s.suffix}</span>
              </span>
              <span className="text-sm font-medium text-ts-sub">{s.label}</span>
            </div>
          ))}
          <div className="ts-reveal flex flex-col gap-1" style={delay(460)}>
            <span
              className={cn(
                "inline-flex h-9 items-center text-3xl font-semibold tracking-tight transition-colors duration-500",
                live.trend === "up" ? "text-emerald-500" : live.trend === "down" ? "text-ts-red" : "text-ts-fg",
              )}
            >
              <RollingNumber value={live.value} />
            </span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-ts-sub">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              {data.liveLabel}
            </span>
          </div>
        </div>
        <div className="ts-reveal-lg relative -mx-4 mt-8" style={delay(420)}>
          <svg viewBox="0 0 600 100" preserveAspectRatio="none" className="ts-grow-center h-[178px] w-full select-none" style={delay(520)}>
            {STREAM_PATHS.map((p) => (
              <path key={p.cls} d={p.d} fill="var(--ts-blue3)" className={cn("cursor-pointer transition-opacity duration-200", p.cls)} />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0">
            {data.badges.map((b, i) => (
              <div
                key={i}
                className="absolute bottom-0 top-0 flex -translate-x-1/2 flex-col items-center justify-between"
                style={{ left: positions[i] }}
              >
                <span className="ts-pop pointer-events-auto" style={delay(800 + i * 90)}>
                  <Badge primary={b.primary} title={data.topHint}>
                    {b.top}
                  </Badge>
                </span>
                <div className="h-full border-l border-dashed border-ts-line2 py-6" />
                <span className="ts-pop pointer-events-auto" style={delay(860 + i * 90)}>
                  <Badge title={data.bottomHint}>{b.bottom}</Badge>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ───────────── Growth (striped stacked bars) ───────────── */

function niceMax(v: number) {
  if (v <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => n <= x) ?? 10;
  return step * pow;
}

function GrowthCard({ data, className }: { data: Growth; className?: string }) {
  const [period, setPeriod] = useState<"monthly" | "quarterly">("monthly");
  const menu = useMenu();
  const [hover, setHover] = useState<number | null>(null);
  const series = data[period];
  const totals = series.a.map((a, i) => a + series.b[i]);
  const max = niceMax(Math.max(...totals));
  const ticks = Array.from({ length: 6 }, (_, i) => Math.round((max / 5) * (5 - i)));
  const H = 220;
  const px = (v: number) => (v / max) * H;
  const periodLabel = period === "monthly" ? "Oylik" : "Choraklik";
  const desc = period === "monthly" ? data.description : data.description.replace("9 oy", "3 chorak");

  return (
    <Card className={cn("h-full gap-4 py-4", className)}>
      <div className="flex items-start justify-between gap-3 px-4">
        <div className="ts-reveal flex flex-col gap-0.5" style={delay(240)}>
          <div className="text-lg font-medium tracking-tight">{data.title}</div>
          <div className="text-sm text-ts-sub">
            <span key={desc} className="ts-swap">
              {desc}
            </span>
          </div>
        </div>
        <div className="ts-pop relative" style={delay(300)}>
          <button
            type="button"
            onClick={menu.toggle}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-ts-line2 bg-ts-input px-2.5 text-sm font-medium transition-colors hover:bg-ts-hover"
          >
            <span key={period} className="ts-swap">
              {periodLabel}
            </span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {menu.open && (
            <Dropdown onClose={menu.close} className="right-0 top-10 min-w-[140px]">
              {(["monthly", "quarterly"] as const).map((p) => (
                <MenuItem
                  key={p}
                  onClick={() => {
                    setPeriod(p);
                    menu.close();
                  }}
                >
                  <span className="flex-1">{p === "monthly" ? "Oylik" : "Choraklik"}</span>
                  {p === period && <Check className="h-4 w-4" />}
                </MenuItem>
              ))}
            </Dropdown>
          )}
        </div>
      </div>

      <div className="ts-reveal-lg min-h-0 grow px-4" style={delay(380)}>
        <div className="flex">
          <div className="relative w-10 shrink-0" style={{ height: H }}>
            {ticks.map((t) => (
              <span key={t} className="absolute right-3 -translate-y-1/2 text-xs text-ts-sub" style={{ top: H - px(t) }}>
                {t}
              </span>
            ))}
          </div>
          <div className="relative flex-1">
            <div className="relative" style={{ height: H }}>
              <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${series.labels.length}, minmax(0, 1fr))` }}>
                {series.labels.map((label, i) => {
                  const a = series.a[i];
                  const b = series.b[i];
                  const right = i >= series.labels.length / 2;
                  return (
                    <div
                      key={`${period}-${label}`}
                      className="relative flex cursor-pointer flex-col items-center justify-end"
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                    >
                      {hover === i && <div className="absolute inset-y-0 left-1/2 w-[44px] max-w-full -translate-x-1/2 rounded-md bg-ts-hover opacity-60" />}
                      <div className="ts-grow-y relative flex w-[32px] max-w-[70%] flex-col items-stretch gap-1" style={delay(500 + i * 55)}>
                        <div className="ts-stripes rounded-[4px]" style={{ height: Math.max(2, px(a) - 4) }} />
                        <div className="rounded-[4px] bg-ts-blue2" style={{ height: Math.max(3, px(b)) }} />
                      </div>
                      {hover === i && (
                        <div
                          className="ts-pop absolute z-10 min-w-[160px] rounded-lg border border-ts-line bg-ts-card px-2.5 py-1.5 text-xs shadow-xl"
                          style={{ bottom: Math.min(px(a + b) + 10, H - 40), ...(right ? { right: "55%" } : { left: "55%" }) }}
                        >
                          <div className="mb-1 font-medium">{label}</div>
                          <div className="flex items-center gap-2">
                            <span className="ts-stripes h-2.5 w-2.5 rounded-[2px]" />
                            <span className="flex-1 text-ts-sub">{data.aLabel}</span>
                            <span className="font-medium tabular-nums">{a.toLocaleString("en-US")}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-[2px] bg-ts-blue2" />
                            <span className="flex-1 text-ts-sub">{data.bLabel}</span>
                            <span className="font-medium tabular-nums">{b.toLocaleString("en-US")}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 grid" style={{ gridTemplateColumns: `repeat(${series.labels.length}, minmax(0, 1fr))` }}>
              {series.labels.map((l) => (
                <span key={l} className="text-center text-xs text-ts-sub">
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ───────────── Directory table ───────────── */

const STATUS_DOT: Record<RowStatus, string> = {
  active: "bg-emerald-500",
  warning: "bg-amber-500",
  suspended: "bg-ts-red",
  inactive: "bg-ts-muted",
};

const STATUS_ORDER: RowStatus[] = ["active", "warning", "suspended", "inactive"];

function Checkbox({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "flex h-4 w-4 items-center justify-center rounded-[4px] border transition-colors",
        checked || indeterminate ? "border-ts-blue bg-ts-blue text-white" : "border-ts-line2 bg-ts-input",
      )}
    >
      {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      {!checked && indeterminate && <span className="h-0.5 w-2 rounded bg-white" />}
    </button>
  );
}

function DirectoryCard({ data, storageKey, onToast }: { data: Directory; storageKey: string; onToast: (m: string) => void }) {
  const nav = useNavigate();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RowStatus | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const filterMenu = useMenu();
  const [overrides, setOverrides] = useState<Record<string, RowStatus>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Record<string, RowStatus>;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(overrides));
    } catch {
      /* quota */
    }
  }, [overrides, storageKey]);

  const isSubjects = data.columns[1] === "Fan";
  const rows: DirectoryRow[] = data.rows.map((r) => ({ ...r, status: overrides[r.id] ?? r.status }));
  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (r) => (filter === "all" || r.status === filter) && (!q || [r.id, r.name, r.email, r.plan].some((v) => v.toLowerCase().includes(q))),
  );
  const allChecked = visible.length > 0 && visible.every((r) => selected.has(r.id));
  const someChecked = visible.some((r) => selected.has(r.id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Card className="ts-reveal h-full gap-4 py-4" style={delay(520)}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4">
        <div className="flex flex-col gap-0.5">
          <div className="text-base font-medium leading-snug">{data.title}</div>
          {selected.size > 0 && (
            <div className="ts-swap text-sm text-ts-sub">
              {selected.size} ta tanlandi ·{" "}
              <button
                className="text-ts-blue hover:underline"
                onClick={() => {
                  downloadCsv(data.title, [
                    [...data.columns],
                    ...rows.filter((r) => selected.has(r.id)).map((r) => [r.id, r.name, r.plan, data.statusLabels[r.status], r.date]),
                  ]);
                  onToast("Tanlanganlar eksport qilindi");
                }}
              >
                eksport
              </button>
            </div>
          )}
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ts-sub" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={data.placeholder}
              className="h-9 w-full rounded-md border border-ts-line2 bg-ts-input pl-9 pr-8 text-sm text-ts-fg outline-none transition-colors placeholder:text-ts-sub focus:border-ts-muted"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ts-sub hover:text-ts-fg">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="relative">
            <IconButton title="Filtr" onClick={filterMenu.toggle} className={cn("h-9 w-9", filter !== "all" && "border-ts-blue text-ts-blue")}>
              <SlidersHorizontal className="h-4 w-4" />
            </IconButton>
            {filterMenu.open && (
              <Dropdown onClose={filterMenu.close} className="right-0 top-11 min-w-[190px]">
                {(["all", ...STATUS_ORDER] as const).map((s) => (
                  <MenuItem
                    key={s}
                    onClick={() => {
                      setFilter(s);
                      filterMenu.close();
                    }}
                  >
                    {s !== "all" && <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[s])} />}
                    <span className="flex-1">{s === "all" ? "Barcha holatlar" : data.statusLabels[s]}</span>
                    {filter === s && <Check className="h-4 w-4" />}
                  </MenuItem>
                ))}
              </Dropdown>
            )}
          </div>
        </div>
      </div>

      <div className="px-4">
        <div className="relative w-full overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ts-line bg-ts-tile">
                <th className="h-10 w-12 px-2 text-left align-middle">
                  <Checkbox
                    label="Hammasini tanlash"
                    checked={allChecked}
                    indeterminate={!allChecked && someChecked}
                    onChange={() =>
                      setSelected((s) => {
                        const n = new Set(s);
                        if (allChecked) visible.forEach((r) => n.delete(r.id));
                        else visible.forEach((r) => n.add(r.id));
                        return n;
                      })
                    }
                  />
                </th>
                {data.columns.map((c, i) => (
                  <th key={c} className={cn("h-10 whitespace-nowrap px-2 text-left align-middle font-medium text-ts-fg", i === 0 && "w-32")}>
                    {c}
                  </th>
                ))}
                <th className="h-10 w-12 px-2" />
              </tr>
            </thead>
            <tbody>
              {visible.map((r, i) => {
                const isSel = selected.has(r.id);
                return (
                  <tr
                    key={r.id}
                    className={cn("ts-reveal border-b border-ts-line transition-colors last:border-0", isSel ? "bg-ts-hover" : "hover:bg-ts-tile")}
                    style={delay(600 + i * 50)}
                  >
                    <td className="p-2 align-middle">
                      <Checkbox label={`${r.name} tanlash`} checked={isSel} onChange={() => toggle(r.id)} />
                    </td>
                    <td className="ts-mono whitespace-nowrap p-2 align-middle text-sm">{r.id}</td>
                    <td className="whitespace-nowrap p-2 align-middle">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-ts-chip">
                          {isSubjects ? <BookOpen className="h-4 w-4 text-ts-sub" /> : <UserIcon className="h-4 w-4 text-ts-sub" />}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium">{r.name}</span>
                          <span className="text-xs text-ts-sub">{r.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap p-2 align-middle text-ts-sub">{r.plan}</td>
                    <td className="whitespace-nowrap p-2 align-middle">
                      <div className="flex items-center gap-1.5 text-sm">
                        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[r.status])} />
                        <span className="font-medium">{data.statusLabels[r.status]}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap p-2 align-middle text-ts-sub">{r.date}</td>
                    <td className="relative whitespace-nowrap p-2 text-right align-middle">
                      <IconButton ghost title="Amallar" onClick={() => setRowMenu((m) => (m === r.id ? null : r.id))}>
                        <Ellipsis className="h-4 w-4" />
                      </IconButton>
                      {rowMenu === r.id && (
                        <Dropdown onClose={() => setRowMenu(null)} className="right-2 top-11 text-left">
                          {data.profileLink && (
                            <MenuItem onClick={() => nav(data.profileLink!)}>
                              <UserIcon className="h-4 w-4 text-ts-sub" /> Profilni ochish
                            </MenuItem>
                          )}
                          {(data.canChangeStatus || data.canAssign) && (
                            <MenuItem onClick={() => nav("/tasks/all")}>
                              <ClipboardCheck className="h-4 w-4 text-ts-sub" /> Vazifa biriktirish
                            </MenuItem>
                          )}
                          <MenuItem
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(r.id);
                              } catch {
                                /* ignore */
                              }
                              onToast(`${r.id} nusxalandi`);
                              setRowMenu(null);
                            }}
                          >
                            <ClipboardCheck className="h-4 w-4 text-ts-sub" /> ID'ni nusxalash
                          </MenuItem>
                          {data.canChangeStatus && (
                            <>
                              <div className="my-1 h-px bg-ts-line" />
                              {STATUS_ORDER.filter((s) => s !== r.status).map((s) => (
                                <MenuItem
                                  key={s}
                                  danger={s === "suspended"}
                                  onClick={() => {
                                    setOverrides((o) => ({ ...o, [r.id]: s }));
                                    onToast(`${r.name}: ${data.statusLabels[s]}`);
                                    setRowMenu(null);
                                  }}
                                >
                                  <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[s])} /> {data.statusLabels[s]}
                                </MenuItem>
                              ))}
                            </>
                          )}
                        </Dropdown>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-sm text-ts-sub">
                    Hech narsa topilmadi.{" "}
                    <button
                      className="text-ts-blue hover:underline"
                      onClick={() => {
                        setQuery("");
                        setFilter("all");
                      }}
                    >
                      Filtrlarni tozalash
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

/* ───────────── Goals ───────────── */

function GoalsCard({ title, goals, className }: { title: string; goals: Goal[]; className?: string }) {
  const [ready, setReady] = useState(false);
  const menu = useMenu();
  const [sort, setSort] = useState<"default" | "desc">("default");
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 650);
    return () => clearTimeout(t);
  }, []);
  const avg = Math.round(goals.reduce((s, g) => s + g.value, 0) / goals.length);
  const list = sort === "desc" ? [...goals].sort((a, b) => b.value - a.value) : goals;

  return (
    <Card className={cn("ts-reveal h-full gap-4 py-4", className)} style={delay(600)}>
      <div className="flex items-start justify-between gap-2 px-4">
        <div>
          <div className="text-base font-medium leading-snug">{title}</div>
          <div className="text-sm text-ts-sub">O'rtacha {avg}% bajarildi</div>
        </div>
        <div className="relative">
          <IconButton title="Amallar" onClick={menu.toggle}>
            <EllipsisVertical className="h-4 w-4" />
          </IconButton>
          {menu.open && (
            <Dropdown onClose={menu.close} className="right-0 top-10 min-w-[200px]">
              <MenuItem
                onClick={() => {
                  setSort((s) => (s === "desc" ? "default" : "desc"));
                  menu.close();
                }}
              >
                <span className="flex-1">Natija bo'yicha saralash</span>
                {sort === "desc" && <Check className="h-4 w-4" />}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  downloadCsv(title, [["Maqsad", "Tavsif", "Bajarilish %"], ...goals.map((g) => [g.title, g.subtitle, g.value])]);
                  menu.close();
                }}
              >
                CSV eksport
              </MenuItem>
            </Dropdown>
          )}
        </div>
      </div>
      <div className="grid gap-2.5 px-4">
        {list.map((g) => {
          const Icon = ICONS[g.icon];
          return (
            <div key={g.title} className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ts-chip">
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0">
                <p className="font-medium">{g.title}</p>
                <p className="-mt-px truncate text-sm text-ts-sub">{g.subtitle}</p>
              </div>
              <div className="flex flex-1 items-center justify-end gap-3">
                <div className="relative flex h-1.5 w-full max-w-[112px] items-center overflow-hidden rounded-full bg-ts-chip">
                  <div className="h-full rounded-full bg-ts-blue transition-[width] duration-1000 ease-out" style={{ width: ready ? `${g.value}%` : "0%" }} />
                </div>
                <span className="w-10 shrink-0 text-end text-sm font-medium tabular-nums">{g.value}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ═════════════ Mobil (app) ko'rinish — < lg ═════════════ */

function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between px-1">
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}

function SoftBadge({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "green" | "amber" | "red" | "gray" }) {
  const tones = {
    blue: "bg-[#E8F1FF] text-ts-blue3",
    green: "bg-[#E8F8EF] text-emerald-600",
    amber: "bg-[#FFF4E5] text-amber-600",
    red: "bg-[#FEECEC] text-ts-red",
    gray: "bg-ts-chip text-ts-sub",
  } as const;
  return <span className={cn("inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold", tones[tone])}>{children}</span>;
}

const STATUS_TONE: Record<RowStatus, "green" | "amber" | "red" | "gray"> = {
  active: "green",
  warning: "amber",
  suspended: "red",
  inactive: "gray",
};

function MobileDashboard({
  cfg,
  role,
  storageKey,
  toast,
  onToast,
}: {
  cfg: DashboardConfig;
  role: string;
  storageKey: string;
  toast: string | null;
  onToast: (m: string) => void;
}) {
  const nav = useNavigate();
  const [hidden, setHidden] = useState(false);
  const [hero, ...rest] = cfg.kpis;
  const HeroIcon = ICONS[hero.icon];
  const canTasks = eduRouteAllowed(role, "/tasks");

  const exportAll = () => {
    downloadCsv(cfg.title, [["Ko'rsatkich", "Qiymat", "O'zgarish", "Izoh"], ...cfg.kpis.map((k) => [k.title, k.value, k.delta, k.caption])]);
    onToast("Hisobot yuklab olindi");
  };

  return (
    <div className="space-y-6 pt-1 text-ts-fg">
      {/* Asosiy karta */}
      <section className="ts-hero ts-reveal relative overflow-hidden rounded-[28px] p-5">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/[0.06]" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-white/[0.04]" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] text-white/60">{hero.title}</p>
            <div className="mt-1.5 flex items-center gap-2.5">
              <span className="truncate text-[34px] font-semibold leading-none tracking-tight tabular-nums">
                {hidden ? "••••••" : hero.value}
              </span>
              <button
                onClick={() => setHidden((v) => !v)}
                aria-label={hidden ? "Ko'rsatish" : "Yashirish"}
                className="rounded-full p-1 text-white/70 active:bg-white/10"
              >
                {hidden ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            </div>
          </div>
          <span className="ts-hero-chip shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold">{hero.delta}</span>
        </div>
        <p className="relative mt-3 flex items-center gap-1.5 text-xs text-white/60">
          <HeroIcon className="h-3.5 w-3.5" /> {hero.caption}
        </p>
        <div className="relative mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={() => nav(canTasks ? "/tasks" : hero.link)}
            className="ts-hero-pill flex h-12 items-center justify-center gap-2 rounded-full text-[13px] font-semibold transition-transform active:scale-[0.97]"
          >
            <ClipboardCheck className="h-[18px] w-[18px]" />
            {canTasks ? "Vazifalar" : "Batafsil"}
          </button>
          <button
            onClick={exportAll}
            className="ts-hero-pill flex h-12 items-center justify-center gap-2 rounded-full text-[13px] font-semibold transition-transform active:scale-[0.97]"
          >
            <Download className="h-[18px] w-[18px]" />
            Hisobot
          </button>
        </div>
      </section>

      <div className="ts-reveal" style={delay(80)}>
        <GlobalSearchBar variant="pill" hotkey={false} />
      </div>

      {/* KPI karusel */}
      {rest.length > 0 && (
        <section className="ts-reveal" style={delay(140)}>
          <SectionHead title={cfg.title} />
          <div className="ts-scroll-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
            {rest.map((k) => {
              const Icon = ICONS[k.icon];
              return (
                <button
                  key={k.title}
                  onClick={() => nav(k.link)}
                  className="flex w-[68%] max-w-[260px] shrink-0 snap-start flex-col rounded-3xl bg-ts-tile p-4 text-left transition-transform active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ts-card">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <SoftBadge>{k.delta}</SoftBadge>
                  </div>
                  <div className="mt-4 text-[26px] font-semibold leading-none tracking-tight tabular-nums">{k.value}</div>
                  <div className="mt-1.5 text-[13px] font-medium">{k.title}</div>
                  <div className="mt-0.5 truncate text-xs text-ts-sub">{k.caption}</div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <MobileAcquisition data={cfg.acquisition} />

      <section className="ts-reveal" style={delay(260)}>
        <GrowthCard data={cfg.growth} className="rounded-3xl border-0 bg-ts-tile" />
      </section>

      <MobileDirectory data={cfg.directory} storageKey={storageKey} onToast={onToast} />

      <section>
        <GoalsCard title={cfg.goalsTitle} goals={cfg.goals} className="rounded-3xl border-0 bg-ts-tile" />
      </section>

      {toast && (
        <div className="ts-pop fixed inset-x-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-50 flex items-center gap-2 rounded-2xl bg-ts-inv px-4 py-3 text-sm font-medium text-ts-invfg shadow-xl">
          <Check className="h-4 w-4 text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  );
}

/** "Current tracking" uslubidagi jarayon kartasi: statistikalar + bosqichlar trekeri. */
function MobileAcquisition({ data }: { data: Acquisition }) {
  const live = useLive(data.liveBase);
  const steps = data.badges;
  const doneUpTo = Math.max(0, steps.findIndex((b) => b.primary));
  const pct = steps.length > 1 ? (doneUpTo / (steps.length - 1)) * 100 : 0;

  return (
    <section className="ts-reveal" style={delay(200)}>
      <SectionHead title={data.title} />
      <div className="rounded-3xl bg-ts-tile p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] text-ts-sub">{data.liveLabel}</div>
            <div
              className={cn(
                "mt-0.5 text-[22px] font-semibold leading-tight transition-colors duration-500",
                live.trend === "up" ? "text-emerald-500" : live.trend === "down" ? "text-ts-red" : "text-ts-fg",
              )}
            >
              <RollingNumber value={live.value} />
            </div>
          </div>
          <SoftBadge>
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
            </span>
            Jonli
          </SoftBadge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {data.stats.map((s, i) => (
            <div key={s.label} className={cn(i % 2 === 1 && "text-right")}>
              <div className="text-[11px] text-ts-sub">{s.label}</div>
              <div className="mt-0.5 text-[15px] font-semibold tabular-nums">
                {s.value}
                {s.suffix}
              </div>
            </div>
          ))}
        </div>

        {steps.length > 0 && (
          <div className="mt-5">
            <div className="relative mx-3 h-6">
              <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-ts-line2" />
              <div
                className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-ts-inv transition-[width] duration-1000 ease-out"
                style={{ width: `${pct}%` }}
              />
              {steps.map((_, i) => {
                const done = i <= doneUpTo;
                const left = steps.length > 1 ? (i / (steps.length - 1)) * 100 : 0;
                return (
                  <span
                    key={i}
                    className={cn(
                      "absolute top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full",
                      done ? "ts-ring-tile bg-ts-inv text-ts-invfg" : "bg-ts-line2",
                    )}
                    style={{ left: `${left}%` }}
                  >
                    {done && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                );
              })}
            </div>
            <div className="mt-2 grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
              {steps.map((b, i) => (
                <div key={i} className={cn(i === 0 ? "text-left" : i === steps.length - 1 ? "text-right" : "text-center")}>
                  <div className={cn("text-xs font-semibold", i > doneUpTo && "text-ts-sub")}>
                    {data.topHint} {b.top}
                  </div>
                  <div className="text-[11px] text-ts-muted">
                    {data.bottomHint} {b.bottom}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** Jadval o'rniga "Recent activities" uslubidagi kartalar ro'yxati. */
function MobileDirectory({ data, storageKey, onToast }: { data: Directory; storageKey: string; onToast: (m: string) => void }) {
  const nav = useNavigate();
  const [filter, setFilter] = useState<RowStatus | "all">("all");
  const [expanded, setExpanded] = useState(false);
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, RowStatus>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "{}") as Record<string, RowStatus>;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(overrides));
    } catch {
      /* quota */
    }
  }, [overrides, storageKey]);

  const rows = data.rows.map((r) => ({ ...r, status: overrides[r.id] ?? r.status }));
  const visible = rows.filter((r) => filter === "all" || r.status === filter);
  const shown = expanded ? visible : visible.slice(0, 3);
  const [idCol, nameCol, planCol, statusCol, dateCol] = data.columns;

  return (
    <section className="ts-reveal" style={delay(320)}>
      <SectionHead
        title={data.title}
        action={
          visible.length > 3 && (
            <button onClick={() => setExpanded((v) => !v)} className="text-[13px] font-medium text-ts-sub active:text-ts-fg">
              {expanded ? "Yig'ish" : `Barchasi (${visible.length})`}
            </button>
          )
        }
      />
      <div className="ts-scroll-none -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
        {(["all", ...STATUS_ORDER] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors",
              filter === s ? "bg-ts-inv text-ts-invfg" : "border border-ts-line bg-ts-card text-ts-sub",
            )}
          >
            {s !== "all" && <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[s])} />}
            {s === "all" ? "Barchasi" : data.statusLabels[s]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {shown.map((r) => (
          <div key={r.id} className="relative rounded-3xl bg-ts-tile p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ts-card">
                {nameCol === "Fan" ? <BookOpen className="h-[18px] w-[18px]" /> : <UserIcon className="h-[18px] w-[18px]" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{r.name}</div>
                <div className="truncate text-xs text-ts-sub">{r.email}</div>
              </div>
              <button
                onClick={() => setRowMenu((m) => (m === r.id ? null : r.id))}
                aria-label="Amallar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ts-card active:bg-ts-hover"
              >
                <Ellipsis className="h-4 w-4" />
              </button>
              {rowMenu === r.id && (
                <Dropdown onClose={() => setRowMenu(null)} className="right-3 top-[60px] min-w-[200px] rounded-2xl p-1.5">
                  {data.profileLink && (
                    <MenuItem onClick={() => nav(data.profileLink!)}>
                      <UserIcon className="h-4 w-4 text-ts-sub" /> Profilni ochish
                    </MenuItem>
                  )}
                  {(data.canChangeStatus || data.canAssign) && (
                    <MenuItem onClick={() => nav("/tasks/all")}>
                      <ClipboardCheck className="h-4 w-4 text-ts-sub" /> Vazifa biriktirish
                    </MenuItem>
                  )}
                  <MenuItem
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(r.id);
                      } catch {
                        /* ignore */
                      }
                      onToast(`${r.id} nusxalandi`);
                      setRowMenu(null);
                    }}
                  >
                    <ClipboardCheck className="h-4 w-4 text-ts-sub" /> ID'ni nusxalash
                  </MenuItem>
                  {data.canChangeStatus && (
                    <>
                      <div className="my-1 h-px bg-ts-line" />
                      {STATUS_ORDER.filter((s) => s !== r.status).map((s) => (
                        <MenuItem
                          key={s}
                          danger={s === "suspended"}
                          onClick={() => {
                            setOverrides((o) => ({ ...o, [r.id]: s }));
                            onToast(`${r.name}: ${data.statusLabels[s]}`);
                            setRowMenu(null);
                          }}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[s])} /> {data.statusLabels[s]}
                        </MenuItem>
                      ))}
                    </>
                  )}
                </Dropdown>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-ts-line pt-3">
              <div>
                <div className="text-[11px] text-ts-sub">{idCol}</div>
                <div className="ts-mono mt-0.5 text-[13px] font-semibold">{r.id}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-ts-sub">{planCol}</div>
                <div className="mt-0.5 truncate text-[13px] font-semibold">{r.plan}</div>
              </div>
              <div>
                <div className="mb-1 text-[11px] text-ts-sub">{statusCol}</div>
                <SoftBadge tone={STATUS_TONE[r.status]}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {data.statusLabels[r.status]}
                </SoftBadge>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-ts-sub">{dateCol}</div>
                <div className="mt-0.5 text-[13px] font-semibold">{r.date}</div>
              </div>
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="rounded-3xl bg-ts-tile px-4 py-10 text-center text-sm text-ts-sub">
            Hech narsa topilmadi.{" "}
            <button className="font-medium text-ts-blue" onClick={() => setFilter("all")}>
              Filtrni tozalash
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
