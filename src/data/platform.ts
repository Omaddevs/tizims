/**
 * TIZIMS.AI — platforma darajasidagi demo ma'lumotlar (super admin paneli uchun).
 * Tashkilot ichidagi ma'lumotlar (baholar, xabarlar, murojaatlar) bu yerda yo'q — super admin ularni ko'rmaydi.
 */
import { ORG_IAU, ORG_PHARM, ORG_SHOP } from "../core/ids";
import type { ModuleKey, OrganizationStatus, OrganizationType } from "../core/types";

export type PlanKey = "starter" | "business" | "enterprise";

export const PLANS: { key: PlanKey; name: string; price: number; seats: string; features: string[] }[] = [
  { key: "starter", name: "Starter", price: 9_000, seats: "100 tagacha foydalanuvchi", features: ["Asosiy ta'lim modullari", "Email yordam", "5 GB xotira"] },
  { key: "business", name: "Business", price: 7_000, seats: "100 – 2 000 foydalanuvchi", features: ["Barcha modullar", "AI tahlil (asosiy)", "Telegram bot", "50 GB xotira"] },
  { key: "enterprise", name: "Enterprise", price: 5_000, seats: "2 000+ foydalanuvchi", features: ["To'liq AI tahlil", "SSO va API", "SLA 99.9%", "Shaxsiy menejer"] },
];

/** UZS / foydalanuvchi / oy */
export const planPrice = (k: PlanKey) => PLANS.find((p) => p.key === k)!.price;

export interface TenantRecord {
  id: string;
  name: string;
  slug: string;
  type: OrganizationType;
  status: OrganizationStatus;
  plan: PlanKey;
  seats: number;
  owner: string;
  ownerEmail: string;
  modules: ModuleKey[];
  createdAt: string;
  storageGb: number;
  storageLimitGb: number;
  apiCalls: number;
  paidUntil: string;
  billing: "paid" | "overdue" | "trial";
}

export const TENANTS: TenantRecord[] = [
  { id: ORG_IAU, name: "International Agriculture University", slug: "iau", type: "university", status: "active", plan: "enterprise", seats: 12_847, owner: "Aziz Qodirov", ownerEmail: "owner@tizims.ai", modules: ["education", "finance", "documents", "analytics"], createdAt: "2026-01-01", storageGb: 312, storageLimitGb: 1000, apiCalls: 1_840_000, paidUntil: "2026-12-31", billing: "paid" },
  { id: ORG_SHOP, name: "ABC Shop", slug: "abc-shop", type: "shop", status: "active", plan: "business", seats: 42, owner: "Karimova Laylo", ownerEmail: "shop@abc.uz", modules: ["crm", "shop", "warehouse", "finance"], createdAt: "2024-03-01", storageGb: 18, storageLimitGb: 50, apiCalls: 96_000, paidUntil: "2026-11-30", billing: "paid" },
  { id: ORG_PHARM, name: "MedFarm Pharmacy", slug: "medfarm", type: "pharmacy", status: "active", plan: "business", seats: 65, owner: "Rahimov Aziz", ownerEmail: "farm@medfarm.uz", modules: ["pharmacy", "warehouse", "crm", "finance"], createdAt: "2023-06-01", storageGb: 41, storageLimitGb: 50, apiCalls: 142_000, paidUntil: "2026-11-01", billing: "overdue" },
  { id: "t-sam-school", name: "Samarqand Prezident maktabi", slug: "sam-pm", type: "school", status: "trial", plan: "business", seats: 640, owner: "Dilnoza Ahmedova", ownerEmail: "director@sampm.uz", modules: ["education", "analytics"], createdAt: "2026-11-02", storageGb: 3, storageLimitGb: 50, apiCalls: 12_400, paidUntil: "2026-12-02", billing: "trial" },
  { id: "t-it-academy", name: "IT Park Academy", slug: "itpark-academy", type: "school", status: "active", plan: "starter", seats: 86, owner: "Jahongir Rasulov", ownerEmail: "admin@itacademy.uz", modules: ["education", "crm"], createdAt: "2025-09-10", storageGb: 4, storageLimitGb: 5, apiCalls: 38_000, paidUntil: "2026-12-10", billing: "paid" },
  { id: "t-lingua", name: "Lingua Center", slug: "lingua", type: "school", status: "suspended", plan: "starter", seats: 54, owner: "Malika Sobirova", ownerEmail: "info@lingua.uz", modules: ["education"], createdAt: "2025-02-14", storageGb: 2, storageLimitGb: 5, apiCalls: 0, paidUntil: "2026-09-14", billing: "overdue" },
];

export const TYPE_LABEL: Record<string, string> = {
  university: "Universitet",
  school: "Maktab / o'quv markaz",
  shop: "Do'kon",
  pharmacy: "Apteka",
  company: "Kompaniya",
  clinic: "Klinika",
  restaurant: "Restoran",
  agency: "Agentlik",
  other: "Boshqa",
};

export const INVOICES = [
  { id: "INV-2026-1108", tenant: "iau", amount: 64_235_000, date: "2026-11-01", status: "paid" as const },
  { id: "INV-2026-1109", tenant: "abc-shop", amount: 294_000, date: "2026-11-01", status: "paid" as const },
  { id: "INV-2026-1110", tenant: "medfarm", amount: 455_000, date: "2026-11-01", status: "overdue" as const },
  { id: "INV-2026-1111", tenant: "itpark-academy", amount: 774_000, date: "2026-11-01", status: "paid" as const },
  { id: "INV-2026-1012", tenant: "lingua", amount: 486_000, date: "2026-10-01", status: "overdue" as const },
  { id: "INV-2026-1001", tenant: "iau", amount: 62_810_000, date: "2026-10-01", status: "paid" as const },
];

export const MRR_HISTORY = [52.1, 54.8, 55.2, 57.9, 58.4, 60.1, 61.7, 62.3, 64.0, 65.2, 66.2]; // mln UZS

/* ───────── Yordam so'rovlari ───────── */

export type TicketStatus = "open" | "pending" | "resolved";
export type TicketPriority = "urgent" | "high" | "normal";

export interface Ticket {
  id: string;
  tenant: string;
  author: string;
  subject: string;
  body: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  sla: string;
  replies: { by: string; text: string; at: string }[];
}

export const TICKETS: Ticket[] = [
  { id: "SUP-482", tenant: "iau", author: "Aziz Qodirov", subject: "Telegram bot bildirishnomalari kechikib kelmoqda", body: "Ota-onalarga davomat xabarlari 20–30 daqiqa kechikib bormoqda.", priority: "high", status: "open", createdAt: "2026-11-16 09:12", sla: "4 soat", replies: [] },
  { id: "SUP-481", tenant: "medfarm", author: "Rahimov Aziz", subject: "Xotira limiti tugayapti", body: "50 GB dan 41 GB ishlatilgan, limitni oshirish kerak.", priority: "normal", status: "pending", createdAt: "2026-11-15 14:40", sla: "1 kun", replies: [{ by: "TIZIMS yordam", text: "Enterprise tarifga o'tish yoki qo'shimcha 50 GB paket taklif qilamiz.", at: "2026-11-15 16:02" }] },
  { id: "SUP-479", tenant: "sam-pm", author: "Dilnoza Ahmedova", subject: "Sinov muddatida talabalarni Excel'dan import qilish", body: "640 ta o'quvchini qanday yuklash mumkin?", priority: "normal", status: "open", createdAt: "2026-11-14 11:05", sla: "1 kun", replies: [] },
  { id: "SUP-475", tenant: "itpark-academy", author: "Jahongir Rasulov", subject: "Tizimga kira olmayapmiz — 502 xato", body: "Barcha xodimlarda login sahifasi ochilmayapti.", priority: "urgent", status: "resolved", createdAt: "2026-11-10 08:31", sla: "1 soat", replies: [{ by: "TIZIMS yordam", text: "Yuklama balansirovkachisi qayta ishga tushirildi. Muammo 08:52 da bartaraf etildi.", at: "2026-11-10 08:55" }] },
];

/** Yordam rejimi — tashkilot ichiga vaqtinchalik, faqat o'qish uchun kirish (ega tasdig'i bilan). */
export interface SupportAccess {
  id: string;
  tenant: string;
  reason: string;
  ticket?: string;
  status: "pending" | "active" | "expired" | "denied";
  requestedAt: string;
  expiresAt?: string;
}

export const SUPPORT_ACCESS: SupportAccess[] = [
  { id: "ACC-31", tenant: "itpark-academy", reason: "502 xatoni tekshirish", ticket: "SUP-475", status: "expired", requestedAt: "2026-11-10 08:33", expiresAt: "2026-11-10 10:33" },
  { id: "ACC-30", tenant: "iau", reason: "Jadval importidagi xatoni tahlil qilish", status: "denied", requestedAt: "2026-11-02 15:10" },
];

/* ───────── Monitoring ───────── */

export const SERVICES = [
  { name: "API gateway", status: "ok" as const, latency: 84, uptime: 99.98 },
  { name: "PostgreSQL (asosiy)", status: "ok" as const, latency: 6, uptime: 99.99 },
  { name: "Navbat (queue)", status: "ok" as const, latency: 12, uptime: 99.95 },
  { name: "Fayl xotirasi", status: "ok" as const, latency: 41, uptime: 99.97 },
  { name: "AI xizmati", status: "degraded" as const, latency: 1820, uptime: 99.4 },
  { name: "Telegram bot", status: "degraded" as const, latency: 640, uptime: 99.1 },
  { name: "SMS shlyuz", status: "ok" as const, latency: 210, uptime: 99.9 },
];

/** So'nggi 30 kun: 1 = muammosiz, 0.5 = qisman, 0 = uzilish */
export const UPTIME_30D = [1, 1, 1, 1, 1, 0.5, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0.5, 1, 1, 1, 1, 1, 0.5];

export const INCIDENTS = [
  { id: "INC-19", title: "Telegram bot xabarlari kechikmoqda", status: "investigating" as const, started: "2026-11-16 08:50", impact: "Bildirishnomalar", tenants: 4 },
  { id: "INC-18", title: "AI xizmati javob vaqti oshgan", status: "monitoring" as const, started: "2026-11-15 19:20", impact: "AI tahlil", tenants: 3 },
  { id: "INC-17", title: "Yuklama balansirovkachisi 502 qaytardi", status: "resolved" as const, started: "2026-11-10 08:31", impact: "Butun platforma", tenants: 6 },
];

export const BACKUPS = [
  { at: "2026-11-17 03:00", size: "48.2 GB", kind: "To'liq", ok: true },
  { at: "2026-11-16 15:00", size: "1.4 GB", kind: "Inkremental", ok: true },
  { at: "2026-11-16 03:00", size: "47.9 GB", kind: "To'liq", ok: true },
  { at: "2026-11-15 15:00", size: "1.2 GB", kind: "Inkremental", ok: false },
];

/* ───────── Xavfsizlik ───────── */

export const SECURITY_POLICIES = [
  { key: "mfa_admin", name: "Adminlar uchun 2FA majburiy", desc: "Ega, rektor va super admin rollari", on: true },
  { key: "mfa_all", name: "Barcha xodimlar uchun 2FA", desc: "O'qituvchi va maslahatchilar ham", on: false },
  { key: "ip_allow", name: "Super admin uchun IP cheklov", desc: "Faqat ofis tarmog'idan kirish", on: true },
  { key: "session", name: "Sessiya muddati 8 soat", desc: "Faolsizlikdan so'ng avtomatik chiqish", on: true },
  { key: "pwd", name: "Kuchli parol siyosati", desc: "Kamida 10 belgi, raqam va belgi", on: true },
  { key: "support_consent", name: "Yordam rejimi uchun ega roziligi", desc: "Tashkilot ma'lumotlariga faqat tasdiq bilan kirish", on: true },
];

export const SECURITY_EVENTS = [
  { at: "2026-11-17 01:14", event: "5 marta noto'g'ri parol — akkaunt 15 daqiqaga bloklandi", who: "rector@iau.uz", ip: "185.74.6.12", level: "high" as const },
  { at: "2026-11-16 22:40", event: "Yangi qurilmadan kirish", who: "owner@tizims.ai", ip: "84.54.70.3", level: "medium" as const },
  { at: "2026-11-16 12:05", event: "API kalit yaratildi", who: "admin@itacademy.uz", ip: "213.230.92.44", level: "low" as const },
  { at: "2026-11-15 09:30", event: "Super admin roli berildi", who: "superadmin@tizims.ai", ip: "10.0.0.2", level: "high" as const },
];

export const INTEGRATIONS = [
  { name: "Telegram bot", desc: "Bildirishnomalar va ota-ona xabarlari", status: "connected" as const, tenants: 4 },
  { name: "Eskiz SMS", desc: "SMS shlyuz", status: "connected" as const, tenants: 6 },
  { name: "E-imzo", desc: "Hujjatlarni elektron imzolash", status: "connected" as const, tenants: 2 },
  { name: "Google Workspace (SSO)", desc: "Yagona kirish", status: "available" as const, tenants: 0 },
  { name: "Biometrik davomat (Hikvision)", desc: "Turniket orqali davomat", status: "connected" as const, tenants: 1 },
  { name: "Payme / Click", desc: "Kontrakt to'lovlarini qabul qilish", status: "available" as const, tenants: 0 },
  { name: "HEMIS", desc: "Davlat ta'lim axborot tizimi bilan sinxron", status: "beta" as const, tenants: 1 },
];

/* ───────── Platforma auditi ───────── */

export const PLATFORM_AUDIT = [
  { at: "2026-11-17 00:42", actor: "Platforma Super Admin", action: "Monitoring", target: "INC-19", detail: "Hodisa ochildi: Telegram bot kechikishi" },
  { at: "2026-11-16 18:20", actor: "Platforma Super Admin", action: "Tarif", target: "sam-pm", detail: "Sinov muddati 30 kunga belgilandi" },
  { at: "2026-11-16 11:02", actor: "Platforma Super Admin", action: "Modul", target: "iau", detail: "analytics moduli yoqildi" },
  { at: "2026-11-15 16:02", actor: "TIZIMS yordam", action: "Yordam", target: "SUP-481", detail: "Javob yuborildi" },
  { at: "2026-11-15 09:30", actor: "Platforma Super Admin", action: "Xavfsizlik", target: "superadmin@tizims.ai", detail: "Super admin roli berildi" },
  { at: "2026-11-10 08:33", actor: "TIZIMS yordam", action: "Yordam rejimi", target: "itpark-academy", detail: "2 soatlik faqat-o'qish kirish (ega tasdiqladi)" },
  { at: "2026-11-02 15:10", actor: "TIZIMS yordam", action: "Yordam rejimi", target: "iau", detail: "So'rov ega tomonidan rad etildi" },
  { at: "2026-11-02 10:00", actor: "Platforma Super Admin", action: "Tashkilot", target: "sam-pm", detail: "Yangi tashkilot yaratildi" },
  { at: "2026-09-14 00:00", actor: "Tizim", action: "Tashkilot", target: "lingua", detail: "To'lov muddati o'tgani uchun to'xtatildi" },
];

/* ───────── E'lonlar va texnik ishlar ───────── */

export type Audience = "all" | "education" | "business" | "owners";
export const AUDIENCE_LABEL: Record<Audience, string> = {
  all: "Barcha foydalanuvchilar",
  education: "Ta'lim muassasalari",
  business: "Biznes tashkilotlari",
  owners: "Faqat tashkilot egalari",
};

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  tone: "info" | "success" | "warning";
  channels: ("banner" | "email" | "telegram")[];
  status: "draft" | "published" | "archived";
  createdAt: string;
  reach?: number;
}

export const ANNOUNCEMENTS: Announcement[] = [
  { id: "ANN-12", title: "Yangi: AI maslahatchi talabalar uchun", body: "Talabalar endi baholari va davomati asosida shaxsiy tavsiyalar olishadi. AI tahlil bo'limida.", audience: "education", tone: "success", channels: ["banner", "email"], status: "published", createdAt: "2026-11-14", reach: 13_573 },
  { id: "ANN-11", title: "Telegram bildirishnomalarida kechikish", body: "Ayrim xabarlar 20–30 daqiqa kechikmoqda. Muammo ustida ishlayapmiz.", audience: "all", tone: "warning", channels: ["banner"], status: "archived", createdAt: "2026-11-16", reach: 13_682 },
  { id: "ANN-10", title: "2027-yil tariflari", body: "1-yanvardan Starter tarifi narxi o'zgarmaydi, Business tarifiga Telegram bot qo'shiladi.", audience: "owners", tone: "info", channels: ["email"], status: "draft", createdAt: "2026-11-12" },
];

export interface Maintenance {
  id: string;
  title: string;
  start: string; // ISO "2026-11-22T02:00"
  end: string;
  services: string[];
  status: "scheduled" | "in_progress" | "done" | "cancelled";
}

export const MAINTENANCES: Maintenance[] = [
  { id: "MNT-7", title: "PostgreSQL 17 ga yangilash", start: "2026-11-22T02:00", end: "2026-11-22T04:00", services: ["Butun platforma"], status: "scheduled" },
  { id: "MNT-6", title: "Fayl xotirasini ko'chirish", start: "2026-11-08T03:00", end: "2026-11-08T03:40", services: ["LMS fayllari", "Hujjatlar"], status: "done" },
];

/* ───────── Platforma jamoasi ───────── */

export type StaffRole = "owner" | "support" | "finance" | "devops" | "sales";

export const STAFF_ROLES: { key: StaffRole; name: string; desc: string; access: string[] }[] = [
  { key: "owner", name: "Bosh administrator", desc: "Platformaning barcha bo'limlari", access: ["Tashkilotlar", "Obunalar", "Yordam", "Monitoring", "Relizlar", "Jamoa", "Xavfsizlik", "Audit"] },
  { key: "support", name: "Yordam xodimi", desc: "So'rovlarga javob, yordam rejimini so'rash", access: ["Yordam", "Tashkilotlar (ko'rish)", "Holat sahifasi"] },
  { key: "finance", name: "Moliyachi", desc: "Tariflar, hisob-fakturalar, promo-kodlar", access: ["Obunalar", "Tashkilotlar (ko'rish)"] },
  { key: "devops", name: "DevOps muhandis", desc: "Infratuzilma, relizlar, texnik ishlar", access: ["Monitoring", "Relizlar", "Texnik ishlar", "API limitlar"] },
  { key: "sales", name: "Savdo menejeri", desc: "Yangi mijozlar, onboarding, sinov muddati", access: ["Tashkilotlar", "O'sish", "Promo-kodlar"] },
];

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  mfa: boolean;
  lastSeen: string;
  status: "active" | "invited" | "disabled";
}

export const STAFF: StaffMember[] = [
  { id: "s1", name: "Platforma Super Admin", email: "superadmin@tizims.ai", role: "owner", mfa: true, lastSeen: "Hozir", status: "active" },
  { id: "s2", name: "Nodir Xolmatov", email: "nodir@tizims.ai", role: "support", mfa: true, lastSeen: "12 daqiqa oldin", status: "active" },
  { id: "s3", name: "Sevinch Abdullayeva", email: "sevinch@tizims.ai", role: "support", mfa: false, lastSeen: "Kecha", status: "active" },
  { id: "s4", name: "Otabek Yo'ldoshev", email: "otabek@tizims.ai", role: "devops", mfa: true, lastSeen: "1 soat oldin", status: "active" },
  { id: "s5", name: "Gulnoza Karimova", email: "gulnoza@tizims.ai", role: "finance", mfa: true, lastSeen: "3 kun oldin", status: "active" },
  { id: "s6", name: "Bekzod Aliyev", email: "bekzod@tizims.ai", role: "sales", mfa: false, lastSeen: "—", status: "invited" },
];

/* ───────── O'sish: onboarding, churn, modullar ───────── */

export const ONBOARDING_STEPS = ["Ega akkaunti faollashtirildi", "Tashkiliy tuzilma kiritildi", "Foydalanuvchilar yuklandi", "Dars jadvali tuzildi", "Birinchi davomat belgilandi", "Ota-onalar taklif qilindi"];

/** tashkilot slug → bajarilgan qadamlar soni, oxirgi faollik */
export const ONBOARDING: Record<string, { done: number; lastActive: string; manager: string }> = {
  iau: { done: 6, lastActive: "Hozir", manager: "Bekzod Aliyev" },
  "sam-pm": { done: 3, lastActive: "4 kun oldin", manager: "Bekzod Aliyev" },
  "itpark-academy": { done: 5, lastActive: "Bugun", manager: "Bekzod Aliyev" },
  lingua: { done: 4, lastActive: "64 kun oldin", manager: "—" },
  "abc-shop": { done: 6, lastActive: "Bugun", manager: "—" },
  medfarm: { done: 6, lastActive: "Kecha", manager: "—" },
};

/** Faqat agregat signallar — tashkilot ichidagi yozuvlarga qaramaydi. */
export const CHURN_SIGNALS: Record<string, { activityTrend: number; tickets: number; overdueDays: number }> = {
  iau: { activityTrend: 6, tickets: 1, overdueDays: 0 },
  "sam-pm": { activityTrend: -38, tickets: 1, overdueDays: 0 },
  "itpark-academy": { activityTrend: 2, tickets: 1, overdueDays: 0 },
  lingua: { activityTrend: -100, tickets: 0, overdueDays: 64 },
  "abc-shop": { activityTrend: -4, tickets: 0, overdueDays: 0 },
  medfarm: { activityTrend: -12, tickets: 1, overdueDays: 16 },
};

export function churnScore(s: { activityTrend: number; tickets: number; overdueDays: number }) {
  const score = Math.min(100, Math.max(0, (s.activityTrend < 0 ? -s.activityTrend * 0.6 : 0) + s.tickets * 8 + Math.min(40, s.overdueDays * 0.8)));
  return Math.round(score);
}

/** Har bir modulning platforma bo'yicha haftalik faol foydalanuvchilari (agregat) */
export const MODULE_USAGE = [
  { key: "attendance", name: "Davomat", wau: 11_240, trend: 4 },
  { key: "timetable", name: "Dars jadvali", wau: 10_880, trend: 2 },
  { key: "grades", name: "Baholar", wau: 9_610, trend: 7 },
  { key: "messages", name: "Xabarlar", wau: 8_420, trend: 18 },
  { key: "lms", name: "LMS", wau: 6_150, trend: 11 },
  { key: "insights", name: "AI tahlil", wau: 2_310, trend: 46 },
  { key: "complaints", name: "Murojaatlar", wau: 640, trend: -3 },
  { key: "crm", name: "CRM", wau: 92, trend: 1 },
];

/* ───────── Promo-kodlar ───────── */

export interface Promo {
  code: string;
  discount: number;
  months: number;
  audience: string;
  used: number;
  limit: number;
  expires: string;
  active: boolean;
}

export const PROMOS: Promo[] = [
  { code: "MAKTAB2027", discount: 30, months: 6, audience: "Maktablar", used: 4, limit: 50, expires: "2027-03-01", active: true },
  { code: "START20", discount: 20, months: 3, audience: "Yangi mijozlar", used: 11, limit: 100, expires: "2026-12-31", active: true },
  { code: "EDUEXPO", discount: 15, months: 12, audience: "Ko'rgazma ishtirokchilari", used: 7, limit: 7, expires: "2026-10-30", active: false },
];

/* ───────── Relizlar va funksiya bayroqlari ───────── */

export interface FeatureFlag {
  key: string;
  name: string;
  desc: string;
  stage: "off" | "pilot" | "on";
  tenants: string[]; // pilot tashkilotlar
}

export const FEATURE_FLAGS: FeatureFlag[] = [
  { key: "hemis_sync", name: "HEMIS sinxronizatsiyasi", desc: "Talaba va baholarni davlat tizimi bilan sinxronlash", stage: "pilot", tenants: ["iau"] },
  { key: "ai_student_tips", name: "AI maslahatchi (talabalar)", desc: "Shaxsiy o'qish tavsiyalari", stage: "on", tenants: [] },
  { key: "face_attendance", name: "Yuz orqali davomat", desc: "Kamera yordamida avtomatik davomat", stage: "pilot", tenants: ["itpark-academy"] },
  { key: "mobile_v2", name: "Mobil ilova v2", desc: "Yangi navigatsiya va oflayn rejim", stage: "off", tenants: [] },
  { key: "payme", name: "Payme / Click to'lovlari", desc: "Kontrakt to'lovini ilova ichida qabul qilish", stage: "off", tenants: [] },
];

export const RELEASES = [
  { version: "2.8.0", date: "2026-11-14", title: "AI maslahatchi va LMS topshiriqlari", items: ["Talabalar uchun AI maslahatchi", "LMS orqali topshiriq yuborish", "Murojaatlarni avtomatik yo'naltirish"], kind: "major" as const },
  { version: "2.7.3", date: "2026-11-06", title: "Tuzatishlar", items: ["Jadvaldagi xona to'qnashuvi aniqlanishi tuzatildi", "Davomat eksportida sana formati"], kind: "patch" as const },
  { version: "2.7.0", date: "2026-10-21", title: "Rollar va vakolatlar", items: ["Rollar matritsasi", "Dekan uchun fakultet doirasi", "Ota-ona kabineti"], kind: "minor" as const },
];

/* ───────── API va ma'lumotlar ───────── */

export const API_LIMITS: Record<string, { perMinute: number; used24h: number; keys: number; blocked: number }> = {
  iau: { perMinute: 1200, used24h: 61_300, keys: 3, blocked: 0 },
  "abc-shop": { perMinute: 300, used24h: 3_200, keys: 1, blocked: 0 },
  medfarm: { perMinute: 300, used24h: 4_700, keys: 2, blocked: 140 },
  "sam-pm": { perMinute: 300, used24h: 410, keys: 0, blocked: 0 },
  "itpark-academy": { perMinute: 120, used24h: 1_260, keys: 1, blocked: 12 },
  lingua: { perMinute: 0, used24h: 0, keys: 1, blocked: 0 },
};

export interface DataRequest {
  id: string;
  tenant: string;
  kind: "export" | "delete";
  reason: string;
  requestedBy: string;
  requestedAt: string;
  status: "awaiting_owner" | "processing" | "ready" | "done" | "rejected";
}

export const DATA_REQUESTS: DataRequest[] = [
  { id: "DR-9", tenant: "lingua", kind: "export", reason: "Shartnoma tugashi — barcha ma'lumotlarni olish", requestedBy: "Malika Sobirova (ega)", requestedAt: "2026-11-12", status: "ready" },
  { id: "DR-8", tenant: "lingua", kind: "delete", reason: "Eksportdan so'ng ma'lumotlarni butunlay o'chirish", requestedBy: "Malika Sobirova (ega)", requestedAt: "2026-11-12", status: "awaiting_owner" },
  { id: "DR-7", tenant: "iau", kind: "export", reason: "Yillik zaxira nusxa (talaba arxivi)", requestedBy: "Aziz Qodirov (ega)", requestedAt: "2026-10-30", status: "done" },
];
