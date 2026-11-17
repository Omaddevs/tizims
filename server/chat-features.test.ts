/**
 * Xabarlar: o'chirishni sinxronlash, eski xabarlarni sahifalab yuklash, bildirishnomalar,
 * guruh moderatsiyasi, spam chegarasi va tashlab ketilgan fayllarni tozalash.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

process.env.DB_PATH = ":memory:";

let server: Server;
let base = "";
let chat: typeof import("./routes/chat");
let dbm: typeof import("./db");

beforeAll(async () => {
  const { seedIfEmpty } = await import("./seed");
  const { createApp } = await import("./app");
  chat = await import("./routes/chat");
  dbm = await import("./db");
  seedIfEmpty();
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server?.close());
beforeEach(() => chat.resetChatLimits());

async function login(email: string, password: string) {
  const r = await fetch(base + "/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-requested-with": "tizims" }, body: JSON.stringify({ email, password }) });
  expect(r.status, email).toBe(200);
  const H = { cookie: r.headers.get("set-cookie")!.split(";")[0], "x-requested-with": "tizims" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = async (res: Response): Promise<{ status: number; data: any }> => ({ status: res.status, data: await res.json().catch(() => null) });
  return {
    get: async (p: string) => json(await fetch(base + p, { headers: H })),
    post: async (p: string, body: unknown) => json(await fetch(base + p, { method: "POST", headers: { ...H, "content-type": "application/json" }, body: JSON.stringify(body) })),
    put: async (p: string, body: unknown) => json(await fetch(base + p, { method: "PUT", headers: { ...H, "content-type": "application/json" }, body: JSON.stringify(body) })),
    del: async (p: string) => json(await fetch(base + p, { method: "DELETE", headers: H })),
    raw: async (p: string) => (await fetch(base + p, { headers: H })).status,
    upload: async (name: string, data: Uint8Array) =>
      json(await fetch(base + "/edu/chats/upload", { method: "POST", headers: { ...H, "content-type": "application/octet-stream", "x-file-name": name }, body: data })),
  };
}

const DM = "dm:u-deputy:u-ts-student";
const unreadChatNotes = async (u: Awaited<ReturnType<typeof login>>, chatId: string) =>
  ((await u.get("/org/notifications")).data as { link?: string; read: boolean }[]).filter((n) => n.link === `/messages?chat=${encodeURIComponent(chatId)}` && !n.read).length;

describe("xabarlar — ishonchlilik", () => {
  it("o'chirilgan xabar suhbatdoshga rev orqali yetib boradi", async () => {
    const st = await login("student@tizims.ai", "student123");
    const dep = await login("deputy@tizims.ai", "deputy123");
    const sent = await st.post("/edu/chats/send", { to: ["u-deputy"], text: "Xato yuborildi" });
    expect(sent.status).toBe(201);
    const first = (await dep.get(`/edu/chats/${DM}/messages`)).data;
    const mid = first.messages.at(-1).id;
    expect((await st.del(`/edu/chats/${DM}/messages/${mid}`)).status).toBe(200);
    const changes = (await dep.get(`/edu/chats/${DM}/messages?rev=${first.rev}`)).data;
    expect(changes.messages).toHaveLength(1);
    expect(changes.messages[0]).toMatchObject({ id: mid, deleted: true, text: "", attachments: [] });
    expect(changes.rev).toBeGreaterThan(first.rev);
    // O'chirilgan xabar o'qilmaganlar soniga kirmaydi
    await st.post("/edu/chats/send", { to: ["u-deputy"], text: "yana" });
    const del2 = (await st.get(`/edu/chats/${DM}/messages`)).data.messages.at(-1).id;
    await st.del(`/edu/chats/${DM}/messages/${del2}`);
    expect((await dep.get("/edu/chats")).data.find((c: { id: string }) => c.id === DM).unread).toBe(0);
  });

  it("eski xabarlar sahifalab yuklanadi (50 tadan)", async () => {
    const st = await login("student@tizims.ai", "student123");
    for (let i = 0; i < 35; i++) await st.post("/edu/chats/grp:IT-21/messages", { text: `xabar ${i}` });
    chat.resetChatLimits();
    for (let i = 35; i < 70; i++) await st.post("/edu/chats/grp:IT-21/messages", { text: `xabar ${i}` });
    const page1 = (await st.get("/edu/chats/grp:IT-21/messages")).data;
    expect(page1.messages).toHaveLength(50);
    expect(page1.hasMore).toBe(true);
    expect(page1.messages.at(-1).text).toBe("xabar 69");
    const page2 = (await st.get(`/edu/chats/grp:IT-21/messages?before=${page1.messages[0].seq}`)).data;
    expect(page2.messages.length).toBe(20);
    expect(page2.hasMore).toBe(false);
    expect(page2.messages[0].text).toBe("xabar 0");
  });

  it("bildirishnoma: suhbat bo'yicha bitta, ochilganda o'qiladi, sozlamada o'chirsa kelmaydi", async () => {
    const st = await login("student@tizims.ai", "student123");
    const t = await login("b.tursunov@iau.uz", "teacher123");
    const chatId = "dm:t-bekzod:u-ts-student";
    await st.post("/edu/chats/send", { to: ["t-bekzod"], text: "1" });
    await st.post(`/edu/chats/${chatId}/messages`, { text: "2" });
    await st.post(`/edu/chats/${chatId}/messages`, { text: "3" });
    expect(await unreadChatNotes(t, chatId)).toBe(1);
    await t.get(`/edu/chats/${chatId}/messages`);
    expect(await unreadChatNotes(t, chatId)).toBe(0);

    const prefs = (await t.get("/org/me/preferences")).data;
    expect(prefs.messages).toBe(true);
    expect((await t.put("/org/me/preferences", { ...prefs, messages: false })).status).toBe(200);
    await st.post(`/edu/chats/${chatId}/messages`, { text: "4" });
    expect(await unreadChatNotes(t, chatId)).toBe(0);
  });

  it("guruhda xodim boshqaning xabarini o'chira oladi (audit bilan), talaba — yo'q; shaxsiy suhbatda hech kim", async () => {
    const st = await login("student@tizims.ai", "student123");
    const teacher = await login("teacher@tizims.ai", "teacher123");
    const owner = await login("owner@tizims.ai", "owner123");
    const bad = (await st.post("/edu/chats/grp:IT-21/messages", { text: "nomaqbul xabar" })).data;
    const tm = (await teacher.post("/edu/chats/grp:IT-21/messages", { text: "o'qituvchi xabari" })).data;

    expect((await teacher.get("/edu/chats/grp:IT-21/messages")).data.canModerate).toBe(true);
    expect((await st.get("/edu/chats/grp:IT-21/messages")).data.canModerate).toBe(false);
    expect((await st.del(`/edu/chats/grp:IT-21/messages/${tm.id}`)).status).toBe(403);
    expect((await teacher.del(`/edu/chats/grp:IT-21/messages/${bad.id}`)).status).toBe(200);
    const after = (await st.get("/edu/chats/grp:IT-21/messages")).data.messages.find((m: { id: string }) => m.id === bad.id);
    expect(after).toMatchObject({ deleted: true, deletedBy: "moderator" });
    const audit = (await owner.get("/org/audit")).data as { object: string; oldValue?: string }[];
    expect(audit.some((a) => a.object === "ChatMessage" && a.oldValue === "nomaqbul xabar")).toBe(true);

    // Shaxsiy suhbatda moderatsiya yo'q
    const dep = await login("deputy@tizims.ai", "deputy123");
    const dm = (await st.post(`/edu/chats/${DM}/messages`, { text: "shaxsiy" })).data;
    expect((await dep.get(`/edu/chats/${DM}/messages`)).data.canModerate).toBe(false);
    expect((await dep.del(`/edu/chats/${DM}/messages/${dm.id}`)).status).toBe(403);
  });

  it("spam chegarasi: daqiqasiga 40 xabar, ko'p kishiga yuborish ham hisoblanadi", async () => {
    const st = await login("student@tizims.ai", "student123");
    for (let i = 0; i < 40; i++) expect((await st.post(`/edu/chats/${DM}/messages`, { text: `s${i}` })).status).toBe(201);
    const over = await st.post(`/edu/chats/${DM}/messages`, { text: "ortiqcha" });
    expect(over.status).toBe(429);
    chat.resetChatLimits();
    const many = await st.post("/edu/chats/send", { to: ["u-deputy", "t-bekzod", "t-kamola", "u5"], text: "x" });
    expect(many.status).toBe(201);
    for (let i = 0; i < 36; i++) await st.post(`/edu/chats/${DM}/messages`, { text: "y" });
    expect((await st.post(`/edu/chats/${DM}/messages`, { text: "z" })).status).toBe(429);
  });

  it("yuborilmay qolgan fayllar 24 soatdan keyin o'chiriladi, yuborilganlari qoladi", async () => {
    const st = await login("student@tizims.ai", "student123");
    const orphan = (await st.upload("tashlandi.pdf", new TextEncoder().encode("%PDF-1.4 a"))).data;
    const kept = (await st.upload("yuborildi.pdf", new TextEncoder().encode("%PDF-1.4 b"))).data;
    await st.post(`/edu/chats/${DM}/messages`, { text: "", attachments: [kept.id] });
    expect(chat.cleanupOrphanFiles(Date.now())).toBe(0); // hali yangi
    expect(chat.cleanupOrphanFiles(Date.now() + 25 * 3600_000)).toBeGreaterThanOrEqual(1);
    expect(await st.raw(`/edu/chats/files/${orphan.id}`)).toBe(404);
    expect(await st.raw(`/edu/chats/files/${kept.id}`)).toBe(200);
    expect(dbm.getDoc("550e8400-e29b-41d4-a716-446655440001", "chat_files", orphan.id)).toBeUndefined();
  });
});
