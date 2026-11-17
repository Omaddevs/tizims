import { useState } from "react";
import { Building2, CirclePause, CirclePlay, Copy, LifeBuoy, Plus, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Btn, Card, Empty, FieldLabel, Modal, Page, Pill, Progress, QueryState, ScopeNote, SearchBox, SelectBox, Stat, Table, Tabs, Td, TextInput, fmtDate, useToast, type Tone } from "../../components/kit";
import { api, errorText, useApi } from "../../lib/api";
import { cn } from "../../lib/utils";
import { MODULES } from "../../core/catalog";
import type { ModuleKey, OrganizationStatus, OrganizationType } from "../../core/types";
import { PLANS, TYPE_LABEL, type PlanKey, type TenantRecord } from "../../data/platform";

const STATUS: Record<OrganizationStatus, { label: string; tone: Tone }> = {
  active: { label: "Faol", tone: "green" },
  trial: { label: "Sinov", tone: "blue" },
  suspended: { label: "To'xtatilgan", tone: "red" },
};

/** Tashkilot egasiga ilova ichida bildirishnoma */
export function notifyOwner(tenantId: string, title: string, body: string, toast: (m: string) => void) {
  api<{ sent: number }>(`/platform/tenants/${tenantId}/notify`, { body: { title, body } })
    .then(() => toast("Tashkilot egasiga bildirishnoma yuborildi"))
    .catch((e) => toast(errorText(e)));
}

export type TenantView = TenantRecord & { members: { id: string; name: string; role: string }[]; email?: string; phone?: string; address?: string };

/** Barcha tashkilotlar (super admin). Boshqa platforma sahifalari ham shu ro'yxatdan foydalanadi. */
export function useTenants() {
  const q = useApi<TenantView[]>("/platform/tenants");
  return [q.data ?? [], q] as const;
}

export function TenantsPage() {
  const nav = useNavigate();
  const [toast, showToast] = useToast();
  const [tenants, tq] = useTenants();
  const [tab, setTab] = useState<"all" | OrganizationStatus>("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const open = tenants.find((t) => t.id === openId) ?? null;
  const [creating, setCreating] = useState(false);

  const list = tenants.filter((t) => (tab === "all" || t.status === tab) && (t.name + t.slug + t.owner).toLowerCase().includes(q.toLowerCase()));
  const count = (s: OrganizationStatus) => tenants.filter((t) => t.status === s).length;

  async function patch(id: string, p: Partial<Pick<TenantRecord, "status" | "plan" | "modules">>, msg?: string) {
    try {
      const next = await api<TenantView>(`/platform/tenants/${id}`, { method: "PATCH", body: p });
      tq.setData(tenants.map((t) => (t.id === id ? next : t)));
      if (msg) showToast(msg);
    } catch (e) {
      showToast(errorText(e));
    }
  }

  return (
    <Page
      title="Tashkilotlar"
      subtitle="Platformaga ulangan ta'lim muassasalari va boshqa mijozlar"
      actions={
        <Btn variant="primary" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Tashkilot qo'shish
        </Btn>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Jami tashkilotlar" value={tenants.length} icon={Building2} />
        <Stat label="Faol" value={count("active")} delta={`${count("trial")} sinovda`} tone="blue" icon={CirclePlay} />
        <Stat label="To'xtatilgan" value={count("suspended")} tone="red" icon={CirclePause} />
        <Stat label="Foydalanuvchilar" value={tenants.reduce((a, t) => a + t.seats, 0).toLocaleString("ru-RU")} hint="Barcha tashkilotlarda" icon={Users} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "all", label: "Barchasi", count: tenants.length },
            { key: "active", label: "Faol", count: count("active") },
            { key: "trial", label: "Sinov", count: count("trial") },
            { key: "suspended", label: "To'xtatilgan", count: count("suspended") },
          ]}
        />
        <SearchBox value={q} onChange={setQ} placeholder="Nomi, domen yoki ega..." className="w-64" />
      </div>

      <QueryState error={tq.error} loading={tq.loading && !tq.data} onRetry={tq.reload}>
      <Card className="overflow-hidden">
        {list.length === 0 ? (
          <Empty text="Tashkilot topilmadi" />
        ) : (
          <Table head={["Tashkilot", "Turi", "Tarif", "Foydalanuvchi", "Modullar", "Xotira", "Holat"]} minWidth={980}>
            {list.map((t) => (
              <tr key={t.id} onClick={() => setOpenId(t.id)} className="cursor-pointer transition hover:bg-ts-hover">
                <Td>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-ts-sub">{t.slug}.tizims.uz</div>
                </Td>
                <Td className="text-ts-sub">{TYPE_LABEL[t.type]}</Td>
                <Td>
                  <Pill tone={t.plan === "enterprise" ? "violet" : t.plan === "business" ? "blue" : "gray"}>{PLANS.find((p) => p.key === t.plan)?.name}</Pill>
                </Td>
                <Td className="tabular-nums">{t.seats.toLocaleString("ru-RU")}</Td>
                <Td className="text-ts-sub">{t.modules.length} ta</Td>
                <Td className="w-40">
                  <div className="flex items-center gap-2">
                    <Progress value={(t.storageGb / t.storageLimitGb) * 100} tone={t.storageGb / t.storageLimitGb > 0.8 ? "red" : "blue"} />
                    <span className="w-16 text-xs tabular-nums text-ts-sub">
                      {t.storageGb}/{t.storageLimitGb} GB
                    </span>
                  </div>
                </Td>
                <Td>
                  <Pill tone={STATUS[t.status].tone} dot>
                    {STATUS[t.status].label}
                  </Pill>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      </QueryState>

      {open && (
        <Modal
          open
          onClose={() => setOpenId(null)}
          title={open.name}
          footer={
            <>
              <Btn onClick={() => nav("/platform/support", { state: { tenant: open.slug } })}>
                <LifeBuoy className="h-4 w-4" /> Yordam rejimi
              </Btn>
              {open.status === "suspended" ? (
                <Btn variant="primary" onClick={() => patch(open.id, { status: "active" }, "Tashkilot qayta faollashtirildi")}>
                  <CirclePlay className="h-4 w-4" /> Faollashtirish
                </Btn>
              ) : (
                <Btn variant="danger" onClick={() => patch(open.id, { status: "suspended" }, "Tashkilot to'xtatildi · foydalanuvchilar kira olmaydi")}>
                  <CirclePause className="h-4 w-4" /> To'xtatish
                </Btn>
              )}
            </>
          }
        >
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ["Ega", `${open.owner}`],
              ["Email", open.ownerEmail],
              ["Yaratilgan", fmtDate(open.createdAt)],
              ["To'langan muddat", fmtDate(open.paidUntil)],
              ["API so'rovlar (oy)", open.apiCalls.toLocaleString("ru-RU")],
              ["Xotira", `${open.storageGb} / ${open.storageLimitGb} GB`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md bg-ts-tile p-2.5">
                <div className="text-xs text-ts-sub">{k}</div>
                <div className="mt-0.5 truncate font-medium">{v}</div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(`${open.slug}.tizims.uz`).catch(() => undefined);
              showToast("Domen nusxalandi");
            }}
            className="flex items-center gap-1.5 text-xs text-ts-sub hover:text-ts-fg"
          >
            <Copy className="h-3 w-3" /> {open.slug}.tizims.uz
          </button>
          <FieldLabel label="Tarif">
            <SelectBox value={open.plan} onChange={(e) => patch(open.id, { plan: e.target.value as PlanKey }, "Tarif o'zgartirildi · keyingi hisob-fakturada qo'llanadi")}>
              {PLANS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name} — {p.price.toLocaleString("ru-RU")} so'm / foydalanuvchi
                </option>
              ))}
            </SelectBox>
          </FieldLabel>
          <div>
            <div className="mb-1.5 text-xs font-medium text-ts-sub">Modullar</div>
            <div className="grid grid-cols-2 gap-1.5">
              {MODULES.map((m) => {
                const on = open.modules.includes(m.key);
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => patch(open.id, { modules: on ? open.modules.filter((k) => k !== m.key) : [...open.modules, m.key] }, `${m.name} ${on ? "o'chirildi" : "yoqildi"}`)}
                    className={cn("flex items-center justify-between rounded-md border px-2.5 py-2 text-left text-sm transition", on ? "border-ts-sub bg-ts-hover" : "border-ts-line hover:bg-ts-hover")}
                  >
                    <span>{m.name}</span>
                    <span className={cn("h-4 w-7 rounded-full p-0.5 transition", on ? "bg-emerald-500" : "bg-ts-line2")}>
                      <span className={cn("block h-3 w-3 rounded-full bg-white transition", on && "translate-x-3")} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <ScopeNote>Super admin tashkilot ichidagi ma'lumotlarni (baholar, xabarlar, murojaatlar) ko'rmaydi. Texnik yordam uchun ega tasdig'i bilan "Yordam rejimi" so'raladi.</ScopeNote>
        </Modal>
      )}

      <CreateTenant
        open={creating}
        onClose={() => setCreating(false)}
        onSave={async (t) => {
          try {
            const created = await api<TenantView>("/platform/tenants", { body: t });
            tq.setData([created, ...tenants]);
            setCreating(false);
            showToast(`${created.name} yaratildi`);
            return true;
          } catch (e) {
            showToast(errorText(e));
            return false;
          }
        }}
      />
      {toast}
    </Page>
  );
}

type NewTenant = { name: string; slug: string; type: OrganizationType; plan: PlanKey; owner: string; ownerEmail: string; trial: boolean };

function CreateTenant({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (t: NewTenant) => Promise<boolean> }) {
  const empty: NewTenant = { name: "", slug: "", type: "university", plan: "business", owner: "", ownerEmail: "", trial: true };
  const [f, setF] = useState(empty);
  const ok = f.name.trim().length >= 3 && /^[a-z0-9-]{3,32}$/.test(f.slug) && f.owner.trim().length >= 3 && /\S+@\S+\.\S+/.test(f.ownerEmail);
  const defaults: ModuleKey[] = f.type === "university" || f.type === "school" ? ["education", "analytics"] : f.type === "shop" ? ["shop", "crm", "warehouse"] : ["crm"];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Yangi tashkilot"
      footer={
        <>
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn
            variant="primary"
            disabled={!ok}
            onClick={async () => {
              if (await onSave({ ...f, name: f.name.trim(), owner: f.owner.trim(), ownerEmail: f.ownerEmail.trim() })) setF(empty);
            }}
          >
            Yaratish
          </Btn>
        </>
      }
    >
      <FieldLabel label="Tashkilot nomi">
        <TextInput
          value={f.name}
          onChange={(e) => {
            const name = e.target.value;
            setF({ ...f, name, slug: f.slug && f.slug !== autoSlug(f.name) ? f.slug : autoSlug(name) });
          }}
          placeholder="Masalan: Toshkent Davlat Iqtisodiyot Universiteti"
        />
      </FieldLabel>
      <FieldLabel label="Domen">
        <div className="flex items-center gap-1.5">
          <TextInput value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })} placeholder="tsue" />
          <span className="shrink-0 text-sm text-ts-sub">.tizims.uz</span>
        </div>
      </FieldLabel>
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Turi">
          <SelectBox value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as OrganizationType })}>
            {(["university", "school", "shop", "pharmacy", "company"] as const).map((k) => (
              <option key={k} value={k}>
                {TYPE_LABEL[k]}
              </option>
            ))}
          </SelectBox>
        </FieldLabel>
        <FieldLabel label="Tarif">
          <SelectBox value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value as PlanKey })}>
            {PLANS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </SelectBox>
        </FieldLabel>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Ega (F.I.Sh.)">
          <TextInput value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} />
        </FieldLabel>
        <FieldLabel label="Ega email">
          <TextInput value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} placeholder="rektor@..." />
        </FieldLabel>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={f.trial} onChange={(e) => setF({ ...f, trial: e.target.checked })} className="h-4 w-4" />
        30 kunlik bepul sinov bilan boshlash
      </label>
      <div className="text-xs text-ts-sub">Standart modullar: {defaults.join(", ")}</div>
    </Modal>
  );
}

function autoSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
}

