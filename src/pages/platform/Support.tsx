import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Clock, Inbox, KeyRound, LifeBuoy, Send, ShieldCheck } from "lucide-react";
import { Btn, Card, Empty, FieldLabel, Modal, Page, Pill, QueryState, ScopeNote, SelectBox, Stat, Table, Tabs, Td, TextArea, TextInput, useToast, type Tone } from "../../components/kit";
import { api, errorText, useApi } from "../../lib/api";
import { cn } from "../../lib/utils";
import { type SupportAccess, type Ticket, type TicketPriority, type TicketStatus } from "../../data/platform";
import { useTenants } from "./Tenants";

const PRIORITY: Record<TicketPriority, { label: string; tone: Tone }> = { urgent: { label: "Shoshilinch", tone: "red" }, high: { label: "Yuqori", tone: "amber" }, normal: { label: "Oddiy", tone: "gray" } };
const STATUS: Record<TicketStatus, { label: string; tone: Tone }> = { open: { label: "Ochiq", tone: "blue" }, pending: { label: "Javob kutilmoqda", tone: "amber" }, resolved: { label: "Hal qilingan", tone: "green" } };
const ACCESS: Record<SupportAccess["status"], { label: string; tone: Tone }> = {
  pending: { label: "Ega tasdig'i kutilmoqda", tone: "amber" },
  active: { label: "Faol", tone: "green" },
  expired: { label: "Muddati tugagan", tone: "gray" },
  denied: { label: "Rad etilgan", tone: "red" },
};


export function SupportPage() {
  const loc = useLocation();
  const [toast, showToast] = useToast();
  const [tenants] = useTenants();
  const tkq = useApi<Ticket[]>("/platform/tickets");
  const acq = useApi<SupportAccess[]>("/platform/access");
  const tickets = tkq.data ?? [];
  const access = acq.data ?? [];
  const [tab, setTab] = useState<"tickets" | "access">((loc.state as { tenant?: string } | null)?.tenant ? "access" : "tickets");
  const [openId, setOpenId] = useState<string | null>(null);
  const open = tickets.find((t) => t.id === openId) ?? null;
  const [reply, setReply] = useState("");
  const [requesting, setRequesting] = useState<string | null>((loc.state as { tenant?: string } | null)?.tenant ?? null);
  const tenantName = (slug: string) => tenants.find((t) => t.slug === slug)?.name ?? slug;

  const putTicket = (t: Ticket) => tkq.setData(tickets.map((x) => (x.id === t.id ? t : x)));

  const openCount = tickets.filter((t) => t.status === "open").length;

  return (
    <Page
      title="Yordam markazi"
      subtitle="Tashkilotlardan kelgan texnik so'rovlar va yordam rejimi"
      actions={
        <Btn variant="primary" onClick={() => setRequesting(tenants[0]?.slug ?? "")}>
          <KeyRound className="h-4 w-4" /> Yordam rejimini so'rash
        </Btn>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Ochiq so'rovlar" value={openCount} icon={Inbox} />
        <Stat label="Shoshilinch" value={tickets.filter((t) => t.priority === "urgent" && t.status !== "resolved").length} tone="red" icon={LifeBuoy} />
        <Stat label="O'rtacha javob" value="38 daq" delta="SLA ichida" tone="green" icon={Clock} />
        <Stat label="Faol yordam sessiyalari" value={access.filter((a) => a.status === "active").length} icon={ShieldCheck} />
      </div>

      {(tkq.error || acq.error) && <QueryState error={tkq.error ?? acq.error} loading={false} onRetry={() => { void tkq.reload(); void acq.reload(); }}>{null}</QueryState>}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "tickets", label: "So'rovlar", count: tickets.length },
          { key: "access", label: "Yordam rejimi", count: access.length },
        ]}
      />

      {tab === "tickets" && (
        <Card className="overflow-hidden">
          <Table head={["ID", "Mavzu", "Tashkilot", "Muhimlik", "SLA", "Holat"]} minWidth={860}>
            {tickets.map((t) => (
              <tr key={t.id} onClick={() => setOpenId(t.id)} className="cursor-pointer transition hover:bg-ts-hover">
                <Td className="text-ts-sub">{t.id}</Td>
                <Td className="max-w-[320px]">
                  <div className="truncate font-medium">{t.subject}</div>
                  <div className="text-xs text-ts-sub">
                    {t.author} · {t.createdAt}
                  </div>
                </Td>
                <Td className="text-ts-sub">{tenantName(t.tenant)}</Td>
                <Td>
                  <Pill tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Pill>
                </Td>
                <Td className="text-ts-sub">{t.sla}</Td>
                <Td>
                  <Pill tone={STATUS[t.status].tone} dot>
                    {STATUS[t.status].label}
                  </Pill>
                </Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      {tab === "access" && (
        <>
          <ScopeNote>
            Yordam rejimi — tashkilot ichiga <b>faqat o'qish uchun</b>, <b>vaqt bilan cheklangan</b> kirish. Tashkilot egasi tasdiqlamaguncha ochilmaydi, har bir harakat ikkala tomon audit logiga yoziladi. Shaxsiy
            xabarlar va anonim murojaatlar bu rejimda ham yopiq.
          </ScopeNote>
          <Card className="overflow-hidden">
            {access.length === 0 ? (
              <Empty text="So'rov yo'q" />
            ) : (
              <Table head={["ID", "Tashkilot", "Sabab", "So'ralgan", "Tugash vaqti", "Holat"]} minWidth={820}>
                {access.map((a) => (
                  <tr key={a.id}>
                    <Td className="text-ts-sub">{a.id}</Td>
                    <Td className="font-medium">{tenantName(a.tenant)}</Td>
                    <Td className="text-ts-sub">
                      {a.reason}
                      {a.ticket && <span className="ml-1 text-ts-muted">({a.ticket})</span>}
                    </Td>
                    <Td className="whitespace-nowrap text-ts-sub">{a.requestedAt}</Td>
                    <Td className="whitespace-nowrap text-ts-sub">{a.expiresAt ?? "—"}</Td>
                    <Td>
                      <Pill tone={ACCESS[a.status].tone} dot>
                        {ACCESS[a.status].label}
                      </Pill>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </>
      )}

      {open && (
        <Modal
          open
          onClose={() => setOpenId(null)}
          title={`${open.id} · ${open.subject}`}
          footer={
            open.status !== "resolved" ? (
              <>
                <Btn onClick={() => setRequesting(open.tenant)}>
                  <KeyRound className="h-4 w-4" /> Yordam rejimi
                </Btn>
                <Btn
                  variant="primary"
                  onClick={async () => {
                    try {
                      putTicket(await api<Ticket>(`/platform/tickets/${open.id}`, { method: "PATCH", body: { status: "resolved" } }));
                      showToast("So'rov yopildi");
                    } catch (e) {
                      showToast(errorText(e));
                    }
                  }}
                >
                  Hal qilindi
                </Btn>
              </>
            ) : undefined
          }
        >
          <div className="flex flex-wrap gap-2">
            <Pill tone={PRIORITY[open.priority].tone}>{PRIORITY[open.priority].label}</Pill>
            <Pill tone={STATUS[open.status].tone} dot>
              {STATUS[open.status].label}
            </Pill>
            <Pill>{tenantName(open.tenant)}</Pill>
          </div>
          <div className="rounded-md bg-ts-tile p-3 text-sm">
            <div className="mb-1 text-xs text-ts-sub">
              {open.author} · {open.createdAt}
            </div>
            {open.body}
          </div>
          {open.replies.map((r, i) => (
            <div key={i} className="ml-6 rounded-md border border-ts-line p-3 text-sm">
              <div className="mb-1 text-xs text-ts-sub">
                {r.by} · {r.at}
              </div>
              {r.text}
            </div>
          ))}
          {open.status !== "resolved" && (
            <form
              className="flex items-end gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!reply.trim()) return;
                try {
                  putTicket(await api<Ticket>(`/platform/tickets/${open.id}/reply`, { body: { text: reply.trim() } }));
                  setReply("");
                  showToast("Javob saqlandi");
                } catch (err) {
                  showToast(errorText(err));
                }
              }}
            >
              <TextArea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Javob yozing..." />
              <button type="submit" disabled={!reply.trim()} className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ts-inv text-ts-invfg disabled:opacity-40")}>
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}
        </Modal>
      )}

      {requesting !== null && (
        <AccessRequest
          tenants={tenants.map((t) => ({ slug: t.slug, name: t.name }))}
          initial={requesting}
          ticket={open?.id}
          onClose={() => setRequesting(null)}
          onSave={async (a) => {
            try {
              const created = await api<SupportAccess>("/platform/access", { body: a });
              acq.setData([created, ...access]);
              setRequesting(null);
              setOpenId(null);
              setTab("access");
              showToast("So'rov yaratildi · tashkilot egasi o'z panelida tasdiqlaydi");
            } catch (e) {
              showToast(errorText(e));
            }
          }}
        />
      )}
      {toast}
    </Page>
  );
}

function AccessRequest({
  tenants,
  initial,
  ticket,
  onClose,
  onSave,
}: {
  tenants: { slug: string; name: string }[];
  initial: string;
  ticket?: string;
  onClose: () => void;
  onSave: (a: { tenant: string; reason: string; ticket?: string; hours: number }) => void;
}) {
  const [tenant, setTenant] = useState(initial || tenants[0]?.slug || "");
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState(2);
  return (
    <Modal
      open
      onClose={onClose}
      title="Yordam rejimini so'rash"
      footer={
        <>
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn variant="primary" disabled={reason.trim().length < 5} onClick={() => onSave({ tenant, reason: reason.trim(), ticket, hours })}>
            Egaga yuborish
          </Btn>
        </>
      }
    >
      <FieldLabel label="Tashkilot">
        <SelectBox value={tenant} onChange={(e) => setTenant(e.target.value)}>
          {tenants.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </SelectBox>
      </FieldLabel>
      <FieldLabel label="Sabab (egaga ko'rsatiladi)">
        <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Masalan: jadval importidagi xatoni tekshirish" />
      </FieldLabel>
      <FieldLabel label="Muddat">
        <SelectBox value={hours} onChange={(e) => setHours(Number(e.target.value))}>
          {[1, 2, 4, 8].map((h) => (
            <option key={h} value={h}>
              {h} soat
            </option>
          ))}
        </SelectBox>
      </FieldLabel>
      <div className="text-xs text-ts-sub">Kirish faqat o'qish uchun. Ega istalgan vaqtda bekor qila oladi.</div>
    </Modal>
  );
}
