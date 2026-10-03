import { test, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { connect, school, membership, auditLog, withTenant } from "@sms/db";
import { app } from "../src/app.ts";
import { createAuth } from "../src/auth.ts";

// Needs DATABASE_URL (app_user, no BYPASSRLS) and BETTER_AUTH_SECRET in .dev.vars. Leaves rows with slug "test-*"; clean via owner role.
const env = { DATABASE_URL: process.env.DATABASE_URL!, BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "test-secret-test-secret-test-secret-123", FILES: {} as any };
const db = connect(env.DATABASE_URL);
after(() => db.$client.end());

const t = Date.now();
const call = (path: string, init: RequestInit = {}) => app.request(path, init, env);
const json = (body: unknown, extra: Record<string, string> = {}): RequestInit => ({
  method: "POST", headers: { "content-type": "application/json", ...extra }, body: JSON.stringify(body),
});

async function seedUser(schoolId: string, slug: string, role: any, name: string) {
  const auth = createAuth(db, env, "http://localhost");
  const ctx = await auth.$context;
  const email = `${name}-${t}@${slug}.users.invalid`;
  const u = await ctx.internalAdapter.createUser({ email, name, emailVerified: true }, { method: "admin" });
  await ctx.internalAdapter.linkAccount({ userId: u.id, providerId: "credential", accountId: u.id, password: await ctx.password.hash("password123") });
  await withTenant(db, schoolId, (tx) => tx.insert(membership).values({ schoolId, userId: u.id, role }));
  return email;
}

async function login(slug: string, identifier: string) {
  const r = await call(`/api/v1/${slug}/login`, json({ identifier, password: "password123" }));
  return { r, token: r.headers.get("set-auth-token") };
}

test("auth + RBAC + tenant boundary", async () => {
  const [a, b] = await db.insert(school).values([
    { slug: `test-a-${t}`, name: "A" }, { slug: `test-b-${t}`, name: "B" },
  ]).returning();
  const principal = await seedUser(a.id, a.slug, "principal", "pri");
  const teacher = await seedUser(a.id, a.slug, "teacher", "tea");

  // no session
  assert.equal((await call(`/api/v1/${a.slug}/me`)).status, 401);
  // wrong password
  assert.equal((await call(`/api/v1/${a.slug}/login`, json({ identifier: principal, password: "nope" }))).status, 401);

  const p = await login(a.slug, principal);
  assert.equal(p.r.status, 200);
  assert.ok(p.token, "bearer token returned for mobile");
  const pAuth = { authorization: `Bearer ${p.token}` };
  const me = await (await call(`/api/v1/${a.slug}/me`, { headers: pAuth })).json() as any;
  assert.deepEqual(me.roles, ["principal"]);

  // cross-school: valid session, no membership in B -> 403; and login to B fails
  assert.equal((await call(`/api/v1/${b.slug}/me`, { headers: pAuth })).status, 403);
  assert.equal((await call(`/api/v1/${b.slug}/login`, json({ identifier: principal, password: "password123" }))).status, 401);

  // teacher cannot create users
  const tt = await login(a.slug, teacher);
  assert.equal(tt.r.status, 200);
  const tAuth = { authorization: `Bearer ${tt.token}` };
  assert.equal((await call(`/api/v1/${a.slug}/users`, json({ name: "S", role: "student", username: "stu.one", password: "password123" }, tAuth))).status, 403);

  // principal creates a username-only student (idempotency: second create is 409), student can log in, audit row written
  const create = await call(`/api/v1/${a.slug}/users`, json({ name: "Stu", role: "student", username: `stu${t}`, password: "password123" }, pAuth));
  assert.equal(create.status, 201);
  assert.equal((await call(`/api/v1/${a.slug}/users`, json({ name: "Stu", role: "student", username: `stu${t}`, password: "password123" }, pAuth))).status, 409);
  assert.equal((await login(a.slug, `stu${t}`)).r.status, 200);
  const audit = await withTenant(db, a.id, (tx) => tx.select().from(auditLog).where(eq(auditLog.action, "user.create")));
  assert.equal(audit.length, 1);
  // other school sees none of A's audit rows; audit is append-only
  assert.equal((await withTenant(db, b.id, (tx) => tx.select().from(auditLog))).length, 0);
  await withTenant(db, a.id, (tx) => tx.delete(auditLog)); // no delete policy: affects 0 rows
  assert.equal((await withTenant(db, a.id, (tx) => tx.select().from(auditLog))).length, 1);
});
