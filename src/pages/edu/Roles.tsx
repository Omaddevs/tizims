import { Fragment, useState } from "react";
import { Check, Eye, KeyRound, Pencil, RotateCcw, User } from "lucide-react";
import { Btn, Card, CardHead, Page, Pill, QueryState, ScopeNote, Stat, Tabs, useToast } from "../../components/kit";
import { api, errorText, useApi } from "../../lib/api";
import { cn, roleLabel } from "../../lib/utils";
import { FEATURES, FEATURE_SECTIONS, type Access } from "../../core/features";
import { PERMISSIONS, ROLE_PERMISSIONS } from "../../core/catalog";
import type { Role } from "../../types";
import { useScope } from "./scope";

const ROLES: Role[] = ["super_admin", "owner", "rector", "dept_head", "advisor", "teacher", "student", "parent"];

const ACCESS_META: Record<Access, { label: string; cls: string; Icon: typeof Eye }> = {
  manage: { label: "Boshqaradi", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", Icon: Pencil },
  view: { label: "Ko'radi", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400", Icon: Eye },
  own: { label: "O'zinikini", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400", Icon: User },
};

export function RolesPage() {
  const s = useScope("roles");
  const [toast, showToast] = useToast();
  const [tab, setTab] = useState<"modules" | "permissions">("modules");
  const q = useApi<{ matrix: Record<string, string[]>; level: "platform" | "organization"; locked: string[] }>("/edu/roles/permissions");
  const locked = q.data?.locked ?? ["super_admin", "owner"];
  const perms = q.data?.matrix ?? ROLE_PERMISSIONS;
  const level = q.data?.level;
  const [busy, setBusy] = useState(false);

  async function toggle(role: Role, key: string) {
    if (!s.isManage || locked.includes(role) || busy) return;
    const cur = perms[role] ?? [];
    const keys = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    setBusy(true);
    try {
      q.setData(await api("/edu/roles/permissions", { method: "PUT", body: { role, keys } }));
    } catch (e) {
      showToast(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title={s.title} subtitle={s.description}>
      {!s.isManage && <ScopeNote>Ko'rish rejimi. Vakolatlarni faqat tashkilot egasi o'zgartira oladi.</ScopeNote>}
      {s.isManage && level === "platform" && <ScopeNote>Siz <b>platforma shablonlarini</b> tahrirlayapsiz — o'z sozlamasi bo'lmagan barcha tashkilotlarga qo'llanadi. Tashkilot egasi o'z tashkiloti uchun ustiga yozishi mumkin.</ScopeNote>}
      {s.isManage && level === "organization" && <ScopeNote>O'zgarishlar faqat sizning tashkilotingizga qo'llanadi va audit logga yoziladi.</ScopeNote>}
      {q.error && <QueryState error={q.error} loading={false} onRetry={q.reload}>{null}</QueryState>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Rollar" value={ROLES.length} icon={KeyRound} />
        <Stat label="Modullar" value={FEATURES.length} icon={Check} />
        <Stat label="Ruxsatlar" value={PERMISSIONS.length} icon={Pencil} />
        <Stat label="Kirish modeli" value="RBAC" hint="Tashkilot bo'yicha izolyatsiya" icon={Eye} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "modules", label: "Modullar matritsasi" },
            { key: "permissions", label: "Ruxsatlar" },
          ]}
        />
        <div className="flex flex-wrap gap-2 text-xs">
          {(Object.keys(ACCESS_META) as Access[]).map((a) => {
            const M = ACCESS_META[a];
            return (
              <span key={a} className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium", M.cls)}>
                <M.Icon className="h-3 w-3" /> {M.label}
              </span>
            );
          })}
        </div>
      </div>

      {tab === "modules" && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="bg-ts-tile">
                  <th className="h-10 px-4 font-medium">Modul</th>
                  {ROLES.map((r) => (
                    <th key={r} className="h-10 px-2 text-center text-xs font-medium">
                      {roleLabel(r).replace(" (Advisor)", "").replace(" / bo'lim rahbari", "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_SECTIONS.map((sec) => (
                  <Fragment key={sec}>
                    <tr>
                      <td colSpan={ROLES.length + 1} className="border-t border-ts-line bg-ts-tile px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ts-muted">
                        {sec}
                      </td>
                    </tr>
                    {FEATURES.filter((f) => f.section === sec).map((f) => (
                      <tr key={f.key}>
                        <td className="border-t border-ts-line px-4 py-2.5">
                          <div className="font-medium">{f.label}</div>
                          <div className="text-xs text-ts-sub">{f.description}</div>
                        </td>
                        {ROLES.map((r) => {
                          const a = f.access[r];
                          const M = a ? ACCESS_META[a] : null;
                          return (
                            <td key={r} className="border-t border-ts-line px-2 py-2.5 text-center">
                              {M ? (
                                <span title={M.label} className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md", M.cls)}>
                                  <M.Icon className="h-3.5 w-3.5" />
                                </span>
                              ) : (
                                <span className="text-ts-muted">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "permissions" && (
        <Card className="overflow-hidden">
          <CardHead
            title="Ruxsatlar"
            desc={s.isManage ? "Katakchaga bosib ruxsatni yoqing yoki o'chiring (demo rejim)" : "Har bir rol uchun berilgan ruxsatlar"}
            action={
              s.isManage ? (
                <Btn
                  size="sm"
                  onClick={async () => {
                    try {
                      q.setData(await api("/edu/roles/permissions/reset", { method: "POST" }));
                      showToast("Standart sozlamalar tiklandi");
                    } catch (e) {
                      showToast(errorText(e));
                    }
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Tiklash
                </Btn>
              ) : undefined
            }
            className="pb-4"
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="bg-ts-tile">
                  <th className="h-10 px-4 font-medium">Ruxsat</th>
                  {ROLES.map((r) => (
                    <th key={r} className="h-10 px-2 text-center text-xs font-medium">
                      {roleLabel(r).replace(" (Advisor)", "").replace(" / bo'lim rahbari", "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((p) => (
                  <tr key={p.key}>
                    <td className="border-t border-ts-line px-4 py-2">
                      <div className="font-medium">{p.name}</div>
                      <div className="font-mono text-[11px] text-ts-muted">{p.key}</div>
                    </td>
                    {ROLES.map((r) => {
                      const on = (perms[r] ?? []).includes(p.key);
                      const isLocked = !s.isManage || locked.includes(r);
                      return (
                        <td key={r} className="border-t border-ts-line px-2 py-2 text-center">
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => toggle(r, p.key)}
                            className={cn(
                              "inline-flex h-6 w-6 items-center justify-center rounded border transition",
                              on ? "border-transparent bg-ts-inv text-ts-invfg" : "border-ts-line2 bg-ts-input",
                              !isLocked && "hover:opacity-80",
                              isLocked && "cursor-default",
                            )}
                          >
                            {on && <Check className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 border-t border-ts-line px-4 py-2.5 text-xs text-ts-sub">
            {locked.map((r) => (
              <Pill key={r}>{roleLabel(r)}</Pill>
            ))}{" "}
            ruxsatlari qulflangan{level === "organization" ? " — ega o'zini tizimdan qulflab qo'ymasligi uchun" : ""}. O'zgarishlar darhol kuchga kiradi: foydalanuvchi keyingi so'rovda yangi ruxsat bilan ishlaydi.
          </div>
        </Card>
      )}
      {toast}
    </Page>
  );
}
