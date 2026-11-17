/** Tashkilot rahbariyati sahifalari: foydalanuvchilar, obuna, TIZIMS yordami. Barchasi serverda saqlanadi va auditga yoziladi. */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Copy, CreditCard, KeyRound, LifeBuoy, Plus, Receipt, Send, ShieldAlert, UserCheck, UserPlus, Users, UserX } from "lucide-react";
import { useApp } from "../store/AppContext";
import { Avatar, Btn, Card, CardHead, Empty, FieldLabel, Modal, Page, Pill, QueryState, ScopeNote, SearchBox, SelectBox, Stat, Table, Tabs, Td, TextArea, TextInput, fmtDate, useToast, type Tone } from "../components/kit";
import { api, errorText, useApi } from "../lib/api";
import { cn, roleLabel } from "../lib/utils";
import { PLANS, type PlanKey, type Ticket } from "../data/platform";
import type { Role } from "../types";

/* ═════════════════ Foydalanuvchilar ═════════════════ */

export type Member = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "suspended" | "invited";
  isOwner: boolean;
  joinedAt: string;
  lastLoginAt: string | null;
  pendingPassword: boolean;
  sharedAccount: boolean;
  studentId: string | null;
};
export type MembersData = { members: Member[]; students: { id: string; name: string; group: string }[] };

const ASSIGNABLE: Role[] = ["owner", "rector", "dept_head", "advisor", "teacher", "student", "parent"];
const needsStudent = (r: Role) => r === "student" || r === "parent";

export function MembersPage() {
  const { user } = useApp();
  const nav = useNavigate();
  const [toast, showToast] = useToast();
  const q = useApi<MembersData>("/org/members/manage");
  const [tab, setTab] = useState<"active" | "suspended">("active");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [inviting, setInviting] = useState(false);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const [editing, setEditing] = useState<Member | null>(null);

  const members = q.data?.members ?? [];
  const students = q.data?.students ?? [];
  const isOwner = user?.role === "owner";
  const list = members.filter(
    (m) => (tab === "active" ? m.status === "active" : m.status !== "active") && (roleFilter === "all" || m.role === roleFilter) && `${m.name} ${m.email}`.toLowerCase().includes(query.toLowerCase()),
  );
  const replace = (m: Member) => q.data && q.setData({ ...q.data, members: members.map((x) => (x.id === m.id ? m : x)) });

  async function patch(id: string, body: Partial<Pick<Member, "role" | "status" | "studentId">>, msg: string) {
    try {
      replace(await api<Member>(`/org/members/${id}`, { method: "PATCH", body }));
      showToast(msg);
      return true;
    } catch (e) {
      showToast(errorText(e));
      return false;
    }
  }

  async function resetPassword(m: Member) {
    if (!window.confirm(`${m.name} uchun yangi vaqtinchalik parol yaratilsinmi? Eski parol ishlamay qoladi.`)) return;
    try {
      const r = await api<{ tempPassword: string }>(`/org/members/${m.id}/reset-password`, { method: "POST" });
      setSecret({ email: m.email, password: r.tempPassword });
    } catch (e) {
      showToast(errorText(e));
    }
  }

  return (
    <Page
      title="Foydalanuvchilar"
      subtitle="Tashkilot akkauntlari, rollar va kirish huquqlari"
      actions={
        <Btn variant="primary" onClick={() => setInviting(true)}>
          <UserPlus className="h-4 w-4" /> Foydalanuvchi qo'shish
        </Btn>
      }
    >
      <QueryState error={q.error} loading={q.loading && !q.data} onRetry={q.reload}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Faol akkauntlar" value={members.filter((m) => m.status === "active").length} icon={Users} />
          <Stat label="Xodimlar" value={members.filter((m) => m.status === "active" && !needsStudent(m.role)).length} hint="Ega, rahbariyat, o'qituvchilar" icon={UserCheck} />
          <Stat label="Parolni almashtirmagan" value={members.filter((m) => m.pendingPassword && m.status === "active").length} hint="Hali birinchi marta kirmagan" icon={KeyRound} />
          <Stat label="To'xtatilgan" value={members.filter((m) => m.status !== "active").length} icon={UserX} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "active", label: "Faol", count: members.filter((m) => m.status === "active").length },
              { key: "suspended", label: "To'xtatilgan", count: members.filter((m) => m.status !== "active").length },
            ]}
          />
          <div className="flex flex-wrap gap-2">
            <SelectBox className="h-8 w-auto" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as "all" | Role)}>
              <option value="all">Barcha rollar</option>
              {ASSIGNABLE.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </SelectBox>
            <SearchBox value={query} onChange={setQuery} placeholder="Ism yoki email..." className="w-60" />
          </div>
        </div>

        <Card className="overflow-hidden">
          {list.length === 0 ? (
            <Empty text="Foydalanuvchi topilmadi" icon={Users} />
          ) : (
            <Table head={["Foydalanuvchi", "Rol", "Bog'langan talaba", "Oxirgi kirish", "Holat", ""]} minWidth={940}>
              {list.map((m) => {
                const self = m.id === user?.id;
                const st = students.find((x) => x.id === m.studentId);
                return (
                  <tr key={m.id}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={m.name} size={30} />
                        <div className="min-w-0">
                          <button type="button" onClick={() => nav(`/members/${m.id}`)} className="flex items-center gap-1.5 text-left font-medium hover:underline">
                            {m.name}
                            {self && <Pill>Siz</Pill>}
                          </button>
                          <div className="truncate text-xs text-ts-sub">{m.email}</div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Pill tone={m.role === "owner" ? "violet" : m.role === "rector" || m.role === "dept_head" ? "blue" : "gray"}>{roleLabel(m.role)}</Pill>
                    </Td>
                    <Td className="text-ts-sub">{needsStudent(m.role) ? (st ? `${st.name} · ${st.group}` : <span className="text-amber-600">Bog'lanmagan</span>) : "—"}</Td>
                    <Td className="whitespace-nowrap text-ts-sub">{m.lastLoginAt ?? "Hali kirmagan"}</Td>
                    <Td>
                      {m.status !== "active" ? (
                        <Pill tone="red" dot>
                          To'xtatilgan
                        </Pill>
                      ) : m.pendingPassword ? (
                        <Pill tone="amber" dot>
                          Parol almashtirilmagan
                        </Pill>
                      ) : (
                        <Pill tone="green" dot>
                          Faol
                        </Pill>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-right">
                      {!self && (
                        <div className="flex justify-end gap-1.5">
                          {(m.role !== "owner" || isOwner) && (
                            <Btn size="sm" onClick={() => setEditing(m)}>
                              Tahrirlash
                            </Btn>
                          )}
                          {!m.sharedAccount && m.status === "active" && (
                            <Btn size="sm" variant="ghost" title="Yangi vaqtinchalik parol" onClick={() => resetPassword(m)}>
                              <KeyRound className="h-3.5 w-3.5" />
                            </Btn>
                          )}
                        </div>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>
        <ScopeNote>
          Yangi foydalanuvchiga vaqtinchalik parol beriladi — u birinchi kirishda o'z parolini o'rnatmaguncha hech qanday ma'lumot ko'rmaydi. To'xtatilgan foydalanuvchining sessiyasi darhol yopiladi. Bir nechta tashkilotga a'zo
          akkaunt parolini faqat foydalanuvchining o'zi o'zgartiradi.
        </ScopeNote>
      </QueryState>

      <InviteModal
        open={inviting}
        isOwner={isOwner}
        students={students}
        onClose={() => setInviting(false)}
        onSave={async (f) => {
          try {
            const r = await api<{ member: Member; tempPassword: string | null }>("/org/members", { body: f });
            if (q.data) q.setData({ ...q.data, members: [r.member, ...members] });
            setInviting(false);
            if (r.tempPassword) setSecret({ email: r.member.email, password: r.tempPassword });
            else showToast(`${r.member.name} (mavjud akkaunt) tashkilotga qo'shildi`);
            return true;
          } catch (e) {
            showToast(errorText(e));
            return false;
          }
        }}
      />

      {editing && (
        <EditMemberModal
          member={editing}
          isOwner={isOwner}
          students={students}
          onClose={() => setEditing(null)}
          onSave={async (body, msg) => {
            if (await patch(editing.id, body, msg)) setEditing(null);
          }}
        />
      )}

      {secret && <SecretModal email={secret.email} password={secret.password} onClose={() => setSecret(null)} />}
      {toast}
    </Page>
  );
}

function StudentPicker({ value, onChange, students }: { value: string; onChange: (v: string) => void; students: MembersData["students"] }) {
  return (
    <FieldLabel label="Bog'langan talaba">
      <SelectBox value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— tanlang —</option>
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} · {s.group} · {s.id}
          </option>
        ))}
      </SelectBox>
    </FieldLabel>
  );
}

function InviteModal({
  open,
  isOwner,
  students,
  onClose,
  onSave,
}: {
  open: boolean;
  isOwner: boolean;
  students: MembersData["students"];
  onClose: () => void;
  onSave: (f: { name: string; email: string; role: Role; studentId?: string }) => Promise<boolean>;
}) {
  const empty = { name: "", email: "", role: "teacher" as Role, studentId: "" };
  const [f, setF] = useState(empty);
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()) && f.name.trim().length >= 3 && (!needsStudent(f.role) || f.studentId);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Foydalanuvchi qo'shish"
      footer={
        <>
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn
            variant="primary"
            disabled={!ok}
            onClick={async () => {
              if (await onSave({ name: f.name.trim(), email: f.email.trim(), role: f.role, studentId: needsStudent(f.role) ? f.studentId : undefined })) setF(empty);
            }}
          >
            Qo'shish
          </Btn>
        </>
      }
    >
      <FieldLabel label="F.I.Sh.">
        <TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Familiya Ism" />
      </FieldLabel>
      <FieldLabel label="Email (login)">
        <TextInput value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="ism@universitet.uz" />
      </FieldLabel>
      <FieldLabel label="Rol">
        <SelectBox value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
          {ASSIGNABLE.filter((r) => r !== "owner" || isOwner).map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </SelectBox>
      </FieldLabel>
      {needsStudent(f.role) && <StudentPicker value={f.studentId} onChange={(v) => setF({ ...f, studentId: v })} students={students} />}
      <div className="text-xs text-ts-sub">Agar bu email bilan akkaunt mavjud bo'lsa, u tashkilotga qo'shiladi (parol o'zgarmaydi). Aks holda vaqtinchalik parol yaratiladi.</div>
    </Modal>
  );
}

export function EditMemberModal({
  member,
  isOwner,
  students,
  onClose,
  onSave,
}: {
  member: Member;
  isOwner: boolean;
  students: MembersData["students"];
  onClose: () => void;
  onSave: (body: Partial<Pick<Member, "role" | "status" | "studentId">>, msg: string) => void;
}) {
  const [role, setRole] = useState<Role>(member.role);
  const [studentId, setStudentId] = useState(member.studentId ?? "");
  const changed = role !== member.role || (needsStudent(role) && studentId !== (member.studentId ?? ""));
  return (
    <Modal
      open
      onClose={onClose}
      title={member.name}
      footer={
        <>
          {member.status === "active" ? (
            <Btn variant="danger" onClick={() => window.confirm(`${member.name} tizimga kira olmaydi. Davom etasizmi?`) && onSave({ status: "suspended" }, "Kirish to'xtatildi · sessiyalari yopildi")}>
              <UserX className="h-4 w-4" /> To'xtatish
            </Btn>
          ) : (
            <Btn onClick={() => onSave({ status: "active" }, "Kirish tiklandi")}>
              <UserCheck className="h-4 w-4" /> Tiklash
            </Btn>
          )}
          <Btn variant="primary" disabled={!changed || (needsStudent(role) && !studentId)} onClick={() => onSave({ role, studentId: needsStudent(role) ? studentId : undefined }, "Rol o'zgartirildi · auditga yozildi")}>
            Saqlash
          </Btn>
        </>
      }
    >
      <div className="text-sm text-ts-sub">{member.email}</div>
      <FieldLabel label="Rol">
        <SelectBox value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ASSIGNABLE.filter((r) => r !== "owner" || isOwner).map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </SelectBox>
      </FieldLabel>
      {needsStudent(role) && <StudentPicker value={studentId} onChange={setStudentId} students={students} />}
      {member.sharedAccount && <ScopeNote>Bu akkaunt boshqa tashkilotlarga ham a'zo. Bu yerdagi o'zgarishlar faqat sizning tashkilotingizdagi rolga ta'sir qiladi.</ScopeNote>}
    </Modal>
  );
}

export function SecretModal({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal
      open
      onClose={onClose}
      title="Vaqtinchalik parol"
      footer={
        <Btn variant="primary" onClick={onClose}>
          Tushunarli
        </Btn>
      }
    >
      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        Bu parol faqat hozir ko'rsatiladi va hech qayerda saqlanmaydi. Foydalanuvchiga xavfsiz kanal orqali bering — birinchi kirishda u o'z parolini o'rnatadi.
      </div>
      <div className="space-y-1 text-sm">
        <div className="text-xs text-ts-sub">Login</div>
        <div className="font-medium">{email}</div>
      </div>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-md bg-ts-tile px-3 py-2 font-mono text-base tracking-wider">{password}</code>
        <Btn
          onClick={() => {
            navigator.clipboard?.writeText(`${email}\n${password}`).then(() => setCopied(true), () => undefined);
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Nusxalandi" : "Nusxalash"}
        </Btn>
      </div>
    </Modal>
  );
}

/* ═════════════════ Obuna va to'lovlar ═════════════════ */

type BillingData = {
  plan: PlanKey;
  plans: typeof PLANS;
  seats: number;
  accounts: number;
  monthly: number;
  billing: "paid" | "overdue" | "trial";
  paidUntil: string | null;
  invoices: { id: string; amount: number; date: string; status: "paid" | "overdue" }[];
  pendingPlanRequest: string | null;
};

const som = (n: number) => `${n.toLocaleString("ru-RU")} so'm`;

export function OrgBillingPage() {
  const [toast, showToast] = useToast();
  const q = useApi<BillingData>("/org/billing");
  const [planModal, setPlanModal] = useState<PlanKey | null>(null);
  const [note, setNote] = useState("");
  const d = q.data;
  const current = d && d.plans.find((p) => p.key === d.plan);

  return (
    <Page title="Obuna va to'lovlar" subtitle="Tarif, foydalanuvchilar soni va hisob-fakturalar">
      <QueryState error={q.error} loading={q.loading && !d} onRetry={q.reload}>
        {d && current && (
          <>
            {d.billing === "overdue" && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> To'lov muddati o'tgan ({d.paidUntil ? fmtDate(d.paidUntil) : "—"}). Xizmat to'xtab qolmasligi uchun hisob-fakturani to'lang.
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Joriy tarif" value={current.name} hint={current.seats} icon={CreditCard} />
              <Stat label="Litsenziya o'rinlari" value={d.seats.toLocaleString("ru-RU")} hint={`${som(current.price)} / o'rin · tizimda ${d.accounts} ta faol akkaunt`} icon={Users} />
              <Stat label="Oylik to'lov" value={d.billing === "trial" ? "Sinov" : som(d.monthly)} icon={Receipt} />
              <Stat label="To'langan muddat" value={d.paidUntil ? fmtDate(d.paidUntil) : "—"} delta={d.billing === "paid" ? "To'langan" : d.billing === "trial" ? "Sinov muddati" : "Qarzdorlik"} tone={d.billing === "paid" ? "green" : d.billing === "trial" ? "blue" : "red"} icon={Check} />
            </div>

            {d.pendingPlanRequest && <ScopeNote>So'rovingiz ko'rib chiqilmoqda: {d.pendingPlanRequest}. Javob "TIZIMS yordami" bo'limida keladi.</ScopeNote>}

            <div className="grid gap-4 lg:grid-cols-3">
              {d.plans.map((p) => {
                const active = p.key === d.plan;
                return (
                  <Card key={p.key} className={cn("flex flex-col p-4", active && "border-ts-sub")}>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-medium">{p.name}</span>
                      {active && <Pill tone="green">Joriy tarif</Pill>}
                    </div>
                    <div className="mt-2 text-xl font-semibold">{som(p.price)}</div>
                    <div className="text-xs text-ts-sub">foydalanuvchi / oy · {p.seats}</div>
                    <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5 text-emerald-500" /> {f}
                        </li>
                      ))}
                    </ul>
                    {!active && (
                      <Btn className="mt-4" disabled={!!d.pendingPlanRequest} onClick={() => setPlanModal(p.key)}>
                        Shu tarifga o'tish
                      </Btn>
                    )}
                  </Card>
                );
              })}
            </div>

            <Card className="overflow-hidden">
              <CardHead title="Hisob-fakturalar" className="pb-4" />
              {d.invoices.length === 0 ? (
                <Empty text="Hisob-faktura yo'q" icon={Receipt} />
              ) : (
                <Table head={["Raqam", "Summa", "Sana", "Holat"]} minWidth={520}>
                  {d.invoices.map((i) => (
                    <tr key={i.id}>
                      <Td className="font-medium">{i.id}</Td>
                      <Td className="tabular-nums">{som(i.amount)}</Td>
                      <Td className="text-ts-sub">{fmtDate(i.date)}</Td>
                      <Td>
                        <Pill tone={i.status === "paid" ? "green" : "red"} dot>
                          {i.status === "paid" ? "To'langan" : "To'lanmagan"}
                        </Pill>
                      </Td>
                    </tr>
                  ))}
                </Table>
              )}
            </Card>
          </>
        )}
      </QueryState>

      {planModal && d && (
        <Modal
          open
          onClose={() => setPlanModal(null)}
          title="Tarifni o'zgartirish"
          footer={
            <>
              <Btn onClick={() => setPlanModal(null)}>Bekor qilish</Btn>
              <Btn
                variant="primary"
                onClick={async () => {
                  try {
                    await api("/org/billing/plan-request", { body: { plan: planModal, note: note.trim() } });
                    setPlanModal(null);
                    setNote("");
                    void q.reload();
                    showToast("So'rov TIZIMS jamoasiga yuborildi");
                  } catch (e) {
                    showToast(errorText(e));
                  }
                }}
              >
                So'rov yuborish
              </Btn>
            </>
          }
        >
          <div className="text-sm">
            {d.plans.find((p) => p.key === d.plan)?.name} → <b>{d.plans.find((p) => p.key === planModal)?.name}</b>
          </div>
          <div className="text-sm text-ts-sub">
            Yangi oylik to'lov taxminan: {som(d.seats * (d.plans.find((p) => p.key === planModal)?.price ?? 0))}. O'zgarish TIZIMS jamoasi tasdiqlagach keyingi hisob-fakturadan qo'llanadi.
          </div>
          <FieldLabel label="Izoh (ixtiyoriy)">
            <TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: yangi filial ochilmoqda" />
          </FieldLabel>
        </Modal>
      )}
      {toast}
    </Page>
  );
}

/* ═════════════════ TIZIMS yordami ═════════════════ */

const T_STATUS: Record<Ticket["status"], { label: string; tone: Tone }> = {
  open: { label: "Ko'rib chiqilmoqda", tone: "blue" },
  pending: { label: "Javob berildi", tone: "green" },
  resolved: { label: "Yopilgan", tone: "gray" },
};

export function OrgSupportPage() {
  const [toast, showToast] = useToast();
  const q = useApi<Ticket[]>("/org/tickets");
  const tickets = q.data ?? [];
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const open = tickets.find((t) => t.id === openId) ?? null;
  const list = tickets.filter((t) => (tab === "open" ? t.status !== "resolved" : t.status === "resolved"));

  return (
    <Page
      title="TIZIMS yordami"
      subtitle="Texnik muammolar, savollar va takliflar — TIZIMS jamoasiga"
      actions={
        <Btn variant="primary" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Yangi so'rov
        </Btn>
      }
    >
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "open", label: "Ochiq", count: tickets.filter((t) => t.status !== "resolved").length },
          { key: "resolved", label: "Yopilgan", count: tickets.filter((t) => t.status === "resolved").length },
        ]}
      />
      <QueryState error={q.error} loading={q.loading && !q.data} onRetry={q.reload}>
        <Card className="overflow-hidden">
          {list.length === 0 ? (
            <Empty text="So'rov yo'q" icon={LifeBuoy} />
          ) : (
            <Table head={["ID", "Mavzu", "Muallif", "Sana", "Holat"]} minWidth={720}>
              {list.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => {
                    setOpenId(t.id);
                    setReply("");
                  }}
                  className="cursor-pointer transition hover:bg-ts-hover"
                >
                  <Td className="text-ts-sub">{t.id}</Td>
                  <Td className="max-w-[320px]">
                    <div className="truncate font-medium">{t.subject}</div>
                    <div className="text-xs text-ts-sub">{t.replies.length} ta javob</div>
                  </Td>
                  <Td className="text-ts-sub">{t.author}</Td>
                  <Td className="whitespace-nowrap text-ts-sub">{t.createdAt}</Td>
                  <Td>
                    <Pill tone={T_STATUS[t.status].tone} dot>
                      {T_STATUS[t.status].label}
                    </Pill>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </QueryState>

      {open && (
        <Modal open onClose={() => setOpenId(null)} title={`${open.id} · ${open.subject}`}>
          <div className="rounded-md bg-ts-tile p-3 text-sm">
            <div className="mb-1 text-xs text-ts-sub">
              {open.author} · {open.createdAt}
            </div>
            <div className="whitespace-pre-wrap">{open.body}</div>
          </div>
          {open.replies.map((r, i) => {
            const fromUs = !r.by.startsWith("TIZIMS");
            return (
              <div key={i} className={cn("rounded-md border p-3 text-sm", fromUs ? "ml-6 border-ts-line" : "mr-6 border-blue-500/30 bg-blue-500/5")}>
                <div className="mb-1 text-xs text-ts-sub">
                  {r.by} · {r.at}
                </div>
                <div className="whitespace-pre-wrap">{r.text}</div>
              </div>
            );
          })}
          {open.status !== "resolved" ? (
            <form
              className="flex items-end gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (reply.trim().length < 2) return;
                try {
                  const next = await api<Ticket>(`/org/tickets/${open.id}/reply`, { body: { text: reply.trim() } });
                  q.setData(tickets.map((t) => (t.id === next.id ? next : t)));
                  setReply("");
                } catch (err) {
                  showToast(errorText(err));
                }
              }}
            >
              <TextArea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Qo'shimcha ma'lumot..." />
              <button type="submit" disabled={reply.trim().length < 2} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ts-inv text-ts-invfg disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            </form>
          ) : (
            <div className="text-xs text-ts-sub">So'rov yopilgan. Muammo takrorlansa, yangi so'rov yarating.</div>
          )}
        </Modal>
      )}

      <NewTicket
        open={creating}
        onClose={() => setCreating(false)}
        onSave={async (f) => {
          try {
            const t = await api<Ticket>("/org/tickets", { body: f });
            q.setData([t, ...tickets]);
            setCreating(false);
            setTab("open");
            showToast(`${t.id} yuborildi · javob muddati: ${t.sla}`);
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

function NewTicket({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (f: { subject: string; body: string; priority: "urgent" | "high" | "normal" }) => Promise<boolean> }) {
  const empty = { subject: "", body: "", priority: "normal" as "urgent" | "high" | "normal" };
  const [f, setF] = useState(empty);
  const ok = f.subject.trim().length >= 4 && f.body.trim().length >= 10;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Yangi so'rov"
      footer={
        <>
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn
            variant="primary"
            disabled={!ok}
            onClick={async () => {
              if (await onSave({ subject: f.subject.trim(), body: f.body.trim(), priority: f.priority })) setF(empty);
            }}
          >
            Yuborish
          </Btn>
        </>
      }
    >
      <FieldLabel label="Mavzu">
        <TextInput value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="Qisqacha: nima ishlamayapti?" />
      </FieldLabel>
      <FieldLabel label="Batafsil">
        <TextArea rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Qaysi sahifada, nima qildingiz, nima kutgan edingiz va nima bo'ldi?" />
      </FieldLabel>
      <FieldLabel label="Muhimlik">
        <SelectBox value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as typeof f.priority })}>
          <option value="normal">Oddiy — 1 kun ichida</option>
          <option value="high">Yuqori — 4 soat ichida</option>
          <option value="urgent">Shoshilinch — tizim ishlamayapti (1 soat)</option>
        </SelectBox>
      </FieldLabel>
      <div className="text-xs text-ts-sub">Hech qachon parol yoki shaxsiy ma'lumotlarni so'rovga yozmang. Agar TIZIMS jamoasiga tashkilot ichini ko'rish kerak bo'lsa, ular alohida ruxsat so'raydi.</div>
    </Modal>
  );
}
