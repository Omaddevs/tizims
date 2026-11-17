import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileSpreadsheet, GraduationCap, Plus, UserCheck, Users, UserX } from "lucide-react";
import { Avatar, Btn, Card, Empty, FieldLabel, Modal, Page, Pill, Progress, QueryState, ScopeNote, SearchBox, SelectBox, Stat, Table, Tabs, Td, TextInput, useToast, type Tone } from "../../components/kit";
import { api, errorText, useApi } from "../../lib/api";
import { GROUPS, STUDENT_STATUS_LABEL, riskOf, subjectByCode, type Student, type StudentStatus } from "../../data/academic";
import { MAX_LOAD, type TeacherRow } from "../../lib/subjects";
import { useScope } from "./scope";
import { StudentImportModal } from "./StudentImport";

const STATUS_TONE: Record<StudentStatus, Tone> = { active: "green", leave: "amber", expelled: "red", graduated: "gray" };

export function PeoplePage() {
  const s = useScope("people");
  const [toast, showToast] = useToast();
  const [tab, setTab] = useState<"students" | "teachers">("students");
  const sq = useApi<Student[]>("/edu/students");
  const students = sq.data ?? [];
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("all");
  const nav = useNavigate();
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);

  const groups = GROUPS.filter((g) => !s.facultyGroups || s.facultyGroups.includes(g.id));
  const scoped = students; // doira (dekan → o'z fakulteti) serverda
  const list = scoped.filter((st) => (group === "all" || st.group === group) && (st.name + st.id).toLowerCase().includes(q.toLowerCase()));
  const tq = useApi<TeacherRow[]>("/edu/teachers");
  const allTeachers = tq.data ?? [];
  const teachers = allTeachers.filter((t) => `${t.name} ${t.email} ${t.department ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <Page
      title={s.title}
      subtitle={s.description}
      actions={
        s.isManage && tab === "students" ? (
          <>
            <Btn onClick={() => setImporting(true)}>
              <FileSpreadsheet className="h-4 w-4" /> Excel'dan yuklash
            </Btn>
            <Btn variant="primary" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Talaba qo'shish
            </Btn>
          </>
        ) : undefined
      }
    >
      {s.facultyGroups && <ScopeNote>Faqat o'z fakultetingiz (Axborot texnologiyalari) talabalari ko'rsatilmoqda.</ScopeNote>}
      {s.access === "view" && <ScopeNote>Ko'rish rejimi — talaba ma'lumotlarini o'zgartirish huquqi yo'q.</ScopeNote>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Talabalar" value={scoped.length} hint={`${groups.length} ta guruh`} icon={Users} />
        <Stat label="Faol" value={scoped.filter((x) => x.status === "active").length} icon={UserCheck} />
        <Stat label="Akademik ta'til / chetlashgan" value={`${scoped.filter((x) => x.status === "leave").length} / ${scoped.filter((x) => x.status === "expelled").length}`} icon={UserX} />
        <Stat label="O'qituvchilar" value={allTeachers.length} hint={`${allTeachers.filter((t) => t.account === "active").length} tasida tizim akkaunti bor`} icon={GraduationCap} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "students", label: "Talabalar", count: scoped.length },
            { key: "teachers", label: "O'qituvchilar", count: allTeachers.length },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          {tab === "students" && (
            <SelectBox className="h-8 w-auto" value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="all">Barcha guruhlar</option>
              {groups.map((g) => (
                <option key={g.id}>{g.id}</option>
              ))}
            </SelectBox>
          )}
          <SearchBox value={q} onChange={setQ} placeholder={tab === "students" ? "Ism yoki ID..." : "Ism yoki kafedra..."} className="w-60" />
        </div>
      </div>

      <QueryState error={sq.error} loading={sq.loading && !sq.data} onRetry={sq.reload}>
      <Card className="overflow-hidden">
        {tab === "students" ? (
          list.length === 0 ? (
            <Empty text="Talaba topilmadi" />
          ) : (
            <Table head={["Talaba", "ID", "Guruh", "Ta'lim shakli", "GPA", "Davomat", "Xavf", "Holat"]} minWidth={900}>
              {list.map((st) => {
                const r = riskOf(st);
                return (
                  <tr key={st.id} onClick={() => nav(`/people/${st.id}`)} className="cursor-pointer transition hover:bg-ts-hover">
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={st.name} size={28} />
                        <span className="font-medium">{st.name}</span>
                      </div>
                    </Td>
                    <Td className="text-ts-sub">{st.id}</Td>
                    <Td>{st.group}</Td>
                    <Td className="text-ts-sub">{st.funding}</Td>
                    <Td className="tabular-nums">{st.gpa.toFixed(2)}</Td>
                    <Td className="tabular-nums">{st.attendance}%</Td>
                    <Td>
                      <Pill tone={r === "high" ? "red" : r === "medium" ? "amber" : "green"}>{r === "high" ? "Yuqori" : r === "medium" ? "O'rta" : "Past"}</Pill>
                    </Td>
                    <Td>
                      <Pill tone={STATUS_TONE[st.status]} dot>
                        {STUDENT_STATUS_LABEL[st.status]}
                      </Pill>
                    </Td>
                  </tr>
                );
              })}
            </Table>
          )
        ) : (
          <Table head={["O'qituvchi", "Tizim akkaunti", "Fanlar", "Haftalik yuklama"]} minWidth={760}>
            {teachers.map((t) => {
              const pct = Math.round((t.load / MAX_LOAD) * 100);
              return (
                <tr key={t.id}>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={t.name} size={28} />
                      <div>
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-ts-sub">
                          {t.email}
                          {t.department && ` · ${t.department}`}
                        </div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    {t.account === "active" ? (
                      <Pill tone="green" dot>
                        Faol
                      </Pill>
                    ) : t.account === "suspended" ? (
                      <Pill tone="red" dot>
                        To'xtatilgan
                      </Pill>
                    ) : (
                      <Pill tone="amber" dot>
                        Akkaunt yo'q
                      </Pill>
                    )}
                  </Td>
                  <Td className="max-w-[260px] truncate text-ts-sub">{t.subjects.map((c) => subjectByCode(c)?.name ?? c).join(", ") || "—"}</Td>
                  <Td className="w-44">
                    <div className="flex items-center gap-2">
                      <Progress value={pct} tone={pct > 100 ? "red" : pct > 90 ? "amber" : "green"} />
                      <span className="w-14 text-xs tabular-nums text-ts-sub">
                        {t.load}/{MAX_LOAD} soat
                      </span>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
      </QueryState>

      <AddStudent
        open={adding}
        groups={groups.map((g) => g.id)}
        onClose={() => setAdding(false)}
        onSave={async (f) => {
          try {
            const st = await api<Student>("/edu/students", { body: f });
            sq.setData([st, ...students]);
            setAdding(false);
            showToast(`${st.name} qo'shildi (${st.id})`);
            return true;
          } catch (e) {
            showToast(errorText(e));
            return false;
          }
        }}
      />
      <StudentImportModal
        open={importing}
        onClose={() => setImporting(false)}
        onDone={(n) => {
          void sq.reload();
          if (n) showToast(`${n} ta talaba qo'shildi`);
        }}
      />
      {toast}
    </Page>
  );
}

type NewStudent = { name: string; group: string; funding: Student["funding"]; phone: string; parent: string };

function AddStudent({ open, groups, onClose, onSave }: { open: boolean; groups: string[]; onClose: () => void; onSave: (s: NewStudent) => Promise<boolean> }) {
  const [f, setF] = useState({ name: "", group: "", funding: "Kontrakt" as Student["funding"], phone: "", parent: "" });
  const group = f.group || groups[0] || "";
  const ok = f.name.trim().split(/\s+/).length >= 2 && f.phone.trim();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Talaba qo'shish"
      footer={
        <>
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn
            variant="primary"
            disabled={!ok}
            onClick={async () => {
              if (await onSave({ name: f.name.trim(), group, funding: f.funding, phone: f.phone.trim(), parent: f.parent.trim() })) setF({ name: "", group: "", funding: "Kontrakt", phone: "", parent: "" });
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
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Guruh">
          <SelectBox value={group} onChange={(e) => setF({ ...f, group: e.target.value })}>
            {groups.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </SelectBox>
        </FieldLabel>
        <FieldLabel label="Ta'lim shakli">
          <SelectBox value={f.funding} onChange={(e) => setF({ ...f, funding: e.target.value as Student["funding"] })}>
            <option>Grant</option>
            <option>Kontrakt</option>
          </SelectBox>
        </FieldLabel>
      </div>
      <FieldLabel label="Telefon">
        <TextInput value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+998 90 000 00 00" />
      </FieldLabel>
      <FieldLabel label="Ota-ona (ixtiyoriy)">
        <TextInput value={f.parent} onChange={(e) => setF({ ...f, parent: e.target.value })} placeholder="Ota-ona ismi — kabinetga taklif yuboriladi" />
      </FieldLabel>
    </Modal>
  );
}
