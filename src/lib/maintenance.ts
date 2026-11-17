/** Rejali texnik ishlar uchun yordamchilar (server bilan bir xil qoida: 7 kun oldin ogohlantirish). */
import type { Maintenance } from "../data/platform";

/** Yaqin 7 kun ichidagi yoki hozir davom etayotgan texnik ish */
export function upcomingMaintenance(list: Maintenance[], now = new Date()) {
  const week = now.getTime() + 7 * 86400000;
  return list
    .filter((m) => (m.status === "scheduled" || m.status === "in_progress") && new Date(m.end).getTime() > now.getTime() && new Date(m.start).getTime() < week)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
}

export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const months = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
  return `${d.getDate()}-${months[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
