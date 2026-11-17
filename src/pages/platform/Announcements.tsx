import { useState } from "react";
import { Archive, CalendarClock, ExternalLink, Megaphone, Plus, Send, Wrench } from "lucide-react";
import { Btn, Card, Empty, FieldLabel, Modal, Page, Pill, QueryState, ScopeNote, SelectBox, Stat, Table, Tabs, Td, TextArea, TextInput, fmtDate, useToast, type Tone } from "../../components/kit";
import { api, errorText, useApi } from "../../lib/api";
import { cn } from "../../lib/utils";
import { fmtDateTime, upcomingMaintenance } from "../../lib/maintenance";
import { AUDIENCE_LABEL, type Announcement, type Audience, type Maintenance } from "../../data/platform";

const A_STATUS: Record<Announcement["status"], { label: string; tone: Tone }> = { draft: { label: "Qoralama", tone: "gray" }, published: { label: "E'lon qilingan", tone: "green" }, archived: { label: "Arxiv", tone: "gray" } };
const M_STATUS: Record<Maintenance["status"], { label: string; tone: Tone }> = { scheduled: { label: "Rejalashtirilgan", tone: "blue" }, in_progress: { label: "Davom etmoqda", tone: "amber" }, done: { label: "Yakunlandi", tone: "green" }, cancelled: { label: "Bekor qilindi", tone: "gray" } };
const TONE_LABEL = { info: "Ma'lumot", success: "Yangilik", warning: "Ogohlantirish" };

export function AnnouncementsPage() {
  const [toast, showToast] = useToast();
  const q = useApi<{ announcements: Announcement[]; maintenance: Maintenance[] }>("/platform/announcements");
  const items = q.data?.announcements ?? [];
  const mnts = q.data?.maintenance ?? [];
  const setItems = (a: Announcement[]) => q.data && q.setData({ ...q.data, announcements: a });
  const setMnts = (m: Maintenance[]) => q.data && q.setData({ ...q.data, maintenance: m });
  const [tab, setTab] = useState<"ann" | "mnt">("ann");
  const [modal, setModal] = useState<null | "ann" | "mnt">(null);
  const next = upcomingMaintenance(mnts);

  const patchA = async (id: string, p: Pick<Announcement, "status">, msg: string) => {
    try {
      const next = await api<Announcement>(`/platform/announcements/${id}`, { method: "PATCH", body: p });
      setItems(items.map((x) => (x.id === id ? next : x)));
      showToast(msg);
    } catch (e) {
      showToast(errorText(e));
    }
  };
  const patchM = async (id: string, p: Pick<Maintenance, "status">, msg: string) => {
    try {
      const next = await api<Maintenance>(`/platform/maintenance/${id}`, { method: "PATCH", body: p });
      setMnts(mnts.map((x) => (x.id === id ? next : x)));
      showToast(msg);
    } catch (e) {
      showToast(errorText(e));
    }
  };

  return (
    <Page
      title="E'lonlar va texnik ishlar"
      subtitle="Tashkilotlarga xabar berish va rejali to'xtashlarni oldindan e'lon qilish"
      actions={
        <>
          <a href="/status" target="_blank" rel="noreferrer">
            <Btn>
              <ExternalLink className="h-4 w-4" /> Holat sahifasi
            </Btn>
          </a>
          <Btn variant="primary" onClick={() => setModal(tab)}>
            <Plus className="h-4 w-4" /> {tab === "ann" ? "Yangi e'lon" : "Texnik ish rejalash"}
          </Btn>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Faol e'lonlar" value={items.filter((a) => a.status === "published").length} icon={Megaphone} />
        <Stat label="Qoralamalar" value={items.filter((a) => a.status === "draft").length} icon={Archive} />
        <Stat label="Keyingi texnik ish" value={next ? fmtDateTime(next.start) : "—"} hint={next?.title ?? "Rejalashtirilmagan"} icon={Wrench} />
        <Stat label="Qamrov (oxirgi e'lon)" value={(items.find((a) => a.reach)?.reach ?? 0).toLocaleString("ru-RU")} hint="foydalanuvchi" icon={Send} />
      </div>

      {q.error && <QueryState error={q.error} loading={false} onRetry={q.reload}>{null}</QueryState>}
      <ScopeNote>E'lon qilingan xabarlar tashkilot foydalanuvchilarida yuqori banner sifatida chiqadi. Texnik ish boshlanishidan 7 kun oldin login sahifasida va ilovada ogohlantirish ko'rsatiladi.</ScopeNote>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "ann", label: "E'lonlar", count: items.length },
          { key: "mnt", label: "Texnik ishlar", count: mnts.length },
        ]}
      />

      {tab === "ann" && (
        <div className="space-y-3">
          {items.length === 0 && (
            <Card>
              <Empty text="E'lon yo'q" />
            </Card>
          )}
          {items.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex flex-wrap items-start gap-3">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", a.tone === "warning" ? "bg-amber-500" : a.tone === "success" ? "bg-emerald-500" : "bg-blue-500")} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.title}</span>
                    <Pill tone={A_STATUS[a.status].tone} dot>
                      {A_STATUS[a.status].label}
                    </Pill>
                  </div>
                  <p className="mt-1 text-sm text-ts-sub">{a.body}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ts-muted">
                    <span>{a.id}</span>
                    <span>{fmtDate(a.createdAt)}</span>
                    <span>{AUDIENCE_LABEL[a.audience]}</span>
                    <span>{TONE_LABEL[a.tone]}</span>
                    <span>{a.channels.join(" · ")}</span>
                    {a.reach && <span>{a.reach.toLocaleString("ru-RU")} kishiga yetdi</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {a.status === "draft" && (
                    <Btn size="sm" variant="primary" onClick={() => patchA(a.id, { status: "published" }, "E'lon qilindi · tashkilotlarda banner chiqdi")}>
                      E'lon qilish
                    </Btn>
                  )}
                  {a.status === "published" && (
                    <Btn size="sm" onClick={() => patchA(a.id, { status: "archived" }, "Arxivga o'tkazildi · banner olib tashlandi")}>
                      Arxivlash
                    </Btn>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "mnt" && (
        <Card className="overflow-hidden">
          {mnts.length === 0 ? (
            <Empty text="Rejalashtirilgan ish yo'q" />
          ) : (
            <Table head={["ID", "Ish", "Boshlanish", "Tugash", "Ta'sir", "Holat", ""]} minWidth={900}>
              {mnts.map((m) => (
                <tr key={m.id}>
                  <Td className="text-ts-sub">{m.id}</Td>
                  <Td className="font-medium">{m.title}</Td>
                  <Td className="whitespace-nowrap">{fmtDateTime(m.start)}</Td>
                  <Td className="whitespace-nowrap">{fmtDateTime(m.end)}</Td>
                  <Td className="text-ts-sub">{m.services.join(", ")}</Td>
                  <Td>
                    <Pill tone={M_STATUS[m.status].tone} dot>
                      {M_STATUS[m.status].label}
                    </Pill>
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    {m.status === "scheduled" && (
                      <div className="flex justify-end gap-1.5">
                        <Btn size="sm" onClick={() => patchM(m.id, { status: "in_progress" }, "Texnik ish boshlandi")}>
                          Boshlash
                        </Btn>
                        <Btn size="sm" variant="ghost" onClick={() => patchM(m.id, { status: "cancelled" }, "Bekor qilindi · ogohlantirish olib tashlandi")}>
                          Bekor
                        </Btn>
                      </div>
                    )}
                    {m.status === "in_progress" && (
                      <Btn size="sm" variant="primary" onClick={() => patchM(m.id, { status: "done" }, "Yakunlandi")}>
                        Yakunlash
                      </Btn>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      <NewAnnouncement
        open={modal === "ann"}
        onClose={() => setModal(null)}
        onSave={async (a, publish) => {
          try {
            const created = await api<Announcement>("/platform/announcements", { body: { ...a, publish } });
            setItems([created, ...items]);
            setModal(null);
            showToast(publish ? "E'lon qilindi" : "Qoralama saqlandi");
            return true;
          } catch (e) {
            showToast(errorText(e));
            return false;
          }
        }}
      />
      <NewMaintenance
        open={modal === "mnt"}
        onClose={() => setModal(null)}
        onSave={async (m) => {
          try {
            const created = await api<Maintenance>("/platform/maintenance", { body: m });
            setMnts([created, ...mnts]);
            setModal(null);
            setTab("mnt");
            showToast("Texnik ish rejalashtirildi · tashkilotlar ogohlantiriladi");
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

function NewAnnouncement({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (a: Omit<Announcement, "id" | "status" | "createdAt" | "reach">, publish: boolean) => Promise<boolean> }) {
  const empty = { title: "", body: "", audience: "all" as Audience, tone: "info" as Announcement["tone"], channels: ["banner"] as Announcement["channels"] };
  const [f, setF] = useState(empty);
  const ok = f.title.trim().length > 3 && f.body.trim().length > 5 && f.channels.length > 0;
  const save = async (publish: boolean) => {
    if (await onSave({ ...f, title: f.title.trim(), body: f.body.trim() }, publish)) setF(empty);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Yangi e'lon"
      footer={
        <>
          <Btn disabled={!ok} onClick={() => save(false)}>
            Qoralama
          </Btn>
          <Btn variant="primary" disabled={!ok} onClick={() => save(true)}>
            E'lon qilish
          </Btn>
        </>
      }
    >
      <FieldLabel label="Sarlavha">
        <TextInput value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </FieldLabel>
      <FieldLabel label="Matn">
        <TextArea rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
      </FieldLabel>
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Kimga">
          <SelectBox value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value as Audience })}>
            {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((k) => (
              <option key={k} value={k}>
                {AUDIENCE_LABEL[k]}
              </option>
            ))}
          </SelectBox>
        </FieldLabel>
        <FieldLabel label="Turi">
          <SelectBox value={f.tone} onChange={(e) => setF({ ...f, tone: e.target.value as Announcement["tone"] })}>
            {(Object.keys(TONE_LABEL) as Announcement["tone"][]).map((k) => (
              <option key={k} value={k}>
                {TONE_LABEL[k]}
              </option>
            ))}
          </SelectBox>
        </FieldLabel>
      </div>
      <div>
        <div className="mb-1.5 text-xs font-medium text-ts-sub">Kanallar</div>
        <div className="flex gap-3">
          {(["banner", "email", "telegram"] as const).map((c) => (
            <label key={c} className="flex cursor-pointer items-center gap-1.5 text-sm">
              <input type="checkbox" checked={f.channels.includes(c)} onChange={(e) => setF({ ...f, channels: e.target.checked ? [...f.channels, c] : f.channels.filter((x) => x !== c) })} className="h-4 w-4" />
              {c === "banner" ? "Ilova banneri" : c === "email" ? "Email" : "Telegram"}
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function NewMaintenance({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (m: Omit<Maintenance, "id" | "status">) => Promise<boolean> }) {
  const empty = { title: "", start: "", end: "", services: "Butun platforma" };
  const [f, setF] = useState(empty);
  const ok = f.title.trim() && f.start && f.end && f.end > f.start;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Texnik ish rejalash"
      footer={
        <>
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn
            variant="primary"
            disabled={!ok}
            onClick={async () => {
              if (await onSave({ title: f.title.trim(), start: f.start, end: f.end, services: f.services.split(",").map((s) => s.trim()).filter(Boolean) })) setF(empty);
            }}
          >
            <CalendarClock className="h-4 w-4" /> Rejalash
          </Btn>
        </>
      }
    >
      <FieldLabel label="Nima qilinadi">
        <TextInput value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Masalan: serverlarni yangilash" />
      </FieldLabel>
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Boshlanish">
          <TextInput type="datetime-local" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />
        </FieldLabel>
        <FieldLabel label="Tugash">
          <TextInput type="datetime-local" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
        </FieldLabel>
      </div>
      {f.start && f.end && f.end <= f.start && <div className="text-xs text-red-500">Tugash vaqti boshlanishdan keyin bo'lishi kerak</div>}
      <FieldLabel label="Ta'sir qiladigan xizmatlar (vergul bilan)">
        <TextInput value={f.services} onChange={(e) => setF({ ...f, services: e.target.value })} />
      </FieldLabel>
      <div className="text-xs text-ts-sub">Tavsiya: ish vaqtidan tashqari, 01:00–05:00 oralig'ida.</div>
    </Modal>
  );
}
