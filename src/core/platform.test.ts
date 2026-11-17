import { describe, expect, it } from "vitest";
import { eduRouteAllowed } from "./catalog";
import { upcomingMaintenance } from "../lib/maintenance";
import { churnScore, type Maintenance } from "../data/platform";

describe("super admin — yangi platforma bo'limlari", () => {
  it("barcha platforma sahifalariga kiradi", () => {
    for (const p of ["/platform/growth", "/platform/announcements", "/platform/releases", "/platform/team", "/platform/data"]) {
      expect(eduRouteAllowed("super_admin", p)).toBe(true);
    }
  });

  it("tashkilot rollari platforma sahifalariga kira olmaydi", () => {
    for (const r of ["teacher", "student", "parent", "advisor"]) {
      expect(eduRouteAllowed(r, "/platform/team")).toBe(false);
      expect(eduRouteAllowed(r, "/platform/billing")).toBe(false);
    }
  });
});

describe("texnik ishlar ogohlantirishi", () => {
  const now = new Date("2026-11-17T10:00");
  const m = (id: string, start: string, end: string, status: Maintenance["status"] = "scheduled"): Maintenance => ({ id, title: id, start, end, services: [], status });

  it("7 kun ichidagi eng yaqin ishni ko'rsatadi", () => {
    const list = [m("later", "2026-11-23T02:00", "2026-11-23T03:00"), m("soon", "2026-11-20T02:00", "2026-11-20T03:00")];
    expect(upcomingMaintenance(list, now)?.id).toBe("soon");
  });

  it("uzoq, tugagan yoki bekor qilingan ishni ko'rsatmaydi", () => {
    expect(upcomingMaintenance([m("far", "2026-12-20T02:00", "2026-12-20T03:00")], now)).toBeUndefined();
    expect(upcomingMaintenance([m("past", "2026-11-10T02:00", "2026-11-10T03:00")], now)).toBeUndefined();
    expect(upcomingMaintenance([m("c", "2026-11-18T02:00", "2026-11-18T03:00", "cancelled")], now)).toBeUndefined();
  });

  it("davom etayotgan ishni ko'rsatadi", () => {
    expect(upcomingMaintenance([m("now", "2026-11-17T09:00", "2026-11-17T11:00", "in_progress")], now)?.id).toBe("now");
  });
});

describe("mijozni yo'qotish xavfi", () => {
  it("faol, qarzsiz mijoz — past xavf; nofaol qarzdor — yuqori", () => {
    expect(churnScore({ activityTrend: 6, tickets: 0, overdueDays: 0 })).toBeLessThan(20);
    expect(churnScore({ activityTrend: -100, tickets: 0, overdueDays: 64 })).toBeGreaterThanOrEqual(50);
  });
});
