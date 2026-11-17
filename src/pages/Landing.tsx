import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BatteryFull,
  Bell,
  BookOpen,
  Brain,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  Instagram,
  KeyRound,
  Landmark,
  Library,
  ListChecks,
  Mail,
  MapPin,
    MessageSquareWarning,
  MessagesSquare,
  Network,
  Phone,
  Plus,
  School,
  Send,
  ShieldCheck,
  Signal,
  Sparkles,
  TrendingUp,
  UserCheck,
  Wifi,
  Users,
  Youtube,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Logo } from "../components/Logo";
import { LandingNavbar, TopBar } from "../components/LandingHeader";

/* ───────────────────────── Ma'lumotlar ───────────────────────── */

const AUDIENCE = [
  { icon: Landmark, label: "Universitetlar" },
  { icon: School, label: "Xususiy maktablar" },
  { icon: GraduationCap, label: "O'quv markazlari" },
  { icon: Building2, label: "Kollej va texnikumlar" },
  { icon: BookOpen, label: "Akademiyalar" },
];

const FEATURES = [
  { icon: Network, title: "Tashkilot boshqaruvi", en: "Organization Management", text: "Filiallar, fakultetlar, kafedralar va bo'limlarni yagona ierarxiyada boshqaring.", tone: "bg-[#f3f4fb]" },
  { icon: KeyRound, title: "Rollar va vakolatlar", en: "Role & Permission", text: "Har bir foydalanuvchi uchun individual rol va aniq vakolatlar yarating.", tone: "bg-[#fbf9ec]" },
  { icon: Users, title: "O'quvchi va o'qituvchilar", en: "Student & Teacher", text: "O'quvchi va o'qituvchilarning to'liq raqamli profillari bir joyda.", tone: "bg-[#fcf1f6]" },
  { icon: GraduationCap, title: "Akademik boshqaruv", en: "Academic Management", text: "Guruhlar, fanlar, kurslar, semestrlar va o'quv rejalarini yuriting.", tone: "bg-[#eef7f2]" },
  { icon: UserCheck, title: "Davomat nazorati", en: "Attendance", text: "Davomat, kechikish va davomatsizlikni real vaqtda nazorat qiling.", tone: "bg-[#f3f4fb]" },
  { icon: CalendarClock, title: "Smart jadval", en: "Smart Timetable", text: "Dars jadvali, o'qituvchilar yuklamasi va xonalar bandligi avtomatik.", tone: "bg-[#fbf9ec]" },
  { icon: ClipboardCheck, title: "Imtihon va baholash", en: "Examination & Grading", text: "Testlar, imtihonlar, baholar va akademik natijalarni boshqaring.", tone: "bg-[#fcf1f6]" },
  { icon: Library, title: "LMS va e-kutubxona", en: "LMS & E-Library", text: "Dars materiallari, topshiriqlar, elektron kutubxona va online ta'lim.", tone: "bg-[#eef7f2]" },
  { icon: MessagesSquare, title: "Ichki kommunikatsiya", en: "Internal Communication", text: "Xodimlar, o'qituvchilar va o'quvchilar uchun yagona chat tizimi.", tone: "bg-[#f3f4fb]" },
  { icon: ListChecks, title: "Topshiriq va jarayonlar", en: "Task & Workflow", text: "Topshiriqlar, muddatlar, hisobotlar va ish jarayonlarini kuzating.", tone: "bg-[#fbf9ec]" },
  { icon: MessageSquareWarning, title: "Murojaatlar", en: "Complaint Management", text: "Shikoyat va murojaatlar tegishli bo'limlar orqali ko'rib chiqiladi.", tone: "bg-[#fcf1f6]" },
  { icon: Bell, title: "Bildirishnomalar", en: "Notification System", text: "Barcha muhim voqealar bo'yicha avtomatik bildirishnomalar.", tone: "bg-[#eef7f2]" },
];

const STEPS = [
  { n: "01", title: "Tashkilotni yarating", text: "Muassasangizni ro'yxatdan o'tkazing va filial, fakultet, bo'limlarni qo'shing." },
  { n: "02", title: "Rollarni taqsimlang", text: "Xodimlarga lavozim va vakolat bering — har kim faqat o'ziga keraklisini ko'radi." },
  { n: "03", title: "Jarayonlarni yuriting", text: "Jadval, davomat, baholash va topshiriqlar bitta tizimda ishlaydi." },
  { n: "04", title: "AI bilan tahlil qiling", text: "Muammolarni erta aniqlang va qarorlarni ma'lumotga tayanib qabul qiling." },
];

const FAQ = [
  { q: "TIZIMS.AI qanday muassasalar uchun mo'ljallangan?", a: "Universitetlar, xususiy maktablar, o'quv markazlari, kollejlar va boshqa ta'lim muassasalari uchun. Har bir muassasa o'z tuzilmasiga mos konfiguratsiya qiladi." },
  { q: "Ma'lumotlarimiz xavfsizmi?", a: "Ha. Har bir tashkilot ma'lumotlari alohida saqlanadi, kirish rollar va vakolatlar orqali cheklanadi, barcha amallar jurnalga yoziladi." },
  { q: "Mavjud ma'lumotlarni ko'chirib o'tsa bo'ladimi?", a: "Ha. O'quvchilar, xodimlar, guruhlar va fanlar ro'yxatini Excel orqali import qilish mumkin, jamoamiz ko'chirishda yordam beradi." },
  { q: "Faqat kerakli modullarni yoqsa bo'ladimi?", a: "Albatta. Davomat, jadval, LMS, kommunikatsiya va boshqa modullar alohida yoqiladi — muassasa o'sishi bilan kengaytiriladi." },
  { q: "AI tahlil nimalarni ko'rsatadi?", a: "Davomat va o'zlashtirish dinamikasi, xavf guruhidagi o'quvchilar, o'qituvchilar yuklamasi va bo'limlar samaradorligi bo'yicha tavsiyalar." },
  { q: "Qaysi qurilmalarda ishlaydi?", a: "Brauzer orqali kompyuter, planshet va telefonda ishlaydi. Alohida o'rnatish talab qilinmaydi." },
];

/* ───────────────────────── Yordamchi komponentlar ───────────────────────── */

function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600", className)}>
      {children}
    </span>
  );
}

function SectionHead({ eyebrow, title, text, center }: { eyebrow?: string; title: ReactNode; text?: string; center?: boolean }) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow && <Pill className="mb-5">{eyebrow}</Pill>}
      <h2 className="text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] text-neutral-950 sm:text-5xl">{title}</h2>
      {text && <p className="mt-5 text-[15px] leading-relaxed text-neutral-500 sm:text-base">{text}</p>}
    </div>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[15px] text-neutral-800">
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-neutral-950" strokeWidth={2.5} />
      {children}
    </li>
  );
}

function PrimaryBtn({ to, children, light }: { to: string; children: ReactNode; light?: boolean }) {
  return (
    <Link
      to={to}
      className={cn(
        "group inline-flex h-12 items-center gap-2 rounded-full px-6 text-sm font-semibold transition",
        light ? "bg-white text-neutral-950 hover:bg-neutral-200" : "bg-neutral-950 text-white hover:bg-neutral-800",
      )}
    >
      {children}
      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
    </Link>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

const FLOAT_CARD =
  "rounded-2xl border border-neutral-200/70 bg-white shadow-[0_24px_48px_-16px_rgba(0,0,0,0.18)]";

function PhoneMock() {
  const people = [
    ["MA", "Malika Azimova", "10-A · Matematika", "98%"],
    ["JR", "Jasur Rahimov", "11-B · Fizika", "95%"],
    ["DS", "Dilnoza Sobirova", "9-C · Ingliz tili", "91%"],
    ["OT", "Otabek To'xtayev", "10-B · Kimyo", "88%"],
  ] as const;
  return (
    <div className="relative mx-auto w-[330px] sm:w-[380px]">
      {/* Orqa fon nuri */}
      <div className="pointer-events-none absolute left-1/2 top-20 h-[460px] w-[520px] -translate-x-1/2 rounded-full bg-neutral-200/60 blur-3xl" />

      {/* Telefon — pastdan bo'lim chizig'ida kesiladi */}
      <div className="ts-reveal-lg relative h-[560px] overflow-hidden sm:h-[620px]">
        <div className="relative rounded-t-[60px] bg-neutral-950 px-[13px] pt-[13px] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.35)]">
          {/* Yon tugmalar */}
          <span className="absolute -left-[3px] top-[130px] h-9 w-[3px] rounded-l-sm bg-neutral-800" />
          <span className="absolute -left-[3px] top-[190px] h-16 w-[3px] rounded-l-sm bg-neutral-800" />
          <span className="absolute -right-[3px] top-[200px] h-24 w-[3px] rounded-r-sm bg-neutral-800" />

          <div className="relative h-[720px] rounded-t-[48px] bg-white">
            {/* Dynamic island */}
            <div className="absolute left-1/2 top-[11px] z-10 h-[34px] w-[112px] -translate-x-1/2 rounded-full bg-neutral-950">
              <span className="absolute right-3 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-neutral-800" />
            </div>
            {/* Status bar */}
            <div className="flex items-center justify-between px-8 pt-[19px] text-[14px] font-semibold text-neutral-950">
              <span>9:41</span>
              <span className="flex items-center gap-1.5">
                <Signal className="h-3.5 w-3.5" strokeWidth={2.5} />
                <Wifi className="h-3.5 w-3.5" strokeWidth={2.5} />
                <BatteryFull className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>
            </div>

            <div className="px-7 pt-12">
              <p className="text-[11px] text-neutral-400">Jami o'quvchilar</p>
              <p className="mt-1 text-[40px] font-semibold leading-none tracking-[-0.03em] text-neutral-950">12,480</p>

              <div className="mt-6 flex w-max rounded-xl bg-neutral-100 p-1 text-[12px] font-semibold">
                <span className="flex items-center gap-1.5 rounded-lg bg-neutral-950 px-4 py-2 text-white">
                  <BarChart3 className="h-3.5 w-3.5" /> Davomat
                </span>
                <span className="px-4 py-2 text-neutral-500">Baholar</span>
              </div>

              <div className="mt-7 flex items-end justify-between">
                <div>
                  <p className="text-[11px] text-neutral-400">Bugungi davomat</p>
                  <p className="mt-1 text-[32px] font-semibold leading-none tracking-[-0.03em] text-neutral-950">
                    94.2<span className="text-neutral-300">%</span>
                  </p>
                </div>
                <span className="rounded-full bg-neutral-100 px-3.5 py-1.5 text-[11px] font-semibold text-neutral-700">Hisobot</span>
              </div>

              <div className="mt-8 divide-y divide-neutral-100">
                {people.map(([ini, name, meta, val]) => (
                  <div key={name} className="flex items-center gap-3 py-3.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-700">{ini}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-neutral-900">{name}</p>
                      <p className="truncate text-[11px] text-neutral-400">{meta}</p>
                    </div>
                    <span className="text-[13px] font-semibold tabular-nums text-neutral-950">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Suzuvchi kartalar */}
      <div className="ts-reveal absolute left-[calc(100%-100px)] top-[118px] hidden md:block lg:hidden xl:block" style={{ animationDelay: "350ms" }}>
        <div className={cn(FLOAT_CARD, "ts-float w-[220px] px-5 py-4")}>
          <p className="flex items-center gap-2 text-[12px] text-neutral-400">
            <span className="h-2 w-2 rounded-full bg-neutral-950" /> Bugun keldi
          </p>
          <p className="mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.02em] text-neutral-950">11,756</p>
        </div>
      </div>

      <div className="ts-reveal absolute right-[calc(100%-210px)] top-[440px] hidden md:block lg:hidden xl:block" style={{ animationDelay: "550ms" }}>
        <div className={cn(FLOAT_CARD, "ts-float grid w-[370px] grid-cols-2 divide-x divide-neutral-100 [animation-delay:-3s]")}>
          <div className="px-5 py-4">
            <p className="flex items-center gap-2 text-[12px] text-neutral-500">
              <TrendingUp className="h-3.5 w-3.5 text-neutral-400" /> O'rtacha baho
            </p>
            <p className="mt-2 text-[24px] font-semibold leading-none tracking-[-0.02em] text-neutral-950">4.38</p>
            <p className="mt-2 text-[11px] text-neutral-400">
              <span className="font-semibold text-emerald-600">↗ 6.2%</span> semestrga nisbatan
            </p>
          </div>
          <div className="px-5 py-4">
            <p className="flex items-center gap-2 text-[12px] text-neutral-500">
              <Sparkles className="h-3.5 w-3.5 text-neutral-400" /> AI ogohlantirish
            </p>
            <p className="mt-2 text-[24px] font-semibold leading-none tracking-[-0.02em] text-neutral-950">37</p>
            <p className="mt-2 text-[11px] text-neutral-400">
              <span className="font-semibold text-rose-500">↘ 12%</span> xavf guruhida
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_75%_30%,#eef0f6_0%,rgba(255,255,255,0)_70%)]" />
      <div className="landing-container relative grid items-end gap-14 pt-12 lg:grid-cols-2 lg:pt-14">
        <div className="self-center lg:pb-14">
          <Pill>
            <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">AI</span>
            Education Operating System
          </Pill>
          <h1 className="ts-reveal mt-7 text-[42px] font-semibold leading-[1.05] tracking-[-0.03em] text-neutral-950 sm:text-6xl xl:text-[68px]">
            Ta'limning barcha
            <br />
            jarayonlari — <span className="text-neutral-400">bitta tizimda</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-relaxed text-neutral-500 sm:text-lg">
            TIZIMS.AI universitetlar, maktablar va o'quv markazlarining boshqaruv, ta'lim va ichki kommunikatsiya jarayonlarini yagona raqamli ekotizimda birlashtiradi.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <PrimaryBtn to="/login">Hoziroq boshlash</PrimaryBtn>
            <a href="#imkoniyatlar" className="inline-flex h-12 items-center rounded-full border border-neutral-200 bg-white px-6 text-sm font-semibold text-neutral-900 transition hover:border-neutral-400">
              Batafsil ko'rish
            </a>
          </div>
          <div className="mt-12 flex items-center gap-6 text-sm text-neutral-500">
            <span className="flex items-center gap-2"><Check className="h-4 w-4 text-neutral-950" /> 13 ta modul</span>
            <span className="flex items-center gap-2"><Check className="h-4 w-4 text-neutral-950" /> Rol asosidagi kirish</span>
            <span className="hidden items-center gap-2 sm:flex"><Check className="h-4 w-4 text-neutral-950" /> AI tahlil</span>
          </div>
        </div>
        <div className="self-end">
          <PhoneMock />
        </div>
      </div>

      {/* Kimlar uchun */}
      <div className="landing-container relative border-t border-neutral-200/70 py-10">
        <p className="mb-7 text-center text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">Har qanday ta'lim muassasasi uchun</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
          {AUDIENCE.map(({ icon: I, label }) => (
            <div key={label} className="flex items-center justify-center gap-2.5 text-neutral-400 transition hover:text-neutral-950">
              <I className="h-6 w-6" strokeWidth={1.8} />
              <span className="text-base font-semibold tracking-tight sm:text-lg">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Tashkilot va rollar ───────────────────────── */

function OrgSection() {
  const tree = [
    { name: "Toshkent filiali", sub: ["Iqtisodiyot fakulteti", "IT fakulteti"] },
    { name: "Samarqand filiali", sub: ["Pedagogika fakulteti"] },
  ];
  return (
    <section id="jarayon" className="landing-container grid items-center gap-14 py-20 lg:grid-cols-2 lg:py-28">
      <div id="rollar" className="relative scroll-mt-28 rounded-[32px] bg-neutral-100 p-6 sm:p-10">
        <div className="rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-900">Tashkilot tuzilmasi</p>
            <span className="text-[11px] text-neutral-400">3 daraja</span>
          </div>
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-neutral-950 px-4 py-3 text-white">
            <Landmark className="h-4 w-4" />
            <span className="text-sm font-semibold">Xalqaro Universitet</span>
            <span className="ml-auto text-[11px] text-white/60">4 820 kishi</span>
          </div>
          <div className="mt-3 space-y-3 border-l border-dashed border-neutral-300 pl-5">
            {tree.map((b) => (
              <div key={b.name}>
                <div className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm font-medium text-neutral-800">
                  <Building2 className="h-4 w-4 text-neutral-400" /> {b.name}
                </div>
                <div className="mt-2 space-y-2 pl-6">
                  {b.sub.map((s) => (
                    <div key={s} className="flex items-center gap-2 text-[13px] text-neutral-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" /> {s}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-6 text-center text-sm font-semibold text-neutral-800">Rollar va vakolatlar</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {["Rektor", "Dekan", "O'qituvchi", "Kurator", "O'quvchi"].map((r, i) => (
            <span key={r} className={cn("rounded-xl px-3 py-2 text-xs font-semibold", i === 0 ? "bg-neutral-950 text-white" : "bg-white text-neutral-700")}>
              {r}
            </span>
          ))}
        </div>
      </div>

      <div>
        <SectionHead
          eyebrow="Qanday ishlaydi"
          title={<>Muassasangizni o'z qoidalari bilan boshqaring</>}
          text="Har bir ta'lim muassasasi o'z tashkilotini yaratadi, ichki bo'limlar va boshqaruv ierarxiyasini shakllantiradi, xodimlarga lavozim va vakolatlar beradi."
        />
        <ol className="mt-10 space-y-6">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-5">
              <span className="text-sm font-semibold tabular-nums text-neutral-300">{s.n}</span>
              <div>
                <p className="font-semibold text-neutral-950">{s.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-neutral-500">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-10">
          <PrimaryBtn to="/login">Tashkilot yaratish</PrimaryBtn>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── AI analitika ───────────────────────── */

function Donut() {
  const rings = [
    { r: 70, v: 0.82, c: "#a5d8f3" },
    { r: 56, v: 0.68, c: "#b7b4f0" },
    { r: 42, v: 0.54, c: "#f3dc93" },
  ];
  return (
    <svg viewBox="0 0 180 180" className="h-40 w-40">
      {rings.map((g) => {
        const L = 2 * Math.PI * g.r;
        return (
          <g key={g.r}>
            <circle cx="90" cy="90" r={g.r} fill="none" stroke="#f3f3f3" strokeWidth="9" />
            <circle cx="90" cy="90" r={g.r} fill="none" stroke={g.c} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${L * g.v} ${L}`} transform="rotate(-90 90 90)" />
          </g>
        );
      })}
      <text x="90" y="96" textAnchor="middle" className="fill-neutral-950 text-[20px] font-semibold">87%</text>
    </svg>
  );
}

function AnalyticsSection() {
  const bars = [
    [60, 40], [80, 55], [45, 70], [90, 62], [70, 85], [50, 38], [85, 66],
  ];
  return (
    <section className="bg-neutral-50/70">
      <div className="landing-container grid items-center gap-14 py-20 lg:grid-cols-2 lg:py-28">
        <div className="order-2 lg:order-1">
          <SectionHead
            eyebrow="Analytics & AI"
            title={<>Qarorlarni taxmin emas, ma'lumot asosida qabul qiling</>}
            text="TIZIMS.AI ta'lim jarayonlarini tahlil qiladi, muammolarni erta aniqlaydi va rahbariyatga aniq tavsiyalar beradi."
          />
          <ul className="mt-9 space-y-4">
            <Bullet>Davomat va o'zlashtirish dinamikasi real vaqtda</Bullet>
            <Bullet>Xavf guruhidagi o'quvchilarni avtomatik aniqlash</Bullet>
            <Bullet>O'qituvchilar yuklamasi va bo'limlar samaradorligi</Bullet>
            <Bullet>Bir bosishda tayyor hisobotlar</Bullet>
          </ul>
          <div className="mt-10">
            <PrimaryBtn to="/login">Analitikani ko'rish</PrimaryBtn>
          </div>
        </div>

        <div className="relative order-1 mx-auto h-[440px] w-full max-w-[520px] lg:order-2">
          <div className="absolute right-0 top-0 w-[300px] rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.18)]">
            <p className="text-[12px] text-neutral-500">Fakultetlar bo'yicha o'zlashtirish</p>
            <div className="mt-2 flex items-center gap-4">
              <Donut />
              <div className="space-y-2 text-[11px]">
                {[["IT", "#a5d8f3", "92%"], ["Iqtisod", "#b7b4f0", "84%"], ["Pedagogika", "#f3dc93", "79%"]].map(([n, c, v]) => (
                  <div key={n} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: c }} />
                    <span className="text-neutral-500">{n}</span>
                    <span className="ml-auto font-semibold text-neutral-900">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="absolute bottom-6 left-0 w-[290px] rounded-3xl border border-neutral-100 bg-white p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.18)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] text-neutral-500">Haftalik davomat</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">18.4K <span className="text-[11px] font-medium text-emerald-600">↗ 3.1%</span></p>
              </div>
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] text-neutral-500">7 kun</span>
            </div>
            <div className="mt-5 flex h-28 items-end gap-2.5">
              {bars.map(([a, b], i) => (
                <div key={i} className="flex h-full flex-1 items-end gap-0.5">
                  <div className="flex-1 rounded-sm bg-neutral-950" style={{ height: `${a}%` }} />
                  <div className="flex-1 rounded-sm bg-neutral-300" style={{ height: `${b}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-4 text-[10px] text-neutral-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-neutral-950" /> Keldi</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-neutral-300" /> Kechikdi</span>
            </div>
          </div>
          <div className="absolute bottom-0 right-2 w-[200px] rounded-3xl border border-neutral-100 bg-white p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.18)]">
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-neutral-500">Xavf guruhi</p>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-orange-100"><Brain className="h-3.5 w-3.5 text-orange-600" /></span>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">37 <span className="text-[11px] font-medium text-neutral-400">o'quvchi</span></p>
            <p className="mt-1 text-[11px] text-red-500">↘ 9 ta kamaydi</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Imkoniyatlar ───────────────────────── */

function Features() {
  return (
    <section id="imkoniyatlar" className="landing-container py-20 lg:py-28">
      <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-end">
        <SectionHead
          eyebrow="Imkoniyatlar"
          title="Bitta platforma. Barcha ta'lim jarayonlari."
        />
        <p className="max-w-sm text-[15px] leading-relaxed text-neutral-500">
          Kerakli modullarni yoqing — muassasangiz o'sishi bilan tizim ham kengayadi.
        </p>
      </div>
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ icon: I, title, en, text, tone }) => (
          <div key={title} className={cn("group flex min-h-[260px] flex-col rounded-[28px] p-6 transition hover:-translate-y-1", tone)}>
            <div className="flex items-start justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white">
                <I className="h-5 w-5 text-neutral-900" strokeWidth={1.8} />
              </span>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/70 transition group-hover:bg-neutral-950 group-hover:text-white">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-auto pt-10">
              <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">{en}</p>
              <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-neutral-950">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">{text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-col items-start justify-between gap-6 rounded-[28px] bg-neutral-950 p-8 text-white sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><Brain className="h-6 w-6" /></span>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/50">Analytics & AI</p>
            <p className="mt-1 text-xl font-semibold tracking-tight">Barcha modullar ustida ishlaydigan sun'iy intellekt</p>
          </div>
        </div>
        <PrimaryBtn to="/login" light>Sinab ko'rish</PrimaryBtn>
      </div>
    </section>
  );
}

/* ───────────────────────── Maqsad / raqamlar ───────────────────────── */

function Mission() {
  const stats = [
    ["13", "integratsiyalashgan modul"],
    ["1", "yagona raqamli infratuzilma"],
    ["4", "rol darajasi: rahbar, xodim, o'qituvchi, o'quvchi"],
    ["24/7", "real vaqtda nazorat"],
  ];
  return (
    <section id="statistika" className="landing-container scroll-mt-28 pb-20 lg:pb-28">
      <div className="grid gap-10 border-y border-neutral-200 py-14 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <Pill className="mb-5"><ShieldCheck className="h-3.5 w-3.5" /> Maqsadimiz</Pill>
          <p className="text-2xl font-semibold leading-snug tracking-tight text-neutral-950 sm:text-3xl">
            Inson omiliga bog'liq xatolarni kamaytirish, boshqaruv samaradorligini oshirish va ta'lim sifatini yaxshilash.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-neutral-200">
          {stats.map(([v, l]) => (
            <div key={l} className="bg-white p-6 sm:p-8">
              <p className="text-4xl font-semibold tracking-[-0.03em] text-neutral-950 sm:text-5xl">{v}</p>
              <p className="mt-2 text-sm text-neutral-500">{l}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── FAQ ───────────────────────── */

function Faq() {
  const [open, setOpen] = useState(1);
  return (
    <section id="savollar" className="landing-container pb-20 lg:pb-28">
      <SectionHead center title="Ko'p beriladigan savollar" text="Eng ko'p so'raladigan savollarga javoblar." />
      <div className="mt-14 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="divide-y divide-neutral-200 border-y border-neutral-200">
          {FAQ.map((f, i) => {
            const on = open === i;
            return (
              <div key={f.q}>
                <button onClick={() => setOpen(on ? -1 : i)} className="flex w-full items-center justify-between gap-6 py-6 text-left">
                  <span className="text-base font-medium text-neutral-950 sm:text-lg">{f.q}</span>
                  <Plus className={cn("h-5 w-5 shrink-0 text-neutral-500 transition", on && "rotate-45 text-neutral-950")} />
                </button>
                <div className={cn("grid transition-all duration-300", on ? "grid-rows-[1fr] pb-6" : "grid-rows-[0fr]")}>
                  <p className="overflow-hidden pr-10 text-[15px] leading-relaxed text-neutral-500">{f.a}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex h-fit flex-col items-center rounded-[28px] bg-neutral-100 p-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white"><MessagesSquare className="h-5 w-5" /></span>
          <p className="mt-5 text-xl font-semibold tracking-tight text-neutral-950">Javob topa olmadingizmi?</p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">Bizga yozing — jamoamiz tez orada siz bilan bog'lanadi.</p>
          <a href="#aloqa" className="mt-6 inline-flex h-11 items-center rounded-full bg-neutral-950 px-6 text-sm font-semibold text-white transition hover:bg-neutral-800">
            Bog'lanish
          </a>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── CTA ───────────────────────── */

function Burst() {
  const lines = Array.from({ length: 36 }, (_, i) => {
    const a = (i / 36) * Math.PI * 2;
    const len = 60 + ((i * 37) % 5) * 22;
    return [Math.cos(a) * 10, Math.sin(a) * 10, Math.cos(a) * len, Math.sin(a) * len];
  });
  return (
    <svg viewBox="-160 -160 320 320" className="h-full w-full" aria-hidden>
      {lines.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeOpacity={0.35} strokeWidth={1} />
      ))}
      <circle r="6" fill="white" fillOpacity={0.7} />
    </svg>
  );
}

function Cta() {
  return (
    <section className="landing-container pb-20">
      <div className="relative overflow-hidden rounded-[36px] bg-neutral-950 px-6 py-20 text-center text-white sm:px-12 sm:py-28">
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80"><Burst /></div>
        <svg className="pointer-events-none absolute right-10 top-10 hidden h-24 w-24 text-white/10 sm:block" viewBox="0 0 100 100" aria-hidden>
          <path d="M10 15h80L50 85z" fill="currentColor" />
        </svg>
        <h2 className="relative mx-auto max-w-3xl text-[36px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-6xl">
          Muassasangizni bugunoq raqamlashtiring
        </h2>
        <p className="relative mx-auto mt-6 max-w-xl text-base text-white/60">
          TIZIMS.AI — One Platform. Every Educational Process. Ta'limning barcha jarayonlari — bitta tizimda.
        </p>
        <div className="relative mt-10 flex flex-wrap justify-center gap-3">
          <PrimaryBtn to="/login" light>Hoziroq boshlash</PrimaryBtn>
          <a href="#aloqa" className="inline-flex h-12 items-center rounded-full border border-white/20 px-6 text-sm font-semibold transition hover:bg-white/10">
            Demo so'rash
          </a>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Footer ───────────────────────── */

function Footer() {
  const cols = [
    { t: "Platforma", l: [["Imkoniyatlar", "#imkoniyatlar"], ["Qanday ishlaydi", "#jarayon"], ["Savollar", "#savollar"]] },
    { t: "Modullar", l: [["Akademik boshqaruv", "#imkoniyatlar"], ["Smart jadval", "#imkoniyatlar"], ["LMS va e-kutubxona", "#imkoniyatlar"]] },
    { t: "Kompaniya", l: [["Biz haqimizda", "#top"], ["Maxfiylik siyosati", "#"], ["Foydalanish shartlari", "#"]] },
  ];
  const socials = [
    { i: Send, l: "Telegram" },
    { i: Instagram, l: "Instagram" },
    { i: Youtube, l: "YouTube" },
  ];
  return (
    <footer id="aloqa" className="bg-neutral-100">
      <div className="landing-container grid gap-12 py-16 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr]">
        <div>
          <Logo size={24} />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-neutral-500">
            Ta'lim muassasalari uchun AI-powered Education Management Platform.
          </p>
          <div className="mt-6 flex gap-2">
            {socials.map(({ i: I, l }) => (
              <a key={l} href="#" aria-label={l} className="grid h-10 w-10 place-items-center rounded-full bg-white text-neutral-700 transition hover:bg-neutral-950 hover:text-white">
                <I className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
        {cols.map((c) => (
          <div key={c.t}>
            <p className="text-sm font-semibold text-neutral-950">{c.t}</p>
            <ul className="mt-5 space-y-3">
              {c.l.map(([l, h]) => (
                <li key={l}><a href={h} className="text-sm text-neutral-500 transition hover:text-neutral-950">{l}</a></li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <p className="text-sm font-semibold text-neutral-950">Aloqa</p>
          <ul className="mt-5 space-y-3 text-sm text-neutral-500">
            <li className="flex items-center gap-2"><Phone className="h-4 w-4" /> +998 87 735 36 36</li>
            <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> info@tizims.uz</li>
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Toshkent, O'zbekiston</li>
          </ul>
        </div>
      </div>
      <div className="bg-neutral-950 py-5 text-center text-xs text-white/60">
        © {new Date().getFullYear()} TIZIMS.AI. Barcha huquqlar himoyalangan.
      </div>
    </footer>
  );
}

/* ───────────────────────── Sahifa ───────────────────────── */

export function Landing() {
  const [lowVision, setLowVision] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    html.classList.remove("dark");
    html.style.scrollBehavior = "smooth";
    return () => {
      if (wasDark) html.classList.add("dark");
      html.style.scrollBehavior = "";
    };
  }, []);

  return (
    <div className={cn("ts-light-scope min-h-screen bg-white font-sans text-neutral-950 antialiased", lowVision && "grayscale contrast-125")}>
      <TopBar lowVision={lowVision} onLowVision={() => setLowVision((v) => !v)} />
      <LandingNavbar />
      <main>
        <Hero />
        <OrgSection />
        <AnalyticsSection />
        <Features />
        <Mission />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}

export default Landing;
