import { useApp } from "../../store/AppContext";
import { FEATURE_MANAGE_PERMISSION, accessOf, featureByKey, featureLabel, type Access, type FeatureKey } from "../../core/features";
import { DEMO_STUDENT_GROUP, DEMO_STUDENT_ID, GROUPS, STUDENTS, allSubjects, type Student } from "../../data/academic";
import { useSubjects } from "../../lib/subjects";

/**
 * Joriy foydalanuvchining modul ichidagi ko'rish doirasi.
 *  - teacher → o'zi dars beradigan fanlar va guruhlar
 *  - student → o'zi (demo: Jasmina Aliyeva)
 *  - parent  → farzandi (demo: Jasmina Aliyeva)
 *  - dept_head → o'z fakulteti (demo: AT fakulteti)
 */
export function useScope(key: FeatureKey) {
  const { user, can } = useApp();
  const role = user?.role ?? "";
  const rawAccess: Access | null = accessOf(role, key);
  // Ega rollar matritsasida ruxsatni olib tashlagan bo'lsa — boshqaruv tugmalari ko'rinmaydi (server ham rad etadi)
  const perm = FEATURE_MANAGE_PERMISSION[key];
  const access: Access | null = rawAccess === "manage" && perm && !can(perm) ? "view" : rawAccess;
  const feature = featureByKey(key);

  useSubjects(); // fanlar katalogi yangilansa sahifa qayta chiziladi
  const mySubjects = role === "teacher" ? allSubjects().filter((s) => s.teacherId === user?.id) : [];
  const myGroups = role === "teacher" ? Array.from(new Set(mySubjects.flatMap((s) => s.groups))) : [];
  const me: Student | undefined = role === "student" || role === "parent" ? STUDENTS.find((s) => s.id === DEMO_STUDENT_ID) : undefined;
  const facultyId = role === "dept_head" ? "f-it" : null;
  const facultyGroups = facultyId ? GROUPS.filter((g) => g.faculty === facultyId).map((g) => g.id) : null;

  return {
    user,
    role,
    access,
    title: featureLabel(feature, role),
    description: feature.description,
    isManage: access === "manage",
    /** Boshqaruv huquqi rollar matritsasida olib tashlangan */
    revoked: rawAccess === "manage" && access !== "manage",
    isOwn: access === "own",
    isTeacher: role === "teacher",
    isStudent: role === "student",
    isParent: role === "parent",
    mySubjects,
    myGroups,
    me,
    studentGroup: me ? DEMO_STUDENT_GROUP : null,
    facultyId,
    facultyGroups,
  };
}
