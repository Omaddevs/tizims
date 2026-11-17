/** Parolni o'zgartirish. `forced` — vaqtinchalik parol bilan kirilganda (yopib bo'lmaydi). */
import { useState } from "react";
import { KeyRound, LogOut } from "lucide-react";
import { useApp } from "../store/AppContext";
import { Btn, FieldLabel, TextInput } from "./kit";

export function PasswordDialog({ forced, onClose }: { forced?: boolean; onClose?: () => void }) {
  const { changePassword, logout, user } = useApp();
  const [f, setF] = useState({ current: "", next: "", repeat: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const strongEnough = f.next.length >= 8 && /[A-Za-z]/.test(f.next) && /\d/.test(f.next);
  const ok = f.current && strongEnough && f.next === f.repeat;

  async function submit() {
    setSaving(true);
    const err = await changePassword(f.current, f.next);
    setSaving(false);
    if (err) setError(err);
    else if (forced) setDone(true);
    else onClose?.();
  }

  if (done) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[10vh]" onClick={forced ? undefined : onClose}>
      <form
        className="ts-pop w-full max-w-md rounded-lg border border-ts-line2 bg-ts-card text-ts-fg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (ok && !saving) void submit();
        }}
      >
        <div className="flex items-center gap-2.5 border-b border-ts-line px-4 py-3">
          <KeyRound className="h-4 w-4" />
          <h3 className="text-base font-medium">{forced ? "Yangi parol o'rnating" : "Parolni o'zgartirish"}</h3>
        </div>
        <div className="space-y-3 p-4">
          {forced && (
            <p className="rounded-md bg-ts-tile p-3 text-sm text-ts-sub">
              Salom, {user?.name}! Siz vaqtinchalik parol bilan kirdingiz. Davom etish uchun faqat o'zingiz biladigan yangi parol o'rnating.
            </p>
          )}
          <FieldLabel label={forced ? "Vaqtinchalik parol" : "Joriy parol"}>
            <TextInput type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
          </FieldLabel>
          <FieldLabel label="Yangi parol">
            <TextInput type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
          </FieldLabel>
          <div className={f.next && !strongEnough ? "text-xs text-red-500" : "text-xs text-ts-sub"}>Kamida 8 belgi, harf va raqam bo'lsin.</div>
          <FieldLabel label="Yangi parolni takrorlang">
            <TextInput type="password" autoComplete="new-password" value={f.repeat} onChange={(e) => setF({ ...f, repeat: e.target.value })} />
          </FieldLabel>
          {f.repeat && f.repeat !== f.next && <div className="text-xs text-red-500">Parollar mos emas.</div>}
          {error && <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">{error}</div>}
        </div>
        <div className="flex justify-between gap-2 border-t border-ts-line px-4 py-3">
          {forced ? (
            <Btn variant="ghost" onClick={() => void logout()}>
              <LogOut className="h-4 w-4" /> Chiqish
            </Btn>
          ) : (
            <Btn onClick={onClose}>Bekor qilish</Btn>
          )}
          <Btn variant="primary" type="submit" disabled={!ok || saving}>
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </Btn>
        </div>
      </form>
    </div>
  );
}
