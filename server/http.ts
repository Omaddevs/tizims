/** HTTP yordamchilar: xatolar, kirish validatsiyasi, audit qisqartmalari. */
import type { NextFunction, Request, Response } from "express";
import { writeAudit } from "./db";

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const notFound = (what = "Ma'lumot") => new HttpError(404, "RESOURCE_NOT_FOUND", `${what} topilmadi.`);
export const forbidden = (msg = "Bu amal uchun ruxsat yo'q.") => new HttpError(403, "FORBIDDEN", msg);
export const invalid = (msg: string) => new HttpError(400, "VALIDATION_ERROR", msg);

/** async handler xatolarini Express'ga uzatadi */
export const h =
  (fn: (req: Request, res: Response) => unknown | Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ success: false, error: { code: err.code, message: err.message } });
    return;
  }
  if (err && typeof err === "object" && "type" in err && (err as { type: string }).type === "entity.parse.failed") {
    res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "JSON noto'g'ri." } });
    return;
  }
  console.error(err);
  res.status(500).json({ success: false, error: { code: "INTERNAL", message: "Serverda xato yuz berdi." } });
}

/* ───────── Validatsiya ───────── */

type Body = Record<string, unknown>;

export function body(req: Request): Body {
  return req.body && typeof req.body === "object" && !Array.isArray(req.body) ? (req.body as Body) : {};
}

export function str(b: Body, key: string, opts: { min?: number; max?: number; optional?: boolean; pattern?: RegExp } = {}): string {
  const v = b[key];
  if (v === undefined || v === null || v === "") {
    if (opts.optional) return "";
    throw invalid(`"${key}" majburiy.`);
  }
  if (typeof v !== "string") throw invalid(`"${key}" matn bo'lishi kerak.`);
  const s = v.trim();
  if (opts.min !== undefined && s.length < opts.min) throw invalid(`"${key}" juda qisqa.`);
  if (s.length > (opts.max ?? 2000)) throw invalid(`"${key}" juda uzun.`);
  if (opts.pattern && !opts.pattern.test(s)) throw invalid(`"${key}" formati noto'g'ri.`);
  return s;
}

export function num(b: Body, key: string, opts: { min?: number; max?: number; optional?: boolean; int?: boolean } = {}): number {
  const v = b[key];
  if (v === undefined || v === null || v === "") {
    if (opts.optional) return NaN;
    throw invalid(`"${key}" majburiy.`);
  }
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw invalid(`"${key}" son bo'lishi kerak.`);
  if (opts.int && !Number.isInteger(n)) throw invalid(`"${key}" butun son bo'lishi kerak.`);
  if (opts.min !== undefined && n < opts.min) throw invalid(`"${key}" ${opts.min} dan kichik bo'lmasin.`);
  if (opts.max !== undefined && n > opts.max) throw invalid(`"${key}" ${opts.max} dan katta bo'lmasin.`);
  return n;
}

export function oneOf<T extends string>(b: Body, key: string, values: readonly T[], optional = false): T {
  const v = b[key];
  if ((v === undefined || v === null || v === "") && optional) return undefined as unknown as T;
  if (typeof v !== "string" || !values.includes(v as T)) throw invalid(`"${key}" qiymati noto'g'ri.`);
  return v as T;
}

export function bool(b: Body, key: string): boolean {
  return b[key] === true;
}

export function strArray(b: Body, key: string, allowed?: readonly string[]): string[] {
  const v = b[key];
  if (!Array.isArray(v) || v.some((x) => typeof x !== "string")) throw invalid(`"${key}" ro'yxat bo'lishi kerak.`);
  if (allowed && v.some((x) => !allowed.includes(x))) throw invalid(`"${key}" ichida noto'g'ri qiymat bor.`);
  return Array.from(new Set(v as string[]));
}

export const has = (b: Body, key: string) => b[key] !== undefined;

/* ───────── Vaqt va ID ───────── */

const pad = (n: number) => String(n).padStart(2, "0");
/** Mahalliy vaqt (server TZ) — "YYYY-MM-DD HH:MM". Audit jurnali ham shu formatda. */
export const localStamp = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const nowStamp = () => localStamp();
export const today = () => localStamp().slice(0, 10);
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ───────── Audit qisqartmalari ───────── */

export function auditTenant(req: Request, action: string, object: string, objectId: string, detail?: { oldValue?: string; newValue?: string; detail?: string }) {
  const a = req.auth!;
  writeAudit({ scope: "tenant", orgId: a.orgId, actorId: a.user.id, actorName: a.user.name, action, object, objectId, ip: req.ip, ...detail });
}

export function auditPlatform(req: Request, action: string, target: string, detail: string) {
  const a = req.auth!;
  writeAudit({ scope: "platform", actorId: a.user.id, actorName: a.user.name, action, object: target, objectId: target, detail, ip: req.ip });
}
