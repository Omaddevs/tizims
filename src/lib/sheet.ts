/**
 * Excel (.xlsx) va CSV fayllarni tashqi kutubxonasiz o'qish.
 * .xlsx — ZIP arxiv ichidagi XML: arxiv `DecompressionStream("deflate-raw")` bilan ochiladi,
 * birinchi varaq va umumiy satrlar (sharedStrings) o'qiladi. Natija — satrlar jadvali (string[][]).
 */

/* ───────── CSV ───────── */

/** CSV: Excel'ning UZ/RU sozlamalaridagi ";" va standart "," ajratuvchilari, qo'shtirnoqli maydonlar, BOM */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

/* ───────── XLSX ───────── */

type ZipEntry = { name: string; method: number; compressedSize: number; offset: number };

function readZipEntries(buf: Uint8Array): ZipEntry[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // End of central directory — oxirgi 64 KB ichida
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Fayl Excel (.xlsx) formatida emas yoki shikastlangan.");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("Excel fayl tuzilishi buzilgan.");
    const method = dv.getUint16(p + 10, true);
    const compressedSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    out.push({ name: dec.decode(buf.subarray(p + 46, p + 46 + nameLen)), method, compressedSize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function readZipFile(buf: Uint8Array, e: ZipEntry): Promise<string> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const start = e.offset + 30 + dv.getUint16(e.offset + 26, true) + dv.getUint16(e.offset + 28, true);
  const data = buf.subarray(start, start + e.compressedSize);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new Error("Excel faylning siqish usuli qo'llab-quvvatlanmaydi.");
  const stream = new Blob([data.slice()]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

const unescapeXml = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&");

/** <si> ichidagi barcha <t> matnlari (formatlangan matnlar ham) */
function textOf(xml: string) {
  return Array.from(xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g), (m) => unescapeXml(m[1])).join("");
}

function colIndex(ref: string) {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export async function parseXlsx(bytes: ArrayBuffer | Uint8Array): Promise<string[][]> {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const entries = readZipEntries(buf);
  const sheets = entries.filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name)).sort((a, b) => Number(a.name.match(/\d+/)![0]) - Number(b.name.match(/\d+/)![0]));
  if (!sheets.length) throw new Error("Excel faylda varaq topilmadi.");
  const ssEntry = entries.find((e) => e.name === "xl/sharedStrings.xml");
  const shared = ssEntry ? Array.from((await readZipFile(buf, ssEntry)).matchAll(/<si>([\s\S]*?)<\/si>/g), (m) => textOf(m[1])) : [];
  const xml = await readZipFile(buf, sheets[0]);

  const rows: string[][] = [];
  for (const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const inner = cm[2] ?? "";
      const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = "";
      if (type === "s" && v !== undefined) value = shared[Number(v)] ?? "";
      else if (type === "inlineStr") value = textOf(inner);
      else if (type === "b") value = v === "1" ? "TRUE" : "FALSE";
      else if (v !== undefined) value = unescapeXml(v);
      const idx = ref ? colIndex(ref) : row.length;
      while (row.length < idx) row.push("");
      row[idx] = value.trim();
    }
    if (row.some((c) => c !== "")) rows.push(row);
  }
  return rows;
}

/** Faylni turiga qarab o'qiydi */
export async function readSpreadsheet(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) return parseCsv(await file.text());
  if (name.endsWith(".xlsx")) return parseXlsx(await file.arrayBuffer());
  if (name.endsWith(".xls")) throw new Error("Eski .xls formati qo'llab-quvvatlanmaydi — Excel'da \"Saqlash: Excel ish kitobi (.xlsx)\" yoki CSV qilib saqlang.");
  throw new Error("Faqat .xlsx yoki .csv fayl yuklang.");
}

/* ───────── Ustunlarni aniqlash ───────── */

export type ImportField = "name" | "group" | "funding" | "phone" | "parent";

const ALIASES: Record<ImportField, string[]> = {
  name: ["fish", "fio", "ism", "ismfamiliya", "familiyaism", "talaba", "talabafish", "fullname", "name", "student"],
  group: ["guruh", "group", "gruppa", "guruhi"],
  funding: ["talimshakli", "shakl", "shakli", "tolovturi", "tolovshakli", "funding", "grantkontrakt", "asos", "moliyalashtirish"],
  phone: ["telefon", "phone", "tel", "mobil", "telefonraqami", "raqam"],
  parent: ["otaona", "parent", "vasiy", "otaonasi", "otaonafish"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9а-яё]/g, "");

/** Sarlavha qatorini aniqlab, maydon → ustun indeksini qaytaradi. Sarlavha topilmasa — standart tartib. */
export function detectColumns(rows: string[][]): { header: boolean; map: Partial<Record<ImportField, number>> } {
  const head = (rows[0] ?? []).map(norm);
  const map: Partial<Record<ImportField, number>> = {};
  head.forEach((h, i) => {
    for (const f of Object.keys(ALIASES) as ImportField[]) {
      if (map[f] === undefined && ALIASES[f].some((a) => h === a || (a.length > 3 && h.startsWith(a)))) {
        map[f] = i;
        break;
      }
    }
  });
  if (map.name !== undefined && map.group !== undefined) return { header: true, map };
  return { header: false, map: { name: 0, group: 1, funding: 2, phone: 3, parent: 4 } };
}

export const IMPORT_TEMPLATE = [
  ["F.I.Sh.", "Guruh", "Ta'lim shakli", "Telefon", "Ota-ona"],
  ["Aliyev Vali", "IT-21", "Grant", "+998 90 123 45 67", "Aliyev Botir"],
  ["Karimova Laylo", "IT-22", "Kontrakt", "901234568", "Karimov Anvar"],
];
