/**
 * TIZIMS.AI — Ta'lim analitikasi dashboard demo ma'lumotlari (PaceUI "Customer Analytics" tuzilmasi).
 * Faqat demo/development muhiti uchun. Backend ulanganda shu shakldagi API javoblari bilan almashtiriladi.
 */
import type { Role } from "../types";

export type IconKey =
  | "users"
  | "userCheck"
  | "userPlus"
  | "cap"
  | "book"
  | "calendar"
  | "wallet"
  | "door"
  | "search"
  | "share"
  | "mail"
  | "globe"
  | "megaphone"
  | "gift"
  | "clipboard"
  | "award"
  | "clock";

export interface Kpi {
  title: string;
  value: string;
  delta: string;
  caption: string;
  icon: IconKey;
  link: string;
}

export interface StreamBadge {
  top: string;
  bottom: string;
  primary?: boolean;
}

export interface Acquisition {
  title: string;
  description: string;
  stats: { value: string; suffix: string; label: string }[];
  liveLabel: string;
  liveBase: number;
  badges: StreamBadge[];
  topHint: string;
  bottomHint: string;
}

export interface Growth {
  title: string;
  description: string;
  aLabel: string;
  bLabel: string;
  monthly: { labels: string[]; a: number[]; b: number[] };
  quarterly: { labels: string[]; a: number[]; b: number[] };
}

export type RowStatus = "active" | "warning" | "suspended" | "inactive";

export interface DirectoryRow {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: RowStatus;
  date: string;
}

export interface Directory {
  title: string;
  placeholder: string;
  columns: [string, string, string, string, string];
  statusLabels: Record<RowStatus, string>;
  rows: DirectoryRow[];
  canChangeStatus: boolean;
  /** Ro'yxat serverdan olinganda — talaba profili va holatini o'zgartirish shu sahifada */
  profileLink?: string;
  /** "Barcha vazifalar" sahifasiga kira oladigan rollar uchun */
  canAssign?: boolean;
}

export interface Goal {
  icon: IconKey;
  title: string;
  subtitle: string;
  value: number;
}

export interface DashboardConfig {
  title: string;
  kpis: Kpi[];
  acquisition: Acquisition;
  growth: Growth;
  directory: Directory;
  goalsTitle: string;
  goals: Goal[];
}

const MONTHS = ["Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy"];
const QUARTERS = ["1-chorak", "2-chorak", "3-chorak"];

const STUDENT_STATUS: Record<RowStatus, string> = {
  active: "Faol",
  warning: "Akademik ta'til",
  suspended: "Chetlashtirilgan",
  inactive: "Nofaol",
};

const STUDENTS: DirectoryRow[] = [
  { id: "TLB-4819", name: "Jasmina Aliyeva", email: "j.aliyeva@tizims.ai", plan: "Grant", status: "active", date: "6 Sentabr, 2026" },
  { id: "TLB-4820", name: "Javohir Karimov", email: "j.karimov@tizims.ai", plan: "Kontrakt", status: "active", date: "3 Sentabr, 2026" },
  { id: "TLB-4821", name: "Madina Saidova", email: "m.saidova@tizims.ai", plan: "Kontrakt", status: "suspended", date: "1 Sentabr, 2026" },
  { id: "TLB-4822", name: "Bekzod Tursunov", email: "b.tursunov@tizims.ai", plan: "Sirtqi", status: "inactive", date: "2 Sentabr, 2026" },
  { id: "TLB-4823", name: "Nilufar Rahimova", email: "n.rahimova@tizims.ai", plan: "Grant", status: "active", date: "30 Avgust, 2026" },
  { id: "TLB-4824", name: "Sardor Ergashev", email: "s.ergashev@tizims.ai", plan: "Kontrakt", status: "warning", date: "29 Avgust, 2026" },
  { id: "TLB-4825", name: "Kamola Yusupova", email: "k.yusupova@tizims.ai", plan: "Grant", status: "active", date: "28 Avgust, 2026" },
];

const ADMIN: DashboardConfig = {
  title: "Talabalar analitikasi",
  kpis: [
    { title: "Jami talabalar", value: "12,847", delta: "+8.2%", caption: "Barqaror o'sish", icon: "users", link: "/people" },
    { title: "Faol talabalar", value: "11,920", delta: "+12.4%", caption: "Yuqori davomat", icon: "userCheck", link: "/attendance" },
    { title: "O'rtacha GPA", value: "3.62", delta: "+5.4%", caption: "O'zlashtirish oshmoqda", icon: "cap", link: "/grades" },
    { title: "Akademik qarzdorlar", value: "312", delta: "-6.1%", caption: "Qayta topshirish kutilmoqda", icon: "clipboard", link: "/people" },
  ],
  acquisition: {
    title: "Haftalik ta'lim faolligi",
    description: "Darslarga qatnashish va qoldirilgan darslar dinamikasi",
    stats: [
      { value: "11.9", suffix: "K", label: "Haftalik dars tashriflari" },
      { value: "92", suffix: "%", label: "O'rtacha qatnashish" },
    ],
    liveLabel: "Hozir tizimda",
    liveBase: 516,
    badges: [
      { top: "Du 91%", bottom: "9% qoldirdi" },
      { top: "Ch 95%", bottom: "5% qoldirdi", primary: true },
      { top: "Ju 89%", bottom: "11% qoldirdi" },
    ],
    topHint: "Qatnashish",
    bottomHint: "Qoldirilgan",
  },
  growth: {
    title: "Kontingent harakati",
    description: "So'nggi 9 oyda o'qishga qaytgan va chetlashgan talabalar",
    aLabel: "Qaytgan",
    bLabel: "Chetlashgan",
    monthly: {
      labels: MONTHS,
      a: [680, 700, 640, 560, 840, 620, 540, 870, 690],
      b: [110, 50, 110, 90, 120, 120, 110, 100, 60],
    },
    quarterly: {
      labels: QUARTERS,
      a: [2020, 2020, 2100],
      b: [270, 330, 270],
    },
  },
  directory: {
    title: "Talabalar ro'yxati",
    placeholder: "Talabani qidirish...",
    columns: ["Talaba ID", "Talaba", "Ta'lim shakli", "Holat", "O'qishga kirgan"],
    statusLabels: STUDENT_STATUS,
    rows: STUDENTS,
    canChangeStatus: true,
  },
  goalsTitle: "Semestr maqsadlari",
  goals: [
    { icon: "userCheck", title: "Davomat", subtitle: "Darslarga qatnashish", value: 85 },
    { icon: "cap", title: "O'zlashtirish", subtitle: "GPA ≥ 3.0", value: 74 },
    { icon: "clipboard", title: "Topshiriqlar", subtitle: "Muddatida topshirish", value: 92 },
    { icon: "share", title: "Ilmiy faollik", subtitle: "Maqola va konferensiya", value: 41 },
    { icon: "book", title: "Kitobxonlik", subtitle: "Elektron kutubxona", value: 58 },
    { icon: "megaphone", title: "Tadbirlar", subtitle: "Talabalar hayoti", value: 63 },
  ],
};

const SUBJECT_STATUS: Record<RowStatus, string> = {
  active: "O'qilmoqda",
  warning: "Qayta topshirish",
  suspended: "Qarzdorlik",
  inactive: "Yakunlangan",
};

const SUBJECTS: DirectoryRow[] = [
  { id: "CS-301", name: "Neyron tarmoqlar", email: "Dr. Sardor Rahimov", plan: "6 kredit", status: "active", date: "18 Dekabr, 2026" },
  { id: "MA-204", name: "Chiziqli algebra", email: "Prof. Nodira Karimova", plan: "5 kredit", status: "warning", date: "20 Dekabr, 2026" },
  { id: "CS-215", name: "Ma'lumotlar tuzilmasi", email: "Bekzod Tursunov", plan: "6 kredit", status: "active", date: "22 Dekabr, 2026" },
  { id: "EN-110", name: "Ingliz tili (B2)", email: "Kamola Ergasheva", plan: "4 kredit", status: "active", date: "24 Dekabr, 2026" },
  { id: "PH-101", name: "Fizika", email: "Dr. Alisher Rasulov", plan: "5 kredit", status: "inactive", date: "12 Iyun, 2026" },
  { id: "HI-100", name: "O'zbekiston tarixi", email: "Malika Yusupova", plan: "3 kredit", status: "suspended", date: "14 Iyun, 2026" },
];

function studentLike(parent: boolean): DashboardConfig {
  return {
    title: parent ? "Ota-ona kabineti" : "Talaba kabineti",
    kpis: [
      { title: parent ? "Farzand davomati" : "Davomat", value: "94.2%", delta: "+2.1%", caption: "Darslarni qoldirmaslik", icon: "userCheck", link: "/attendance" },
      { title: "GPA", value: "3.78", delta: "+0.12", caption: "Natija yaxshilanmoqda", icon: "cap", link: "/grades" },
      { title: "Kreditlar", value: "96/240", delta: "+24", caption: "Shu semestrda", icon: "book", link: "/grades" },
      parent
        ? { title: "Kontrakt to'lovi", value: "75%", delta: "25%", caption: "Qolgan qism: 1-dekabr", icon: "wallet", link: "/" }
        : { title: "Topshiriqlar", value: "3", delta: "1 ta", caption: "Muddati bugun", icon: "clipboard", link: "/lms" },
    ],
    acquisition: {
      title: parent ? "Farzandim faolligi" : "Mening faolligim",
      description: "Haftalik o'qish faolligi va qoldirilgan darslar",
      stats: [
        { value: "28.5", suffix: "", label: "Haftalik dars soati" },
        { value: "94", suffix: "%", label: "Qatnashish" },
      ],
      liveLabel: "Guruhda onlayn",
      liveBase: 24,
      badges: [
        { top: "Du 92%", bottom: "1 soat" },
        { top: "Ch 100%", bottom: "0 soat", primary: true },
        { top: "Ju 96%", bottom: "2 soat" },
      ],
      topHint: "Qatnashish",
      bottomHint: "Qoldirilgan",
    },
    growth: {
      title: "Topshiriqlar dinamikasi",
      description: "So'nggi 9 oyda topshirilgan va kechiktirilgan ishlar",
      aLabel: "Topshirilgan",
      bLabel: "Kechikkan",
      monthly: {
        labels: MONTHS,
        a: [12, 14, 10, 6, 4, 8, 15, 16, 13],
        b: [2, 1, 2, 1, 0, 1, 2, 1, 1],
      },
      quarterly: { labels: QUARTERS, a: [36, 18, 44], b: [5, 2, 4] },
    },
    directory: {
      title: parent ? "Farzandim fanlari" : "Mening fanlarim",
      placeholder: "Fanni qidirish...",
      columns: ["Fan kodi", "Fan", "Kredit", "Holat", "Imtihon sanasi"],
      statusLabels: SUBJECT_STATUS,
      rows: SUBJECTS,
      canChangeStatus: false,
    },
    goalsTitle: parent ? "Farzandim maqsadlari" : "Semestr maqsadlarim",
    goals: [
      { icon: "userCheck", title: "Davomat", subtitle: "Kamida 95%", value: 94 },
      { icon: "cap", title: "GPA", subtitle: "Maqsad: 3.9", value: 78 },
      { icon: "clipboard", title: "Topshiriqlar", subtitle: "Muddatida topshirish", value: 88 },
      { icon: "book", title: "Kitobxonlik", subtitle: "12 ta kitob", value: 41 },
      { icon: "globe", title: "Ingliz tili", subtitle: "IELTS 7.0", value: 63 },
    ],
  };
}

export function dashboardFor(role: Role): DashboardConfig {
  if (role === "student") return studentLike(false);
  if (role === "parent") return studentLike(true);
  if (role === "teacher") {
    return {
      ...ADMIN,
      title: "O'qituvchi analitikasi",
      kpis: [
        { title: "Mening talabalarim", value: "118", delta: "+6", caption: "4 ta guruh", icon: "users", link: "/academic" },
        { title: "Bugungi darslar", value: "4", delta: "14:00", caption: "Keyingi dars", icon: "calendar", link: "/timetable" },
        { title: "O'rtacha baho", value: "4.32", delta: "+0.18", caption: "Guruhlar natijasi", icon: "award", link: "/grades" },
        { title: "Tekshirilmagan", value: "27", delta: "-12", caption: "Topshiriqlar navbati", icon: "clipboard", link: "/lms" },
      ],
      acquisition: {
        ...ADMIN.acquisition,
        title: "Guruhlarim faolligi",
        description: "Darslarga qatnashish va qoldirish dinamikasi",
        stats: [
          { value: "1.8", suffix: "K", label: "Dars tashriflari" },
          { value: "91", suffix: "%", label: "O'rtacha davomat" },
        ],
        liveLabel: "Darsda onlayn",
        liveBase: 37,
      },
      growth: {
        title: "Topshiriqlar dinamikasi",
        description: "So'nggi 9 oyda guruhlarim topshirgan va kechiktirgan ishlar",
        aLabel: "Topshirilgan",
        bLabel: "Kechikkan",
        monthly: { labels: MONTHS, a: [84, 92, 70, 40, 18, 52, 96, 104, 88], b: [9, 6, 11, 5, 2, 7, 10, 8, 6] },
        quarterly: { labels: QUARTERS, a: [246, 110, 288], b: [26, 14, 24] },
      },
      directory: {
        ...ADMIN.directory,
        title: "Guruhlarim talabalari",
        columns: ["Talaba ID", "Talaba", "Guruh", "Holat", "O'qishga kirgan"],
        rows: STUDENTS.slice(0, 6).map((r, i) => ({ ...r, plan: ["IT-21", "IT-21", "IT-22", "IT-23", "IT-22", "IT-21"][i] })),
        canChangeStatus: false,
      },
      goalsTitle: "Guruhlarim maqsadlari",
    };
  }
  if (role === "advisor") {
    return {
      ...ADMIN,
      title: "Nazoratchi — jonli ko'rinish",
      kpis: [
        { title: "Band xonalar", value: "38/64", delta: "59%", caption: "Hozirgi bandlik", icon: "door", link: "/timetable" },
        { title: "Bugungi darslar", value: "212", delta: "3", caption: "To'qnashuv aniqlandi", icon: "calendar", link: "/timetable" },
        { title: "Bugungi davomat", value: "91.6%", delta: "+1.4%", caption: "Real vaqt rejimida", icon: "userCheck", link: "/attendance" },
        { title: "Kechikkanlar", value: "46", delta: "-8%", caption: "Kechagiga nisbatan", icon: "clock", link: "/attendance" },
      ],
      acquisition: {
        title: "Bugungi dars oqimi",
        description: "Juftliklar bo'yicha darsga kelish va kechikish",
        stats: [
          { value: "212", suffix: "", label: "Bugungi darslar" },
          { value: "26", suffix: "", label: "Bo'sh xonalar" },
        ],
        liveLabel: "Hozir darsda",
        liveBase: 1840,
        badges: [
          { top: "1-juft 88%", bottom: "46 kechikdi" },
          { top: "3-juft 95%", bottom: "12 kechikdi", primary: true },
          { top: "5-juft 90%", bottom: "21 kechikdi" },
        ],
        topHint: "Qatnashish",
        bottomHint: "Kechikkanlar",
      },
      growth: {
        title: "Davomat dinamikasi",
        description: "So'nggi 9 oyda kelgan va kechikkan talabalar (yuzlab)",
        aLabel: "Kelgan",
        bLabel: "Kechikkan",
        monthly: { labels: MONTHS, a: [110, 112, 104, 60, 20, 70, 115, 118, 116], b: [6, 5, 7, 4, 1, 4, 8, 6, 5] },
        quarterly: { labels: QUARTERS, a: [326, 150, 349], b: [18, 9, 19] },
      },
      directory: { ...ADMIN.directory, canChangeStatus: false },
    };
  }
  return ADMIN;
}
