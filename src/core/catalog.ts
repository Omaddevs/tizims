import type { Role } from "../types";
import type { AppModule, Permission } from "./types";
import { FEATURES } from "./features";

export const MODULES: AppModule[] = [
  { id: "m-education", key: "education", name: "Ta'lim", description: "Talabalar, guruh, dars, davomat, baho", icon: "GraduationCap", version: "1.0.0", status: "active" },
  { id: "m-crm", key: "crm", name: "CRM", description: "Lidlar, mijozlar, bitimlar", icon: "Contact", version: "0.1.0", status: "beta" },
  { id: "m-shop", key: "shop", name: "Do'kon", description: "Mahsulot, buyurtma, ombor", icon: "Store", version: "0.1.0", status: "beta" },
  { id: "m-pharmacy", key: "pharmacy", name: "Apteka", description: "Dori, partiya, muddat", icon: "Pill", version: "0.1.0", status: "beta" },
  { id: "m-finance", key: "finance", name: "Moliya", description: "To'lov, shartnoma, qarzdorlik", icon: "Wallet", version: "0.1.0", status: "beta" },
  { id: "m-warehouse", key: "warehouse", name: "Ombor", description: "Qoldiq va harakat", icon: "Warehouse", version: "0.1.0", status: "beta" },
  { id: "m-documents", key: "documents", name: "Hujjatlar", description: "Shablon va arxiv", icon: "FolderOpen", version: "0.1.0", status: "beta" },
  { id: "m-analytics", key: "analytics", name: "Analitika", description: "KPI va hisobotlar", icon: "FileBarChart", version: "0.1.0", status: "beta" },
];

export const PERMISSIONS: Permission[] = [
  { key: "edu.dashboard.view", name: "Ta'lim dashboardini ko'rish", module: "education" },
  { key: "edu.students.view", name: "Talabalarni ko'rish", module: "education" },
  { key: "edu.students.manage", name: "Talaba holatini boshqarish", module: "education" },
  { key: "edu.attendance.view", name: "Davomatni ko'rish", module: "education" },
  { key: "edu.attendance.manage", name: "Davomat belgilash", module: "education" },
  { key: "edu.attendance.self", name: "O'z davomatini ko'rish", module: "education" },
  { key: "edu.attendance.child", name: "Farzand davomatini ko'rish", module: "education" },
  { key: "edu.grades.manage", name: "Baho qo'yish", module: "education" },
  { key: "edu.grades.self", name: "O'z baholarini ko'rish", module: "education" },
  { key: "edu.grades.child", name: "Farzand baholarini ko'rish", module: "education" },
  { key: "edu.timetable.view", name: "Dars jadvalini ko'rish", module: "education" },
  { key: "edu.timetable.manage", name: "Dars jadvalini o'zgartirish (xona ko'chirish)", module: "education" },
  { key: "edu.rooms.view", name: "Xonalar holatini ko'rish", module: "education" },
  { key: "edu.lms.manage", name: "LMS: material va topshiriq berish", module: "education" },
  { key: "edu.complaints.manage", name: "Murojaatlarni ko'rib chiqish", module: "education" },
  { key: "edu.academic.manage", name: "Guruh va o'quv rejasini boshqarish", module: "education" },
  { key: "edu.structure.manage", name: "Tashkiliy tuzilmani boshqarish", module: "education" },
  { key: "edu.tests.manage", name: "Testlar yaratish va natijalarni ko'rish", module: "education" },
  { key: "edu.news.manage", name: "E'lon va blog yozish", module: "education" },
  { key: "core.tasks.manage", name: "Vazifalarni boshqarish", module: "core" },
  { key: "core.audit.view", name: "Audit logni ko'rish", module: "core" },
  { key: "core.org.manage", name: "Tashkilot sozlamalari", module: "core" },
  { key: "core.users.manage", name: "Foydalanuvchilar", module: "core" },
  { key: "core.modules.manage", name: "Modullarni yoqish", module: "core" },
  { key: "core.billing.view", name: "Obuna va to'lovlarni ko'rish", module: "core" },
  { key: "core.support.manage", name: "TIZIMS yordamiga murojaat", module: "core" },
  { key: "platform.admin", name: "Platforma admin", module: "core" },
];

const EDU_ADMIN = [
  "edu.dashboard.view",
  "edu.students.view",
  "edu.students.manage",
  "edu.attendance.view",
  "edu.timetable.view",
  "edu.timetable.manage",
  "edu.rooms.view",
  "edu.complaints.manage",
  "edu.academic.manage",
  "edu.structure.manage",
  "edu.tests.manage",
  "edu.news.manage",
  "core.tasks.manage",
  "core.audit.view",
  "core.support.manage",
];

/** Standart ruxsatlar. Tashkilot egasi o'z tashkiloti uchun o'zgartira oladi (ega rolidan tashqari). */
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  super_admin: PERMISSIONS.map((p) => p.key),
  owner: [...EDU_ADMIN, "core.org.manage", "core.users.manage", "core.modules.manage", "core.billing.view"],
  rector: EDU_ADMIN,
  dept_head: ["edu.dashboard.view", "edu.students.view", "edu.students.manage", "edu.attendance.view", "edu.timetable.view", "edu.complaints.manage", "edu.academic.manage", "core.tasks.manage"],
  manager: ["core.tasks.manage"],
  // Nazoratchi: barcha guruhlar uchun davomat va baho, murojaatlar, xonalar, test va e'lonlar
  advisor: [
    "edu.dashboard.view",
    "edu.students.view",
    "edu.attendance.view",
    "edu.attendance.manage",
    "edu.grades.manage",
    "edu.complaints.manage",
    "edu.rooms.view",
    "edu.timetable.view",
    "edu.timetable.manage",
    "edu.tests.manage",
    "edu.news.manage",
    "core.tasks.manage",
  ],
  teacher: ["edu.dashboard.view", "edu.attendance.manage", "edu.grades.manage", "edu.lms.manage", "edu.timetable.view", "core.tasks.manage"],
  student: ["edu.dashboard.view", "edu.attendance.self", "edu.grades.self"],
  parent: ["edu.dashboard.view", "edu.attendance.child", "edu.grades.child"],
};

export function permissionsFor(role: Role): string[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/** Faqat o'z kabineti bilan ishlaydigan rollar — boshqaruv sahifalari ular uchun yopiq. */
export const EDU_ONLY_ROLES: Role[] = ["advisor", "teacher", "student", "parent"];

export function eduRouteAllowed(role: string, pathname: string) {
  const allowed = EDU_ROLE_ROUTES[role];
  if (!allowed) return true;
  return allowed.some((p) => (p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/")));
}

const featurePaths = (role: Role) => FEATURES.filter((f) => f.access[role]).map((f) => f.path);

/** Ta'lim rollari kira oladigan yo'llar (prefiks bo'yicha): dashboard, vazifalar va rolga ochiq modullar. */
export const EDU_ROLE_ROUTES: Record<string, string[]> = {
  /** Super admin — faqat platforma darajasi (tashkilot ichki sahifalari yopiq). */
  super_admin: ["/", "/platform", "/platform-admin", "/system", "/settings", ...featurePaths("super_admin")],
  advisor: ["/", "/tasks", "/settings", ...featurePaths("advisor")],
  teacher: ["/", "/tasks", "/settings", ...featurePaths("teacher")],
  student: ["/", "/settings", ...featurePaths("student")],
  parent: ["/", "/settings", ...featurePaths("parent")],
};

