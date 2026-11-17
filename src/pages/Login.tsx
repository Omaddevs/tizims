import { FormEvent, useEffect, useState, type ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Bell,
  Box,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Eye,
  EyeOff,
  GraduationCap,
  LayoutDashboard,
  Lock,
  Mail,
  MessageSquare,
  Sparkles,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import { fmtDateTime } from "../lib/maintenance";
import { useApi } from "../lib/api";
import type { Maintenance } from "../data/platform";
import { cn } from "../lib/utils";

type Demo = { email: string; password: string; role: string; group: string };

/** Demo akkauntlar — faqat demo/development muhiti uchun. */
const DEMOS: Demo[] = [
  // 1-bosqich: ishga tushirilayotgan uchta rol
  { group: "1-bosqich", email: "owner@tizims.ai", password: "owner123", role: "Admin (tashkilot egasi)" },
  { group: "1-bosqich", email: "advisor@tizims.ai", password: "advisor123", role: "Nazoratchi" },
  { group: "1-bosqich", email: "student@tizims.ai", password: "student123", role: "Talaba" },
  // Keyingi bosqichlarda ishga tushadigan rollar (tizimda tayyor)
  { group: "Keyinroq qo'shiladi", email: "rector@iau.uz", password: "rector123", role: "Rektor" },
  { group: "Keyinroq qo'shiladi", email: "dean@iau.uz", password: "dean123", role: "Dekan / bo'lim rahbari" },
  { group: "Keyinroq qo'shiladi", email: "teacher@tizims.ai", password: "teacher123", role: "O'qituvchi" },
  { group: "Keyinroq qo'shiladi", email: "parent@tizims.ai", password: "parent123", role: "Ota-ona" },
  { group: "Platforma", email: "superadmin@tizims.ai", password: "super123", role: "Super Admin (platforma)" },
];

const SLIDES = [
  { title: "Ta'limni bitta tizimda boshqaring", text: "Akademik jarayon, davomat va jadval — yagona platformada." },
  { title: "AI bilan aqlli qarorlar", text: "Xavf prognozi, avtomatik hisobotlar va chuqur tahlil." },
  { title: "Har bir rol uchun alohida kirish", text: "Rektordan talabagacha — har kim faqat o'z ma'lumotini ko'radi." },
];

export function LoginPage() {
  const { login } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);

  function submit(e?: FormEvent, creds?: { email: string; password: string }) {
    e?.preventDefault();
    const em = creds?.email ?? email;
    const pw = creds?.password ?? password;
    if (!em.trim() || !pw) {
      setError("Email va parolni kiriting.");
      return;
    }
    setLoading(true);
    void login(em, pw).then((err) => {
      setError(err);
      setLoading(false);
    });
  }

  const groups = Array.from(new Set(DEMOS.map((d) => d.group)));

  return (
    <div className="min-h-screen bg-[#f4f4f6] p-3 font-sans text-neutral-950 sm:p-4">
      <style>{`@keyframes loginFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
      <div className="grid min-h-[calc(100vh-1.5rem)] gap-3 sm:min-h-[calc(100vh-2rem)] sm:gap-4 lg:grid-cols-2">
        {/* ── Chap: forma ── */}
        <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white px-5 py-8 sm:px-10">
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-[360px]">
              <div className="flex flex-col items-center text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-950 shadow-[0_8px_20px_-6px_rgba(0,0,0,0.45)]">
                  <GraduationCap className="h-6 w-6 text-white" />
                </span>
                <h1 className="mt-6 text-[24px] font-semibold tracking-[-0.01em]">Xush kelibsiz!</h1>
                <p className="mt-1.5 text-[14px] text-neutral-500">Davom etish uchun email va parolni kiriting.</p>
              </div>

              <form onSubmit={submit} className="mt-8 space-y-3">
                <Field icon={<Mail className="h-[18px] w-[18px]" />}>
                  <input
                    value={email}
                    type="email"
                    autoComplete="username"
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    className="h-full w-full bg-transparent text-[14px] text-neutral-950 outline-none placeholder:text-neutral-400"
                    placeholder="Email manzilingiz"
                  />
                </Field>
                <Field
                  icon={<Lock className="h-[18px] w-[18px]" />}
                  right={
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      className="text-neutral-400 transition hover:text-neutral-900"
                      title={show ? "Yashirish" : "Ko'rsatish"}
                    >
                      {show ? <Eye className="h-[18px] w-[18px]" /> : <EyeOff className="h-[18px] w-[18px]" />}
                    </button>
                  }
                >
                  <input
                    type={show ? "text" : "password"}
                    value={password}
                    autoComplete="current-password"
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    className="h-full w-full bg-transparent text-[14px] text-neutral-950 outline-none placeholder:text-neutral-400"
                    placeholder="Parolingiz"
                  />
                </Field>

                <div className="flex items-center justify-between pt-1 text-[13.5px]">
                  <label className="flex cursor-pointer select-none items-center gap-2 text-neutral-500">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="h-4 w-4 cursor-pointer rounded border-neutral-300 accent-neutral-950"
                    />
                    Eslab qolish
                  </label>
                  <button
                    type="button"
                    onClick={() => setError("Parolni tiklash uchun tashkilot administratoriga murojaat qiling.")}
                    className="font-medium text-neutral-950 hover:underline"
                  >
                    Parolni unutdingizmi?
                  </button>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-600">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="!mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-neutral-800 to-neutral-950 text-[14.5px] font-semibold text-white shadow-[0_10px_24px_-8px_rgba(0,0,0,0.55)] transition hover:from-neutral-700 hover:to-neutral-900 disabled:opacity-60"
                >
                  {loading ? "Tekshirilmoqda..." : "Kirish"}
                </button>
              </form>

              <MaintenanceNotice />

              {/* Demo akkauntlar */}
              <div className="mt-8">
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-neutral-200" />
                  <button
                    type="button"
                    onClick={() => setDemoOpen((v) => !v)}
                    className="flex items-center gap-1 text-[13px] text-neutral-500 transition hover:text-neutral-900"
                  >
                    Demo akkaunt bilan kirish
                    <ChevronDown className={cn("h-3.5 w-3.5 transition", demoOpen && "rotate-180")} />
                  </button>
                  <span className="h-px flex-1 bg-neutral-200" />
                </div>

                {demoOpen && (
                  <div className="mt-4 max-h-[280px] space-y-4 overflow-y-auto pr-1">
                    {groups.map((g) => (
                      <div key={g}>
                        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400">{g}</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {DEMOS.filter((d) => d.group === g).map((d) => (
                            <button
                              key={d.email}
                              type="button"
                              title={`${d.email} / ${d.password}`}
                              onClick={() => {
                                setEmail(d.email);
                                setPassword(d.password);
                                submit(undefined, d);
                              }}
                              className="group flex flex-col rounded-xl border border-neutral-200 px-3 py-2 text-left transition hover:border-neutral-300 hover:bg-neutral-50"
                            >
                              <span className="truncate text-[12.5px] font-medium text-neutral-900">{d.role}</span>
                              <span className="truncate text-[11px] text-neutral-400">{d.email}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="mt-8 text-center text-[13.5px] text-neutral-500">
                Hisobingiz yo'qmi?{" "}
                <a href="/" className="font-medium text-neutral-950 underline underline-offset-4">
                  Biz bilan bog'laning
                </a>
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-2 text-[12.5px] sm:flex-row">
            <span className="text-neutral-400">
              © {new Date().getFullYear()} Tizims.ai ·{" "}
              <a href="/status" className="hover:text-neutral-700 hover:underline">
                Tizim holati
              </a>
            </span>
            <div className="flex items-center gap-2 font-medium text-neutral-900">
              <a href="/" className="hover:underline">Maxfiylik siyosati</a>
              <span className="text-neutral-300">•</span>
              <a href="/" className="hover:underline">Foydalanish shartlari</a>
            </div>
          </div>
        </div>

        {/* ── O'ng: mahsulot ko'rinishi ── */}
        <div className="relative hidden overflow-hidden rounded-2xl bg-[#111113] lg:flex lg:flex-col">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(-35deg, transparent 0 46px, rgba(255,255,255,0.05) 46px 47px)",
              maskImage: "linear-gradient(to bottom, black, transparent 60%)",
            }}
          />
          <div className="relative flex-1 overflow-hidden pl-10 pt-12">
            <AppMock />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#111113] via-[#111113]/90 to-transparent" />
          </div>

          <div className="relative px-10 pb-10 text-center">
            <div key={slide} className="animate-[loginFade_.5s_ease-out]">
              <h2 className="text-[26px] font-medium tracking-[-0.01em] text-white">{SLIDES[slide].title}</h2>
              <p className="mt-2 text-[14px] text-white/50">{SLIDES[slide].text}</p>
            </div>
            <div className="mt-7 flex justify-center gap-2.5">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  aria-label={`Slayd ${i + 1}`}
                  className={cn("h-1.5 rounded-full transition-all", i === slide ? "w-5 bg-white" : "w-1.5 bg-white/25 hover:bg-white/40")}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, right, children }: { icon: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex h-[52px] items-center rounded-xl border border-neutral-200 bg-white text-neutral-500 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition focus-within:border-neutral-400 focus-within:ring-4 focus-within:ring-neutral-100">
      <span className="flex h-full items-center border-r border-neutral-200 px-3.5">{icon}</span>
      <span className="flex h-full flex-1 items-center gap-2 px-3.5">
        {children}
        {right}
      </span>
    </label>
  );
}

/** O'ng paneldagi dekorativ ilova ko'rinishi */
function AppMock() {
  const side = [LayoutDashboard, BarChart3, Users, CalendarDays, Bell, Box, MessageSquare, Wallet];
  const modules = [
    { icon: ClipboardCheck, t: "Davomat" },
    { icon: CalendarDays, t: "Dars jadvali" },
    { icon: BookOpen, t: "Baholar" },
    { icon: MessageSquare, t: "Xabarlar" },
    { icon: Wallet, t: "To'lovlar" },
  ];
  const ai = [
    { icon: Sparkles, t: "Xavf prognozi" },
    { icon: BarChart3, t: "Hisobotlar" },
    { icon: Users, t: "Talabalar tahlili" },
  ];
  return (
    <div className="flex gap-3 rounded-tl-2xl border-l border-t border-white/10 bg-white/[0.03] p-3 shadow-2xl">
      {/* sidebar */}
      <div className="flex w-12 shrink-0 flex-col items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
          <GraduationCap className="h-4 w-4 text-black" />
        </span>
        {side.map((I, i) => (
          <I key={i} className={cn("h-4 w-4", i === 2 ? "text-white" : "text-white/40")} />
        ))}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center gap-2 px-1 text-[11.5px] text-white/40">
          <span>Boshqaruv</span>
          <span>/</span>
          <span className="text-white/70">IAU · Rektor paneli</span>
        </div>
        <div className="flex gap-3">
          {/* modullar */}
          <div className="w-52 shrink-0 rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div className="text-[13px] font-medium text-white">Modullar</div>
            <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-white/40">Ta'lim</div>
            <div className="mt-2 space-y-0.5">
              {modules.map((m) => (
                <div key={m.t} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[12px] text-white/55">
                  <m.icon className="h-3.5 w-3.5" />
                  {m.t}
                </div>
              ))}
            </div>
            <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-white/40">AI</div>
            <div className="mt-2 space-y-0.5">
              {ai.map((m) => (
                <div key={m.t} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[12px] text-white/55">
                  <m.icon className="h-3.5 w-3.5" />
                  {m.t}
                </div>
              ))}
            </div>
          </div>

          {/* kontent */}
          <div className="min-w-0 flex-1 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {[
                { l: "Talabalar", v: "4 820" },
                { l: "Davomat", v: "94.2%" },
                { l: "O'rtacha ball", v: "4.31" },
              ].map((s) => (
                <div key={s.l} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="text-[11px] text-white/40">{s.l}</div>
                  <div className="mt-1 text-[18px] font-semibold text-white">{s.v}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-white/60">Haftalik davomat</span>
                <span className="text-[11px] text-emerald-400">+2.4%</span>
              </div>
              <div className="mt-4 flex h-28 items-end gap-2">
                {[62, 78, 70, 88, 82, 94, 90].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-white/10 to-white/40" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06]">
                <Sparkles className="h-4 w-4 text-white" />
              </span>
              <div className="min-w-0">
                <div className="text-[12px] text-white">AI tahlil tayyor</div>
                <div className="truncate text-[11px] text-white/40">12 nafar talabada o'zlashtirish xavfi aniqlandi</div>
              </div>
              <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Super admin rejalashtirgan texnik ish haqida ogohlantirish (7 kun oldin ko'rinadi). */
function MaintenanceNotice() {
  const q = useApi<{ maintenance: Maintenance | null }>("/public/status");
  const m = q.data?.maintenance;
  if (!m) return null;
  return (
    <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[13px] text-amber-900">
      <Wrench className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="font-medium">Rejali texnik ish</div>
        <div className="text-amber-800/80">
          {fmtDateTime(m.start)} — {fmtDateTime(m.end)}: {m.title}.{" "}
          <a href="/status" className="underline underline-offset-2">
            Holat sahifasi
          </a>
        </div>
      </div>
    </div>
  );
}
