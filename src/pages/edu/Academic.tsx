import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, BookOpen, CalendarRange, Layers, Lock, Plus, UserCog, Users } from "lucide-react";
import { SemesterCloseModal } from "./SemesterClose";
import { Btn, Card, CardHead, Empty, FieldLabel, Modal, Page, Pill, Progress, QueryState, ScopeNote, SelectBox, Stat, Table, Tabs, Td, TextInput, fmtDate, useToast } from "../../components/kit";
import { useSubjects, type SubjectView, type TeacherRow } from "../../lib/subjects";
import { api, errorText, useApi } from "../../lib/api";
import { CURRICULUM, FACULTIES, SEMESTERS, TEACHERS, type Group, type Semester } from "../../data/academic";
import { useScope } from "./scope";

type Tab = "groups" | "subjects" | "semester";

export function AcademicPage() {
  const s = useScope("academic");
  const nav = useNavigate();
  const [toast, showToast] = useToast();
  const [tab, setTab] = useState<Tab>("groups");
  const q = useApi<Group[]>("/edu/groups");
  const groups = q.data ?? [];
  const [adding, setAdding] = useState(false);

  const visibleGroups = groups; // doira serverda: o'qituvchi → o'z guruhlari, dekan → o'z fakulteti
  const { list: catalog, reload: reloadSubjects } = useSubjects();
  const subjects = (s.isTeacher ? catalog.filter((x) => x.teacherId === s.user?.id) : catalog.filter((x) => x.groups.some((g) => visibleGroups.some((v) => v.id === g))));
  const teachersQ = useApi<TeacherRow[]>(s.isManage ? "/edu/teachers" : null);
  const [editing, setEditing] = useState<SubjectView | "new" | null>(null);
  const unassigned = subjects.filter((x) => x.teacherAccount !== "active");
  const semQ = useApi<Semester[]>("/edu/semesters");
  const semesters = semQ.data ?? SEMESTERS;
  const sem = semesters.find((x) => x.status === "active") ?? semesters[0];
  const canClose = s.isManage && (s.role === "owner" || s.role === "rector");
  const [closing, setClosing] = useState(false);

  return (
    <Page
      title={s.title}
      subtitle={s.description}
      actions={
        s.isManage && tab === "groups" ? (
          <Btn variant="primary" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Guruh yaratish
          </Btn>
        ) : s.isManage && tab === "subjects" ? (
          <Btn variant="primary" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Fan qo'shish
          </Btn>
        ) : undefined
      }
    >
      {s.isTeacher && <ScopeNote>Sizga biriktirilgan fanlar va guruhlar.</ScopeNote>}
      {s.facultyGroups && <ScopeNote>Axborot texnologiyalari fakulteti bo'yicha.</ScopeNote>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Guruhlar" value={visibleGroups.length} icon={Users} />
        <Stat label="Fanlar" value={subjects.length} hint={`${subjects.reduce((a, x) => a + x.credits, 0)} kredit`} icon={BookOpen} />
        <Stat label="Joriy semestr" value={`${sem.current}/${sem.weeks} hafta`} hint={sem.name} icon={CalendarRange} />
        <Stat label="Talabalar" value={visibleGroups.reduce((a, g) => a + g.students, 0)} icon={Layers} />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "groups", label: "Guruhlar", count: visibleGroups.length },
          { key: "subjects", label: unassigned.length && s.isManage ? `Fanlar · ${unassigned.length} ta diqqat` : "Fanlar", count: subjects.length },
          { key: "semester", label: "Semestr va o'quv reja" },
        ]}
      />

      {tab === "groups" && (
        <QueryState error={q.error} loading={q.loading && !q.data} onRetry={q.reload}>
        <Card className="overflow-hidden">
          <Table head={["Guruh", "Fakultet", "Yo'nalish", "Kurs", "Kurator", "Talabalar", "Davomat", "GPA"]} minWidth={900}>
            {visibleGroups.map((g) => (
              <tr key={g.id} onClick={() => nav(`/academic/groups/${g.id}`)} className="cursor-pointer transition hover:bg-ts-hover">
                <Td className="font-medium">{g.id}</Td>
                <Td className="text-ts-sub">{FACULTIES.find((f) => f.id === g.faculty)?.name.replace(" fakulteti", "")}</Td>
                <Td>{g.direction}</Td>
                <Td>{g.course}-kurs</Td>
                <Td className="text-ts-sub">{g.curator}</Td>
                <Td className="tabular-nums">{g.students}</Td>
                <Td>
                  <Pill tone={g.attendance < 80 ? "red" : g.attendance < 88 ? "amber" : "green"}>{g.attendance}%</Pill>
                </Td>
                <Td className="tabular-nums">{g.gpa ? g.gpa.toFixed(2) : "—"}</Td>
              </tr>
            ))}
          </Table>
        </Card>
        </QueryState>
      )}

      {tab === "subjects" && (
        <>
          {s.isManage && unassigned.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-900 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <b>{unassigned.length} ta fan</b> tizim akkaunti yo'q yoki to'xtatilgan o'qituvchiga biriktirilgan — bu fanlar bo'yicha baho va davomat kiritilmaydi. "O'qituvchi" tugmasi orqali akkaunti bor o'qituvchiga
                biriktiring.
              </span>
            </div>
          )}
          <Card className="overflow-hidden">
            {subjects.length === 0 ? (
              <Empty text={s.isTeacher ? "Sizga hali fan biriktirilmagan — tashkilot rahbariyatiga murojaat qiling" : "Fan yo'q"} icon={BookOpen} />
            ) : (
              <Table head={["Fan", "O'qituvchi", "Guruhlar", "Kredit", "Soat", "O'tilgan", ...(s.isManage ? [""] : [])]} minWidth={920}>
                {subjects.map((x) => (
                  <tr key={x.code}>
                    <Td>
                      <div className="font-medium">{x.name}</div>
                      <div className="text-xs text-ts-muted">{x.code}</div>
                    </Td>
                    <Td>
                      <div className="text-sm">{x.teacherName}</div>
                      {x.teacherAccount !== "active" && <div className="text-xs text-amber-600">{x.teacherAccount === "none" ? "Tizim akkaunti yo'q" : "Akkaunt to'xtatilgan"}</div>}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {x.groups.map((g) => (
                          <Pill key={g}>{g}</Pill>
                        ))}
                      </div>
                    </Td>
                    <Td className="tabular-nums">{x.credits}</Td>
                    <Td className="tabular-nums">{x.hours}</Td>
                    <Td className="w-36">
                      <div className="flex items-center gap-2">
                        <Progress value={x.progress} />
                        <span className="w-9 text-xs tabular-nums text-ts-sub">{x.progress}%</span>
                      </div>
                    </Td>
                    {s.isManage && (
                      <Td className="text-right">
                        <Btn size="sm" variant={x.teacherAccount !== "active" ? "primary" : "outline"} onClick={() => setEditing(x)}>
                          <UserCog className="h-3.5 w-3.5" /> O'qituvchi
                        </Btn>
                      </Td>
                    )}
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </>
      )}

      {tab === "semester" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHead
              title="Akademik kalendar"
              desc="Semestrlar"
              action={
                canClose && sem?.status === "active" ? (
                  <Btn size="sm" variant="danger" onClick={() => setClosing(true)}>
                    <Lock className="h-3.5 w-3.5" /> Semestrni yopish
                  </Btn>
                ) : undefined
              }
            />
            <div className="space-y-3 p-4">
              {semesters.map((x) => (
                <div key={x.id} className="rounded-md border border-ts-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{x.name}</span>
                    <Pill tone={x.status === "active" ? "green" : "gray"} dot>
                      {x.status === "active" ? "Joriy" : "Yakunlangan"}
                    </Pill>
                  </div>
                  <div className="mt-1 text-xs text-ts-sub">
                    {fmtDate(x.start)} — {fmtDate(x.end)}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Progress value={(x.current / x.weeks) * 100} tone={x.status === "active" ? "blue" : "gray"} />
                    <span className="w-16 text-right text-xs tabular-nums text-ts-sub">
                      {x.current}/{x.weeks} hafta
                    </span>
                  </div>
                  {x.stats && (
                    <div className="mt-3 grid grid-cols-4 gap-2 border-t border-ts-line pt-3 text-center text-xs">
                      {[
                        ["Talaba", x.stats.students],
                        ["O'rtacha GPA", x.stats.gpa.toFixed(2)],
                        ["Qarzdor", x.stats.failed],
                        ["Bitirgan", x.stats.graduated],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <div className="font-semibold tabular-nums">{v}</div>
                          <div className="text-ts-muted">{k}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {x.closedAt && (
                    <div className="mt-2 text-[11px] text-ts-muted">
                      Yopildi: {x.closedAt} · {x.closedBy}
                    </div>
                  )}
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {[
                  ["Oraliq nazorat", "18–30 noy"],
                  ["Qishki ta'til", "16 yan – 4 fev"],
                  ["Yakuniy sessiya", "18 dek – 14 yan"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-md bg-ts-tile p-2.5">
                    <div className="text-ts-sub">{k}</div>
                    <div className="mt-0.5 font-medium">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Card>
            <CardHead title="O'quv reja" desc="Sun'iy intellekt yo'nalishi · 3-kurs" />
            <div className="space-y-3 p-4">
              {CURRICULUM.map((c) => (
                <div key={c.semester} className="rounded-md border border-ts-line p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{c.semester}-semestr</span>
                    <span className="text-xs text-ts-sub">{c.credits} kredit</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.subjects.map((x) => (
                      <Pill key={x}>{x}</Pill>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {editing && (
        <SubjectModal
          subject={editing === "new" ? null : editing}
          groups={visibleGroups.map((g) => g.id)}
          teachers={teachersQ.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => {
            await reloadSubjects();
            setEditing(null);
            showToast(msg);
          }}
          onError={showToast}
        />
      )}

      {closing && (
        <SemesterCloseModal
          onClose={() => setClosing(false)}
          onClosed={(msg) => {
            setClosing(false);
            void semQ.reload();
            void q.reload();
            void reloadSubjects();
            showToast(msg);
          }}
        />
      )}

      <AddGroup
        open={adding}
        curators={Array.from(new Set([...(teachersQ.data ?? []).filter((t) => t.account === "active").map((t) => t.name), ...TEACHERS.map((t) => t.name)]))}
        faculties={s.facultyId ? FACULTIES.filter((f) => f.id === s.facultyId) : FACULTIES}
        onClose={() => setAdding(false)}
        onSave={async (g) => {
          try {
            const created = await api<Group>("/edu/groups", { body: g });
            q.setData([...groups, created]);
            setAdding(false);
            showToast(`${created.id} guruhi yaratildi`);
          } catch (e) {
            showToast(errorText(e));
          }
        }}
      />
      {toast}
    </Page>
  );
}

function AddGroup({
  open,
  faculties,
  curators,
  onClose,
  onSave,
}: {
  open: boolean;
  faculties: typeof FACULTIES;
  curators: string[];
  onClose: () => void;
  onSave: (g: { id: string; faculty: string; direction: string; course: number; curator: string }) => void;
}) {
  const [f, setF] = useState({ id: "", faculty: faculties[0]?.id ?? "", direction: "", course: 1, curator: curators[0] ?? "" });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Guruh yaratish"
      footer={
        <>
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn
            variant="primary"
            disabled={!f.id.trim() || !f.direction.trim()}
            onClick={() => onSave({ ...f, id: f.id.trim().toUpperCase(), direction: f.direction.trim() })}
          >
            Yaratish
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Guruh kodi">
          <TextInput value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} placeholder="IT-24" />
        </FieldLabel>
        <FieldLabel label="Kurs">
          <SelectBox value={f.course} onChange={(e) => setF({ ...f, course: Number(e.target.value) })}>
            {[1, 2, 3, 4].map((c) => (
              <option key={c} value={c}>
                {c}-kurs
              </option>
            ))}
          </SelectBox>
        </FieldLabel>
      </div>
      <FieldLabel label="Fakultet">
        <SelectBox value={f.faculty} onChange={(e) => setF({ ...f, faculty: e.target.value })}>
          {faculties.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </SelectBox>
      </FieldLabel>
      <FieldLabel label="Yo'nalish">
        <TextInput value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value })} placeholder="Masalan: Sun'iy intellekt" />
      </FieldLabel>
      <FieldLabel label="Kurator">
        <SelectBox value={f.curator} onChange={(e) => setF({ ...f, curator: e.target.value })}>
          {curators.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </SelectBox>
      </FieldLabel>
    </Modal>
  );
}

/** Fan yaratish / tahrirlash: o'qituvchi faqat tizim akkaunti bor o'qituvchilardan tanlanadi */
function SubjectModal({
  subject,
  groups,
  teachers,
  onClose,
  onSaved,
  onError,
}: {
  subject: SubjectView | null;
  groups: string[];
  teachers: TeacherRow[];
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const nav = useNavigate();
  const active = teachers.filter((t) => t.account === "active");
  const [f, setF] = useState({
    code: subject?.code ?? "",
    name: subject?.name ?? "",
    credits: subject?.credits ?? 5,
    hours: subject?.hours ?? 60,
    teacherId: subject && subject.teacherAccount === "active" ? subject.teacherId : "",
    groups: subject?.groups ?? [],
  });
  const [saving, setSaving] = useState(false);
  const changingTeacher = !!subject && f.teacherId !== subject.teacherId;
  const ok = (subject || /^[A-Za-z]{2,4}-\d{3}$/.test(f.code)) && f.name.trim().length >= 3 && f.teacherId && f.groups.length > 0;

  async function save() {
    setSaving(true);
    try {
      if (subject) {
        const r = await api<{ movedLessons: number }>(`/edu/subjects/${subject.code}`, {
          method: "PATCH",
          body: { name: f.name.trim(), credits: f.credits, hours: f.hours, teacherId: f.teacherId, groups: f.groups },
        });
        onSaved(changingTeacher ? `O'qituvchi almashtirildi · ${r.movedLessons} ta dars yangi o'qituvchiga o'tdi` : "Fan yangilandi");
      } else {
        await api("/edu/subjects", { body: { code: f.code.toUpperCase(), name: f.name.trim(), credits: f.credits, hours: f.hours, teacherId: f.teacherId, groups: f.groups } });
        onSaved("Fan qo'shildi · o'qituvchiga bildirishnoma yuborildi");
      }
    } catch (e) {
      onError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={subject ? `${subject.name} · ${subject.code}` : "Fan qo'shish"}
      footer={
        <>
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn variant="primary" disabled={!ok || saving} onClick={save}>
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </Btn>
        </>
      }
    >
      {!subject && (
        <FieldLabel label="Fan kodi">
          <TextInput value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="CS-401" />
        </FieldLabel>
      )}
      <FieldLabel label="Fan nomi">
        <TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Masalan: Kompyuter ko'rish" />
      </FieldLabel>
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Kredit">
          <TextInput type="number" min={1} max={12} value={f.credits} onChange={(e) => setF({ ...f, credits: Number(e.target.value) || 1 })} />
        </FieldLabel>
        <FieldLabel label="Soat (semestr)">
          <TextInput type="number" min={15} max={300} value={f.hours} onChange={(e) => setF({ ...f, hours: Number(e.target.value) || 15 })} />
        </FieldLabel>
      </div>
      <FieldLabel label="O'qituvchi">
        <SelectBox value={f.teacherId} onChange={(e) => setF({ ...f, teacherId: e.target.value })}>
          <option value="">— tanlang —</option>
          {active.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} · {t.load} soat/hafta · {t.subjects.length} fan
            </option>
          ))}
        </SelectBox>
      </FieldLabel>
      {active.length === 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-amber-600">
          Tizimda o'qituvchi akkaunti yo'q.
          <button type="button" className="font-medium underline" onClick={() => nav("/members")}>
            Foydalanuvchilar bo'limida qo'shing
          </button>
        </div>
      )}
      {subject && subject.teacherAccount !== "active" && <div className="text-xs text-ts-sub">Hozirgi o'qituvchi: {subject.teacherName} ({subject.teacherAccount === "none" ? "tizim akkaunti yo'q" : "akkaunt to'xtatilgan"})</div>}
      {changingTeacher && <ScopeNote>Fanning barcha darslari yangi o'qituvchiga o'tadi: davomat va baholash huquqi ham u bilan birga ko'chadi. Avval kiritilgan baholar saqlanib qoladi.</ScopeNote>}
      <div>
        <div className="mb-1.5 text-xs font-medium text-ts-sub">Guruhlar</div>
        <div className="flex flex-wrap gap-1.5">
          {groups.map((g) => {
            const on = f.groups.includes(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => setF({ ...f, groups: on ? f.groups.filter((x) => x !== g) : [...f.groups, g] })}
                className={on ? "rounded-md bg-ts-inv px-2.5 py-1 text-xs font-medium text-ts-invfg" : "rounded-md border border-ts-line2 px-2.5 py-1 text-xs text-ts-sub hover:bg-ts-hover"}
              >
                {g}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
