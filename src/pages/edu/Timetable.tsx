import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRightLeft, CalendarDays, CheckCircle2, Clock, DoorOpen, MapPin, Plus, Trash2, Users } from "lucide-react";
import { Btn, Card, CardHead, Empty, FieldLabel, Modal, Page, Pill, Progress, QueryState, ScopeNote, SelectBox, Stat, Table, Tabs, Td, useToast } from "../../components/kit";
import { api, errorText, useApi } from "../../lib/api";
import { MAX_LOAD, useSubjects, type TeacherRow } from "../../lib/subjects";
import { cn } from "../../lib/utils";
import { DAYS, DAYS_SHORT, GROUPS, ROOMS, SLOTS, findConflicts, subjectByCode, teacherName, type Lesson } from "../../data/academic";
import { useScope } from "./scope";

type View = "week" | "rooms" | "conflicts" | "load";
type FilterKind = "group" | "teacher" | "room";

const TYPE_TONE: Record<Lesson["type"], string> = {
  "Ma'ruza": "border-l-blue-500",
  Amaliy: "border-l-emerald-500",
  Laboratoriya: "border-l-violet-500",
  Seminar: "border-l-amber-500",
};

/** Bugungi kun indeksi (Du=0 … Sh=5); yakshanba bo'lsa dushanbani ko'rsatamiz. */
function todayIndex() {
  const d = new Date().getDay();
  return d === 0 ? 0 : d - 1;
}

export function TimetablePage() {
  const s = useScope("timetable");
  const [toast, showToast] = useToast();
  const q = useApi<Lesson[]>("/edu/lessons");
  const lessons = useMemo(() => q.data ?? [], [q.data]);
  const [view, setView] = useState<View>("week");
  const [kind, setKind] = useState<FilterKind>("group");
  const [target, setTarget] = useState<string>(s.facultyGroups?.[0] ?? "IT-21");
  const [editor, setEditor] = useState<Editor | null>(null);
  const today = todayIndex();

  const scoped = useMemo(() => {
    if (s.isTeacher) return lessons.filter((l) => l.teacherId === s.user?.id);
    if (s.studentGroup) return lessons.filter((l) => l.group === s.studentGroup);
    if (kind === "group") return lessons.filter((l) => l.group === target);
    if (kind === "teacher") return lessons.filter((l) => l.teacherId === target);
    return lessons.filter((l) => l.room === target);
  }, [lessons, s.isTeacher, s.studentGroup, s.user?.id, kind, target]);

  const conflicts = useMemo(() => findConflicts(lessons), [lessons]);
  const teachersQ = useApi<TeacherRow[]>(!s.isOwn && view === "load" ? "/edu/teachers" : null);
  const todays = scoped.filter((l) => l.day === today).sort((a, b) => a.slot - b.slot);
  const canSeeOps = !s.isOwn; // admin, dekan, maslahatchi
  const canMove = s.isManage;

  const tabs: { key: View; label: string; count?: number }[] = [{ key: "week", label: "Haftalik jadval" }];
  if (canSeeOps) tabs.push({ key: "rooms", label: "Xonalar bandligi" }, { key: "conflicts", label: "To'qnashuvlar", count: conflicts.length }, { key: "load", label: "O'qituvchi yuklamasi" });

  const options =
    kind === "group"
      ? GROUPS.filter((g) => !s.facultyGroups || s.facultyGroups.includes(g.id)).map((g) => ({ v: g.id, l: g.id }))
      : kind === "teacher"
        ? Array.from(new Set(lessons.map((l) => l.teacherId))).map((id) => ({ v: id, l: teacherName(id) })).sort((a, b) => a.l.localeCompare(b.l))
        : ROOMS.map((r) => ({ v: r.id, l: r.id }));

  /** Yangi dars uchun joriy filtrdan oldindan to'ldirish */
  const openNew = (day: number, slot: number) =>
    setEditor({ mode: "new", day, slot, group: kind === "group" ? target : undefined, room: kind === "room" ? target : undefined, teacherId: kind === "teacher" ? target : undefined });

  function onSaved(l: Lesson, mode: "new" | "edit") {
    q.setData(mode === "new" ? [...lessons, l] : lessons.map((x) => (x.id === l.id ? l : x)));
    setEditor(null);
    showToast(mode === "new" ? "Dars qo'shildi · o'qituvchi va guruhga xabar yuborildi" : "Dars yangilandi · o'qituvchi va guruhga xabar yuborildi");
  }

  function onDeleted(id: string) {
    q.setData(lessons.filter((x) => x.id !== id));
    setEditor(null);
    showToast("Dars jadvaldan olib tashlandi");
  }

  return (
    <Page
      title={s.title}
      subtitle={s.description}
      actions={
        canMove ? (
          <Btn variant="primary" onClick={() => openNew(today, 0)}>
            <Plus className="h-4 w-4" /> Dars qo'shish
          </Btn>
        ) : undefined
      }
    >
      {s.isTeacher && <ScopeNote>Siz faqat o'zingiz dars beradigan guruhlar jadvalini ko'rasiz.</ScopeNote>}
      {s.studentGroup && <ScopeNote>{s.isParent ? `Farzandingiz (${s.me?.name}) — ${s.studentGroup} guruhi jadvali.` : `${s.studentGroup} guruhi jadvali.`}</ScopeNote>}

      <QueryState error={q.error} loading={q.loading && !q.data} onRetry={q.reload}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Bugungi darslar" value={todays.length} hint={DAYS[today]} icon={CalendarDays} />
        <Stat label="Haftalik darslar" value={scoped.length} hint={`${scoped.length * 2} akademik soat`} icon={Clock} />
        {canSeeOps ? (
          <>
            <Stat label="Band xonalar" value={`${ROOMS.filter((r) => r.status === "busy").length}/${ROOMS.length}`} hint="Hozirgi holat" icon={DoorOpen} />
            <Stat label="To'qnashuvlar" value={conflicts.length} delta={conflicts.length ? "Diqqat" : "Yo'q"} tone={conflicts.length ? "red" : "green"} hint="Xona yoki o'qituvchi bo'yicha" icon={AlertTriangle} />
          </>
        ) : (
          <>
            <Stat label="Keyingi dars" value={todays[0] ? SLOTS[todays[0].slot].slice(0, 5) : "—"} hint={todays[0] ? subjectByCode(todays[0].subject)?.name : "Bugun dars yo'q"} icon={Clock} />
            <Stat label="Xona" value={todays[0]?.room ?? "—"} hint={todays[0]?.type} icon={MapPin} />
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={tabs} value={view} onChange={setView} />
        {view === "week" && !s.isOwn && (
          <div className="flex flex-wrap items-center gap-2">
            <SelectBox
              className="h-8 w-auto"
              value={kind}
              onChange={(e) => {
                const k = e.target.value as FilterKind;
                setKind(k);
                setTarget(k === "group" ? (s.facultyGroups?.[0] ?? "IT-21") : k === "teacher" ? (lessons[0]?.teacherId ?? "") : ROOMS[0].id);
              }}
            >
              <option value="group">Guruh</option>
              <option value="teacher">O'qituvchi</option>
              <option value="room">Xona</option>
            </SelectBox>
            <SelectBox className="h-8 w-auto min-w-[140px]" value={target} onChange={(e) => setTarget(e.target.value)}>
              {options.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </SelectBox>
          </div>
        )}
      </div>

      {view === "week" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <div className="grid min-w-[860px]" style={{ gridTemplateColumns: "92px repeat(6, minmax(0, 1fr))" }}>
                <div className="border-b border-ts-line bg-ts-tile" />
                {DAYS_SHORT.map((d, i) => (
                  <div key={d} className={cn("border-b border-l border-ts-line bg-ts-tile px-3 py-2.5 text-sm font-medium", i === today && "text-ts-blue")}>
                    {DAYS[i]}
                    {i === today && <span className="ml-1.5 text-xs font-normal">· bugun</span>}
                  </div>
                ))}
                {SLOTS.map((slot, si) => (
                  <Row key={slot} slot={slot} si={si} lessons={scoped} today={today} showGroup={!s.studentGroup} showTeacher={!s.isTeacher} canMove={canMove} onOpen={(l) => setEditor({ mode: "edit", lesson: l })} onAdd={openNew} />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 border-t border-ts-line px-4 py-2.5 text-xs text-ts-sub">
              {Object.keys(TYPE_TONE).map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <span className={cn("h-3 w-1 rounded-sm border-l-4", TYPE_TONE[t as Lesson["type"]])} />
                  {t}
                </span>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead title="Bugun" desc={DAYS[today]} />
            <div className="space-y-2 p-4">
              {todays.length === 0 && <Empty text="Bugun dars yo'q" />}
              {todays.map((l) => (
                <div key={l.id} className={cn("rounded-md border border-l-4 border-ts-line bg-ts-tile p-3", TYPE_TONE[l.type])}>
                  <div className="flex items-center justify-between text-xs text-ts-sub">
                    <span>{SLOTS[l.slot]}</span>
                    <span>{l.type}</span>
                  </div>
                  <div className="mt-1 font-medium">{subjectByCode(l.subject)?.name}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-ts-sub">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {l.room}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {s.isTeacher ? l.group : teacherName(l.teacherId)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {view === "rooms" && <RoomsView lessons={lessons} today={today} />}

      {view === "conflicts" && (
        <Card>
          <CardHead title="Aniqlangan to'qnashuvlar" desc="Bir vaqtda bir xonada yoki bir o'qituvchida ikki dars" />
          <div className="space-y-2 p-4">
            {conflicts.length === 0 && <Empty text="To'qnashuv yo'q — jadval toza" />}
            {conflicts.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3 rounded-md border border-red-500/30 bg-red-500/5 p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{c.reason}</div>
                  <div className="text-xs text-ts-sub">
                    {DAYS[c.a.day]}, {SLOTS[c.a.slot]} · {c.a.group} ({subjectByCode(c.a.subject)?.name}) va {c.b.group} ({subjectByCode(c.b.subject)?.name})
                  </div>
                </div>
                {canMove ? (
                  <Btn size="sm" onClick={() => setEditor({ mode: "edit", lesson: c.b })}>
                    <ArrowRightLeft className="h-3.5 w-3.5" /> Hal qilish
                  </Btn>
                ) : (
                  <Pill tone="amber">Nazoratchiga yuborilgan</Pill>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {view === "load" && (
        <Card className="overflow-hidden">
          <CardHead title="O'qituvchilar yuklamasi" desc="Haftalik soat va me'yor" className="pb-4" />
          <Table head={["O'qituvchi", "Fanlar", "Haftalik yuklama", "", "Holat"]}>
            {(teachersQ.data ?? [])
              .slice()
              .sort((x, y) => y.load - x.load)
              .map((t) => {
                const pct = Math.round((t.load / MAX_LOAD) * 100);
                return (
                  <tr key={t.id}>
                    <Td className="font-medium">
                      {t.name}
                      {t.account === "none" && <span className="ml-1.5 text-xs font-normal text-amber-600">· akkaunt yo'q</span>}
                    </Td>
                    <Td className="text-ts-sub">{t.subjects.length} ta fan</Td>
                    <Td className="tabular-nums">
                      {t.load}/{MAX_LOAD} soat
                    </Td>
                    <Td className="w-40">
                      <Progress value={pct} tone={pct > 100 ? "red" : pct > 90 ? "amber" : "green"} />
                    </Td>
                    <Td>{pct > 100 ? <Pill tone="red">Me'yordan oshgan</Pill> : pct > 90 ? <Pill tone="amber">To'la</Pill> : t.load === 0 ? <Pill>Dars yo'q</Pill> : <Pill tone="green">Normal</Pill>}</Td>
                  </tr>
                );
              })}
          </Table>
        </Card>
      )}

      </QueryState>
      {editor && <LessonModal editor={editor} onClose={() => setEditor(null)} onSaved={onSaved} onDeleted={onDeleted} />}
      {toast}
    </Page>
  );
}

function Row({
  slot,
  si,
  lessons,
  today,
  showGroup,
  showTeacher,
  canMove,
  onOpen,
  onAdd,
}: {
  slot: string;
  si: number;
  lessons: Lesson[];
  today: number;
  showGroup: boolean;
  showTeacher: boolean;
  canMove: boolean;
  onOpen: (l: Lesson) => void;
  onAdd: (day: number, slot: number) => void;
}) {
  return (
    <>
      <div className="border-b border-ts-line px-3 py-3 text-xs text-ts-sub last:border-0">
        <div className="font-medium text-ts-fg">{si + 1}-juftlik</div>
        {slot}
      </div>
      {DAYS.map((_, di) => {
        const items = lessons.filter((l) => l.day === di && l.slot === si);
        return (
          <div key={di} className={cn("group/cell min-h-[84px] space-y-1.5 border-b border-l border-ts-line p-1.5", di === today && "bg-blue-500/[0.03]")}>
            {items.map((l) => (
              <button
                key={l.id}
                type="button"
                disabled={!canMove}
                onClick={() => onOpen(l)}
                title={canMove ? "Tahrirlash" : undefined}
                className={cn("block w-full rounded-md border border-l-4 border-ts-line bg-ts-card px-2 py-1.5 text-left transition", TYPE_TONE[l.type], canMove && "hover:bg-ts-hover")}
              >
                <div className="truncate text-xs font-medium">{subjectByCode(l.subject)?.name}</div>
                <div className="mt-0.5 truncate text-[11px] text-ts-sub">
                  {l.room}
                  {showGroup && ` · ${l.group}`}
                </div>
                {showTeacher && <div className="truncate text-[11px] text-ts-muted">{teacherName(l.teacherId)}</div>}
              </button>
            ))}
            {canMove && (
              <button
                type="button"
                onClick={() => onAdd(di, si)}
                className={cn(
                  "flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-ts-line2 text-[11px] text-ts-muted transition hover:border-ts-sub hover:text-ts-fg",
                  items.length ? "h-6 opacity-0 group-hover/cell:opacity-100" : "h-[68px] opacity-0 group-hover/cell:opacity-100",
                )}
              >
                <Plus className="h-3 w-3" /> Dars
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}

function RoomsView({ lessons, today }: { lessons: Lesson[]; today: number }) {
  return (
    <Card className="overflow-hidden">
      <CardHead title="Xonalar bandligi" desc={`${DAYS[today]} — juftliklar bo'yicha`} className="pb-4" />
      <Table head={["Xona", "Turi", "Sig'im", ...SLOTS.map((_, i) => `${i + 1}`), "Holat"]} minWidth={760}>
        {ROOMS.map((r) => (
          <tr key={r.id}>
            <Td className="font-medium">{r.id}</Td>
            <Td className="text-ts-sub">{r.type}</Td>
            <Td className="tabular-nums text-ts-sub">{r.capacity}</Td>
            {SLOTS.map((_, si) => {
              const l = lessons.find((x) => x.room === r.id && x.day === today && x.slot === si);
              return (
                <Td key={si} className="px-1.5">
                  <div
                    title={l ? `${l.group} · ${subjectByCode(l.subject)?.name}` : "Bo'sh"}
                    className={cn("flex h-7 items-center justify-center rounded text-[11px] font-medium", r.status === "repair" ? "ts-stripes bg-ts-chip text-ts-muted" : l ? "bg-blue-500/15 text-blue-600 dark:text-blue-400" : "bg-ts-tile text-ts-muted")}
                  >
                    {r.status === "repair" ? "" : (l?.group ?? "—")}
                  </div>
                </Td>
              );
            })}
            <Td>{r.status === "repair" ? <Pill tone="amber" dot>Ta'mirda</Pill> : r.status === "busy" ? <Pill tone="blue" dot>Band</Pill> : <Pill tone="green" dot>Bo'sh</Pill>}</Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

type Editor =
  | { mode: "new"; day: number; slot: number; group?: string; room?: string; teacherId?: string }
  | { mode: "edit"; lesson: Lesson };

type Availability = { rooms: { id: string; type: string; capacity: number; status: "free" | "busy" | "repair" }[]; busyTeachers: string[]; busyGroups: string[] };

const LESSON_TYPES: Lesson["type"][] = ["Ma'ruza", "Amaliy", "Laboratoriya", "Seminar"];

/** Dars qo'shish / tahrirlash: band xona, o'qituvchi va guruh oldindan ko'rsatiladi; yakuniy tekshiruv serverda */
function LessonModal({ editor, onClose, onSaved, onDeleted }: { editor: Editor; onClose: () => void; onSaved: (l: Lesson, mode: "new" | "edit") => void; onDeleted: (id: string) => void }) {
  const { list: catalog } = useSubjects();
  const editing = editor.mode === "edit" ? editor.lesson : null;
  const defaultSubject = editing?.subject ?? catalog.find((x) => (editor.mode === "new" && editor.group ? x.groups.includes(editor.group) : true) && (editor.mode === "new" && editor.teacherId ? x.teacherId === editor.teacherId : true))?.code ?? "";
  const [f, setF] = useState({
    subject: defaultSubject,
    group: editing?.group ?? (editor.mode === "new" ? (editor.group ?? "") : ""),
    day: editing?.day ?? (editor.mode === "new" ? editor.day : 0),
    slot: editing?.slot ?? (editor.mode === "new" ? editor.slot : 0),
    room: editing?.room ?? (editor.mode === "new" ? (editor.room ?? "") : ""),
    type: editing?.type ?? ("Ma'ruza" as Lesson["type"]),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const av = useApi<Availability>(`/edu/lessons/availability?day=${f.day}&slot=${f.slot}${editing ? `&except=${editing.id}` : ""}`);

  const subject = catalog.find((x) => x.code === f.subject);
  const groupOptions = subject?.groups ?? [];
  const group = groupOptions.includes(f.group) ? f.group : (groupOptions[0] ?? "");
  const teacherId = editing?.teacherId ?? subject?.teacherId ?? "";
  const rooms = av.data?.rooms ?? [];
  const room = f.room || rooms.find((r) => r.status === "free")?.id || "";
  const roomState = rooms.find((r) => r.id === room)?.status;
  const teacherBusy = !!teacherId && !!av.data?.busyTeachers.includes(teacherId);
  const groupBusy = !!group && !!av.data?.busyGroups.includes(group);
  const problems = [roomState === "busy" ? `${room} xonasi bu vaqtda band` : null, roomState === "repair" ? `${room} ta'mirda` : null, teacherBusy ? `${teacherName(teacherId)} bu vaqtda boshqa darsda` : null, groupBusy ? `${group} guruhining bu vaqtda darsi bor` : null].filter(Boolean) as string[];
  const unchanged = !!editing && editing.day === f.day && editing.slot === f.slot && editing.room === room && editing.type === f.type;
  const ok = !!subject && !!group && !!room && problems.length === 0 && !unchanged;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const l = editing
        ? await api<Lesson>(`/edu/lessons/${editing.id}`, { method: "PATCH", body: { day: f.day, slot: f.slot, room, type: f.type } })
        : await api<Lesson>("/edu/lessons", { body: { subject: f.subject, group, day: f.day, slot: f.slot, room, type: f.type } });
      onSaved(l, editing ? "edit" : "new");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing || !window.confirm("Dars jadvaldan olib tashlansinmi? Belgilangan davomat tarixi saqlanib qoladi.")) return;
    setSaving(true);
    try {
      await api(`/edu/lessons/${editing.id}`, { method: "DELETE" });
      onDeleted(editing.id);
    } catch (e) {
      setError(errorText(e));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? `${subjectByCode(editing.subject)?.name ?? editing.subject} · ${editing.group}` : "Dars qo'shish"}
      footer={
        <>
          {editing && (
            <Btn variant="danger" className="mr-auto" disabled={saving} onClick={remove}>
              <Trash2 className="h-4 w-4" /> O'chirish
            </Btn>
          )}
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn variant="primary" disabled={!ok || saving} onClick={save}>
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </Btn>
        </>
      }
    >
      {!editing && (
        <div className="grid grid-cols-2 gap-3">
          <FieldLabel label="Fan">
            <SelectBox value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })}>
              <option value="">— tanlang —</option>
              {catalog.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.name} · {x.code}
                </option>
              ))}
            </SelectBox>
          </FieldLabel>
          <FieldLabel label="Guruh">
            <SelectBox value={group} onChange={(e) => setF({ ...f, group: e.target.value })} disabled={!subject}>
              {groupOptions.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </SelectBox>
          </FieldLabel>
        </div>
      )}
      {subject && (
        <div className="flex items-center justify-between rounded-md bg-ts-tile px-3 py-2 text-sm">
          <span className="text-ts-sub">O'qituvchi (fandan)</span>
          <span className="font-medium">
            {teacherName(teacherId)}
            {subject.teacherAccount !== "active" && <span className="ml-1.5 text-xs font-normal text-amber-600">· tizim akkaunti yo'q</span>}
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Kun">
          <SelectBox value={f.day} onChange={(e) => setF({ ...f, day: Number(e.target.value), room: "" })}>
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </SelectBox>
        </FieldLabel>
        <FieldLabel label="Juftlik">
          <SelectBox value={f.slot} onChange={(e) => setF({ ...f, slot: Number(e.target.value), room: "" })}>
            {SLOTS.map((sl, i) => (
              <option key={sl} value={i}>
                {i + 1}-juftlik · {sl}
              </option>
            ))}
          </SelectBox>
        </FieldLabel>
        <FieldLabel label="Xona">
          <SelectBox value={room} onChange={(e) => setF({ ...f, room: e.target.value })}>
            {rooms.map((r) => (
              <option key={r.id} value={r.id} disabled={r.status !== "free" && r.id !== editing?.room}>
                {r.id} — {r.type}, {r.capacity} o'rin{r.status === "busy" ? " (band)" : r.status === "repair" ? " (ta'mirda)" : ""}
              </option>
            ))}
          </SelectBox>
        </FieldLabel>
        <FieldLabel label="Dars turi">
          <SelectBox value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Lesson["type"] })}>
            {LESSON_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </SelectBox>
        </FieldLabel>
      </div>
      {problems.length > 0 && (
        <div className="space-y-1 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {problems.map((p) => (
            <div key={p} className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {p}
            </div>
          ))}
        </div>
      )}
      {problems.length === 0 && av.data && subject && !unchanged && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> {DAYS[f.day]}, {f.slot + 1}-juftlik — xona, o'qituvchi va guruh bo'sh
        </div>
      )}
      {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>}
      <div className="text-xs text-ts-sub">O'qituvchini almashtirish — "O'quv jarayoni → Fanlar" bo'limida (fanning barcha darslari birga o'tadi).</div>
    </Modal>
  );
}
