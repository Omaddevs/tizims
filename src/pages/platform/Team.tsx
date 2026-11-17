import { useState } from "react";
import { Check, KeyRound, ShieldAlert, UserPlus, Users } from "lucide-react";
import { Avatar, Btn, Card, CardHead, FieldLabel, Modal, Page, Pill, QueryState, ScopeNote, SelectBox, Stat, Table, Td, TextInput, useToast } from "../../components/kit";
import { api, errorText, useApi } from "../../lib/api";
import { STAFF_ROLES, type StaffMember, type StaffRole } from "../../data/platform";

const roleName = (r: StaffRole) => STAFF_ROLES.find((x) => x.key === r)?.name ?? r;

export function TeamPage() {
  const [toast, showToast] = useToast();
  const q = useApi<StaffMember[]>("/platform/staff");
  const staff = q.data ?? [];
  const [inviting, setInviting] = useState(false);
  const noMfa = staff.filter((s) => !s.mfa && s.status === "active");

  async function patch(id: string, p: Partial<Pick<StaffMember, "role" | "status">>, msg: string) {
    try {
      const next = await api<StaffMember>(`/platform/staff/${id}`, { method: "PATCH", body: p });
      q.setData(staff.map((x) => (x.id === id ? next : x)));
      showToast(msg);
    } catch (e) {
      showToast(errorText(e));
    }
  }

  return (
    <Page
      title="Platforma jamoasi"
      subtitle="TIZIMS.AI xodimlari va ularning platformadagi vakolatlari"
      actions={
        <Btn variant="primary" onClick={() => setInviting(true)}>
          <UserPlus className="h-4 w-4" /> Xodim taklif qilish
        </Btn>
      }
    >
      <ScopeNote>Har bir xodimga faqat o'z ishi uchun kerakli bo'limlar ochiladi (eng kam imtiyoz tamoyili). Hech bir platforma roli tashkilot ichki ma'lumotlarini ko'rmaydi.</ScopeNote>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Xodimlar" value={staff.filter((s) => s.status !== "disabled").length} icon={Users} />
        <Stat label="Platforma rollari" value={STAFF_ROLES.length} icon={KeyRound} />
        <Stat label="2FA yoqilmagan" value={noMfa.length} delta={noMfa.length ? "Xavf" : "Hammasi himoyalangan"} tone={noMfa.length ? "red" : "green"} icon={ShieldAlert} />
        <Stat label="Taklif kutilmoqda" value={staff.filter((s) => s.status === "invited").length} icon={UserPlus} />
      </div>

      {q.error && <QueryState error={q.error} loading={false} onRetry={q.reload}>{null}</QueryState>}
      <Card className="overflow-hidden">
        <Table head={["Xodim", "Rol", "2FA", "Oxirgi faollik", "Holat", ""]} minWidth={820}>
          {staff.map((s) => (
            <tr key={s.id}>
              <Td>
                <div className="flex items-center gap-2.5">
                  <Avatar name={s.name} size={30} />
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-ts-sub">{s.email}</div>
                  </div>
                </div>
              </Td>
              <Td>
                {s.role === "owner" ? (
                  <Pill tone="violet">{roleName(s.role)}</Pill>
                ) : (
                  <SelectBox className="h-8 w-auto" value={s.role} onChange={(e) => patch(s.id, { role: e.target.value as StaffRole }, "Rol o'zgartirildi · auditga yozildi")}>
                    {STAFF_ROLES.filter((r) => r.key !== "owner").map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.name}
                      </option>
                    ))}
                  </SelectBox>
                )}
              </Td>
              <Td>{s.mfa ? <Pill tone="green">Yoqilgan</Pill> : <Pill tone="red">Yo'q</Pill>}</Td>
              <Td className="text-ts-sub">{s.lastSeen}</Td>
              <Td>
                <Pill tone={s.status === "active" ? "green" : s.status === "invited" ? "blue" : "gray"} dot>
                  {s.status === "active" ? "Faol" : s.status === "invited" ? "Taklif yuborilgan" : "O'chirilgan"}
                </Pill>
              </Td>
              <Td className="whitespace-nowrap text-right">
                {s.role !== "owner" && (
                  <div className="flex justify-end gap-1.5">
                    {!s.mfa && s.status === "active" && (
                      <Btn size="sm" onClick={() => showToast(`2FA talabi: ${s.email} keyingi kirishda 2FA yoqishi shart (email yuborish hali ulanmagan)`)}>
                        2FA talab qilish
                      </Btn>
                    )}
                    {s.status === "disabled" ? (
                      <Btn size="sm" onClick={() => patch(s.id, { status: "active" }, "Kirish tiklandi")}>
                        Tiklash
                      </Btn>
                    ) : (
                      <Btn size="sm" variant="ghost" onClick={() => patch(s.id, { status: "disabled" }, "Kirish o'chirildi · barcha sessiyalar yopildi")}>
                        O'chirish
                      </Btn>
                    )}
                  </div>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card>
        <CardHead title="Platforma rollari" desc="Qaysi rol qaysi bo'limga kira oladi" />
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {STAFF_ROLES.map((r) => (
            <div key={r.key} className="rounded-md border border-ts-line p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.name}</span>
                <span className="text-xs text-ts-muted">{staff.filter((s) => s.role === r.key && s.status !== "disabled").length} kishi</span>
              </div>
              <div className="text-xs text-ts-sub">{r.desc}</div>
              <div className="mt-2 space-y-1">
                {r.access.map((a) => (
                  <div key={a} className="flex items-center gap-1.5 text-xs">
                    <Check className="h-3 w-3 text-emerald-500" />
                    {a}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Invite
        open={inviting}
        onClose={() => setInviting(false)}
        onSave={async (m) => {
          try {
            const created = await api<StaffMember>("/platform/staff", { body: m });
            q.setData([...staff, created]);
            setInviting(false);
            showToast(`${created.email} jamoaga qo'shildi (taklif kutilmoqda)`);
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

function Invite({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (m: { name: string; email: string; role: StaffRole }) => Promise<boolean> }) {
  const [f, setF] = useState({ name: "", email: "", role: "support" as StaffRole });
  const ok = f.name.trim() && /^\S+@tizims\.ai$/.test(f.email.trim());
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Xodim taklif qilish"
      footer={
        <>
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn
            variant="primary"
            disabled={!ok}
            onClick={async () => {
              if (await onSave({ name: f.name.trim(), email: f.email.trim(), role: f.role })) setF({ name: "", email: "", role: "support" });
            }}
          >
            Taklif yuborish
          </Btn>
        </>
      }
    >
      <FieldLabel label="F.I.Sh.">
        <TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </FieldLabel>
      <FieldLabel label="Korporativ email">
        <TextInput value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="ism@tizims.ai" />
      </FieldLabel>
      {f.email && !/^\S+@tizims\.ai$/.test(f.email.trim()) && <div className="text-xs text-red-500">Faqat @tizims.ai domenidagi email</div>}
      <FieldLabel label="Rol">
        <SelectBox value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as StaffRole })}>
          {STAFF_ROLES.filter((r) => r.key !== "owner").map((r) => (
            <option key={r.key} value={r.key}>
              {r.name} — {r.desc}
            </option>
          ))}
        </SelectBox>
      </FieldLabel>
      <div className="text-xs text-ts-sub">Birinchi kirishda 2FA majburiy yoqiladi.</div>
    </Modal>
  );
}
