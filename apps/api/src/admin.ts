import { Hono } from "hono";
import { and, desc, eq, ilike, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { school, user, membership, student, teacher, guardian, auditLog, withTenant } from "@sms/db";
import type { Env } from "./types.ts";
import { session } from "./session.ts";
import { requireRole } from "./rbac.ts";
import { uploadLogo } from "./logo.ts";

export const admin = new Hono<Env>();
const staff = [session, requireRole("principal", "admin")] as const;

// Branding is editable by the school itself; status, plan and feature flags stay platform-only.
admin.patch("/branding", ...staff, async (c) => {
  const body = z.object({
    name: z.string().trim().min(1).max(120).optional(),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
    locale: z.enum(["en", "ar", "hi"]).optional(),
  }).safeParse(await c.req.json().catch(() => null));
  if (!body.success || !Object.keys(body.data).length) return c.json({ error: "invalid input" }, 400);
  const id = c.get("schoolId");
  await c.get("db").update(school).set(body.data).where(eq(school.id, id));
  await withTenant(c.get("db"), id, (tx) =>
    tx.insert(auditLog).values({ schoolId: id, actorUserId: c.get("userId"), action: "school.branding", entity: "school", entityId: id, meta: body.data }),
  );
  return c.json({ ok: true });
});
admin.put("/branding/logo", ...staff, (c) => uploadLogo(c, c.get("schoolId")));

// Everyone with access to this school, grouped by user.
admin.get("/users", ...staff, async (c) => {
  const rows = await withTenant(c.get("db"), c.get("schoolId"), (tx) =>
    tx.select({ userId: membership.userId, role: membership.role, name: user.name, email: user.email })
      .from(membership).innerJoin(user, eq(user.id, membership.userId)),
  );
  const by = new Map<string, { userId: string; name: string; identifier: string; roles: string[] }>();
  for (const r of rows) {
    const u = by.get(r.userId) ?? { userId: r.userId, name: r.name, identifier: r.email.replace(/@[^@]+\.users\.invalid$/, ""), roles: [] };
    u.roles.push(r.role); by.set(r.userId, u);
  }
  return c.json([...by.values()].sort((a, b) => a.name.localeCompare(b.name)));
});

// Revoke a user's access to this school (their account and other schools are untouched).
admin.delete("/users/:userId", session, requireRole("principal"), async (c) => {
  const target = c.req.param("userId")!;
  if (target === c.get("userId")) return c.json({ error: "you cannot remove yourself" }, 409);
  const schoolId = c.get("schoolId");
  return withTenant(c.get("db"), schoolId, async (tx) => {
    const mine = await tx.select({ role: membership.role }).from(membership).where(eq(membership.userId, target));
    if (!mine.length) return c.json({ error: "not found" }, 404);
    if (mine.some((m) => m.role === "principal")) {
      const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(membership).where(and(eq(membership.role, "principal"), ne(membership.userId, target)));
      if (!n) return c.json({ error: "a school needs at least one principal" }, 409);
    }
    await tx.delete(membership).where(eq(membership.userId, target));
    for (const t of [student, teacher, guardian]) await tx.update(t).set({ userId: null }).where(eq(t.userId, target));
    await tx.insert(auditLog).values({ schoolId, actorUserId: c.get("userId"), action: "user.revoke", entity: "user", entityId: target, meta: { roles: mine.map((m) => m.role) } });
    return c.json({ ok: true });
  });
});

admin.get("/audit", ...staff, async (c) => {
  const limit = Math.min(Number(c.req.query("limit")) || 50, 200);
  const offset = Math.max(Number(c.req.query("offset")) || 0, 0);
  const action = c.req.query("action")?.trim();
  const rows = await withTenant(c.get("db"), c.get("schoolId"), (tx) =>
    tx.select({
      id: auditLog.id, action: auditLog.action, entity: auditLog.entity, entityId: auditLog.entityId, meta: auditLog.meta,
      createdAt: auditLog.createdAt, actor: user.name,
    }).from(auditLog).leftJoin(user, eq(user.id, auditLog.actorUserId))
      .where(action ? ilike(auditLog.action, `${action}%`) : undefined)
      .orderBy(desc(auditLog.createdAt)).limit(limit).offset(offset),
  );
  return c.json(rows);
});
