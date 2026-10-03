import type { MiddlewareHandler } from "hono";

export type Role = "principal" | "admin" | "teacher" | "student" | "parent";

/** Roles allowed to create users, per role being created. Principal can create anyone. */
export const canCreate: Record<Role, Role[]> = {
  principal: ["principal"],
  admin: ["principal"],
  teacher: ["principal", "admin"],
  student: ["principal", "admin"],
  parent: ["principal", "admin"],
};

/** Allow if the caller holds any of `roles` in the current school. Requires the `tenant` and `session` middleware first. */
export const requireRole =
  (...roles: Role[]): MiddlewareHandler =>
  async (c, next) => {
    const mine: Role[] = c.get("roles");
    if (!mine.some((r) => roles.includes(r))) return c.json({ error: "forbidden" }, 403);
    await next();
  };
