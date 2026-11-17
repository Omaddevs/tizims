/** status.tizims.uz — ommaviy holat sahifasi (tizimga kirish shart emas). */
import { CheckCircle2, CircleAlert, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";
import { fmtDateTime } from "../lib/maintenance";
import { useApi } from "../lib/api";
import type { Maintenance } from "../data/platform";

type PublicStatus = {
  services: { name: string; status: "ok" | "degraded" }[];
  incidents: { id: string; title: string; status: string; started: string; impact: string }[];
  uptime: number[];
  maintenance: Maintenance | null;
};

export function StatusPage() {
  const q = useApi<PublicStatus>("/public/status");
  const next = q.data?.maintenance;
  const open = q.data?.incidents ?? [];
  const SERVICES = q.data?.services ?? [];
  const UPTIME_30D = q.data?.uptime ?? [];
  const degraded = SERVICES.some((s) => s.status !== "ok");
  const uptime = UPTIME_30D.length ? ((UPTIME_30D.reduce((a, b) => a + b, 0) / UPTIME_30D.length) * 100).toFixed(2) : "—";

  return (
    <div className="min-h-screen bg-[#f6f6f7] px-4 py-10 font-sans text-neutral-950">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            tizims<span className="text-neutral-400">.status</span>
          </Link>
          <Link to="/login" className="text-sm text-neutral-500 hover:text-neutral-900">
            Tizimga kirish →
          </Link>
        </div>

        {q.error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Holat ma'lumotini olib bo'lmadi: {q.error}</div>}
        {q.data && (
        <div className={cn("flex items-center gap-3 rounded-xl p-5 text-white", degraded || open.length ? "bg-amber-500" : "bg-emerald-600")}>
          {degraded || open.length ? <CircleAlert className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
          <div>
            <div className="text-lg font-semibold">{degraded || open.length ? "Ayrim xizmatlarda sekinlik bor" : "Barcha tizimlar ishlamoqda"}</div>
            <div className="text-sm opacity-85">Yangilangan: {fmtDateTime(new Date().toISOString())}</div>
          </div>
        </div>
        )}

        {next && (
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <Wrench className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">Rejali texnik ish: {next.title}</div>
              <div className="text-blue-800/80">
                {fmtDateTime(next.start)} — {fmtDateTime(next.end)} · {next.services.join(", ")}
              </div>
            </div>
          </div>
        )}

        {open.length > 0 && (
          <section className="rounded-xl border border-neutral-200 bg-white">
            <div className="border-b border-neutral-100 px-5 py-3 font-medium">Faol hodisalar</div>
            {open.map((i) => (
              <div key={i.id} className="border-b border-neutral-100 px-5 py-3 last:border-0">
                <div className="font-medium">{i.title}</div>
                <div className="text-sm text-neutral-500">
                  {i.status === "investigating" ? "Tekshirilmoqda" : "Kuzatilmoqda"} · {i.started} · Ta'sir: {i.impact}
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="rounded-xl border border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
            <span className="font-medium">Xizmatlar</span>
            <span className="text-sm text-neutral-500">30 kunlik uptime: {uptime}%</span>
          </div>
          {SERVICES.map((s) => (
            <div key={s.name} className="flex items-center justify-between border-b border-neutral-100 px-5 py-3 text-sm last:border-0">
              <span>{s.name}</span>
              <span className={cn("flex items-center gap-1.5 font-medium", s.status === "ok" ? "text-emerald-600" : "text-amber-600")}>
                <span className={cn("h-2 w-2 rounded-full", s.status === "ok" ? "bg-emerald-500" : "bg-amber-500")} />
                {s.status === "ok" ? "Ishlamoqda" : "Sekin"}
              </span>
            </div>
          ))}
          <div className="flex h-12 gap-[3px] px-5 py-3">
            {UPTIME_30D.map((v, i) => (
              <div key={i} className={cn("flex-1 rounded-sm", v === 1 ? "bg-emerald-500" : v === 0 ? "bg-red-500" : "bg-amber-400")} />
            ))}
          </div>
          <div className="flex justify-between px-5 pb-3 text-xs text-neutral-400">
            <span>30 kun oldin</span>
            <span>Bugun</span>
          </div>
        </section>

        <p className="text-center text-xs text-neutral-400">© {new Date().getFullYear()} TIZIMS.AI · Muammo bo'lsa: support@tizims.ai</p>
      </div>
    </div>
  );
}
