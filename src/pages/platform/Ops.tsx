/** Super admin: monitoring, xavfsizlik va platforma auditi. */
import { useState, type ReactNode } from "react";
import { Activity, AlertTriangle, CheckCircle2, Database, HardDrive, Plug, ScrollText, Server, ShieldAlert, ShieldCheck } from "lucide-react";
import { Btn, Card, CardHead, Page, Pill, Progress, QueryState, ScopeNote, SearchBox, SelectBox, Stat, Table, Td, useToast, type Tone } from "../../components/kit";
import { api, errorText, useApi } from "../../lib/api";
import { cn } from "../../lib/utils";
import { downloadCsv } from "../EducationDashboard";
import type { BACKUPS, INCIDENTS, INTEGRATIONS, SECURITY_EVENTS, SECURITY_POLICIES, SERVICES } from "../../data/platform";
import { useTenants } from "./Tenants";

/* ───────── Monitoring ───────── */

const INC: Record<"investigating" | "monitoring" | "resolved", { label: string; tone: Tone }> = {
  investigating: { label: "Tekshirilmoqda", tone: "red" },
  monitoring: { label: "Kuzatilmoqda", tone: "amber" },
  resolved: { label: "Bartaraf etildi", tone: "green" },
};

type MonitoringData = { services: typeof SERVICES; incidents: typeof INCIDENTS; uptime: number[]; backups: typeof BACKUPS };

export function MonitoringPage() {
  const [tenants] = useTenants();
  const [toast, showToast] = useToast();
  const mq = useApi<MonitoringData>("/platform/monitoring");
  if (!mq.data) return <Page title="Monitoring" subtitle="Xizmatlar holati, hodisalar va resurslar"><QueryState error={mq.error} loading={mq.loading} onRetry={mq.reload}>{null}</QueryState></Page>;
  const { services: SERVICES_, incidents: INCIDENTS_, uptime: UPTIME_, backups: BACKUPS_ } = mq.data;
  return <MonitoringView tenants={tenants} services={SERVICES_} incidents={INCIDENTS_} uptime={UPTIME_} backups={BACKUPS_} toast={toast} showToast={showToast} />;
}

function MonitoringView({
  tenants,
  services: SERVICES,
  incidents: INCIDENTS,
  uptime: UPTIME_30D,
  backups: BACKUPS,
  toast,
  showToast,
}: {
  tenants: ReturnType<typeof useTenants>[0];
  services: MonitoringData["services"];
  incidents: MonitoringData["incidents"];
  uptime: number[];
  backups: MonitoringData["backups"];
  toast: ReactNode;
  showToast: (m: string) => void;
}) {
  const degraded = SERVICES.filter((s) => s.status !== "ok");
  const uptime = ((UPTIME_30D.reduce((a, b) => a + b, 0) / UPTIME_30D.length) * 100).toFixed(2);

  return (
    <Page title="Monitoring" subtitle="Xizmatlar holati, hodisalar va resurslar">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Umumiy holat" value={degraded.length ? "Qisman" : "Barqaror"} delta={degraded.length ? `${degraded.length} xizmatda sekinlik` : "Muammo yo'q"} tone={degraded.length ? "amber" : "green"} icon={Activity} />
        <Stat label="Uptime (30 kun)" value={`${uptime}%`} hint="SLA maqsadi: 99.9%" icon={Server} />
        <Stat label="Ochiq hodisalar" value={INCIDENTS.filter((i) => i.status !== "resolved").length} tone="red" icon={AlertTriangle} />
        <Stat label="Oxirgi backup" value={BACKUPS[0].at.slice(11)} hint={`${BACKUPS[0].kind} · ${BACKUPS[0].size}`} icon={Database} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHead title="Xizmatlar" desc="Real vaqt rejimida" className="pb-4" />
          <Table head={["Xizmat", "Javob vaqti", "Uptime", "Holat"]} minWidth={460}>
            {SERVICES.map((s) => (
              <tr key={s.name}>
                <Td className="font-medium">{s.name}</Td>
                <Td className={cn("tabular-nums", s.latency > 500 && "text-amber-500")}>{s.latency} ms</Td>
                <Td className="tabular-nums text-ts-sub">{s.uptime}%</Td>
                <Td>
                  <Pill tone={s.status === "ok" ? "green" : "amber"} dot>
                    {s.status === "ok" ? "Ishlayapti" : "Sekin"}
                  </Pill>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHead title="So'nggi 30 kun" desc={`${uptime}% mavjudlik`} />
            <div className="flex h-10 gap-[3px] p-4 pt-3">
              {UPTIME_30D.map((v, i) => (
                <div key={i} title={v === 1 ? "Muammosiz" : v === 0 ? "Uzilish" : "Qisman"} className={cn("flex-1 rounded-sm", v === 1 ? "bg-emerald-500" : v === 0 ? "bg-red-500" : "bg-amber-500")} />
              ))}
            </div>
            <div className="flex justify-between px-4 pb-4 pt-3 text-[11px] text-ts-muted">
              <span>30 kun oldin</span>
              <span>Bugun</span>
            </div>
          </Card>
          <Card>
            <CardHead title="Hodisalar" desc="Incident log" />
            <div className="space-y-2 p-4">
              {INCIDENTS.map((i) => (
                <div key={i.id} className="flex items-start gap-3 rounded-md border border-ts-line p-3">
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", i.status === "resolved" ? "bg-emerald-500" : i.status === "monitoring" ? "bg-amber-500" : "bg-red-500")} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{i.title}</div>
                    <div className="text-xs text-ts-sub">
                      {i.id} · {i.started} · {i.impact} · {i.tenants} tashkilot
                    </div>
                  </div>
                  <Pill tone={INC[i.status].tone}>{INC[i.status].label}</Pill>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="overflow-hidden">
          <CardHead title="Resurslar tashkilotlar kesimida" desc="Xotira va API so'rovlar (shu oy)" className="pb-4" />
          <Table head={["Tashkilot", "Xotira", "", "API so'rovlar"]} minWidth={560}>
            {tenants.map((t) => {
              const pct = (t.storageGb / t.storageLimitGb) * 100;
              return (
                <tr key={t.id}>
                  <Td className="font-medium">{t.name}</Td>
                  <Td className="whitespace-nowrap tabular-nums text-ts-sub">
                    {t.storageGb}/{t.storageLimitGb} GB
                  </Td>
                  <Td className="w-40">
                    <Progress value={pct} tone={pct > 80 ? "red" : pct > 60 ? "amber" : "blue"} />
                  </Td>
                  <Td className="tabular-nums">{t.apiCalls.toLocaleString("ru-RU")}</Td>
                </tr>
              );
            })}
          </Table>
        </Card>
        <Card>
          <CardHead title="Zaxira nusxalar" desc="Har kuni 03:00 to'liq, 15:00 inkremental" action={
            <Btn
              size="sm"
              onClick={() =>
                api("/platform/backups", { method: "POST" })
                  .then(() => showToast("Zaxira nusxa yaratish navbatga qo'yildi · auditga yozildi"))
                  .catch((e) => showToast(errorText(e)))
              }
            >
              Hozir yaratish
            </Btn>
          } />
          <div className="space-y-2 p-4">
            {BACKUPS.map((b) => (
              <div key={b.at} className="flex items-center gap-3 rounded-md border border-ts-line p-2.5 text-sm">
                <HardDrive className="h-4 w-4 shrink-0 text-ts-sub" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{b.at}</div>
                  <div className="text-xs text-ts-sub">
                    {b.kind} · {b.size}
                  </div>
                </div>
                {b.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Pill tone="red">Xato</Pill>}
              </div>
            ))}
          </div>
        </Card>
      </div>
      {toast}
    </Page>
  );
}

/* ───────── Xavfsizlik ───────── */

const LEVEL: Record<"high" | "medium" | "low", { label: string; tone: Tone }> = { high: { label: "Yuqori", tone: "red" }, medium: { label: "O'rta", tone: "amber" }, low: { label: "Past", tone: "gray" } };

type SecurityData = { policies: (typeof SECURITY_POLICIES)[number][]; events: typeof SECURITY_EVENTS; integrations: typeof INTEGRATIONS };

export function SecurityPage() {
  const [toast, showToast] = useToast();
  const sq = useApi<SecurityData>("/platform/security");
  const SECURITY_POLICIES = sq.data?.policies ?? [];
  const SECURITY_EVENTS = sq.data?.events ?? [];
  const INTEGRATIONS = sq.data?.integrations ?? [];
  const policies: Record<string, boolean> = Object.fromEntries(SECURITY_POLICIES.map((p) => [p.key, p.on]));
  const onCount = Object.values(policies).filter(Boolean).length;

  return (
    <Page title="Xavfsizlik va integratsiyalar" subtitle="Platforma bo'yicha xavfsizlik siyosatlari, hodisalar va tashqi tizimlar">
      {sq.error && <QueryState error={sq.error} loading={false} onRetry={sq.reload}>{null}</QueryState>}
      <ScopeNote>Siyosatlar sozlamasi saqlanadi va auditga yoziladi. Ularni login jarayonida majburiy qo'llash (2FA, IP cheklov) keyingi bosqichda ulanadi.</ScopeNote>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Faol siyosatlar" value={`${onCount}/${SECURITY_POLICIES.length}`} icon={ShieldCheck} />
        <Stat label="Xavfsizlik hodisalari" value={SECURITY_EVENTS.length} delta={`${SECURITY_EVENTS.filter((e) => e.level === "high").length} yuqori`} tone="red" icon={ShieldAlert} />
        <Stat label="Ulangan integratsiyalar" value={INTEGRATIONS.filter((i) => i.status === "connected").length} icon={Plug} />
        <Stat label="Shifrlash" value="AES-256" hint="Ma'lumotlar bazasi va fayllar · TLS 1.3" icon={Database} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHead title="Xavfsizlik siyosatlari" desc="Barcha tashkilotlarga qo'llanadi" />
          <div className="space-y-1 p-2">
            {SECURITY_POLICIES.map((p) => {
              const on = policies[p.key];
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={async () => {
                    try {
                      const next = await api<(typeof SECURITY_POLICIES)[number]>(`/platform/security/policies/${p.key}`, { method: "PATCH", body: { on: !on } });
                      if (sq.data) sq.setData({ ...sq.data, policies: SECURITY_POLICIES.map((x) => (x.key === p.key ? next : x)) });
                      showToast(`${p.name}: ${on ? "o'chirildi" : "yoqildi"}`);
                    } catch (e) {
                      showToast(errorText(e));
                    }
                  }}
                  className="flex w-full items-center gap-3 rounded-md px-2.5 py-2.5 text-left transition hover:bg-ts-hover"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-ts-sub">{p.desc}</div>
                  </div>
                  <span className={cn("h-5 w-9 shrink-0 rounded-full p-0.5 transition", on ? "bg-emerald-500" : "bg-ts-line2")}>
                    <span className={cn("block h-4 w-4 rounded-full bg-white shadow transition", on && "translate-x-4")} />
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
        <Card className="overflow-hidden">
          <CardHead title="Xavfsizlik hodisalari" desc="So'nggi 72 soat" className="pb-4" />
          <Table head={["Vaqt", "Hodisa", "Daraja"]} minWidth={480}>
            {SECURITY_EVENTS.map((e) => (
              <tr key={e.at}>
                <Td className="whitespace-nowrap text-ts-sub">{e.at.slice(5)}</Td>
                <Td>
                  <div className="font-medium">{e.event}</div>
                  <div className="text-xs text-ts-sub">
                    {e.who} · {e.ip}
                  </div>
                </Td>
                <Td>
                  <Pill tone={LEVEL[e.level].tone} dot>
                    {LEVEL[e.level].label}
                  </Pill>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <Card>
        <CardHead title="Integratsiyalar" desc="Tashqi tizimlar — tashkilotlar o'zi yoqadi" />
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {INTEGRATIONS.map((i) => (
            <div key={i.name} className="flex items-start gap-3 rounded-md border border-ts-line p-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ts-chip">
                <Plug className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{i.name}</span>
                  <Pill tone={i.status === "connected" ? "green" : i.status === "beta" ? "violet" : "gray"}>{i.status === "connected" ? "Ulangan" : i.status === "beta" ? "Beta" : "Mavjud"}</Pill>
                </div>
                <div className="text-xs text-ts-sub">{i.desc}</div>
                <div className="mt-1 text-xs text-ts-muted">{i.tenants} tashkilotda ishlatilmoqda</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
      {toast}
    </Page>
  );
}

/* ───────── Platforma auditi ───────── */

type AuditRow = { id: number; at: string; actor: string; action: string; target: string; detail: string; ip: string };

export function PlatformAuditPage() {
  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");
  const aq = useApi<AuditRow[]>("/platform/audit");
  const PLATFORM_AUDIT = aq.data ?? [];
  const actions = Array.from(new Set(PLATFORM_AUDIT.map((a) => a.action)));
  const list = PLATFORM_AUDIT.filter((a) => (action === "all" || a.action === action) && `${a.actor} ${a.target} ${a.detail}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <Page
      title="Platforma auditi"
      subtitle="Super admin va yordam xizmati harakatlari — o'zgartirib bo'lmaydigan jurnal"
      actions={
        <Btn onClick={() => downloadCsv("platforma-audit", [["Vaqt", "Kim", "Harakat", "Obyekt", "Tafsilot"], ...list.map((a) => [a.at, a.actor, a.action, a.target, a.detail])])}>
          <ScrollText className="h-4 w-4" /> CSV eksport
        </Btn>
      }
    >
      <div className="flex flex-wrap gap-2">
        <SelectBox className="h-8 w-auto" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="all">Barcha harakatlar</option>
          {actions.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </SelectBox>
        <SearchBox value={q} onChange={setQ} placeholder="Qidirish..." className="w-64" />
      </div>
      <QueryState error={aq.error} loading={aq.loading && !aq.data} onRetry={aq.reload}>
      <Card className="overflow-hidden">
        <Table head={["Vaqt", "Kim", "Harakat", "Obyekt", "Tafsilot"]} minWidth={820}>
          {list.map((a) => (
            <tr key={a.id}>
              <Td className="whitespace-nowrap text-ts-sub">{a.at}</Td>
              <Td className="font-medium">{a.actor}</Td>
              <Td>
                <Pill tone={a.action === "Yordam rejimi" ? "amber" : a.action === "Xavfsizlik" ? "red" : "gray"}>{a.action}</Pill>
              </Td>
              <Td className="text-ts-sub">{a.target}</Td>
              <Td>{a.detail}</Td>
            </tr>
          ))}
        </Table>
      </Card>
      </QueryState>
    </Page>
  );
}
