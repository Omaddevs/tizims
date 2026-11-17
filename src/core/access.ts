/**
 * Server va frontend uchun umumiy ko'rinish qoidalari (React'ga bog'liq emas).
 * Server bu qoidalarni majburiy qo'llaydi; frontend faqat UI'ni moslash uchun ishlatadi.
 */
import type { Role, Task } from "../types";
import { EDU_ONLY_ROLES } from "./catalog";

/** Kabinet rollari (o'qituvchi, maslahatchi, talaba, ota-ona) faqat o'z vazifalarini ko'radi va o'zgartiradi. */
export function taskVisibleTo(task: Pick<Task, "ownerId" | "assigneeId">, user: { id: string; role: Role } | null) {
  if (!user) return false;
  if (!EDU_ONLY_ROLES.includes(user.role)) return true;
  return task.ownerId === user.id || task.assigneeId === user.id;
}

/** Umumiy (forUserId'siz) bildirishnomalar boshqaruv uchun — o'quvchi/ota-ona/o'qituvchi faqat o'zinikini ko'radi. */
export function noteVisible(n: { forUserId?: string }, userId?: string, role?: Role) {
  if (n.forUserId) return n.forUserId === userId;
  return !(role && EDU_ONLY_ROLES.includes(role));
}

/** Demo: talaba va ota-ona akkauntlarining talaba yozuviga bog'lanishi. */
export const STUDENT_LINKS: Record<string, string> = {
  "u-ts-student": "TLB-4819",
  "u-ts-parent": "TLB-4819",
};

/** Dekan qaysi fakultetni boshqaradi (demo). */
export const DEAN_FACULTY: Record<string, string> = {
  u5: "f-it",
  "u-deputy": "f-it",
};

/** Tashkilot sozlamalari, a'zolar, audit va yordam so'rovlarini tasdiqlash — tashkilot rahbariyati. */
export const ORG_ADMIN_ROLES: Role[] = ["owner", "rector"];
