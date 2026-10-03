import { test, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { auditLog, school, withTenant } from "@sms/db";
import { call, json, db, makePlatformAdmin, bearerFor } from "./helpers.ts";

// Leaves rows with slug "test-*"; clean via owner role.
after(() => db.$client.end());
const t = Date.now();

test("platform console: create, suspend, branding, impersonation", async () => {
  const adminEmail = `plat-${t}@platform.users.invalid`;
  await makePlatformAdmin(adminEmail, "platform-pass-123");
  const admin = await bearerFor(adminEmail, "platform-pass-123");
  const newSchool = { slug: `test-p-${t}`, name: "Platform School", principal: { name: "Pri", email: `pri-${t}@test.users.invalid`, password: "password123" } };

  assert.equal((await call("/api/v1/platform/schools")).status, 401);
  assert.equal((await call("/api/v1/platform/schools", json(newSchool, { authorization: "Bearer nope" }))).status, 401);

  assert.equal((await call("/api/v1/platform/schools", json({ ...newSchool, slug: "platform" }, admin))).status, 400); // reserved
  const created = await call("/api/v1/platform/schools", json(newSchool, admin));
  assert.equal(created.status, 201);
  const { id } = (await created.json()) as { id: string };
  assert.equal((await call("/api/v1/platform/schools", json({ ...newSchool, principal: { ...newSchool.principal, email: "x@test.users.invalid" } }, admin))).status, 409); // slug taken

  // the new principal logs in, but is not a platform admin
  const login = await call(`/api/v1/${newSchool.slug}/login`, json({ identifier: newSchool.principal.email, password: "password123" }));
  assert.equal(login.status, 200);
  const pri = { authorization: `Bearer ${login.headers.get("set-auth-token")}` };
  assert.equal((await call("/api/v1/platform/schools", { headers: pri })).status, 403);

  // suspend blocks the school, unsuspend restores it
  assert.equal((await call(`/api/v1/platform/schools/${id}`, json({ status: "suspended" }, admin, "PATCH"))).status, 200);
  const cfg = await call(`/api/v1/${newSchool.slug}/config`);
  assert.equal(cfg.status, 403);
  assert.equal(((await cfg.json()) as any).error, "school_suspended");
  assert.equal((await call(`/api/v1/platform/schools/${id}`, json({ status: "active", primaryColor: "#112233", features: { chat: true } }, admin, "PATCH"))).status, 200);
  assert.equal((await call(`/api/v1/platform/schools/${id}`, json({ planId: "nope" }, admin, "PATCH"))).status, 400);

  // branding: logo type/size checks, upload, public fetch
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  assert.equal((await call(`/api/v1/platform/schools/${id}/logo`, { method: "PUT", headers: { ...admin, "content-type": "image/svg+xml" }, body: png })).status, 415);
  assert.equal((await call(`/api/v1/platform/schools/${id}/logo`, { method: "PUT", headers: { ...admin, "content-type": "image/png" }, body: png })).status, 200);
  const conf = (await (await call(`/api/v1/${newSchool.slug}/config`)).json()) as any;
  assert.equal(conf.primaryColor, "#112233");
  assert.equal(conf.logoUrl, `/api/v1/${newSchool.slug}/logo`);
  const logo = await call(conf.logoUrl);
  assert.equal(logo.headers.get("content-type"), "image/png");
  assert.equal((await logo.arrayBuffer()).byteLength, png.length);

  // impersonation: admin acts as principal in the school, writes are audited
  const me = (await (await call(`/api/v1/${newSchool.slug}/me`, { headers: admin })).json()) as any;
  assert.deepEqual(me.roles, ["principal"]);
  const mk = await call(`/api/v1/${newSchool.slug}/users`, json({ name: "T", role: "teacher", username: `tea${t}`, password: "password123" }, admin));
  assert.equal(mk.status, 201);
  const rows = await withTenant(db, id, (tx) => tx.select().from(auditLog).where(eq(auditLog.action, "impersonation.write")));
  assert.equal(rows.length, 1);
  assert.equal(((rows[0].meta as any).status), 201);

  assert.ok((await db.select().from(school).where(eq(school.id, id))).length === 1);
});
