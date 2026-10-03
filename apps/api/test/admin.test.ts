import { test, after } from "node:test";
import assert from "node:assert/strict";
import { call, json, db, seedSchool } from "./helpers.ts";

after(() => db.$client.end());

test("branding, rooms, users, password reset, audit", async () => {
  const a = await seedSchool("ad");
  const B = `/api/v1/${a.school.slug}`;
  const pri = a.principal;
  const send = (path: string, body: unknown, h = pri, method = "POST") => call(`${B}${path}`, json(body, h, method));

  // branding: validation, role gate, reflected in public config
  assert.equal((await send("/branding", { primaryColor: "red" }, pri, "PATCH")).status, 400);
  assert.equal((await send("/branding", { locale: "xx" }, pri, "PATCH")).status, 400);
  assert.equal((await send("/branding", { primaryColor: "#0a7d5a" }, a.teacher, "PATCH")).status, 403);
  assert.equal((await send("/branding", { name: "Green Valley", primaryColor: "#0a7d5a", locale: "ar" }, pri, "PATCH")).status, 200);
  const cfg = (await (await call(`${B}/config`)).json()) as any;
  assert.deepEqual([cfg.name, cfg.primaryColor, cfg.locale], ["Green Valley", "#0a7d5a", "ar"]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9]);
  assert.equal((await call(`${B}/branding/logo`, { method: "PUT", headers: { ...a.teacher, "content-type": "image/png" }, body: png })).status, 403);
  assert.equal((await call(`${B}/branding/logo`, { method: "PUT", headers: { ...pri, "content-type": "image/png" }, body: png })).status, 200);

  // rooms
  assert.equal((await send("/structure/rooms", { name: "Lab 1", capacity: 30 })).status, 201);
  assert.equal((await send("/structure/rooms", { name: "Lab 1" })).status, 409);
  assert.equal(((await (await call(`${B}/structure/rooms`, { headers: a.teacher })).json()) as any[]).length, 1);

  // users: create an admin, list, only principals can revoke
  const mk = await send("/users", { name: "Ann Admin", role: "admin", username: "ann", password: "password123" });
  assert.equal(mk.status, 201);
  const adminId = ((await mk.json()) as any).id;
  const users = (await (await call(`${B}/users`, { headers: pri })).json()) as any[];
  assert.deepEqual(users.map((u) => u.name).sort(), ["Ann Admin", "principal", "teacher"]);
  assert.equal(users.find((u) => u.name === "Ann Admin").identifier, "ann");
  assert.equal((await call(`${B}/users`, { headers: a.teacher })).status, 403);
  const annLogin = await call(`${B}/login`, json({ identifier: "ann", password: "password123" }));
  const ann = { authorization: `Bearer ${annLogin.headers.get("set-auth-token")}` };
  assert.equal((await call(`${B}/users/${adminId}`, { method: "DELETE", headers: ann })).status, 403);
  const me = (await (await call(`${B}/me`, { headers: pri })).json()) as any;
  assert.equal((await call(`${B}/users/${me.userId}`, { method: "DELETE", headers: pri })).status, 409); // not yourself
  assert.equal((await call(`${B}/users/${adminId}`, { method: "DELETE", headers: pri })).status, 200);
  assert.equal((await call(`${B}/me`, { headers: ann })).status, 403); // access gone immediately

  // provision then reset a student login
  assert.equal((await send("/people/students", { admissionNo: "R1", firstName: "Re", lastName: "Set" })).status, 201);
  const stu = ((await (await call(`${B}/people/students`, { headers: pri })).json()) as any).rows[0];
  const cred = (await (await send(`/people/students/${stu.id}/login`, {})).json()) as any;
  assert.equal((await call(`${B}/people/students/${stu.id}/reset-password`, json({}, a.teacher))).status, 403);
  const reset = await send(`/people/students/${stu.id}/reset-password`, {});
  assert.equal(reset.status, 200);
  const next = ((await reset.json()) as any).password;
  assert.notEqual(next, cred.password);
  assert.equal((await call(`${B}/login`, json({ identifier: "R1", password: cred.password }))).status, 401);
  assert.equal((await call(`${B}/login`, json({ identifier: "R1", password: next }))).status, 200);

  // audit trail
  assert.equal((await call(`${B}/audit`, { headers: a.teacher })).status, 403);
  const audit = (await (await call(`${B}/audit?action=user`, { headers: pri })).json()) as any[];
  assert.ok(audit.some((r) => r.action === "user.revoke"));
  assert.ok(audit.every((r) => r.action.startsWith("user")));
  const all = (await (await call(`${B}/audit`, { headers: pri })).json()) as any[];
  assert.ok(all.some((r) => r.action === "login.reset"));
  assert.ok(all.some((r) => r.action === "school.branding"));
});
