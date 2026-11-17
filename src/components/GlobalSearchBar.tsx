import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Command, CornerDownLeft, LayoutDashboard, Search, SlidersHorizontal, X } from "lucide-react";
import { useApp } from "../store/AppContext";
import { cn } from "../lib/utils";
import { eduRouteAllowed } from "../core/catalog";
import { FEATURES, featureLabel } from "../core/features";

type Hit = { id: string; title: string; subtitle: string; to: string; kind: "page" | "task" };

const PAGES: { title: string; subtitle: string; to: string; roles?: string[] }[] = [
  { title: "Ta'lim boshqaruvi", subtitle: "Dashboard", to: "/" },
  { title: "Vazifalarim", subtitle: "Vazifalar", to: "/tasks" },
  { title: "Barcha vazifalar", subtitle: "Vazifalar", to: "/tasks/all", roles: ["super_admin", "owner", "rector", "dept_head"] },
  { title: "Vazifa shablonlari", subtitle: "Vazifalar", to: "/tasks/templates", roles: ["super_admin", "owner", "rector", "dept_head"] },
  { title: "Tashkilot sozlamalari", subtitle: "Tizim", to: "/organization", roles: ["owner", "rector"] },
  { title: "Audit log", subtitle: "Tizim", to: "/audit", roles: ["owner", "rector"] },
  { title: "Foydalanuvchilar", subtitle: "Tizim", to: "/members", roles: ["owner"] },
  { title: "Ta'lim analitikasi", subtitle: "Dashboard", to: "/analytics", roles: ["owner"] },
  { title: "Obuna va to'lovlar", subtitle: "Tizim", to: "/billing", roles: ["owner"] },
  { title: "TIZIMS yordami", subtitle: "Tizim", to: "/support", roles: ["owner", "rector"] },
  { title: "Tashkilotlar", subtitle: "Platforma", to: "/platform/tenants", roles: ["super_admin"] },
  { title: "Obunalar va to'lovlar", subtitle: "Platforma", to: "/platform/billing", roles: ["super_admin"] },
  { title: "Yordam markazi", subtitle: "Platforma", to: "/platform/support", roles: ["super_admin"] },
  { title: "Monitoring", subtitle: "Platforma", to: "/platform/monitoring", roles: ["super_admin"] },
  { title: "Platforma auditi", subtitle: "Platforma", to: "/platform/audit", roles: ["super_admin"] },
  { title: "O'sish va onboarding", subtitle: "Platforma", to: "/platform/growth", roles: ["super_admin"] },
  { title: "E'lonlar va texnik ishlar", subtitle: "Platforma", to: "/platform/announcements", roles: ["super_admin"] },
  { title: "Relizlar va funksiyalar", subtitle: "Platforma", to: "/platform/releases", roles: ["super_admin"] },
  { title: "Platforma jamoasi", subtitle: "Platforma", to: "/platform/team", roles: ["super_admin"] },
  { title: "API va ma'lumotlar", subtitle: "Platforma", to: "/platform/data", roles: ["super_admin"] },
  { title: "Xavfsizlik va integratsiyalar", subtitle: "Super Admin", to: "/system", roles: ["super_admin"] },
];

/** ⌘K / Ctrl+K — sahifalar va vazifalar bo'yicha tezkor qidiruv (faqat foydalanuvchiga ruxsat etilganlar). */
export function GlobalSearchBar({
  variant = "bar",
  hotkey = true,
  renderTrigger,
}: {
  variant?: "bar" | "icon" | "compact" | "pill";
  /** ⌘K tinglovchisi — bir sahifada bir nechta nusxa bo'lsa, faqat bittasida yoqing. */
  hotkey?: boolean;
  renderTrigger?: (open: () => void) => ReactNode;
}) {
  const { user, tasks, hasModule } = useApp();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const role = user?.role ?? "";

  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase();
    const featurePages: typeof PAGES = FEATURES.filter((f) => f.access[role as keyof typeof f.access] && hasModule("education")).map((f) => ({
      title: featureLabel(f, role),
      subtitle: f.section,
      to: f.path,
    }));
    const pages: Hit[] = [...PAGES, ...featurePages].filter((p) => (!p.roles || p.roles.includes(role)) && eduRouteAllowed(role, p.to)).map((p) => ({
      id: p.to,
      title: p.title,
      subtitle: p.subtitle,
      to: p.to,
      kind: "page",
    }));
    const taskHits: Hit[] = eduRouteAllowed(role, "/tasks")
      ? tasks
          .filter((t) => !t.archived)
          .map((t) => ({ id: t.id, title: t.title, subtitle: `${t.category} · ${t.dueLabel}`, to: "/tasks/all", kind: "task" as const }))
      : [];
    const all = [...pages, ...taskHits];
    if (!q) return all.slice(0, 8);
    return all.filter((h) => `${h.title} ${h.subtitle}`.toLowerCase().includes(q)).slice(0, 12);
  }, [query, role, tasks, hasModule]);

  function go(h: Hit) {
    setOpen(false);
    nav(h.to);
  }

  return (
    <>
      {renderTrigger ? (
        renderTrigger(() => setOpen(true))
      ) : variant === "pill" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-[52px] w-full items-center gap-3 rounded-full border border-ts-line bg-ts-card pl-4 pr-1.5 text-left text-sm text-ts-muted transition-colors active:bg-ts-hover"
        >
          <Search className="h-[18px] w-[18px] shrink-0 text-ts-sub" />
          <span className="flex-1 truncate">Sahifa yoki vazifani qidiring...</span>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ts-inv text-ts-invfg">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
        </button>
      ) : variant === "icon" ? (
        <button type="button" onClick={() => setOpen(true)} title="Qidiruv" className="flex h-8 w-8 items-center justify-center rounded-md text-ts-fg hover:bg-ts-hover">
          <Search className="h-[18px] w-[18px]" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ts-search flex h-8 w-full items-center justify-between gap-1 rounded-md border px-2.5 text-left text-sm transition-colors"
        >
          <span className="truncate">Qidirish...</span>
          <span className="flex shrink-0 items-center gap-1">
            <kbd className="ts-kbd">
              <Command className="h-2.5 w-2.5" />
            </kbd>
            <kbd className="ts-kbd">K</kbd>
          </span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" onMouseDown={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="ts-pop relative w-full max-w-lg overflow-hidden rounded-xl border border-ts-line bg-ts-card text-ts-fg shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-ts-line px-3">
              <Search className="h-4 w-4 shrink-0 text-ts-sub" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, hits.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                  } else if (e.key === "Enter" && hits[active]) go(hits[active]);
                }}
                placeholder="Sahifa yoki vazifani qidiring..."
                className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-ts-sub"
              />
              <button onClick={() => setOpen(false)} className="rounded p-1 text-ts-sub hover:text-ts-fg">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-1">
              {hits.length === 0 && <div className="px-3 py-8 text-center text-sm text-ts-sub">Hech narsa topilmadi</div>}
              {hits.map((h, i) => {
                const Icon = h.kind === "page" ? LayoutDashboard : ClipboardList;
                return (
                  <button
                    key={`${h.kind}-${h.id}`}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(h)}
                    className={cn("flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left", i === active && "bg-ts-hover")}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ts-chip">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{h.title}</span>
                      <span className="block truncate text-xs text-ts-sub">{h.subtitle}</span>
                    </span>
                    {i === active && <CornerDownLeft className="h-4 w-4 text-ts-sub" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
