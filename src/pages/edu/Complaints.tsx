import { useState } from "react";
import { CheckCircle2, ClipboardList, Clock, Inbox, Plus, ShieldCheck, XCircle } from "lucide-react";
import { Btn, Card, Drawer, Empty, FieldLabel, Modal, Page, Pill, QueryState, ScopeNote, SelectBox, Stat, Table, Tabs, Td, TextArea, TextInput, Timeline, fmtDate, useToast, type Tone } from "../../components/kit";
import { api, errorText, useApi } from "../../lib/api";
import { roleLabel } from "../../lib/utils";
import { useApp } from "../../store/AppContext";
import { COMPLAINT_CATEGORIES, COMPLAINT_DEPARTMENTS, COMPLAINT_ROUTE, COMPLAINT_STATUS_LABEL, type Complaint, type ComplaintStatus } from "../../data/academic";
import { useScope } from "./scope";

const STATUS_TONE: Record<ComplaintStatus, Tone> = { new: "blue", review: "amber", resolved: "green", rejected: "red" };

export function ComplaintsPage() {
  const s = useScope("complaints");
  const { addTask } = useApp();
  const [toast, showToast] = useToast();
  const q = useApi<Complaint[]>("/edu/complaints");
  const [tab, setTab] = useState<"all" | ComplaintStatus>("all");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");

  // Doira serverda: talaba/ota-ona/o'qituvchi faqat o'zi yuborganlarini oladi, anonim muallif yashiriladi.
  const scoped = q.data ?? [];
  const list = scoped.filter((c) => tab === "all" || c.status === tab).sort((a, b) => b.date.localeCompare(a.date));
  const count = (st: ComplaintStatus) => scoped.filter((c) => c.status === st).length;
  const open = scoped.find((c) => c.id === openId) ?? null;

  async function update(id: string, patch: Partial<Pick<Complaint, "status" | "department" | "answer">>, msg?: string) {
    try {
      const next = await api<Complaint>(`/edu/complaints/${id}`, { method: "PATCH", body: patch });
      q.setData(scoped.map((c) => (c.id === id ? next : c)));
      if (msg) showToast(msg);
    } catch (e) {
      showToast(errorText(e));
    }
  }

  return (
    <Page
      title={s.title}
      subtitle={s.description}
      actions={
        s.isOwn ? (
          <Btn variant="primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Yangi murojaat
          </Btn>
        ) : undefined
      }
    >
      {s.isOwn && <ScopeNote>Murojaatingiz kategoriya bo'yicha avtomatik tegishli bo'limga yo'naltiriladi. Anonim yuborsangiz, ismingiz ko'rib chiquvchilarga ko'rsatilmaydi.</ScopeNote>}
      {s.access === "view" && <ScopeNote>Ko'rish rejimi. Murojaatlarni rahbariyat va dekanat ko'rib chiqadi.</ScopeNote>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Yangi" value={count("new")} icon={Inbox} />
        <Stat label="Ko'rib chiqilmoqda" value={count("review")} icon={Clock} />
        <Stat label="Hal qilindi" value={count("resolved")} icon={CheckCircle2} />
        <Stat label="O'rtacha javob muddati" value="1.8 kun" hint="Me'yor: 3 kun" icon={ShieldCheck} />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "all", label: "Barchasi", count: scoped.length },
          { key: "new", label: "Yangi", count: count("new") },
          { key: "review", label: "Jarayonda", count: count("review") },
          { key: "resolved", label: "Hal qilingan", count: count("resolved") },
          { key: "rejected", label: "Rad etilgan", count: count("rejected") },
        ]}
      />

      <QueryState error={q.error} loading={q.loading && !q.data} onRetry={q.reload}>
      <Card className="overflow-hidden">
        {list.length === 0 ? (
          <Empty text={s.isOwn ? "Hali murojaat yubormagansiz" : "Murojaat yo'q"} icon={Inbox} />
        ) : (
          <Table head={["ID", "Mavzu", "Kategoriya", "Bo'lim", ...(s.isOwn ? [] : ["Muallif"]), "Sana", "Holat"]} minWidth={860}>
            {list.map((c) => (
              <tr
                key={c.id}
                onClick={() => {
                  setOpenId(c.id);
                  setAnswer(c.answer ?? "");
                }}
                className="cursor-pointer transition hover:bg-ts-hover"
              >
                <Td className="text-ts-sub">{c.id}</Td>
                <Td className="max-w-[280px]">
                  <div className="truncate font-medium">{c.title}</div>
                </Td>
                <Td className="text-ts-sub">{c.category}</Td>
                <Td className="text-ts-sub">{c.department}</Td>
                {!s.isOwn && (
                  <Td>
                    {c.anonymous ? <span className="text-ts-muted">Anonim</span> : c.author}
                    <div className="text-xs text-ts-muted">{roleLabel(c.authorRole)}</div>
                  </Td>
                )}
                <Td className="whitespace-nowrap text-ts-sub">{fmtDate(c.date)}</Td>
                <Td>
                  <Pill tone={STATUS_TONE[c.status]} dot>
                    {COMPLAINT_STATUS_LABEL[c.status]}
                  </Pill>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      </QueryState>

      <NewComplaint
        open={creating}
        onClose={() => setCreating(false)}
        onSave={async (f) => {
          try {
            const c = await api<Complaint>("/edu/complaints", { body: f });
            q.setData([c, ...scoped]);
            setCreating(false);
            showToast(`${c.id} qabul qilindi · ${c.department}ga yo'naltirildi`);
            return true;
          } catch (e) {
            showToast(errorText(e));
            return false;
          }
        }}
      />

      {open && (
        <Drawer
          open
          onClose={() => setOpenId(null)}
          title={open.title}
          subtitle={
            <span className="flex flex-wrap items-center gap-1.5">
              {open.id} · {fmtDate(open.date)} · {open.anonymous && !open.mine ? "Anonim" : open.author}
              {!open.anonymous && <span className="text-ts-muted">({roleLabel(open.authorRole)})</span>}
            </span>
          }
          footer={
            s.isManage && open.status !== "resolved" && open.status !== "rejected" ? (
              <>
                <Btn
                  onClick={() => {
                    addTask({ title: `Murojaat ${open.id}: ${open.title}`, due: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), priority: "high", category: "Shikoyat", description: open.body });
                    showToast("Vazifa yaratildi");
                  }}
                >
                  <ClipboardList className="h-4 w-4" /> Vazifaga aylantirish
                </Btn>
                <Btn variant="danger" onClick={() => update(open.id, { status: "rejected", answer: answer.trim() || "Murojaat asossiz deb topildi." }, "Murojaat rad etildi")}>
                  <XCircle className="h-4 w-4" /> Rad etish
                </Btn>
                <Btn variant="primary" onClick={() => update(open.id, { status: "resolved", answer: answer.trim() || undefined }, "Murojaat yopildi")}>
                  <CheckCircle2 className="h-4 w-4" /> Hal qilindi
                </Btn>
              </>
            ) : undefined
          }
        >
          <div className="flex flex-wrap gap-1.5">
            <Pill tone={STATUS_TONE[open.status]} dot>
              {COMPLAINT_STATUS_LABEL[open.status]}
            </Pill>
            <Pill>{open.category}</Pill>
            <Pill>{open.department}</Pill>
            {open.anonymous && <Pill tone="violet">Anonim</Pill>}
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ts-muted">Murojaat matni</div>
            <p className="whitespace-pre-wrap rounded-md bg-ts-tile p-3 text-sm leading-relaxed">{open.body}</p>
          </div>

          {s.isManage ? (
            <div className="space-y-3 rounded-lg border border-ts-line p-3">
              <div className="grid grid-cols-2 gap-3">
                <FieldLabel label="Mas'ul bo'lim">
                  <SelectBox value={open.department} onChange={(e) => update(open.id, { department: e.target.value }, "Bo'lim o'zgartirildi")}>
                    {COMPLAINT_DEPARTMENTS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </SelectBox>
                </FieldLabel>
                <FieldLabel label="Holat">
                  <SelectBox value={open.status} onChange={(e) => update(open.id, { status: e.target.value as ComplaintStatus }, "Holat o'zgartirildi")}>
                    {(Object.keys(COMPLAINT_STATUS_LABEL) as ComplaintStatus[]).map((k) => (
                      <option key={k} value={k}>
                        {COMPLAINT_STATUS_LABEL[k]}
                      </option>
                    ))}
                  </SelectBox>
                </FieldLabel>
              </div>
              <FieldLabel label="Muallifga javob">
                <TextArea rows={4} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Javob muallifning kabinetida ko'rinadi..." />
              </FieldLabel>
              {answer.trim() !== (open.answer ?? "") && answer.trim() && (
                <div className="flex justify-end">
                  <Btn size="sm" onClick={() => update(open.id, { answer: answer.trim() }, "Javob saqlandi")}>
                    Javobni saqlash
                  </Btn>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ts-muted">{open.department} javobi</div>
              <div className="rounded-md border border-ts-line p-3 text-sm">{open.answer ?? <span className="text-ts-muted">Hali javob berilmagan</span>}</div>
            </div>
          )}

          <div>
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-ts-muted">Tarix</div>
            <Card>
              <Timeline
                items={(open.history ?? []).map((h) => ({
                  at: h.at,
                  tone: h.kind === "created" ? "blue" : h.kind === "answer" ? "green" : h.text.includes("Rad") ? "red" : "amber",
                  title: (
                    <>
                      <span className="font-medium">{h.by}</span>
                      <span className="text-ts-sub"> · {h.kind === "created" ? "yubordi" : h.kind === "answer" ? "javob yozdi" : h.kind === "department" ? "yo'naltirdi" : "holatni o'zgartirdi"}</span>
                    </>
                  ),
                  text: h.text,
                }))}
              />
            </Card>
          </div>
        </Drawer>
      )}
      {toast}
    </Page>
  );
}

function NewComplaint({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (f: { title: string; body: string; category: string; anonymous: boolean }) => Promise<boolean> }) {
  const [f, setF] = useState({ title: "", body: "", category: COMPLAINT_CATEGORIES[0], anonymous: false });
  const ok = f.title.trim().length > 3 && f.body.trim().length > 5;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Yangi murojaat"
      footer={
        <>
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn
            variant="primary"
            disabled={!ok}
            onClick={async () => {
              if (await onSave({ ...f, title: f.title.trim(), body: f.body.trim() })) setF({ title: "", body: "", category: COMPLAINT_CATEGORIES[0], anonymous: false });
            }}
          >
            Yuborish
          </Btn>
        </>
      }
    >
      <FieldLabel label="Kategoriya">
        <SelectBox value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          {COMPLAINT_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </SelectBox>
      </FieldLabel>
      <div className="-mt-1 text-xs text-ts-sub">Yo'naltiriladi: {COMPLAINT_ROUTE[f.category]}</div>
      <FieldLabel label="Mavzu">
        <TextInput value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Qisqacha mavzu" />
      </FieldLabel>
      <FieldLabel label="Batafsil">
        <TextArea rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Muammoni batafsil yozing..." />
      </FieldLabel>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={f.anonymous} onChange={(e) => setF({ ...f, anonymous: e.target.checked })} className="h-4 w-4 accent-current" />
        Anonim yuborish
      </label>
    </Modal>
  );
}
