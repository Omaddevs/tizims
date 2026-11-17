/** Fanlar katalogi — bazadan, butun ilova uchun bitta manba. */
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useApp } from "../store/AppContext";
import { useApi } from "./api";
import { setSubjectRegistry, type Subject } from "../data/academic";

export type SubjectView = Subject & { teacherName: string; teacherAccount: "active" | "suspended" | "none" };

const Ctx = createContext<{ list: SubjectView[]; loaded: boolean; reload: () => Promise<void> }>({ list: [], loaded: false, reload: async () => undefined });

export function SubjectsProvider({ children }: { children: ReactNode }) {
  const { user, hasModule, mustChangePassword } = useApp();
  const enabled = !!user && user.role !== "super_admin" && hasModule("education") && !mustChangePassword;
  const q = useApi<SubjectView[]>(enabled ? "/edu/subjects" : null);
  // Reestrni render paytida yangilaymiz — sahifalar birinchi chizishdayoq to'g'ri nomlarni oladi
  if (q.data) setSubjectRegistry(q.data);
  useEffect(() => {
    if (q.data) setSubjectRegistry(q.data);
  }, [q.data]);
  return <Ctx.Provider value={{ list: q.data ?? [], loaded: !!q.data, reload: q.reload }}>{children}</Ctx.Provider>;
}

/** Sahifa fanlar yangilanganda qayta chizilishi uchun obuna bo'ladi */
export function useSubjects() {
  return useContext(Ctx);
}

/** /api/edu/teachers javobi */
export type TeacherRow = { id: string; name: string; email: string; account: "active" | "suspended" | "none"; subjects: string[]; load: number; department: string | null };

/** Haftalik me'yor (soat) — eski ro'yxatda belgilangan bo'lsa undan, aks holda 20 */
export const MAX_LOAD = 20;
