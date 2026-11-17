import { useState } from "react";
import { Building2, Check, Download, KeyRound, Layers, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { useApp } from "../store/AppContext";
import { Btn, Card, CardHead, Empty, FieldLabel, Modal, Page, Pill, QueryState, ScopeNote, Stat, Table, Td, TextInput, fmtDate, useToast, type Tone } from "../components/kit";
import { api, errorText, useApi } from "../lib/api";
import { roleLabel } from "../lib/utils";
import type { DataRequest, SupportAccess } from "../data/platform";

export { PlatformAdminPage } from "./Platform";

type Settings = {
  organization: { name: string; slug: string; type: string; plan: string; status: string; currency: string; seats: number; email: string | null; phone: string | null; address: string | null; primary_color: string };
  modules: { key: string; name: string; enabled: boolean }[];
  members: { role: string; c: number }[];
};

const ACCESS_STATUS: Record<SupportAccess["status"], { label: string; tone: Tone }> = {
  pending: { label: "Tasdiq kutilmoqda", tone: "amber" },
  active: { label: "Faol", tone: "green" },
  expired: { label: "Tugagan", tone: "gray" },
  denied: { label: "Rad etilgan", tone: "red" },
};

const DATA_STATUS: Record<DataRequest["status"], { label: string; tone: Tone }> = {
  awaiting_owner: { label: "Tasdiqingiz kutilmoqda", tone: "amber" },
  processing: { label: "Tayyorlanmoqda", tone: "blue" },
  ready: { label: "Tayyor", tone: "green" },
  done: { label: "Bajarildi", tone: "gray" },
  rejected: { label: "Rad etilgan", tone: "red" },
};

export function OrgSettingsPage() {
  const { user, can, refreshSession } = useApp();
  const [dataModal, setDataModal] = useState<null | "export" | "delete">(null);
  const [toast, showToast] = useToast();
  const sq = useApi<Settings>("/org/settings");
  const aq = useApi<SupportAccess[]>("/org/support-access");
  const isOwner = user?.role === "owner";
  const dq = useApi<DataRequest[]>(isOwner ? "/org/data-requests" : null);
  const [busy, setBusy] = useState<string | null>(null);

  async function decideAccess(id: string, decision: "approve" | "deny" | "revoke") {
    setBusy(id);
    try {
      const next = await api<SupportAccess>(`/org/support-access/${id}/decision`, { body: { decision } });
      aq.setData((aq.data ?? []).map((x) => (x.id === id ? next : x)));
      showToast(decision === "approve" ? `Ruxsat berildi · ${next.expiresAt} gacha` : decision === "deny" ? "So'rov rad etildi" : "Kirish bekor qilindi");
    } catch (e) {
      showToast(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function decideData(id: string, decision: "approve" | "deny") {
    if (decision === "approve" && !window.confirm("Tasdiqlaysizmi? O'chirish so'rovi bo'lsa, ma'lumotlar 30 kundan so'ng qaytarib bo'lmaydigan tarzda o'chiriladi.")) return;
    setBusy(id);
    try {
      const next = await api<DataRequest>(`/org/data-requests/${id}/decision`, { body: { decision } });
      dq.setData((dq.data ?? []).map((x) => (x.id === id ? next : x)));
      showToast(decision === "approve" ? "Tasdiqlandi" : "Rad etildi");
    } catch (e) {
      showToast(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const st = sq.data;
  const pending = (aq.data ?? []).filter((x) => x.status === "pending").length + (dq.data ?? []).filter((x) => x.status === "awaiting_owner").length;

  return (
    <Page title="Tashkilot sozlamalari" subtitle={st?.organization.name}>
      <QueryState error={sq.error} loading={sq.loading && !st} onRetry={sq.reload}>
        {st && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Tarif" value={st.organization.plan[0].toUpperCase() + st.organization.plan.slice(1)} hint={`${st.organization.slug}.tizims.uz`} icon={Building2} />
            <Stat label="Foydalanuvchilar" value={st.organization.seats.toLocaleString("ru-RU")} icon={Users} />
            <Stat label="Yoqilgan modullar" value={`${st.modules.filter((m) => m.enabled).length}/${st.modules.length}`} icon={Layers} />
            <Stat label="Tasdiq kutayotgan" value={pending} tone={pending ? "amber" : "green"} delta={pending ? "So'rov" : "Yo'q"} icon={ShieldCheck} />
          </div>
        )}
      </QueryState>

      {st && can("core.org.manage") && (
        <ProfileCard
          org={st.organization}
          onSaved={(o) => {
            sq.setData({ ...st, organization: { ...st.organization, ...o } });
            void refreshSession();
            showToast("Tashkilot ma'lumotlari saqlandi");
          }}
          onError={showToast}
        />
      )}

      <Card className="overflow-hidden">
        <CardHead title="Yordam rejimi so'rovlari" desc="TIZIMS yordam xizmati tashkilotingizga faqat sizning ruxsatingiz bilan, faqat o'qish uchun va vaqt bilan cheklangan holda kira oladi" className="pb-4" />
        <QueryState error={aq.error} loading={aq.loading && !aq.data} onRetry={aq.reload}>
          {(aq.data ?? []).length === 0 ? (
            <Empty text="So'rov yo'q" icon={KeyRound} />
          ) : (
            <Table head={["ID", "Sabab", "So'ralgan", "Muddat", "Holat", ""]} minWidth={760}>
              {(aq.data ?? []).map((x) => (
                <tr key={x.id}>
                  <Td className="text-ts-sub">{x.id}</Td>
                  <Td>
                    {x.reason}
                    {x.ticket && <span className="ml-1 text-xs text-ts-muted">({x.ticket})</span>}
                  </Td>
                  <Td className="whitespace-nowrap text-ts-sub">{x.requestedAt}</Td>
                  <Td className="whitespace-nowrap text-ts-sub">{x.expiresAt ?? `${(x as SupportAccess & { hours?: number }).hours ?? 2} soat`}</Td>
                  <Td>
                    <Pill tone={ACCESS_STATUS[x.status].tone} dot>
                      {ACCESS_STATUS[x.status].label}
                    </Pill>
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    {x.status === "pending" && (
                      <div className="flex justify-end gap-1.5">
                        <Btn size="sm" variant="primary" disabled={busy === x.id} onClick={() => decideAccess(x.id, "approve")}>
                          <Check className="h-3.5 w-3.5" /> Ruxsat berish
                        </Btn>
                        <Btn size="sm" disabled={busy === x.id} onClick={() => decideAccess(x.id, "deny")}>
                          <X className="h-3.5 w-3.5" /> Rad etish
                        </Btn>
                      </div>
                    )}
                    {x.status === "active" && (
                      <Btn size="sm" variant="danger" disabled={busy === x.id} onClick={() => decideAccess(x.id, "revoke")}>
                        Bekor qilish
                      </Btn>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </QueryState>
      </Card>

      {isOwner && (
        <Card className="overflow-hidden">
          <CardHead
            title="Ma'lumotlarni eksport qilish va o'chirish"
            desc="Faqat tashkilot egasi so'raydi yoki tasdiqlaydi"
            className="pb-4"
            action={
              <div className="flex gap-1.5">
                <Btn size="sm" onClick={() => setDataModal("export")}>
                  <Download className="h-3.5 w-3.5" /> Eksport so'rash
                </Btn>
                <Btn size="sm" variant="ghost" onClick={() => setDataModal("delete")}>
                  <Trash2 className="h-3.5 w-3.5" /> O'chirish
                </Btn>
              </div>
            }
          />
          <QueryState error={dq.error} loading={dq.loading && !dq.data} onRetry={dq.reload}>
            {(dq.data ?? []).length === 0 ? (
              <Empty text="So'rov yo'q" />
            ) : (
              <Table head={["ID", "Turi", "Sabab", "Sana", "Holat", ""]} minWidth={760}>
                {(dq.data ?? []).map((d) => (
                  <tr key={d.id}>
                    <Td className="text-ts-sub">{d.id}</Td>
                    <Td>
                      {d.kind === "export" ? (
                        <Pill tone="blue">
                          <Download className="h-3 w-3" /> Eksport
                        </Pill>
                      ) : (
                        <Pill tone="red">
                          <Trash2 className="h-3 w-3" /> O'chirish
                        </Pill>
                      )}
                    </Td>
                    <Td className="text-ts-sub">{d.reason}</Td>
                    <Td className="whitespace-nowrap text-ts-sub">{fmtDate(d.requestedAt)}</Td>
                    <Td>
                      <Pill tone={DATA_STATUS[d.status].tone} dot>
                        {DATA_STATUS[d.status].label}
                      </Pill>
                    </Td>
                    <Td className="whitespace-nowrap text-right">
                      {d.status === "awaiting_owner" && (
                        <div className="flex justify-end gap-1.5">
                          <Btn size="sm" variant={d.kind === "delete" ? "danger" : "primary"} disabled={busy === d.id} onClick={() => decideData(d.id, "approve")}>
                            Tasdiqlash
                          </Btn>
                          <Btn size="sm" disabled={busy === d.id} onClick={() => decideData(d.id, "deny")}>
                            Rad etish
                          </Btn>
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </QueryState>
        </Card>
      )}

      {st && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHead title="Modullar" desc="Modullarni TIZIMS platformasi tarifingiz bo'yicha yoqadi" />
            <div className="flex flex-wrap gap-2 p-4">
              {st.modules.map((m) => (
                <Pill key={m.key} tone={m.enabled ? "green" : "gray"} dot>
                  {m.name}
                </Pill>
              ))}
            </div>
          </Card>
          <Card>
            <CardHead title="Tizim akkauntlari" desc="Rollar bo'yicha" />
            <div className="space-y-2 p-4">
              {st.members.map((m) => (
                <div key={m.role} className="flex justify-between text-sm">
                  <span>{roleLabel(m.role)}</span>
                  <span className="tabular-nums text-ts-sub">{m.c}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
      {dataModal && st && (
        <DataRequestModal
          kind={dataModal}
          slug={st.organization.slug}
          onClose={() => setDataModal(null)}
          onSave={async (body) => {
            try {
              const d = await api<DataRequest>("/org/data-requests", { body });
              dq.setData([d, ...(dq.data ?? [])]);
              setDataModal(null);
              showToast(body.kind === "export" ? "Eksport so'rovi TIZIMS jamoasiga yuborildi" : "O'chirish so'rovi qabul qilindi — 30 kunlik kutish muddati boshlandi");
            } catch (e) {
              showToast(errorText(e));
            }
          }}
        />
      )}
      {!isOwner && <ScopeNote>Ma'lumotlarni eksport qilish va o'chirish so'rovlarini faqat tashkilot egasi ko'radi.</ScopeNote>}
      {toast}
    </Page>
  );
}

function ProfileCard({ org, onSaved, onError }: { org: Settings["organization"]; onSaved: (o: Partial<Settings["organization"]>) => void; onError: (m: string) => void }) {
  const init = { name: org.name, email: org.email ?? "", phone: org.phone ?? "", address: org.address ?? "", primaryColor: org.primary_color };
  const [f, setF] = useState(init);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(init);
  return (
    <Card>
      <CardHead title="Tashkilot profili" desc={`Domen: ${org.slug}.tizims.uz (o'zgarmaydi)`} />
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <FieldLabel label="Nomi">
          <TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </FieldLabel>
        <FieldLabel label="Email">
          <TextInput value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="info@..." />
        </FieldLabel>
        <FieldLabel label="Telefon">
          <TextInput value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+998 ..." />
        </FieldLabel>
        <FieldLabel label="Asosiy rang">
          <div className="flex items-center gap-2">
            <input type="color" value={f.primaryColor} onChange={(e) => setF({ ...f, primaryColor: e.target.value })} className="h-9 w-12 cursor-pointer rounded-md border border-ts-line2 bg-ts-input" />
            <TextInput value={f.primaryColor} onChange={(e) => setF({ ...f, primaryColor: e.target.value })} />
          </div>
        </FieldLabel>
        <div className="sm:col-span-2">
          <FieldLabel label="Manzil">
            <TextInput value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </FieldLabel>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-ts-line px-4 py-3">
        <Btn disabled={!dirty || saving} onClick={() => setF(init)}>
          Bekor qilish
        </Btn>
        <Btn
          variant="primary"
          disabled={!dirty || saving || f.name.trim().length < 3}
          onClick={async () => {
            setSaving(true);
            try {
              await api("/org/settings", { method: "PATCH", body: { ...f, name: f.name.trim() } });
              onSaved({ name: f.name.trim(), email: f.email || null, phone: f.phone || null, address: f.address || null, primary_color: f.primaryColor });
            } catch (e) {
              onError(errorText(e));
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saqlanmoqda..." : "Saqlash"}
        </Btn>
      </div>
    </Card>
  );
}

function DataRequestModal({ kind, slug, onClose, onSave }: { kind: "export" | "delete"; slug: string; onClose: () => void; onSave: (b: { kind: "export" | "delete"; reason: string; confirm?: string }) => void }) {
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const ok = reason.trim().length >= 5 && (kind === "export" || confirm === slug);
  return (
    <Modal
      open
      onClose={onClose}
      title={kind === "export" ? "Ma'lumotlar eksporti" : "Tashkilot ma'lumotlarini o'chirish"}
      footer={
        <>
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn variant={kind === "delete" ? "danger" : "primary"} disabled={!ok} onClick={() => onSave({ kind, reason: reason.trim(), confirm: kind === "delete" ? confirm : undefined })}>
            So'rov yuborish
          </Btn>
        </>
      }
    >
      {kind === "export" ? (
        <p className="text-sm text-ts-sub">Barcha tashkilot ma'lumotlari (talabalar, baholar, davomat, vazifalar, audit) shifrlangan arxiv sifatida tayyorlanadi va havolasi sizga yuboriladi. TIZIMS jamoasi arxiv ichini ko'rmaydi.</p>
      ) : (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
          Bu amal qaytarib bo'lmaydi. 30 kunlik kutish muddatidan so'ng barcha foydalanuvchilar, talabalar, baholar va hujjatlar butunlay o'chiriladi. Avval eksport qilib oling.
        </div>
      )}
      <FieldLabel label="Sabab">
        <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder={kind === "export" ? "Masalan: yillik arxiv" : "Masalan: shartnoma tugadi"} />
      </FieldLabel>
      {kind === "delete" && (
        <FieldLabel label={`Tasdiqlash uchun "${slug}" deb yozing`}>
          <TextInput value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </FieldLabel>
      )}
    </Modal>
  );
}
