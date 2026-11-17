/**
 * SQLite (node:sqlite) — demo/dev ma'lumotlar bazasi.
 * PostgreSQL'ga o'tishda faqat shu fayl va so'rovlar almashtiriladi (sxema: src/core/schema/001_tizims_core.sql).
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const path = process.env.DB_PATH ?? resolve(process.cwd(), "server/data/tizims.db");
if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });

export const db = new DatabaseSync(path);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  plan TEXT NOT NULL DEFAULT 'starter',
  seats INTEGER NOT NULL DEFAULT 0,
  owner_name TEXT,
  owner_email TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  country TEXT NOT NULL DEFAULT 'UZ',
  timezone TEXT NOT NULL DEFAULT 'Asia/Tashkent',
  currency TEXT NOT NULL DEFAULT 'UZS',
  primary_color TEXT NOT NULL DEFAULT '#0984E3',
  storage_gb REAL NOT NULL DEFAULT 0,
  storage_limit_gb REAL NOT NULL DEFAULT 5,
  api_calls INTEGER NOT NULL DEFAULT 0,
  paid_until TEXT,
  billing TEXT NOT NULL DEFAULT 'trial',
  created_at TEXT NOT NULL DEFAULT (date('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  is_owner INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL DEFAULT (date('now')),
  UNIQUE (user_id, org_id)
);

CREATE TABLE IF NOT EXISTS org_modules (
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (org_id, module_key)
);

-- scope: 'tenant' (org_id to'ldirilgan) yoki 'platform' (super admin harakatlari)
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  org_id TEXT,
  actor_id TEXT,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  object TEXT NOT NULL,
  object_id TEXT NOT NULL DEFAULT '',
  detail TEXT,
  old_value TEXT,
  new_value TEXT,
  ip TEXT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M', 'now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS audit_scope_org ON audit_log(scope, org_id, id DESC);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  owner_id TEXT,
  assignee_id TEXT,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS tasks_org ON tasks(org_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  for_user_id TEXT,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  PRIMARY KEY (notification_id, user_id)
);

-- Tashkilot va platforma hujjatlari (JSON). org_id = '_platform' — platforma darajasi.
CREATE TABLE IF NOT EXISTS docs (
  org_id TEXT NOT NULL,
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (org_id, collection, id)
);
`);

/* ───────── Migratsiyalar (mavjud bazalar uchun) ───────── */

function hasColumn(table: string, column: string) {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === column);
}
if (!hasColumn("users", "must_change_password")) db.exec("ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0");
if (!hasColumn("users", "last_login_at")) db.exec("ALTER TABLE users ADD COLUMN last_login_at TEXT");
// Parol o'zgarsa yoki tiklansa — oshiriladi va barcha eski sessiyalar yaroqsiz bo'ladi
if (!hasColumn("users", "session_version")) db.exec("ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0");

export const PLATFORM = "_platform";

/* ───────── JSON hujjatlar ───────── */

export function listDocs<T>(org: string, collection: string): T[] {
  const rows = db.prepare("SELECT data FROM docs WHERE org_id = ? AND collection = ? ORDER BY created_at, rowid").all(org, collection) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as T);
}

export function getDoc<T>(org: string, collection: string, id: string): T | undefined {
  const row = db.prepare("SELECT data FROM docs WHERE org_id = ? AND collection = ? AND id = ?").get(org, collection, id) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as T) : undefined;
}

export function putDoc<T>(org: string, collection: string, id: string, data: T): T {
  db.prepare(
    `INSERT INTO docs (org_id, collection, id, data) VALUES (?, ?, ?, ?)
     ON CONFLICT (org_id, collection, id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`,
  ).run(org, collection, id, JSON.stringify(data));
  return data;
}

export function deleteDoc(org: string, collection: string, id: string) {
  db.prepare("DELETE FROM docs WHERE org_id = ? AND collection = ? AND id = ?").run(org, collection, id);
}

export function countDocs(org: string, collection: string) {
  return (db.prepare("SELECT COUNT(*) c FROM docs WHERE org_id = ? AND collection = ?").get(org, collection) as { c: number }).c;
}

export function tx<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/* ───────── Audit ───────── */

export interface AuditInput {
  scope: "tenant" | "platform";
  orgId?: string | null;
  actorId?: string | null;
  actorName: string;
  action: string;
  object: string;
  objectId?: string;
  detail?: string;
  oldValue?: string;
  newValue?: string;
  ip?: string;
}

export function writeAudit(a: AuditInput) {
  db.prepare(
    `INSERT INTO audit_log (scope, org_id, actor_id, actor_name, action, object, object_id, detail, old_value, new_value, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(a.scope, a.orgId ?? null, a.actorId ?? null, a.actorName, a.action, a.object, a.objectId ?? "", a.detail ?? null, a.oldValue ?? null, a.newValue ?? null, a.ip ?? null);
}

/* ───────── Foydalanuvchi bildirishnoma sozlamalari ───────── */

export type NotifyTopic = "schedule" | "grades" | "assignments" | "news" | "messages";
export const DEFAULT_PREFS: Record<NotifyTopic, boolean> = { schedule: true, grades: true, assignments: true, news: true, messages: true };

export function prefsOf(orgId: string, userId: string): Record<NotifyTopic, boolean> {
  return { ...DEFAULT_PREFS, ...(getDoc<Partial<Record<NotifyTopic, boolean>>>(orgId, "prefs", userId) ?? {}) };
}

/** Foydalanuvchi shu mavzudagi xabarni o'chirib qo'ygan bo'lsa — yaratilmaydi */
export function wantsNotification(orgId: string, userId: string, topic: NotifyTopic) {
  return prefsOf(orgId, userId)[topic];
}
