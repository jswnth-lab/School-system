import type { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auditLog, withTenant } from "@sms/db";
import type { Env } from "./types.ts";
import { session } from "./session.ts";
import { requireRole } from "./rbac.ts";

type Opts = {
  path: string;
  entity: string;
  table: any; // drizzle table with id + schoolId
  create: z.ZodObject<any>;
  refs?: Record<string, any>; // body field -> parent table; verified to belong to this school (FK checks bypass RLS)
  orderBy?: any;
  after?: (tx: any, row: any, schoolId: string) => Promise<void>; // e.g. keep one "current" year
};

const pgCode = (e: any) => e?.code ?? e?.cause?.code;

/** list/create/update/delete for a tenant table. Any member reads; principal/admin writes; writes are audited. */
export function crud(r: Hono<Env>, o: Opts) {
  const write = [session, requireRole("principal", "admin")] as const;
  const fail = (c: any, e: unknown) => {
    if (pgCode(e) === "23505") return c.json({ error: "already exists" }, 409);
    throw e;
  };
  const checkRefs = async (tx: any, body: any) => {
    for (const [field, parent] of Object.entries(o.refs ?? {}))
      if (body[field] !== undefined && !(await tx.select({ id: parent.id }).from(parent).where(eq(parent.id, body[field]))).length) return field;
    return null; // RLS scopes these selects to the current school
  };
  const audit = (tx: any, c: any, action: string, id: string, meta?: unknown) =>
    tx.insert(auditLog).values({ schoolId: c.get("schoolId"), actorUserId: c.get("userId"), action: `${o.entity}.${action}`, entity: o.entity, entityId: id, meta });

  r.get(o.path, session, async (c) =>
    c.json(await withTenant(c.get("db"), c.get("schoolId"), (tx) => (o.orderBy ? tx.select().from(o.table).orderBy(o.orderBy) : tx.select().from(o.table)))),
  );

  r.post(o.path, ...write, async (c) => {
    const body = o.create.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "invalid input", issues: body.error.issues }, 400);
    try {
      return await withTenant(c.get("db"), c.get("schoolId"), async (tx) => {
        const bad = await checkRefs(tx, body.data);
        if (bad) return c.json({ error: `unknown ${bad}` }, 400);
        const [row] = await tx.insert(o.table).values({ ...body.data, schoolId: c.get("schoolId") }).returning();
        await o.after?.(tx, row, c.get("schoolId"));
        await audit(tx, c, "create", row.id);
        return c.json(row, 201);
      });
    } catch (e) { return fail(c, e); }
  });

  r.patch(`${o.path}/:id`, ...write, async (c) => {
    const body = o.create.partial().safeParse(await c.req.json().catch(() => null));
    if (!body.success || !Object.keys(body.data).length) return c.json({ error: "invalid input" }, 400);
    try {
      return await withTenant(c.get("db"), c.get("schoolId"), async (tx) => {
        const bad = await checkRefs(tx, body.data);
        if (bad) return c.json({ error: `unknown ${bad}` }, 400);
        const [row] = await tx.update(o.table).set(body.data).where(eq(o.table.id, c.req.param("id")!)).returning();
        if (!row) return c.json({ error: "not found" }, 404);
        await o.after?.(tx, row, c.get("schoolId"));
        await audit(tx, c, "update", row.id, body.data);
        return c.json(row);
      });
    } catch (e) { return fail(c, e); }
  });

  r.delete(`${o.path}/:id`, ...write, async (c) =>
    withTenant(c.get("db"), c.get("schoolId"), async (tx) => {
      const [row] = await tx.delete(o.table).where(eq(o.table.id, c.req.param("id")!)).returning({ id: o.table.id });
      if (!row) return c.json({ error: "not found" }, 404);
      await audit(tx, c, "delete", row.id);
      return c.json({ ok: true });
    }),
  );
}
