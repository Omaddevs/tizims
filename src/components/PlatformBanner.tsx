/** Super admin e'lonlari va rejali texnik ishlar — tashkilot foydalanuvchilarida ko'rinadigan banner. */
import { useState } from "react";
import { Info, KeyRound, Megaphone, Sparkles, Wrench, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../store/AppContext";
import { cn } from "../lib/utils";
import { fmtDateTime } from "../lib/maintenance";
import { useApi } from "../lib/api";
import type { Announcement, Maintenance } from "../data/platform";

/** Yopilgan bannerlar — har bir foydalanuvchi uchun alohida (brauzerda, faqat qulaylik uchun). */
const dismissKey = (userId: string) => `tizims:dismissed-banners:${userId}`;

function loadDismissed(userId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(dismissKey(userId)) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function PlatformBanner({ className }: { className?: string }) {
  const { user, organization } = useApp();
  const skip = !user || user.role === "super_admin" || !organization;
  // Auditoriya filtri serverda (tashkilot turi va rol bo'yicha)
  const q = useApi<{ announcements: Announcement[]; maintenance: Maintenance | null }>(skip ? null : `/org/banner?o=${organization?.id}`);
  const isOrgAdmin = !skip && (user.role === "owner" || user.role === "rector");
  const access = useApi<{ id: string; status: string; reason: string }[]>(isOrgAdmin ? `/org/support-access?o=${organization?.id}` : null);
  const [dismissed, setDismissed] = useState<string[]>(() => loadDismissed(user?.id ?? ""));
  const nav = useNavigate();

  if (skip || !q.data) return null;
  const pendingAccess = (access.data ?? []).filter((x) => x.status === "pending");
  const mnt = q.data.maintenance;
  const items: { id: string; tone: Announcement["tone"]; title: string; body: string; icon: typeof Info }[] = [];
  if (mnt) items.push({ id: mnt.id, tone: "warning", title: `Rejali texnik ish: ${fmtDateTime(mnt.start)} — ${fmtDateTime(mnt.end)}`, body: `${mnt.title}. Bu vaqtda ${mnt.services.join(", ").toLowerCase()} vaqtincha ishlamaydi.`, icon: Wrench });
  for (const a of q.data.announcements) items.push({ id: a.id, tone: a.tone, title: a.title, body: a.body, icon: a.tone === "success" ? Sparkles : a.tone === "warning" ? Megaphone : Info });

  const visible = items.filter((i) => !dismissed.includes(i.id)).slice(0, 2);
  if (visible.length === 0 && pendingAccess.length === 0) return null;

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(dismissKey(user!.id), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {pendingAccess.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3.5 py-2.5 text-sm text-violet-900 dark:text-violet-200">
          <KeyRound className="h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="font-medium">TIZIMS yordam xizmati kirish so'ramoqda</span>
            <span className="opacity-80"> — {pendingAccess[0].reason}. Ruxsatsiz hech kim tashkilotingiz ma'lumotlarini ko'ra olmaydi.</span>
          </div>
          <button type="button" onClick={() => nav("/organization")} className="shrink-0 rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700">
            Ko'rib chiqish
          </button>
        </div>
      )}
      {visible.map((i) => (
        <div
          key={i.id}
          className={cn(
            "flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-sm",
            i.tone === "warning" && "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
            i.tone === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
            i.tone === "info" && "border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-200",
          )}
        >
          <i.icon className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="font-medium">{i.title}</span>
            <span className="opacity-80"> — {i.body}</span>
          </div>
          <button type="button" onClick={() => dismiss(i.id)} className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100" aria-label="Yopish">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
