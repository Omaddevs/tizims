/**
 * Xabarlar — Telegram uslubida: shaxsiy va guruh suhbatlari, fayl / rasm / ovozli xabar,
 * bir nechta qabul qiluvchiga birdan yuborish (masalan, kasallik ma'lumotnomasini dekanat va o'qituvchilarga).
 * Yangi xabarlar har bir necha soniyada serverdan olinadi.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Download,
  FileText,
  Hash,
  Image as ImageIcon,
  Loader2,
  MessageSquarePlus,
  Mic,
  Paperclip,
  Pause,
  Play,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Avatar, Btn, Card, Modal, Page, useToast } from "../../components/kit";
import { api, errorText } from "../../lib/api";
import { cn } from "../../lib/utils";
import { useApp } from "../../store/AppContext";
import { BADGES_EVENT } from "../../components/Layout";
import { useScope } from "./scope";
import { useIsMobile } from "../../lib/useMedia";

/* ───────── Turlar ───────── */

type Attachment = { id: string; kind: "image" | "file" | "voice"; name: string; mime: string; size: number; durationSec?: number };
type Msg = { id: string; seq: number; authorId: string; authorName: string; mine: boolean; text: string; attachments: Attachment[]; deleted: boolean; deletedBy?: "author" | "moderator" };
type MsgPage = { messages: Msg[]; rev: number; hasMore?: boolean; peerReadSeq: number | null; canModerate: boolean; members?: Member[] };

/** Kelgan xabarlarni mavjudlariga qo'shish: bir xil id — yangilanadi (masalan, o'chirilgan), tartib — seq bo'yicha */
function mergeMsgs(xs: Msg[], incoming: Msg[]) {
  if (!incoming.length) return xs;
  const map = new Map(xs.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort((a, b) => a.seq - b.seq);
}
type ChatItem = {
  id: string;
  kind: "direct" | "group";
  title: string;
  subtitle: string;
  peerId: string | null;
  last: { text: string; authorName: string; mine: boolean; seq: number } | null;
  unread: number;
  lastSeq: number;
};
type Contact = { id: string; name: string; role: string; position: string };
type Member = { id: string; name: string; position: string };

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.png,.jpg,.jpeg,.webp,.gif,.mp3,.m4a,.ogg,.wav";
const MAX_FILE = 15 * 1024 * 1024;
const fileUrl = (id: string, download = false) => `/api/edu/chats/files/${id}${download ? "?download=1" : ""}`;

/* ───────── Formatlash ───────── */

const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const pad = (n: number) => String(n).padStart(2, "0");
const hhmm = (ts: number) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
function dayLabel(ts: number) {
  const d = new Date(ts);
  const t = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(t) - start(d)) / 86400000);
  if (diff === 0) return "Bugun";
  if (diff === 1) return "Kecha";
  return `${d.getDate()}-${MONTHS[d.getMonth()]}${d.getFullYear() !== t.getFullYear() ? ` ${d.getFullYear()}` : ""}`;
}
function listTime(ts: number) {
  const diff = Date.now() - ts;
  if (new Date(ts).toDateString() === new Date().toDateString()) return hhmm(ts);
  if (diff < 7 * 86400000) return ["Yak", "Du", "Se", "Ch", "Pa", "Ju", "Sh"][new Date(ts).getDay()];
  const d = new Date(ts);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}
const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;

/* ───────── Yuklash (progress bilan) ───────── */

function upload(blob: Blob, name: string, extra: Record<string, string>, onProgress: (p: number) => void): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("POST", "/api/edu/chats/upload");
    x.setRequestHeader("X-Requested-With", "tizims");
    x.setRequestHeader("Content-Type", "application/octet-stream");
    x.setRequestHeader("X-File-Name", encodeURIComponent(name));
    for (const [k, v] of Object.entries(extra)) x.setRequestHeader(k, v);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    x.onload = () => {
      let data: unknown = null;
      try {
        data = JSON.parse(x.responseText);
      } catch {
        /* bo'sh javob */
      }
      if (x.status >= 200 && x.status < 300) resolve(data as Attachment);
      else reject(new Error((data as { error?: { message?: string } } | null)?.error?.message ?? (x.status === 413 ? "Fayl 15 MB dan katta." : `Yuklashda xato (${x.status})`)));
    };
    x.onerror = () => reject(new Error("Tarmoq xatosi — fayl yuklanmadi."));
    x.send(blob);
  });
}

type Pending = { key: string; name: string; size: number; preview?: string; progress: number; att?: Attachment; error?: string };

/** Biriktiriladigan fayllar: tanlanganda darhol yuklanadi */
function useUploads() {
  const [items, setItems] = useState<Pending[]>([]);
  const add = useCallback((files: File[]) => {
    for (const f of files) {
      const key = `${f.name}-${f.size}-${Math.random()}`;
      const preview = f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined;
      if (f.size > MAX_FILE) {
        setItems((xs) => [...xs, { key, name: f.name, size: f.size, preview, progress: 0, error: "15 MB dan katta" }]);
        continue;
      }
      setItems((xs) => [...xs, { key, name: f.name, size: f.size, preview, progress: 0 }]);
      upload(f, f.name, {}, (p) => setItems((xs) => xs.map((i) => (i.key === key ? { ...i, progress: p } : i))))
        .then((att) => setItems((xs) => xs.map((i) => (i.key === key ? { ...i, att, progress: 1 } : i))))
        .catch((e) => setItems((xs) => xs.map((i) => (i.key === key ? { ...i, error: errorText(e) } : i))));
    }
  }, []);
  const remove = (key: string) => setItems((xs) => xs.filter((i) => i.key !== key));
  const clear = () => setItems([]);
  const busy = items.some((i) => !i.att && !i.error);
  const ready = items.filter((i) => i.att).map((i) => i.att!.id);
  return { items, add, remove, clear, busy, ready };
}

function PendingList({ u }: { u: ReturnType<typeof useUploads> }) {
  if (!u.items.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto px-3 pt-3">
      {u.items.map((i) => (
        <div key={i.key} className={cn("relative flex w-44 shrink-0 items-center gap-2 rounded-lg border p-2", i.error ? "border-red-500/40 bg-red-500/5" : "border-ts-line bg-ts-tile")}>
          {i.preview ? <img src={i.preview} alt="" className="h-9 w-9 shrink-0 rounded object-cover" /> : <FileText className="h-9 w-9 shrink-0 p-1.5 text-ts-sub" />}
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{i.name}</div>
            <div className={cn("text-[11px]", i.error ? "text-red-500" : "text-ts-muted")}>{i.error ?? (i.att ? fmtSize(i.size) : `${Math.round(i.progress * 100)}%`)}</div>
            {!i.att && !i.error && (
              <div className="mt-1 h-1 overflow-hidden rounded bg-ts-line">
                <div className="h-full bg-ts-blue transition-all" style={{ width: `${i.progress * 100}%` }} />
              </div>
            )}
          </div>
          <button type="button" onClick={() => u.remove(i.key)} className="absolute -right-1.5 -top-1.5 rounded-full border border-ts-line bg-ts-card p-0.5 text-ts-sub hover:text-ts-fg" aria-label="Olib tashlash">
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ───────── Ovoz yozish ───────── */

function pickAudioType() {
  const options: [string, string][] = [
    ["audio/webm;codecs=opus", "webm"],
    ["audio/webm", "webm"],
    ["audio/mp4", "m4a"],
    ["audio/ogg;codecs=opus", "ogg"],
  ];
  if (typeof MediaRecorder === "undefined") return null;
  return options.find(([t]) => MediaRecorder.isTypeSupported(t)) ?? null;
}

function useRecorder(onDone: (blob: Blob, ext: string, sec: number) => void, onError: (msg: string) => void) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const mr = useRef<MediaRecorder | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (startedAt === null) return;
    const t = setInterval(() => {
      const s = (Date.now() - startedAt) / 1000;
      setElapsed(s);
      if (s >= 300) mr.current?.stop(); // 5 daqiqa chegarasi
    }, 200);
    return () => clearInterval(t);
  }, [startedAt]);

  async function start() {
    const type = pickAudioType();
    if (!type || !navigator.mediaDevices?.getUserMedia) return onError("Bu brauzer ovoz yozishni qo'llab-quvvatlamaydi.");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return onError("Mikrofonga ruxsat berilmadi. Brauzer sozlamalarida ruxsat bering.");
    }
    const rec = new MediaRecorder(stream, { mimeType: type[0] });
    const chunks: Blob[] = [];
    const begin = Date.now();
    cancelled.current = false;
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      setStartedAt(null);
      setElapsed(0);
      const sec = Math.round((Date.now() - begin) / 1000);
      if (cancelled.current) return;
      if (sec < 1) return onError("Ovozli xabar juda qisqa.");
      onDone(new Blob(chunks, { type: type[0].split(";")[0] }), type[1], sec);
    };
    rec.start(250);
    mr.current = rec;
    setStartedAt(begin);
  }
  function stop(send: boolean) {
    cancelled.current = !send;
    mr.current?.stop();
    mr.current = null;
  }
  return { recording: startedAt !== null, elapsed, start, stop };
}

/* ───────── Biriktirmalar ko'rinishi ───────── */

function VoicePlayer({ a, mine }: { a: Attachment; mine: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const total = a.durationSec ?? 0;
  return (
    <div className="flex w-60 max-w-full items-center gap-2.5 py-1">
      <button
        type="button"
        onClick={() => {
          const el = ref.current;
          if (!el) return;
          if (el.paused) void el.play();
          else el.pause();
        }}
        className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", mine ? "bg-ts-invfg text-ts-inv" : "bg-ts-inv text-ts-invfg")}
        aria-label={playing ? "To'xtatish" : "Eshitish"}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className={cn("h-1.5 cursor-pointer overflow-hidden rounded-full", mine ? "bg-white/25 dark:bg-black/20" : "bg-ts-line2")}
          onClick={(e) => {
            const el = ref.current;
            if (!el || !total) return;
            const r = e.currentTarget.getBoundingClientRect();
            el.currentTime = ((e.clientX - r.left) / r.width) * total;
          }}
        >
          <div className={cn("h-full rounded-full", mine ? "bg-ts-invfg" : "bg-ts-inv")} style={{ width: `${total ? Math.min(100, (pos / total) * 100) : 0}%` }} />
        </div>
        <div className={cn("mt-1 text-[11px] tabular-nums", mine ? "opacity-70" : "text-ts-muted")}>
          <Mic className="mr-0.5 inline h-3 w-3" /> {fmtDur(playing || pos ? pos : total)}
        </div>
      </div>
      <audio
        ref={ref}
        src={fileUrl(a.id)}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPos(0);
        }}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
      />
    </div>
  );
}

function FileCard({ a, mine }: { a: Attachment; mine: boolean }) {
  const ext = a.name.split(".").pop()?.toUpperCase().slice(0, 4) ?? "";
  return (
    <a href={fileUrl(a.id, true)} download={a.name} className={cn("flex w-64 max-w-full items-center gap-2.5 rounded-lg p-2 transition", mine ? "bg-white/10 hover:bg-white/15 dark:bg-black/10" : "bg-ts-card hover:bg-ts-hover")}>
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold", mine ? "bg-ts-invfg text-ts-inv" : "bg-ts-inv text-ts-invfg")}>{ext || <FileText className="h-4 w-4" />}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{a.name}</span>
        <span className={cn("block text-[11px]", mine ? "opacity-70" : "text-ts-muted")}>{fmtSize(a.size)}</span>
      </span>
      <Download className="h-4 w-4 shrink-0 opacity-70" />
    </a>
  );
}

/* ───────── Sahifa ───────── */

/** Kartani ekranning qolgan balandligiga cho'zish (bannerlar va mobil pastki menyu hisobga olinadi) */
function useFillHeight() {
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    const calc = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const bottomNav = window.innerWidth < 1024 ? 96 : 20;
      setH(Math.max(440, window.innerHeight - top - bottomNav));
    };
    calc();
    window.addEventListener("resize", calc);
    // Banner yopilganda joylashuv o'zgaradi
    const ro = new ResizeObserver(calc);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("resize", calc);
      ro.disconnect();
    };
  }, []);
  return { ref, h };
}

export function MessagesPage() {
  const s = useScope("messages");
  const mobile = useIsMobile();
  const fill = useFillHeight();
  const [chats, setChats] = useState<ChatItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bildirishnomadan kelganda (/messages?chat=...) shu suhbat ochiladi
  const [params, setParams] = useSearchParams();
  const [active, setActiveState] = useState<string>(() => params.get("chat") ?? "");
  const setActive = (id: string) => {
    setActiveState(id);
    if (params.get("chat")) setParams({}, { replace: true });
  };
  useEffect(() => {
    const c = params.get("chat");
    if (c) setActiveState(c);
  }, [params]);
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const [toast, showToast] = useToast();

  const loadChats = useCallback(async () => {
    try {
      setChats(await api<ChatItem[]>("/edu/chats"));
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useEffect(() => {
    void loadChats();
    const t = setInterval(() => !document.hidden && void loadChats(), 5000);
    return () => clearInterval(t);
  }, [loadChats]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (chats ?? []).filter((c) => !q || c.title.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q));
  }, [chats, query]);
  const ch = chats?.find((c) => c.id === active);

  async function openWith(userId: string) {
    try {
      const { id } = await api<{ id: string }>("/edu/chats/direct", { body: { userId } });
      await loadChats();
      setActive(id);
    } catch (e) {
      showToast(errorText(e));
    }
  }

  return (
    <Page title={s.title} subtitle="Shaxsiy va guruh suhbatlari · fayl, rasm va ovozli xabarlar">
      <div ref={fill.ref} style={{ height: !mobile && fill.h ? fill.h : undefined }} className={cn(!mobile && "h-[calc(100dvh-210px)]")}>
      <Card className={cn("overflow-hidden", !mobile && "grid h-full grid-cols-[320px_minmax(0,1fr)]")}>
        {/* ── Suhbatlar ro'yxati ── */}
        <aside className={cn("flex min-h-0 flex-col", !mobile && "border-r border-ts-line")}>
          <div className="flex items-center gap-2 border-b border-ts-line p-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ts-muted" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Qidirish" className="h-9 w-full rounded-md border border-ts-line2 bg-ts-input pl-8 pr-3 text-sm outline-none placeholder:text-ts-muted focus:border-ts-sub" />
            </div>
            <button type="button" onClick={() => setComposing(true)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ts-inv text-ts-invfg hover:opacity-90" title="Yangi xabar" aria-label="Yangi xabar">
              <MessageSquarePlus className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {error && <div className="m-2 rounded-md bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">{error}</div>}
            {!chats && !error && (
              <div className="flex justify-center p-6 text-ts-muted">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {chats && list.length === 0 && (
              <div className="p-6 text-center text-sm text-ts-sub">
                {query ? "Topilmadi" : "Hali suhbat yo'q"}
                <div className="mt-3">
                  <Btn onClick={() => setComposing(true)}>
                    <MessageSquarePlus className="h-4 w-4" /> Yangi xabar
                  </Btn>
                </div>
              </div>
            )}
            {list.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActive(c.id)}
                className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition", active === c.id ? "bg-ts-hover" : "hover:bg-ts-hover")}
              >
                {c.kind === "group" ? (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ts-inv text-ts-invfg">
                    <Hash className="h-5 w-5" />
                  </span>
                ) : (
                  <Avatar name={c.title} size={44} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.title}</span>
                    <span className="shrink-0 text-[11px] text-ts-muted">{c.last ? listTime(c.last.seq) : ""}</span>
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-ts-sub">
                      {c.last ? (
                        <>
                          {c.last.mine ? "Siz: " : c.kind === "group" ? `${c.last.authorName.split(" ")[0]}: ` : ""}
                          {c.last.text}
                        </>
                      ) : (
                        c.subtitle
                      )}
                    </span>
                    {c.unread > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-ts-blue px-1.5 text-[11px] font-semibold text-white">{c.unread > 99 ? "99+" : c.unread}</span>}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* ── Suhbat ── */}
        {/* Telefonda suhbat to'liq ekranda ochiladi (Telegram kabi), pastki menyu yopiladi */}
        {(!mobile || ch) && (
        <section className={cn("flex min-h-0 flex-col", mobile && "fixed inset-0 z-[70] bg-ts-card pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]")}>
          {ch ? (
            <ChatView
              key={ch.id}
              mobile={mobile}
              chat={ch}
              onBack={() => setActive("")}
              onActivity={() => {
                void loadChats();
                window.dispatchEvent(new Event(BADGES_EVENT));
              }}
              onToast={showToast}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-ts-sub">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ts-tile">
                <MessageSquarePlus className="h-6 w-6" />
              </span>
              <div className="text-sm">Suhbatni tanlang yoki yangi xabar yozing</div>
              <Btn onClick={() => setComposing(true)}>Yangi xabar</Btn>
            </div>
          )}
        </section>
        )}
      </Card>
      </div>

      {composing && (
        <ComposeModal
          onClose={() => setComposing(false)}
          onOpenChat={(userId) => {
            setComposing(false);
            void openWith(userId);
          }}
          onSent={(ids, n) => {
            setComposing(false);
            void loadChats().then(() => n === 1 && setActive(ids[0]));
            window.dispatchEvent(new Event(BADGES_EVENT));
            showToast(n === 1 ? "Xabar yuborildi" : `${n} kishiga yuborildi`);
          }}
        />
      )}
      {toast}
    </Page>
  );
}

/* ───────── Bitta suhbat ───────── */

function ChatView({ chat, mobile, onBack, onActivity, onToast }: { chat: ChatItem; mobile: boolean; onBack: () => void; onActivity: () => void; onToast: (t: string) => void }) {
  const { user } = useApp();
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [peerRead, setPeerRead] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [viewer, setViewer] = useState<Attachment | null>(null);
  const [dragging, setDragging] = useState(false);
  const uploads = useUploads();
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rev = useRef(0);
  const stick = useRef(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [moderator, setModerator] = useState(false);
  const activityRef = useRef(onActivity);
  activityRef.current = onActivity;
  const base = `/edu/chats/${encodeURIComponent(chat.id)}/messages`;

  /** Yangi kelgan va o'zgargan (o'chirilgan) xabarlar — rev bo'yicha */
  const sync = useCallback(async (initial = false) => {
    try {
      const r = await api<MsgPage>(initial ? base : `${base}?rev=${rev.current}`);
      setPeerRead(r.peerReadSeq);
      setModerator(r.canModerate);
      if (r.members) setMembers(r.members);
      if (initial) {
        setHasMore(!!r.hasMore);
        setMsgs(r.messages);
      } else if (r.messages.length) setMsgs((xs) => mergeMsgs(xs ?? [], r.messages));
      rev.current = Math.max(rev.current, r.rev);
      // Yangi kelgan xabar o'qildi — ro'yxat va menyu belgilarini yangilash
      if (initial ? chat.unread > 0 : r.messages.some((m) => !m.mine)) activityRef.current();
    } catch (e) {
      setErr(errorText(e));
    }
  }, [base, chat.unread]);

  useEffect(() => {
    void sync(true);
    const t = setInterval(() => !document.hidden && void sync(), 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id]);

  /** Eskiroq xabarlar (yuqoriga aylantirganda) — ko'rinib turgan joy saqlanadi */
  async function loadOlder() {
    const el = scrollRef.current;
    if (!msgs?.length || loadingOlder || !hasMore || !el) return;
    setLoadingOlder(true);
    const before = el.scrollHeight;
    try {
      const r = await api<MsgPage>(`${base}?before=${msgs[0].seq}`);
      setHasMore(!!r.hasMore);
      stick.current = false;
      setMsgs((xs) => mergeMsgs(xs ?? [], r.messages));
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop += scrollRef.current.scrollHeight - before;
      });
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setLoadingOlder(false);
    }
  }

  // Pastga yopishib turish (foydalanuvchi yuqoriga aylantirmagan bo'lsa)
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  function appendMine(m: Msg) {
    stick.current = true;
    setMsgs((xs) => mergeMsgs(xs ?? [], [m]));
    setErr(null);
    onActivity();
  }

  async function send() {
    const t = text.trim();
    const ids = uploads.ready;
    if ((!t && ids.length === 0) || sending) return;
    setSending(true);
    try {
      const m = await api<Msg>(base, { body: { text: t, attachments: ids } });
      setText("");
      uploads.clear();
      appendMine(m);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setSending(false);
    }
  }

  const rec = useRecorder(
    (blob, ext, sec) => {
      setSending(true);
      upload(blob, `ovozli-xabar.${ext}`, { "X-Kind": "voice", "X-Duration": String(sec) }, () => {})
        .then((a) => api<Msg>(base, { body: { text: "", attachments: [a.id] } }))
        .then(appendMine)
        .catch((e) => setErr(errorText(e)))
        .finally(() => setSending(false));
    },
    (msg) => setErr(msg),
  );

  async function remove(m: Msg) {
    const q = m.mine ? "Xabar hamma uchun o'chirilsinmi?" : `${m.authorName} xabari guruhdan o'chirilsinmi? Bu amal audit jurnaliga yoziladi.`;
    if (!window.confirm(q)) return;
    try {
      await api(`${base}/${m.id}`, { method: "DELETE" });
      setMsgs((xs) => (xs ?? []).map((x) => (x.id === m.id ? { ...x, deleted: true, deletedBy: m.mine ? "author" : "moderator", text: "", attachments: [] } : x)));
      onActivity();
    } catch (e) {
      onToast(errorText(e));
    }
  }

  const canSend = (text.trim() || uploads.ready.length) && !uploads.busy && !sending;

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        uploads.add(Array.from(e.dataTransfer.files));
      }}
    >
      {/* Sarlavha */}
      <div className="flex items-center gap-3 border-b border-ts-line px-3 py-2.5">
        {mobile && (
          <button type="button" className="rounded-md p-1.5 hover:bg-ts-hover" onClick={onBack} aria-label="Orqaga">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        {chat.kind === "group" ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ts-inv text-ts-invfg">
            <Hash className="h-4 w-4" />
          </span>
        ) : (
          <Avatar name={chat.title} size={36} />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{chat.title}</div>
          <div className="truncate text-xs text-ts-sub">{chat.kind === "group" ? `${members.length} a'zo · ${chat.subtitle}` : chat.subtitle}</div>
        </div>
        {chat.kind === "group" && (
          <button type="button" onClick={() => setShowMembers((v) => !v)} className={cn("rounded-md p-2 hover:bg-ts-hover", showMembers && "bg-ts-hover")} title="A'zolar" aria-label="A'zolar">
            <Users className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Xabarlar */}
        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            if (el.scrollTop < 60) void loadOlder();
          }}
          className="min-h-0 flex-1 overflow-y-auto bg-ts-bg px-3 py-4 sm:px-5"
        >
          {!msgs && (
            <div className="flex justify-center p-6 text-ts-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {hasMore && (
            <div className="mb-2 flex justify-center">
              <button type="button" onClick={() => void loadOlder()} disabled={loadingOlder} className="flex items-center gap-1.5 rounded-full bg-ts-tile px-3 py-1 text-xs text-ts-sub hover:text-ts-fg">
                {loadingOlder && <Loader2 className="h-3 w-3 animate-spin" />} Oldingi xabarlar
              </button>
            </div>
          )}
          {msgs && msgs.length === 0 && <div className="py-10 text-center text-sm text-ts-sub">Xabar yo'q — birinchi bo'lib yozing</div>}
          {msgs?.map((m, i) => {
            const prev = msgs[i - 1];
            const newDay = !prev || new Date(prev.seq).toDateString() !== new Date(m.seq).toDateString();
            const sameAuthor = !newDay && prev?.authorId === m.authorId && m.seq - prev.seq < 5 * 60000;
            const images = m.attachments.filter((a) => a.kind === "image");
            const others = m.attachments.filter((a) => a.kind !== "image");
            const read = m.mine && peerRead !== null && peerRead >= m.seq;
            return (
              <div key={m.id}>
                {newDay && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-ts-tile px-3 py-1 text-[11px] font-medium text-ts-sub">{dayLabel(m.seq)}</span>
                  </div>
                )}
                <div className={cn("group flex items-end gap-2", m.mine ? "flex-row-reverse" : "", sameAuthor ? "mt-0.5" : "mt-2.5")}>
                  {!m.mine && chat.kind === "group" && <div className="w-8 shrink-0">{!sameAuthor && <Avatar name={m.authorName} size={32} />}</div>}
                  <div className={cn("max-w-[80%] overflow-hidden rounded-2xl sm:max-w-[65%]", m.mine ? "rounded-br-md bg-ts-inv text-ts-invfg" : "rounded-bl-md border border-ts-line bg-ts-card", m.deleted && "opacity-60")}>
                    {!m.mine && chat.kind === "group" && !sameAuthor && <div className="px-3 pt-2 text-xs font-semibold text-ts-blue">{m.authorName}</div>}
                    {m.deleted ? (
                      <div className="px-3 py-2 text-sm italic">{m.deletedBy === "moderator" ? "Xabar moderator tomonidan o'chirildi" : "Xabar o'chirildi"}</div>
                    ) : (
                      <>
                        {images.length > 0 && (
                          <div className={cn("grid w-[300px] max-w-full gap-0.5 p-1", images.length > 1 && "grid-cols-2")}>
                            {images.map((a) => (
                              <button key={a.id} type="button" onClick={() => setViewer(a)} className="block overflow-hidden rounded-xl">
                                <img src={fileUrl(a.id)} alt={a.name} loading="lazy" className={cn("w-full object-cover", images.length > 1 ? "aspect-square" : "max-h-72")} />
                              </button>
                            ))}
                          </div>
                        )}
                        {others.length > 0 && (
                          <div className="space-y-1 px-2 pt-2">
                            {others.map((a) => (a.kind === "voice" ? <VoicePlayer key={a.id} a={a} mine={m.mine} /> : <FileCard key={a.id} a={a} mine={m.mine} />))}
                          </div>
                        )}
                        {m.text && <div className="whitespace-pre-wrap break-words px-3 pt-2 text-sm leading-relaxed">{m.text}</div>}
                      </>
                    )}
                    <div className={cn("flex items-center justify-end gap-1 px-3 pb-1.5 pt-0.5 text-[10px]", m.mine ? "opacity-70" : "text-ts-muted")}>
                      {hhmm(m.seq)}
                      {m.mine && chat.kind === "direct" && (read ? <CheckCheck className="h-3.5 w-3.5" aria-label="O'qildi" /> : <Check className="h-3.5 w-3.5" aria-label="Yuborildi" />)}
                    </div>
                  </div>
                  {(m.mine || moderator) && !m.deleted && (
                    <button type="button" onClick={() => void remove(m)} className={cn("mb-1 rounded-md p-1 text-ts-muted transition hover:bg-ts-hover hover:text-red-500 focus:opacity-100 group-hover:opacity-100", mobile ? "opacity-60" : "opacity-0")} title={m.mine ? "O'chirish" : "Moderator sifatida o'chirish"} aria-label="O'chirish">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Guruh a'zolari */}
        {showMembers && (
          <aside className={cn("w-64 shrink-0 overflow-y-auto border-l border-ts-line", mobile && "absolute inset-y-0 right-0 z-10 bg-ts-card shadow-xl")}>
            <div className="flex items-center justify-between border-b border-ts-line px-3 py-2.5 text-sm font-medium">
              A'zolar · {members.length}
              <button type="button" onClick={() => setShowMembers(false)} className="rounded p-1 hover:bg-ts-hover" aria-label="Yopish">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-1.5">
              {members.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
                  <Avatar name={p.name} size={30} />
                  <div className="min-w-0">
                    <div className="truncate text-sm">
                      {p.name}
                      {p.id === user?.id && <span className="text-ts-muted"> (siz)</span>}
                    </div>
                    <div className="truncate text-[11px] text-ts-sub">{p.position}</div>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* Yozish paneli */}
      {err && (
        <div className="flex items-center justify-between gap-2 border-t border-ts-line bg-red-500/5 px-4 py-2 text-xs text-red-600 dark:text-red-400">
          {err}
          <button type="button" onClick={() => setErr(null)} aria-label="Yopish">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="border-t border-ts-line bg-ts-card">
        <PendingList u={uploads} />
        {rec.recording ? (
          <div className="flex items-center gap-3 p-3">
            <button type="button" onClick={() => rec.stop(false)} className="rounded-md p-2 text-ts-sub hover:bg-ts-hover hover:text-red-500" title="Bekor qilish" aria-label="Bekor qilish">
              <Trash2 className="h-5 w-5" />
            </button>
            <div className="flex flex-1 items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              <span className="tabular-nums">{fmtDur(rec.elapsed)}</span>
              <span className="text-ts-muted">Yozilmoqda… (5 daqiqagacha)</span>
            </div>
            <button type="button" onClick={() => rec.stop(true)} className="flex h-10 w-10 items-center justify-center rounded-full bg-ts-blue text-white hover:opacity-90" title="Yuborish" aria-label="Ovozli xabarni yuborish">
              <Send className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <form
            className="flex items-end gap-1.5 p-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => {
              uploads.add(Array.from(e.target.files ?? []));
              e.target.value = "";
            }} />
            <button type="button" onClick={() => fileRef.current?.click()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ts-sub hover:bg-ts-hover hover:text-ts-fg" title="Fayl yoki rasm biriktirish" aria-label="Fayl biriktirish">
              <Paperclip className="h-5 w-5" />
            </button>
            <textarea
              value={text}
              rows={1}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files);
                if (files.length) {
                  e.preventDefault();
                  uploads.add(files);
                }
              }}
              placeholder="Xabar yozing…"
              className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-ts-line2 bg-ts-input px-3.5 py-2.5 text-sm leading-5 outline-none [field-sizing:content] placeholder:text-ts-muted focus:border-ts-sub"
            />
            {text.trim() || uploads.items.length ? (
              <button type="submit" disabled={!canSend} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ts-blue text-white transition hover:opacity-90 disabled:opacity-40" title="Yuborish" aria-label="Yuborish">
                {sending || uploads.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            ) : (
              <button type="button" disabled={sending} onClick={() => void rec.start()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ts-blue text-white transition hover:opacity-90 disabled:opacity-40" title="Ovozli xabar yozish" aria-label="Ovozli xabar">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
          </form>
        )}
      </div>

      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-20 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ts-blue bg-ts-card text-sm font-medium text-ts-blue">
          <Paperclip className="h-6 w-6" /> Faylni shu yerga tashlang
        </div>
      )}

      {viewer && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-black/90" onClick={() => setViewer(null)}>
          <div className="flex items-center justify-between gap-3 p-3 text-white">
            <span className="truncate text-sm">{viewer.name}</span>
            <span className="flex gap-1">
              <a href={fileUrl(viewer.id, true)} download={viewer.name} onClick={(e) => e.stopPropagation()} className="rounded-md p-2 hover:bg-white/10" aria-label="Yuklab olish">
                <Download className="h-5 w-5" />
              </a>
              <button type="button" className="rounded-md p-2 hover:bg-white/10" aria-label="Yopish">
                <X className="h-5 w-5" />
              </button>
            </span>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4">
            <img src={fileUrl(viewer.id)} alt={viewer.name} className="max-h-full max-w-full rounded object-contain" onClick={(e) => e.stopPropagation()} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── Yangi xabar: bir nechta qabul qiluvchi ───────── */

const ROLE_GROUPS: { title: string; roles: string[] }[] = [
  { title: "Dekanat", roles: ["dept_head"] },
  { title: "O'qituvchilar", roles: ["teacher"] },
  { title: "Nazoratchi", roles: ["advisor"] },
  { title: "Rahbariyat", roles: ["rector", "owner"] },
  { title: "Talabalar va ota-onalar", roles: ["student", "parent"] },
];

const TEMPLATES = [
  {
    label: "Kasallik ma'lumotnomasi",
    text: "Assalomu alaykum. Kasallik sababli ___ dan ___ gacha darslarga qatnasha olmadim. Shifokor ma'lumotnomasini ilova qilyapman. Qoldirilgan darslarni sababli deb hisoblashingizni so'rayman.",
  },
  { label: "Darsga kela olmayman", text: "Assalomu alaykum. Uzrli sabab bilan ___ kuni darsga kela olmayman. Sabab: ___." },
  { label: "Muddatni uzaytirish", text: "Assalomu alaykum. \"___\" topshirig'i muddatini ___ gacha uzaytirishingizni so'rayman. Sabab: ___." },
];

function ComposeModal({ onClose, onSent, onOpenChat }: { onClose: () => void; onSent: (chatIds: string[], n: number) => void; onOpenChat: (userId: string) => void }) {
  const { user } = useApp();
  const learner = user?.role === "student" || user?.role === "parent";
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const uploads = useUploads();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<Contact[]>("/edu/chats/contacts").then(setContacts, (e) => setLoadErr(errorText(e)));
  }, []);

  const filtered = (contacts ?? []).filter((c) => {
    const s = q.trim().toLowerCase();
    return !s || c.name.toLowerCase().includes(s) || c.position.toLowerCase().includes(s);
  });
  const toggle = (id: string) => setPicked((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  const byId = new Map((contacts ?? []).map((c) => [c.id, c]));
  const ok = picked.length > 0 && (text.trim() || uploads.ready.length) && !uploads.busy;

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ chats: string[] }>("/edu/chats/send", { body: { to: picked, text: text.trim(), attachments: uploads.ready } });
      onSent(r.chats, picked.length);
    } catch (e) {
      setErr(errorText(e));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Yangi xabar"
      footer={
        <>
          <span className="mr-auto text-xs text-ts-sub">{picked.length ? `${picked.length} ta qabul qiluvchi — har biriga shaxsiy xabar bo'lib boradi` : "Qabul qiluvchini tanlang"}</span>
          <Btn onClick={onClose}>Bekor qilish</Btn>
          <Btn variant="primary" disabled={!ok || busy} onClick={() => void submit()}>
            <Send className="h-4 w-4" /> Yuborish
          </Btn>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Qabul qiluvchilar */}
        <div className="flex min-h-0 flex-col">
          <div className="mb-2 text-sm font-medium">Kimga</div>
          {picked.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {picked.map((id) => (
                <span key={id} className="flex items-center gap-1 rounded-full bg-ts-inv py-0.5 pl-2.5 pr-1 text-xs text-ts-invfg">
                  {byId.get(id)?.name}
                  <button type="button" onClick={() => toggle(id)} className="rounded-full p-0.5 hover:bg-white/20" aria-label="Olib tashlash">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ts-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism yoki lavozim" className="h-9 w-full rounded-md border border-ts-line2 bg-ts-input pl-8 pr-3 text-sm outline-none placeholder:text-ts-muted focus:border-ts-sub" />
          </div>
          <div className="max-h-80 min-h-40 overflow-y-auto rounded-md border border-ts-line">
            {loadErr && <div className="p-3 text-xs text-red-500">{loadErr}</div>}
            {!contacts && !loadErr && (
              <div className="flex justify-center p-6 text-ts-muted">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {contacts && filtered.length === 0 && <div className="p-4 text-center text-sm text-ts-sub">Topilmadi</div>}
            {ROLE_GROUPS.map((g) => {
              const rows = filtered.filter((c) => g.roles.includes(c.role));
              if (!rows.length) return null;
              return (
                <div key={g.title}>
                  <div className="sticky top-0 bg-ts-tile px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ts-muted">{g.title}</div>
                  {rows.map((c) => {
                    const on = picked.includes(c.id);
                    return (
                      <div key={c.id} className={cn("flex items-center gap-2.5 px-3 py-2 transition hover:bg-ts-hover", on && "bg-ts-hover")}>
                        <button type="button" onClick={() => toggle(c.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                          <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", on ? "border-ts-blue bg-ts-blue text-white" : "border-ts-line2")}>{on && <Check className="h-3 w-3" />}</span>
                          <Avatar name={c.name} size={30} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm">{c.name}</span>
                            <span className="block truncate text-[11px] text-ts-sub">{c.position}</span>
                          </span>
                        </button>
                        <button type="button" onClick={() => onOpenChat(c.id)} className="shrink-0 rounded px-2 py-1 text-[11px] text-ts-sub hover:bg-ts-card hover:text-ts-fg" title="Suhbatni ochish">
                          Ochish
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Xabar */}
        <div className="flex flex-col">
          <div className="mb-2 text-sm font-medium">Xabar</div>
          {learner && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button key={t.label} type="button" onClick={() => setText(t.text)} className="rounded-full border border-ts-line px-2.5 py-1 text-xs text-ts-sub transition hover:bg-ts-hover hover:text-ts-fg">
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files);
              if (files.length) {
                e.preventDefault();
                uploads.add(files);
              }
            }}
            rows={7}
            maxLength={4000}
            placeholder="Xabar matni…"
            className="w-full resize-none rounded-md border border-ts-line2 bg-ts-input px-3 py-2 text-sm outline-none placeholder:text-ts-muted focus:border-ts-sub"
          />
          <div className="-mx-3">
            <PendingList u={uploads} />
          </div>
          <input ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => {
            uploads.add(Array.from(e.target.files ?? []));
            e.target.value = "";
          }} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Btn onClick={() => fileRef.current?.click()}>
              <Paperclip className="h-4 w-4" /> Fayl biriktirish
            </Btn>
            <span className="flex items-center gap-1 text-[11px] text-ts-muted">
              <ImageIcon className="h-3 w-3" /> PDF, Word, Excel, rasm · 15 MB gacha
            </span>
          </div>
          {err && <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{err}</div>}
        </div>
      </div>
    </Modal>
  );
}
