/**
 * Xonalar monitoringi — nazoratchi uchun: hozir qaysi xonada dars ketyapti (fan, guruh, o'qituvchi), qaysi xona bo'sh.
 * Joriy vaqtga qarab juftlik aniqlanadi; istalgan kun/juftlikni tanlab ko'rish mumkin. Har 30 soniyada yangilanadi.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, Clock, DoorClosed, DoorOpen, MapPin, Users, Wrench } from "lucide-react";
import { Btn, Card, CardHead, Page, Pill, QueryState, SelectBox, Stat, Table, Td } from "../../components/kit";
import { useApi } from "../../lib/api";
import { useSubjects } from "../../lib/subjects";
import { cn } from "../../lib/utils";
import { DAYS, ROOMS, SLOTS, subjectByCode, teacherName, type Lesson } from "../../data/academic";
import { useScope } from "./scope";

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const SLOT_RANGES = SLOTS.map((s) => {
  const [a, b] = s.split("–");
  return { start: toMin(a), end: toMin(b), from: a, to: b };
});

/** Hozirgi holat: kun indeksi (Du=0) va juftlik (dars davom etyapti / tanaffus / tugagan) */
function nowState(d: Date) {
  const day = d.getDay() === 0 ? -1 : d.getDay() - 1;
  const m = d.getHours() * 60 + d.getMinutes();
  const current = SLOT_RANGES.findIndex((r) => m >= r.start && m < r.end);
  const next = SLOT_RANGES.findIndex((r) => m < r.start);
  return { day, minutes: m, current, next };
}

export function RoomsMonitorPage() {
  const s = useScope("rooms");
  const nav = useNavigate();
  useSubjects();
  const q = useApi<Lesson[]>("/edu/lessons");
  const lessons = useMemo(() => q.data ?? [], [q.data]);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const st = nowState(now);
  const live = st.day >= 0 && st.current >= 0;
  const [manual, setManual] = useState<{ day: number; slot: number } | null>(null);
  const day = manual?.day ?? Math.max(0, st.day);
  const slot = manual?.slot ?? (st.current >= 0 ? st.current : st.next >= 0 ? st.next : 0);
  const isLiveView = !manual && live;

  const [block, setBlock] = useState("all");
  const [status, setStatus] = useState<"all" | "busy" | "free">("all");
  const blocks = Array.from(new Set(ROOMS.map((r) => r.block)));
  const atSlot = lessons.filter((l) => l.day === day && l.slot === slot);
  const todayLessons = lessons.filter((l) => l.day === day);

  const rooms = ROOMS.map((r) => {
    const lesson = atSlot.find((l) => l.room === r.id);
    const upcoming = todayLessons.filter((l) => l.room === r.id && l.slot > slot).sort((a, b) => a.slot - b.slot)[0];
    const state: "busy" | "free" | "repair" = r.status === "repair" ? "repair" : lesson ? "busy" : "free";
    return { ...r, lesson, upcoming, state };
  });
  const shown = rooms.filter((r) => (block === "all" || r.block === block) && (status === "all" || r.state === status));
  const busy = rooms.filter((r) => r.state === "busy").length;
  const free = rooms.filter((r) => r.state === "free").length;
  const repair = rooms.filter((r) => r.state === "repair").length;
  const minutesLeft = isLiveView ? SLOT_RANGES[slot].end - st.minutes : null;

  const headline = isLiveView
    ? `Hozir: ${DAYS[day]}, ${slot + 1}-juftlik (${SLOT_RANGES[slot].from}–${SLOT_RANGES[slot].to}) · tugashiga ${minutesLeft} daqiqa`
    : manual
      ? `Tanlangan vaqt: ${DAYS[day]}, ${slot + 1}-juftlik (${SLOT_RANGES[slot].from}–${SLOT_RANGES[slot].to})`
      : st.day < 0
        ? "Bugun yakshanba — dars yo'q. Dushanba jadvali ko'rsatilmoqda"
        : st.next >= 0
          ? `Tanaffus · keyingi: ${st.next + 1}-juftlik ${SLOT_RANGES[st.next].from} da boshlanadi`
          : "Bugungi darslar tugadi · oxirgi juftlik ko'rsatilmoqda";

  return (
    <Page
      title={s.title}
      subtitle={headline}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {isLiveView && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Jonli
            </span>
          )}
          <SelectBox className="h-8 w-auto" value={day} onChange={(e) => setManual({ day: Number(e.target.value), slot })}>
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </SelectBox>
          <SelectBox className="h-8 w-auto" value={slot} onChange={(e) => setManual({ day, slot: Number(e.target.value) })}>
            {SLOTS.map((x, i) => (
              <option key={x} value={i}>
                {i + 1}-juftlik · {x}
              </option>
            ))}
          </SelectBox>
          {manual && (
            <Btn size="sm" onClick={() => setManual(null)}>
              <Clock className="h-3.5 w-3.5" /> Hozirgi vaqt
            </Btn>
          )}
        </div>
      }
    >
      <QueryState error={q.error} loading={q.loading && !q.data} onRetry={q.reload}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Band xonalar" value={`${busy}/${ROOMS.length}`} hint={`${Math.round((busy / ROOMS.length) * 100)}% bandlik`} icon={DoorClosed} />
          <Stat label="Bo'sh xonalar" value={free} hint="Shu juftlikda" icon={DoorOpen} />
          <Stat label="Ta'mirda" value={repair} tone={repair ? "amber" : undefined} delta={repair ? "Foydalanib bo'lmaydi" : undefined} icon={Wrench} />
          <Stat label={`${DAYS[day]} kungi darslar`} value={todayLessons.length} hint={`${new Set(todayLessons.map((l) => l.group)).size} guruh`} icon={CalendarClock} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SelectBox className="h-8 w-auto" value={block} onChange={(e) => setBlock(e.target.value)}>
            <option value="all">Barcha binolar</option>
            {blocks.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </SelectBox>
          {(
            [
              ["all", "Hammasi"],
              ["busy", "Band"],
              ["free", "Bo'sh"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setStatus(k)}
              className={cn("h-8 rounded-md px-3 text-sm font-medium transition", status === k ? "bg-ts-inv text-ts-invfg" : "border border-ts-line2 text-ts-sub hover:bg-ts-hover")}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {shown.map((r) => (
            <Card key={r.id} className={cn("border-l-4 p-4", r.state === "busy" ? "border-l-blue-500" : r.state === "free" ? "border-l-emerald-500" : "border-l-amber-500")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-base font-semibold">{r.id}</div>
                  <div className="text-xs text-ts-sub">
                    {r.block} · {r.type} · {r.capacity} o'rin
                  </div>
                </div>
                <Pill tone={r.state === "busy" ? "blue" : r.state === "free" ? "green" : "amber"} dot>
                  {r.state === "busy" ? (isLiveView ? "Dars ketyapti" : "Band") : r.state === "free" ? "Bo'sh" : "Ta'mirda"}
                </Pill>
              </div>
              {r.lesson ? (
                <div className="mt-3 space-y-1.5 rounded-md bg-ts-tile p-3 text-sm">
                  <div className="font-medium">{subjectByCode(r.lesson.subject)?.name ?? r.lesson.subject}</div>
                  <div className="flex items-center gap-1.5 text-xs text-ts-sub">
                    <Users className="h-3.5 w-3.5" />
                    <button type="button" className="hover:underline" onClick={() => nav(`/academic/groups/${r.lesson!.group}`)}>
                      {r.lesson.group}
                    </button>
                    · {r.lesson.type}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-ts-sub">
                    <MapPin className="h-3.5 w-3.5" /> {teacherName(r.lesson.teacherId)}
                  </div>
                  <div className="text-xs text-ts-muted">
                    {SLOT_RANGES[slot].from}–{SLOT_RANGES[slot].to}
                    {isLiveView && minutesLeft !== null && ` · ${minutesLeft} daqiqa qoldi`}
                  </div>
                </div>
              ) : r.state === "free" ? (
                <div className="mt-3 text-xs text-ts-sub">
                  {r.upcoming ? (
                    <>
                      Keyingi dars: <b className="text-ts-fg">{r.upcoming.slot + 1}-juftlik</b> ({SLOT_RANGES[r.upcoming.slot].from}) · {r.upcoming.group}
                    </>
                  ) : (
                    `${DAYS[day]} kuni boshqa dars yo'q`
                  )}
                </div>
              ) : (
                <div className="mt-3 text-xs text-amber-600">Xona ta'mirda — darslar boshqa xonalarga ko'chirilishi kerak</div>
              )}
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden">
          <CardHead title={`${DAYS[day]} — kun bo'yi`} desc="Juftliklar bo'yicha xonalar bandligi · ustun tanlangan juftlik" className="pb-4" />
          <Table head={["Xona", ...SLOTS.map((x, i) => `${i + 1} · ${x.slice(0, 5)}`)]} minWidth={760}>
            {rooms
              .filter((r) => block === "all" || r.block === block)
              .map((r) => (
                <tr key={r.id}>
                  <Td className="font-medium">{r.id}</Td>
                  {SLOTS.map((_, si) => {
                    const l = todayLessons.find((x) => x.room === r.id && x.slot === si);
                    return (
                      <Td key={si} className={cn("px-1.5", si === slot && "bg-blue-500/[0.06]")}>
                        <button
                          type="button"
                          onClick={() => setManual({ day, slot: si })}
                          title={l ? `${subjectByCode(l.subject)?.name} · ${l.group} · ${teacherName(l.teacherId)}` : "Bo'sh"}
                          className={cn(
                            "flex h-8 w-full items-center justify-center rounded text-[11px] font-medium",
                            r.state === "repair" ? "ts-stripes bg-ts-chip text-ts-muted" : l ? "bg-blue-500/15 text-blue-700 dark:text-blue-300" : "bg-ts-tile text-ts-muted",
                          )}
                        >
                          {r.state === "repair" ? "" : (l?.group ?? "—")}
                        </button>
                      </Td>
                    );
                  })}
                </tr>
              ))}
          </Table>
        </Card>
      </QueryState>
    </Page>
  );
}
