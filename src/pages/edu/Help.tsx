/** Yordam: ko'p beriladigan savollar, mas'ul bo'limlar va yordam so'rovi (murojaatlar tizimi orqali, kerakli bo'limga) */
import { useState } from "react";
import { ChevronDown, LifeBuoy, Mail, MessageSquareWarning, Phone, Plus } from "lucide-react";
import { Btn, Card, CardHead, Empty, FieldLabel, Modal, Page, Pill, QueryState, SelectBox, TextArea, TextInput, fmtDate, useToast, type Tone } from "../../components/kit";
import { api, errorText, useApi } from "../../lib/api";
import { cn } from "../../lib/utils";
import { COMPLAINT_ROUTE, COMPLAINT_STATUS_LABEL, SUPPORT_CATEGORIES, type Complaint, type ComplaintStatus } from "../../data/academic";
import { useScope } from "./scope";

const FAQ: { q: string; a: string }[] = [
  { q: "Parolimni unutdim — nima qilaman?", a: "Kirish sahifasida 'Parolni unutdingizmi?' tugmasini bosing yoki kuratoringizga murojaat qiling. Tashkilot administratori sizga vaqtinchalik parol beradi — birinchi kirishda o'z parolingizni o'rnatasiz." },
  { q: "Davomatim noto'g'ri belgilangan bo'lsa?", a: "'Shikoyatlar' bo'limida 'Dars jadvali' yoki 'Boshqa' kategoriyasida murojaat yuboring, darsni va sanani ko'rsating. Sababli qoldirgan bo'lsangiz — ma'lumotnomani Registrator ofisiga topshiring." },
  { q: "Bahom bilan rozi emasman", a: "'Shikoyatlar' bo'limida 'Baholash' kategoriyasini tanlang. Murojaat Ta'lim bo'limiga yo'naltiriladi va ko'rib chiqiladi; javob shu yerda chiqadi." },
  { q: "Testni boshladim, lekin internet uzildi", a: "Qayta kirib 'Davom ettirish' tugmasini bosing — vaqt server bo'yicha hisoblanadi va javoblaringiz yo'qolmaydi, agar vaqt tugamagan bo'lsa. Muddat tugagan bo'lsa — 'Texnik yordam' so'rovini yuboring." },
  { q: "Ma'lumotnoma (spravka) qanday olaman?", a: "Pastdagi 'Yordam so'rovi' orqali 'Ma'lumotnoma' turini tanlang va qaysi tashkilot uchun kerakligini yozing. So'rov Registrator ofisiga tushadi." },
  { q: "Bildirishnomalarni qanday o'chiraman?", a: "'Sozlamalar' bo'limida qaysi xabarlarni olishni tanlashingiz mumkin: jadval, baholar, topshiriqlar, e'lonlar." },
];

const CONTACTS = [
  { name: "Registrator ofisi", hint: "Ma'lumotnomalar, o'qishga oid hujjatlar", phone: "+998 71 200 00 10", email: "registrar@iau.uz" },
  { name: "AKT bo'limi", hint: "Tizimga kirish, texnik muammolar", phone: "+998 71 200 00 20", email: "it@iau.uz" },
  { name: "Talabalar bilan ishlash bo'limi", hint: "Yotoqxona, stipendiya, ijtimoiy masalalar", phone: "+998 71 200 00 30", email: "students@iau.uz" },
];

const TONE: Record<ComplaintStatus, Tone> = { new: "blue", review: "amber", resolved: "green", rejected: "red" };

export function HelpPage() {
  const s = useScope("support");
  const [toast, showToast] = useToast();
  const q = useApi<Complaint[]>("/edu/complaints");
  const mine = (q.data ?? []).filter((c) => SUPPORT_CATEGORIES.includes(c.category));
  const [open, setOpen] = useState<number | null>(0);
  const [asking, setAsking] = useState(false);

  return (
    <Page
      title={s.title}
      subtitle={s.description}
      actions={
        <Btn variant="primary" onClick={() => setAsking(true)}>
          <Plus className="h-4 w-4" /> Yordam so'rovi
        </Btn>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHead title="Ko'p beriladigan savollar" />
          <div className="divide-y divide-ts-line">
            {FAQ.map((f, i) => (
              <div key={f.q}>
                <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition hover:bg-ts-hover">
                  <span className="flex-1">{f.q}</span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-ts-muted transition", open === i && "rotate-180")} />
                </button>
                {open === i && <div className="px-4 pb-4 text-sm leading-relaxed text-ts-sub">{f.a}</div>}
              </div>
            ))}
          </div>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHead title="Mas'ul bo'limlar" />
            <div className="space-y-2 p-4">
              {CONTACTS.map((c) => (
                <div key={c.name} className="rounded-md border border-ts-line p-3">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-ts-sub">{c.hint}</div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="flex items-center gap-1 text-ts-blue hover:underline">
                      <Phone className="h-3 w-3" /> {c.phone}
                    </a>
                    <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-ts-blue hover:underline">
                      <Mail className="h-3 w-3" /> {c.email}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHead title="Mening so'rovlarim" desc="Texnik yordam va ma'lumotnomalar" />
            <QueryState error={q.error} loading={q.loading && !q.data} onRetry={q.reload}>
              {mine.length === 0 ? (
                <Empty text="So'rov yo'q" icon={LifeBuoy} />
              ) : (
                <div className="divide-y divide-ts-line">
                  {mine.map((c) => (
                    <div key={c.id} className="px-4 py-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{c.title}</span>
                        <Pill tone={TONE[c.status]} dot>
                          {COMPLAINT_STATUS_LABEL[c.status]}
                        </Pill>
                      </div>
                      <div className="text-xs text-ts-sub">
                        {c.category} · {c.department} · {fmtDate(c.date)}
                      </div>
                      {c.answer && <div className="mt-1.5 rounded-md bg-ts-tile p-2 text-xs">{c.answer}</div>}
                    </div>
                  ))}
                </div>
              )}
            </QueryState>
            <div className="border-t border-ts-line px-4 py-2.5 text-xs text-ts-sub">
              <MessageSquareWarning className="mr-1 inline h-3 w-3" /> Shikoyatlar uchun — "Shikoyatlar" bo'limi
            </div>
          </Card>
        </div>
      </div>

      {asking && (
        <AskModal
          onClose={() => setAsking(false)}
          onSent={(c) => {
            q.setData([c, ...(q.data ?? [])]);
            setAsking(false);
            showToast(`So'rov yuborildi · ${c.department}`);
          }}
        />
      )}
      {toast}
    </Page>
  );
}

function AskModal({ onClose, onSent }: { onClose: () => void; onSent: (c: Complaint) => void }) {
  const [f, setF] = useState({ category: SUPPORT_CATEGORIES[0], title: "", body: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ok = f.title.trim().length >= 4 && f.body.trim().length >= 6;
  return (
    <Modal
      open
      onClose={onClose}
      title="Yordam so'rovi"
      footer={
        <>
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn
            variant="primary"
            disabled={!ok || busy}
            onClick={async () => {
              setBusy(true);
              try {
                onSent(await api<Complaint>("/edu/complaints", { body: { ...f, title: f.title.trim(), body: f.body.trim(), anonymous: false } }));
              } catch (e) {
                setError(errorText(e));
                setBusy(false);
              }
            }}
          >
            Yuborish
          </Btn>
        </>
      }
    >
      <FieldLabel label="Turi">
        <SelectBox value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
          {SUPPORT_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </SelectBox>
      </FieldLabel>
      <div className="-mt-1 text-xs text-ts-sub">Yo'naltiriladi: {COMPLAINT_ROUTE[f.category]}</div>
      <FieldLabel label="Mavzu">
        <TextInput value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={f.category === "Ma'lumotnoma" ? "Masalan: o'qish joyidan ma'lumotnoma" : "Masalan: testga kira olmayapman"} />
      </FieldLabel>
      <FieldLabel label="Batafsil">
        <TextArea rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder={f.category === "Ma'lumotnoma" ? "Qaysi tashkilot uchun, nechta nusxa kerak" : "Nima qildingiz va qanday xato chiqdi"} />
      </FieldLabel>
      {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
    </Modal>
  );
}
