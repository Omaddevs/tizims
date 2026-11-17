/**
 * TIZIMS.AI — akademik demo ma'lumotlar (faqat demo/development muhiti uchun).
 * Backend ulanganda shu shakldagi API javoblari bilan almashtiriladi.
 *
 * Demo akkauntlar bilan bog'lanish:
 *  - u-ts-teacher (Dr. Sardor Rahimov)  → IT-21, IT-22 (Neyron tarmoqlar), IT-23 (Mashinali o'qitish)
 *  - u-ts-student (Jasmina Aliyeva)     → IT-21 guruhi, TLB-4819
 *  - u-ts-parent  (Bahrom Aliyev)       → farzandi: Jasmina Aliyeva
 */

export const DEMO_TEACHER_ID = "u-ts-teacher";
export const DEMO_STUDENT_ID = "TLB-4819";
export const DEMO_STUDENT_GROUP = "IT-21";

/* ───────── Tashkiliy tuzilma ───────── */

export interface Department {
  id: string;
  name: string;
  head: string;
  teachers: number;
  students: number;
}

export interface Faculty {
  id: string;
  name: string;
  dean: string;
  branch: string;
  departments: Department[];
}

export const BRANCHES = [
  { id: "br-tash", name: "Toshkent (bosh bino)", address: "Toshkent, Yunusobod", campuses: 3 },
  { id: "br-sam", name: "Samarqand filiali", address: "Samarqand, Universitet xiyoboni", campuses: 1 },
];

export const FACULTIES: Faculty[] = [
  {
    id: "f-it",
    name: "Axborot texnologiyalari fakulteti",
    dean: "Dekan B. Karimov",
    branch: "br-tash",
    departments: [
      { id: "d-ai", name: "Sun'iy intellekt kafedrasi", head: "Prof. Nodira Karimova", teachers: 18, students: 420 },
      { id: "d-se", name: "Dasturiy injiniring kafedrasi", head: "Dr. Alisher Rasulov", teachers: 22, students: 610 },
      { id: "d-net", name: "Kompyuter tarmoqlari kafedrasi", head: "Bekzod Tursunov", teachers: 12, students: 280 },
    ],
  },
  {
    id: "f-agro",
    name: "Agronomiya fakulteti",
    dean: "Dr. Kamol Ismoilov",
    branch: "br-tash",
    departments: [
      { id: "d-plant", name: "O'simlikshunoslik kafedrasi", head: "Prof. Dilnoza Ahmedova", teachers: 15, students: 390 },
      { id: "d-soil", name: "Tuproqshunoslik kafedrasi", head: "Dr. Farhod Qosimov", teachers: 9, students: 210 },
    ],
  },
  {
    id: "f-econ",
    name: "Iqtisodiyot fakulteti",
    dean: "Prof. Gulnora Saidova",
    branch: "br-sam",
    departments: [
      { id: "d-fin", name: "Moliya va kredit kafedrasi", head: "Dr. Rustam Nazarov", teachers: 14, students: 460 },
      { id: "d-mkt", name: "Marketing kafedrasi", head: "Shahlo Yo'ldosheva", teachers: 8, students: 240 },
    ],
  },
];

export const ADMIN_UNITS = [
  { name: "Registrator ofisi", head: "Malika Yusupova", staff: 6 },
  { name: "Ta'lim sifatini nazorat qilish bo'limi", head: "Dr. Anvar To'xtayev", staff: 4 },
  { name: "Talabalar bilan ishlash bo'limi", head: "Zarina Hasanova", staff: 5 },
  { name: "Moliya bo'limi", head: "Odil Mirzayev", staff: 7 },
];

/* ───────── Guruhlar, fanlar, o'qituvchilar ───────── */

export interface Group {
  id: string;
  faculty: string;
  direction: string;
  course: number;
  curator: string;
  students: number;
  attendance: number;
  gpa: number;
}

export const GROUPS: Group[] = [
  { id: "IT-21", faculty: "f-it", direction: "Sun'iy intellekt", course: 3, curator: "Dr. Sardor Rahimov", students: 28, attendance: 94, gpa: 3.71 },
  { id: "IT-22", faculty: "f-it", direction: "Sun'iy intellekt", course: 3, curator: "Prof. Nodira Karimova", students: 30, attendance: 90, gpa: 3.52 },
  { id: "IT-23", faculty: "f-it", direction: "Dasturiy injiniring", course: 2, curator: "Bekzod Tursunov", students: 32, attendance: 78, gpa: 3.18 },
  { id: "AG-21", faculty: "f-agro", direction: "Agronomiya", course: 3, curator: "Prof. Dilnoza Ahmedova", students: 26, attendance: 88, gpa: 3.44 },
  { id: "EK-22", faculty: "f-econ", direction: "Moliya", course: 2, curator: "Dr. Rustam Nazarov", students: 34, attendance: 91, gpa: 3.6 },
];

export interface Teacher {
  id: string;
  name: string;
  department: string;
  degree: string;
  load: number;
  maxLoad: number;
  rating: number;
  email: string;
}

export const TEACHERS: Teacher[] = [
  { id: DEMO_TEACHER_ID, name: "Dr. Sardor Rahimov", department: "Sun'iy intellekt", degree: "PhD, dotsent", load: 18, maxLoad: 20, rating: 4.8, email: "teacher@tizims.ai" },
  { id: "t-nodira", name: "Prof. Nodira Karimova", department: "Sun'iy intellekt", degree: "DSc, professor", load: 14, maxLoad: 16, rating: 4.9, email: "n.karimova@iau.uz" },
  { id: "t-bekzod", name: "Bekzod Tursunov", department: "Kompyuter tarmoqlari", degree: "Katta o'qituvchi", load: 22, maxLoad: 20, rating: 4.3, email: "b.tursunov@iau.uz" },
  { id: "t-kamola", name: "Kamola Ergasheva", department: "Xorijiy tillar", degree: "Katta o'qituvchi", load: 20, maxLoad: 22, rating: 4.7, email: "k.ergasheva@iau.uz" },
  { id: "t-alisher", name: "Dr. Alisher Rasulov", department: "Dasturiy injiniring", degree: "PhD, dotsent", load: 16, maxLoad: 18, rating: 4.5, email: "a.rasulov@iau.uz" },
  { id: "t-malika", name: "Malika Yusupova", department: "Ijtimoiy fanlar", degree: "O'qituvchi", load: 12, maxLoad: 18, rating: 4.4, email: "m.yusupova@iau.uz" },
];

export interface Subject {
  code: string;
  name: string;
  credits: number;
  teacherId: string;
  groups: string[];
  hours: number;
  progress: number;
}

export const SUBJECTS: Subject[] = [
  { code: "CS-301", name: "Neyron tarmoqlar", credits: 6, teacherId: DEMO_TEACHER_ID, groups: ["IT-21", "IT-22"], hours: 90, progress: 62 },
  { code: "CS-320", name: "Mashinali o'qitish", credits: 6, teacherId: DEMO_TEACHER_ID, groups: ["IT-23"], hours: 90, progress: 55 },
  { code: "MA-204", name: "Chiziqli algebra", credits: 5, teacherId: "t-nodira", groups: ["IT-21", "IT-22", "IT-23"], hours: 75, progress: 68 },
  { code: "CS-215", name: "Ma'lumotlar tuzilmasi", credits: 6, teacherId: "t-bekzod", groups: ["IT-21", "IT-23"], hours: 90, progress: 60 },
  { code: "EN-110", name: "Ingliz tili (B2)", credits: 4, teacherId: "t-kamola", groups: ["IT-21", "IT-22", "AG-21", "EK-22"], hours: 60, progress: 71 },
  { code: "SE-210", name: "Dasturiy ta'minot arxitekturasi", credits: 5, teacherId: "t-alisher", groups: ["IT-23"], hours: 75, progress: 48 },
  { code: "HI-100", name: "O'zbekiston tarixi", credits: 3, teacherId: "t-malika", groups: ["AG-21", "EK-22"], hours: 45, progress: 80 },
];

/**
 * Fanlar reestri (frontend). Ilova ochilganda bazadagi katalog bilan to'ldiriladi (SubjectsProvider);
 * yuklanguncha demo ro'yxat ishlatiladi. Server bu reestrdan foydalanmaydi — u bazadan o'qiydi.
 */
let registry: Subject[] | null = null;
let registryTeachers: Record<string, string> = {};

export function setSubjectRegistry(list: (Subject & { teacherName?: string })[]) {
  registry = list;
  registryTeachers = Object.fromEntries(list.filter((x) => x.teacherName).map((x) => [x.teacherId, x.teacherName!]));
}

export const allSubjects = (): Subject[] => registry ?? SUBJECTS;
export const teacherName = (id: string) => registryTeachers[id] ?? TEACHERS.find((t) => t.id === id)?.name ?? "—";
export const subjectByCode = (code: string) => allSubjects().find((s) => s.code === code);

export interface Semester {
  id: string;
  name: string;
  start: string;
  end: string;
  weeks: number;
  current: number;
  status: "active" | "closed";
  /** Kuzgi (fall) yoki bahorgi (spring) — bahorgi yopilganda kurs ko'chiriladi va bitiruvchilar chiqariladi */
  kind: "fall" | "spring";
  closedAt?: string;
  closedBy?: string;
  stats?: { students: number; gpa: number; failed: number; promoted: number; graduated: number; excluded: number };
}

export const SEMESTERS: Semester[] = [
  { id: "2026-1", name: "2026–2027 · Kuzgi semestr", start: "2026-09-02", end: "2027-01-15", weeks: 18, current: 11, status: "active", kind: "fall" },
  { id: "2025-2", name: "2025–2026 · Bahorgi semestr", start: "2026-02-03", end: "2026-06-20", weeks: 18, current: 18, status: "closed", kind: "spring" },
];

/** Bakalavriat — oxirgi kurs */
export const MAX_COURSE = 4;

/** 5 ballik baho → 4 ballik GPA punkti */
export const MARK_POINTS: Record<number, number> = { 5: 4, 4: 3, 3: 2, 2: 0 };

export const CURRICULUM = [
  { semester: 5, subjects: ["Neyron tarmoqlar", "Chiziqli algebra", "Ma'lumotlar tuzilmasi", "Ingliz tili (B2)"], credits: 21 },
  { semester: 6, subjects: ["Kompyuter ko'rish", "Tabiiy tilni qayta ishlash", "Bulutli hisoblash", "Malakaviy amaliyot"], credits: 24 },
];

/* ───────── Talabalar ───────── */

export type StudentStatus = "active" | "leave" | "expelled" | "graduated";

export interface Student {
  id: string;
  name: string;
  group: string;
  gpa: number;
  attendance: number;
  status: StudentStatus;
  funding: "Grant" | "Kontrakt";
  phone: string;
  parent: string;
  debt: number;
  /** Yig'ilgan kreditlar (semestr yopilganda yangilanadi) */
  creditsEarned?: number;
}

export const STUDENTS: Student[] = [
  { id: DEMO_STUDENT_ID, name: "Jasmina Aliyeva", group: "IT-21", gpa: 3.78, attendance: 94, status: "active", funding: "Grant", phone: "+998 90 111 22 33", parent: "Bahrom Aliyev", debt: 0 },
  { id: "TLB-4820", name: "Javohir Karimov", group: "IT-21", gpa: 3.42, attendance: 91, status: "active", funding: "Kontrakt", phone: "+998 91 222 33 44", parent: "Akmal Karimov", debt: 0 },
  { id: "TLB-4826", name: "Diyora Nematova", group: "IT-21", gpa: 3.91, attendance: 98, status: "active", funding: "Grant", phone: "+998 93 123 45 67", parent: "Shoira Nematova", debt: 0 },
  { id: "TLB-4827", name: "Otabek Sobirov", group: "IT-21", gpa: 2.41, attendance: 71, status: "active", funding: "Kontrakt", phone: "+998 94 765 43 21", parent: "Ilhom Sobirov", debt: 1 },
  { id: "TLB-4828", name: "Shahzoda Umarova", group: "IT-21", gpa: 3.55, attendance: 89, status: "active", funding: "Kontrakt", phone: "+998 97 555 66 77", parent: "Lola Umarova", debt: 0 },
  { id: "TLB-4829", name: "Asadbek Mirzayev", group: "IT-21", gpa: 2.86, attendance: 82, status: "active", funding: "Kontrakt", phone: "+998 99 444 33 22", parent: "Botir Mirzayev", debt: 1 },
  { id: "TLB-4823", name: "Nilufar Rahimova", group: "IT-22", gpa: 3.66, attendance: 93, status: "active", funding: "Grant", phone: "+998 90 987 65 43", parent: "Sanjar Rahimov", debt: 0 },
  { id: "TLB-4824", name: "Sardor Ergashev", group: "IT-22", gpa: 2.95, attendance: 76, status: "leave", funding: "Kontrakt", phone: "+998 91 321 54 76", parent: "Erkin Ergashev", debt: 0 },
  { id: "TLB-4830", name: "Mohira Tojiboyeva", group: "IT-22", gpa: 3.12, attendance: 85, status: "active", funding: "Kontrakt", phone: "+998 93 678 90 12", parent: "Dilshod Tojiboyev", debt: 0 },
  { id: "TLB-4831", name: "Ulug'bek Hamroyev", group: "IT-22", gpa: 2.33, attendance: 64, status: "active", funding: "Kontrakt", phone: "+998 94 210 98 76", parent: "Nodir Hamroyev", debt: 2 },
  { id: "TLB-4825", name: "Kamola Yusupova", group: "IT-23", gpa: 3.84, attendance: 95, status: "active", funding: "Grant", phone: "+998 97 135 79 24", parent: "Hamid Yusupov", debt: 0 },
  { id: "TLB-4822", name: "Bobur Tursunov", group: "IT-23", gpa: 2.18, attendance: 58, status: "active", funding: "Kontrakt", phone: "+998 99 246 80 13", parent: "Alijon Tursunov", debt: 3 },
  { id: "TLB-4832", name: "Feruza Qodirova", group: "IT-23", gpa: 3.27, attendance: 80, status: "active", funding: "Kontrakt", phone: "+998 90 864 20 97", parent: "Rahim Qodirov", debt: 0 },
  { id: "TLB-4821", name: "Madina Saidova", group: "IT-23", gpa: 1.92, attendance: 49, status: "expelled", funding: "Kontrakt", phone: "+998 91 975 31 86", parent: "Komil Saidov", debt: 4 },
  { id: "TLB-4833", name: "Jamshid Olimov", group: "AG-21", gpa: 3.38, attendance: 90, status: "active", funding: "Grant", phone: "+998 93 112 23 34", parent: "Olim Olimov", debt: 0 },
  { id: "TLB-4834", name: "Sevara Ismoilova", group: "EK-22", gpa: 3.73, attendance: 96, status: "active", funding: "Kontrakt", phone: "+998 94 445 56 67", parent: "Ismoil Rasulov", debt: 0 },
];

export const STUDENT_STATUS_LABEL: Record<StudentStatus, string> = {
  active: "Faol",
  leave: "Akademik ta'til",
  expelled: "Chetlashtirilgan",
  graduated: "Bitirgan",
};

/** Talabaning akademik xavf darajasi (GPA, davomat va qarzdorlik asosida). */
export function riskOf(s: Pick<Student, "gpa" | "attendance" | "debt">): "high" | "medium" | "low" {
  const score = (s.gpa < 2.5 ? 2 : s.gpa < 3 ? 1 : 0) + (s.attendance < 70 ? 2 : s.attendance < 85 ? 1 : 0) + (s.debt >= 2 ? 2 : s.debt === 1 ? 1 : 0);
  return score >= 4 ? "high" : score >= 2 ? "medium" : "low";
}

/* ───────── Dars jadvali va xonalar ───────── */

export const DAYS = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
export const DAYS_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh"];
export const SLOTS = ["08:30–09:50", "10:00–11:20", "11:30–12:50", "13:30–14:50", "15:00–16:20"];

export type LessonType = "Ma'ruza" | "Amaliy" | "Laboratoriya" | "Seminar";

export interface Lesson {
  id: string;
  day: number;
  slot: number;
  subject: string;
  group: string;
  teacherId: string;
  room: string;
  type: LessonType;
  /** Jadvaldan olib tashlangan (davomat tarixi uchun saqlanadi) */
  archived?: boolean;
}

export const LESSONS: Lesson[] = [
  { id: "l1", day: 0, slot: 0, subject: "CS-301", group: "IT-21", teacherId: DEMO_TEACHER_ID, room: "IT-3.12", type: "Ma'ruza" },
  { id: "l2", day: 0, slot: 1, subject: "MA-204", group: "IT-21", teacherId: "t-nodira", room: "A-201", type: "Ma'ruza" },
  { id: "l3", day: 0, slot: 2, subject: "CS-301", group: "IT-22", teacherId: DEMO_TEACHER_ID, room: "IT-3.12", type: "Ma'ruza" },
  { id: "l4", day: 0, slot: 3, subject: "CS-320", group: "IT-23", teacherId: DEMO_TEACHER_ID, room: "IT-2.04", type: "Amaliy" },
  { id: "l5", day: 1, slot: 0, subject: "EN-110", group: "IT-21", teacherId: "t-kamola", room: "B-104", type: "Amaliy" },
  { id: "l6", day: 1, slot: 1, subject: "CS-215", group: "IT-21", teacherId: "t-bekzod", room: "IT-1.08", type: "Laboratoriya" },
  { id: "l7", day: 1, slot: 2, subject: "CS-215", group: "IT-23", teacherId: "t-bekzod", room: "IT-1.08", type: "Laboratoriya" },
  { id: "l8", day: 1, slot: 3, subject: "SE-210", group: "IT-23", teacherId: "t-alisher", room: "A-305", type: "Ma'ruza" },
  { id: "l9", day: 2, slot: 0, subject: "CS-301", group: "IT-21", teacherId: DEMO_TEACHER_ID, room: "IT-Lab-2", type: "Laboratoriya" },
  { id: "l10", day: 2, slot: 1, subject: "CS-301", group: "IT-22", teacherId: DEMO_TEACHER_ID, room: "IT-Lab-2", type: "Laboratoriya" },
  { id: "l11", day: 2, slot: 2, subject: "MA-204", group: "IT-23", teacherId: "t-nodira", room: "A-201", type: "Amaliy" },
  { id: "l12", day: 2, slot: 3, subject: "HI-100", group: "AG-21", teacherId: "t-malika", room: "B-204", type: "Seminar" },
  { id: "l13", day: 3, slot: 1, subject: "CS-301", group: "IT-21", teacherId: DEMO_TEACHER_ID, room: "IT-3.12", type: "Amaliy" },
  { id: "l14", day: 3, slot: 2, subject: "MA-204", group: "IT-21", teacherId: "t-nodira", room: "A-201", type: "Amaliy" },
  { id: "l15", day: 3, slot: 3, subject: "HI-100", group: "EK-22", teacherId: "t-malika", room: "B-204", type: "Seminar" },
  { id: "l16", day: 3, slot: 3, subject: "EN-110", group: "AG-21", teacherId: "t-kamola", room: "B-204", type: "Amaliy" },
  { id: "l17", day: 4, slot: 0, subject: "CS-320", group: "IT-23", teacherId: DEMO_TEACHER_ID, room: "IT-Lab-1", type: "Laboratoriya" },
  { id: "l18", day: 4, slot: 1, subject: "EN-110", group: "IT-22", teacherId: "t-kamola", room: "B-104", type: "Amaliy" },
  { id: "l19", day: 4, slot: 2, subject: "CS-215", group: "IT-21", teacherId: "t-bekzod", room: "IT-1.08", type: "Amaliy" },
  { id: "l20", day: 5, slot: 0, subject: "MA-204", group: "IT-22", teacherId: "t-nodira", room: "A-201", type: "Ma'ruza" },
];

export interface Room {
  id: string;
  block: string;
  type: "Auditoriya" | "Laboratoriya" | "Kompyuter xonasi" | "Seminar xonasi";
  capacity: number;
  status: "free" | "busy" | "repair";
}

export const ROOMS: Room[] = [
  { id: "A-201", block: "A-blok", type: "Auditoriya", capacity: 120, status: "busy" },
  { id: "A-305", block: "A-blok", type: "Auditoriya", capacity: 80, status: "free" },
  { id: "B-104", block: "B-blok", type: "Seminar xonasi", capacity: 30, status: "busy" },
  { id: "B-204", block: "B-blok", type: "Seminar xonasi", capacity: 32, status: "repair" },
  { id: "IT-1.08", block: "IT-blok", type: "Kompyuter xonasi", capacity: 30, status: "busy" },
  { id: "IT-2.04", block: "IT-blok", type: "Kompyuter xonasi", capacity: 28, status: "free" },
  { id: "IT-3.12", block: "IT-blok", type: "Auditoriya", capacity: 60, status: "busy" },
  { id: "IT-Lab-1", block: "IT-blok", type: "Laboratoriya", capacity: 24, status: "free" },
  { id: "IT-Lab-2", block: "IT-blok", type: "Laboratoriya", capacity: 24, status: "busy" },
];

/** Bir vaqtda bir xonada (yoki bir o'qituvchida) ikki dars — to'qnashuv. */
export function findConflicts(lessons: Lesson[]) {
  const out: { a: Lesson; b: Lesson; reason: string }[] = [];
  for (let i = 0; i < lessons.length; i++) {
    for (let j = i + 1; j < lessons.length; j++) {
      const a = lessons[i];
      const b = lessons[j];
      if (a.day !== b.day || a.slot !== b.slot) continue;
      if (a.room === b.room) out.push({ a, b, reason: `${a.room} xonasi band` });
      else if (a.teacherId === b.teacherId) out.push({ a, b, reason: `${teacherName(a.teacherId)} ikki joyda` });
    }
  }
  return out;
}

/* ───────── Baholar ───────── */

export interface GradeRow {
  studentId: string;
  subject: string;
  jn: number; // joriy nazorat (max 30)
  on: number; // oraliq nazorat (max 20)
  yn: number | null; // yakuniy nazorat (max 50)
}

const seedGrades = (subject: string, group: string, base: number): GradeRow[] =>
  STUDENTS.filter((s) => s.group === group).map((s, i) => {
    const k = Math.min(1, Math.max(0.3, s.gpa / 4 + ((i * 7) % 5) / 100 - base));
    return { studentId: s.id, subject, jn: Math.round(30 * k), on: Math.round(20 * k), yn: null };
  });

export const GRADES: GradeRow[] = [
  ...seedGrades("CS-301", "IT-21", 0),
  ...seedGrades("CS-301", "IT-22", 0.02),
  ...seedGrades("CS-320", "IT-23", 0.04),
];

/** Talabaning (Jasmina) barcha fanlari bo'yicha natijalari */
export const MY_RESULTS = [
  { subject: "CS-301", jn: 28, on: 18, yn: null as number | null },
  { subject: "MA-204", jn: 25, on: 17, yn: null as number | null },
  { subject: "CS-215", jn: 27, on: 19, yn: null as number | null },
  { subject: "EN-110", jn: 29, on: 19, yn: null as number | null },
];

export const PAST_SEMESTERS = [
  { name: "1-semestr", gpa: 3.52 },
  { name: "2-semestr", gpa: 3.61 },
  { name: "3-semestr", gpa: 3.7 },
  { name: "4-semestr", gpa: 3.74 },
  { name: "5-semestr (joriy)", gpa: 3.78 },
];

export const EXAMS = [
  { id: "ex1", subject: "CS-301", group: "IT-21", kind: "Oraliq nazorat", date: "2026-11-20", time: "10:00", room: "IT-3.12" },
  { id: "ex2", subject: "MA-204", group: "IT-21", kind: "Oraliq nazorat", date: "2026-11-22", time: "08:30", room: "A-201" },
  { id: "ex3", subject: "CS-301", group: "IT-22", kind: "Oraliq nazorat", date: "2026-11-21", time: "10:00", room: "IT-3.12" },
  { id: "ex4", subject: "CS-320", group: "IT-23", kind: "Test", date: "2026-11-19", time: "13:30", room: "IT-Lab-1" },
  { id: "ex5", subject: "EN-110", group: "IT-21", kind: "Yakuniy (og'zaki)", date: "2026-12-18", time: "10:00", room: "B-104" },
  { id: "ex6", subject: "HI-100", group: "EK-22", kind: "Yakuniy (yozma)", date: "2026-12-20", time: "11:30", room: "A-305" },
];

/** 100 ballik tizimdan 5 ballik bahoga */
export function toMark(total: number) {
  if (total >= 86) return 5;
  if (total >= 71) return 4;
  if (total >= 55) return 3;
  return 2;
}

/* ───────── Davomat ───────── */

export type AttendanceMark = "present" | "late" | "excused" | "absent";

export const ATTENDANCE_LABEL: Record<AttendanceMark, string> = {
  present: "Keldi",
  late: "Kechikdi",
  excused: "Sababli",
  absent: "Kelmadi",
};

/** Haftalik davomat (talabaning o'zi uchun) */
export const MY_ATTENDANCE_LOG = [
  { date: "2026-11-16", subject: "CS-301", mark: "present" as AttendanceMark },
  { date: "2026-11-16", subject: "MA-204", mark: "present" as AttendanceMark },
  { date: "2026-11-13", subject: "CS-215", mark: "present" as AttendanceMark },
  { date: "2026-11-12", subject: "CS-301", mark: "late" as AttendanceMark },
  { date: "2026-11-12", subject: "MA-204", mark: "present" as AttendanceMark },
  { date: "2026-11-11", subject: "CS-215", mark: "excused" as AttendanceMark },
  { date: "2026-11-10", subject: "EN-110", mark: "present" as AttendanceMark },
  { date: "2026-11-09", subject: "CS-301", mark: "absent" as AttendanceMark },
  { date: "2026-11-09", subject: "MA-204", mark: "present" as AttendanceMark },
];

export const ATTENDANCE_TREND = [
  { week: "1-hafta", value: 96 },
  { week: "2-hafta", value: 95 },
  { week: "3-hafta", value: 93 },
  { week: "4-hafta", value: 94 },
  { week: "5-hafta", value: 91 },
  { week: "6-hafta", value: 92 },
  { week: "7-hafta", value: 89 },
  { week: "8-hafta", value: 90 },
  { week: "9-hafta", value: 92 },
  { week: "10-hafta", value: 91 },
  { week: "11-hafta", value: 92 },
];

/* ───────── LMS va kutubxona ───────── */

export interface Material {
  id: string;
  subject: string;
  title: string;
  kind: "PDF" | "Video" | "Slayd" | "Havola";
  size: string;
  week: number;
}

export const MATERIALS: Material[] = [
  { id: "m1", subject: "CS-301", title: "1-ma'ruza: Perseptron va faollashtirish funksiyalari", kind: "Slayd", size: "4.2 MB", week: 1 },
  { id: "m2", subject: "CS-301", title: "Backpropagation — video dars", kind: "Video", size: "48 min", week: 3 },
  { id: "m3", subject: "CS-301", title: "Konvolyutsion tarmoqlar (CNN)", kind: "PDF", size: "2.8 MB", week: 7 },
  { id: "m4", subject: "CS-301", title: "PyTorch amaliy qo'llanma", kind: "Havola", size: "pytorch.org", week: 8 },
  { id: "m5", subject: "CS-320", title: "Regressiya va klassifikatsiya", kind: "Slayd", size: "3.1 MB", week: 2 },
  { id: "m6", subject: "MA-204", title: "Matritsalar va determinantlar", kind: "PDF", size: "1.6 MB", week: 2 },
  { id: "m7", subject: "CS-215", title: "Daraxtlar va graflar", kind: "Video", size: "36 min", week: 6 },
  { id: "m8", subject: "EN-110", title: "Academic writing: essay structure", kind: "PDF", size: "0.9 MB", week: 5 },
];

export interface Assignment {
  id: string;
  subject: string;
  title: string;
  due: string;
  maxScore: number;
  submitted: number;
  total: number;
}

export const ASSIGNMENTS: Assignment[] = [
  { id: "a1", subject: "CS-301", title: "3-laboratoriya: MNIST klassifikatori", due: "2026-11-18", maxScore: 10, submitted: 21, total: 28 },
  { id: "a2", subject: "CS-301", title: "Referat: Transformer arxitekturasi", due: "2026-11-25", maxScore: 5, submitted: 6, total: 28 },
  { id: "a3", subject: "CS-320", title: "Kaggle mini-musobaqa", due: "2026-11-30", maxScore: 15, submitted: 4, total: 32 },
  { id: "a4", subject: "MA-204", title: "Uy vazifasi №6", due: "2026-11-17", maxScore: 5, submitted: 24, total: 28 },
  { id: "a5", subject: "CS-215", title: "AVL daraxtini implementatsiya qilish", due: "2026-11-21", maxScore: 10, submitted: 11, total: 28 },
];

export const BOOKS = [
  { id: "b1", title: "Deep Learning", author: "I. Goodfellow, Y. Bengio, A. Courville", year: 2016, kind: "E-kitob", available: true },
  { id: "b2", title: "Pattern Recognition and Machine Learning", author: "C. Bishop", year: 2006, kind: "E-kitob", available: true },
  { id: "b3", title: "Introduction to Algorithms", author: "T. Cormen va boshq.", year: 2022, kind: "Bosma", available: false },
  { id: "b4", title: "Linear Algebra Done Right", author: "S. Axler", year: 2024, kind: "E-kitob", available: true },
  { id: "b5", title: "O'zbekiston tarixi", author: "Q. Usmonov", year: 2020, kind: "Bosma", available: true },
  { id: "b6", title: "Dasturlash asoslari (Python)", author: "IAU nashriyoti", year: 2025, kind: "E-kitob", available: true },
];

/* ───────── Murojaatlar ───────── */

export type ComplaintStatus = "new" | "review" | "resolved" | "rejected";

export interface Complaint {
  id: string;
  title: string;
  body: string;
  category: string;
  department: string;
  author: string;
  authorRole: string;
  status: ComplaintStatus;
  date: string;
  anonymous?: boolean;
  answer?: string;
  /** Joriy foydalanuvchi yuborgan (anonim bo'lsa ham o'ziga ko'rinadi) */
  mine?: boolean;
  /** Ko'rib chiqish tarixi (server qaytaradi) */
  history?: { at: string; by: string; text: string; kind: "created" | "status" | "department" | "answer" }[];
}

export const COMPLAINT_STATUS_LABEL: Record<ComplaintStatus, string> = {
  new: "Yangi",
  review: "Ko'rib chiqilmoqda",
  resolved: "Hal qilindi",
  rejected: "Rad etildi",
};

export const COMPLAINT_CATEGORIES = ["Baholash", "Dars jadvali", "Infratuzilma", "O'qituvchi", "To'lov", "Yotoqxona", "Texnik yordam", "Ma'lumotnoma", "Boshqa"];
/** "Yordam" sahifasidan yuboriladigan so'rov turlari */
export const SUPPORT_CATEGORIES = ["Texnik yordam", "Ma'lumotnoma"];
/** Kategoriya bo'yicha avtomatik yo'naltirish */
export const COMPLAINT_ROUTE: Record<string, string> = {
  Baholash: "Ta'lim bo'limi",
  "Dars jadvali": "Registrator ofisi",
  Infratuzilma: "Xo'jalik bo'limi",
  "O'qituvchi": "Ta'lim bo'limi",
  "To'lov": "Moliya bo'limi",
  Yotoqxona: "Talabalar bilan ishlash bo'limi",
  "Texnik yordam": "AKT bo'limi",
  "Ma'lumotnoma": "Registrator ofisi",
  Boshqa: "Talabalar bilan ishlash bo'limi",
};

export const COMPLAINT_DEPARTMENTS = ["AKT bo'limi", "Ta'lim bo'limi", "Registrator ofisi", "Talabalar bilan ishlash bo'limi", "Moliya bo'limi", "Xo'jalik bo'limi"];

export const COMPLAINTS: Complaint[] = [
  { id: "CMP-118", title: "Oraliq nazorat bahosi noto'g'ri kiritilgan", body: "MA-204 fanidan oraliq nazorat bahom 12 emas, 17 bo'lishi kerak edi.", category: "Baholash", department: "Ta'lim bo'limi", author: "Javohir Karimov", authorRole: "student", status: "review", date: "2026-11-15" },
  { id: "CMP-119", title: "B-blokda isitish ishlamayapti", body: "B-104 xonasida ertalabki darslarda juda sovuq.", category: "Infratuzilma", department: "Xo'jalik bo'limi", author: "Anonim", authorRole: "student", status: "new", date: "2026-11-16", anonymous: true },
  { id: "CMP-120", title: "Kontrakt to'lovi ikki marta yechildi", body: "Bank orqali to'lov ikki marta o'tdi, qaytarishni so'rayman.", category: "To'lov", department: "Moliya bo'limi", author: "Bahrom Aliyev", authorRole: "parent", status: "new", date: "2026-11-14" },
  { id: "CMP-112", title: "Jadvalda ikki dars ustma-ust", body: "Payshanba 13:30 da HI-100 va EN-110 bir xonada.", category: "Dars jadvali", department: "Registrator ofisi", author: "Jasmina Aliyeva", authorRole: "student", status: "resolved", date: "2026-11-08", answer: "EN-110 darsi A-305 xonasiga ko'chirildi. Rahmat!" },
  { id: "CMP-109", title: "Laboratoriya kompyuterlari eskirgan", body: "IT-Lab-2 dagi 6 ta kompyuter GPU talab qiladigan topshiriqlarni bajara olmaydi.", category: "Infratuzilma", department: "Xo'jalik bo'limi", author: "Dr. Sardor Rahimov", authorRole: "teacher", status: "review", date: "2026-11-02" },
];

/* ───────── AI tahlil ───────── */

export const AI_FACULTY_INSIGHTS = [
  { tone: "red" as const, title: "IT-23 guruhida davomat keskin pasaygan", text: "So'nggi 3 haftada davomat 91% dan 78% ga tushdi. Asosan 1-juftlik darslari (08:30) qoldirilmoqda.", action: "Kurator bilan uchrashuv belgilash" },
  { tone: "amber" as const, title: "Bekzod Tursunov yuklamasi me'yordan oshgan", text: "Haftalik yuklama 22 soat (me'yor 20). Talabalar baholashi so'nggi oyda 4.6 dan 4.3 ga tushgan.", action: "Yuklamani qayta taqsimlash" },
  { tone: "amber" as const, title: "B-204 xonasi bilan bog'liq to'qnashuvlar", text: "Ta'mir sababli 3 ta dars ko'chirilishi kerak. A-305 va IT-2.04 xonalari bu vaqtlarda bo'sh.", action: "Avtomatik qayta joylashtirish" },
  { tone: "green" as const, title: "IT-21 guruhida o'zlashtirish o'smoqda", text: "O'rtacha ball semestr boshidan +0.18 ga oshdi. CS-301 fanidagi laboratoriya formati samarali.", action: "Tajribani boshqa guruhlarga yoyish" },
];

export const AI_STUDENT_TIPS = [
  { title: "Chiziqli algebra (MA-204) — diqqat talab qiladi", text: "Oraliq nazoratga 6 kun qoldi. Joriy ballingiz guruh o'rtachasidan 2 ball past. Har kuni 40 daqiqa takrorlash tavsiya etiladi." },
  { title: "Davomatingiz a'lo darajada", text: "94% — guruhdagi eng yaxshi 5 talaba qatoridasiz. Grantni saqlab qolish uchun 90% dan yuqori ushlab turing." },
  { title: "Tavsiya etilgan materiallar", text: "CNN mavzusi bo'yicha 'Deep Learning' (Goodfellow), 9-bob va LMS'dagi 7-hafta PDF materiali." },
];
