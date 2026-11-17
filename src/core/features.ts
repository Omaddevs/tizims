/**
 * TIZIMS.AI — ta'lim modullari reestri.
 *
 * Har bir modul uchun: qaysi rol kira oladi va qaysi darajada.
 *  - manage : yaratish / tahrirlash / tasdiqlash (to'liq boshqaruv)
 *  - view   : butun tashkilot (yoki fakultet) bo'yicha ko'rish
 *  - own    : faqat o'ziga tegishli doira — o'qituvchi: o'z guruhlari,
 *             talaba: o'zi, ota-ona: farzandi
 *
 * Navigatsiya, marshrutlar, qidiruv va kirish nazorati shu yerdan o'qiydi.
 */
import type { Role } from "../types";

export type Access = "manage" | "view" | "own";

export type FeatureKey =
  | "academic"
  | "timetable"
  | "attendance"
  | "grades"
  | "lms"
  | "messages"
  | "complaints"
  | "insights"
  | "people"
  | "structure"
  | "roles"
  | "rooms"
  | "mySubjects"
  | "tests"
  | "news"
  | "blog"
  | "support";

export type FeatureSection = "Ta'lim" | "Kommunikatsiya" | "Analitika" | "Boshqaruv";

export interface Feature {
  key: FeatureKey;
  path: string;
  label: string;
  /** Rolga xos nom (masalan talaba uchun "Baholarim") */
  labels?: Partial<Record<Role, string>>;
  description: string;
  section: FeatureSection;
  access: Partial<Record<Role, Access>>;
}

/** Tashkilot rahbariyati. Super admin bu yerda yo'q — u platforma darajasida ishlaydi va tashkilot ichki ma'lumotlarini ko'rmaydi. */
const ADMINS = { owner: "manage", rector: "manage" } as const;

export const FEATURES: Feature[] = [
  // ── Ta'lim ──
  {
    key: "academic",
    path: "/academic",
    label: "O'quv jarayoni",
    labels: { teacher: "Guruh va fanlarim" },
    description: "Guruhlar, fanlar, semestrlar va o'quv rejalari",
    section: "Ta'lim",
    access: { ...ADMINS, dept_head: "manage", advisor: "view", teacher: "own" },
  },
  {
    key: "timetable",
    path: "/timetable",
    label: "Dars jadvali",
    labels: { student: "Jadvalim", parent: "Farzandim jadvali" },
    description: "Smart jadval, o'qituvchi yuklamasi va xonalar bandligi",
    section: "Ta'lim",
    access: { ...ADMINS, dept_head: "view", advisor: "manage", teacher: "own", student: "own", parent: "own" },
  },
  {
    key: "attendance",
    path: "/attendance",
    label: "Davomat",
    labels: { teacher: "Davomat belgilash", student: "Davomatim", parent: "Farzandim davomati" },
    description: "Davomat, kechikish va sababsiz qoldirishlar nazorati",
    section: "Ta'lim",
    access: { owner: "view", rector: "view", dept_head: "view", advisor: "manage", teacher: "manage", student: "own", parent: "own" },
  },
  {
    key: "grades",
    path: "/grades",
    label: "Baholar va imtihonlar",
    labels: { teacher: "Baholash", student: "Baholarim", parent: "Farzandim baholari" },
    description: "Joriy, oraliq va yakuniy nazorat, imtihonlar",
    section: "Ta'lim",
    access: { owner: "view", rector: "view", dept_head: "view", teacher: "manage", student: "own", parent: "own", advisor: "manage" },
  },
  {
    key: "lms",
    path: "/lms",
    label: "LMS va kutubxona",
    labels: { student: "Kurslarim va kutubxona" },
    description: "Dars materiallari, topshiriqlar va elektron kutubxona",
    section: "Ta'lim",
    access: { owner: "view", rector: "view", dept_head: "view", teacher: "manage", student: "own" },
  },
  // ── Kommunikatsiya ──
  {
    key: "messages",
    path: "/messages",
    label: "Xabarlar",
    description: "Xodimlar, o'qituvchilar va talabalar uchun yagona chat",
    section: "Kommunikatsiya",
    access: { ...ADMINS, dept_head: "manage", advisor: "manage", teacher: "manage", student: "own", parent: "own" },
  },
  {
    key: "complaints",
    path: "/complaints",
    label: "Murojaatlar",
    labels: { student: "Murojaatlarim", parent: "Murojaatlarim", teacher: "Murojaatlarim" },
    description: "Shikoyat va murojaatlarni tegishli bo'lim orqali ko'rib chiqish",
    section: "Kommunikatsiya",
    access: { ...ADMINS, dept_head: "manage", advisor: "manage", teacher: "own", student: "own", parent: "own" },
  },
  // ── Analitika ──
  {
    key: "insights",
    path: "/insights",
    label: "AI tahlil",
    labels: { student: "AI maslahatchi", parent: "AI maslahatchi" },
    description: "Xavf prognozi, muammolarni aniqlash va tavsiyalar",
    section: "Analitika",
    access: { ...ADMINS, dept_head: "view", advisor: "view", teacher: "own", student: "own", parent: "own" },
  },
  // ── Boshqaruv ──
  {
    key: "people",
    path: "/people",
    label: "Talabalar va xodimlar",
    description: "Talaba va o'qituvchilarning raqamli profillari",
    section: "Boshqaruv",
    access: { ...ADMINS, dept_head: "manage", advisor: "view" },
  },
  {
    key: "structure",
    path: "/structure",
    label: "Tashkiliy tuzilma",
    description: "Filiallar, fakultetlar, kafedralar va bo'limlar",
    section: "Boshqaruv",
    access: { ...ADMINS, dept_head: "view" },
  },
  {
    key: "rooms",
    path: "/rooms",
    label: "Xonalar monitoringi",
    description: "Qaysi xona bo'sh, qayerda dars ketyapti — real vaqtda",
    section: "Ta'lim",
    access: { owner: "view", rector: "view", dept_head: "view", advisor: "manage" },
  },
  {
    key: "mySubjects",
    path: "/my-subjects",
    label: "Fanlarim",
    labels: { parent: "Farzandim fanlari" },
    description: "Fanlar, mas'ul o'qituvchilar va kurator",
    section: "Ta'lim",
    access: { student: "own", parent: "own" },
  },
  {
    key: "tests",
    path: "/tests",
    label: "Testlar",
    description: "Onlayn testlar — vaqt cheklangan, avtomatik baholanadi",
    section: "Ta'lim",
    access: { owner: "manage", rector: "manage", advisor: "manage", student: "own" },
  },
  {
    key: "news",
    path: "/news",
    label: "E'lonlar",
    description: "Rasmiy e'lonlar va yangiliklar",
    section: "Kommunikatsiya",
    access: { owner: "manage", rector: "manage", advisor: "manage", dept_head: "view", teacher: "view", student: "own", parent: "own" },
  },
  {
    key: "blog",
    path: "/blog",
    label: "Bloglar",
    description: "Maqolalar, tadbirlar va talabalar hayoti",
    section: "Kommunikatsiya",
    access: { owner: "manage", rector: "manage", advisor: "manage", dept_head: "view", teacher: "view", student: "own", parent: "own" },
  },
  {
    key: "support",
    path: "/help",
    label: "Yordam",
    description: "Ko'p beriladigan savollar va texnik yordam so'rovi",
    section: "Kommunikatsiya",
    access: { student: "own", parent: "own", teacher: "own" },
  },
  {
    key: "roles",
    path: "/roles",
    label: "Rollar va vakolatlar",
    description: "Har bir rol uchun ruxsatlar matritsasi",
    section: "Boshqaruv",
    access: { super_admin: "manage", owner: "manage", rector: "view" },
  },
];

export const FEATURE_SECTIONS: FeatureSection[] = ["Ta'lim", "Kommunikatsiya", "Analitika", "Boshqaruv"];

export function featureByKey(key: FeatureKey): Feature {
  return FEATURES.find((f) => f.key === key)!;
}

export function accessOf(role: string | undefined, key: FeatureKey): Access | null {
  if (!role) return null;
  return featureByKey(key).access[role as Role] ?? null;
}

export function featuresFor(role: string | undefined): Feature[] {
  if (!role) return [];
  return FEATURES.filter((f) => f.access[role as Role]);
}

export function featureLabel(f: Feature, role: string | undefined) {
  return (role && f.labels?.[role as Role]) || f.label;
}

/**
 * Modulda o'zgartirish (manage) amallari uchun talab qilinadigan ruxsat.
 * Tashkilot egasi rollar matritsasida ruxsatni olib tashlasa — server bu amalni rad etadi.
 */
export const FEATURE_MANAGE_PERMISSION: Partial<Record<FeatureKey, string>> = {
  academic: "edu.academic.manage",
  timetable: "edu.timetable.manage",
  attendance: "edu.attendance.manage",
  grades: "edu.grades.manage",
  lms: "edu.lms.manage",
  complaints: "edu.complaints.manage",
  people: "edu.students.manage",
  structure: "edu.structure.manage",
  roles: "core.users.manage",
  rooms: "edu.timetable.manage",
  tests: "edu.tests.manage",
  news: "edu.news.manage",
  blog: "edu.news.manage",
};

/** Tashkilot darajasida tahrirlab bo'lmaydigan rollar (o'zini qulflab qo'yishdan himoya). */
export const LOCKED_ROLES = ["super_admin", "owner"];
