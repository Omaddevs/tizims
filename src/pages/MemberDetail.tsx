/** Foydalanuvchi kartasi — akkaunt, rol tarixi, faoliyat, vazifalar va boshqaruv amallari. */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BookOpen, CalendarClock, ClipboardList, GraduationCap, KeyRound, LogIn, UserCheck, UserX } from "lucide-react";
import { useApp } from "../store/AppContext";
import { Avatar, Btn, Card, CardHead, DetailHeader, Empty, KeyValues, Pill, QueryState, ScopeNote, Stat, Tabs, Timeline, fmtDate } from "../components/kit";
import { useToast } from "../components/kit";
import { api, errorText, useApi } from "../lib/api";
import { roleLabel } from "../lib/utils";
import { EditMemberModal, SecretModal, type Member, type MembersData } from "./OwnerPages";

type MemberDetail = {
  member: Member;
  otherOrgs: number;
  student: { id: string; name: string; group: string } | null;
  subjects: { code: string; name: string; groups: string[]; credits: number }[];
  tasks: { open: number; overdue: number; done: number; recent: { id: string; title: string; due: string; priority: string }[] };
  changes: { at: string; by: string; action: string; from: string | null; to: string | null }[];
  activity: { at: string; action: string; object: string; objectId: string; detail: string }[];
};

const ACTION: Record<string, string> = {
  CREATE: "yaratdi",
  UPDATE: "o'zgartirdi",
  DELETE: "o'chirdi",
  SUBMIT: "topshirdi",
  REMIND: "eslatma yubordi",
  SUSPEND: "kirishni to'xtatdi",
  ACTIVATE: "kirishni tikladi",
  RESET_PASSWORD: "parolni tikladi",
  PASSWORD_CHANGE: "parolini o'zgartirdi",
  SUPPORT_ACCESS: "yordam rejimi bo'yicha qaror qildi",
  DATA_REQUEST: "ma'lumot so'rovi",
  PLAN_REQUEST: "tarif so'rovi yubordi",
};

const OBJECT: Record<string, string> = {
  Task: "vazifa",
  Grades: "baholar",
  Attendance: "davomat",
  Complaint: "murojaat",
  Student: "talaba",
  Member: "foydalanuvchi",
  Material: "material",
  Assignment: "topshiriq",
  Lesson: "dars",
  Group: "guruh",
  Department: "kafedra",
  Organization: "tashkilot",
  RolePermissions: "rol ruxsatlari",
  User: "akkaunt",
};

export function MemberDetailPage() {
  const { id = "" } = useParams();
  const { user } = useApp();
  const nav = useNavigate();
  const [toast, showToast] = useToast();
  const q = useApi<MemberDetail>(`/org/members/${encodeURIComponent(id)}`);
  const students = useApi<MembersData>("/org/members/manage");
  const [tab, setTab] = useState<"activity" | "changes">("activity");
  const [editing, setEditing] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const d = q.data;
  const self = d?.member.id === user?.id;
  const isOwner = user?.role === "owner";

  async function patch(body: Partial<Pick<Member, "role" | "status" | "studentId">>, msg: string) {
    try {
      await api(`/org/members/${id}`, { method: "PATCH", body });
      await q.reload();
      showToast(msg);
      setEditing(false);
    } catch (e) {
      showToast(errorText(e));
    }
  }

  async function resetPassword() {
    if (!d || !window.confirm(`${d.member.name} uchun yangi vaqtinchalik parol yaratilsinmi?`)) return;
    try {
      const r = await api<{ tempPassword: string }>(`/org/members/${id}/reset-password`, { method: "POST" });
      setSecret(r.tempPassword);
      void q.reload();
    } catch (e) {
      showToast(errorText(e));
    }
  }

  return (
    <div className="space-y-4 text-ts-fg">
      <QueryState error={q.error} loading={q.loading && !d} onRetry={q.reload}>
        {d && (
          <>
            <DetailHeader
              back="/members"
              backLabel="Foydalanuvchilar"
              media={<Avatar name={d.member.name} size={56} />}
              title={d.member.name}
              subtitle={d.member.email}
              badges={
                <>
                  <Pill tone={d.member.role === "owner" ? "violet" : "blue"}>{roleLabel(d.member.role)}</Pill>
                  {d.member.status !== "active" ? (
                    <Pill tone="red" dot>
                      To'xtatilgan
                    </Pill>
                  ) : d.member.pendingPassword ? (
                    <Pill tone="amber" dot>
                      Parol almashtirilmagan
                    </Pill>
                  ) : (
                    <Pill tone="green" dot>
                      Faol
                    </Pill>
                  )}
                  {self && <Pill>Siz</Pill>}
                  {d.otherOrgs > 0 && <Pill>Yana {d.otherOrgs} tashkilotda</Pill>}
                </>
              }
              actions={
                !self && (d.member.role !== "owner" || isOwner) ? (
                  <>
                    <Btn onClick={() => setEditing(true)}>Rol va bog'lanish</Btn>
                    {!d.member.sharedAccount && d.member.status === "active" && (
                      <Btn onClick={resetPassword}>
                        <KeyRound className="h-4 w-4" /> Parolni tiklash
                      </Btn>
                    )}
                    {d.member.status === "active" ? (
                      <Btn variant="danger" onClick={() => window.confirm(`${d.member.name} tizimga kira olmaydi. Davom etasizmi?`) && void patch({ status: "suspended" }, "Kirish to'xtatildi")}>
                        <UserX className="h-4 w-4" /> To'xtatish
                      </Btn>
                    ) : (
                      <Btn variant="primary" onClick={() => void patch({ status: "active" }, "Kirish tiklandi")}>
                        <UserCheck className="h-4 w-4" /> Tiklash
                      </Btn>
                    )}
                  </>
                ) : undefined
              }
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Oxirgi kirish" value={d.member.lastLoginAt ? d.member.lastLoginAt.slice(5) : "—"} hint={d.member.lastLoginAt ? d.member.lastLoginAt.slice(0, 4) : "Hali kirmagan"} icon={LogIn} />
              <Stat label="Qo'shilgan" value={fmtDate(d.member.joinedAt)} icon={CalendarClock} />
              <Stat label="Ochiq vazifalar" value={d.tasks.open} delta={d.tasks.overdue ? `${d.tasks.overdue} muddati o'tgan` : undefined} tone="red" icon={ClipboardList} />
              <Stat label="Bajarilgan vazifalar" value={d.tasks.done} icon={UserCheck} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
              <div className="space-y-4">
                <Card>
                  <CardHead title="Akkaunt" />
                  <KeyValues
                    items={[
                      ["Ism", d.member.name],
                      ["Email (login)", d.member.email],
                      ["Rol", roleLabel(d.member.role)],
                      ["Holat", d.member.status === "active" ? "Faol" : "To'xtatilgan"],
                      ["Tashkilotga qo'shilgan", fmtDate(d.member.joinedAt)],
                      ["Oxirgi kirish", d.member.lastLoginAt ?? "Hali kirmagan"],
                    ]}
                  />
                </Card>
                {(d.member.role === "student" || d.member.role === "parent") && (
                  <Card>
                    <CardHead title={d.member.role === "parent" ? "Farzandi" : "Talaba yozuvi"} />
                    {d.student ? (
                      <button type="button" onClick={() => nav(`/people/${d.student!.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ts-hover">
                        <GraduationCap className="h-5 w-5 text-ts-sub" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{d.student.name}</span>
                          <span className="block text-xs text-ts-sub">
                            {d.student.id} · {d.student.group}
                          </span>
                        </span>
                      </button>
                    ) : (
                      <Empty text="Talaba yozuviga bog'lanmagan — 'Rol va bog'lanish' orqali bog'lang" />
                    )}
                  </Card>
                )}
                {d.member.role === "teacher" && (
                  <Card>
                    <CardHead
                      title="Biriktirilgan fanlar"
                      desc={d.subjects.length ? `${d.subjects.reduce((a, x) => a + x.credits, 0)} kredit` : undefined}
                      action={
                        <Btn size="sm" variant="ghost" onClick={() => nav("/academic")}>
                          <BookOpen className="h-3.5 w-3.5" /> Fanlarni boshqarish
                        </Btn>
                      }
                    />
                    {d.subjects.length === 0 ? (
                      <div className="m-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                        Fan biriktirilmagan — o'qituvchi tizimga kiradi, lekin baholash jurnali va davomat bo'sh bo'ladi. "O'quv jarayoni → Fanlar" bo'limida biriktiring.
                      </div>
                    ) : (
                      <div className="divide-y divide-ts-line">
                        {d.subjects.map((x) => (
                          <div key={x.code} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{x.name}</span>
                              <span className="block text-xs text-ts-muted">{x.code}</span>
                            </span>
                            <span className="flex flex-wrap gap-1">
                              {x.groups.map((g) => (
                                <Pill key={g}>{g}</Pill>
                              ))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}
                <Card>
                  <CardHead title="Ochiq vazifalari" />
                  {d.tasks.recent.length === 0 ? (
                    <Empty text="Ochiq vazifa yo'q" icon={ClipboardList} />
                  ) : (
                    <div className="divide-y divide-ts-line">
                      {d.tasks.recent.map((t) => (
                        <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                          <span className="min-w-0 flex-1 truncate">{t.title}</span>
                          <span className="whitespace-nowrap text-xs text-ts-sub">{fmtDate(t.due)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
                {d.member.sharedAccount && <ScopeNote>Bu akkaunt boshqa tashkilotlarga ham a'zo — parolini faqat foydalanuvchining o'zi o'zgartiradi. Bu yerdagi o'zgarishlar faqat sizning tashkilotingizdagi roliga ta'sir qiladi.</ScopeNote>}
              </div>

              <Card className="h-fit">
                <div className="p-4 pb-0">
                  <Tabs
                    value={tab}
                    onChange={setTab}
                    tabs={[
                      { key: "activity", label: "Faoliyati", count: d.activity.length },
                      { key: "changes", label: "Akkaunt tarixi", count: d.changes.length },
                    ]}
                  />
                </div>
                {tab === "activity" ? (
                  <Timeline
                    empty="Tizimda hali amal bajarmagan"
                    items={d.activity.map((a) => ({
                      at: a.at,
                      tone: a.action === "DELETE" ? "red" : a.action === "CREATE" ? "green" : "blue",
                      title: (
                        <>
                          {OBJECT[a.object] ?? a.object} {ACTION[a.action] ?? a.action.toLowerCase()} <span className="text-ts-muted">{a.objectId}</span>
                        </>
                      ),
                      text: a.detail || undefined,
                    }))}
                  />
                ) : (
                  <Timeline
                    empty="Akkaunt o'zgarmagan"
                    items={d.changes.map((c) => ({
                      at: c.at,
                      tone: c.action === "SUSPEND" ? "red" : c.action === "CREATE" ? "green" : "amber",
                      title: (
                        <>
                          <span className="font-medium">{c.by}</span> {ACTION[c.action] ?? c.action.toLowerCase()}
                        </>
                      ),
                      text: c.from || c.to ? `${c.from ?? ""}${c.from ? " → " : ""}${c.to ?? ""}` : undefined,
                    }))}
                  />
                )}
              </Card>
            </div>
          </>
        )}
      </QueryState>

      {editing && d && (
        <EditMemberModal member={d.member} isOwner={isOwner} students={students.data?.students ?? []} onClose={() => setEditing(false)} onSave={(body, msg) => void patch(body, msg)} />
      )}
      {secret && d && <SecretModal email={d.member.email} password={secret} onClose={() => setSecret(null)} />}
      {toast}
    </div>
  );
}
