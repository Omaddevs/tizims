import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Building2,
  ChartColumn,
  Check,
  ChevronDown,
  Contact,
  Copy,
  Database,
  Download,
  Ellipsis,
  FolderOpen,
  GraduationCap,
  HardDrive,
  KeyRound,
  Layers,
  LifeBuoy,
  Mail,
  MapPin,
  Phone,
  Pill,
  Search,
  Server,
  ShieldCheck,
  Store,
  Users,
  Wallet,
  Warehouse,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import { cn, roleLabel } from "../lib/utils";
import { useIsMobile } from "../lib/useMedia";
import { MODULES } from "../core/catalog";
import { useTenants, type TenantView } from "./platform/Tenants";
import { PLATFORM_AUDIT } from "../data/platform";
import type { Organization } from "../core/types";
import { RollingNumber, downloadCsv, useLive } from "./EducationDashboard";

/* ───────────── Demo ma'lumotlar (deterministik) ───────────── */

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function series(n: number, seed: number, base: number, amp: number, trend: number) {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const wave = Math.sin(i / 2.3) * amp * 0.35 + Math.sin(i / 6.1) * amp * 0.25;
    return Math.max(1, Math.round(base + trend * i + wave + (r() - 0.5) * amp));
  });
}

const MONTHS = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];
function dayLabel(daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const MODULE_ICON: Record<string, LucideIcon> = {
  education: GraduationCap,
  crm: Contact,
  shop: Store,
  pharmacy: Pill,
  finance: Wallet,
  warehouse: Warehouse,
  documents: FolderOpen,
  analytics: ChartColumn,
};

const TYPE_META: Record<string, { label: string; icon: LucideIcon; grad: string; color: string }> = {
  university: { label: "Universitet", icon: GraduationCap, grad: "from-[#5998ff] to-[#1347df]", color: "var(--ts-blue3)" },
  shop: { label: "Do'kon", icon: Store, grad: "from-[#fbbf24] to-[#d97706]", color: "#f59e0b" },
  pharmacy: { label: "Apteka", icon: Pill, grad: "from-[#34d399] to-[#059669]", color: "#10b981" },
};
const typeMeta = (t: string) => TYPE_META[t] ?? { label: t, icon: Building2, grad: "from-[#a1a1a1] to-[#525252]", color: "#a1a1a1" };

const HEALTH: Record<string, number> = { iau: 98, "abc-shop": 91, medfarm: 76 };

function initialsOf(name: string) {
  const p = name.replace(/^(Dr\.|Prof\.|Rektor|Dekan)\s*/i, "").split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

type Tenant = {
  org: Organization;
  mods: string[];
  members: { id: string; name: string; role: string }[];
  plan: { name: string; tone: Tone };
  health: number;
};

const PLAN_META: Record<string, { name: string; tone: Tone }> = {
  enterprise: { name: "Enterprise", tone: "blue" },
  business: { name: "Business", tone: "gray" },
  starter: { name: "Starter", tone: "gray" },
};

/** API'dagi tashkilotni dashboard kartalari kutgan shaklga o'tkazish */
function toTenant(t: TenantView): Tenant {
  const org: Organization = {
    id: t.id,
    name: t.name,
    slug: t.slug,
    organizationType: t.type as Organization["organizationType"],
    email: t.email ?? t.ownerEmail,
    phone: t.phone,
    address: t.address,
    country: "UZ",
    timezone: "Asia/Tashkent",
    currency: "UZS",
    status: t.status as Organization["status"],
    primaryColor: "#0984E3",
    reportedHeadcount: t.seats,
    createdAt: t.createdAt,
    updatedAt: t.createdAt,
  };
  const health = t.status === "suspended" ? 0 : HEALTH[t.slug] ?? (t.billing === "overdue" ? 70 : 90);
  return { org, mods: t.modules, members: t.members, plan: PLAN_META[t.plan] ?? PLAN_META.starter, health };
}

/* ───────────── Primitivlar ───────────── */

const MobileCtx = createContext(false);

function Card({ className, children, style }: { className?: string; children: ReactNode; style?: CSSProperties }) {
  const mobile = useContext(MobileCtx);
  return (
    <div
      style={style}
      className={cn(
        "flex flex-col text-sm text-ts-fg",
        mobile ? "rounded-3xl bg-ts-tile" : "rounded-lg border border-ts-line bg-ts-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

type Tone = "blue" | "green" | "amber" | "red" | "gray";
const TONES: Record<Tone, string> = {
  blue: "bg-[#E8F1FF] text-ts-blue3",
  green: "bg-[#E8F8EF] text-emerald-600",
  amber: "bg-[#FFF4E5] text-amber-600",
  red: "bg-[#FEECEC] text-ts-red",
  gray: "bg-ts-chip text-ts-sub",
};

function Pill2({ children, tone = "gray", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold", TONES[tone], className)}>
      {children}
    </span>
  );
}

function PulseDot({ className = "bg-emerald-500" }: { className?: string }) {
  return (
    <span className="relative flex h-2 w-2">
      <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", className)} />
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", className)} />
    </span>
  );
}

function CardHead({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4">
      <div className="min-w-0">
        <div className="text-base font-medium leading-snug sm:text-lg">{title}</div>
        {sub && <div className="text-sm text-ts-sub">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function useOutside<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const t = setTimeout(() => document.addEventListener("mousedown", h), 0);
    document.addEventListener("keydown", k);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", k);
    };
  }, [onClose]);
  return ref;
}

/* ───────────── Sahifa ───────────── */

export function PlatformAdminPage() {
  const { user } = useApp();
  const isMobile = useIsMobile();
  const [raw, tq] = useTenants();
  const tenants = useMemo(() => raw.map(toTenant), [raw]);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  if (user?.role !== "super_admin") return <Navigate to="/" replace />;
  if (tq.error && !tq.data)
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-ts-fg">
        {tq.error}{" "}
        <button className="ml-2 underline" onClick={() => void tq.reload()}>
          Qayta urinish
        </button>
      </div>
    );

  const exportTenants = () => {
    downloadCsv("tizims-tashkilotlar", [
      ["Tashkilot", "Slug", "Tur", "Tarif", "A'zolar", "Modullar", "Salomatlik %"],
      ...tenants.map((t) => [t.org.name, t.org.slug, typeMeta(t.org.organizationType).label, t.plan.name, t.members.length, t.mods.join(" "), t.health]),
    ]);
    setToast("Hisobot yuklab olindi");
  };

  const gap = isMobile ? "mt-6 gap-6" : "mt-4 gap-4 sm:mt-5 sm:gap-5";

  return (
    <MobileCtx.Provider value={isMobile}>
      <div className="text-ts-fg">
        {isMobile ? <MobileHero tenants={tenants} onExport={exportTenants} /> : <DesktopHeader onExport={exportTenants} />}

        <KpiRow tenants={tenants} mobile={isMobile} />

        <div className={cn("grid grid-cols-1 xl:grid-cols-7", gap)}>
          <div className="xl:col-span-4">
            <TrafficCard />
          </div>
          <div className="xl:col-span-3">
            <DistributionCard tenants={tenants} />
          </div>
        </div>

        <div className={cn("grid grid-cols-1", gap)}>
          <TenantsCard tenants={tenants} mobile={isMobile} onToast={setToast} />
        </div>

        <div className={cn("grid grid-cols-1 xl:grid-cols-3", gap)}>
          <div className="xl:col-span-2">
            <ModulesCard tenants={tenants} />
          </div>
          <StatusCard />
        </div>

        <div className={cn("grid grid-cols-1", gap)}>
          <AuditCard />
        </div>

        {toast && (
          <div
            className={cn(
              "ts-pop fixed z-50 flex items-center gap-2 text-sm font-medium shadow-xl",
              isMobile
                ? "inset-x-4 bottom-[calc(96px+env(safe-area-inset-bottom))] rounded-2xl bg-ts-inv px-4 py-3 text-ts-invfg"
                : "bottom-5 right-5 rounded-lg border border-ts-line bg-ts-card px-4 py-2.5 text-ts-fg",
            )}
          >
            <Check className="h-4 w-4 text-emerald-500" /> {toast}
          </div>
        )}
      </div>
    </MobileCtx.Provider>
  );
}

function DesktopHeader({ onExport }: { onExport: () => void }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="ts-reveal">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-ts-sub">
          <Layers className="h-3.5 w-3.5" /> tizims.uz · control plane
        </div>
        <h1 className="mt-1 text-xl font-medium sm:text-2xl">Platforma boshqaruvi</h1>
      </div>
      <div className="ts-reveal flex items-center gap-2" style={delay(80)}>
        <span className="flex h-9 items-center gap-2 rounded-full border border-ts-line bg-ts-card px-3.5 text-sm">
          <PulseDot />
          Barcha tizimlar ishlayapti
        </span>
        <button
          onClick={onExport}
          className="flex h-9 items-center gap-2 rounded-full bg-ts-inv px-4 text-sm font-medium text-ts-invfg transition-transform active:scale-[0.97]"
        >
          <Download className="h-4 w-4" /> Hisobot
        </button>
      </div>
    </div>
  );
}

function MobileHero({ tenants, onExport }: { tenants: Tenant[]; onExport: () => void }) {
  const nav = useNavigate();
  const users = tenants.reduce((s, t) => s + t.members.length, 0);
  const links = tenants.reduce((s, t) => s + t.mods.length, 0);
  return (
    <section className="ts-hero ts-reveal relative overflow-hidden rounded-[28px] p-5">
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/[0.06]" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-48 w-48 rounded-full bg-white/[0.04]" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[13px] text-white/60">
            <Layers className="h-3.5 w-3.5" /> tizims.uz platformasi
          </p>
          <div className="mt-1.5 text-[34px] font-semibold leading-none tracking-tight">{users} a'zolik</div>
        </div>
        <span className="ts-hero-chip flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold">
          <PulseDot /> 99.98%
        </span>
      </div>
      <p className="relative mt-3 text-xs text-white/60">
        {tenants.length} ta tashkilot · {links} ta modul ulanishi
      </p>
      <div className="relative mt-5 grid grid-cols-2 gap-3">
        <button
          onClick={() => nav("/audit")}
          className="ts-hero-pill flex h-12 items-center justify-center gap-2 rounded-full text-[13px] font-semibold active:scale-[0.97]"
        >
          <Activity className="h-[18px] w-[18px]" /> Audit
        </button>
        <button onClick={onExport} className="ts-hero-pill flex h-12 items-center justify-center gap-2 rounded-full text-[13px] font-semibold active:scale-[0.97]">
          <Download className="h-[18px] w-[18px]" /> Hisobot
        </button>
      </div>
    </section>
  );
}

/* ───────────── KPI + sparkline ───────────── */

function Sparkline({ data, id }: { data: number[]; id: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * 100, 30 - ((v - min) / (max - min || 1)) * 26 - 2] as [number, number]);
  const line = smoothPath(pts);
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-10 w-full">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--ts-blue3)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--ts-blue3)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L 100 30 L 0 30 Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="var(--ts-blue)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function KpiRow({ tenants, mobile }: { tenants: Tenant[]; mobile: boolean }) {
  const links = tenants.reduce((s, t) => s + t.mods.length, 0);
  const kpis = [
    { title: "Tashkilotlar", value: String(tenants.length), delta: "+1", caption: "Shu chorakda yangi", icon: Building2, data: series(14, 3, 1, 0.6, 0.15) },
    { title: "Foydalanuvchilar", value: compact(tenants.reduce((s, t) => s + (t.org.reportedHeadcount ?? 0), 0)), delta: "+4%", caption: `${tenants.reduce((s, t) => s + t.members.length, 0)} ta tizim akkaunti`, icon: Users, data: series(14, 7, 5, 2, 0.5) },
    {
      title: "Modul ulanishlari",
      value: String(links),
      delta: `/${tenants.length * MODULES.length}`,
      caption: `${MODULES.length} ta modul katalogda`,
      icon: Layers,
      data: series(14, 11, 6, 2, 0.45),
    },
    { title: "Uptime", value: "99.98%", delta: "30 kun", caption: "SLA 99.9% bajarildi", icon: ShieldCheck, data: series(14, 19, 99, 1.2, 0) },
  ];

  if (mobile) {
    return (
      <section className="ts-reveal mt-6" style={delay(120)}>
        <h2 className="mb-3 px-1 text-[15px] font-semibold tracking-tight">Ko'rsatkichlar</h2>
        <div className="ts-scroll-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
          {kpis.map((k, i) => {
            const Icon = k.icon;
            return (
              <div key={k.title} className="flex w-[68%] max-w-[260px] shrink-0 snap-start flex-col rounded-3xl bg-ts-tile p-4">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ts-card">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <Pill2 tone="blue">{k.delta}</Pill2>
                </div>
                <div className="mt-4 text-[26px] font-semibold leading-none tracking-tight">{k.value}</div>
                <div className="mt-1.5 text-[13px] font-medium">{k.title}</div>
                <div className="-mx-1 mt-2">
                  <Sparkline data={k.data} id={`m-spark-${i}`} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <div className="mt-4 grid gap-4 sm:mt-5 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
      {kpis.map((k, i) => {
        const Icon = k.icon;
        return (
          <Card key={k.title} className="ts-reveal group overflow-hidden pt-4" style={delay(80 + i * 70)}>
            <div className="flex items-center justify-between px-4">
              <div className="text-base font-medium">{k.title}</div>
              <span className="flex h-8 w-8 items-center justify-center rounded-md border border-ts-line2 bg-ts-input transition-colors group-hover:bg-ts-hover">
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 px-4">
              <span className="text-3xl font-semibold tabular-nums">{k.value}</span>
              <span className="inline-flex h-5 items-center rounded-md bg-ts-chip px-2 text-xs font-medium">{k.delta}</span>
            </div>
            <div className="px-4 text-xs text-ts-sub">{k.caption}</div>
            <div className="mt-2">
              <Sparkline data={k.data} id={`spark-${i}`} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ───────────── Trafik (area chart) ───────────── */

function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

const RANGES = { 7: "7 kun", 30: "30 kun", 90: "90 kun" } as const;
type Range = keyof typeof RANGES;

function TrafficCard() {
  const mobile = useContext(MobileCtx);
  const [range, setRange] = useState<Range>(30);
  const [hover, setHover] = useState<number | null>(null);
  const live = useLive(1840);
  const req = useMemo(() => series(range, 41 + range, 52000, 16000, 260), [range]);
  const ses = useMemo(() => series(range, 97 + range, 21000, 7000, 110), [range]);
  const max = Math.max(...req) * 1.12;
  const H = 100;
  const toPts = (arr: number[]) => arr.map((v, i) => [(i / (arr.length - 1)) * 100, H - (v / max) * H] as [number, number]);
  const reqLine = smoothPath(toPts(req));
  const sesLine = smoothPath(toPts(ses));
  const total = req.reduce((s, v) => s + v, 0);
  const tickIdx = [0, Math.round((range - 1) / 3), Math.round(((range - 1) * 2) / 3), range - 1];

  return (
    <Card className="ts-reveal h-full gap-4 py-4" style={delay(200)}>
      <CardHead
        title="Platforma trafigi"
        sub="API so'rovlari va faol sessiyalar"
        right={
          <div className="flex shrink-0 rounded-full border border-ts-line bg-ts-input p-0.5">
            {(Object.keys(RANGES) as unknown as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => {
                  setRange(Number(r) as Range);
                  setHover(null);
                }}
                className={cn(
                  "h-7 rounded-full px-2.5 text-xs font-medium transition-colors",
                  Number(r) === range ? "bg-ts-inv text-ts-invfg" : "text-ts-sub hover:text-ts-fg",
                )}
              >
                {mobile ? `${r}k` : RANGES[r]}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-3 px-4 sm:flex sm:gap-12">
        <div>
          <div className="text-xl font-semibold tabular-nums tracking-tight sm:text-3xl">
            <span key={total} className="ts-swap">
              {compact(total)}
            </span>
          </div>
          <div className="text-xs font-medium text-ts-sub sm:text-sm">Jami so'rovlar</div>
        </div>
        <div>
          <div className="text-xl font-semibold tabular-nums tracking-tight sm:text-3xl">142ms</div>
          <div className="text-xs font-medium text-ts-sub sm:text-sm">O'rtacha javob</div>
        </div>
        <div>
          <div
            className={cn(
              "text-xl font-semibold tracking-tight transition-colors duration-500 sm:text-3xl",
              live.trend === "up" ? "text-emerald-500" : live.trend === "down" ? "text-ts-red" : "",
            )}
          >
            <RollingNumber value={live.value} />
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-ts-sub sm:text-sm">
            <PulseDot className="bg-emerald-500" /> So'rov/daqiqa
          </div>
        </div>
      </div>

      <div className="px-4">
        <div
          className="relative h-[200px] sm:h-[220px]"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const i = Math.round(((e.clientX - r.left) / r.width) * (range - 1));
            setHover(Math.max(0, Math.min(range - 1, i)));
          }}
          onTouchMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const i = Math.round(((e.touches[0].clientX - r.left) / r.width) * (range - 1));
            setHover(Math.max(0, Math.min(range - 1, i)));
          }}
        >
          {[0.25, 0.5, 0.75].map((y) => (
            <div key={y} className="absolute inset-x-0 border-t border-dashed border-ts-line" style={{ top: `${y * 100}%` }} />
          ))}
          <svg key={range} viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="ts-reveal-lg absolute inset-0 h-full w-full overflow-visible">
            <defs>
              <linearGradient id="pf-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--ts-blue3)" stopOpacity="0.45" />
                <stop offset="100%" stopColor="var(--ts-blue3)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`${reqLine} L 100 ${H} L 0 ${H} Z`} fill="url(#pf-area)" />
            <path d={reqLine} fill="none" stroke="var(--ts-blue)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <path d={sesLine} fill="none" stroke="var(--ts-blue2)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          </svg>
          {hover !== null && (
            <>
              <div className="pointer-events-none absolute inset-y-0 w-px bg-ts-line2" style={{ left: `${(hover / (range - 1)) * 100}%` }} />
              <span
                className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ts-card bg-ts-blue"
                style={{ left: `${(hover / (range - 1)) * 100}%`, top: `${(1 - req[hover] / max) * 100}%` }}
              />
              <div
                className="ts-pop pointer-events-none absolute top-2 z-10 min-w-[170px] rounded-lg border border-ts-line bg-ts-card px-3 py-2 text-xs shadow-xl"
                style={hover > range / 2 ? { right: `${(1 - hover / (range - 1)) * 100 + 2}%` } : { left: `${(hover / (range - 1)) * 100 + 2}%` }}
              >
                <div className="mb-1 font-medium">{dayLabel(range - 1 - hover)}</div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-ts-blue" />
                  <span className="flex-1 text-ts-sub">So'rovlar</span>
                  <span className="font-medium tabular-nums">{req[hover].toLocaleString("en-US")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-ts-blue2" />
                  <span className="flex-1 text-ts-sub">Sessiyalar</span>
                  <span className="font-medium tabular-nums">{ses[hover].toLocaleString("en-US")}</span>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="mt-2 flex justify-between text-xs text-ts-sub">
          {tickIdx.map((i) => (
            <span key={i}>{dayLabel(range - 1 - i)}</span>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ───────────── Taqsimot (donut) ───────────── */

function DistributionCard({ tenants }: { tenants: Tenant[] }) {
  const [active, setActive] = useState<number | null>(null);
  const total = tenants.reduce((s, t) => s + t.members.length, 0);
  const R = 70;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const segs = tenants.map((t) => {
    const frac = t.members.length / (total || 1);
    const seg = { t, frac, offset: acc };
    acc += frac;
    return seg;
  });

  const roles = useMemo(() => {
    const m = new Map<string, number>();
    tenants.forEach((t) => t.members.forEach((x) => m.set(x.role, (m.get(x.role) ?? 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [tenants]);
  const roleMax = roles[0]?.[1] ?? 1;
  const cur = active !== null ? segs[active] : null;

  return (
    <Card className="ts-reveal h-full gap-5 py-4" style={delay(260)}>
      <CardHead title="A'zolar taqsimoti" sub="Tashkilotlar va rollar kesimida" />
      <div className="flex flex-col items-center gap-5 px-4 sm:flex-row">
        <div className="relative h-[180px] w-[180px] shrink-0">
          <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
            <circle cx="90" cy="90" r={R} fill="none" stroke="var(--ts-track)" strokeWidth="18" />
            {segs.map((s, i) => (
              <circle
                key={s.t.org.id}
                cx="90"
                cy="90"
                r={R}
                fill="none"
                stroke={typeMeta(s.t.org.organizationType).color}
                strokeWidth={active === i ? 24 : 18}
                strokeDasharray={`${Math.max(0, s.frac * C - 4)} ${C}`}
                strokeDashoffset={-s.offset * C}
                strokeLinecap="round"
                className="cursor-pointer transition-all duration-300"
                style={{ opacity: active === null || active === i ? 1 : 0.35 }}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onClick={() => setActive((a) => (a === i ? null : i))}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span key={cur?.t.org.id ?? "all"} className="ts-swap text-3xl font-semibold tabular-nums">
              {cur ? cur.t.members.length : total}
            </span>
            <span className="max-w-[110px] truncate text-xs text-ts-sub">{cur ? cur.t.org.slug : "Jami a'zolik"}</span>
          </div>
        </div>
        <div className="w-full min-w-0 space-y-2">
          {segs.map((s, i) => (
            <button
              key={s.t.org.id}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors", active === i && "bg-ts-hover")}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: typeMeta(s.t.org.organizationType).color }} />
              <span className="min-w-0 flex-1 truncate text-sm">{s.t.org.name}</span>
              <span className="text-sm font-medium tabular-nums">{Math.round(s.frac * 100)}%</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mx-4 border-t border-ts-line pt-4">
        <div className="mb-2.5 text-xs font-medium uppercase tracking-wide text-ts-sub">Top rollar</div>
        <div className="space-y-2.5">
          {roles.map(([role, n]) => (
            <div key={role} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-sm">{roleLabel(role)}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ts-chip">
                <div className="h-full rounded-full bg-ts-blue" style={{ width: `${(n / roleMax) * 100}%` }} />
              </div>
              <span className="w-6 text-right text-sm font-medium tabular-nums">{n}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ───────────── Tashkilotlar ───────────── */

function OrgAvatar({ org, size = 40 }: { org: Organization; size?: number }) {
  const meta = typeMeta(org.organizationType);
  const Icon = meta.icon;
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm", meta.grad)}
      style={{ width: size, height: size }}
    >
      <Icon style={{ width: size * 0.45, height: size * 0.45 }} />
    </span>
  );
}

function AvatarStack({ members, max = 4 }: { members: Tenant["members"]; max?: number }) {
  const shown = members.slice(0, max);
  return (
    <div className="flex items-center">
      {shown.map((m, i) => (
        <span
          key={m.id}
          title={`${m.name} · ${roleLabel(m.role)}`}
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ts-chip text-[9px] font-semibold tracking-tight ring-2 ring-ts-card",
            i > 0 && "-ml-1",
          )}
        >
          {initialsOf(m.name)}
        </span>
      ))}
      {members.length > max && (
        <span className="-ml-1 flex h-7 min-w-7 items-center justify-center rounded-full bg-ts-inv px-1.5 text-[10px] font-semibold text-ts-invfg ring-2 ring-ts-card">
          +{members.length - max}
        </span>
      )}
    </div>
  );
}

function HealthBar({ value }: { value: number }) {
  const tone = value >= 90 ? "bg-emerald-500" : value >= 80 ? "bg-amber-500" : "bg-ts-red";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-ts-chip">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums">{value}%</span>
    </div>
  );
}

function TenantMenu({ t, onClose, onToast, className }: { t: Tenant; onClose: () => void; onToast: (m: string) => void; className?: string }) {
  const ref = useOutside<HTMLDivElement>(onClose);
  const nav = useNavigate();
  const item = "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-ts-hover";
  return (
    <div ref={ref} className={cn("ts-pop absolute z-30 min-w-[200px] rounded-lg border border-ts-line bg-ts-card p-1 text-ts-fg shadow-xl", className)}>
      <button
        className={item}
        onClick={() => {
          nav("/platform/support", { state: { tenant: t.org.slug } });
        }}
      >
        <LifeBuoy className="h-4 w-4 text-ts-sub" /> Yordam rejimini so'rash
      </button>
      <button
        className={item}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(`${t.org.slug}.tizims.uz`);
          } catch {
            /* ignore */
          }
          onToast(`${t.org.slug}.tizims.uz nusxalandi`);
          onClose();
        }}
      >
        <Copy className="h-4 w-4 text-ts-sub" /> Domenni nusxalash
      </button>
      <button
        className={item}
        onClick={() => {
          downloadCsv(t.org.slug, [["Ism", "Rol"], ...t.members.map((m) => [m.name, roleLabel(m.role)])]);
          onToast("A'zolar ro'yxati yuklab olindi");
          onClose();
        }}
      >
        <Download className="h-4 w-4 text-ts-sub" /> A'zolarni eksport
      </button>
    </div>
  );
}

function TenantDetails({ t }: { t: Tenant }) {
  const o = t.org;
  const rows: [LucideIcon, string, string | undefined][] = [
    [Mail, "Email", o.email],
    [Phone, "Telefon", o.phone],
    [MapPin, "Manzil", o.address],
  ];
  return (
    <div className="ts-reveal grid gap-4 sm:grid-cols-3">
      <div className="space-y-2">
        {rows.map(([Icon, label, v]) => (
          <div key={label} className="flex items-center gap-2 text-sm">
            <Icon className="h-4 w-4 shrink-0 text-ts-sub" />
            <span className="text-ts-sub">{label}:</span>
            <span className="truncate font-medium">{v ?? "—"}</span>
          </div>
        ))}
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-ts-sub">Vaqt zonasi</span>
          <span className="font-medium">{o.timezone}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-ts-sub">Valyuta</span>
          <span className="font-medium">{o.currency}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-ts-sub">Ulangan</span>
          <span className="font-medium">{o.createdAt}</span>
        </div>
      </div>
      <div className="flex flex-wrap content-start gap-1.5">
        {t.mods.map((k) => {
          const Icon = MODULE_ICON[k] ?? Layers;
          const m = MODULES.find((x) => x.key === k);
          return (
            <span key={k} className="flex h-7 items-center gap-1.5 rounded-full border border-ts-line bg-ts-card px-2.5 text-xs font-medium">
              <Icon className="h-3.5 w-3.5 text-ts-blue" /> {m?.name ?? k}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function TenantsCard({ tenants, mobile, onToast }: { tenants: Tenant[]; mobile: boolean; onToast: (m: string) => void }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const list = tenants.filter(
    (t) => (type === "all" || t.org.organizationType === type) && (!q || `${t.org.name} ${t.org.slug}`.toLowerCase().includes(q)),
  );
  const types = [...new Set(tenants.map((t) => t.org.organizationType))];

  const chips = (
    <div className={cn("ts-scroll-none flex gap-2 overflow-x-auto", mobile && "-mx-4 px-4")}>
      {["all", ...types].map((ty) => (
        <button
          key={ty}
          onClick={() => setType(ty)}
          className={cn(
            "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors",
            type === ty ? "bg-ts-inv text-ts-invfg" : "border border-ts-line bg-ts-card text-ts-sub hover:text-ts-fg",
          )}
        >
          {ty !== "all" && <span className="h-1.5 w-1.5 rounded-full" style={{ background: typeMeta(ty).color }} />}
          {ty === "all" ? "Barchasi" : typeMeta(ty).label}
        </button>
      ))}
    </div>
  );

  if (mobile) {
    return (
      <section className="ts-reveal" style={delay(300)}>
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-[15px] font-semibold tracking-tight">Tashkilotlar</h2>
          <span className="text-[13px] text-ts-sub">{list.length} ta</span>
        </div>
        <div className="mb-3">{chips}</div>
        <div className="space-y-3">
          {list.map((t) => (
            <div key={t.org.id} className="relative rounded-3xl bg-ts-tile p-4">
              <div className="flex items-center gap-3">
                <OrgAvatar org={t.org} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold">{t.org.name}</div>
                  <div className="truncate text-xs text-ts-sub">{t.org.slug}.tizims.uz</div>
                </div>
                <button
                  onClick={() => setMenu((m) => (m === t.org.id ? null : t.org.id))}
                  aria-label="Amallar"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ts-card"
                >
                  <Ellipsis className="h-4 w-4" />
                </button>
                {menu === t.org.id && <TenantMenu t={t} onClose={() => setMenu(null)} onToast={onToast} className="right-3 top-[60px] rounded-2xl" />}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ts-line pt-3">
                <div>
                  <div className="mb-1 text-[11px] text-ts-sub">Tarif</div>
                  <Pill2 tone={t.plan.tone}>{t.plan.name}</Pill2>
                </div>
                <div className="text-right">
                  <div className="mb-1 text-[11px] text-ts-sub">Salomatlik</div>
                  <div className="flex justify-end">
                    <HealthBar value={t.health} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[11px] text-ts-sub">A'zolar · {t.members.length}</div>
                  <AvatarStack members={t.members} max={4} />
                </div>
                <div className="text-right">
                  <div className="mb-1 text-[11px] text-ts-sub">Modullar</div>
                  <div className="flex justify-end gap-1">
                    {t.mods.map((k) => {
                      const Icon = MODULE_ICON[k] ?? Layers;
                      return (
                        <span key={k} title={k} className="flex h-7 w-7 items-center justify-center rounded-full bg-ts-card">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {list.length === 0 && <div className="rounded-3xl bg-ts-tile px-4 py-10 text-center text-sm text-ts-sub">Hech narsa topilmadi</div>}
        </div>
      </section>
    );
  }

  return (
    <Card className="ts-reveal gap-4 py-4" style={delay(320)}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-3">
          <div className="text-lg font-medium">Tashkilotlar</div>
          <span className="inline-flex h-5 items-center rounded-md bg-ts-chip px-2 text-xs font-medium">{list.length}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {chips}
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ts-sub" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tashkilotni qidirish..."
              className="h-9 w-full rounded-md border border-ts-line2 bg-ts-input pl-9 pr-8 text-sm text-ts-fg outline-none placeholder:text-ts-sub focus:border-ts-muted"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ts-sub hover:text-ts-fg">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto px-4">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-ts-line bg-ts-tile text-left">
              {["Tashkilot", "Tur", "Tarif", "A'zolar", "Modullar", "Salomatlik", "Holat", ""].map((h) => (
                <th key={h} className="h-10 whitespace-nowrap px-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((t, i) => {
              const meta = typeMeta(t.org.organizationType);
              const isOpen = open === t.org.id;
              return (
                <FragmentRow key={t.org.id}>
                  <tr
                    onClick={() => setOpen(isOpen ? null : t.org.id)}
                    className={cn("ts-reveal cursor-pointer border-b border-ts-line transition-colors", isOpen ? "bg-ts-hover" : "hover:bg-ts-tile")}
                    style={delay(380 + i * 60)}
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <OrgAvatar org={t.org} />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{t.org.name}</div>
                          <div className="ts-mono text-xs text-ts-sub">{t.org.slug}.tizims.uz</div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 text-ts-sub">{meta.label}</td>
                    <td className="px-3">
                      <Pill2 tone={t.plan.tone}>{t.plan.name}</Pill2>
                    </td>
                    <td className="px-3">
                      <div className="flex items-center gap-2">
                        <AvatarStack members={t.members} />
                        <span className="text-xs text-ts-sub">{t.members.length}</span>
                      </div>
                    </td>
                    <td className="px-3">
                      <div className="flex gap-1">
                        {t.mods.map((k) => {
                          const Icon = MODULE_ICON[k] ?? Layers;
                          return (
                            <span key={k} title={MODULES.find((m) => m.key === k)?.name ?? k} className="flex h-7 w-7 items-center justify-center rounded-md border border-ts-line bg-ts-input">
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3">
                      <HealthBar value={t.health} />
                    </td>
                    <td className="whitespace-nowrap px-3">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Faol
                      </span>
                    </td>
                    <td className="relative px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setMenu((m) => (m === t.org.id ? null : t.org.id))}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-ts-hover"
                          title="Amallar"
                        >
                          <Ellipsis className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setOpen(isOpen ? null : t.org.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-ts-hover"
                          title="Batafsil"
                        >
                          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
                        </button>
                      </div>
                      {menu === t.org.id && <TenantMenu t={t} onClose={() => setMenu(null)} onToast={onToast} className="right-3 top-12 text-left" />}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-ts-line bg-ts-tile">
                      <td colSpan={8} className="px-4 py-4">
                        <TenantDetails t={t} />
                      </td>
                    </tr>
                  )}
                </FragmentRow>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={8} className="p-10 text-center text-ts-sub">
                  Hech narsa topilmadi
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/* ───────────── Modullar katalogi ───────────── */

function ModulesCard({ tenants }: { tenants: Tenant[] }) {
  const mobile = useContext(MobileCtx);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <Card className="ts-reveal h-full gap-4 py-4" style={delay(420)}>
      <CardHead title="Modullar katalogi" sub={`${MODULES.length} ta modul · tashkilotlar bo'yicha qamrov`} />
      <div className="grid grid-cols-2 gap-3 px-4 md:grid-cols-4">
        {MODULES.map((m) => {
          const Icon = MODULE_ICON[m.key] ?? Layers;
          const users = tenants.filter((t) => t.mods.includes(m.key));
          const pct = Math.round((users.length / tenants.length) * 100);
          return (
            <div
              key={m.key}
              className={cn(
                "group flex flex-col rounded-xl p-3 transition-colors",
                mobile ? "rounded-2xl bg-ts-card" : "border border-ts-line bg-ts-tile hover:border-ts-line2",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ts-blue3 text-white transition-transform group-hover:scale-105">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <Pill2 tone={m.status === "active" ? "green" : "amber"} className="h-5 px-2 text-[10px]">
                  {m.status === "active" ? "Barqaror" : "Beta"}
                </Pill2>
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="font-semibold">{m.name}</span>
                <span className="ts-mono text-[10px] text-ts-muted">v{m.version}</span>
              </div>
              <div className="line-clamp-1 text-xs text-ts-sub">{m.description}</div>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ts-chip">
                  <div className="h-full rounded-full bg-ts-blue transition-[width] duration-1000 ease-out" style={{ width: ready ? `${pct}%` : "0%" }} />
                </div>
                <span className="text-[11px] font-medium tabular-nums text-ts-sub">
                  {users.length}/{tenants.length}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ───────────── Tizim holati ───────────── */

const SERVICES: { name: string; icon: LucideIcon; latency: string; seed: number }[] = [
  { name: "API Gateway", icon: Zap, latency: "48ms", seed: 5 },
  { name: "Ma'lumotlar bazasi", icon: Database, latency: "12ms", seed: 13 },
  { name: "Autentifikatsiya", icon: KeyRound, latency: "31ms", seed: 21 },
  { name: "Fayl saqlash", icon: HardDrive, latency: "86ms", seed: 34 },
  { name: "Navbat (Queue)", icon: Server, latency: "9ms", seed: 55 },
];

function StatusCard() {
  const days = 30;
  return (
    <Card className="ts-reveal h-full gap-4 py-4" style={delay(480)}>
      <CardHead
        title="Tizim holati"
        sub="So'nggi 30 kun"
        right={
          <Pill2 tone="green">
            <PulseDot /> Operatsion
          </Pill2>
        }
      />
      <div className="space-y-4 px-4">
        {SERVICES.map((s) => {
          const r = rng(s.seed);
          const bars = Array.from({ length: days }, () => {
            const x = r();
            return x > 0.97 ? "red" : x > 0.9 ? "amber" : "ok";
          });
          const bad = bars.filter((b) => b !== "ok").length;
          const uptime = (100 - bad * 0.04).toFixed(2);
          const Icon = s.icon;
          return (
            <div key={s.name}>
              <div className="mb-1.5 flex items-center gap-2 text-sm">
                <Icon className="h-4 w-4 text-ts-sub" />
                <span className="flex-1 truncate font-medium">{s.name}</span>
                <span className="ts-mono text-xs text-ts-sub">{s.latency}</span>
                <span className="w-14 text-right text-xs font-medium tabular-nums">{uptime}%</span>
              </div>
              <div className="flex h-6 gap-[2px]">
                {bars.map((b, i) => (
                  <span
                    key={i}
                    title={`${dayLabel(days - 1 - i)} · ${b === "ok" ? "Muammosiz" : b === "amber" ? "Sekinlashuv" : "Uzilish"}`}
                    className={cn(
                      "ts-grow-y flex-1 rounded-[2px] transition-opacity hover:opacity-70",
                      b === "ok" ? "bg-emerald-500" : b === "amber" ? "bg-amber-500" : "bg-ts-red",
                    )}
                    style={delay(500 + i * 12)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ───────────── Audit ───────────── */


/** Platforma darajasidagi harakatlar — tashkilot ichki audit yozuvlari (baho, davomat) bu yerda ko'rsatilmaydi. */
function AuditCard() {
  const nav = useNavigate();
  const list = PLATFORM_AUDIT.slice(0, 6);
  return (
    <Card className="ts-reveal gap-4 py-4" style={delay(540)}>
      <CardHead
        title="So'nggi faollik"
        sub="Platforma auditi"
        right={
          <button onClick={() => nav("/platform/audit")} className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-ts-line2 bg-ts-input px-3 text-sm font-medium hover:bg-ts-hover">
            Barchasi <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        }
      />
      <div className="relative px-4">
        {list.length > 1 && <span className="absolute bottom-5 left-[31px] top-5 border-l border-dashed border-ts-line2" />}
        <div className="grid gap-1 md:grid-cols-2 md:gap-x-6">
          {list.map((a, i) => (
            <div key={i} className="relative flex min-w-0 items-start gap-3 rounded-lg p-2 transition-colors hover:bg-ts-hover">
              <span className="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ts-inv text-[10px] font-semibold text-ts-invfg">
                {initialsOf(a.actor)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-medium">{a.actor}</span>
                  <Pill2 tone="gray" className="h-5 px-2 text-[10px]">
                    {a.action}
                  </Pill2>
                </div>
                <div className="mt-0.5 truncate text-xs text-ts-sub">
                  <span className="ts-mono">{a.target}</span> · {a.detail}
                </div>
                <div className="mt-0.5 text-[11px] text-ts-muted">{a.at}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
