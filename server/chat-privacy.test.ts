/**
 * Xabarlar maxfiyligi: shaxsiy xabar va fayl faqat ikki tomonga, guruh xabari faqat guruh a'zolariga.
 * Har bir demo akkaunt (barcha rollar + boshqa tashkilot) bilan haqiqiy HTTP so'rovlar orqali tekshiriladi.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

process.env.DB_PATH = ":memory:";

let server: Server;
let base = "";

beforeAll(async () => {
  const { seedIfEmpty } = await import("./seed");
  const { createApp } = await import("./app");
  seedIfEmpty();
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server?.close());

async function login(email: string, password: string) {
  const r = await fetch(base + "/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-requested-with": "tizims" }, body: JSON.stringify({ email, password }) });
  expect(r.status, email).toBe(200);
  const cookie = r.headers.get("set-cookie")!.split(";")[0];
  const H = { cookie, "x-requested-with": "tizims" };
  return {
    get: async (p: string) => {
      const res = await fetch(base + p, { headers: H });
      const t = await res.text();
      let data: unknown = null;
      try {
        data = t ? JSON.parse(t) : null;
      } catch {
        data = t;
      }
      return { status: res.status, data };
    },
    post: async (p: string, body: unknown) => (await fetch(base + p, { method: "POST", headers: { ...H, "content-type": "application/json" }, body: JSON.stringify(body) })).status,
    del: async (p: string) => (await fetch(base + p, { method: "DELETE", headers: H })).status,
    upload: async (name: string, data: Uint8Array) =>
      (await (await fetch(base + "/edu/chats/upload", { method: "POST", headers: { ...H, "content-type": "application/octet-stream", "x-file-name": name }, body: data })).json()) as { id: string },
  };
}

const ACCOUNTS: [string, string, string][] = [
  ["owner", "owner@tizims.ai", "owner123"],
  ["rektor", "rector@iau.uz", "rector123"],
  ["dekan", "dean@iau.uz", "dean123"],
  ["dekan o'rinbosari", "deputy@tizims.ai", "deputy123"],
  ["nazoratchi", "advisor@tizims.ai", "advisor123"],
  ["o'qituvchi (IT-21)", "teacher@tizims.ai", "teacher123"],
  ["o'qituvchi Bekzod (IT-21)", "b.tursunov@iau.uz", "teacher123"],
  ["o'qituvchi Alisher (IT-21 da yo'q)", "a.rasulov@iau.uz", "teacher123"],
  ["ota-ona (o'sha talabaning)", "parent@tizims.ai", "parent123"],
  ["super admin", "superadmin@tizims.ai", "super123"],
  ["boshqa tashkilot egasi", "omadbek@tizims.uz", "demo123"],
  ["boshqa tashkilot menejeri", "shop@abc.uz", "shop123"],
];

describe("xabarlar maxfiyligi — barcha rollar", () => {
  it("shaxsiy xabar va fayli faqat talaba va dekan o'rinbosariga ko'rinadi", async () => {
    const st = await login("student@tizims.ai", "student123");
    const f = await st.upload("spravka.pdf", new TextEncoder().encode("%PDF-1.4 maxfiy"));
    expect(await st.post("/edu/chats/send", { to: ["u-deputy"], text: "MAXFIY-DM", attachments: [f.id] })).toBe(201);
    const dm = "dm:u-deputy:u-ts-student";

    for (const [label, email, pass] of ACCOUNTS) {
      const u = await login(email, pass);
      const insider = email === "deputy@tizims.ai";
      const list = await u.get("/edu/chats");
      const seesInList = Array.isArray(list.data) && (list.data as { id: string }[]).some((c) => c.id === dm);
      const msgs = await u.get(`/edu/chats/${dm}/messages`);
      const file = await u.get(`/edu/chats/files/${f.id}`);
      const write = await u.post(`/edu/chats/${dm}/messages`, { text: "aralashish" });
      expect(seesInList, `${label}: ro'yxat`).toBe(insider);
      expect(msgs.status === 200, `${label}: xabarlar (${msgs.status})`).toBe(insider);
      expect(file.status === 200, `${label}: fayl (${file.status})`).toBe(insider);
      expect(write === 201, `${label}: yozish (${write})`).toBe(insider);
      if (!insider) {
        expect(JSON.stringify(msgs.data)).not.toContain("MAXFIY-DM");
        expect(JSON.stringify(list.data)).not.toContain("MAXFIY-DM");
      }
    }
  });

  it("guruh xabari va fayli faqat guruh a'zolariga (talabalar, fan o'qituvchilari, nazoratchi, fakultet dekanati)", async () => {
    const st = await login("student@tizims.ai", "student123");
    const f = await st.upload("konspekt.pdf", new TextEncoder().encode("%PDF-1.4 guruh"));
    expect(await st.post("/edu/chats/grp:IT-21/messages", { text: "GURUH-XABAR", attachments: [f.id] })).toBe(201);

    const INSIDERS = new Set(["dean@iau.uz", "deputy@tizims.ai", "advisor@tizims.ai", "teacher@tizims.ai", "b.tursunov@iau.uz"]);
    for (const [label, email, pass] of ACCOUNTS) {
      const u = await login(email, pass);
      const insider = INSIDERS.has(email);
      const msgs = await u.get("/edu/chats/grp:IT-21/messages");
      const file = await u.get(`/edu/chats/files/${f.id}`);
      expect(msgs.status === 200, `${label}: guruh xabarlari (${msgs.status})`).toBe(insider);
      expect(file.status === 200, `${label}: guruh fayli (${file.status})`).toBe(insider);
      if (!insider) expect(JSON.stringify(msgs.data)).not.toContain("GURUH-XABAR");
    }
  });

  it("birovning yuklagan faylini o'z xabariga biriktirib bo'lmaydi; boshqa guruh suhbatiga kirib bo'lmaydi", async () => {
    const st = await login("student@tizims.ai", "student123");
    const f = await st.upload("shaxsiy.pdf", new TextEncoder().encode("%PDF-1.4 x"));
    const t = await login("a.rasulov@iau.uz", "teacher123");
    expect(await t.post("/edu/chats/send", { to: ["u-ts-student"], text: "", attachments: [f.id] })).toBe(400);
    expect((await t.get(`/edu/chats/files/${f.id}`)).status).toBe(404);
    expect((await st.get("/edu/chats/grp:IT-22/messages")).status).toBe(404);
    expect(await st.post("/edu/chats/grp:AG-21/messages", { text: "x" })).toBe(404);
  });
});
