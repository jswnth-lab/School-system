import { test, after } from "node:test";
import assert from "node:assert/strict";
import { gradeLevel, withTenant } from "@sms/db";
import { call, json, db, seedSchool } from "./helpers.ts";

after(() => db.$client.end());

test("academic structure CRUD, RBAC, tenant-safe references", async () => {
  const a = await seedSchool("sa");
  const b = await seedSchool("sb");
  const base = `/api/v1/${a.school.slug}/structure`;

  assert.equal((await call(`${base}/grades`)).status, 401);
  // teacher reads, cannot write
  assert.equal((await call(`${base}/grades`, { headers: a.teacher })).status, 200);
  assert.equal((await call(`${base}/grades`, json({ name: "G1" }, a.teacher))).status, 403);
  // other school's principal has no access here
  assert.equal((await call(`${base}/grades`, { headers: b.principal })).status, 403);

  const g = await call(`${base}/grades`, json({ name: "Grade 1", position: 1 }, a.principal));
  assert.equal(g.status, 201);
  const grade = (await g.json()) as any;
  assert.equal((await call(`${base}/grades`, json({ name: "Grade 1" }, a.principal))).status, 409);
  assert.equal((await call(`${base}/sections`, json({ gradeLevelId: grade.id, name: "A" }, a.principal))).status, 201);

  // FK injection: a grade id that belongs to school B must be rejected in school A
  const [foreign] = await withTenant(db, b.school.id, (tx) => tx.insert(gradeLevel).values({ schoolId: b.school.id, name: "Foreign" }).returning());
  assert.equal((await call(`${base}/sections`, json({ gradeLevelId: foreign.id, name: "X" }, a.principal))).status, 400);

  // years: only one current
  const y1 = (await (await call(`${base}/years`, json({ name: "2026", current: true }, a.principal))).json()) as any;
  const y2 = (await (await call(`${base}/years`, json({ name: "2027", current: true }, a.principal))).json()) as any;
  const years = (await (await call(`${base}/years`, { headers: a.principal })).json()) as any[];
  assert.deepEqual(years.filter((y) => y.current).map((y) => y.id), [y2.id]);
  assert.equal((await call(`${base}/terms`, json({ academicYearId: y1.id, name: "Term 1", startDate: "2026-01-05", endDate: "2026-04-01" }, a.principal))).status, 201);
  assert.equal((await call(`${base}/terms`, json({ academicYearId: y1.id, name: "T", startDate: "not-a-date" }, a.principal))).status, 400);

  // update + delete + isolation
  assert.equal((await call(`${base}/subjects`, json({ name: "Math", code: "MTH" }, a.principal))).status, 201);
  const subs = (await (await call(`${base}/subjects`, { headers: a.principal })).json()) as any[];
  assert.equal((await call(`${base}/subjects/${subs[0].id}`, json({ code: "M1" }, a.principal, "PATCH"))).status, 200);
  assert.equal((await (await call(`/api/v1/${b.school.slug}/structure/subjects`, { headers: b.principal })).json() as any[]).length, 0);
  assert.equal((await call(`${base}/subjects/${subs[0].id}`, { method: "DELETE", headers: a.principal })).status, 200);
  assert.equal((await call(`${base}/subjects/${subs[0].id}`, { method: "DELETE", headers: a.principal })).status, 404);
});
