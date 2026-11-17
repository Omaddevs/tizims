import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ComponentType, ReactNode } from "react";
import { AppProvider, useApp } from "./store/AppContext";
import { AppLayout } from "./components/Layout";
import { LoginPage } from "./pages/Login";
import { Landing } from "./pages/Landing";
import { ModuleHome, SelectOrgPage } from "./pages/SelectOrg";
import { OrgSettingsPage, PlatformAdminPage } from "./pages/PlatformAdmin";
import { TasksPage, TaskTemplatesPage } from "./pages/Tasks";
import { AuditPage } from "./pages/System";
import { EducationDashboardPage } from "./pages/EducationDashboard";
import { eduRouteAllowed } from "./core/catalog";
import { TenantsPage } from "./pages/platform/Tenants";
import { BillingPage } from "./pages/platform/Billing";
import { SupportPage } from "./pages/platform/Support";
import { MonitoringPage, PlatformAuditPage, SecurityPage } from "./pages/platform/Ops";
import { AnnouncementsPage } from "./pages/platform/Announcements";
import { GrowthPage } from "./pages/platform/Growth";
import { ReleasesPage } from "./pages/platform/Releases";
import { TeamPage } from "./pages/platform/Team";
import { DataApiPage } from "./pages/platform/DataApi";
import { StatusPage } from "./pages/Status";
import { MembersPage, OrgBillingPage, OrgSupportPage } from "./pages/OwnerPages";
import { OwnerDashboardPage } from "./pages/OwnerDashboard";
import { FacultyDetailPage, GroupDetailPage, StudentDetailPage } from "./pages/edu/Details";
import { StudentAnalyticsPage } from "./pages/edu/StudentAnalytics";
import { RoomsMonitorPage } from "./pages/edu/RoomsMonitor";
import { MySubjectsPage } from "./pages/edu/MySubjects";
import { TestsPage } from "./pages/edu/Tests";
import { BlogPage, NewsPage } from "./pages/edu/Posts";
import { HelpPage } from "./pages/edu/Help";
import { SettingsPage } from "./pages/Settings";
import { StudentHomePage } from "./pages/edu/StudentHome";
import { MemberDetailPage } from "./pages/MemberDetail";
import { accessOf, type FeatureKey } from "./core/features";
import type { ModuleKey } from "./core/types";
import { AcademicPage } from "./pages/edu/Academic";
import { AttendancePage } from "./pages/edu/Attendance";
import { ComplaintsPage } from "./pages/edu/Complaints";
import { GradesPage } from "./pages/edu/Grades";
import { InsightsPage } from "./pages/edu/Insights";
import { LmsPage } from "./pages/edu/Lms";
import { MessagesPage } from "./pages/edu/Messages";
import { PeoplePage } from "./pages/edu/People";
import { RolesPage } from "./pages/edu/Roles";
import { StructurePage } from "./pages/edu/Structure";
import { TimetablePage } from "./pages/edu/Timetable";

function Booting() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f4f6] text-sm text-neutral-500">
      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-800" />
      Yuklanmoqda...
    </div>
  );
}

function Gate() {
  const { booting, user, organization } = useApp();
  if (booting) return <Booting />;
  if (!user) return <LoginPage />;
  if (!organization) return <SelectOrgPage />;
  return <Navigate to="/" replace />;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { booting, user, organization } = useApp();
  const location = useLocation();
  if (booting) return <Booting />;
  if (!user) return location.pathname === "/" ? <Landing /> : <Navigate to="/login" replace />;
  if (!organization) return <Navigate to="/login" replace />;
  if (!eduRouteAllowed(user.role, location.pathname)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireModule({ module, children }: { module: ModuleKey; children: ReactNode }) {
  const { hasModule } = useApp();
  if (!hasModule(module)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequirePerm({ perm, children }: { perm: string; children: ReactNode }) {
  const { can } = useApp();
  if (!can(perm)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user } = useApp();
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Ta'lim moduli: tashkilotda "education" yoqilgan va rolga kirish berilgan bo'lishi shart. */
function RequireFeature({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const { user, hasModule } = useApp();
  if (!hasModule("education") || !accessOf(user?.role, feature)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const EDU_PAGES: [FeatureKey, string, ComponentType][] = [
  ["academic", "academic", AcademicPage],
  ["timetable", "timetable", TimetablePage],
  ["attendance", "attendance", AttendancePage],
  ["grades", "grades", GradesPage],
  ["lms", "lms", LmsPage],
  ["messages", "messages", MessagesPage],
  ["complaints", "complaints", ComplaintsPage],
  ["insights", "insights", InsightsPage],
  ["people", "people", PeoplePage],
  ["structure", "structure", StructurePage],
  ["roles", "roles", RolesPage],
  ["rooms", "rooms", RoomsMonitorPage],
  ["mySubjects", "my-subjects", MySubjectsPage],
  ["tests", "tests", TestsPage],
  ["news", "news", NewsPage],
  ["blog", "blog", BlogPage],
  ["support", "help", HelpPage],
];

function RoleHome() {
  const { user, hasModule } = useApp();
  if (user?.role === "super_admin") return <PlatformAdminPage />;
  // Ega — butun tashkilot holati (ta'lim analitikasi alohida sahifada)
  if (user?.role === "owner") return <OwnerDashboardPage />;
  // Talaba / ota-ona — shaxsiy bosh sahifa (faqat haqiqiy ma'lumot)
  if ((user?.role === "student" || user?.role === "parent") && hasModule("education")) return <StudentHomePage />;
  // Nazoratchi — xonalar monitoringi (hozir qayerda dars ketyapti)
  if (user?.role === "advisor" && hasModule("education")) return <RoomsMonitorPage />;
  // Rahbariyat — mavjud kontingent analitikasi (qabul to'xtatilgan)
  if ((user?.role === "rector" || user?.role === "dept_head") && hasModule("education")) return <StudentAnalyticsPage />;
  if (hasModule("education")) return <EducationDashboardPage />;
  if (hasModule("shop")) return <ModuleHome title="Do'kon" subtitle="Mahsulot, buyurtma, ombor" />;
  if (hasModule("pharmacy")) return <ModuleHome title="Apteka" subtitle="Dori, partiya, muddat" />;
  if (hasModule("crm")) return <ModuleHome title="CRM" subtitle="Lidlar, mijozlar, bitimlar" />;
  return <OrgSettingsPage />;
}

/** Tashkilot sozlamalari va tashkilot audit logi — tashkilot rahbariyati uchun. */
const ADMIN_ROLES = ["owner", "rector"];

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/login" element={<Gate />} />
        <Route path="/welcome" element={<Landing />} />
        <Route path="/status" element={<StatusPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<RoleHome />} />
          <Route path="organization" element={<RequireRole roles={ADMIN_ROLES}><OrgSettingsPage /></RequireRole>} />
          <Route path="platform-admin" element={<Navigate to="/" replace />} />
          <Route path="platform/tenants" element={<RequireRole roles={["super_admin"]}><TenantsPage /></RequireRole>} />
          <Route path="platform/billing" element={<RequireRole roles={["super_admin"]}><BillingPage /></RequireRole>} />
          <Route path="platform/support" element={<RequireRole roles={["super_admin"]}><SupportPage /></RequireRole>} />
          <Route path="platform/monitoring" element={<RequireRole roles={["super_admin"]}><MonitoringPage /></RequireRole>} />
          <Route path="platform/audit" element={<RequireRole roles={["super_admin"]}><PlatformAuditPage /></RequireRole>} />
          <Route path="platform/growth" element={<RequireRole roles={["super_admin"]}><GrowthPage /></RequireRole>} />
          <Route path="platform/announcements" element={<RequireRole roles={["super_admin"]}><AnnouncementsPage /></RequireRole>} />
          <Route path="platform/releases" element={<RequireRole roles={["super_admin"]}><ReleasesPage /></RequireRole>} />
          <Route path="platform/team" element={<RequireRole roles={["super_admin"]}><TeamPage /></RequireRole>} />
          <Route path="platform/data" element={<RequireRole roles={["super_admin"]}><DataApiPage /></RequireRole>} />
          <Route path="crm" element={<RequireModule module="crm"><ModuleHome title="CRM" subtitle="Lidlar, mijozlar, bitimlar" /></RequireModule>} />
          <Route path="shop" element={<RequireModule module="shop"><ModuleHome title="Do'kon" subtitle="Mahsulot, buyurtma, ombor" /></RequireModule>} />
          <Route path="pharmacy" element={<RequireModule module="pharmacy"><ModuleHome title="Apteka" subtitle="Dori, partiya, muddat" /></RequireModule>} />
          <Route path="people/:id" element={<RequireFeature feature="people"><StudentDetailPage /></RequireFeature>} />
          <Route path="academic/groups/:id" element={<RequireFeature feature="academic"><GroupDetailPage /></RequireFeature>} />
          <Route path="structure/:id" element={<RequireFeature feature="structure"><FacultyDetailPage /></RequireFeature>} />
          <Route path="members/:id" element={<RequirePerm perm="core.users.manage"><MemberDetailPage /></RequirePerm>} />
          {EDU_PAGES.map(([key, path, Comp]) => (
            <Route key={key} path={path} element={<RequireFeature feature={key}><Comp /></RequireFeature>} />
          ))}
          <Route path="settings" element={<SettingsPage />} />
          <Route path="tasks" element={<TasksPage scope="mine" />} />
          <Route path="tasks/all" element={<TasksPage scope="all" />} />
          <Route path="tasks/templates" element={<TaskTemplatesPage />} />
          <Route path="audit" element={<RequirePerm perm="core.audit.view"><AuditPage /></RequirePerm>} />
          <Route path="analytics" element={<RequireRole roles={["owner"]}><RequireModule module="education"><StudentAnalyticsPage /></RequireModule></RequireRole>} />
          <Route path="members" element={<RequirePerm perm="core.users.manage"><MembersPage /></RequirePerm>} />
          <Route path="billing" element={<RequirePerm perm="core.billing.view"><OrgBillingPage /></RequirePerm>} />
          <Route path="support" element={<RequirePerm perm="core.support.manage"><OrgSupportPage /></RequirePerm>} />
          <Route path="system" element={<RequireRole roles={["super_admin"]}><SecurityPage /></RequireRole>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppProvider>
  );
}
