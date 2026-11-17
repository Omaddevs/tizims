export type Role =
  | "super_admin"
  | "owner"
  | "rector"
  | "dept_head"
  | "manager"
  | "advisor"
  | "teacher"
  | "student"
  | "parent";

export type Priority = "critical" | "urgent" | "high" | "medium" | "low";

export interface User {
  id: string;
  email: string;
  password: string;
  passwordHash?: string;
  name: string;
  role: Role;
  avatar?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
  isPlatformAdmin?: boolean;
}

export type TaskStatus = "pending" | "in_progress" | "done" | "failed";

export interface TaskSubItem {
  id: string;
  title: string;
  done: boolean;
  doneAt?: string;
}

export interface TaskComment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  at: string;
}

export interface TaskFile {
  id: string;
  name: string;
  size: string;
}

export interface Task {
  id: string;
  number: number;
  title: string;
  description?: string;
  due: string;
  dueLabel: string;
  priority: Priority;
  status: TaskStatus;
  done: boolean;
  category: string;
  relatedId?: string;
  organizationId?: string;
  /** Vazifani yaratgan foydalanuvchi */
  ownerId?: string;
  /** Mas'ul */
  assigneeId?: string;
  assigneeName?: string;
  note?: string;
  tags?: string[];
  createdAt?: string;
  archived?: boolean;
  subtasks?: TaskSubItem[];
  comments?: TaskComment[];
  files?: TaskFile[];
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  channel: "inapp" | "telegram" | "email";
  forUserId?: string;
  link?: string;
  organizationId?: string;
}

export interface AuditEntry {
  id: string;
  user: string;
  action: string;
  object: string;
  objectId: string;
  oldValue?: string;
  newValue?: string;
  date: string;
  ip: string;
  organizationId?: string;
}
