import { describe, expect, it } from "vitest";
import { EDU_ONLY_ROLES, eduRouteAllowed, permissionsFor } from "./catalog";
import { MEMBERSHIPS } from "./seed";
import { USERS } from "../data/seed";

describe("ta'lim rollari — kirish cheklovi", () => {
  it("talaba boshqaruv sahifalariga kira olmaydi", () => {
    expect(eduRouteAllowed("student", "/")).toBe(true);
    expect(eduRouteAllowed("student", "/employees")).toBe(false);
    expect(eduRouteAllowed("student", "/tasks")).toBe(false);
    expect(eduRouteAllowed("parent", "/journals/k-buyruqlar")).toBe(false);
  });

  it("o'qituvchi faqat dashboard va vazifalarga kira oladi", () => {
    expect(eduRouteAllowed("teacher", "/tasks")).toBe(true);
    expect(eduRouteAllowed("teacher", "/calendar")).toBe(false);
    expect(eduRouteAllowed("teacher", "/employees/e1")).toBe(false);
  });

  it("boshqa rollar cheklanmaydi", () => {
    expect(eduRouteAllowed("rector", "/employees")).toBe(true);
  });

  it("kabinet rollarida boshqaruv ruxsatlari yo'q", () => {
    for (const r of EDU_ONLY_ROLES) {
      expect(permissionsFor(r).some((p) => p.startsWith("core.org") || p === "core.audit.view" || p === "platform.admin")).toBe(false);
    }
  });

  it("har bir demo akkaunt faol a'zolikka ega", () => {
    const demo = USERS.filter((u) => u.email.endsWith("@tizims.ai"));
    expect(demo.length).toBe(6);
    for (const u of demo) {
      expect(MEMBERSHIPS.some((m) => m.userId === u.id && m.status === "active")).toBe(true);
    }
  });
});

import { taskVisibleTo } from "../store/AppContext";
import { TASKS } from "../data/seed";

describe("vazifalar — ko'rinish chegarasi", () => {
  it("o'qituvchi faqat o'ziga tegishli vazifalarni ko'radi", () => {
    const teacher = { id: "u-ts-teacher", role: "teacher" as const };
    const visible = TASKS.filter((t) => taskVisibleTo(t, teacher)).map((t) => t.id);
    expect(visible.sort()).toEqual(["t2", "t3"]);
  });

  it("rektor barcha vazifalarni ko'radi", () => {
    const rector = { id: "u3", role: "rector" as const };
    expect(TASKS.every((t) => taskVisibleTo(t, rector))).toBe(true);
  });

  it("talaba begona vazifani ko'rmaydi", () => {
    expect(TASKS.some((t) => taskVisibleTo(t, { id: "u-ts-student", role: "student" }))).toBe(false);
  });
});

import { FEATURES, accessOf } from "./features";

describe("ta'lim modullari — rollar bo'yicha kirish", () => {
  it("talaba o'z kabinet modullariga kiradi, boshqaruvga kira olmaydi", () => {
    for (const p of ["/timetable", "/attendance", "/grades", "/lms", "/messages", "/complaints", "/insights"]) {
      expect(eduRouteAllowed("student", p)).toBe(true);
    }
    for (const p of ["/people", "/structure", "/roles", "/academic", "/tasks"]) {
      expect(eduRouteAllowed("student", p)).toBe(false);
    }
  });

  it("ota-ona LMS va boshqaruv modullarini ko'rmaydi", () => {
    expect(eduRouteAllowed("parent", "/grades")).toBe(true);
    expect(eduRouteAllowed("parent", "/lms")).toBe(false);
    expect(eduRouteAllowed("parent", "/people")).toBe(false);
  });

  it("o'qituvchi davomat va baholarni boshqaradi, talabalar bazasi yopiq", () => {
    expect(accessOf("teacher", "attendance")).toBe("manage");
    expect(accessOf("teacher", "grades")).toBe("manage");
    expect(accessOf("teacher", "academic")).toBe("own");
    expect(eduRouteAllowed("teacher", "/people")).toBe(false);
    expect(eduRouteAllowed("teacher", "/roles")).toBe(false);
  });

  it("rahbariyat baholarni faqat ko'radi — baho qo'ya olmaydi", () => {
    for (const r of ["rector", "owner", "dept_head"]) expect(accessOf(r, "grades")).toBe("view");
  });

  it("rollar matritsasini faqat ega va super admin o'zgartiradi", () => {
    expect(accessOf("owner", "roles")).toBe("manage");
    expect(accessOf("super_admin", "roles")).toBe("manage");
    expect(accessOf("rector", "roles")).toBe("view");
    expect(accessOf("dept_head", "roles")).toBeNull();
  });

  it("do'kon menejeri ta'lim modullariga kira olmaydi", () => {
    expect(FEATURES.some((f) => f.access.manager)).toBe(false);
  });
});

describe("super admin — faqat platforma darajasi", () => {
  it("tashkilot ichki modullariga kira olmaydi", () => {
    for (const p of ["/grades", "/attendance", "/messages", "/complaints", "/people", "/tasks", "/audit", "/organization"]) {
      expect(eduRouteAllowed("super_admin", p)).toBe(false);
    }
  });

  it("platforma bo'limlariga kiradi", () => {
    for (const p of ["/", "/platform/tenants", "/platform/billing", "/platform/support", "/platform/monitoring", "/platform/audit", "/system", "/roles"]) {
      expect(eduRouteAllowed("super_admin", p)).toBe(true);
    }
  });

  it("ta'lim modullarida super admin uchun kirish yo'q (rol shablonlaridan tashqari)", () => {
    expect(FEATURES.filter((f) => f.access.super_admin).map((f) => f.key)).toEqual(["roles"]);
  });
});
