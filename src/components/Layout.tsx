import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  Award,
  BookOpen,
  CalendarDays,
  KeyRound,
  Landmark,
  LifeBuoy,
  Wallet,
  UserCog,
  CreditCard,
  BarChart3,
  LayoutDashboard,
  DoorOpen,
  BookOpenCheck,
  FileQuestion,
  Newspaper,
  TrendingUp,
  Megaphone,
  Rocket,
  UsersRound,
  Database,
  Library,
  MessageSquare,
  MessageSquareWarning,
  Sparkles,
  UserCheck,
  Bell,
  Building2,
  Check,
  ChevronRight,
  ChevronsUpDown,
  ClipboardList,
  Crown,
  GraduationCap,
  LayoutTemplate,
  ListChecks,
  LogOut,
  Moon,
  PanelLeft,
  ScrollText,
  Settings,
  Shield,
  Sun,
  User as UserIcon,
  Users,
  X,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import { cn, roleLabel } from "../lib/utils";
import { useTheme } from "../lib/theme";
import { GlobalSearchBar } from "./GlobalSearchBar";
import { PlatformBanner } from "./PlatformBanner";
import { PasswordDialog } from "./PasswordDialog";
import { SubjectsProvider } from "../lib/subjects";

/** Profil menyusidan parol oynasini ochish (desktop va mobil) */
export const PASSWORD_EVENT = "tizims:change-password";
import { Logo } from "./Logo";
import { MobileShell } from "./MobileShell";
import { useIsMobile } from "../lib/useMedia";
import { EDU_ONLY_ROLES, eduRouteAllowed } from "../core/catalog";
import { FEATURES, FEATURE_SECTIONS, featureLabel, type FeatureKey } from "../core/features";
import { useApi } from "../lib/api";
import type { Role } from "../types";
import type { ModuleKey } from "../core/types";

/** Umumiy (forUserId'siz) bildirishnomalar boshqaruv uchun — o'quvchi/ota-ona/o'qituvchi faqat o'zinikini ko'radi. */
function noteVisible(n: { forUserId?: string }, userId?: string, role?: Role) {
  if (n.forUserId) return n.forUserId === userId;
  return !(role && EDU_ONLY_ROLES.includes(role));
}

/** Serverdan keladigan haqiqiy sonlar (/api/org/badges) */
type BadgeKey = "attention" | "myTasks" | "overdueTasks" | "newComplaints" | "messages";
/** Sahifa ichidan belgilarni darhol yangilash (masalan, xabar o'qilganda) */
export const BADGES_EVENT = "tizims:badges";
type Badges = Partial<Record<BadgeKey, number>>;

type NavChild = {
  to?: string;
  label: string;
  end?: boolean;
  module?: ModuleKey;
  roles?: string[];
  perm?: string;
  badge?: BadgeKey;
  children?: NavChild[];
};

type NavItem = {
  to?: string;
  label: string;
  icon: typeof Users;
  children?: NavChild[];
  roles?: string[];
  /** Rollar matritsasidagi ruxsat — ega o'zgartirsa, menyu ham o'zgaradi */
  perm?: string;
  module?: ModuleKey;
  /** Haqiqiy son belgisi (0 bo'lsa ko'rsatilmaydi) */
  badge?: BadgeKey;
  /** Muhim (qizil) belgimi */
  urgent?: boolean;
  end?: boolean;
};

type NavSection = { title: string; items: NavItem[] };

const ADMIN_ROLES = ["owner", "rector"];

const SECTIONS: NavSection[] = [
  {
    title: "Dashboards",
    items: [
      { to: "/", label: "Ta'lim boshqaruvi", icon: GraduationCap },
      { to: "/analytics", label: "Ta'lim analitikasi", icon: BarChart3, roles: ["owner"], module: "education" },
    ],
  },
  {
    title: "Apps",
    items: [
      { to: "/tasks", label: "Vazifalarim", icon: ClipboardList, badge: "myTasks", end: true },
      { to: "/tasks/all", label: "Barcha vazifalar", icon: ListChecks, roles: ADMIN_ROLES.concat("dept_head") },
      { to: "/tasks/templates", label: "Vazifa shablonlari", icon: LayoutTemplate, roles: ADMIN_ROLES.concat("dept_head") },
    ],
  },
  {
    title: "Tizim",
    items: [
      { to: "/organization", label: "Tashkilot", icon: Settings, roles: ADMIN_ROLES },
      { to: "/members", label: "Foydalanuvchilar", icon: UserCog, perm: "core.users.manage" },
      { to: "/billing", label: "Obuna va to'lovlar", icon: CreditCard, perm: "core.billing.view" },
      { to: "/support", label: "TIZIMS yordami", icon: LifeBuoy, perm: "core.support.manage" },
      { to: "/audit", label: "Audit log", icon: ScrollText, perm: "core.audit.view" },
      { to: "/system", label: "Xavfsizlik", icon: Shield, roles: ["super_admin"] },
    ],
  },
];

const FEATURE_ICONS: Record<FeatureKey, typeof Users> = {
  academic: BookOpen,
  timetable: CalendarDays,
  attendance: UserCheck,
  grades: Award,
  lms: Library,
  messages: MessageSquare,
  complaints: MessageSquareWarning,
  insights: Sparkles,
  people: Users,
  structure: Landmark,
  roles: KeyRound,
  rooms: DoorOpen,
  mySubjects: BookOpenCheck,
  tests: FileQuestion,
  news: Megaphone,
  blog: Newspaper,
  support: LifeBuoy,
};

/** Rolga ochiq ta'lim modullari — bo'limlarga ajratilgan (Dashboards va Apps orasiga qo'yiladi). */
function featureSections(role: string): NavSection[] {
  return FEATURE_SECTIONS.map((title) => ({
    title,
    items: FEATURES.filter((f) => f.section === title && f.access[role as Role]).map((f) => ({
      to: f.path,
      label: featureLabel(f, role),
      icon: FEATURE_ICONS[f.key],
      module: "education" as ModuleKey,
      ...(f.key === "messages" ? { badge: "messages" as BadgeKey } : f.key === "complaints" ? { badge: "newComplaints" as BadgeKey, urgent: true } : {}),
    })),
  })).filter((s) => s.items.length > 0);
}

/** Super admin menyusi — faqat platforma darajasidagi bo'limlar. */
const PLATFORM_SECTIONS: NavSection[] = [
  {
    title: "Platforma",
    items: [
      { to: "/", label: "Umumiy ko'rinish", icon: Crown },
      { to: "/platform/tenants", label: "Tashkilotlar", icon: Building2 },
      { to: "/platform/billing", label: "Obunalar va to'lovlar", icon: Wallet },
      { to: "/platform/growth", label: "O'sish va onboarding", icon: TrendingUp },
    ],
  },
  {
    title: "Operatsiyalar",
    items: [
      { to: "/platform/support", label: "Yordam markazi", icon: LifeBuoy },
      { to: "/platform/announcements", label: "E'lonlar va texnik ishlar", icon: Megaphone },
      { to: "/platform/monitoring", label: "Monitoring", icon: Activity },
      { to: "/platform/releases", label: "Relizlar va funksiyalar", icon: Rocket },
    ],
  },
  {
    title: "Xavfsizlik",
    items: [
      { to: "/platform/team", label: "Platforma jamoasi", icon: UsersRound },
      { to: "/roles", label: "Rol shablonlari", icon: KeyRound },
      { to: "/system", label: "Xavfsizlik", icon: Shield },
      { to: "/platform/data", label: "API va ma'lumotlar", icon: Database },
      { to: "/platform/audit", label: "Platforma auditi", icon: ScrollText },
    ],
  },
];

/** Ega va rektor menyusi: strategik bo'limlar yuqorida, operatsion sahifalar yig'iladigan guruhlarda */
const LEADER_ROLES = ["owner", "rector"];

function leaderSections(role: string): NavSection[] {
  const f = (k: FeatureKey) => FEATURES.find((x) => x.key === k)!;
  const has = (k: FeatureKey) => !!f(k).access[role as Role];
  const item = (k: FeatureKey, label?: string, extra: Partial<NavItem> = {}): NavItem | null =>
    has(k) ? { to: f(k).path, label: label ?? featureLabel(f(k), role), icon: FEATURE_ICONS[k], module: "education", ...extra } : null;
  const child = (k: FeatureKey): NavChild | null => (has(k) ? { to: f(k).path, label: featureLabel(f(k), role), module: "education" } : null);
  const clean = <T,>(xs: (T | null)[]) => xs.filter(Boolean) as T[];

  return [
    {
      title: "Asosiy",
      items: clean<NavItem>([
        { to: "/", label: role === "owner" ? "Bosh sahifa" : "Ta'lim boshqaruvi", icon: role === "owner" ? LayoutDashboard : GraduationCap, badge: "attention", urgent: true },
        role === "owner" ? { to: "/analytics", label: "Ta'lim analitikasi", icon: BarChart3, module: "education" } : null,
        item("insights"),
      ]),
    },
    {
      title: "Kontingent",
      items: clean<NavItem>([item("people", "Talabalar"), item("academic", "Guruhlar va fanlar"), item("structure")]),
    },
    {
      title: "Ta'lim jarayoni",
      items: clean<NavItem>([
        {
          label: "Ta'lim jarayonlari",
          icon: BookOpen,
          module: "education",
          children: clean<NavChild>([child("timetable"), child("attendance"), child("grades"), child("lms")]),
        },
        item("complaints", undefined, { badge: "newComplaints", urgent: true }),
        item("messages", undefined, { badge: "messages" }),
        {
          label: "Vazifalar",
          icon: ClipboardList,
          badge: "overdueTasks",
          urgent: true,
          children: [
            { to: "/tasks", label: "Vazifalarim", end: true, badge: "myTasks" },
            { to: "/tasks/all", label: "Barcha vazifalar" },
            { to: "/tasks/templates", label: "Shablonlar" },
          ],
        },
      ]),
    },
    {
      title: "Tashkilot",
      items: clean<NavItem>([
        { to: "/members", label: "Foydalanuvchilar", icon: UserCog, perm: "core.users.manage" },
        item("roles"),
        { to: "/organization", label: "Tashkilot sozlamalari", icon: Settings },
        { to: "/billing", label: "Obuna va to'lovlar", icon: CreditCard, perm: "core.billing.view" },
        { to: "/support", label: "TIZIMS yordami", icon: LifeBuoy, perm: "core.support.manage" },
        { to: "/audit", label: "Audit log", icon: ScrollText, perm: "core.audit.view" },
      ]),
    },
  ];
}

/** Talaba / ota-ona menyusi: kundalik o'qish oqimi bo'yicha */
function learnerSections(role: string): NavSection[] {
  const f = (k: FeatureKey) => FEATURES.find((x) => x.key === k)!;
  const has = (k: FeatureKey) => !!f(k).access[role as Role];
  const item = (k: FeatureKey, label?: string, extra: Partial<NavItem> = {}): NavItem | null =>
    has(k) ? { to: f(k).path, label: label ?? featureLabel(f(k), role), icon: FEATURE_ICONS[k], module: "education", ...extra } : null;
  const clean = (xs: (NavItem | null)[]) => xs.filter(Boolean) as NavItem[];
  const parent = role === "parent";
  return [
    { title: "Asosiy", items: clean([{ to: "/", label: "Bosh sahifa", icon: LayoutDashboard }, item("timetable", parent ? "Dars jadvali" : "Dars jadvali"), item("mySubjects", parent ? "Fanlar va o'qituvchilar" : "Fanlar va o'qituvchilar")]) },
    {
      title: "O'qish",
      items: clean([
        item("grades", "Baholar"),
        item("attendance", "Davomat"),
        has("lms") ? { to: "/lms?tab=assignments", label: "Topshiriqlar", icon: ClipboardList, module: "education" } : null,
        item("tests"),
        has("lms") ? { to: "/lms?tab=library", label: "Elektron kutubxona", icon: Library, module: "education" } : null,
      ]),
    },
    { title: "Aloqa", items: clean([item("news"), item("blog"), item("messages", undefined, { badge: "messages" }), item("complaints", "Shikoyatlar"), item("insights")]) },
    { title: "Yordam", items: clean([item("support"), { to: "/settings", label: "Sozlamalar", icon: Settings }]) },
  ];
}

/** Nazoratchi menyusi: xonalar, davomat va baholash, murojaatlar */
function supervisorSections(role: string): NavSection[] {
  const f = (k: FeatureKey) => FEATURES.find((x) => x.key === k)!;
  const has = (k: FeatureKey) => !!f(k).access[role as Role];
  const item = (k: FeatureKey, label?: string, extra: Partial<NavItem> = {}): NavItem | null =>
    has(k) ? { to: f(k).path, label: label ?? featureLabel(f(k), role), icon: FEATURE_ICONS[k], module: "education", ...extra } : null;
  const clean = (xs: (NavItem | null)[]) => xs.filter(Boolean) as NavItem[];
  return [
    { title: "Nazorat", items: clean([{ to: "/", label: "Xonalar monitoringi", icon: DoorOpen }, item("timetable"), item("attendance", "Davomat"), item("grades", "Baholash"), item("complaints", "Murojaatlar", { badge: "newComplaints", urgent: true })]) },
    { title: "Talabalar", items: clean([item("people", "Talabalar"), item("academic", "Guruhlar va fanlar"), item("insights")]) },
    { title: "Kontent", items: clean([item("tests"), item("news"), item("blog"), item("messages", undefined, { badge: "messages" })]) },
    { title: "Boshqa", items: clean([{ to: "/tasks", label: "Vazifalarim", icon: ClipboardList, badge: "myTasks" }, { to: "/settings", label: "Sozlamalar", icon: Settings }]) },
  ];
}

function pathMatches(pathname: string, to?: string, end?: boolean) {
  if (!to) return false;
  if (to === "/" || end) return pathname === to;
  return pathname === to || pathname.startsWith(to + "/");
}

function childIsActive(pathname: string, child: NavChild): boolean {
  if (pathMatches(pathname, child.to, child.end)) return true;
  return child.children?.some((c) => childIsActive(pathname, c)) ?? false;
}

function filterChildren(children: NavChild[] | undefined, ok: (c: NavChild) => boolean): NavChild[] | undefined {
  if (!children) return undefined;
  return children
    .filter(ok)
    .map((c) => ({ ...c, children: filterChildren(c.children, ok) }))
    .filter((c) => c.to || (c.children && c.children.length > 0));
}

function initials(name?: string) {
  if (!name) return "U";
  const parts = name.replace(/^(Dr\.|Prof\.)\s*/i, "").split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
}

export function AppLayout() {
  const { user, notifications, hasModule, can, mustChangePassword } = useApp();
  const [pwOpen, setPwOpen] = useState(false);
  useEffect(() => {
    const open = () => setPwOpen(true);
    window.addEventListener(PASSWORD_EVENT, open);
    return () => window.removeEventListener(PASSWORD_EVENT, open);
  }, []);
  const passwordUi = mustChangePassword ? <PasswordDialog forced /> : pwOpen ? <PasswordDialog onClose={() => setPwOpen(false)} /> : null;
  const { mode, toggle } = useTheme();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [headerMenu, setHeaderMenu] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  const visibleNotes = notifications.filter((n) => noteVisible(n, user?.id, user?.role));
  const unread = visibleNotes.filter((n) => !n.read).length;
  useEffect(() => {
    setMobile(false);
    setBellOpen(false);
    setProfileOpen(false);
    setHeaderMenu(false);
  }, [loc.pathname]);

  const role = user?.role ?? "";
  const routeOk = (to?: string) => !to || eduRouteAllowed(role, to);
  const childOk = (c: NavChild) => (!c.module || hasModule(c.module)) && !(c.roles && !c.roles.includes(role)) && !(c.perm && !can(c.perm)) && routeOk(c.to);

  // Haqiqiy belgilar: har sahifa almashganda va har daqiqada yangilanadi
  const badgeQ = useApi<Badges>(role && role !== "super_admin" && !mustChangePassword ? "/org/badges" : null);
  const reloadBadges = badgeQ.reload;
  useEffect(() => {
    void reloadBadges();
    const t = setInterval(() => void reloadBadges(), 30000);
    const on = () => void reloadBadges();
    window.addEventListener(BADGES_EVENT, on);
    return () => {
      clearInterval(t);
      window.removeEventListener(BADGES_EVENT, on);
    };
  }, [loc.pathname, reloadBadges]);
  const badges = badgeQ.data ?? {};

  // Yangi xabar kelsa va sahifa boshqa varaqda bo'lsa — brauzer bildirishnomasi (ruxsat berilgan bo'lsa)
  const prevMessages = useRef<number | null>(null);
  useEffect(() => {
    const n = badgeQ.data?.messages;
    if (n === undefined) return;
    const prev = prevMessages.current;
    prevMessages.current = n;
    if (prev === null || n <= prev || !document.hidden) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const note = new Notification("TIZIMS · yangi xabar", { body: `O'qilmagan xabarlar: ${n}`, tag: "tizims-messages" });
    note.onclick = () => {
      window.focus();
      nav("/messages");
      note.close();
    };
  }, [badgeQ.data?.messages, nav]);

  const allSections =
    role === "super_admin"
      ? PLATFORM_SECTIONS
      : LEADER_ROLES.includes(role)
        ? leaderSections(role)
        : role === "student" || role === "parent"
          ? learnerSections(role)
          : role === "advisor"
            ? supervisorSections(role)
            : [SECTIONS[0], ...featureSections(role), ...SECTIONS.slice(1)];
  const sections = allSections.map((s) => ({
    ...s,
    items: s.items
      .filter((i) => !(i.roles && !i.roles.includes(role)) && !(i.perm && !can(i.perm)) && !(i.module && !hasModule(i.module)) && routeOk(i.to))
      .map((i) => ({ ...i, children: filterChildren(i.children, childOk) }))
      .filter((i) => i.to || (i.children && i.children.length > 0)),
  })).filter((s) => s.items.length > 0);

  const collapsed = !open && !mobile;

  if (isMobile) {
    return (
      <>
      {passwordUi}
      <MobileShell
        sections={sections.map((sec) => ({
          ...sec,
          // Mobil menyuda yig'iladigan guruhlar ochiq ro'yxat sifatida
          items: sec.items.flatMap((i) => (i.to ? [i] : (i.children ?? []).filter((c) => c.to).map((c) => ({ ...i, to: c.to, label: c.label, end: c.end, children: undefined })))),
        }))}
        notes={visibleNotes}
        unread={unread}
        avatar={initials(user?.name)}
        mode={mode}
        toggleTheme={toggle}
      />
      </>
    );
  }

  return (
    <div className="ts-shell min-h-screen">
      {passwordUi}
      {mobile && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMobile(false)} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-ts-line bg-ts-side transition-all duration-200",
          collapsed ? "w-[56px]" : "w-[250px]",
          mobile ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className={cn("flex shrink-0 items-center gap-2.5", collapsed ? "justify-center px-2 py-4" : "p-4")}>
          <NavLink to="/" className="flex items-center gap-2.5" title="TIZIMS.AI">
            <Logo size={26} compact={collapsed} />
          </NavLink>
          {mobile && (
            <button className="ml-auto rounded-md p-1 text-ts-muted hover:bg-ts-hover lg:hidden" onClick={() => setMobile(false)}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="ts-scroll-none flex-1 overflow-y-auto px-2 pb-4">
          {sections.map((s) => (
            <div key={s.title} className="mb-4 mt-2">
              {!collapsed ? (
                <div className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-ts-fg opacity-60">{s.title}</div>
              ) : (
                <div className="mx-auto mb-2 h-px w-6 bg-ts-line" />
              )}
              <div className="space-y-0.5">
                {s.items.map((item) => (
                  <NavGroup key={item.label} item={item} collapsed={collapsed} badges={badges} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="relative shrink-0 border-t border-ts-line p-2">
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className={cn("flex h-12 w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-ts-hover", collapsed && "justify-center p-0")}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ts-line bg-ts-chip text-sm text-ts-sub">
              {initials(user?.name)}
            </span>
            {!collapsed && (
              <>
                <span className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate font-semibold text-ts-fg">{user?.name}</span>
                  <span className="truncate text-xs text-ts-sub">{user?.email}</span>
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-ts-fg" />
              </>
            )}
          </button>
          {profileOpen && <ProfileMenu className="fixed bottom-[68px] left-2" onClose={() => setProfileOpen(false)} mode={mode} toggleTheme={toggle} />}
        </div>
      </aside>

      <div className={cn("flex min-h-screen flex-col transition-all", collapsed ? "lg:pl-[56px]" : "lg:pl-[250px]")}>
        <header className="sticky top-0 z-20 flex min-h-[56px] items-center justify-between gap-3 border-b border-ts-line bg-ts-bg px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-md text-ts-fg transition-colors hover:bg-ts-hover"
              title="Sidebar"
              onClick={() => {
                if (window.innerWidth < 1024) setMobile((v) => !v);
                else setOpen((v) => !v);
              }}
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <div className="w-48">
              <GlobalSearchBar variant="compact" />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <HeaderIcon title="Faollik / audit" onClick={() => nav(role === "super_admin" ? "/platform/audit" : ADMIN_ROLES.includes(role) ? "/audit" : "/")}>
              <Activity className="h-[18px] w-[18px]" />
            </HeaderIcon>
            <HeaderIcon title={mode === "dark" ? "Yorug' rejim" : "Qorong'i rejim"} onClick={toggle}>
              {mode === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </HeaderIcon>
            <HeaderIcon title="Til: O'zbekcha">
              <UzFlag />
            </HeaderIcon>
            <div className="relative">
              <HeaderIcon title="Bildirishnomalar" onClick={() => setBellOpen((v) => !v)}>
                <Bell className="h-[18px] w-[18px]" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ts-red px-1 text-[10px] font-medium text-white">
                    {unread}
                  </span>
                )}
              </HeaderIcon>
              {bellOpen && <NotificationPanel onClose={() => setBellOpen(false)} />}
            </div>
            <span className="ms-3 h-[26px] w-px bg-ts-line max-sm:hidden" />
            <div className="relative">
              <button
                title={user?.name}
                onClick={() => setHeaderMenu((v) => !v)}
                className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-ts-line bg-ts-chip text-ts-sub transition-colors hover:text-ts-fg"
              >
                <UserIcon className="h-4 w-4" />
              </button>
              {headerMenu && (
                <ProfileMenu className="absolute right-0 top-10" onClose={() => setHeaderMenu(false)} mode={mode} toggleTheme={toggle} />
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-5">
          <div className="page-enter mx-auto max-w-[1600px]">
            <PlatformBanner className="mb-4" />
            <ActionError />
            <SubjectsProvider>
              <Outlet />
            </SubjectsProvider>
          </div>
        </main>
      </div>
    </div>
  );
}

/** Vazifa/bildirishnoma amallari serverda rad etilsa — foydalanuvchiga ko'rsatiladi. */
export function ActionError() {
  const { lastError, clearError } = useApp();
  useEffect(() => {
    if (!lastError) return;
    const t = setTimeout(clearError, 6000);
    return () => clearTimeout(t);
  }, [lastError, clearError]);
  if (!lastError) return null;
  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-300">
      <span className="flex-1">{lastError}</span>
      <button type="button" onClick={clearError} className="opacity-70 hover:opacity-100" aria-label="Yopish">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function HeaderIcon({ children, title, onClick }: { children: ReactNode; title: string; onClick?: () => void }) {
  return (
    <button title={title} onClick={onClick} className="relative flex h-8 w-8 items-center justify-center rounded-md text-ts-fg transition-colors hover:bg-ts-hover">
      {children}
    </button>
  );
}

function UzFlag() {
  return (
    <span className="flex h-3.5 w-5 flex-col overflow-hidden">
      <span className="flex-1 bg-[#1eb3e6]" />
      <span className="h-px bg-[#ce1126]" />
      <span className="flex-1 bg-white" />
      <span className="h-px bg-[#ce1126]" />
      <span className="flex-1 bg-[#1eb53a]" />
    </span>
  );
}

function useOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", h), 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", h);
    };
  }, [onClose]);
  return ref;
}

function ProfileMenu({
  onClose,
  mode,
  toggleTheme,
  className,
}: {
  onClose: () => void;
  mode: string;
  toggleTheme: () => void;
  className: string;
}) {
  const { user, organization, organizations, switchOrganization, logout } = useApp();
  const nav = useNavigate();
  const ref = useOutside(onClose);
  return (
    <div
      ref={ref}
      className={cn(className, "z-50 w-[240px] overflow-hidden rounded-lg border border-ts-line2 bg-ts-card p-1 text-ts-fg shadow-2xl")}
    >
      <div className="px-2.5 py-2">
        <div className="truncate text-[13px] font-medium">{user?.name}</div>
        <div className="truncate text-[11px] text-ts-muted">{roleLabel(user?.role ?? "")} · {organization?.name}</div>
      </div>
      <div className="my-1 h-px bg-ts-line" />
      {organizations.length > 1 && (
        <>
          <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-ts-muted">Tashkilot</div>
          {organizations.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                switchOrganization(o.id);
                onClose();
                nav("/");
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-ts-hover"
            >
              <Building2 className="h-3.5 w-3.5 text-ts-muted" />
              <span className="flex-1 truncate">{o.name}</span>
              {o.id === organization?.id && <Check className="h-3.5 w-3.5 text-ts-blue" />}
            </button>
          ))}
          <div className="my-1 h-px bg-ts-line" />
        </>
      )}
      <button
        onClick={() => {
          onClose();
          nav("/settings");
        }}
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-ts-hover"
      >
        <Settings className="h-3.5 w-3.5 text-ts-muted" /> Sozlamalar
      </button>
      <button
        onClick={() => {
          onClose();
          window.dispatchEvent(new Event(PASSWORD_EVENT));
        }}
        className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-ts-hover"
      >
        <KeyRound className="h-3.5 w-3.5 text-ts-muted" /> Parolni o'zgartirish
      </button>
      <button onClick={toggleTheme} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-ts-hover">
        {mode === "dark" ? <Sun className="h-3.5 w-3.5 text-ts-muted" /> : <Moon className="h-3.5 w-3.5 text-ts-muted" />}
        {mode === "dark" ? "Yorug' rejim" : "Qorong'i rejim"}
      </button>
      <button onClick={logout} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-red-400 hover:bg-ts-hover">
        <LogOut className="h-3.5 w-3.5" /> Chiqish
      </button>
    </div>
  );
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { user, notifications, markNotificationRead, markAllRead } = useApp();
  const nav = useNavigate();
  const ref = useOutside(onClose);
  const mine = notifications.filter((n) => noteVisible(n, user?.id, user?.role));
  return (
    <div ref={ref} className="absolute right-0 top-10 z-40 w-[min(92vw,360px)] overflow-hidden rounded-lg border border-ts-line2 bg-ts-card text-ts-fg shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[13px] font-semibold">Bildirishnomalar</span>
        <button className="text-xs text-ts-blue2 hover:underline" onClick={markAllRead}>
          Barchasini o'qilgan qilish
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {mine.length === 0 && <div className="px-4 py-8 text-center text-xs text-ts-muted">Yangi bildirishnoma yo'q</div>}
        {mine.map((n) => (
          <button
            key={n.id}
            onClick={() => {
              markNotificationRead(n.id);
              if (n.link) nav(n.link);
            }}
            className={cn("block w-full border-t border-ts-line px-4 py-3 text-left hover:bg-ts-hover", !n.read && "bg-ts-tile")}
          >
            <div className="flex items-center gap-2 text-[13px] font-medium">
              {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-ts-blue" />}
              {n.title}
            </div>
            <div className="mt-0.5 text-xs text-ts-sub">{n.body}</div>
            <div className="mt-1 text-[11px] text-ts-muted">{n.time} · {n.channel}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CountBadge({ n, urgent, collapsed }: { n?: number; urgent?: boolean; collapsed?: boolean }) {
  if (!n) return null;
  if (collapsed) return <span className={cn("absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full", urgent ? "bg-ts-red" : "bg-ts-blue")} />;
  return (
    <span className={cn("ml-auto inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums", urgent ? "bg-ts-red text-white" : "bg-ts-chip text-ts-sub")}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

function NavGroup({ item, collapsed, badges }: { item: NavItem; collapsed: boolean; badges: Badges }) {
  const loc = useLocation();
  const childActive = item.children?.some((c) => childIsActive(loc.pathname, c));
  const [open, setOpen] = useState(!!childActive);
  const Icon = item.icon;

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  const Dot = item.badge ? <CountBadge n={badges[item.badge]} urgent={item.urgent} collapsed={collapsed} /> : null;

  const base = "group flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-sm text-ts-fg transition-colors";

  if (item.to) {
    return (
      <NavLink
        to={item.to}
        end={item.to === "/" || item.end}
        title={collapsed ? item.label : undefined}
        className={({ isActive }) =>
          cn(base, "relative", isActive ? "bg-ts-hover font-medium" : "hover:bg-ts-hover", collapsed && "justify-center px-0")
        }
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {Dot}
      </NavLink>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        title={collapsed ? item.label : undefined}
        className={cn(base, "relative", childActive && "font-medium", "hover:bg-ts-hover", collapsed && "justify-center px-0")}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left">{item.label}</span>
            {Dot}
            <ChevronRight className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-90")} />
          </>
        )}
      </button>
      {open && !collapsed && item.children && (
        <div className="mb-1 ml-[18px] mt-0.5 space-y-0.5 border-l border-ts-line pl-2.5">
          {item.children.map((c) => (
            <NavChildLink key={c.to ?? c.label} child={c} badges={badges} />
          ))}
        </div>
      )}
    </div>
  );
}

function NavChildLink({ child, badges }: { child: NavChild; badges: Badges }) {
  const loc = useLocation();
  const nestedActive = child.children?.some((c) => childIsActive(loc.pathname, c));
  const [open, setOpen] = useState(!!nestedActive);

  useEffect(() => {
    if (nestedActive) setOpen(true);
  }, [nestedActive]);

  if (child.children && child.children.length > 0) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex h-7 w-full items-center rounded-md px-2 text-sm",
            nestedActive ? "text-ts-fg" : "text-ts-sub hover:bg-ts-hover hover:text-ts-fg",
          )}
        >
          <span className="flex-1 text-left">{child.label}</span>
          <ChevronRight className={cn("h-3 w-3 text-ts-muted transition-transform", open && "rotate-90")} />
        </button>
        {open && (
          <div className="ml-2 space-y-px border-l border-ts-line pl-2">
            {child.children.map((c) => (
              <NavChildLink key={c.to ?? c.label} child={c} badges={badges} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!child.to) return null;

  return (
    <NavLink
      to={child.to}
      end={child.end}
      className={({ isActive }) =>
        cn(
          "flex h-7 items-center gap-2 rounded-md px-2 text-sm",
          isActive ? "bg-ts-hover font-medium text-ts-fg" : "text-ts-sub hover:bg-ts-hover hover:text-ts-fg",
        )
      }
    >
      <span className="flex-1 truncate">{child.label}</span>
      {child.badge && <CountBadge n={badges[child.badge]} />}
    </NavLink>
  );
}

export function Guard({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { user } = useApp();
  if (!user) return null;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-500">
        Bu bo'lim sizning rolingiz uchun yopiq.
      </div>
    );
  }
  return <>{children}</>;
}
