/** Sozlamalar — barcha rollar uchun: profil, xavfsizlik (parol, sessiyalar), bildirishnomalar, ko'rinish */
import { useState } from "react";
import { Bell, KeyRound, LogOut, Monitor, Moon, ShieldCheck, Sun, UserRound } from "lucide-react";
import { useApp } from "../store/AppContext";
import { Avatar, Btn, Card, CardHead, KeyValues, Page, QueryState, ScopeNote, useToast } from "../components/kit";
import { api, errorText, useApi } from "../lib/api";
import { cn, roleLabel } from "../lib/utils";
import { useTheme } from "../lib/theme";
import { PASSWORD_EVENT } from "../components/Layout";

type Prefs = { schedule: boolean; grades: boolean; assignments: boolean; news: boolean; messages: boolean };

const TOPICS: { key: keyof Prefs; title: string; text: string }[] = [
  { key: "schedule", title: "Dars jadvali o'zgarishlari", text: "Dars ko'chirilsa, qo'shilsa yoki bekor qilinsa" },
  { key: "grades", title: "Baholar va semestr natijalari", text: "Semestr yopilganda GPA va natijalar" },
  { key: "assignments", title: "Topshiriqlar", text: "Muddat yaqinlashganda eslatma" },
  { key: "news", title: "E'lonlar", text: "Rahbariyat yangi e'lon qilganda" },
  { key: "messages", title: "Xabarlar", text: "Sizga yoki guruhingizga yangi xabar yozilganda" },
];

export function SettingsPage() {
  const { user, organization, memberships } = useApp();
  const { mode, toggle } = useTheme();
  const [toast, showToast] = useToast();
  const q = useApi<Prefs>(user?.role === "super_admin" ? null : "/org/me/preferences");
  const [busy, setBusy] = useState(false);
  const membership = memberships.find((m) => m.organizationId === organization?.id);

  async function setPref(key: keyof Prefs, value: boolean) {
    if (!q.data) return;
    const next = { ...q.data, [key]: value };
    q.setData(next);
    try {
      q.setData(await api<Prefs>("/org/me/preferences", { method: "PUT", body: next }));
    } catch (e) {
      q.setData({ ...next, [key]: !value });
      showToast(errorText(e));
    }
  }

  async function revokeOthers() {
    if (!window.confirm("Boshqa barcha qurilmalardagi sessiyalar yopilsinmi? Bu qurilmada qolasiz.")) return;
    setBusy(true);
    try {
      await api("/auth/sessions/revoke-others", { method: "POST" });
      showToast("Boshqa qurilmalardagi sessiyalar yopildi");
    } catch (e) {
      showToast(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="Sozlamalar" subtitle="Profil, xavfsizlik va bildirishnomalar">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHead title="Profil" />
          <div className="flex items-center gap-4 px-4 pt-4">
            <Avatar name={user?.name ?? ""} size={56} />
            <div>
              <div className="text-lg font-semibold">{user?.name}</div>
              <div className="text-sm text-ts-sub">{roleLabel(user?.role ?? "")}</div>
            </div>
          </div>
          <KeyValues
            items={[
              ["Email (login)", user?.email ?? "—"],
              ["Tashkilot", organization?.name ?? "—"],
              ["Rol", roleLabel(user?.role ?? "")],
              ["A'zo bo'lgan sana", membership?.joinedAt ?? "—"],
            ]}
          />
          <div className="px-4 pb-4">
            <ScopeNote>Ism yoki emailni o'zgartirish uchun tashkilot administratoriga murojaat qiling.</ScopeNote>
          </div>
        </Card>

        <Card>
          <CardHead title="Xavfsizlik" />
          <div className="space-y-3 p-4">
            <Row icon={KeyRound} title="Parol" text="Kamida 8 belgi, harf va raqam. O'zgartirilsa — boshqa qurilmalardagi sessiyalar yopiladi.">
              <Btn onClick={() => window.dispatchEvent(new Event(PASSWORD_EVENT))}>O'zgartirish</Btn>
            </Row>
            <Row icon={LogOut} title="Boshqa qurilmalar" text="Telefon yoki boshqa kompyuterda ochiq qolgan sessiyalarni yopish.">
              <Btn disabled={busy} onClick={revokeOthers}>
                Hammasidan chiqish
              </Btn>
            </Row>
            <Row icon={ShieldCheck} title="Sessiya muddati" text="Faolsiz 8 soatdan so'ng tizimdan avtomatik chiqasiz." />
          </div>
        </Card>

        {user?.role !== "super_admin" && (
          <Card>
            <CardHead title="Bildirishnomalar" desc="Qaysi xabarlarni olishni tanlang" />
            <QueryState error={q.error} loading={q.loading && !q.data} onRetry={q.reload}>
              <div className="divide-y divide-ts-line">
                {TOPICS.map((t) => {
                  const on = q.data?.[t.key] ?? true;
                  return (
                    <button key={t.key} type="button" onClick={() => void setPref(t.key, !on)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-ts-hover">
                      <Bell className="h-4 w-4 shrink-0 text-ts-sub" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{t.title}</span>
                        <span className="block text-xs text-ts-sub">{t.text}</span>
                      </span>
                      <span className={cn("h-5 w-9 shrink-0 rounded-full p-0.5 transition", on ? "bg-emerald-500" : "bg-ts-line2")}>
                        <span className={cn("block h-4 w-4 rounded-full bg-white shadow transition", on && "translate-x-4")} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </QueryState>
          </Card>
        )}

        <Card>
          <CardHead title="Ko'rinish" />
          <div className="space-y-3 p-4">
            <Row icon={mode === "dark" ? Moon : Sun} title="Mavzu" text={mode === "dark" ? "Qorong'i" : "Yorug'"}>
              <Btn onClick={toggle}>{mode === "dark" ? "Yorug'ga o'tish" : "Qorong'iga o'tish"}</Btn>
            </Row>
            <BrowserNotifyRow />
            <Row icon={Monitor} title="Til" text="O'zbekcha · rus va ingliz tillari tez orada" />
            <Row icon={UserRound} title="Qurilma" text="Sozlamalar shu akkauntga bog'langan — boshqa qurilmada ham amal qiladi (mavzudan tashqari)." />
          </div>
        </Card>
      </div>
      {toast}
    </Page>
  );
}

/** Brauzer bildirishnomasi: sahifa boshqa varaqda ochiq turganda yangi xabar haqida xabar beradi */
function BrowserNotifyRow() {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [perm, setPerm] = useState(supported ? Notification.permission : "denied");
  const text = !supported
    ? "Bu brauzer bildirishnomalarni qo'llab-quvvatlamaydi"
    : perm === "granted"
      ? "Yoqilgan — tizim boshqa varaqda ochiq turganda yangi xabar haqida xabar beriladi"
      : perm === "denied"
        ? "Bloklangan — brauzer manzil satridagi qulf belgisidan ruxsat bering"
        : "Tizim boshqa varaqda ochiq turganda yangi xabarlar haqida ogohlantirish";
  return (
    <Row icon={Bell} title="Brauzer bildirishnomalari" text={text}>
      {supported && perm === "default" && <Btn onClick={() => void Notification.requestPermission().then(setPerm)}>Yoqish</Btn>}
    </Row>
  );
}

function Row({ icon: Icon, title, text, children }: { icon: typeof Bell; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-ts-line p-3">
      <Icon className="h-4 w-4 shrink-0 text-ts-sub" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-ts-sub">{text}</div>
      </div>
      {children}
    </div>
  );
}
