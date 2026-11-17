import { useState } from "react";
import { Flag, FlaskConical, GitCommitHorizontal, Rocket } from "lucide-react";
import { Btn, Card, Modal, Page, Pill, QueryState, ScopeNote, Stat, Tabs, fmtDate, useToast } from "../../components/kit";
import { api, errorText, useApi } from "../../lib/api";
import { cn } from "../../lib/utils";
import { RELEASES, type FeatureFlag } from "../../data/platform";
import { useTenants } from "./Tenants";

const STAGES: { key: FeatureFlag["stage"]; label: string }[] = [
  { key: "off", label: "O'chiq" },
  { key: "pilot", label: "Pilot" },
  { key: "on", label: "Hammaga" },
];

export function ReleasesPage() {
  const [toast, showToast] = useToast();
  const [tenants] = useTenants();
  const q = useApi<FeatureFlag[]>("/platform/flags");
  const flags = q.data ?? [];
  const [tab, setTab] = useState<"flags" | "releases">("flags");
  const [pilotKey, setPilotKey] = useState<string | null>(null);
  const pilot = flags.find((f) => f.key === pilotKey) ?? null;
  const name = (slug: string) => tenants.find((t) => t.slug === slug)?.name ?? slug;

  async function patch(key: string, p: Partial<Pick<FeatureFlag, "stage" | "tenants">>, msg: string) {
    try {
      const next = await api<FeatureFlag>(`/platform/flags/${key}`, { method: "PATCH", body: p });
      q.setData(flags.map((f) => (f.key === key ? next : f)));
      showToast(msg);
    } catch (e) {
      showToast(errorText(e));
    }
  }

  function setStage(f: FeatureFlag, stage: FeatureFlag["stage"]) {
    if (stage === f.stage) return;
    const needsPilot = stage === "pilot" && f.tenants.length === 0;
    patch(f.key, { stage, tenants: needsPilot ? [tenants[0]?.slug ?? ""] : f.tenants }, `${f.name}: ${STAGES.find((s) => s.key === stage)?.label}`);
    if (needsPilot) setPilotKey(f.key);
  }

  return (
    <Page title="Relizlar va funksiyalar" subtitle="Yangi funksiyalarni bosqichma-bosqich yoqish va versiyalar tarixi">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Joriy versiya" value={RELEASES[0].version} hint={fmtDate(RELEASES[0].date)} icon={Rocket} />
        <Stat label="Pilotdagi funksiyalar" value={flags.filter((f) => f.stage === "pilot").length} icon={FlaskConical} />
        <Stat label="Hammaga yoqilgan" value={flags.filter((f) => f.stage === "on").length} icon={Flag} />
        <Stat label="Relizlar (shu oy)" value={RELEASES.filter((r) => r.date.startsWith("2026-11")).length} icon={GitCommitHorizontal} />
      </div>

      {q.error && <QueryState error={q.error} loading={false} onRetry={q.reload}>{null}</QueryState>}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "flags", label: "Funksiya bayroqlari", count: flags.length },
          { key: "releases", label: "Versiyalar tarixi", count: RELEASES.length },
        ]}
      />

      {tab === "flags" && (
        <>
          <ScopeNote>Yangi funksiya avval 1–2 pilot tashkilotda sinaladi, keyin hammaga yoqiladi. Muammo chiqsa, bir tugma bilan o'chiriladi.</ScopeNote>
          <div className="space-y-3">
            {flags.map((f) => (
              <Card key={f.key} className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{f.name}</span>
                    <span className="font-mono text-[11px] text-ts-muted">{f.key}</span>
                  </div>
                  <div className="text-sm text-ts-sub">{f.desc}</div>
                  {f.stage === "pilot" && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {f.tenants.map((t) => (
                        <Pill key={t} tone="violet">
                          {name(t)}
                        </Pill>
                      ))}
                      <button type="button" onClick={() => setPilotKey(f.key)} className="text-xs font-medium text-ts-blue hover:underline">
                        Tahrirlash
                      </button>
                    </div>
                  )}
                </div>
                <div className="inline-flex rounded-lg bg-ts-chip p-1">
                  {STAGES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setStage(f, s.key)}
                      className={cn(
                        "h-7 rounded-md px-3 text-sm font-medium transition",
                        f.stage === s.key ? (s.key === "on" ? "bg-emerald-500 text-white" : s.key === "pilot" ? "bg-violet-500 text-white" : "bg-ts-card text-ts-fg shadow-sm") : "text-ts-sub hover:text-ts-fg",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {tab === "releases" && (
        <Card className="p-4">
          <div className="relative space-y-6 border-l border-ts-line pl-6">
            {RELEASES.map((r) => (
              <div key={r.version} className="relative">
                <span className={cn("absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-ts-card", r.kind === "major" ? "bg-ts-blue3" : r.kind === "minor" ? "bg-emerald-500" : "bg-ts-muted")} />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">v{r.version}</span>
                  <Pill tone={r.kind === "major" ? "blue" : r.kind === "minor" ? "green" : "gray"}>{r.kind === "major" ? "Katta" : r.kind === "minor" ? "Yangi funksiyalar" : "Tuzatishlar"}</Pill>
                  <span className="text-xs text-ts-muted">{fmtDate(r.date)}</span>
                </div>
                <div className="mt-1 font-medium">{r.title}</div>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-ts-sub">
                  {r.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}

      {pilot && (
        <Modal
          open
          onClose={() => setPilotKey(null)}
          title={`Pilot tashkilotlar · ${pilot.name}`}
          footer={
            <Btn variant="primary" onClick={() => setPilotKey(null)}>
              Tayyor
            </Btn>
          }
        >
          <div className="space-y-1">
            {tenants.map((t) => {
              const on = pilot.tenants.includes(t.slug);
              return (
                <label key={t.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 hover:bg-ts-hover">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => patch(pilot.key, { tenants: on ? pilot.tenants.filter((x) => x !== t.slug) : [...pilot.tenants, t.slug] }, on ? `${t.name} pilotdan chiqarildi` : `${t.name} pilotga qo'shildi`)}
                    className="h-4 w-4"
                  />
                  <span className="flex-1 text-sm">{t.name}</span>
                  <span className="text-xs text-ts-muted">{t.seats.toLocaleString("ru-RU")} foyd.</span>
                </label>
              );
            })}
          </div>
        </Modal>
      )}
      {toast}
    </Page>
  );
}
