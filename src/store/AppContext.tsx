/**
 * Ilova holati — sessiya, tashkilot, vazifalar, bildirishnomalar va audit API'dan olinadi.
 * Kirish nazorati serverda; bu yerdagi filtrlar faqat UI uchun.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuditEntry, NotificationItem, Priority, Role, Task, User } from "../types";
import type { Membership, ModuleKey, Organization } from "../core/types";
import { api, errorText, onUnauthorized } from "../lib/api";

export { taskVisibleTo } from "../core/access";

type TaskPatch = Partial<Pick<Task, "title" | "due" | "priority" | "category" | "note" | "done" | "status" | "description" | "assigneeId" | "tags" | "archived">> & {
  assigneeName?: string;
  dueLabel?: string;
};

interface NewTaskInput {
  title: string;
  due: string;
  priority: Priority;
  category: string;
  note?: string;
  description?: string;
  assigneeId?: string;
  assigneeName?: string;
  tags?: string[];
}

interface SessionView {
  user: { id: string; email: string; name: string; role: Role | null; isPlatformAdmin: boolean };
  organization: Organization | null;
  organizations: Organization[];
  memberships: Membership[];
  modules: ModuleKey[];
  permissions: string[];
  mustChangePassword: boolean;
}

interface AppContextValue {
  booting: boolean;
  user: User | null;
  tasks: Task[];
  notifications: NotificationItem[];
  audit: AuditEntry[];
  organization: Organization | null;
  organizations: Organization[];
  memberships: Membership[];
  enabledModules: ModuleKey[];
  directoryUsers: User[];
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  switchOrganization: (organizationId: string) => Promise<string | null>;
  markTask: (id: string, done: boolean) => void;
  addTask: (input: NewTaskInput) => Promise<string>;
  updateTask: (id: string, patch: TaskPatch) => void;
  deleteTask: (id: string) => void;
  toggleSubtask: (taskId: string, subId: string) => void;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;
  reloadAudit: () => void;
  /** Vaqtinchalik parol bilan kirilgan — parolni almashtirish majburiy */
  mustChangePassword: boolean;
  changePassword: (current: string, next: string) => Promise<string | null>;
  /** Sessiyani (rol, ruxsatlar, modullar) serverdan qayta o'qish */
  refreshSession: () => Promise<void>;
  can: (permission: string) => boolean;
  hasModule: (key: ModuleKey) => boolean;
  /** Oxirgi API xatosi (vazifa/bildirishnoma amallari) — UI xabar sifatida ko'rsatadi */
  lastError: string | null;
  clearError: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function toUser(s: SessionView): User {
  return {
    id: s.user.id,
    email: s.user.email,
    name: s.user.name,
    password: "",
    role: (s.user.role ?? s.memberships[0]?.role ?? "manager") as Role,
    isPlatformAdmin: s.user.isPlatformAdmin,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionView | null>(null);
  const [booting, setBooting] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [directory, setDirectory] = useState<User[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    api<SessionView>("/auth/me")
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setBooting(false));
    return onUnauthorized(() => setSession(null));
  }, []);

  const orgId = session?.organization?.id ?? null;
  const canAudit = !!session?.permissions.includes("core.audit.view") && !session.user.isPlatformAdmin;
  const blocked = !!session?.mustChangePassword;

  const reloadAudit = useCallback(() => {
    if (!canAudit || blocked) return;
    api<AuditEntry[]>("/org/audit").then(setAudit).catch(() => undefined);
  }, [canAudit, blocked]);

  // Tashkilot o'zgarganda — tashkilot ma'lumotlarini qayta yuklash
  useEffect(() => {
    setTasks([]);
    setNotifications([]);
    setAudit([]);
    setDirectory([]);
    if (!orgId || session?.user.isPlatformAdmin || blocked) return;
    api<Task[]>("/org/tasks").then(setTasks).catch((e) => setLastError(errorText(e)));
    api<NotificationItem[]>("/org/notifications").then(setNotifications).catch(() => undefined);
    api<{ id: string; name: string; email: string; role: Role }[]>("/org/members")
      .then((rows) => setDirectory(rows.map((r) => ({ ...r, password: "" }))))
      .catch(() => undefined);
    reloadAudit();
  }, [orgId, session?.user.isPlatformAdmin, blocked, reloadAudit]);

  const changePassword = useCallback(async (current: string, next: string) => {
    try {
      setSession(await api<SessionView>("/auth/password", { body: { current, next } }));
      return null;
    } catch (e) {
      return errorText(e);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      setSession(await api<SessionView>("/auth/me"));
    } catch {
      /* 401 — onUnauthorized chiqaradi */
    }
  }, []);

  const fail = (e: unknown) => setLastError(errorText(e));

  const login = useCallback(async (email: string, password: string) => {
    try {
      setSession(await api<SessionView>("/auth/login", { body: { email, password } }));
      return null;
    } catch (e) {
      return errorText(e);
    }
  }, []);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    setSession(null);
  }, []);

  const switchOrganization = useCallback(async (organizationId: string) => {
    try {
      setSession(await api<SessionView>("/auth/switch", { body: { organizationId } }));
      return null;
    } catch (e) {
      return errorText(e);
    }
  }, []);

  const replaceTask = (t: Task) => setTasks((list) => list.map((x) => (x.id === t.id ? t : x)));

  const updateTask = useCallback((id: string, patch: TaskPatch) => {
    const { assigneeName: _n, dueLabel: _d, ...body } = patch;
    api<Task>(`/org/tasks/${encodeURIComponent(id)}`, { method: "PATCH", body }).then(replaceTask).catch(fail);
  }, []);

  const markTask = useCallback((id: string, done: boolean) => updateTask(id, { done }), [updateTask]);

  const addTask = useCallback(async (input: NewTaskInput) => {
    try {
      const { assigneeName: _n, ...body } = input;
      const t = await api<Task>("/org/tasks", { body });
      setTasks((list) => [t, ...list]);
      return t.id;
    } catch (e) {
      fail(e);
      return "";
    }
  }, []);

  const deleteTask = useCallback((id: string) => {
    api(`/org/tasks/${encodeURIComponent(id)}`, { method: "DELETE" })
      .then(() => setTasks((list) => list.filter((x) => x.id !== id)))
      .catch(fail);
  }, []);

  const toggleSubtask = useCallback((taskId: string, subId: string) => {
    api<Task>(`/org/tasks/${encodeURIComponent(taskId)}/subtasks/${encodeURIComponent(subId)}/toggle`, { method: "POST" }).then(replaceTask).catch(fail);
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((n) => n.map((x) => (x.id === id ? { ...x, read: true } : x)));
    api(`/org/notifications/${encodeURIComponent(id)}/read`, { method: "POST" }).catch(() => undefined);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
    api("/org/notifications/read-all", { method: "POST" }).catch(() => undefined);
  }, []);

  const permissions = session?.permissions;
  const modules = session?.modules;
  const can = useCallback((p: string) => !!permissions?.includes(p), [permissions]);
  const hasModule = useCallback((k: ModuleKey) => !!modules?.includes(k), [modules]);
  const user = useMemo(() => (session ? toUser(session) : null), [session]);

  const value = useMemo<AppContextValue>(
    () => ({
      booting,
      user,
      tasks,
      notifications,
      audit,
      organization: session?.organization ?? null,
      organizations: session?.organizations ?? [],
      memberships: session?.memberships ?? [],
      enabledModules: session?.modules ?? [],
      directoryUsers: directory,
      login,
      logout,
      switchOrganization,
      markTask,
      addTask,
      updateTask,
      deleteTask,
      toggleSubtask,
      markNotificationRead,
      markAllRead,
      reloadAudit,
      mustChangePassword: blocked,
      changePassword,
      refreshSession,
      can,
      hasModule,
      lastError,
      clearError: () => setLastError(null),
    }),
    [booting, user, tasks, notifications, audit, session, directory, login, logout, switchOrganization, markTask, addTask, updateTask, deleteTask, toggleSubtask, markNotificationRead, markAllRead, reloadAudit, blocked, changePassword, refreshSession, can, hasModule, lastError],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
