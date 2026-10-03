import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { connect, school, user, membership, auditLog, withTenant, type Db } from "@sms/db";
import { createAuth, type Auth, type Bindings } from "./auth.ts";
import { requireRole, canCreate, type Role } from "./rbac.ts";

type Env = {
  Bindings: Bindings;
  Variables: { db: Db; auth: Auth; schoolId: string; slug: string; userId: string; roles: Role[] };
};
export const app = new Hono<Env>();

// Students without email sign in with a username; stored as a synthetic address unique per school.
const emailFor = (slug: string, identifier: string) =>
  identifier.includes("@") ? identifier.toLowerCase() : `${identifier.toLowerCase()}@${slug}.users.invalid`;

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

const tenant = new Hono<Env>();
tenant.use("*", async (c, next) => {
  const slug = c.req.param("school")!;
  const [s] = await c.get("db").select().from(school).where(eq(school.slug, slug));
  if (!s) return c.json({ error: "unknown school" }, 404);
  c.set("schoolId", s.id);
  c.set("slug", s.slug);
  await next();
});

const session = async (c: any, next: any) => {
  const s = await c.get("auth").api.getSession({ headers: c.req.raw.headers });
  if (!s) return c.json({ error: "unauthenticated" }, 401);
  const rows = await withTenant(c.get("db"), c.get("schoolId"), (tx) =>
    tx.select({ role: membership.role }).from(membership).where(eq(membership.userId, s.user.id)),
  );
  if (!rows.length) return c.json({ error: "forbidden" }, 403); // valid session, but not a member of this school
  c.set("userId", s.user.id);
  c.set("roles", rows.map((r) => r.role));
  await next();
};

tenant.get("/config", (c) => c.json({ schoolId: c.get("schoolId"), slug: c.get("slug") })); // branding goes here

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

  const ctx = await c.get("auth").$context;
  const u = await ctx.internalAdapter.createUser({ email, name, emailVerified: !!body.data.username }, { method: "admin" });
  await ctx.internalAdapter.linkAccount({ userId: u.id, providerId: "credential", accountId: u.id, password: await ctx.password.hash(password) });
  await withTenant(db, c.get("schoolId"), async (tx) => {
    await tx.insert(membership).values({ schoolId: c.get("schoolId"), userId: u.id, role });
    await tx.insert(auditLog).values({
      schoolId: c.get("schoolId"), actorUserId: c.get("userId"), action: "user.create", entity: "user", entityId: u.id, meta: { role },
    });
  });
  return c.json({ id: u.id, email, role }, 201);
});

app.route("/api/v1/:school", tenant);
