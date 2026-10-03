import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { school, plan, user, membership, auditLog, withTenant } from "@sms/db";
import type { Env } from "./types.ts";
import { createCredentialUser } from "./users.ts";
import { uploadLogo } from "./logo.ts";

export const RESERVED_SLUGS = ["auth", "health", "platform", "api", "www", "admin", "app", "static", "assets", "login", "logo"];
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/).refine((v) => !RESERVED_SLUGS.includes(v), "reserved slug");
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const platform = new Hono<Env>();

platform.use("*", async (c, next) => {
  const s = await c.get("auth").api.getSession({ headers: c.req.raw.headers });
  if (!s) return c.json({ error: "unauthenticated" }, 401);
  if (!(s.user as any).platformAdmin) return c.json({ error: "forbidden" }, 403);
  c.set("userId", s.user.id);
  await next();
});

platform.get("/plans", async (c) => c.json(await c.get("db").select().from(plan)));

platform.get("/schools", async (c) =>
  c.json(await c.get("db").select({ id: school.id, slug: school.slug, name: school.name, status: school.status, planId: school.planId, createdAt: school.createdAt }).from(school)),
);

const createSchool = z.object({
  slug,
  name: z.string().min(1).max(120),
  principal: z.object({ name: z.string().min(1).max(120), email: z.string().email(), password: z.string().min(8).max(128) }),
});

platform.post("/schools", async (c) => {
  const body = createSchool.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid input", issues: body.error.issues }, 400);
  const { principal } = body.data;
  const db = c.get("db");
  const email = principal.email.toLowerCase();
  if ((await db.select({ id: user.id }).from(user).where(eq(user.email, email))).length) return c.json({ error: "principal email already in use" }, 409);
  const [s] = await db.insert(school).values({ slug: body.data.slug, name: body.data.name }).onConflictDoNothing().returning();
  if (!s) return c.json({ error: "slug taken" }, 409);
  const u = await createCredentialUser(c.get("auth"), { email, name: principal.name, password: principal.password, verified: true });
  await withTenant(db, s.id, async (tx) => {
    await tx.insert(membership).values({ schoolId: s.id, userId: u.id, role: "principal" });
    await tx.insert(auditLog).values({ schoolId: s.id, actorUserId: c.get("userId"), action: "school.create", entity: "school", entityId: s.id, meta: { principalUserId: u.id } });
  });
  return c.json({ id: s.id, slug: s.slug, principalUserId: u.id }, 201);
});

const patchSchool = z.object({
  name: z.string().min(1).max(120).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  planId: z.string().optional(),
  primaryColor: hex.nullable().optional(),
  locale: z.string().min(2).max(10).optional(),
  features: z.record(z.string(), z.boolean()).optional(),
});

platform.patch("/schools/:id", async (c) => {
  const body = patchSchool.safeParse(await c.req.json().catch(() => null));
  if (!body.success || !Object.keys(body.data).length) return c.json({ error: "invalid input" }, 400);
  const db = c.get("db");
  if (body.data.planId && !(await db.select().from(plan).where(eq(plan.id, body.data.planId))).length) return c.json({ error: "unknown plan" }, 400);
  const [s] = await db.update(school).set(body.data).where(eq(school.id, c.req.param("id")!)).returning();
  if (!s) return c.json({ error: "not found" }, 404);
  await withTenant(db, s.id, (tx) =>
    tx.insert(auditLog).values({ schoolId: s.id, actorUserId: c.get("userId"), action: "school.update", entity: "school", entityId: s.id, meta: body.data }),
  );
  return c.json({ id: s.id, status: s.status, planId: s.planId });
});

platform.put("/schools/:id/logo", (c) => uploadLogo(c, c.req.param("id")!));
