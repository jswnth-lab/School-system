import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { connect, school, user, membership, auditLog, withTenant } from "@sms/db";
import { createAuth } from "./auth.ts";
import { requireRole, canCreate } from "./rbac.ts";
import { platform } from "./platform.ts";
import { session } from "./session.ts";
import { structure } from "./structure.ts";
import { people } from "./people.ts";
import { importer } from "./import.ts";
import { admin } from "./admin.ts";
import { emailFor, createCredentialUser } from "./users.ts";
import type { Env } from "./types.ts";

export const app = new Hono<Env>();

app.get("/api/v1/health", (c) => c.json({ ok: true }));

// One DB connection per request, closed after the response.
app.use("/api/*", async (c, next) => {
  const db = connect(c.env.DATABASE_URL);
  c.set("db", db);
  c.set("auth", createAuth(db, c.env, new URL(c.req.url).origin));
  await next();
  const close = db.$client.end();
  try { c.executionCtx.waitUntil(close); } catch { await close; } // no executionCtx outside Workers (tests)
});

// Identity is global (Better Auth); access is per school via membership. Registered before /:school, so "auth" is a reserved slug.
app.on(["GET", "POST"], "/api/v1/auth/*", (c) => c.get("auth").handler(c.req.raw));

app.route("/api/v1/platform", platform); // "platform" is a reserved slug

const tenant = new Hono<Env>();
tenant.use("*", async (c, next) => {
  const slug = c.req.param("school")!;
  const [s] = await c.get("db").select().from(school).where(eq(school.slug, slug));
  if (!s) return c.json({ error: "unknown school" }, 404);
  if (s.status === "suspended") return c.json({ error: "school_suspended" }, 403);
  c.set("school", s);
  c.set("schoolId", s.id);
  c.set("slug", s.slug);
  await next();
});

tenant.get("/config", (c) => {
  const s = c.get("school");
  return c.json({
    schoolId: s.id, slug: s.slug, name: s.name, locale: s.locale, primaryColor: s.primaryColor, features: s.features,
    logoUrl: s.logoKey ? `/api/v1/${s.slug}/logo` : null,
  });
});

tenant.get("/logo", async (c) => {
  const key = c.get("school").logoKey;
  const obj = key ? await c.env.FILES.get(key) : null;
  if (!obj) return c.json({ error: "no logo" }, 404);
  return new Response(obj.body, {
    headers: { "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream", "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" },
  });
});

tenant.post("/login", async (c) => {
  const body = z.object({ identifier: z.string().min(1), password: z.string().min(1) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid input" }, 400);
  const db = c.get("db");
  const email = emailFor(c.get("slug"), body.data.identifier);
  const [u] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  const member = u && (await withTenant(db, c.get("schoolId"), (tx) => tx.select().from(membership).where(eq(membership.userId, u.id)))).length > 0;
  if (!member) return c.json({ error: "invalid credentials" }, 401);
  const h = new Headers({ "content-type": "application/json" });
  for (const k of ["cookie", "origin", "user-agent", "cf-connecting-ip"]) if (c.req.header(k)) h.set(k, c.req.header(k)!);
  return c.get("auth").handler(
    new Request(new URL("/api/v1/auth/sign-in/email", c.req.url), { method: "POST", headers: h, body: JSON.stringify({ email, password: body.data.password }) }),
  );
});

tenant.get("/me", session, (c) => c.json({ userId: c.get("userId"), roles: c.get("roles") }));

const newUser = z
  .object({
    name: z.string().min(1).max(120),
    role: z.enum(["principal", "admin", "teacher", "student", "parent"]),
    email: z.string().email().optional(),
    username: z.string().regex(/^[a-z0-9._-]{3,32}$/).optional(),
    password: z.string().min(8).max(128),
  })
  .refine((v) => v.email || v.username, "email or username required");

tenant.post("/users", session, requireRole("principal", "admin"), async (c) => {
  const body = newUser.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid input", issues: body.error.issues }, 400);
  const { name, role, password } = body.data;
  if (!c.get("roles").some((r) => canCreate[role].includes(r))) return c.json({ error: "forbidden" }, 403);

  const email = emailFor(c.get("slug"), body.data.email ?? body.data.username!);
  const db = c.get("db");
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (existing) return c.json({ error: "user already exists" }, 409); // linking existing accounts needs an invite flow

  const u = await createCredentialUser(c.get("auth"), { email, name, password, verified: !!body.data.username });
  await withTenant(db, c.get("schoolId"), async (tx) => {
    await tx.insert(membership).values({ schoolId: c.get("schoolId"), userId: u.id, role });
    await tx.insert(auditLog).values({
      schoolId: c.get("schoolId"), actorUserId: c.get("userId"), action: "user.create", entity: "user", entityId: u.id, meta: { role },
    });
  });
  return c.json({ id: u.id, email, role }, 201);
});

tenant.route("/structure", structure);
tenant.route("/people", people);
tenant.route("/import", importer);
tenant.route("/", admin);
app.route("/api/v1/:school", tenant);
