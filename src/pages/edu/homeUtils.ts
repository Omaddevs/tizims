/** Bosh sahifa uchun kichik yordamchilar */
export { DAYS, SLOTS } from "../../data/academic";

const MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];

/** "2026-11-18" → "18-noy" */
export function fmtDateShort(iso: string) {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return m && d ? `${d}-${MONTHS[m - 1]}` : iso;
}
