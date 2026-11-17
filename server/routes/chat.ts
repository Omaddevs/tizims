/**
 * Xabarlar (Telegram uslubida): shaxsiy va guruh suhbatlari, fayl / rasm / ovozli xabar,
 * bir nechta qabul qiluvchiga birdan yuborish, o'qilganlik belgilari.
 *
 * Ruxsatlar:
 *  - Suhbatni faqat a'zolari ko'radi (guruh suhbati — guruh talabalari, fan o'qituvchilari, nazoratchi, fakultet dekanati).
 *  - Talaba / ota-ona yangi suhbatni faqat o'z o'qituvchilari, fakultet dekanati, nazoratchi va rektor bilan boshlaydi.
 *  - Fayl faqat uni yuklagan odamga yoki u yuborilgan suhbat a'zolariga beriladi.
 */
import express, { Router, type NextFunction, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { db, getDoc, listDocs, putDoc, wantsNotification } from "../db";
import { moduleEnabled } from "../auth";
import { HttpError, auditTenant, body, forbidden, h, invalid, newId, notFound, nowStamp, str } from "../http";
import { DEAN_FACULTY, STUDENT_LINKS } from "../../src/core/access";
import { accessOf } from "../../src/core/features";
import { TEACHERS, type Group, type Student, type Subject } from "../../src/data/academic";

export const chatRouter = Router();

const org = (req: Request) => req.auth!.orgId!;
const uid = (req: Request) => req.auth!.user.id;
const role = (req: Request) => req.auth!.role!;

function requireMessages(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(new HttpError(401, "UNAUTHORIZED", "Tizimga kiring."));
  if (!req.auth.orgId || !req.auth.role) return next(new HttpError(403, "NO_TENANT", "Tashkilot tanlanmagan."));
  if (!moduleEnabled(req.auth.orgId, "education")) return next(new HttpError(403, "MODULE_DISABLED", "Ta'lim moduli yoqilmagan."));
  if (!accessOf(req.auth.role, "messages")) return next(forbidden("Bu bo'limga ruxsat yo'q."));
  next();
}
chatRouter.use("/chats", requireMessages);

/* ───────── Turlar ───────── */

export type ChatDoc = { id: string; kind: "direct" | "group"; members: string[]; group?: string; createdAt: number; lastSeq: number };
export type Attachment = { id: string; kind: "image" | "file" | "voice"; name: string; mime: string; size: number; durationSec?: number };
/** rev — oxirgi o'zgarish tartib raqami (yaratilganda = seq, o'chirilganda yangilanadi): sinxronlash shu bo'yicha */
type MessageDoc = { id: string; chatId: string; seq: number; rev?: number; authorId: string; authorName: string; text: string; attachments: Attachment[]; deleted?: boolean; deletedBy?: "author" | "moderator" };
type FileDoc = Attachment & { ownerId: string; chats: string[]; createdAt: number };
type Person = { id: string; name: string; role: string };

const ROLE_LABEL: Record<string, string> = {
  owner: "Tashkilot rahbari",
  rector: "Rektor",
  dept_head: "Dekanat",
  advisor: "Nazoratchi",
  teacher: "O'qituvchi",
  student: "Talaba",
  parent: "Ota-ona",
};
const STAFF_ROLES = ["owner", "rector", "dept_head", "advisor", "teacher"];

/* ───────── Fayllar saqlanadigan joy ───────── */

const UPLOAD_ROOT =
  process.env.UPLOAD_DIR ?? (process.env.DB_PATH === ":memory:" ? join(tmpdir(), `tizims-test-uploads-${process.pid}`) : resolve(process.cwd(), "server/data/uploads"));

function filePath(orgId: string, id: string) {
  const dir = join(UPLOAD_ROOT, orgId);
  mkdirSync(dir, { recursive: true });
  return join(dir, id);
}

/** Ruxsat etilgan kengaytmalar → MIME (brauzer yuborgan turga ishonmaymiz) */
const EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  zip: "application/zip",
  rar: "application/vnd.rar",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  webm: "audio/webm",
  wav: "audio/wav",
};
const MAX_FILE = 15 * 1024 * 1024;
const MAX_VOICE_SEC = 300;
/** Bir foydalanuvchi yuklagan fayllarning umumiy hajmi */
const USER_QUOTA = 300 * 1024 * 1024;
/** Yuborilmay qolgan fayllar shu vaqtdan keyin o'chiriladi */
const ORPHAN_TTL = 24 * 60 * 60 * 1000;

/* ───────── Spamdan himoya (xotirada, sirpanuvchi oyna) ───────── */

const hits = new Map<string, number[]>();
function rateLimit(key: string, cost: number, max: number, windowMs: number, msg: string) {
  const now = Date.now();
  const xs = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (xs.length + cost > max) {
    hits.set(key, xs);
    throw new HttpError(429, "RATE_LIMITED", msg);
  }
  for (let i = 0; i < cost; i++) xs.push(now);
  hits.set(key, xs);
}
/** Testlar uchun */
export function resetChatLimits() {
  hits.clear();
}
const limitMessages = (req: Request, cost = 1) => rateLimit(`m:${uid(req)}`, cost, 40, 60_000, "Juda tez yozyapsiz — bir daqiqadan so'ng urinib ko'ring.");
const limitUploads = (req: Request) => rateLimit(`u:${uid(req)}`, 1, 30, 10 * 60_000, "Juda ko'p fayl yuklandi — 10 daqiqadan so'ng urinib ko'ring.");

/** Rasm haqiqatan rasmmi — fayl boshidagi imzo bo'yicha (ichki ko'rsatish xavfsiz bo'lishi uchun) */
function imageSignatureOk(mime: string, b: Buffer) {
  if (mime === "image/png") return b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === "image/jpeg") return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (mime === "image/gif") return b.subarray(0, 4).toString("latin1") === "GIF8";
  if (mime === "image/webp") return b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP";
  return false;
}

function cleanName(raw: string) {
  let n = raw;
  try {
    n = decodeURIComponent(raw);
  } catch {
    /* kodlanmagan nom */
  }
  n = n.replace(/[\\/\u0000-\u001f"<>|:*?]/g, "_").trim().slice(-120);
  return n || "fayl";
}

/* ───────── Odamlar va guruhlar ───────── */

function orgPeople(orgId: string): Person[] {
  return db
    .prepare(
      `SELECT u.id, u.name, m.role FROM users u JOIN memberships m ON m.user_id = u.id
       WHERE m.org_id = ? AND m.status = 'active' AND u.is_active = 1 AND m.role != 'super_admin' ORDER BY u.name`,
    )
    .all(orgId) as Person[];
}

function links(orgId: string): Record<string, string> {
  return { ...STUDENT_LINKS, ...(getDoc<Record<string, string>>(orgId, "settings", "student_links") ?? {}) };
}

function linkedStudent(orgId: string, userId: string) {
  const sid = links(orgId)[userId];
  return sid ? getDoc<Student>(orgId, "students", sid) : undefined;
}

function deanFaculty(orgId: string, userId: string) {
  return getDoc<{ faculty: string }>(orgId, "profiles", userId)?.faculty ?? DEAN_FACULTY[userId];
}

/** Lavozim: profil yozuvidan, bo'lmasa roldan */
function positionOf(orgId: string, p: Person) {
  const prof = getDoc<{ position?: string }>(orgId, "profiles", p.id);
  if (prof?.position) return prof.position;
  if (p.role === "teacher") {
    const t = TEACHERS.find((x) => x.id === p.id);
    return t ? `O'qituvchi · ${t.department}` : "O'qituvchi";
  }
  if (p.role === "student" || p.role === "parent") {
    const st = linkedStudent(orgId, p.id);
    return st ? (p.role === "student" ? `Talaba · ${st.group}` : `Ota-ona · ${st.name}`) : ROLE_LABEL[p.role];
  }
  return ROLE_LABEL[p.role] ?? p.role;
}

/** Foydalanuvchi a'zo bo'lgan guruh suhbatlari */
function myGroups(orgId: string, userId: string, r: string): string[] {
  const groups = listDocs<Group>(orgId, "groups");
  if (r === "student") {
    const st = linkedStudent(orgId, userId);
    return st ? [st.group] : [];
  }
  if (r === "teacher") {
    const subs = listDocs<Subject>(orgId, "subjects").filter((s) => s.teacherId === userId);
    return groups.filter((g) => subs.some((s) => s.groups.includes(g.id))).map((g) => g.id);
  }
  if (r === "advisor") return groups.map((g) => g.id);
  if (r === "dept_head") {
    const f = deanFaculty(orgId, userId);
    return f ? groups.filter((g) => g.faculty === f).map((g) => g.id) : [];
  }
  return [];
}

function groupMembers(orgId: string, groupId: string): Person[] {
  return orgPeople(orgId).filter((p) => myGroups(orgId, p.id, p.role).includes(groupId));
}

/** Kim bilan yangi suhbat boshlash mumkin */
function contactsOf(req: Request): Person[] {
  const o = org(req);
  const people = orgPeople(o).filter((p) => p.id !== uid(req));
  if (STAFF_ROLES.includes(role(req))) return people;
  // Talaba / ota-ona: o'z o'qituvchilari, fakultet dekanati, nazoratchi, rektor
  const st = linkedStudent(o, uid(req));
  if (!st) return [];
  const group = getDoc<Group>(o, "groups", st.group);
  const teacherIds = new Set(listDocs<Subject>(o, "subjects").filter((s) => s.groups.includes(st.group)).map((s) => s.teacherId));
  return people.filter(
    (p) =>
      (p.role === "teacher" && teacherIds.has(p.id)) ||
      (p.role === "dept_head" && (!group || deanFaculty(o, p.id) === group.faculty)) ||
      p.role === "advisor" ||
      p.role === "rector",
  );
}

/* ───────── Suhbatlar ───────── */

const dmId = (a: string, b: string) => `dm:${[a, b].sort().join(":")}`;

function canSee(req: Request, c: ChatDoc) {
  if (c.kind === "direct") return c.members.includes(uid(req));
  return !!c.group && myGroups(org(req), uid(req), role(req)).includes(c.group);
}

function loadChat(req: Request, id: string) {
  const c = getDoc<ChatDoc>(org(req), "chats", id);
  if (!c || !canSee(req, c)) throw notFound("Suhbat");
  return c;
}

/** Guruh suhbatlari birinchi kirishda yaratiladi */
function ensureGroupChats(req: Request) {
  for (const g of myGroups(org(req), uid(req), role(req))) {
    const id = `grp:${g}`;
    if (!getDoc<ChatDoc>(org(req), "chats", id)) putDoc<ChatDoc>(org(req), "chats", id, { id, kind: "group", members: [], group: g, createdAt: Date.now(), lastSeq: 0 });
  }
}

function getOrCreateDm(req: Request, peerId: string) {
  const id = dmId(uid(req), peerId);
  const existing = getDoc<ChatDoc>(org(req), "chats", id);
  if (existing) return existing;
  if (!contactsOf(req).some((p) => p.id === peerId)) throw forbidden("Bu foydalanuvchiga yozish mumkin emas.");
  return putDoc<ChatDoc>(org(req), "chats", id, { id, kind: "direct", members: [uid(req), peerId], createdAt: Date.now(), lastSeq: 0 });
}

const readKey = (chatId: string, userId: string) => `${chatId}|${userId}`;
const readSeq = (orgId: string, chatId: string, userId: string) => getDoc<{ seq: number }>(orgId, "chat_reads", readKey(chatId, userId))?.seq ?? 0;

const REV = "COALESCE(json_extract(data, '$.rev'), json_extract(data, '$.seq'))";

/** Oxirgi `limit` ta xabar; `before` berilsa — undan eskilari */
function messagesOf(orgId: string, chatId: string, limit = 50, before = Number.MAX_SAFE_INTEGER): MessageDoc[] {
  const rows = db
    .prepare(
      `SELECT data FROM docs WHERE org_id = ? AND collection = 'chat_messages' AND json_extract(data, '$.chatId') = ? AND json_extract(data, '$.seq') < ?
       ORDER BY json_extract(data, '$.seq') DESC LIMIT ?`,
    )
    .all(orgId, chatId, before, limit) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as MessageDoc).reverse();
}

/** `rev` dan keyin yangi kelgan yoki o'zgargan (o'chirilgan) xabarlar */
function changesOf(orgId: string, chatId: string, sinceRev: number): MessageDoc[] {
  const rows = db
    .prepare(`SELECT data FROM docs WHERE org_id = ? AND collection = 'chat_messages' AND json_extract(data, '$.chatId') = ? AND ${REV} > ? ORDER BY ${REV} LIMIT 500`)
    .all(orgId, chatId, sinceRev) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as MessageDoc);
}

function maxRev(orgId: string, chatId: string) {
  return (db.prepare(`SELECT MAX(${REV}) r FROM docs WHERE org_id = ? AND collection = 'chat_messages' AND json_extract(data, '$.chatId') = ?`).get(orgId, chatId) as { r: number | null }).r ?? 0;
}

function unreadIn(orgId: string, chatId: string, userId: string) {
  return (
    db
      .prepare(
        `SELECT COUNT(*) c FROM docs WHERE org_id = ? AND collection = 'chat_messages' AND json_extract(data, '$.chatId') = ?
         AND json_extract(data, '$.seq') > ? AND json_extract(data, '$.authorId') != ? AND json_extract(data, '$.deleted') IS NOT 1`,
      )
      .get(orgId, chatId, readSeq(orgId, chatId, userId), userId) as { c: number }
  ).c;
}

/** Menyu belgisi uchun: barcha suhbatlardagi o'qilmagan xabarlar */
export function unreadMessages(orgId: string, userId: string, r: string) {
  if (!moduleEnabled(orgId, "education") || !accessOf(r, "messages")) return 0;
  const groups = new Set(myGroups(orgId, userId, r));
  return listDocs<ChatDoc>(orgId, "chats")
    .filter((c) => (c.kind === "direct" ? c.members.includes(userId) : !!c.group && groups.has(c.group)))
    .reduce((s, c) => s + unreadIn(orgId, c.id, userId), 0);
}

function preview(m: MessageDoc) {
  if (m.deleted) return "Xabar o'chirildi";
  if (m.text) return m.text.slice(0, 120);
  const a = m.attachments[0];
  return a ? (a.kind === "voice" ? "🎤 Ovozli xabar" : a.kind === "image" ? "🖼 Rasm" : `📎 ${a.name}`) : "";
}

function view(req: Request, m: MessageDoc) {
  return {
    id: m.id,
    seq: m.seq,
    authorId: m.authorId,
    authorName: m.authorName,
    mine: m.authorId === uid(req),
    text: m.deleted ? "" : m.text,
    attachments: m.deleted ? [] : m.attachments,
    deleted: !!m.deleted,
    deletedBy: m.deleted ? (m.deletedBy ?? "author") : undefined,
  };
}

let lastSeq = 0;
const nextSeq = () => (lastSeq = Math.max(Date.now(), lastSeq + 1));

/** Yuklangan fayllarni xabarga biriktirish: faqat o'zi yuklagani */
function takeAttachments(req: Request, ids: string[], chatIds: string[]): Attachment[] {
  return ids.map((id) => {
    const f = getDoc<FileDoc>(org(req), "chat_files", id);
    if (!f || f.ownerId !== uid(req)) throw invalid("Biriktirilgan fayl topilmadi.");
    putDoc<FileDoc>(org(req), "chat_files", id, { ...f, chats: [...new Set([...f.chats, ...chatIds])] });
    return { id: f.id, kind: f.kind, name: f.name, mime: f.mime, size: f.size, ...(f.durationSec ? { durationSec: f.durationSec } : {}) };
  });
}

function readPayload(req: Request) {
  const b = body(req);
  const text = typeof b.text === "string" ? b.text.trim() : "";
  if (text.length > 4000) throw invalid("Xabar 4000 belgidan oshmasin.");
  const ids = Array.isArray(b.attachments) ? (b.attachments as unknown[]).filter((x): x is string => typeof x === "string") : [];
  if (ids.length > 10) throw invalid("Bir xabarga ko'pi bilan 10 ta fayl.");
  if (!text && ids.length === 0) throw invalid("Xabar bo'sh.");
  return { text, ids: [...new Set(ids)] };
}

function postMessage(req: Request, c: ChatDoc, text: string, attachments: Attachment[]) {
  const seq = nextSeq();
  const m: MessageDoc = { id: randomUUID(), chatId: c.id, seq, rev: seq, authorId: uid(req), authorName: req.auth!.user.name, text, attachments };
  putDoc(org(req), "chat_messages", m.id, m);
  putDoc<ChatDoc>(org(req), "chats", c.id, { ...c, lastSeq: m.seq });
  // Yozgan odam o'z xabarini o'qigan hisoblanadi
  putDoc(org(req), "chat_reads", readKey(c.id, uid(req)), { seq: m.seq });
  notifyMembers(req, c, m);
  return m;
}

const chatLink = (chatId: string) => `/messages?chat=${encodeURIComponent(chatId)}`;

/**
 * Qo'ng'iroqcha (bildirishnoma): har bir suhbat bo'yicha bitta — oldingisi o'qilmagan bo'lsa yangisi yaratilmaydi,
 * shuning uchun faol suhbat bildirishnomalar bilan to'lib ketmaydi. Sozlamalarda o'chirib qo'yish mumkin.
 */
function notifyMembers(req: Request, c: ChatDoc, m: MessageDoc) {
  const o = org(req);
  const recipients = c.kind === "direct" ? c.members.filter((x) => x !== m.authorId) : groupMembers(o, c.group!).map((p) => p.id).filter((x) => x !== m.authorId);
  const link = chatLink(c.id);
  const pending = db.prepare(
    `SELECT 1 FROM notifications n WHERE n.org_id = ? AND n.for_user_id = ? AND json_extract(n.data, '$.link') = ?
     AND NOT EXISTS (SELECT 1 FROM notification_reads r WHERE r.notification_id = n.id AND r.user_id = ?)`,
  );
  const ins = db.prepare("INSERT INTO notifications (id, org_id, for_user_id, data) VALUES (?, ?, ?, ?)");
  const what = m.text ? m.text.slice(0, 80) : preview(m);
  for (const r of recipients) {
    if (!wantsNotification(o, r, "messages") || pending.get(o, r, link, r)) continue;
    const id = newId("n");
    const title = c.kind === "direct" ? `${m.authorName} sizga yozdi` : `${c.group} guruhida yangi xabar`;
    const body = c.kind === "direct" ? what : `${m.authorName}: ${what}`;
    ins.run(id, o, r, JSON.stringify({ id, title, body, time: nowStamp(), read: false, channel: "inapp", forUserId: r, link }));
  }
}

/** Suhbat ochilganda unga tegishli bildirishnomalar ham o'qilgan bo'ladi */
function markChatNotificationsRead(orgId: string, userId: string, chatId: string) {
  db.prepare(
    `INSERT OR IGNORE INTO notification_reads (notification_id, user_id)
     SELECT n.id, ? FROM notifications n WHERE n.org_id = ? AND n.for_user_id = ? AND json_extract(n.data, '$.link') = ?`,
  ).run(userId, orgId, userId, chatLink(chatId));
}

/** Guruh suhbatida xodim (o'qituvchi, nazoratchi, dekanat) boshqalarning xabarini o'chira oladi */
function canModerate(req: Request, c: ChatDoc) {
  return c.kind === "group" && ["teacher", "advisor", "dept_head"].includes(role(req)) && canSee(req, c);
}

/** Faylni bazadan va diskdan o'chirish */
function dropFile(orgId: string, id: string) {
  db.prepare("DELETE FROM docs WHERE org_id = ? AND collection = 'chat_files' AND id = ?").run(orgId, id);
  const p = filePath(orgId, id);
  if (existsSync(p)) unlinkSync(p);
}

/** Yuklangan, lekin hech qayerga yuborilmagan eski fayllarni tozalash */
export function cleanupOrphanFiles(now = Date.now()) {
  const rows = db.prepare("SELECT org_id, data FROM docs WHERE collection = 'chat_files'").all() as { org_id: string; data: string }[];
  let n = 0;
  for (const r of rows) {
    const f = JSON.parse(r.data) as FileDoc;
    if (f.chats.length === 0 && now - f.createdAt > ORPHAN_TTL) {
      dropFile(r.org_id, f.id);
      n++;
    }
  }
  return n;
}

/* ───────── Yo'llar ───────── */

/** Suhbatlar ro'yxati: oxirgi xabar, o'qilmaganlar soni */
chatRouter.get(
  "/chats",
  h((req, res) => {
    ensureGroupChats(req);
    const o = org(req);
    const people = new Map(orgPeople(o).map((p) => [p.id, p]));
    const groups = new Map(listDocs<Group>(o, "groups").map((g) => [g.id, g]));
    const out = listDocs<ChatDoc>(o, "chats")
      .filter((c) => canSee(req, c))
      .map((c) => {
        const last = messagesOf(o, c.id, 1)[0];
        const peer = c.kind === "direct" ? people.get(c.members.find((m) => m !== uid(req)) ?? "") : undefined;
        const g = c.group ? groups.get(c.group) : undefined;
        return {
          id: c.id,
          kind: c.kind,
          title: c.kind === "direct" ? (peer?.name ?? "O'chirilgan foydalanuvchi") : `${c.group} guruhi`,
          subtitle: c.kind === "direct" ? (peer ? positionOf(o, peer) : "") : g ? `${g.direction} · ${g.course}-kurs` : "Guruh suhbati",
          peerId: peer?.id ?? null,
          last: last ? { text: preview(last), authorName: last.authorName, mine: last.authorId === uid(req), seq: last.seq } : null,
          unread: unreadIn(o, c.id, uid(req)),
          lastSeq: c.lastSeq || c.createdAt,
        };
      })
      // Bo'sh shaxsiy suhbatlar ro'yxatda ko'rinmaydi (faqat guruhlar)
      .filter((c) => c.kind === "group" || c.last)
      .sort((a, b) => b.lastSeq - a.lastSeq);
    res.json(out);
  }),
);

/** Yangi suhbat uchun kontaktlar */
chatRouter.get(
  "/chats/contacts",
  h((req, res) => {
    const o = org(req);
    res.json(contactsOf(req).map((p) => ({ id: p.id, name: p.name, role: p.role, position: positionOf(o, p) })));
  }),
);

/** Shaxsiy suhbatni ochish (yo'q bo'lsa yaratiladi) */
chatRouter.post(
  "/chats/direct",
  h((req, res) => {
    const peer = str(body(req), "userId", { min: 1, max: 80 });
    if (peer === uid(req)) throw invalid("O'zingizga yozib bo'lmaydi.");
    res.json({ id: getOrCreateDm(req, peer).id });
  }),
);

/** Bir nechta qabul qiluvchiga birdan (masalan: kasallik ma'lumotnomasini dekan o'rinbosari va o'qituvchilarga) */
chatRouter.post(
  "/chats/send",
  h((req, res) => {
    const b = body(req);
    const to = Array.isArray(b.to) ? [...new Set((b.to as unknown[]).filter((x): x is string => typeof x === "string"))] : [];
    if (to.length === 0) throw invalid("Kamida bitta qabul qiluvchini tanlang.");
    if (to.length > 30) throw invalid("Bir yo'la ko'pi bilan 30 kishiga.");
    if (to.includes(uid(req))) throw invalid("O'zingizga yozib bo'lmaydi.");
    const { text, ids } = readPayload(req);
    limitMessages(req, to.length);
    const chats = to.map((p) => getOrCreateDm(req, p));
    const attachments = takeAttachments(req, ids, chats.map((c) => c.id));
    for (const c of chats) postMessage(req, c, text, attachments);
    res.status(201).json({ chats: chats.map((c) => c.id) });
  }),
);

/**
 * Suhbat xabarlari:
 *  - parametrsiz — oxirgi 50 ta;
 *  - ?rev=N — N dan keyin kelgan yoki o'zgargan (o'chirilgan) xabarlar (har bir necha soniyada so'raladi);
 *  - ?before=SEQ — eskiroq 50 ta (yuqoriga aylantirganda).
 * Ochilganda o'qilgan deb belgilanadi.
 */
chatRouter.get(
  "/chats/:id/messages",
  h((req, res) => {
    const c = loadChat(req, String(req.params.id));
    const o = org(req);
    const since = Number(req.query.rev);
    const before = Number(req.query.before);
    const PAGE = 50;
    let msgs: MessageDoc[];
    let hasMore: boolean | undefined;
    if (Number.isFinite(since) && since > 0) msgs = changesOf(o, c.id, since);
    else {
      const page = messagesOf(o, c.id, PAGE + 1, Number.isFinite(before) && before > 0 ? before : undefined);
      hasMore = page.length > PAGE;
      msgs = hasMore ? page.slice(1) : page;
    }
    const top = Math.max(0, ...msgs.map((m) => m.seq));
    if (top > readSeq(o, c.id, uid(req))) putDoc(o, "chat_reads", readKey(c.id, uid(req)), { seq: top });
    markChatNotificationsRead(o, uid(req), c.id);
    const peer = c.kind === "direct" ? c.members.find((m) => m !== uid(req)) : undefined;
    const first = !Number.isFinite(since) && !Number.isFinite(before);
    const members =
      first && c.kind === "group" && c.group ? groupMembers(o, c.group).map((p) => ({ id: p.id, name: p.name, position: positionOf(o, p) })) : undefined;
    res.json({
      messages: msgs.map((m) => view(req, m)),
      rev: maxRev(o, c.id),
      hasMore,
      // Shaxsiy suhbatda suhbatdosh qayergacha o'qigani — ✓✓ belgisi uchun
      peerReadSeq: peer ? readSeq(o, c.id, peer) : null,
      canModerate: canModerate(req, c),
      members,
    });
  }),
);

chatRouter.post(
  "/chats/:id/messages",
  h((req, res) => {
    const c = loadChat(req, String(req.params.id));
    const { text, ids } = readPayload(req);
    limitMessages(req);
    const m = postMessage(req, c, text, takeAttachments(req, ids, [c.id]));
    res.status(201).json(view(req, m));
  }),
);

/** O'chirish: muallif — o'z xabarini; guruhda xodim — istalgan xabarni (audit jurnaliga yoziladi). Fayl boshqa suhbatda ishlatilmasa — o'chiriladi. */
chatRouter.delete(
  "/chats/:id/messages/:mid",
  h((req, res) => {
    const c = loadChat(req, String(req.params.id));
    const m = getDoc<MessageDoc>(org(req), "chat_messages", String(req.params.mid));
    if (!m || m.chatId !== c.id) throw notFound("Xabar");
    if (m.deleted) return res.json({ success: true });
    const own = m.authorId === uid(req);
    if (!own && !canModerate(req, c)) throw forbidden("Faqat o'z xabaringizni o'chira olasiz.");
    for (const a of m.attachments) {
      const f = getDoc<FileDoc>(org(req), "chat_files", a.id);
      if (!f) continue;
      const rest = f.chats.filter((x) => x !== c.id);
      if (rest.length) putDoc<FileDoc>(org(req), "chat_files", f.id, { ...f, chats: rest });
      else dropFile(org(req), f.id);
    }
    putDoc<MessageDoc>(org(req), "chat_messages", m.id, { ...m, text: "", attachments: [], deleted: true, deletedBy: own ? "author" : "moderator", rev: nextSeq() });
    if (!own) auditTenant(req, "DELETE", "ChatMessage", m.id, { detail: `${c.group} guruhi suhbatida ${m.authorName} xabari o'chirildi`, oldValue: m.text.slice(0, 200) || preview(m) });
    res.json({ success: true });
  }),
);

/** Fayl yuklash: tanasi — faylning o'zi; nom X-File-Name sarlavhasida, ovoz uchun X-Kind: voice va X-Duration */
chatRouter.post(
  "/chats/upload",
  express.raw({ type: () => true, limit: MAX_FILE }),
  h((req, res) => {
    const buf = req.body as Buffer;
    if (!Buffer.isBuffer(buf) || buf.length === 0) throw invalid("Fayl bo'sh.");
    limitUploads(req);
    const used = (db
      .prepare("SELECT COALESCE(SUM(json_extract(data, '$.size')), 0) s FROM docs WHERE org_id = ? AND collection = 'chat_files' AND json_extract(data, '$.ownerId') = ?")
      .get(org(req), uid(req)) as { s: number }).s;
    if (used + buf.length > USER_QUOTA) throw invalid("Fayllar uchun joyingiz tugadi (300 MB). Eski xabarlardagi keraksiz fayllarni o'chiring.");
    const voice = req.headers["x-kind"] === "voice";
    const rawName = String(req.headers["x-file-name"] ?? (voice ? "ovozli-xabar.webm" : "fayl"));
    const name = cleanName(rawName);
    const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
    const mime = EXT_MIME[ext];
    if (!mime) throw invalid("Bu turdagi fayl qabul qilinmaydi. Ruxsat: PDF, Word, Excel, PowerPoint, rasm, audio, TXT, ZIP.");
    let kind: Attachment["kind"] = "file";
    let durationSec: number | undefined;
    if (voice) {
      if (!mime.startsWith("audio/")) throw invalid("Ovozli xabar audio bo'lishi kerak.");
      durationSec = Math.round(Number(req.headers["x-duration"]) || 0);
      if (durationSec < 1) throw invalid("Ovozli xabar juda qisqa.");
      if (durationSec > MAX_VOICE_SEC) throw invalid("Ovozli xabar 5 daqiqadan oshmasin.");
      kind = "voice";
    } else if (mime.startsWith("image/")) {
      if (!imageSignatureOk(mime, buf)) throw invalid("Rasm fayli buzilgan yoki turi noto'g'ri.");
      kind = "image";
    }
    const id = randomUUID();
    writeFileSync(filePath(org(req), id), buf);
    const f: FileDoc = { id, kind, name, mime, size: buf.length, ownerId: uid(req), chats: [], createdAt: Date.now(), ...(durationSec ? { durationSec } : {}) };
    putDoc(org(req), "chat_files", id, f);
    const { ownerId: _o, chats: _c, createdAt: _t, ...out } = f;
    res.status(201).json(out);
  }),
);

/** Faylni olish: yuklagan odam yoki fayl yuborilgan suhbat a'zosi */
chatRouter.get(
  "/chats/files/:fid",
  h((req, res) => {
    const f = getDoc<FileDoc>(org(req), "chat_files", String(req.params.fid));
    const ok = f && (f.ownerId === uid(req) || f.chats.some((cid) => {
      const c = getDoc<ChatDoc>(org(req), "chats", cid);
      return !!c && canSee(req, c);
    }));
    if (!f || !ok) throw notFound("Fayl");
    const p = filePath(org(req), f.id);
    if (!existsSync(p)) throw notFound("Fayl");
    const inline = (f.kind === "image" || f.mime.startsWith("audio/")) && req.query.download !== "1";
    res.setHeader("Content-Type", f.mime);
    res.setHeader("Content-Length", String(f.size));
    res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`);
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
    res.setHeader("Cache-Control", "private, max-age=86400");
    createReadStream(p).pipe(res);
  }),
);
