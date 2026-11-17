import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookMarked, CheckCircle2, ClipboardList, FileText, FileVideo, Link2, Presentation, Plus, Upload } from "lucide-react";
import { Btn, Card, CardHead, Empty, FieldLabel, Modal, Page, Pill, Progress, QueryState, ScopeNote, SearchBox, SelectBox, Stat, Table, Tabs, Td, TextArea, TextInput, fmtDate, useToast } from "../../components/kit";
import { api, errorText, useApi } from "../../lib/api";
import { cn } from "../../lib/utils";
import { BOOKS, allSubjects, subjectByCode, teacherName, type Assignment, type Material } from "../../data/academic";

type LmsData = { subjects: string[]; materials: Material[]; assignments: Assignment[]; submitted: Record<string, string> };
import { useScope } from "./scope";

type Tab = "courses" | "assignments" | "library";

const KIND_ICON: Record<Material["kind"], typeof FileText> = { PDF: FileText, Video: FileVideo, Slayd: Presentation, Havola: Link2 };

export function LmsPage() {
  const s = useScope("lms");
  const [toast, showToast] = useToast();
  const [params] = useSearchParams();
  const initialTab = params.get("tab");
  const [tab, setTab] = useState<Tab>(initialTab === "assignments" || initialTab === "library" ? initialTab : "courses");
  useEffect(() => {
    if (initialTab === "assignments" || initialTab === "library" || initialTab === "courses") setTab(initialTab);
  }, [initialTab]);
  const q = useApi<LmsData>("/edu/lms");
  const d = q.data;
  const materials = d?.materials ?? [];
  const assignments = d?.assignments ?? [];
  const submitted = d?.submitted ?? {};
  const [modal, setModal] = useState<null | "material" | "assignment" | { submit: Assignment }>(null);

  // Ko'rinadigan fanlar doirasini server belgilaydi
  const codes = d?.subjects ?? [];
  const subjects = allSubjects().filter((x) => codes.includes(x.code));
  const [picked, setCourse] = useState("");
  const course = picked || codes[0] || "";
  const myMaterials = materials.filter((m) => codes.includes(m.subject));
  const myAssignments = assignments.filter((a) => codes.includes(a.subject)).sort((a, b) => a.due.localeCompare(b.due));
  const pending = myAssignments.filter((a) => !submitted[a.id]).length;

  return (
    <Page
      title={s.title}
      subtitle={s.description}
      actions={
        s.isManage ? (
          <>
            <Btn onClick={() => setModal("material")}>
              <Upload className="h-4 w-4" /> Material yuklash
            </Btn>
            <Btn variant="primary" onClick={() => setModal("assignment")}>
              <Plus className="h-4 w-4" /> Topshiriq berish
            </Btn>
          </>
        ) : undefined
      }
    >
      <QueryState error={q.error} loading={q.loading && !d} onRetry={q.reload}>
      {s.access === "view" && <ScopeNote>Ko'rish rejimi: kurslar holati va topshiriqlar statistikasi. Materiallarni o'qituvchilar boshqaradi.</ScopeNote>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Kurslar" value={subjects.length} icon={BookMarked} />
        <Stat label="Materiallar" value={myMaterials.length} icon={FileText} />
        {s.isStudent ? (
          <Stat label="Topshirilmagan" value={pending} delta={pending ? "Muddati yaqin" : "Hammasi topshirilgan"} tone={pending ? "amber" : "green"} icon={ClipboardList} />
        ) : (
          <Stat label="Faol topshiriqlar" value={myAssignments.length} icon={ClipboardList} />
        )}
        <Stat
          label={s.isStudent ? "Kutubxona" : "Topshirish darajasi"}
          value={s.isStudent ? `${BOOKS.filter((b) => b.available).length} kitob` : `${Math.round((myAssignments.reduce((a, x) => a + x.submitted, 0) / Math.max(1, myAssignments.reduce((a, x) => a + x.total, 0))) * 100)}%`}
          icon={s.isStudent ? BookMarked : CheckCircle2}
        />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "courses", label: "Kurslar" },
          { key: "assignments", label: "Topshiriqlar", count: myAssignments.length },
          { key: "library", label: "Elektron kutubxona" },
        ]}
      />

      {tab === "courses" && (
        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="space-y-2">
            {subjects.map((sub) => (
              <button
                key={sub.code}
                type="button"
                onClick={() => setCourse(sub.code)}
                className={cn("block w-full rounded-lg border p-3 text-left transition", course === sub.code ? "border-ts-sub bg-ts-card" : "border-ts-line bg-ts-card hover:bg-ts-hover")}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{sub.name}</span>
                  <span className="text-xs text-ts-muted">{sub.code}</span>
                </div>
                <div className="mt-0.5 text-xs text-ts-sub">{s.isTeacher ? sub.groups.join(", ") : teacherName(sub.teacherId)}</div>
                <div className="mt-2.5 flex items-center gap-2">
                  <Progress value={sub.progress} />
                  <span className="w-9 text-xs tabular-nums text-ts-sub">{sub.progress}%</span>
                </div>
              </button>
            ))}
          </div>
          <Card>
            <CardHead title={subjectByCode(course)?.name ?? "—"} desc={`${subjectByCode(course)?.credits ?? 0} kredit · ${subjectByCode(course)?.hours ?? 0} soat · ${teacherName(subjectByCode(course)?.teacherId ?? "")}`} />
            <div className="space-y-2 p-4">
              {materials.filter((m) => m.subject === course).length === 0 && <Empty text="Hali material yuklanmagan" />}
              {materials
                .filter((m) => m.subject === course)
                .sort((a, b) => a.week - b.week)
                .map((m) => {
                  const Icon = KIND_ICON[m.kind];
                  return (
                    <div key={m.id} className="flex items-center gap-3 rounded-md border border-ts-line p-3 transition hover:bg-ts-hover">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ts-chip">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{m.title}</div>
                        <div className="text-xs text-ts-sub">
                          {m.week}-hafta · {m.kind} · {m.size}
                        </div>
                      </div>
                      <Btn size="sm" variant="ghost" onClick={() => showToast(`"${m.title}" ochilmoqda`)}>
                        Ochish
                      </Btn>
                    </div>
                  );
                })}
            </div>
          </Card>
        </div>
      )}

      {tab === "assignments" && (
        <Card className="overflow-hidden">
          <Table head={["Topshiriq", "Fan", "Muddat", s.isStudent ? "Holat" : "Topshirganlar", ""]} minWidth={720}>
            {myAssignments.map((a) => {
              const done = !!submitted[a.id];
              const late = a.due < new Date().toISOString().slice(0, 10);
              return (
                <tr key={a.id}>
                  <Td>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-ts-sub">Maks. {a.maxScore} ball</div>
                  </Td>
                  <Td className="text-ts-sub">{subjectByCode(a.subject)?.name}</Td>
                  <Td className={cn("whitespace-nowrap", late && !done && "text-red-500")}>{fmtDate(a.due)}</Td>
                  <Td className="w-52">
                    {s.isStudent ? (
                      done ? (
                        <Pill tone="green" dot>
                          Topshirildi · {submitted[a.id]}
                        </Pill>
                      ) : (
                        <Pill tone={late ? "red" : "amber"} dot>
                          {late ? "Muddati o'tgan" : "Kutilmoqda"}
                        </Pill>
                      )
                    ) : (
                      <div className="flex items-center gap-2">
                        <Progress value={(a.submitted / a.total) * 100} />
                        <span className="w-12 text-xs tabular-nums text-ts-sub">
                          {a.submitted}/{a.total}
                        </span>
                      </div>
                    )}
                  </Td>
                  <Td className="text-right">
                    {s.isStudent && !done && (
                      <Btn size="sm" variant="primary" onClick={() => setModal({ submit: a })}>
                        Topshirish
                      </Btn>
                    )}
                    {s.isManage && (
                      <Btn
                        size="sm"
                        onClick={() =>
                          api<{ sent: number }>(`/edu/lms/assignments/${a.id}/remind`, { method: "POST" })
                            .then((r) => showToast(r.sent ? `${r.sent} ta talaba akkauntiga eslatma ketdi` : "Tizimda akkaunti bor, topshirmagan talaba topilmadi"))
                            .catch((e) => showToast(errorText(e)))
                        }
                      >
                        Eslatma
                      </Btn>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}

      {tab === "library" && <Library onTake={(t) => showToast(t)} />}

      </QueryState>

      <MaterialModal
        open={modal === "material"}
        subjects={subjects}
        onClose={() => setModal(null)}
        onSave={async (m) => {
          try {
            const created = await api<Material>("/edu/lms/materials", { body: m });
            if (d) q.setData({ ...d, materials: [created, ...d.materials] });
            setModal(null);
            setCourse(created.subject);
            showToast("Material yuklandi");
          } catch (e) {
            showToast(errorText(e));
          }
        }}
      />
      <AssignmentModal
        open={modal === "assignment"}
        subjects={subjects}
        onClose={() => setModal(null)}
        onSave={async (a) => {
          try {
            const created = await api<Assignment>("/edu/lms/assignments", { body: a });
            if (d) q.setData({ ...d, assignments: [created, ...d.assignments] });
            setModal(null);
            setTab("assignments");
            showToast("Topshiriq e'lon qilindi");
          } catch (e) {
            showToast(errorText(e));
          }
        }}
      />
      {modal && typeof modal === "object" && (
        <SubmitModal
          a={modal.submit}
          onClose={() => setModal(null)}
          onSubmit={async (file) => {
            try {
              await api(`/edu/lms/assignments/${modal.submit.id}/submit`, { body: { file } });
              if (d) q.setData({ ...d, submitted: { ...d.submitted, [modal.submit.id]: file }, assignments: d.assignments.map((x) => (x.id === modal.submit.id ? { ...x, submitted: x.submitted + 1 } : x)) });
              setModal(null);
              showToast("Topshiriq yuborildi");
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

function Library({ onTake }: { onTake: (msg: string) => void }) {
  const [q, setQ] = useState("");
  const list = BOOKS.filter((b) => (b.title + b.author).toLowerCase().includes(q.toLowerCase()));
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="text-base font-medium">Elektron kutubxona</div>
          <div className="text-sm text-ts-sub">{BOOKS.length} ta nashr · e-kitoblar onlayn o'qiladi</div>
        </div>
        <SearchBox value={q} onChange={setQ} placeholder="Kitob yoki muallif..." className="w-64" />
      </div>
      <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((b) => (
          <div key={b.id} className="flex gap-3 rounded-md border border-ts-line p-3">
            <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded bg-gradient-to-b from-ts-blue2 to-ts-blue3 text-white">
              <BookMarked className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{b.title}</div>
              <div className="truncate text-xs text-ts-sub">
                {b.author} · {b.year}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Pill tone={b.kind === "E-kitob" ? "blue" : "gray"}>{b.kind}</Pill>
                {b.kind === "E-kitob" ? (
                  <button type="button" onClick={() => onTake(`"${b.title}" o'qish uchun ochildi`)} className="text-xs font-medium text-ts-blue hover:underline">
                    O'qish
                  </button>
                ) : b.available ? (
                  <button type="button" onClick={() => onTake(`"${b.title}" band qilindi — kutubxonadan oling`)} className="text-xs font-medium text-ts-blue hover:underline">
                    Band qilish
                  </button>
                ) : (
                  <span className="text-xs text-ts-muted">Hozir band</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {list.length === 0 && <Empty text="Hech narsa topilmadi" />}
    </Card>
  );
}

function MaterialModal({ open, subjects, onClose, onSave }: { open: boolean; subjects: { code: string; name: string }[]; onClose: () => void; onSave: (m: { subject: string; title: string; kind: Material["kind"]; week: number }) => void }) {
  const [f, setF] = useState({ subject: "", title: "", kind: "PDF" as Material["kind"], week: 11 });
  const subject = f.subject || subjects[0]?.code || "";
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Material yuklash"
      footer={
        <>
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn variant="primary" disabled={f.title.trim().length < 3} onClick={() => onSave({ ...f, subject, title: f.title.trim() })}>
            Yuklash
          </Btn>
        </>
      }
    >
      <FieldLabel label="Fan">
        <SelectBox value={subject} onChange={(e) => setF({ ...f, subject: e.target.value })}>
          {subjects.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </SelectBox>
      </FieldLabel>
      <FieldLabel label="Sarlavha">
        <TextInput value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Masalan: 11-ma'ruza — RNN va LSTM" />
      </FieldLabel>
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Turi">
          <SelectBox value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Material["kind"] })}>
            {(["PDF", "Slayd", "Video", "Havola"] as const).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </SelectBox>
        </FieldLabel>
        <FieldLabel label="Hafta">
          <TextInput type="number" min={1} max={18} value={f.week} onChange={(e) => setF({ ...f, week: Number(e.target.value) || 1 })} />
        </FieldLabel>
      </div>
    </Modal>
  );
}

function AssignmentModal({ open, subjects, onClose, onSave }: { open: boolean; subjects: { code: string; name: string; groups: string[] }[]; onClose: () => void; onSave: (a: { subject: string; title: string; due: string; maxScore: number }) => void }) {
  const [f, setF] = useState({ subject: "", title: "", due: "", maxScore: 10 });
  const subject = f.subject || subjects[0]?.code || "";
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Topshiriq berish"
      footer={
        <>
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn variant="primary" disabled={f.title.trim().length < 3 || !f.due} onClick={() => onSave({ ...f, subject, title: f.title.trim() })}>
            E'lon qilish
          </Btn>
        </>
      }
    >
      <FieldLabel label="Fan">
        <SelectBox value={subject} onChange={(e) => setF({ ...f, subject: e.target.value })}>
          {subjects.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name} ({s.groups.join(", ")})
            </option>
          ))}
        </SelectBox>
      </FieldLabel>
      <FieldLabel label="Topshiriq nomi">
        <TextInput value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Masalan: 4-laboratoriya ishi" />
      </FieldLabel>
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Muddat">
          <TextInput type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
        </FieldLabel>
        <FieldLabel label="Maksimal ball">
          <TextInput type="number" min={1} max={50} value={f.maxScore} onChange={(e) => setF({ ...f, maxScore: Number(e.target.value) || 1 })} />
        </FieldLabel>
      </div>
    </Modal>
  );
}

function SubmitModal({ a, onClose, onSubmit }: { a: Assignment; onClose: () => void; onSubmit: (file: string) => void }) {
  const [file, setFile] = useState("");
  const [note, setNote] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title="Topshiriqni yuborish"
      footer={
        <>
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn variant="primary" disabled={!file} onClick={() => onSubmit(file)}>
            Yuborish
          </Btn>
        </>
      }
    >
      <div className="rounded-md bg-ts-tile p-3">
        <div className="font-medium">{a.title}</div>
        <div className="text-xs text-ts-sub">
          {subjectByCode(a.subject)?.name} · muddat {fmtDate(a.due)} · maks. {a.maxScore} ball
        </div>
      </div>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed border-ts-line2 p-6 text-center text-sm text-ts-sub hover:bg-ts-hover">
        <Upload className="h-5 w-5" />
        {file || "Faylni tanlang (PDF, ZIP, DOCX)"}
        <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")} />
      </label>
      <FieldLabel label="Izoh (ixtiyoriy)">
        <TextArea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="O'qituvchi uchun izoh..." />
      </FieldLabel>
    </Modal>
  );
}
