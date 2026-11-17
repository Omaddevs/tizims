import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building, Building2, ChevronRight, GitBranch, Landmark, Plus, Users } from "lucide-react";
import { Btn, Card, CardHead, FieldLabel, Modal, Page, Pill, QueryState, ScopeNote, SelectBox, Stat, TextInput, useToast } from "../../components/kit";
import { api, errorText, useApi } from "../../lib/api";
import { cn } from "../../lib/utils";
import { useApp } from "../../store/AppContext";
import { ADMIN_UNITS, BRANCHES, type Faculty } from "../../data/academic";
import { useScope } from "./scope";

export function StructurePage() {
  const s = useScope("structure");
  const nav = useNavigate();
  const { organization } = useApp();
  const [toast, showToast] = useToast();
  const q = useApi<Faculty[]>("/edu/faculties");
  const faculties = q.data ?? [];
  const [open, setOpen] = useState<Record<string, boolean>>({ "f-it": true });
  const [adding, setAdding] = useState(false);

  const deps = faculties.flatMap((f) => f.departments);
  const teachers = deps.reduce((a, d) => a + d.teachers, 0);
  // Talabalar soni — bazadagi faol talabalardan (server hisoblaydi)
  const students = faculties.reduce((a, f) => a + ((f as Faculty & { liveStudents?: number }).liveStudents ?? 0), 0);

  return (
    <Page
      title={s.title}
      subtitle={s.description}
      actions={
        s.isManage ? (
          <Btn variant="primary" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Kafedra qo'shish
          </Btn>
        ) : undefined
      }
    >
      {s.facultyId && <ScopeNote>Ko'rish rejimi. Sizning fakultetingiz belgilangan.</ScopeNote>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Filiallar" value={BRANCHES.length} icon={Building} />
        <Stat label="Fakultetlar" value={faculties.length} icon={Landmark} />
        <Stat label="Kafedralar" value={deps.length} icon={GitBranch} />
        <Stat label="O'qituvchi / talaba" value={`${teachers} / ${students.toLocaleString("ru-RU")}`} hint="Faol talabalar" icon={Users} />
      </div>

      <QueryState error={q.error} loading={q.loading && !q.data} onRetry={q.reload}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHead title={organization?.name ?? "Tashkilot"} desc="Ierarxiya: filial → fakultet → kafedra" />
          <div className="space-y-4 p-4">
            {BRANCHES.map((b) => (
              <div key={b.id}>
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-ts-sub" />
                  <span className="font-medium">{b.name}</span>
                  <span className="text-xs text-ts-muted">· {b.address}</span>
                </div>
                <div className="ml-2 space-y-2 border-l border-ts-line pl-4">
                  {faculties
                    .filter((f) => f.branch === b.id)
                    .map((f) => {
                      const isOpen = open[f.id];
                      const mine = s.facultyId === f.id;
                      return (
                        <div key={f.id} className={cn("rounded-md border", mine ? "border-ts-blue" : "border-ts-line")}>
                          <button type="button" onClick={() => setOpen((o) => ({ ...o, [f.id]: !o[f.id] }))} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
                            <ChevronRight className={cn("h-4 w-4 shrink-0 text-ts-muted transition", isOpen && "rotate-90")} />
                            <Landmark className="h-4 w-4 shrink-0" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{f.name}</span>
                              <span className="block text-xs text-ts-sub">
                                Dekan: {f.dean} · {(f as Faculty & { liveStudents?: number }).liveStudents ?? 0} faol talaba
                              </span>
                            </span>
                            {mine && <Pill tone="blue">Sizning fakultet</Pill>}
                            <span className="text-xs text-ts-muted">{f.departments.length} kafedra</span>
                          </button>
                          <div className="flex justify-end px-3 pb-2">
                            <Btn size="sm" variant="ghost" onClick={() => nav(`/structure/${f.id}`)}>
                              Fakultet sahifasi <ChevronRight className="h-3.5 w-3.5" />
                            </Btn>
                          </div>
                          {isOpen && (
                            <div className="grid gap-2 border-t border-ts-line p-3 sm:grid-cols-2">
                              {f.departments.map((d) => (
                                <div key={d.id} className="rounded-md bg-ts-tile p-3">
                                  <div className="flex items-center gap-2 font-medium">
                                    <GitBranch className="h-3.5 w-3.5 text-ts-sub" />
                                    {d.name}
                                  </div>
                                  <div className="mt-1 text-xs text-ts-sub">Mudir: {d.head}</div>
                                  <div className="mt-2 flex gap-3 text-xs text-ts-sub">
                                    <span>{d.teachers} o'qituvchi</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHead title="Ma'muriy bo'limlar" desc="Fakultetlardan tashqari bo'linmalar" />
          <div className="space-y-2 p-4">
            {ADMIN_UNITS.map((u) => (
              <div key={u.name} className="rounded-md border border-ts-line p-3">
                <div className="font-medium">{u.name}</div>
                <div className="mt-0.5 flex justify-between text-xs text-ts-sub">
                  <span>{u.head}</span>
                  <span>{u.staff} xodim</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      </QueryState>

      <AddDepartment
        open={adding}
        faculties={faculties}
        onClose={() => setAdding(false)}
        onSave={async (facultyId, name, head) => {
          try {
            const next = await api<Faculty>(`/edu/faculties/${facultyId}/departments`, { body: { name, head } });
            q.setData(faculties.map((f) => (f.id === facultyId ? next : f)));
            setOpen((o) => ({ ...o, [facultyId]: true }));
            setAdding(false);
            showToast(`"${name}" qo'shildi`);
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

function AddDepartment({ open, faculties, onClose, onSave }: { open: boolean; faculties: Faculty[]; onClose: () => void; onSave: (facultyId: string, name: string, head: string) => Promise<boolean> }) {
  const [f, setF] = useState({ faculty: "", name: "", head: "" });
  const faculty = f.faculty || faculties[0]?.id || "";
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Kafedra qo'shish"
      footer={
        <>
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn
            variant="primary"
            disabled={!f.name.trim() || !f.head.trim()}
            onClick={async () => {
              if (await onSave(faculty, f.name.trim(), f.head.trim())) setF({ ...f, name: "", head: "" });
            }}
          >
            Qo'shish
          </Btn>
        </>
      }
    >
      <FieldLabel label="Fakultet">
        <SelectBox value={faculty} onChange={(e) => setF({ ...f, faculty: e.target.value })}>
          {faculties.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </SelectBox>
      </FieldLabel>
      <FieldLabel label="Kafedra nomi">
        <TextInput value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Masalan: Kiberxavfsizlik kafedrasi" />
      </FieldLabel>
      <FieldLabel label="Kafedra mudiri">
        <TextInput value={f.head} onChange={(e) => setF({ ...f, head: e.target.value })} placeholder="F.I.Sh." />
      </FieldLabel>
    </Modal>
  );
}
