export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function roleLabel(role: string) {
  const map: Record<string, string> = {
    super_admin: "Super Admin",
    owner: "Tashkilot egasi",
    rector: "Rektor",
    dept_head: "Dekan / bo'lim rahbari",
    manager: "Menejer",
    advisor: "Nazoratchi",
    teacher: "O'qituvchi",
    student: "Talaba",
    parent: "Ota-ona",
  };
  return map[role] ?? role;
}

export const statusLabel: Record<string, string> = {
  pending: "Kutilmoqda",
  approved: "Tasdiqlangan",
  rejected: "Rad etilgan",
  cancelled: "Bekor qilingan",
  draft: "Qoralama",
  active: "Faol",
  archived: "Arxiv",
  open: "Ochiq",
  closed: "Yopilgan",
  in_progress: "Jarayonda",
  done: "Bajarilgan",
  failed: "Bajarilmagan",
  overdue: "Muddati o'tgan",
};

export const priorityLabel: Record<string, string> = {
  critical: "Kritik",
  urgent: "Shoshilinch",
  high: "Yuqori",
  medium: "O'rta",
  low: "Past",
};
