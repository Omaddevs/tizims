import { useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, Lightbulb, Send, ShieldAlert, Sparkles, TrendingUp } from "lucide-react";
import { Avatar, Btn, Card, CardHead, Page, Pill, Progress, ScopeNote, Stat, Table, Td, useToast, type Tone } from "../../components/kit";
import { cn } from "../../lib/utils";
import { useApp } from "../../store/AppContext";
import { AI_FACULTY_INSIGHTS, AI_STUDENT_TIPS, GROUPS, riskOf } from "../../data/academic";
import { useApi } from "../../lib/api";
import { useScope } from "./scope";

const RISK_LABEL = { high: "Yuqori", medium: "O'rta", low: "Past" };
const RISK_TONE: Record<"high" | "medium" | "low", Tone> = { high: "red", medium: "amber", low: "green" };

/**
 * Demo AI javoblari — kalit so'zlar bo'yicha. Backend ulanganda LLM xizmati bilan almashtiriladi
 * (javoblar foydalanuvchining kirish doirasidagi ma'lumotlar asosida tuziladi).
 */
function answer(q: string, own: boolean): string {
  const t = q.toLowerCase();
  if (/davomat|qoldir|kel/.test(t))
    return own
      ? "Davomatingiz 94.2% — guruh o'rtachasidan (91%) yuqori. Eng ko'p qoldirilgan fan: Neyron tarmoqlar (1 marta sababsiz). 90% dan yuqori ushlab tursangiz grant xavfsiz."
      : "Eng past davomat IT-23 guruhida (78%). Asosiy sabab — 1-juftlik (08:30) darslari. Tavsiya: kurator bilan uchrashuv va ota-onalarga avtomatik xabarnoma.";
  if (/baho|gpa|ball|imtihon/.test(t))
    return own
      ? "Joriy GPA 3.78. Chiziqli algebra bo'yicha ball guruh o'rtachasidan 2 ball past — oraliq nazoratgacha har kuni 40 daqiqa takrorlash tavsiya etiladi."
      : "O'rtacha GPA 3.49. Akademik qarzdorlar asosan IT-23 va IT-22 guruhlarida. 3 nafar talabada yakuniy nazoratga kiritilmaslik xavfi bor.";
  if (/xona|jadval|to'qnash/.test(t)) return "Jadvalda 1 ta to'qnashuv bor: Payshanba 13:30, B-204 (ta'mirda). A-305 xonasi shu vaqtda bo'sh — ko'chirish tavsiya etiladi.";
  if (/o'qituvchi|yuklama/.test(t)) return "Bekzod Tursunov yuklamasi 22/20 soat — me'yordan oshgan. Dr. Alisher Rasulovda 2 soat bo'sh joy bor; CS-215 amaliy darslaridan birini o'tkazish mumkin.";
  return own
    ? "Men sizning baholaringiz, davomatingiz va topshiriqlaringiz asosida maslahat beraman. Masalan: «Qaysi fanga ko'proq e'tibor berishim kerak?»"
    : "Men davomat, o'zlashtirish, jadval va o'qituvchilar yuklamasi bo'yicha tahlil qila olaman. Masalan: «Qaysi guruhda davomat past?»";
}

export function InsightsPage() {
  const s = useScope("insights");
  const { addTask } = useApp();
  const [toast, showToast] = useToast();

  const groups = s.isTeacher ? s.myGroups : s.facultyGroups;
  const studentView = s.isStudent || s.isParent;
  // Doira serverda: o'qituvchi → o'z guruhlari, dekan → o'z fakulteti
  const rq = useApi<{ id: string; name: string; group: string; gpa: number; attendance: number; debt: number }[]>(studentView ? null : "/edu/insights/risk");
  const students = rq.data ?? [];
  const risky = students.map((st) => ({ ...st, risk: riskOf(st) })).filter((st) => st.risk !== "low").sort((a, b) => (a.risk === b.risk ? a.gpa - b.gpa : a.risk === "high" ? -1 : 1));
  const insights = s.isTeacher ? AI_FACULTY_INSIGHTS.filter((i) => /IT-2[123]/.test(i.title)) : AI_FACULTY_INSIGHTS;

  return (
    <Page title={s.title} subtitle={s.description}>
      {s.isTeacher && <ScopeNote>Tahlil faqat o'zingiz dars beradigan guruhlar ({s.myGroups.join(", ")}) bo'yicha.</ScopeNote>}
      {s.isParent && <ScopeNote>Farzandingiz {s.me?.name} natijalari asosida tavsiyalar.</ScopeNote>}

      {studentView ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Akademik xavf" value={RISK_LABEL[riskOf(s.me!)]} delta="Barqaror" tone="green" icon={ShieldAlert} />
          <Stat label="Grant saqlash ehtimoli" value="92%" tone="green" icon={TrendingUp} />
          <Stat label="Tavsiyalar" value={AI_STUDENT_TIPS.length} icon={Lightbulb} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Yuqori xavf" value={risky.filter((r) => r.risk === "high").length} delta="Talaba" tone="red" icon={AlertTriangle} />
          <Stat label="O'rta xavf" value={risky.filter((r) => r.risk === "medium").length} delta="Talaba" tone="amber" icon={ShieldAlert} />
          <Stat label="AI xulosalar" value={insights.length} hint="Shu hafta" icon={Sparkles} />
          <Stat label="Prognoz aniqligi" value="87%" hint="O'tgan semestr natijalari bo'yicha" icon={TrendingUp} />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Card>
            <CardHead title={studentView ? "Shaxsiy tavsiyalar" : "AI xulosalari"} desc={studentView ? "Baholar, davomat va topshiriqlar asosida" : "Muammolar avtomatik aniqlangan"} />
            <div className="space-y-2 p-4">
              {studentView
                ? AI_STUDENT_TIPS.map((t) => (
                    <div key={t.title} className="flex gap-3 rounded-md border border-ts-line p-3">
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <div>
                        <div className="font-medium">{t.title}</div>
                        <div className="mt-0.5 text-sm text-ts-sub">{t.text}</div>
                      </div>
                    </div>
                  ))
                : insights.map((i) => (
                    <div key={i.title} className="flex flex-wrap gap-3 rounded-md border border-ts-line p-3">
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", i.tone === "red" ? "bg-red-500" : i.tone === "amber" ? "bg-amber-500" : "bg-emerald-500")} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{i.title}</div>
                        <div className="mt-0.5 text-sm text-ts-sub">{i.text}</div>
                      </div>
                      {s.access !== "own" || s.isTeacher ? (
                        <Btn
                          size="sm"
                          className="self-center"
                          onClick={() => {
                            addTask({ title: `${i.action}: ${i.title}`, due: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), priority: i.tone === "red" ? "high" : "medium", category: "Hisobot", description: i.text });
                            showToast("Vazifa yaratildi — Vazifalarim bo'limida");
                          }}
                        >
                          {i.action}
                        </Btn>
                      ) : null}
                    </div>
                  ))}
            </div>
          </Card>

          {!studentView && (
            <Card className="overflow-hidden">
              <CardHead title="Xavf ostidagi talabalar" desc="GPA, davomat va akademik qarzdorlik asosida prognoz" className="pb-4" />
              <Table head={["Talaba", "Guruh", "GPA", "Davomat", "Qarz", "Xavf"]} minWidth={640}>
                {risky.map((st) => (
                  <tr key={st.id}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={st.name} size={28} />
                        <span className="font-medium">{st.name}</span>
                      </div>
                    </Td>
                    <Td>{st.group}</Td>
                    <Td className="tabular-nums">{st.gpa.toFixed(2)}</Td>
                    <Td className="w-36">
                      <div className="flex items-center gap-2">
                        <Progress value={st.attendance} tone={st.attendance < 70 ? "red" : "amber"} />
                        <span className="w-9 text-xs tabular-nums text-ts-sub">{st.attendance}%</span>
                      </div>
                    </Td>
                    <Td>{st.debt}</Td>
                    <Td>
                      <Pill tone={RISK_TONE[st.risk]} dot>
                        {RISK_LABEL[st.risk]}
                      </Pill>
                    </Td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}

          {!studentView && !s.isTeacher && (
            <Card>
              <CardHead title="Guruhlar reytingi" desc="O'zlashtirish va davomat indeksi" />
              <div className="space-y-3 p-4">
                {GROUPS.filter((g) => !groups || groups.includes(g.id))
                  .map((g) => ({ ...g, idx: Math.round((g.gpa / 4) * 50 + g.attendance / 2) }))
                  .sort((a, b) => b.idx - a.idx)
                  .map((g) => (
                    <div key={g.id} className="flex items-center gap-3">
                      <span className="w-14 text-sm font-medium">{g.id}</span>
                      <Progress value={g.idx} tone={g.idx >= 85 ? "green" : g.idx >= 75 ? "blue" : "amber"} />
                      <span className="w-8 text-right text-xs tabular-nums text-ts-sub">{g.idx}</span>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </div>

        <AiChat own={studentView} />
      </div>
      {toast}
    </Page>
  );
}

function AiChat({ own }: { own: boolean }) {
  const suggestions = own ? ["Davomatim qanday?", "Qaysi fanga e'tibor berishim kerak?", "Imtihonga qanday tayyorlanay?"] : ["Qaysi guruhda davomat past?", "O'qituvchilar yuklamasi qanday?", "Jadvalda to'qnashuv bormi?"];
  const [msgs, setMsgs] = useState<{ q: string; a: string }[]>([]);
  const [q, setQ] = useState("");
  const ask = (text: string) => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { q: text.trim(), a: answer(text, own) }]);
    setQ("");
  };
  return (
    <Card className="flex h-fit flex-col xl:sticky xl:top-[72px]">
      <CardHead title={<span className="flex items-center gap-2"><Bot className="h-4 w-4" /> AI yordamchi</span>} desc="Savolingizni oddiy tilda yozing" />
      <div className="max-h-[420px] min-h-[200px] space-y-3 overflow-y-auto p-4">
        {msgs.length === 0 && (
          <div className="space-y-2">
            {suggestions.map((x) => (
              <button key={x} type="button" onClick={() => ask(x)} className="flex w-full items-center gap-2 rounded-md border border-ts-line px-3 py-2 text-left text-sm transition hover:bg-ts-hover">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-ts-blue" />
                {x}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className="space-y-2">
            <div className="ml-auto w-fit max-w-[85%] rounded-lg bg-ts-inv px-3 py-2 text-sm text-ts-invfg">{m.q}</div>
            <div className="flex gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-ts-blue2 to-ts-blue3 text-white">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div className="rounded-lg bg-ts-tile px-3 py-2 text-sm">{m.a}</div>
            </div>
          </div>
        ))}
      </div>
      <form
        className="flex items-center gap-2 border-t border-ts-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Savol bering..." className="h-9 flex-1 rounded-md border border-ts-line2 bg-ts-input px-3 text-sm text-ts-fg outline-none placeholder:text-ts-muted focus:border-ts-sub" />
        <button type="submit" disabled={!q.trim()} className="flex h-9 w-9 items-center justify-center rounded-md bg-ts-inv text-ts-invfg disabled:opacity-40">
          <Send className="h-4 w-4" />
        </button>
      </form>
      <div className="flex items-center gap-1.5 border-t border-ts-line px-4 py-2 text-[11px] text-ts-muted">
        <CheckCircle2 className="h-3 w-3" /> Faqat sizga ruxsat etilgan ma'lumotlar asosida javob beradi
      </div>
    </Card>
  );
}
