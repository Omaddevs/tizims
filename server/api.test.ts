/**
 * API integratsiya testlari — xotiradagi bazada, haqiqiy HTTP so'rovlar bilan.
 * Asosiy maqsad: rol doirasi, tashkilotlar izolyatsiyasi va super admin chegaralari serverda ishlashini tekshirish.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

process.env.DB_PATH = ":memory:";

let server: Server;
let base = "";
let resetLimits: () => void;

const IAU = "550e8400-e29b-41d4-a716-446655440001";
const SHOP = "650e8400-e29b-41d4-a716-446655440002";

beforeAll(async () => {
  const { seedIfEmpty } = await import("./seed");
  const { createApp } = await import("./app");
  const auth = await import("./auth");
  const chat = await import("./routes/chat");
  resetLimits = () => {
    auth.resetLoginLimits();
    chat.resetChatLimits();
  };
  seedIfEmpty();
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterAll(() => {
  server?.close();
});

beforeEach(() => resetLimits());

/** Cookie'ni saqlaydigan oddiy mijoz */
function client() {
  let cookie = "";
  async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(method !== "GET" ? { "content-type": "application/json", "x-requested-with": "tizims" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : method !== "GET" ? "{}" : undefined,
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null };
  }
  return {
    get: (p: string) => call("GET", p),
    post: (p: string, b?: unknown, h?: Record<string, string>) => call("POST", p, b, h),
    put: (p: string, b?: unknown) => call("PUT", p, b),
    patch: (p: string, b?: unknown) => call("PATCH", p, b),
    del: (p: string) => call("DELETE", p),
    /** Xom fayl yuklash (chat) */
    async upload(p: string, data: Uint8Array, headers: Record<string, string>) {
      const res = await fetch(base + p, { method: "POST", headers: { cookie, "x-requested-with": "tizims", "content-type": "application/octet-stream", ...headers }, body: data });
      const text = await res.text();
      return { status: res.status, data: text ? JSON.parse(text) : null };
    },
    /** Faylni olish (JSON emas) */
    async fetchRaw(p: string) {
      const res = await fetch(base + p, { headers: { cookie } });
      return { status: res.status, headers: res.headers, bytes: new Uint8Array(await res.arrayBuffer()) };
    },
    async login(email: string, password: string) {
      const r = await call("POST", "/auth/login", { email, password });
      expect(r.status, `${email}: ${JSON.stringify(r.data)}`).toBe(200);
      return r.data;
    },
  };
}

const as = async (email: string, password: string) => {
  const c = client();
  await c.login(email, password);
  return c;
};

describe("autentifikatsiya", () => {
  it("noto'g'ri parol — 401, 5 urinishdan keyin bloklanadi", async () => {
    const c = client();
    for (let i = 0; i < 5; i++) expect((await c.post("/auth/login", { email: "rector@iau.uz", password: "x" })).status).toBe(401);
    const r = await c.post("/auth/login", { email: "rector@iau.uz", password: "rector123" });
    expect(r.status).toBe(429);
  });

  it("sessiyasiz so'rov — 401", async () => {
    expect((await client().get("/org/tasks")).status).toBe(401);
  });

  it("CSRF sarlavhasisiz o'zgartiruvchi so'rov rad etiladi", async () => {
    const c = await as("rector@iau.uz", "rector123");
    const res = await fetch(base + "/org/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    expect(res.status).toBe(403);
    expect((await c.get("/org/tasks")).status).toBe(200);
  });

  it("parollar bazada scrypt bilan saqlanadi", async () => {
    const { db } = await import("./db");
    const row = db.prepare("SELECT password_hash FROM users WHERE email = 'rector@iau.uz'").get() as { password_hash: string };
    expect(row.password_hash.startsWith("scrypt$")).toBe(true);
    expect(row.password_hash).not.toContain("rector123");
  });
});

describe("tashkilotlar izolyatsiyasi", () => {
  it("do'kon menejeri universitet vazifasini ko'ra va o'zgartira olmaydi", async () => {
    const shop = await as("shop@abc.uz", "shop123");
    const tasks = (await shop.get("/org/tasks")).data as { id: string }[];
    expect(tasks.some((t) => t.id === "t1")).toBe(false);
    expect((await shop.patch("/org/tasks/t1", { title: "buzish" })).status).toBe(404);
  });

  it("do'kon menejeri ta'lim API'siga kira olmaydi", async () => {
    const shop = await as("shop@abc.uz", "shop123");
    expect((await shop.get("/edu/students")).status).toBe(403);
  });

  it("tashkilot ID so'rov tanasidan olinmaydi", async () => {
    const shop = await as("shop@abc.uz", "shop123");
    const r = await shop.post("/org/tasks", { title: "Test vazifa", due: "2026-12-01", priority: "low", category: "Umumiy", organizationId: IAU });
    expect(r.status).toBe(201);
    expect(r.data.organizationId).toBe(SHOP);
  });
});

describe("ta'lim rollari doirasi", () => {
  it("o'qituvchi faqat o'z fanini baholaydi va ball chegarasi tekshiriladi", async () => {
    const t = await as("teacher@tizims.ai", "teacher123");
    expect((await t.get("/edu/grades?subject=CS-301&group=IT-21")).status).toBe(200);
    expect((await t.get("/edu/grades?subject=MA-204&group=IT-21")).status).toBe(403);
    expect((await t.put("/edu/grades", { subject: "CS-301", group: "IT-21", rows: [{ studentId: "TLB-4819", jn: 31, on: 10, yn: null }] })).status).toBe(400);
    expect((await t.put("/edu/grades", { subject: "CS-301", group: "IT-21", rows: [{ studentId: "TLB-4823", jn: 10, on: 10, yn: null }] })).status).toBe(400);
    const ok = await t.put("/edu/grades", { subject: "CS-301", group: "IT-21", rows: [{ studentId: "TLB-4819", jn: 30, on: 20, yn: 45 }] });
    expect(ok.status).toBe(200);
  });

  it("talaba o'z bahosini ko'radi, boshqa talabalarnikini emas", async () => {
    const s = await as("student@tizims.ai", "student123");
    expect((await s.get("/edu/grades?subject=CS-301&group=IT-21")).status).toBe(403);
    const my = await s.get("/edu/grades/my");
    expect(my.status).toBe(200);
    expect(my.data.student.id).toBe("TLB-4819");
  });

  it("talaba faqat o'z murojaatlarini ko'radi va holatini o'zgartira olmaydi", async () => {
    const s = await as("student@tizims.ai", "student123");
    const list = (await s.get("/edu/complaints")).data as { id: string; mine: boolean }[];
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((c) => c.mine)).toBe(true);
    expect((await s.patch("/edu/complaints/CMP-118", { status: "resolved" })).status).toBe(403);
  });

  it("anonim murojaat muallifi rahbariyatga ko'rsatilmaydi", async () => {
    const s = await as("student@tizims.ai", "student123");
    const created = await s.post("/edu/complaints", { title: "Anonim test", body: "Batafsil tavsif matni", category: "Boshqa", anonymous: true });
    expect(created.status).toBe(201);
    const r = await as("rector@iau.uz", "rector123");
    const seen = ((await r.get("/edu/complaints")).data as { id: string; author: string; authorId?: string }[]).find((c) => c.id === created.data.id)!;
    expect(seen.author).toBe("Anonim");
    expect(seen.authorId).toBeUndefined();
  });

  it("dekan faqat o'z fakulteti talabalarini ko'radi", async () => {
    const d = await as("dean@iau.uz", "dean123");
    const list = (await d.get("/edu/students")).data as { group: string }[];
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((s) => s.group.startsWith("IT-"))).toBe(true);
  });

  it("talaba o'z guruhi suhbatiga yozadi, boshqa guruhnikiga emas", async () => {
    const s = await as("student@tizims.ai", "student123");
    const chats = (await s.get("/edu/chats")).data as { id: string }[];
    expect(chats.map((c) => c.id)).toContain("grp:IT-21");
    expect((await s.post("/edu/chats/grp:IT-21/messages", { text: "salom" })).status).toBe(201);
    expect((await s.post("/edu/chats/grp:IT-22/messages", { text: "salom" })).status).toBe(404);
  });

  it("AI tahlil: o'qituvchi faqat o'z guruhlarini ko'radi, shaxsiy ma'lumot chiqmaydi", async () => {
    const t = await as("teacher@tizims.ai", "teacher123");
    const list = (await t.get("/edu/insights/risk")).data as Record<string, unknown>[];
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((s) => ["IT-21", "IT-22", "IT-23"].includes(s.group as string))).toBe(true);
    expect(list.some((s) => "phone" in s || "parent" in s)).toBe(false);
    const st = await as("student@tizims.ai", "student123");
    expect((await st.get("/edu/insights/risk")).status).toBe(403);
  });

  it("o'qituvchi faqat o'z darsiga davomat belgilaydi", async () => {
    const t = await as("teacher@tizims.ai", "teacher123");
    const today = new Date().toISOString().slice(0, 10);
    expect((await t.put("/edu/attendance/sheet", { lessonId: "l2", date: today, marks: {} })).status).toBe(404);
    const r = await t.put("/edu/attendance/sheet", { lessonId: "l1", date: today, marks: { "TLB-4819": "late" } });
    expect(r.status).toBe(200);
    expect(r.data.marks["TLB-4819"]).toBe("late");
  });
});

describe("super admin chegaralari", () => {
  it("super admin tashkilot ichki ma'lumotlarini ko'rmaydi", async () => {
    const sa = await as("superadmin@tizims.ai", "super123");
    expect((await sa.get("/edu/grades")).status).toBe(403);
    expect((await sa.get("/edu/complaints")).status).toBe(403);
    expect((await sa.get("/edu/chats")).status).toBe(403);
    expect((await sa.get("/org/audit")).status).toBe(403);
  });

  it("tashkilot foydalanuvchilari platforma API'siga kira olmaydi", async () => {
    const o = await as("owner@tizims.ai", "owner123");
    expect((await o.get("/platform/tenants")).status).toBe(403);
  });

  it("tashkilot to'xtatilsa — sessiya va login darhol yopiladi, qayta yoqilsa ochiladi", async () => {
    const sa = await as("superadmin@tizims.ai", "super123");
    const shop = await as("shop@abc.uz", "shop123");
    expect((await sa.patch(`/platform/tenants/${SHOP}`, { status: "suspended" })).status).toBe(200);
    expect((await shop.get("/org/tasks")).status).toBe(403);
    const again = await client().post("/auth/login", { email: "shop@abc.uz", password: "shop123" });
    expect(again.status).toBe(403);
    expect(again.data.error.code).toBe("ORG_SUSPENDED");
    await sa.patch(`/platform/tenants/${SHOP}`, { status: "active" });
    await client().login("shop@abc.uz", "shop123");
  });

  it("modul o'chirilsa — ta'lim API yopiladi", async () => {
    const sa = await as("superadmin@tizims.ai", "super123");
    const r = await as("rector@iau.uz", "rector123");
    await sa.patch(`/platform/tenants/${IAU}`, { modules: ["finance", "documents", "analytics"] });
    const blocked = await r.get("/edu/students");
    expect(blocked.status).toBe(403);
    expect(blocked.data.error.code).toBe("MODULE_DISABLED");
    expect((await r.get("/auth/me")).data.modules).not.toContain("education");
    await sa.patch(`/platform/tenants/${IAU}`, { modules: ["education", "finance", "documents", "analytics"] });
    expect((await r.get("/edu/students")).status).toBe(200);
  });

  it("platforma harakatlari auditga yoziladi", async () => {
    const sa = await as("superadmin@tizims.ai", "super123");
    await sa.patch(`/platform/tenants/${SHOP}`, { plan: "enterprise" });
    const audit = (await sa.get("/platform/audit")).data as { action: string; target: string; detail: string }[];
    expect(audit.some((a) => a.action === "Tarif" && a.target === "abc-shop" && a.detail.includes("enterprise"))).toBe(true);
    await sa.patch(`/platform/tenants/${SHOP}`, { plan: "business" });
  });
});

describe("yordam rejimi va ma'lumot so'rovlari", () => {
  it("so'rov → ega tasdiqlaydi → faol; qayta tasdiqlab bo'lmaydi; boshqa tashkilot egasi ko'rmaydi", async () => {
    const sa = await as("superadmin@tizims.ai", "super123");
    const req = await sa.post("/platform/access", { tenant: "iau", reason: "Import xatosini tekshirish", hours: 2 });
    expect(req.status).toBe(201);
    expect((await sa.post("/platform/access", { tenant: "iau", reason: "Ikkinchi so'rov", hours: 1 })).status).toBe(400);

    const omad = await as("omadbek@tizims.uz", "demo123");
    await omad.post("/auth/switch", { organizationId: SHOP });
    expect(((await omad.get("/org/support-access")).data ?? []).some?.((x: { id: string }) => x.id === req.data.id) ?? false).toBe(false);

    const owner = await as("owner@tizims.ai", "owner123");
    const ok = await owner.post(`/org/support-access/${req.data.id}/decision`, { decision: "approve" });
    expect(ok.status).toBe(200);
    expect(ok.data.status).toBe("active");
    expect(ok.data.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect((await owner.post(`/org/support-access/${req.data.id}/decision`, { decision: "approve" })).status).toBe(403);

    const audit = (await sa.get("/platform/audit")).data as { actor: string; detail: string }[];
    expect(audit.some((a) => a.actor.includes("(ega)") && a.detail.includes("tasdiqlandi"))).toBe(true);
  });

  it("ega tasdiqlamaguncha ma'lumot o'chirish boshlanmaydi", async () => {
    const sa = await as("superadmin@tizims.ai", "super123");
    expect((await sa.patch("/platform/data-requests/DR-8", { status: "processing" })).status).toBe(400);
  });

  it("e'lon faqat mos auditoriyaga ko'rinadi", async () => {
    const sa = await as("superadmin@tizims.ai", "super123");
    const a = await sa.post("/platform/announcements", { title: "Biznes uchun yangilik", body: "Faqat do'konlar uchun xabar", audience: "business", tone: "info", channels: ["banner"], publish: true });
    expect(a.status).toBe(201);
    const shop = await as("shop@abc.uz", "shop123");
    const rector = await as("rector@iau.uz", "rector123");
    expect(((await shop.get("/org/banner")).data.announcements as { id: string }[]).some((x) => x.id === a.data.id)).toBe(true);
    expect(((await rector.get("/org/banner")).data.announcements as { id: string }[]).some((x) => x.id === a.data.id)).toBe(false);
  });
});

describe("tashkilot egasi", () => {
  it("foydalanuvchi qo'shadi → vaqtinchalik parol → parol almashtirilmaguncha ma'lumot yopiq", async () => {
    const owner = await as("owner@tizims.ai", "owner123");
    const r = await owner.post("/org/members", { name: "Yangi O'qituvchi", email: "new.teacher@iau.uz", role: "teacher" });
    expect(r.status).toBe(201);
    expect(r.data.tempPassword).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(r.data.member.pendingPassword).toBe(true);

    const t = client();
    const s = await t.login("new.teacher@iau.uz", r.data.tempPassword);
    expect(s.mustChangePassword).toBe(true);
    const blocked = await t.get("/org/tasks");
    expect(blocked.status).toBe(403);
    expect(blocked.data.error.code).toBe("PASSWORD_CHANGE_REQUIRED");

    expect((await t.post("/auth/password", { current: r.data.tempPassword, next: "qisqa" })).status).toBe(400);
    const ok = await t.post("/auth/password", { current: r.data.tempPassword, next: "YangiParol2026" });
    expect(ok.status).toBe(200);
    expect(ok.data.mustChangePassword).toBe(false);
    expect((await t.get("/org/tasks")).status).toBe(200);
    await client().login("new.teacher@iau.uz", "YangiParol2026");
  });

  it("talaba akkaunti talaba yozuviga bog'lanadi", async () => {
    const owner = await as("owner@tizims.ai", "owner123");
    expect((await owner.post("/org/members", { name: "Diyora N", email: "diyora@iau.uz", role: "student" })).status).toBe(400);
    const r = await owner.post("/org/members", { name: "Diyora Nematova", email: "diyora@iau.uz", role: "student", studentId: "TLB-4826" });
    expect(r.status).toBe(201);
    const s = client();
    await s.login("diyora@iau.uz", r.data.tempPassword);
    await s.post("/auth/password", { current: r.data.tempPassword, next: "Diyora2026x" });
    expect((await s.get("/edu/grades/my")).data.student.id).toBe("TLB-4826");
  });

  it("rektor foydalanuvchi qo'sha olmaydi va tashkilot profilini o'zgartira olmaydi", async () => {
    const r = await as("rector@iau.uz", "rector123");
    expect((await r.post("/org/members", { name: "X Y", email: "x@iau.uz", role: "teacher" })).status).toBe(403);
    expect((await r.patch("/org/settings", { name: "Buzilgan nom" })).status).toBe(403);
  });

  it("o'zini o'zgartira olmaydi; ko'p tashkilotli akkaunt parolini tiklay olmaydi", async () => {
    const owner = await as("owner@tizims.ai", "owner123");
    expect((await owner.patch("/org/members/u-ts-owner", { status: "suspended" })).status).toBe(403);
    expect((await owner.post("/org/members/u-omad/reset-password")).status).toBe(403);
    const reset = await owner.post("/org/members/u5/reset-password");
    expect(reset.status).toBe(200);
    await client().login("dean@iau.uz", reset.data.tempPassword);
  });

  it("to'xtatilgan a'zoning sessiyasi darhol yopiladi", async () => {
    const owner = await as("owner@tizims.ai", "owner123");
    const adv = await as("advisor@tizims.ai", "advisor123");
    expect((await owner.patch("/org/members/u-ts-advisor", { status: "suspended" })).status).toBe(200);
    expect((await adv.get("/org/tasks")).status).toBe(403);
    expect((await client().post("/auth/login", { email: "advisor@tizims.ai", password: "advisor123" })).status).toBe(403);
    await owner.patch("/org/members/u-ts-advisor", { status: "active" });
    await client().login("advisor@tizims.ai", "advisor123");
  });

  it("rollar matritsasi haqiqatda cheklaydi; ega rolini o'zgartirib bo'lmaydi", async () => {
    const owner = await as("owner@tizims.ai", "owner123");
    const t = await as("teacher@tizims.ai", "teacher123");
    const row = { subject: "CS-301", group: "IT-21", rows: [{ studentId: "TLB-4820", jn: 20, on: 10, yn: null }] };
    expect((await t.put("/edu/grades", row)).status).toBe(200);

    const m = (await owner.get("/edu/roles/permissions")).data.matrix as Record<string, string[]>;
    await owner.put("/edu/roles/permissions", { role: "teacher", keys: m.teacher.filter((k) => k !== "edu.grades.manage") });
    expect((await t.put("/edu/grades", row)).status).toBe(403);
    expect((await t.get("/auth/me")).data.permissions).not.toContain("edu.grades.manage");

    expect((await owner.put("/edu/roles/permissions", { role: "owner", keys: [] })).status).toBe(403);
    await owner.post("/edu/roles/permissions/reset");
    expect((await t.put("/edu/grades", row)).status).toBe(200);
  });

  it("TIZIMS yordamiga so'rov → super admin ko'radi va javob beradi → ega javobni ko'radi", async () => {
    const owner = await as("owner@tizims.ai", "owner123");
    const t = await owner.post("/org/tickets", { subject: "Jadval importi", body: "Excel fayldan jadval yuklashda xato chiqmoqda", priority: "high" });
    expect(t.status).toBe(201);
    const sa = await as("superadmin@tizims.ai", "super123");
    expect(((await sa.get("/platform/tickets")).data as { id: string }[]).some((x) => x.id === t.data.id)).toBe(true);
    await sa.post(`/platform/tickets/${t.data.id}/reply`, { text: "Fayl namunasini yuboring" });
    const mine = ((await owner.get("/org/tickets")).data as { id: string; replies: unknown[]; status: string }[]).find((x) => x.id === t.data.id)!;
    expect(mine.replies.length).toBe(1);
    expect(mine.status).toBe("pending");
    // Boshqa tashkilot ko'rmaydi
    const shop = await as("shop@abc.uz", "shop123");
    expect((await shop.get("/org/tickets")).status).toBe(403);
  });

  it("tarif so'rovi yordam markaziga tushadi, takror so'rov rad etiladi", async () => {
    const owner = await as("owner@tizims.ai", "owner123");
    const b = (await owner.get("/org/billing")).data;
    expect(b.plan).toBe("enterprise");
    expect((await owner.post("/org/billing/plan-request", { plan: "enterprise" })).status).toBe(400);
    expect((await owner.post("/org/billing/plan-request", { plan: "business" })).status).toBe(201);
    expect((await owner.post("/org/billing/plan-request", { plan: "starter" })).status).toBe(400);
    expect((await owner.get("/org/billing")).data.pendingPlanRequest).toContain("business");
  });

  it("tashkilot profilini yangilaydi; o'chirish so'rovi tasdiq so'zisiz qabul qilinmaydi", async () => {
    const owner = await as("owner@tizims.ai", "owner123");
    const s = await owner.patch("/org/settings", { phone: "+998 71 200 00 01", primaryColor: "#123456" });
    expect(s.status).toBe(200);
    expect(s.data.primary_color).toBe("#123456");
    expect((await owner.patch("/org/settings", { primaryColor: "qizil" })).status).toBe(400);
    expect((await owner.post("/org/data-requests", { kind: "delete", reason: "Sinov uchun" })).status).toBe(400);
    const e = await owner.post("/org/data-requests", { kind: "export", reason: "Yillik arxiv" });
    expect(e.status).toBe(201);
    expect(e.data.status).toBe("processing");
  });
});

describe("super admin — tashkilot API'lari yopiq", () => {
  it("vazifalar, a'zolar, sozlamalar, obuna va yordam so'rovlariga kira olmaydi", async () => {
    const sa = await as("superadmin@tizims.ai", "super123");
    for (const p of ["/org/tasks", "/org/members", "/org/members/manage", "/org/settings", "/org/billing", "/org/tickets", "/org/notifications"]) {
      expect((await sa.get(p)).status, p).toBe(403);
    }
    expect((await sa.get("/org/banner")).status).toBe(200);
    expect((await sa.get("/edu/roles/permissions")).status).toBe(200);
  });
});

describe("ega bosh sahifasi (overview)", () => {
  it("raqamlar bazadan hisoblanadi va o'zgarishlarni darhol aks ettiradi", async () => {
    const owner = await as("owner@tizims.ai", "owner123");
    const before = (await owner.get("/org/overview")).data;
    const students = (await owner.get("/edu/students")).data as { status: string }[];
    expect(before.kpi.students).toBe(students.filter((s) => s.status === "active").length);
    expect(before.faculties.reduce((a: number, f: { students: number }) => a + f.students, 0)).toBe(before.kpi.students);

    const st = await as("student@tizims.ai", "student123");
    await st.post("/edu/complaints", { title: "Overview test", body: "Yangi murojaat matni", category: "Boshqa", anonymous: false });
    const after = (await owner.get("/org/overview")).data;
    expect(after.attention.newComplaints).toBe(before.attention.newComplaints + 1);

  });

  it("faqat ega ko'radi", async () => {
    expect((await (await as("rector@iau.uz", "rector123")).get("/org/overview")).status).toBe(403);
    expect((await (await as("teacher@tizims.ai", "teacher123")).get("/org/overview")).status).toBe(403);
    expect((await (await as("superadmin@tizims.ai", "super123")).get("/org/overview")).status).toBe(403);
  });

  it("ta'lim moduli o'chiq bo'lsa ham ishlaydi", async () => {
    const sa = await as("superadmin@tizims.ai", "super123");
    const owner = await as("owner@tizims.ai", "owner123");
    await sa.patch(`/platform/tenants/${IAU}`, { modules: ["finance", "documents", "analytics"] });
    const r = await owner.get("/org/overview");
    expect(r.status).toBe(200);
    expect(r.data.education).toBe(false);
    expect(r.data.kpi.students).toBe(0);
    await sa.patch(`/platform/tenants/${IAU}`, { modules: ["education", "finance", "documents", "analytics"] });
  });
});

describe("batafsil ko'rinishlar", () => {
  it("talaba kartasi: baholar va belgilangan davomat bir joyda; doira tekshiriladi", async () => {
    const t = await as("teacher@tizims.ai", "teacher123");
    const day = new Date().toISOString().slice(0, 10);
    await t.put("/edu/attendance/sheet", { lessonId: "l1", date: day, marks: { "TLB-4819": "absent" } });

    const r = await as("rector@iau.uz", "rector123");
    const d = await r.get("/edu/students/TLB-4819");
    expect(d.status).toBe(200);
    expect(d.data.faculty.id).toBe("f-it");
    expect(d.data.subjects.length).toBeGreaterThan(0);
    expect(d.data.attendance.some((a: { mark: string }) => a.mark === "absent")).toBe(true);
    expect(d.data.accounts.some((a: { id: string }) => a.id === "u-ts-student")).toBe(true);

    const dean = await as("dean@iau.uz", (await (await as("owner@tizims.ai", "owner123")).post("/org/members/u5/reset-password")).data.tempPassword);
    // Dekan vaqtinchalik parolni almashtirmaguncha hech narsa ko'rmaydi
    expect((await dean.get("/edu/students/TLB-4833")).status).toBe(403);
  });

  it("dekan boshqa fakultet talabasini, o'qituvchi talaba kartasini ko'rmaydi", async () => {
    const owner = await as("owner@tizims.ai", "owner123");
    const tmp = (await owner.post("/org/members/u5/reset-password")).data.tempPassword;
    const dean = client();
    await dean.login("dean@iau.uz", tmp);
    await dean.post("/auth/password", { current: tmp, next: "Dekan2026pass" });
    expect((await dean.get("/edu/students/TLB-4819")).status).toBe(200);
    expect((await dean.get("/edu/students/TLB-4833")).status).toBe(404); // AG-21 — agronomiya
    expect((await dean.get("/edu/groups/AG-21")).status).toBe(404);
    const t = await as("teacher@tizims.ai", "teacher123");
    expect((await t.get("/edu/students/TLB-4819")).status).toBe(403);
  });

  it("guruh sahifasi: o'qituvchi faqat o'z guruhini, telefon raqamsiz", async () => {
    const t = await as("teacher@tizims.ai", "teacher123");
    const g = await t.get("/edu/groups/IT-21");
    expect(g.status).toBe(200);
    expect(g.data.students.length).toBeGreaterThan(0);
    expect(g.data.students.some((s: Record<string, unknown>) => "phone" in s || "parent" in s)).toBe(false);
    expect((await t.get("/edu/groups/AG-21")).status).toBe(404);
  });

  it("fakultet sahifasi guruh ko'rsatkichlarini qaytaradi", async () => {
    const r = await as("rector@iau.uz", "rector123");
    const f = await r.get("/edu/faculties/f-it");
    expect(f.status).toBe(200);
    expect(f.data.groups.map((g: { id: string }) => g.id)).toEqual(expect.arrayContaining(["IT-21", "IT-22", "IT-23"]));
  });

  it("foydalanuvchi kartasi faqat ega uchun, rol tarixi yoziladi", async () => {
    const owner = await as("owner@tizims.ai", "owner123");
    await owner.patch("/org/members/u-ts-advisor", { role: "teacher" });
    await owner.patch("/org/members/u-ts-advisor", { role: "advisor" });
    const d = await owner.get("/org/members/u-ts-advisor");
    expect(d.status).toBe(200);
    expect(d.data.changes.length).toBeGreaterThanOrEqual(2);
    expect(d.data.changes[0].to).toContain("advisor");
    expect((await (await as("rector@iau.uz", "rector123")).get("/org/members/u-ts-advisor")).status).toBe(403);
  });

  it("murojaat tarixi yoziladi; anonim muallif tarixda ham yashirin", async () => {
    const s = await as("student@tizims.ai", "student123");
    const c = await s.post("/edu/complaints", { title: "Tarix testi", body: "Anonim murojaat matni", category: "Infratuzilma", anonymous: true });
    const r = await as("rector@iau.uz", "rector123");
    await r.patch(`/edu/complaints/${c.data.id}`, { status: "review" });
    const done = await r.patch(`/edu/complaints/${c.data.id}`, { status: "resolved", answer: "Tuzatildi" });
    const h = done.data.history as { kind: string; by: string; text: string }[];
    expect(h[0].kind).toBe("created");
    expect(h[0].by).toBe("Anonim");
    expect(h.filter((x) => x.kind === "status").length).toBe(2);
    expect(h.some((x) => x.kind === "answer" && x.text === "Tuzatildi")).toBe(true);
    expect(JSON.stringify(h)).not.toContain("Jasmina");
  });

  it("menyu belgilari haqiqiy sonlarni qaytaradi", async () => {
    const owner = await as("owner@tizims.ai", "owner123");
    const b = (await owner.get("/org/badges")).data;
    const o = (await owner.get("/org/overview")).data;
    expect(b.newComplaints).toBe(o.complaints.new);
    expect(b.attention).toBeGreaterThanOrEqual(b.newComplaints);
    const st = await as("student@tizims.ai", "student123");
    const sb = (await st.get("/org/badges")).data;
    expect(sb.newComplaints).toBe(0);
    expect(sb.attention).toBe(0);
  });
});

describe("talabalar analitikasi", () => {
  it("bazadagi kontingentdan hisoblanadi, dekan uchun — o'z fakulteti", async () => {
    const r = await as("rector@iau.uz", "rector123");
    const a = (await r.get("/edu/analytics")).data;
    const students = (await r.get("/edu/students")).data as { status: string; gpa: number }[];
    const active = students.filter((s) => s.status === "active");
    expect(a.kpi.active).toBe(active.length);
    expect(a.attendanceBuckets.reduce((x: number, b: { n: number }) => x + b.n, 0)).toBe(active.length);
    expect(a.status.leave + a.status.expelled + a.status.active + a.status.graduated).toBe(students.length);
    expect(a.atRisk.every((s: { reasons: string[] }) => s.reasons.length > 0)).toBe(true);
    expect(a.subjects.length).toBeGreaterThan(0);
    expect(a.goals.every((g: { value: number }) => g.value >= 0 && g.value <= 100)).toBe(true);

    const owner = await as("owner@tizims.ai", "owner123");
    const tmp = (await owner.post("/org/members/u5/reset-password")).data.tempPassword;
    const dean = client();
    await dean.login("dean@iau.uz", tmp);
    await dean.post("/auth/password", { current: tmp, next: "Dekan2027pass" });
    const da = (await dean.get("/edu/analytics")).data;
    expect(da.scope).toBe("faculty");
    expect(da.groups.every((g: { id: string }) => g.id.startsWith("IT-"))).toBe(true);
  });

  it("o'qituvchi va talaba ko'ra olmaydi", async () => {
    expect((await (await as("teacher@tizims.ai", "teacher123")).get("/edu/analytics")).status).toBe(403);
    expect((await (await as("student@tizims.ai", "student123")).get("/edu/analytics")).status).toBe(403);
  });
});

describe("ma'lumotlar izchilligi va sessiyalar", () => {
  it("guruh ro'yxati va guruh sahifasi bir xil raqam ko'rsatadi", async () => {
    const r = await as("rector@iau.uz", "rector123");
    const list = (await r.get("/edu/groups")).data as { id: string; students: number; gpa: number; attendance: number }[];
    for (const g of list.slice(0, 3)) {
      const d = (await r.get(`/edu/groups/${g.id}`)).data;
      expect(g.students).toBe(d.stats.students);
      expect(g.attendance).toBe(d.stats.attendance);
    }
    const fac = (await r.get("/edu/faculties")).data as { liveStudents: number }[];
    const ov = (await (await as("owner@tizims.ai", "owner123")).get("/org/overview")).data;
    expect(fac.reduce((a, f) => a + f.liveStudents, 0)).toBe(ov.kpi.students);
  });

  it("vazifa muddat yorlig'i har doim bugungi sanaga nisbatan", async () => {
    const r = await as("rector@iau.uz", "rector123");
    const past = await r.post("/org/tasks", { title: "Eski muddat", due: "2020-01-01", priority: "low", category: "Umumiy" });
    expect(past.data.dueLabel).toBe("Kechikkan");
    const list = (await r.get("/org/tasks")).data as { due: string; dueLabel: string }[];
    const today = new Date().toISOString().slice(0, 10);
    expect(list.filter((t) => t.due < today).every((t) => t.dueLabel === "Kechikkan")).toBe(true);
  });

  it("parol o'zgarsa boshqa qurilmadagi sessiya yopiladi, joriysi qoladi", async () => {
    const a = await as("advisor@tizims.ai", "advisor123");
    const b = await as("advisor@tizims.ai", "advisor123");
    expect((await b.get("/org/tasks")).status).toBe(200);
    expect((await a.post("/auth/password", { current: "advisor123", next: "Advisor2026x" })).status).toBe(200);
    expect((await a.get("/org/tasks")).status).toBe(200);
    expect((await b.get("/org/tasks")).status).toBe(401);
  });

  it("ega parolni tiklasa — foydalanuvchining ochiq sessiyalari yopiladi", async () => {
    const st = await as("student@tizims.ai", "student123");
    expect((await st.get("/edu/grades/my")).status).toBe(200);
    const owner = await as("owner@tizims.ai", "owner123");
    expect((await owner.post("/org/members/u-ts-student/reset-password")).status).toBe(200);
    expect((await st.get("/edu/grades/my")).status).toBe(401);
  });
});

describe("fanlar va o'qituvchi biriktirish", () => {
  async function newTeacher(email: string) {
    const owner = await as("owner@tizims.ai", "owner123");
    const r = await owner.post("/org/members", { name: "Yangi Fan O'qituvchisi", email, role: "teacher" });
    const t = client();
    await t.login(email, r.data.tempPassword);
    await t.post("/auth/password", { current: r.data.tempPassword, next: "Teacher2026x" });
    return { owner, t, id: r.data.member.id as string };
  }

  it("yangi o'qituvchiga fan biriktiriladi → jurnal, bildirishnoma va baholash ishlaydi", async () => {
    const { owner, t, id } = await newTeacher("fan.teacher@iau.uz");
    expect(((await t.get("/edu/lms")).data.subjects as string[]).length).toBe(0);

    const c = await owner.post("/edu/subjects", { code: "CS-401", name: "Kompyuter ko'rish", credits: 5, hours: 60, teacherId: id, groups: ["IT-21"] });
    expect(c.status).toBe(201);
    expect(c.data.teacherAccount).toBe("active");

    expect((await t.get("/edu/lms")).data.subjects).toContain("CS-401");
    const notes = (await t.get("/org/notifications")).data as { title: string }[];
    expect(notes.some((n) => n.title === "Yangi fan biriktirildi")).toBe(true);
    expect((await t.get("/edu/grades?subject=CS-401&group=IT-21")).status).toBe(200);
    expect((await t.put("/edu/grades", { subject: "CS-401", group: "IT-21", rows: [{ studentId: "TLB-4819", jn: 25, on: 15, yn: null }] })).status).toBe(200);
  });

  it("o'qituvchi almashtirilsa — darslar va huquq yangi o'qituvchiga o'tadi", async () => {
    const { owner, t, id } = await newTeacher("almash.teacher@iau.uz");
    const old = await as("teacher@tizims.ai", "teacher123");
    const r = await owner.patch("/edu/subjects/CS-320", { teacherId: id });
    expect(r.status).toBe(200);
    expect(r.data.movedLessons).toBeGreaterThan(0);

    expect((await old.get("/edu/grades?subject=CS-320&group=IT-23")).status).toBe(403);
    expect((await t.get("/edu/grades?subject=CS-320&group=IT-23")).status).toBe(200);
    const lessons = (await t.get("/edu/lessons")).data as { id: string; subject: string }[];
    expect(lessons.every((l) => l.subject === "CS-320")).toBe(true);
    const day = new Date().toISOString().slice(0, 10);
    expect((await t.put("/edu/attendance/sheet", { lessonId: lessons[0].id, date: day, marks: {} })).status).toBe(200);
    expect((await old.put("/edu/attendance/sheet", { lessonId: lessons[0].id, date: day, marks: {} })).status).toBe(404);

    const audit = (await owner.get("/org/audit")).data as { action: string; objectId: string; newValue?: string }[];
    expect(audit.some((a) => a.action === "ASSIGN" && a.objectId === "CS-320")).toBe(true);
  });

  it("faqat akkaunti bor faol o'qituvchiga; dekan o'z fakultetidan tashqariga biriktira olmaydi", async () => {
    const owner = await as("owner@tizims.ai", "owner123");
    expect((await owner.patch("/edu/subjects/MA-204", { teacherId: "t-malika" })).status).toBe(400); // akkauntsiz o'qituvchi
    expect((await owner.patch("/edu/subjects/MA-204", { teacherId: "u-ts-student" })).status).toBe(400);
    expect((await owner.post("/edu/subjects", { code: "CS-401", name: "Dublikat", credits: 3, hours: 30, teacherId: "u-ts-teacher", groups: ["IT-21"] })).status).toBe(400);
    expect((await owner.post("/edu/subjects", { code: "XX-999", name: "Guruhsiz", credits: 3, hours: 30, teacherId: "u-ts-teacher", groups: ["YO-00"] })).status).toBe(400);

    const tmp = (await owner.post("/org/members/u5/reset-password")).data.tempPassword;
    const dean = client();
    await dean.login("dean@iau.uz", tmp);
    await dean.post("/auth/password", { current: tmp, next: "Dekan2028pass" });
    expect((await dean.post("/edu/subjects", { code: "AG-301", name: "Agro fan", credits: 3, hours: 30, teacherId: "u-ts-teacher", groups: ["AG-21"] })).status).toBe(403);
    expect((await dean.patch("/edu/subjects/HI-100", { name: "Buzish" })).status).toBe(403);
  });

  it("katalog hammaga ko'rinadi, o'zgartirish faqat boshqaruvga", async () => {
    const t = await as("teacher@tizims.ai", "teacher123");
    expect((await t.get("/edu/subjects")).status).toBe(200);
    expect((await t.post("/edu/subjects", { code: "CS-499", name: "Ruxsatsiz", credits: 3, hours: 30, teacherId: "u-ts-teacher", groups: ["IT-21"] })).status).toBe(403);
    expect((await t.patch("/edu/subjects/CS-301", { teacherId: "u-ts-teacher" })).status).toBe(403);
  });
});

describe("talabalarni ommaviy import qilish", () => {
  it("quruq tekshiruv: har bir qator uchun aniq natija", async () => {
    const owner = await as("owner@tizims.ai", "owner123");
    const r = await owner.post("/edu/students/import", {
      dryRun: true,
      rows: [
        { row: 2, name: "Import Birinchi", group: "it-21", funding: "davlat granti", phone: "90 111 22 33" },
        { row: 3, name: "Bitta", group: "IT-21" },
        { row: 4, name: "Guruhsiz Talaba", group: "XX-99" },
        { row: 5, name: "Telefon Xato", group: "IT-21", phone: "12345" },
        { row: 6, name: "Import Birinchi", group: "IT-21" },
        { row: 7, name: "Jasmina Aliyeva", group: "IT-21" },
        { row: 8, name: "Shaklsiz Talaba", group: "IT-22" },
        { row: 9, name: "Noma'lum Shakl", group: "IT-22", funding: "bepul" },
      ],
    });
    expect(r.status).toBe(200);
    const by = Object.fromEntries((r.data.rows as { row: number; status: string; errors: string[]; warnings: string[]; data: { group: string; funding: string; phone: string } }[]).map((x) => [x.row, x]));
    expect(by[2].status).toBe("ok");
    expect(by[2].data).toMatchObject({ group: "IT-21", funding: "Grant", phone: "+998 90 111 22 33" });
    expect(by[3].status).toBe("error");
    expect(by[4].errors.join()).toContain("topilmadi");
    expect(by[5].errors.join()).toContain("Telefon");
    expect(by[6].status).toBe("duplicate");
    expect(by[7].status).toBe("duplicate");
    expect(by[8].status).toBe("ok");
    expect(by[8].warnings.join()).toContain("Kontrakt");
    expect(by[9].status).toBe("error");
    expect(r.data.summary).toMatchObject({ total: 8, ok: 2, duplicates: 2, errors: 4 });
  });

  it("saqlash: faqat to'g'ri qatorlar, qayta tekshiriladi, audit va guruh soni yangilanadi", async () => {
    const owner = await as("owner@tizims.ai", "owner123");
    const before = ((await owner.get("/edu/groups")).data as { id: string; students: number }[]).find((g) => g.id === "IT-22")!.students;
    const rows = [
      { name: "Import Ikkinchi", group: "IT-22", funding: "Kontrakt" },
      { name: "Import Uchinchi", group: "IT-22", funding: "Grant", phone: "998977776655" },
      { name: "Xato", group: "IT-22" },
    ];
    const r = await owner.post("/edu/students/import", { dryRun: false, rows });
    expect(r.status).toBe(201);
    expect(r.data.summary.created).toBe(2);
    expect(r.data.ids).toHaveLength(2);
    const after = ((await owner.get("/edu/groups")).data as { id: string; students: number }[]).find((g) => g.id === "IT-22")!.students;
    expect(after).toBe(before + 2);
    const audit = (await owner.get("/org/audit")).data as { action: string; newValue?: string }[];
    expect(audit.some((a) => a.action === "IMPORT" && a.newValue?.includes("2 talaba"))).toBe(true);
    // Takror yuborilsa — endi dublikat
    const again = await owner.post("/edu/students/import", { dryRun: false, rows: rows.slice(0, 2) });
    expect(again.status).toBe(400);
  });

  it("katta fayl qabul qilinadi, limitdan oshsa rad etiladi; ruxsatsiz rol yuklay olmaydi", async () => {
    const owner = await as("owner@tizims.ai", "owner123");
    const big = Array.from({ length: 3000 }, (_, i) => ({ name: `Katta Fayl${i} Talabasi${i}`, group: "XX-00", phone: "901234567", parent: "Ota Ona Uzun Ismi Bilan Testlash Uchun" }));
    const r = await owner.post("/edu/students/import", { dryRun: true, rows: big });
    expect(r.status).toBe(200);
    expect(r.data.summary.errors).toBe(3000);
    expect((await owner.post("/edu/students/import", { dryRun: true, rows: Array.from({ length: 5001 }, () => ({})) })).status).toBe(400);
    expect((await (await as("teacher@tizims.ai", "teacher123")).post("/edu/students/import", { dryRun: true, rows: [{ name: "A B", group: "IT-21" }] })).status).toBe(403);
  });
});

describe("dars jadvalini tahrirlash", () => {
  it("dars qo'shiladi: o'qituvchi fandan olinadi, o'qituvchi va talabaga xabar boradi", async () => {
    const adv = await as("advisor@tizims.ai", "Advisor2026x");
    const free = (await adv.get("/edu/lessons/availability?day=5&slot=3")).data;
    expect(free.rooms.find((r: { id: string }) => r.id === "B-204").status).toBe("repair");
    const r = await adv.post("/edu/lessons", { subject: "CS-301", group: "IT-21", day: 5, slot: 3, room: "A-305", type: "Seminar" });
    expect(r.status).toBe(201);
    expect(r.data.teacherId).toBe("u-ts-teacher");

    const t = await as("teacher@tizims.ai", "teacher123");
    expect(((await t.get("/edu/lessons")).data as { id: string }[]).some((l) => l.id === r.data.id)).toBe(true);
    expect(((await t.get("/org/notifications")).data as { title: string; body: string }[]).some((n) => n.title === "Jadval o'zgarishi" && n.body.includes("Shanba"))).toBe(true);
    const after = (await adv.get("/edu/lessons/availability?day=5&slot=3")).data;
    expect(after.busyGroups).toContain("IT-21");
  });

  it("xona, o'qituvchi va guruh to'qnashuvi rad etiladi; ta'mirdagi xona va begona guruh ham", async () => {
    const adv = await as("advisor@tizims.ai", "Advisor2026x");
    // Du 1-juftlik: l1 — CS-301, IT-21, IT-3.12, u-ts-teacher
    const room = await adv.post("/edu/lessons", { subject: "EN-110", group: "AG-21", day: 0, slot: 0, room: "IT-3.12", type: "Amaliy" });
    expect(room.status).toBe(400);
    expect(room.data.error.message).toContain("xonasi band");
    const teacher = await adv.post("/edu/lessons", { subject: "CS-301", group: "IT-22", day: 0, slot: 0, room: "A-305", type: "Amaliy" });
    expect(teacher.data.error.message).toContain("boshqa darsda");
    const grp = await adv.post("/edu/lessons", { subject: "EN-110", group: "IT-21", day: 0, slot: 0, room: "A-305", type: "Amaliy" });
    expect(grp.data.error.message).toContain("guruhining");
    expect((await adv.post("/edu/lessons", { subject: "EN-110", group: "AG-21", day: 4, slot: 4, room: "B-204", type: "Amaliy" })).data.error.message).toContain("ta'mirda");
    expect((await adv.post("/edu/lessons", { subject: "CS-301", group: "EK-22", day: 4, slot: 4, room: "A-305", type: "Amaliy" })).status).toBe(400);
  });

  it("tahrirlash: vaqtni ko'chirish to'qnashuvsiz bo'lsa saqlanadi, bo'lmasa rad etiladi", async () => {
    const adv = await as("advisor@tizims.ai", "Advisor2026x");
    const created = (await adv.post("/edu/lessons", { subject: "HI-100", group: "EK-22", day: 4, slot: 4, room: "A-305", type: "Seminar" })).data;
    expect((await adv.patch(`/edu/lessons/${created.id}`, { day: 2, slot: 3 })).status).toBe(400); // Ch 4-juftlik: HI-100 AG-21 — o'sha o'qituvchi
    const moved = await adv.patch(`/edu/lessons/${created.id}`, { day: 3, slot: 4, room: "IT-2.04" });
    expect(moved.status).toBe(200);
    expect(moved.data).toMatchObject({ day: 3, slot: 4, room: "IT-2.04" });
  });

  it("o'chirilgan dars arxivlanadi: jadvaldan yo'qoladi, davomat tarixi qoladi", async () => {
    const adv = await as("advisor@tizims.ai", "Advisor2026x");
    const t = await as("teacher@tizims.ai", "teacher123");
    const l = (await adv.post("/edu/lessons", { subject: "CS-301", group: "IT-21", day: 4, slot: 3, room: "A-305", type: "Amaliy" })).data;
    const day = new Date().toISOString().slice(0, 10);
    expect((await t.put("/edu/attendance/sheet", { lessonId: l.id, date: day, marks: { "TLB-4819": "late" } })).status).toBe(200);
    expect((await adv.del(`/edu/lessons/${l.id}`)).status).toBe(200);
    expect(((await adv.get("/edu/lessons")).data as { id: string }[]).some((x) => x.id === l.id)).toBe(false);
    expect((await t.put("/edu/attendance/sheet", { lessonId: l.id, date: day, marks: {} })).status).toBe(404);
    const card = (await (await as("rector@iau.uz", "rector123")).get("/edu/students/TLB-4819")).data;
    expect(card.attendance.some((a: { subject: string; mark: string }) => a.subject === "CS-301" && a.mark === "late")).toBe(true);
    // Bo'shagan vaqtga yangi dars qo'yish mumkin
    expect((await adv.post("/edu/lessons", { subject: "CS-301", group: "IT-21", day: 4, slot: 3, room: "A-305", type: "Amaliy" })).status).toBe(201);
  });

  it("faqat jadvalni boshqaradigan rollar tahrirlaydi", async () => {
    const t = await as("teacher@tizims.ai", "teacher123");
    expect((await t.post("/edu/lessons", { subject: "CS-301", group: "IT-21", day: 5, slot: 4, room: "A-305", type: "Amaliy" })).status).toBe(403);
    expect((await t.get("/edu/lessons/availability?day=0&slot=0")).status).toBe(403);
  });
});

describe("semestrni yopish", () => {
  it("faqat ega va rektor; oldindan ko'rish hech narsani o'zgartirmaydi", async () => {
    const t = await as("teacher@tizims.ai", "teacher123");
    expect((await t.get("/edu/semesters/close-preview")).status).toBe(403);
    const owner = await as("owner@tizims.ai", "owner123");
    const p = await owner.get("/edu/semesters/close-preview");
    expect(p.status).toBe(200);
    expect(p.data.semester.kind).toBe("fall");
    expect(p.data.next.kind).toBe("spring");
    // Akkauntsiz o'qituvchilarning baholanmagan fanlari hisobdan chiqariladi
    expect(p.data.pairs.some((x: { excluded: boolean }) => x.excluded)).toBe(true);
    const again = await owner.get("/edu/semesters/close-preview");
    expect(again.data.summary).toEqual(p.data.summary);
  });

  it("kuzgi semestr: GPA/qarz yangilanadi, natija arxivlanadi, jurnal tozalanadi, kurs o'zgarmaydi", async () => {
    const owner = await as("owner@tizims.ai", "owner123");
    const t = await as("teacher@tizims.ai", "teacher123");
    // Jasmina: CS-301 bo'yicha a'lo, Javohir: qoniqarsiz
    await t.put("/edu/grades", { subject: "CS-301", group: "IT-21", rows: [{ studentId: "TLB-4819", jn: 28, on: 19, yn: 45 }, { studentId: "TLB-4820", jn: 10, on: 8, yn: 20 }] });
    const before = (await owner.get("/edu/students/TLB-4820")).data.student;
    const preview = (await owner.get("/edu/semesters/close-preview")).data;
    const jas = preview.results.find((r: { studentId: string }) => r.studentId === "TLB-4819");
    const jav = preview.results.find((r: { studentId: string }) => r.studentId === "TLB-4820");
    expect(jas.subjects.find((x: { code: string }) => x.code === "CS-301")).toMatchObject({ mark: 5, passed: true });
    expect(jav.subjects.find((x: { code: string }) => x.code === "CS-301")).toMatchObject({ mark: 2, passed: false });
    const groupsBefore = (await owner.get("/edu/groups")).data as { id: string; course: number }[];

    expect((await owner.post("/edu/semesters/close", { confirm: "noto'g'ri" })).status).toBe(400);
    const r = await owner.post("/edu/semesters/close", { confirm: preview.semester.name });
    expect(r.status).toBe(200);
    expect(r.data.next.kind).toBe("spring");

    const card = (await owner.get("/edu/students/TLB-4820")).data;
    expect(card.student.debt).toBe(before.debt + jav.newDebts);
    expect(card.student.gpa).toBe(jav.cumulativeGpa);
    expect(card.semesters).toHaveLength(1);
    expect(card.semesters[0].subjects.some((x: { name: string; passed: boolean }) => x.name === "Neyron tarmoqlar" && !x.passed)).toBe(true);
    expect(((await owner.get("/edu/grades")).data as unknown[]).length).toBe(0);
    const groupsAfter = (await owner.get("/edu/groups")).data as { id: string; course: number }[];
    expect(groupsAfter.map((g) => g.course)).toEqual(groupsBefore.map((g) => g.course));
    const sems = (await owner.get("/edu/semesters")).data as { id: string; status: string; stats?: { students: number } }[];
    expect(sems.find((x) => x.id === preview.semester.id)!.status).toBe("closed");
    expect(sems.filter((x) => x.status === "active")).toHaveLength(1);
    // Takror yopish — endi boshqa (bahorgi) semestr faol
    expect((await owner.post("/edu/semesters/close", { confirm: preview.semester.name })).status).toBe(400);
  });

  it("bahorgi semestr: kurs ko'chadi; oxirgi kursda qarzsiz — bitiradi, qarzdor — bitirmaydi", async () => {
    const owner = await as("owner@tizims.ai", "owner123");
    expect((await owner.post("/edu/groups", { id: "IT-91", faculty: "f-it", direction: "Bitiruvchilar", course: 4, curator: "Dr. Sardor Rahimov" })).status).toBe(201);
    await owner.post("/edu/students/import", { dryRun: false, rows: [{ name: "Bitiruvchi Toza", group: "IT-91" }, { name: "Bitiruvchi Qarzdor", group: "IT-91" }] });
    const grads = ((await owner.get("/edu/students")).data as { id: string; name: string }[]).filter((s) => s.name.startsWith("Bitiruvchi"));
    const debtor = grads.find((s) => s.name.endsWith("Qarzdor"))!;
    // Bitiruv fani: biri a'lo, ikkinchisi qoniqarsiz — qarz bilan bitirmaydi
    const teacherId = "u-ts-teacher";
    await owner.post("/edu/subjects", { code: "IT-499", name: "Bitiruv ishi", credits: 6, hours: 60, teacherId, groups: ["IT-91"] });
    const t = await as("teacher@tizims.ai", "teacher123");
    const toza = grads.find((s) => s.name.endsWith("Toza"))!;
    expect((await t.put("/edu/grades", { subject: "IT-499", group: "IT-91", rows: [{ studentId: toza.id, jn: 27, on: 18, yn: 44 }, { studentId: debtor.id, jn: 5, on: 5, yn: 10 }] })).status).toBe(200);

    const preview = (await owner.get("/edu/semesters/close-preview")).data;
    expect(preview.semester.kind).toBe("spring");
    expect(preview.promotedGroups.some((g: { id: string; to: number }) => g.id === "IT-23" && g.to === 3)).toBe(true);
    expect(preview.results.find((r: { studentId: string }) => r.studentId === toza.id).outcome).toBe("graduate");
    expect(preview.results.find((r: { studentId: string }) => r.studentId === debtor.id).outcome).toBe("not_graduated");

    expect((await owner.post("/edu/semesters/close", { confirm: preview.semester.name })).status).toBe(200);
    const groups = (await owner.get("/edu/groups")).data as { id: string; course: number }[];
    expect(groups.find((g) => g.id === "IT-23")!.course).toBe(3);
    expect(groups.find((g) => g.id === "IT-91")!.course).toBe(4);
    const all = (await owner.get("/edu/students")).data as { id: string; status: string; debt: number }[];
    expect(all.find((s) => s.id === toza.id)!.status).toBe("graduated");
    expect(all.find((s) => s.id === debtor.id)).toMatchObject({ status: "active", debt: 1 });
    const audit = (await owner.get("/org/audit")).data as { action: string; newValue?: string }[];
    expect(audit.filter((a) => a.action === "CLOSE").length).toBe(2);
    expect(audit.find((a) => a.action === "CLOSE")!.newValue).toContain("bitiruvchi");
  });
});

describe("nazoratchi va talaba profili", () => {
  // Oldingi testlar talaba parolini tiklagan — ma'lum parol o'rnatamiz
  beforeAll(async () => {
    const owner = await as("owner@tizims.ai", "owner123");
    const tmp = (await owner.post("/org/members/u-ts-student/reset-password")).data.tempPassword;
    const c = client();
    await c.login("student@tizims.ai", tmp);
    await c.post("/auth/password", { current: tmp, next: "Student2026x" });
  });

  it("nazoratchi istalgan fan bo'yicha baho va davomat kiritadi; talaba haqiqiy davomatini ko'radi", async () => {
    const adv = await as("advisor@tizims.ai", "Advisor2026x");
    // Akkauntsiz o'qituvchining fani — nazoratchi baholaydi
    expect((await adv.put("/edu/grades", { subject: "EN-110", group: "IT-21", rows: [{ studentId: "TLB-4819", jn: 22, on: 14, yn: null }] })).status).toBe(200);
    const enLesson = ((await adv.get("/edu/lessons")).data as { id: string; subject: string; group: string }[]).find((l) => l.subject === "EN-110" && l.group === "IT-21")!;
    const day = new Date().toISOString().slice(0, 10);
    expect((await adv.put("/edu/attendance/sheet", { lessonId: enLesson.id, date: day, marks: { "TLB-4819": "absent" } })).status).toBe(200);

    const st = await as("student@tizims.ai", "Student2026x");
    const my = (await st.get("/edu/attendance/my")).data;
    expect(my.records.some((r: { subject: string; mark: string }) => r.subject === "EN-110" && r.mark === "absent")).toBe(true);
    expect(my.marked.absent).toBeGreaterThanOrEqual(1);
    expect((await st.get("/edu/attendance/sheet?lessonId=" + enLesson.id)).status).toBe(403);
  });

  it("Fanlarim: fanlar, mas'ul o'qituvchi va kurator; boshqa rol ko'rmaydi", async () => {
    const st = await as("student@tizims.ai", "Student2026x");
    const d = (await st.get("/edu/my/subjects")).data;
    expect(d.student.group).toBe("IT-21");
    const nt = d.subjects.find((x: { code: string }) => x.code === "CS-301");
    expect(nt.teacher.email).toBe("teacher@tizims.ai");
    expect(nt.lessons.length).toBeGreaterThan(0);
    expect(d.curator.name).toBeTruthy();
    expect((await (await as("rector@iau.uz", "rector123")).get("/edu/my/subjects")).status).toBe(403);
  });

  it("e'lonlar: auditoriya bo'yicha ko'rinadi, talaba yoza olmaydi, yangi e'lon talabaga xabar bo'lib boradi", async () => {
    const adv = await as("advisor@tizims.ai", "Advisor2026x");
    const st = await as("student@tizims.ai", "Student2026x");
    const staffOnly = (await st.get("/edu/posts?kind=news")).data as { title: string }[];
    expect(staffOnly.some((p) => p.title === "Kafedra yig'ilishi")).toBe(false);

    const other = await adv.post("/edu/posts", { kind: "news", title: "Faqat IT-23 uchun", body: "IT-23 guruhiga tegishli e'lon matni", audience: "students", groups: ["IT-23"] });
    expect(other.status).toBe(201);
    const mine = await adv.post("/edu/posts", { kind: "news", title: "IT-21 uchun e'lon", body: "IT-21 guruhiga tegishli e'lon matni", audience: "students", groups: ["IT-21"] });
    const list = (await st.get("/edu/posts?kind=news")).data as { id: string }[];
    expect(list.some((p) => p.id === mine.data.id)).toBe(true);
    expect(list.some((p) => p.id === other.data.id)).toBe(false);
    expect(((await st.get("/org/notifications")).data as { title: string; body: string }[]).some((n) => n.title === "Yangi e'lon" && n.body === "IT-21 uchun e'lon")).toBe(true);

    expect((await st.post("/edu/posts", { kind: "news", title: "Talaba e'loni", body: "Ruxsatsiz yozishga urinish", audience: "all" })).status).toBe(403);
    expect((await st.del(`/edu/posts/${mine.data.id}`)).status).toBe(403);
    expect((await st.del(`/edu/posts/${other.data.id}`)).status).toBe(404);
  });

  it("blog: talaba yoqdi bosadi, takror bosilsa qaytadi", async () => {
    const st = await as("student@tizims.ai", "Student2026x");
    const blog = ((await st.get("/edu/posts?kind=blog")).data as { id: string; likes: number }[])[0];
    const liked = await st.post(`/edu/posts/${blog.id}/like`);
    expect(liked.data).toMatchObject({ likes: blog.likes + 1, likedByMe: true });
    expect((await st.post(`/edu/posts/${blog.id}/like`)).data).toMatchObject({ likes: blog.likes, likedByMe: false });
  });

  it("onlayn test: javoblar sizdirilmaydi, serverda baholanadi, bitta urinish", async () => {
    const st = await as("student@tizims.ai", "Student2026x");
    const list = (await st.get("/edu/tests")).data as { id: string; state: string; questions: number }[];
    const t = list.find((x) => x.id === "test-cs301-1")!;
    expect(t.state).toBe("open");
    expect(JSON.stringify(list)).not.toContain('"correct"');
    const started = await st.post(`/edu/tests/${t.id}/start`);
    expect(started.status).toBe(200);
    expect(JSON.stringify(started.data)).not.toContain('"correct"');
    expect(started.data.questions).toHaveLength(4);
    // to'g'ri javoblar: 1,1,0,1 — bittasini xato qilamiz
    const sub = await st.post(`/edu/tests/${t.id}/submit`, { answers: [1, 1, 0, 0] });
    expect(sub.data).toMatchObject({ correct: 3, total: 4, score: 75, late: false });
    expect((await st.post(`/edu/tests/${t.id}/submit`, { answers: [1, 1, 0, 1] })).status).toBe(400);
    expect((await st.post(`/edu/tests/${t.id}/start`)).status).toBe(400);

    const adv = await as("advisor@tizims.ai", "Advisor2026x");
    const r = (await adv.get(`/edu/tests/${t.id}/results`)).data;
    expect(r.attempts.find((a: { studentId: string }) => a.studentId === "TLB-4819").score).toBe(75);
    expect(r.perQuestion[3].correctRate).toBe(0);
  });

  it("test: boshqa guruh talabasi ko'rmaydi; talaba test tuza olmaydi; noto'g'ri test rad etiladi", async () => {
    const adv = await as("advisor@tizims.ai", "Advisor2026x");
    const now = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 16);
    const bad = await adv.post("/edu/tests", { title: "Xato", subject: "CS-301", groups: ["AG-21"], durationMin: 10, opensAt: iso(now), closesAt: iso(new Date(now.getTime() + 3600e3)), questions: [{ text: "Savol", options: ["A", "B"], correct: 0 }] });
    expect(bad.status).toBe(400);
    const t = await adv.post("/edu/tests", { title: "IT-22 testi", subject: "CS-301", groups: ["IT-22"], durationMin: 10, opensAt: iso(new Date(now.getTime() - 3600e3)), closesAt: iso(new Date(now.getTime() + 86400e3)), questions: [{ text: "2+2?", options: ["3", "4"], correct: 1 }], publish: true });
    expect(t.status).toBe(201);
    const st = await as("student@tizims.ai", "Student2026x");
    expect(((await st.get("/edu/tests")).data as { id: string }[]).some((x) => x.id === t.data.id)).toBe(false);
    expect((await st.post(`/edu/tests/${t.data.id}/start`)).status).toBe(404);
    expect((await st.post("/edu/tests", { title: "Talaba testi" })).status).toBe(403);
  });

  it("sozlamalar: bildirishnoma o'chirilsa xabar kelmaydi; boshqa sessiyalar yopiladi", async () => {
    const t = await as("teacher@tizims.ai", "teacher123");
    expect((await t.put("/org/me/preferences", { schedule: false, grades: true, assignments: true, news: true })).data.schedule).toBe(false);
    const before = ((await t.get("/org/notifications")).data as unknown[]).length;
    const adv = await as("advisor@tizims.ai", "Advisor2026x");
    const l = await adv.post("/edu/lessons", { subject: "CS-301", group: "IT-22", day: 5, slot: 2, room: "A-305", type: "Amaliy" });
    expect(l.status).toBe(201);
    expect(((await t.get("/org/notifications")).data as unknown[]).length).toBe(before);
    await t.put("/org/me/preferences", { schedule: true, grades: true, assignments: true, news: true });

    const a = await as("student@tizims.ai", "Student2026x");
    const b = await as("student@tizims.ai", "Student2026x");
    expect((await a.post("/auth/sessions/revoke-others")).status).toBe(200);
    expect((await a.get("/edu/grades/my")).status).toBe(200);
    expect((await b.get("/edu/grades/my")).status).toBe(401);
  });
});

describe("talaba bosh sahifasi", () => {
  it("haqiqiy ma'lumot qaytaradi, boshqa rollarga yopiq", async () => {
    const st = await as("student@tizims.ai", "Student2026x");
    const r = await st.get("/edu/my/home");
    expect(r.status).toBe(200);
    const d = r.data as any;
    expect(d.student.id).toBe("TLB-4819");
    expect(Array.isArray(d.today.lessons)).toBe(true);
    expect(d.subjects.length).toBeGreaterThan(0);
    expect(d.kpi.creditsTotal).toBe(240);
    expect(d.subjects.some((x: any) => x.name === "Qarzdorlik")).toBe(false);
    expect(d.charts.weekLoad).toHaveLength(6);
    expect(Object.keys(d.charts.attendance).sort()).toEqual(["absent", "excused", "late", "present"]);
    const owner = await as("owner@tizims.ai", "owner123");
    expect((await owner.get("/edu/my/home")).status).toBe(403);
    const adv = await as("advisor@tizims.ai", "Advisor2026x");
    expect((await adv.get("/edu/my/home")).status).toBe(403);
  });
});

describe("xabarlar: fayl, ovoz, bir nechta qabul qiluvchi", () => {
  const PDF = new TextEncoder().encode("%PDF-1.4 kasallik ma'lumotnomasi");
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

  it("talaba kontaktlari: o'z o'qituvchilari, dekanat, nazoratchi — rahbar va boshqa talabalar emas", async () => {
    const st = await as("student@tizims.ai", "Student2026x");
    const list = (await st.get("/edu/chats/contacts")).data as { id: string; role: string; position: string }[];
    const ids = list.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["u-deputy", "u5", "u-ts-teacher", "t-bekzod", "t-kamola", "u-ts-advisor"]));
    expect(ids).not.toContain("u-ts-owner");
    expect(ids).not.toContain("t-alisher"); // IT-21 ga dars bermaydi
    expect(list.find((c) => c.id === "u-deputy")?.position).toContain("Dekan o'rinbosari");
    expect((await st.post("/edu/chats/direct", { userId: "u-ts-owner" })).status).toBe(403);
  });

  it("noto'g'ri fayllar rad etiladi", async () => {
    const st = await as("student@tizims.ai", "Student2026x");
    expect((await st.upload("/edu/chats/upload", PDF, { "x-file-name": "virus.exe" })).status).toBe(400);
    expect((await st.upload("/edu/chats/upload", PDF, { "x-file-name": "rasm.png" })).status).toBe(400); // imzo mos emas
    expect((await st.upload("/edu/chats/upload", PDF, { "x-file-name": "ovoz.webm", "x-kind": "voice", "x-duration": "0" })).status).toBe(400);
  });

  it("ma'lumotnomani dekan o'rinbosari va o'qituvchiga birdan yuborish; begona yuklab ololmaydi", async () => {
    const st = await as("student@tizims.ai", "Student2026x");
    const up = await st.upload("/edu/chats/upload", PDF, { "x-file-name": encodeURIComponent("Ma'lumotnoma 086.pdf") });
    expect(up.status).toBe(201);
    expect(up.data.kind).toBe("file");
    expect(up.data.name).toBe("Ma'lumotnoma 086.pdf");
    const img = await st.upload("/edu/chats/upload", PNG, { "x-file-name": "skan.png" });
    expect(img.data.kind).toBe("image");

    const sent = await st.post("/edu/chats/send", { to: ["u-deputy", "t-bekzod"], text: "Kasallik sababli qatnasha olmadim", attachments: [up.data.id, img.data.id] });
    expect(sent.status).toBe(201);
    expect(sent.data.chats).toHaveLength(2);

    // Ruxsatsiz qabul qiluvchi bo'lsa — hech narsa yuborilmaydi
    expect((await st.post("/edu/chats/send", { to: ["u-ts-owner"], text: "x" })).status).toBe(403);

    const dep = await as("deputy@tizims.ai", "deputy123");
    const chats = (await dep.get("/edu/chats")).data as { id: string; unread: number; title: string }[];
    const dm = chats.find((c) => c.title === "Jasmina Aliyeva")!;
    expect(dm.unread).toBe(1);
    const badges = (await dep.get("/org/badges")).data;
    expect(badges.messages).toBeGreaterThanOrEqual(1);
    const msgs = (await dep.get(`/edu/chats/${dm.id}/messages`)).data;
    expect(msgs.messages[0].attachments).toHaveLength(2);
    expect((await dep.get("/edu/chats")).data.find((c: { id: string }) => c.id === dm.id).unread).toBe(0);

    const file = await dep.fetchRaw(`/edu/chats/files/${up.data.id}`);
    expect(file.status).toBe(200);
    expect(new TextDecoder().decode(file.bytes)).toContain("kasallik");
    expect(file.headers.get("content-disposition")).toContain("attachment");
    expect(file.headers.get("content-security-policy")).toContain("sandbox");

    // Talaba o'qilganini ko'radi (✓✓)
    const back = (await st.get(`/edu/chats/${dm.id}/messages`)).data;
    expect(back.peerReadSeq).toBeGreaterThanOrEqual(back.messages[back.messages.length - 1].seq);

    // Boshqa o'qituvchi (suhbatda yo'q) faylni ham, suhbatni ham ko'rmaydi
    const other = await as("a.rasulov@iau.uz", "teacher123");
    expect((await other.fetchRaw(`/edu/chats/files/${up.data.id}`)).status).toBe(404);
    expect((await other.get(`/edu/chats/${dm.id}/messages`)).status).toBe(404);

    // Faqat muallif o'chira oladi
    const mid = msgs.messages[0].id;
    expect((await dep.del(`/edu/chats/${dm.id}/messages/${mid}`)).status).toBe(403);
    expect((await st.del(`/edu/chats/${dm.id}/messages/${mid}`)).status).toBe(200);
    const after = (await dep.get(`/edu/chats/${dm.id}/messages`)).data.messages[0];
    expect(after.deleted).toBe(true);
    expect(after.attachments).toHaveLength(0);
    // Fayl boshqa suhbatda (o'qituvchida) hali bor
    const t = await as("b.tursunov@iau.uz", "teacher123");
    expect((await t.fetchRaw(`/edu/chats/files/${up.data.id}`)).status).toBe(200);
  });

  it("ovozli xabar", async () => {
    const st = await as("student@tizims.ai", "Student2026x");
    const v = await st.upload("/edu/chats/upload", new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0]), { "x-file-name": "ovozli-xabar.webm", "x-kind": "voice", "x-duration": "7" });
    expect(v.status).toBe(201);
    expect(v.data).toMatchObject({ kind: "voice", durationSec: 7, mime: "audio/webm" });
    const m = await st.post("/edu/chats/grp:IT-21/messages", { text: "", attachments: [v.data.id] });
    expect(m.status).toBe(201);
    expect(m.data.attachments[0].kind).toBe("voice");
    // Boshqa birovning faylini biriktirib bo'lmaydi
    const adv = await as("advisor@tizims.ai", "Advisor2026x");
    expect((await adv.post("/edu/chats/grp:IT-21/messages", { text: "", attachments: [v.data.id] })).status).toBe(400);
    // Nazoratchi guruh a'zosi sifatida ovozni eshita oladi
    expect((await adv.fetchRaw(`/edu/chats/files/${v.data.id}`)).status).toBe(200);
  });
});
