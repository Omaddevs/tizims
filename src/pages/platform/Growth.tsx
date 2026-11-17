import { useState } from "react";
import { BarChart3, CheckCircle2, Circle, Rocket, TrendingDown, TrendingUp, UserCheck } from "lucide-react";
import { Btn, Card, CardHead, Page, Pill, Progress, ScopeNote, Stat, Table, Tabs, Td, useToast, type Tone } from "../../components/kit";
import { cn } from "../../lib/utils";
import { CHURN_SIGNALS, MODULE_USAGE, ONBOARDING, ONBOARDING_STEPS, churnScore } from "../../data/platform";
import { notifyOwner, useTenants } from "./Tenants";

const riskTone = (s: number): Tone => (s >= 50 ? "red" : s >= 20 ? "amber" : "green");
const riskLabel = (s: number) => (s >= 50 ? "Yuqori" : s >= 20 ? "O'rta" : "Past");

export function GrowthPage() {
  const [tenants] = useTenants();
  const [toast, showToast] = useToast();
  const [tab, setTab] = useState<"onboarding" | "churn" | "usage">("onboarding");

  const rows = tenants.map((t) => {
    const ob = ONBOARDING[t.slug] ?? { done: 1, lastActive: "Yangi", manager: "—" };
    const sig = CHURN_SIGNALS[t.slug] ?? { activityTrend: 0, tickets: 0, overdueDays: 0 };
    return { t, ob, sig, score: churnScore(sig) };
  });
  const onboarding = rows.filter((r) => r.ob.done < ONBOARDING_STEPS.length);
  const atRisk = rows.filter((r) => r.score >= 20).sort((a, b) => b.score - a.score);
  const maxWau = Math.max(...MODULE_USAGE.map((m) => m.wau));

  return (
    <Page title="O'sish va onboarding" subtitle="Yangi mijozlarni ishga tushirish, mijozni yo'qotish xavfi va modullardan foydalanish">
      <ScopeNote>Bu yerdagi barcha ko'rsatkichlar agregat: faollik soni, to'lov holati va so'rovlar. Tashkilot ichidagi yozuvlar (talaba, baho, xabar) ishlatilmaydi.</ScopeNote>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Onboarding jarayonida" value={onboarding.length} hint="To'liq ishga tushmagan" icon={Rocket} />
        <Stat label="Sinovdan pullikka o'tish" value="64%" delta="+9%" tone="green" hint="So'nggi 90 kun" icon={TrendingUp} />
        <Stat label="Yo'qotish xavfi" value={atRisk.length} delta="tashkilot" tone="red" icon={TrendingDown} />
        <Stat label="Haftalik faol foydalanuvchi" value="11.6K" delta="+5%" tone="green" icon={UserCheck} />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "onboarding", label: "Onboarding", count: onboarding.length },
          { key: "churn", label: "Yo'qotish xavfi", count: atRisk.length },
          { key: "usage", label: "Modullardan foydalanish" },
        ]}
      />

      {tab === "onboarding" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows
            .slice()
            .sort((a, b) => a.ob.done - b.ob.done)
            .map(({ t, ob }) => {
              const pct = Math.round((ob.done / ONBOARDING_STEPS.length) * 100);
              return (
                <Card key={t.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{t.name}</div>
                      <div className="text-xs text-ts-sub">
                        Oxirgi faollik: {ob.lastActive} · Menejer: {ob.manager}
                      </div>
                    </div>
                    <Pill tone={pct === 100 ? "green" : pct >= 50 ? "blue" : "amber"}>{pct}%</Pill>
                  </div>
                  <Progress value={pct} tone={pct === 100 ? "green" : "blue"} className="mt-3" />
                  <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {ONBOARDING_STEPS.map((s, i) => (
                      <div key={s} className={cn("flex items-center gap-1.5 text-xs", i < ob.done ? "text-ts-fg" : "text-ts-muted")}>
                        {i < ob.done ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <Circle className="h-3.5 w-3.5 shrink-0" />}
                        {s}
                      </div>
                    ))}
                  </div>
                  {pct < 100 && (
                    <div className="mt-3 flex gap-2">
                      <Btn size="sm" onClick={() => notifyOwner(t.id, "Keyingi qadam", `Tizimni to'liq ishga tushirish uchun keyingi qadam: "${ONBOARDING_STEPS[ob.done]}". Yordam kerak bo'lsa — Yordam markaziga yozing.`, showToast)}>
                        Qo'llanma yuborish
                      </Btn>
                    </div>
                  )}
                </Card>
              );
            })}
        </div>
      )}

      {tab === "churn" && (
        <Card className="overflow-hidden">
          <CardHead title="Mijozni yo'qotish xavfi" desc="Faollik o'zgarishi, so'rovlar va to'lov kechikishi asosida" className="pb-4" />
          <Table head={["Tashkilot", "Faollik (30 kun)", "Ochiq so'rovlar", "To'lov kechikishi", "Xavf", ""]} minWidth={860}>
            {rows
              .slice()
              .sort((a, b) => b.score - a.score)
              .map(({ t, sig, score }) => (
                <tr key={t.id}>
                  <Td className="font-medium">{t.name}</Td>
                  <Td className={cn("tabular-nums", sig.activityTrend < 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400")}>
                    {sig.activityTrend > 0 ? "+" : ""}
                    {sig.activityTrend}%
                  </Td>
                  <Td className="tabular-nums">{sig.tickets}</Td>
                  <Td className="tabular-nums">{sig.overdueDays ? `${sig.overdueDays} kun` : "—"}</Td>
                  <Td className="w-44">
                    <div className="flex items-center gap-2">
                      <Progress value={score} tone={riskTone(score)} />
                      <Pill tone={riskTone(score)}>{riskLabel(score)}</Pill>
                    </div>
                  </Td>
                  <Td className="text-right">
                    {score >= 20 && (
                      <Btn size="sm" onClick={() => notifyOwner(t.id, "Bog'lanish so'rovi", "TIZIMS menejeri tizimdan foydalanish bo'yicha siz bilan bog'lanmoqchi. Qulay vaqtni Yordam markazi orqali yozing.", showToast)}>
                        Bog'lanish
                      </Btn>
                    )}
                  </Td>
                </tr>
              ))}
          </Table>
        </Card>
      )}

      {tab === "usage" && (
        <Card>
          <CardHead title="Modullardan foydalanish" desc="Platforma bo'yicha haftalik faol foydalanuvchilar (agregat)" action={<BarChart3 className="h-4 w-4 text-ts-sub" />} />
          <div className="space-y-3 p-4">
            {MODULE_USAGE.map((m) => (
              <div key={m.key} className="grid grid-cols-[120px_minmax(0,1fr)_120px] items-center gap-3 text-sm">
                <span className="truncate">{m.name}</span>
                <div className="h-6 overflow-hidden rounded bg-ts-track">
                  <div className="h-full rounded bg-ts-blue3 opacity-80" style={{ width: `${(m.wau / maxWau) * 100}%` }} />
                </div>
                <span className="flex items-center justify-end gap-2 tabular-nums">
                  {m.wau.toLocaleString("ru-RU")}
                  <span className={cn("w-10 text-right text-xs", m.trend >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500")}>
                    {m.trend > 0 ? "+" : ""}
                    {m.trend}%
                  </span>
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-ts-line px-4 py-2.5 text-xs text-ts-sub">AI tahlil eng tez o'sayotgan modul (+46%). Murojaatlar moduli kam ishlatiladi — onboarding'ga qo'shishni ko'rib chiqing.</div>
        </Card>
      )}
      {toast}
    </Page>
  );
}
