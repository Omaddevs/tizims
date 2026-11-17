import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  KeyRound,
  ArrowLeft,
  Bell,
  Building2,
  Check,
  ChevronRight,
  ClipboardList,
  House,
  LogOut,
  Moon,
  Search,
  FileQuestion,
  Megaphone,
  CalendarDays,
  Sun,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import { cn, roleLabel } from "../lib/utils";
import { eduRouteAllowed } from "../core/catalog";
import { FEATURES, accessOf } from "../core/features";
import { PlatformBanner } from "./PlatformBanner";
import { ActionError, PASSWORD_EVENT } from "./Layout";
import { SubjectsProvider } from "../lib/subjects";
import { GlobalSearchBar } from "./GlobalSearchBar";

export type MobileNavSection = { title: string; items: { to?: string; label: string; icon: LucideIcon }[] };

type Note = { id: string; title: string; body: string; time: string; channel: string; read: boolean; link?: string };

const TITLES: [string, string][] = [
  ["/tasks/templates", "Vazifa shablonlari"],
  ["/tasks/all", "Barcha vazifalar"],
  ["/tasks", "Vazifalarim"],
  ["/organization", "Tashkilot"],
  ["/audit", "Audit log"],
  ["/system", "Xavfsizlik"],
  ["/platform-admin", "Platforma"],
  ["/members", "Foydalanuvchilar"],
  ["/analytics", "Ta'lim analitikasi"],
  ["/billing", "Obuna"],
  ["/support", "TIZIMS yordami"],
  ["/platform/tenants", "Tashkilotlar"],
  ["/platform/billing", "Obunalar"],
  ["/platform/support", "Yordam markazi"],
  ["/platform/monitoring", "Monitoring"],
  ["/platform/audit", "Platforma auditi"],
  ["/platform/growth", "O'sish"],
  ["/platform/announcements", "E'lonlar"],
  ["/platform/releases", "Relizlar"],
  ["/platform/team", "Jamoa"],
  ["/platform/data", "API va ma'lumotlar"],
  ["/crm", "CRM"],
  ["/shop", "Do'kon"],
  ["/pharmacy", "Apteka"],
  ...FEATURES.map((f) => [f.path, f.label] as [string, string]),
];

function titleFor(pathname: string) {
  return TITLES.find(([p]) => pathname === p || pathname.startsWith(p + "/"))?.[1] ?? "TIZIMS";
}

function firstName(name?: string) {
  if (!name) return "";
  return name.replace(/^(Dr\.|Prof\.)\s*/i, "").split(/\s+/)[0] ?? "";
}

/**
 * Mobil (< lg) "ilova" qobig'i: salomlashuv header, suzuvchi pastki navigatsiya,
 * profil/menyu va bildirishnomalar uchun bottom-sheet'lar.
 */
export function MobileShell({
  sections,
  notes,
  unread,
  avatar,
  mode,
  toggleTheme,
}: {
  sections: MobileNavSection[];
  notes: Note[];
  unread: number;
  avatar: string;
  mode: string;
  toggleTheme: () => void;
}) {
  const { user, organization, hasModule } = useApp();
  const loc = useLocation();
  const nav = useNavigate();
  const [sheet, setSheet] = useState<null | "menu" | "notes">(null);
  const isHome = loc.pathname === "/";

  useEffect(() => {
    setSheet(null);
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);

  const role = user?.role ?? "";
  const canTasks = eduRouteAllowed(role, "/tasks");
  // Talaba va ota-ona: qidiruv o'rniga eng ko'p ishlatiladigan bo'limlar
  const learner = role === "student" || role === "parent";
  const edu = hasModule("education");
  const canTests = edu && !!accessOf(role, "tests");
  const canNews = edu && !!accessOf(role, "news");
  const canTimetable = edu && !!accessOf(role, "timetable");

  return (
    <div className="ts-shell ts-mobile min-h-screen">
      <header className="sticky top-0 z-30 ts-glass px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl">
        {isHome ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSheet("menu")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ts-inv text-sm font-semibold text-ts-invfg"
              aria-label="Profil"
            >
              {avatar}
            </button>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[17px] font-semibold">Salom, {firstName(user?.name)}</div>
              <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-ts-sub">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {organization?.name} · {roleLabel(role)}
                </span>
              </div>
            </div>
            <BellButton unread={unread} onClick={() => setSheet("notes")} />
          </div>
        ) : (
          <div className="grid grid-cols-[44px_1fr_44px] items-center">
            <button
              onClick={() => (window.history.length > 1 ? nav(-1) : nav("/"))}
              className="flex h-11 w-11 items-center justify-center rounded-full text-ts-fg active:bg-ts-hover"
              aria-label="Orqaga"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="truncate text-center text-[16px] font-semibold">{titleFor(loc.pathname)}</div>
            <BellButton unread={unread} onClick={() => setSheet("notes")} />
          </div>
        )}
      </header>

      <main className="overflow-x-clip px-4 pb-[calc(112px+env(safe-area-inset-bottom))]">
        <div key={loc.pathname} className="page-enter">
          <PlatformBanner className="mb-3 mt-1" />
          <ActionError />
          <SubjectsProvider>
            <Outlet />
          </SubjectsProvider>
        </div>
      </main>

      <nav
        className="fixed inset-x-0 z-40 flex justify-center px-4"
        style={{ bottom: "max(16px, env(safe-area-inset-bottom))" }}
        aria-label="Asosiy navigatsiya"
      >
        <div className="flex items-center gap-1 rounded-full border border-ts-line ts-glass-nav p-1.5">
          <TabLink to="/" end icon={House} label="Asosiy" />
          {canTasks && <TabLink to="/tasks" icon={ClipboardList} label="Vazifalar" />}
          {learner ? (
            <>
              {canTests && <TabLink to="/tests" icon={FileQuestion} label="Testlar" />}
              {canTimetable && <TabLink to="/timetable" icon={CalendarDays} label="Jadval" />}
              {canNews && <TabLink to="/news" icon={Megaphone} label="E'lonlar" />}
            </>
          ) : (
            <GlobalSearchBar
              hotkey={false}
              renderTrigger={(open) => <TabButton icon={Search} label="Qidiruv" onClick={open} />}
            />
          )}
          <TabButton
            icon={UserRound}
            label="Profil"
            active={sheet === "menu"}
            onClick={() => setSheet("menu")}
          />
        </div>
      </nav>

      {sheet === "menu" && (
        <Sheet onClose={() => setSheet(null)}>
          <ProfileSheet sections={sections} avatar={avatar} mode={mode} toggleTheme={toggleTheme} />
        </Sheet>
      )}
      {sheet === "notes" && (
        <Sheet onClose={() => setSheet(null)} title="Bildirishnomalar">
          <NotesSheet notes={notes} />
        </Sheet>
      )}
    </div>
  );
}

function BellButton({ unread, onClick }: { unread: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Bildirishnomalar"
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ts-line bg-ts-card text-ts-fg active:bg-ts-hover"
    >
      <Bell className="h-[18px] w-[18px]" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ts-red px-1 text-[10px] font-semibold text-white ring-2 ring-ts-card">
          {unread}
        </span>
      )}
    </button>
  );
}

const tabBase = "flex h-12 items-center justify-center gap-2 rounded-full transition-all duration-300";

function TabLink({ to, end, icon: Icon, label }: { to: string; end?: boolean; icon: LucideIcon; label: string }) {
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={label}
      className={({ isActive }) =>
        cn(tabBase, isActive ? "bg-ts-inv px-5 text-ts-invfg" : "w-12 text-ts-sub active:bg-ts-hover")
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
          {isActive && <span className="ts-swap text-[13px] font-semibold">{label}</span>}
        </>
      )}
    </NavLink>
  );
}

function TabButton({ icon: Icon, label, onClick, active }: { icon: LucideIcon; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(tabBase, active ? "bg-ts-inv px-5 text-ts-invfg" : "w-12 text-ts-sub active:bg-ts-hover")}
    >
      <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
      {active && <span className="ts-swap text-[13px] font-semibold">{label}</span>}
    </button>
  );
}

/* ───────────── Bottom sheet ───────────── */

function Sheet({ children, onClose, title }: { children: ReactNode; onClose: () => void; title?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <div className="ts-fade absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="ts-sheet relative max-h-[88vh] w-full overflow-y-auto rounded-t-[28px] bg-ts-bg pb-[max(20px,env(safe-area-inset-bottom))] text-ts-fg">
        <div className="sticky top-0 z-10 bg-ts-bg pb-2 pt-3">
          <div className="mx-auto h-1.5 w-11 rounded-full bg-ts-line2" />
          {title && <div className="mt-3 px-5 text-[17px] font-semibold">{title}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}

function ProfileSheet({
  sections,
  avatar,
  mode,
  toggleTheme,
}: {
  sections: MobileNavSection[];
  avatar: string;
  mode: string;
  toggleTheme: () => void;
}) {
  const { user, organization, organizations, switchOrganization, logout } = useApp();
  const nav = useNavigate();
  const loc = useLocation();

  return (
    <div className="space-y-5 px-4">
      <div className="flex items-center gap-3 rounded-3xl bg-ts-tile p-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ts-inv text-base font-semibold text-ts-invfg">
          {avatar}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{user?.name}</div>
          <div className="truncate text-xs text-ts-sub">{user?.email}</div>
          <span className="mt-1.5 inline-flex rounded-full bg-[#E8F1FF] px-2.5 py-0.5 text-[11px] font-semibold text-ts-blue3">
            {roleLabel(user?.role ?? "")}
          </span>
        </div>
      </div>

      {sections.map((s) => (
        <div key={s.title}>
          <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-ts-muted">{s.title}</div>
          <div className="overflow-hidden rounded-3xl bg-ts-tile">
            {s.items.map((i) => {
              const Icon = i.icon;
              const active = i.to === "/" ? loc.pathname === "/" : !!i.to && loc.pathname === i.to;
              return (
                <NavLink
                  key={i.label}
                  to={i.to ?? "/"}
                  end
                  className="flex items-center gap-3 border-b border-ts-line px-4 py-3 last:border-0 active:bg-ts-hover"
                >
                  <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", active ? "bg-ts-inv text-ts-invfg" : "bg-ts-card text-ts-fg")}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className={cn("flex-1 text-[15px]", active && "font-semibold")}>{i.label}</span>
                  <ChevronRight className="h-4 w-4 text-ts-muted" />
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}

      <button
        onClick={() => window.dispatchEvent(new Event(PASSWORD_EVENT))}
        className="flex w-full items-center gap-3 rounded-3xl bg-ts-tile px-4 py-3 text-left active:bg-ts-hover"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ts-card">
          <KeyRound className="h-[18px] w-[18px]" />
        </span>
        <span className="flex-1 text-[15px]">Parolni o'zgartirish</span>
      </button>

      {organizations.length > 1 && (
        <div>
          <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-ts-muted">Tashkilot</div>
          <div className="overflow-hidden rounded-3xl bg-ts-tile">
            {organizations.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  switchOrganization(o.id);
                  nav("/");
                }}
                className="flex w-full items-center gap-3 border-b border-ts-line px-4 py-3 text-left last:border-0 active:bg-ts-hover"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ts-card">
                  <Building2 className="h-[18px] w-[18px]" />
                </span>
                <span className="flex-1 truncate text-[15px]">{o.name}</span>
                {o.id === organization?.id && <Check className="h-4 w-4 text-ts-blue" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-3xl bg-ts-tile">
        <button onClick={toggleTheme} className="flex w-full items-center gap-3 border-b border-ts-line px-4 py-3 text-left active:bg-ts-hover">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ts-card">
            {mode === "dark" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
          </span>
          <span className="flex-1 text-[15px]">Qorong'i rejim</span>
          <span className={cn("relative h-7 w-12 rounded-full transition-colors", mode === "dark" ? "bg-ts-blue" : "bg-ts-line2")}>
            <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", mode === "dark" ? "left-6" : "left-1")} />
          </span>
        </button>
        <button onClick={logout} className="flex w-full items-center gap-3 px-4 py-3 text-left text-ts-red active:bg-ts-hover">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ts-card">
            <LogOut className="h-[18px] w-[18px]" />
          </span>
          <span className="flex-1 text-[15px] font-medium">Chiqish</span>
        </button>
      </div>
    </div>
  );
}

function NotesSheet({ notes }: { notes: Note[] }) {
  const { markNotificationRead, markAllRead } = useApp();
  const nav = useNavigate();
  return (
    <div className="px-4">
      {notes.length > 0 && (
        <button className="mb-3 px-1 text-sm font-medium text-ts-blue" onClick={markAllRead}>
          Barchasini o'qilgan qilish
        </button>
      )}
      {notes.length === 0 && <div className="rounded-3xl bg-ts-tile px-4 py-12 text-center text-sm text-ts-sub">Yangi bildirishnoma yo'q</div>}
      <div className="relative space-y-1">
        {notes.length > 1 && <span className="absolute bottom-6 left-[19px] top-6 border-l border-dashed border-ts-line2" />}
        {notes.map((n) => (
          <button
            key={n.id}
            onClick={() => {
              markNotificationRead(n.id);
              if (n.link) nav(n.link);
            }}
            className="relative flex w-full items-start gap-3 rounded-2xl p-2 text-left active:bg-ts-hover"
          >
            <span
              className={cn(
                "relative z-[1] mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                n.read ? "border border-ts-line2 bg-ts-bg text-ts-muted" : "bg-ts-inv text-ts-invfg",
              )}
            >
              {n.read ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className={cn("truncate text-sm", n.read ? "font-medium" : "font-semibold")}>{n.title}</span>
                <span className="shrink-0 text-[11px] text-ts-muted">{n.time}</span>
              </span>
              <span className="mt-0.5 block text-[13px] leading-snug text-ts-sub">{n.body}</span>
              <span className="mt-1 block text-[11px] text-ts-muted">{n.channel}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
