import { describe, expect, it } from "vitest";
import { TASKS } from "../data/seed";
import { assertSameTenant, can, filterTenant, ignoreClientOrganizationId, requireTenant } from "./tenant";
import { permissionsFor } from "./catalog";
import { ORG_IAU, ORG_SHOP } from "./ids";
import type { Role, Task } from "../types";
import type { TenantContext } from "./types";

const ctx = (organizationId: string, role: Role): TenantContext => ({
  userId: "u-test",
  organizationId,
  role,
  permissions: permissionsFor(role),
});

const shopTask: Task = { ...TASKS[0], id: "t-shop", organizationId: ORG_SHOP };
const all: Task[] = [...TASKS.map((t) => ({ ...t, organizationId: ORG_IAU })), shopTask];

describe("tenant isolation", () => {
  it("bir tashkilot boshqa tashkilot ma'lumotini ko'rmaydi", () => {
    const iau = filterTenant(all, ORG_IAU);
    const shop = filterTenant(all, ORG_SHOP);
    expect(iau.some((t) => t.id === "t-shop")).toBe(false);
    expect(shop.map((t) => t.id)).toEqual(["t-shop"]);
  });

  it("boshqa tenant resursi 'topilmadi' deb qaytadi", () => {
    const res = assertSameTenant(ctx(ORG_IAU, "rector"), shopTask);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("frontend yuborgan organizationId e'tiborga olinmaydi", () => {
    const stamped = ignoreClientOrganizationId({ title: "x", organizationId: ORG_SHOP }, ORG_IAU);
    expect(stamped.organizationId).toBe(ORG_IAU);
  });

  it("tenantsiz kontekst rad etiladi", () => {
    const res = requireTenant(null);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.code).toBe("NO_TENANT");
  });

  it("ruxsatlar rolga qarab beriladi", () => {
    expect(can(ctx(ORG_IAU, "student"), "edu.students.manage")).toBe(false);
    expect(can(ctx(ORG_IAU, "rector"), "edu.students.manage")).toBe(true);
    expect(can(ctx(ORG_IAU, "super_admin"), "core.org.manage")).toBe(true);
  });
});
