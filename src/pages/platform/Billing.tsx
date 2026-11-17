import { useState } from "react";
import { AlertTriangle, Banknote, CalendarClock, Check, Plus, Receipt, Tag, TrendingUp } from "lucide-react";
import { Btn, Card, CardHead, FieldLabel, Modal, Page, Pill, Progress, QueryState, Stat, Table, Td, TextInput, fmtDate, useToast } from "../../components/kit";
import { api, errorText, useApi } from "../../lib/api";
import { cn } from "../../lib/utils";
import { INVOICES, PLANS, planPrice, type Promo } from "../../data/platform";
import { notifyOwner, useTenants } from "./Tenants";

const sum = (n: number) => `${n.toLocaleString("ru-RU")} so'm`;
const MONTHS = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy"];

type BillingData = { plans: typeof PLANS; invoices: typeof INVOICES; mrrHistory: number[]; promos: Promo[] };

export function BillingPage() {
  const [tenants, tq] = useTenants();
  const bq = useApi<BillingData>("/platform/billing");
  const INVOICES_LIST = bq.data?.invoices ?? [];
  const MRR_HISTORY = bq.data?.mrrHistory ?? [1];
  const [toast, showToast] = useToast();
  const paying = tenants.filter((t) => t.status !== "suspended" && t.billing !== "trial");
  const mrr = paying.reduce((a, t) => a + t.seats * planPrice(t.plan), 0);
  const overdue = tenants.filter((t) => t.billing === "overdue");
  const overdueSum = INVOICES_LIST.filter((i) => i.status === "overdue").reduce((a, i) => a + i.amount, 0);
  const trials = tenants.filter((t) => t.billing === "trial");
  const max = Math.max(...MRR_HISTORY);

  return (
    <Page title="Obunalar va to'lovlar" subtitle="Tariflar, oylik daromad va hisob-fakturalar">
      {(tq.error || bq.error) && <QueryState error={tq.error ?? bq.error} loading={false} onRetry={() => { void tq.reload(); void bq.reload(); }}>{null}</QueryState>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Oylik daromad (MRR)" value={`${(mrr / 1_000_000).toFixed(1)} mln`} delta="+1.6%" tone="green" hint="so'm / oy" icon={TrendingUp} />
        <Stat label="Yillik (ARR)" value={`${((mrr * 12) / 1_000_000_000).toFixed(2)} mlrd`} hint="so'm" icon={Banknote} />
        <Stat label="Muddati o'tgan" value={overdue.length} delta={sum(overdueSum)} tone="red" icon={AlertTriangle} />
        <Stat label="Sinov muddatida" value={trials.length} hint="Pullik tarifga o'tishi kutilmoqda" icon={CalendarClock} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHead title="MRR dinamikasi" desc="2026-yil, mln so'm" />
          <div className="flex h-60 items-end gap-2 px-4 pb-4 pt-6">
            {MRR_HISTORY.map((v, i) => (
              <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-[11px] tabular-nums text-ts-sub opacity-0 transition group-hover:opacity-100">{v}</span>
                <div className={cn("w-full rounded-t-md transition", i === MRR_HISTORY.length - 1 ? "bg-ts-blue3" : "bg-ts-blue2 opacity-70 group-hover:opacity-100")} style={{ height: `${((v - 45) / (max - 45)) * 85 + 10}%` }} />
                <span className="text-[10px] text-ts-muted">{MONTHS[i]}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHead title="Tariflar" desc="Narx: foydalanuvchi / oy" />
          <div className="space-y-2 p-4">
            {PLANS.map((p) => (
              <div key={p.key} className="rounded-md border border-ts-line p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-sm tabular-nums">{sum(p.price)}</span>
                </div>
                <div className="text-xs text-ts-sub">
                  {p.seats} · {tenants.filter((t) => t.plan === p.key).length} ta tashkilot
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ts-sub">
                  {p.features.map((f) => (
                    <span key={f} className="flex items-center gap-1">
                      <Check className="h-3 w-3 text-emerald-500" />
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHead title="Obunalar" desc="Tashkilotlar kesimida" className="pb-4" />
        <Table head={["Tashkilot", "Tarif", "Foydalanuvchi", "Oylik to'lov", "To'langan muddat", "Holat", ""]} minWidth={900}>
          {tenants.map((t) => (
            <tr key={t.id}>
              <Td className="font-medium">{t.name}</Td>
              <Td>{PLANS.find((p) => p.key === t.plan)?.name}</Td>
              <Td className="tabular-nums">{t.seats.toLocaleString("ru-RU")}</Td>
              <Td className="tabular-nums">{t.billing === "trial" ? "—" : sum(t.seats * planPrice(t.plan))}</Td>
              <Td className={cn("whitespace-nowrap", t.billing === "overdue" && "text-red-500")}>{fmtDate(t.paidUntil)}</Td>
              <Td>
                {t.billing === "paid" ? (
                  <Pill tone="green" dot>
                    To'langan
                  </Pill>
                ) : t.billing === "trial" ? (
                  <Pill tone="blue" dot>
                    Sinov
                  </Pill>
                ) : (
                  <Pill tone="red" dot>
                    Qarzdor
                  </Pill>
                )}
              </Td>
              <Td className="text-right">
                {t.billing === "overdue" && (
                  <Btn size="sm" onClick={() => notifyOwner(t.id, "To'lov eslatmasi", `Obuna to'lovi muddati o'tgan (${t.paidUntil}). Xizmat to'xtab qolmasligi uchun to'lovni amalga oshiring.`, showToast)}>
                    Eslatma
                  </Btn>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Promos promos={bq.data?.promos ?? []} setPromos={(promos) => bq.data && bq.setData({ ...bq.data, promos })} onToast={showToast} />

      <Card className="overflow-hidden">
        <CardHead title="Hisob-fakturalar" desc="So'nggi 2 oy" className="pb-4" />
        <Table head={["Raqam", "Tashkilot", "Summa", "Sana", "Holat"]} minWidth={640}>
          {INVOICES_LIST.map((i) => (
            <tr key={i.id}>
              <Td className="flex items-center gap-2 font-medium">
                <Receipt className="h-3.5 w-3.5 text-ts-sub" />
                {i.id}
              </Td>
              <Td className="text-ts-sub">{tenants.find((t) => t.slug === i.tenant)?.name ?? i.tenant}</Td>
              <Td className="tabular-nums">{sum(i.amount)}</Td>
              <Td className="text-ts-sub">{fmtDate(i.date)}</Td>
              <Td>
                <Pill tone={i.status === "paid" ? "green" : "red"} dot>
                  {i.status === "paid" ? "To'langan" : "Muddati o'tgan"}
                </Pill>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
      {toast}
    </Page>
  );
}

function Promos({ promos, setPromos, onToast }: { promos: Promo[]; setPromos: (p: Promo[]) => void; onToast: (m: string) => void }) {
  const [creating, setCreating] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <Card className="overflow-hidden">
      <CardHead
        title="Promo-kodlar"
        desc="Chegirmalar yangi mijozlar va maxsus segmentlar uchun"
        className="pb-4"
        action={
          <Btn size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" /> Yangi kod
          </Btn>
        }
      />
      <Table head={["Kod", "Chegirma", "Kimlar uchun", "Ishlatilgan", "Amal qiladi", "Holat", ""]} minWidth={860}>
        {promos.map((p) => {
          const expired = p.expires < today || p.used >= p.limit;
          const live = p.active && !expired;
          return (
            <tr key={p.code}>
              <Td className="font-mono font-medium">
                <span className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-ts-sub" />
                  {p.code}
                </span>
              </Td>
              <Td>
                {p.discount}% · {p.months} oy
              </Td>
              <Td className="text-ts-sub">{p.audience}</Td>
              <Td className="w-40">
                <div className="flex items-center gap-2">
                  <Progress value={(p.used / p.limit) * 100} />
                  <span className="w-12 text-xs tabular-nums text-ts-sub">
                    {p.used}/{p.limit}
                  </span>
                </div>
              </Td>
              <Td className="whitespace-nowrap text-ts-sub">{fmtDate(p.expires)}</Td>
              <Td>
                <Pill tone={live ? "green" : "gray"} dot>
                  {live ? "Faol" : expired ? "Tugagan" : "O'chirilgan"}
                </Pill>
              </Td>
              <Td className="text-right">
                {!expired && (
                  <Btn
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        const next = await api<Promo>(`/platform/promos/${p.code}`, { method: "PATCH", body: { active: !p.active } });
                        setPromos(promos.map((x) => (x.code === p.code ? next : x)));
                        onToast(p.active ? `${p.code} o'chirildi` : `${p.code} yoqildi`);
                      } catch (e) {
                        onToast(errorText(e));
                      }
                    }}
                  >
                    {p.active ? "O'chirish" : "Yoqish"}
                  </Btn>
                )}
              </Td>
            </tr>
          );
        })}
      </Table>
      <NewPromo
        open={creating}
        onClose={() => setCreating(false)}
        onSave={async (p) => {
          try {
            const created = await api<Promo>("/platform/promos", { body: p });
            setPromos([created, ...promos]);
            setCreating(false);
            onToast(`${created.code} yaratildi`);
            return true;
          } catch (e) {
            onToast(errorText(e));
            return false;
          }
        }}
      />
    </Card>
  );
}

function NewPromo({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (p: Omit<Promo, "used" | "active">) => Promise<boolean> }) {
  const empty = { code: "", discount: "20", months: "3", audience: "", limit: "50", expires: "" };
  const [f, setF] = useState(empty);
  const d = Number(f.discount);
  const ok = /^[A-Z0-9]{4,16}$/.test(f.code) && d > 0 && d <= 90 && Number(f.months) > 0 && Number(f.limit) > 0 && f.expires && f.audience.trim();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Yangi promo-kod"
      footer={
        <>
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn
            variant="primary"
            disabled={!ok}
            onClick={async () => {
              if (await onSave({ code: f.code, discount: d, months: Number(f.months), audience: f.audience.trim(), limit: Number(f.limit), expires: f.expires })) setF(empty);
            }}
          >
            Yaratish
          </Btn>
        </>
      }
    >
      <FieldLabel label="Kod (katta harf va raqam, 4–16 belgi)">
        <TextInput value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} placeholder="YANGIYIL27" />
      </FieldLabel>
      <div className="grid grid-cols-3 gap-3">
        <FieldLabel label="Chegirma %">
          <TextInput type="number" min={1} max={90} value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value })} />
        </FieldLabel>
        <FieldLabel label="Necha oy">
          <TextInput type="number" min={1} max={24} value={f.months} onChange={(e) => setF({ ...f, months: e.target.value })} />
        </FieldLabel>
        <FieldLabel label="Limit">
          <TextInput type="number" min={1} value={f.limit} onChange={(e) => setF({ ...f, limit: e.target.value })} />
        </FieldLabel>
      </div>
      <FieldLabel label="Kimlar uchun">
        <TextInput value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} placeholder="Masalan: xususiy maktablar" />
      </FieldLabel>
      <FieldLabel label="Amal qilish muddati">
        <TextInput type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} />
      </FieldLabel>
    </Modal>
  );
}
