import { test, after } from "node:test";
import assert from "node:assert/strict";
import { call, json, db, seedSchool } from "./helpers.ts";

after(() => db.$client.end());

test("mobile: app-config, profile for student/teacher/parent, device tokens", async () => {
  const a = await seedSchool("mo");
  const B = `/api/v1/${a.school.slug}`;
  const pri = a.principal;
  const post = (path: string, body: unknown, h = pri) => call(`${B}${path}`, json(body, h));

  const cfg = (await (await call("/api/v1/app-config")).json()) as any;
  assert.ok(cfg.minVersion.teacher && cfg.minVersion.student);

  const g = (await (await post("/structure/grades", { name: "Grade 3" })).json()) as any;
  await post("/structure/sections", { gradeLevelId: g.id, name: "A" });
  await post("/structure/years", { name: "2026", current: true });
  await post("/import/students", { rows: [
    { admission_no: "K1", first_name: "Kid", last_name: "One", grade: "Grade 3", section: "A", guardian_name: "Parent", guardian_email: "p@example.com" },
    { admission_no: "K2", first_name: "Kid", last_name: "Two", grade: "Grade 3", section: "A", guardian_name: "Parent", guardian_email: "p@example.com" },
  ] });
  await post("/import/teachers", { rows: [{ employee_no: "T9", first_name: "Tee", last_name: "Cher" }] });

  const list = (await (await call(`${B}/people/students`, { headers: pri })).json()) as any;
  const guardians = (await (await call(`${B}/people/guardians`, { headers: pri })).json()) as any[];
  const teachers = (await (await call(`${B}/people/teachers`, { headers: pri })).json()) as any[];
  const login = async (kind: string, id: string, ident: string) => {
    const cred = (await (await post(`/people/${kind}/${id}/login`, {})).json()) as any;
    const r = await call(`${B}/login`, json({ identifier: ident, password: cred.password }));
    assert.equal(r.status, 200);
    return { authorization: `Bearer ${r.headers.get("set-auth-token")}` };
  };
  const stu = await login("students", list.rows.find((s: any) => s.admissionNo === "K1").id, "K1");
  const par = await login("guardians", guardians[0].id, "p@example.com");
  const tea = await login("teachers", teachers[0].id, "T9");

  const sp = (await (await call(`${B}/me/profile`, { headers: stu })).json()) as any;
  assert.equal(sp.student.admissionNo, "K1");
  assert.equal(sp.student.grade, "Grade 3");
  assert.deepEqual(sp.children, []);
  const pp = (await (await call(`${B}/me/profile`, { headers: par })).json()) as any;
  assert.deepEqual(pp.children.map((k: any) => k.admissionNo).sort(), ["K1", "K2"]); // child switcher data
  assert.equal(pp.student, null);
  const tp = (await (await call(`${B}/me/profile`, { headers: tea })).json()) as any;
  assert.equal(tp.teacher.employeeNo, "T9");
  assert.equal((await call(`${B}/me/profile`)).status, 401);

  // device tokens: validated, upserted, owned by the latest user, removable only by the owner
  const token = "ExponentPushToken[abcdefghijklmnop]";
  assert.equal((await post("/devices", { token: "nope", platform: "ios", app: "student" }, stu)).status, 400);
  assert.equal((await post("/devices", { token, platform: "ios", app: "student" }, stu)).status, 200);
  assert.equal((await post("/devices", { token, platform: "ios", app: "student" }, par)).status, 200); // same device, new user: no duplicate
  assert.equal((await call(`${B}/devices`, json({ token }, stu, "DELETE"))).status, 200); // not the owner: deletes nothing
  assert.equal((await call(`${B}/devices`, json({ token }, par, "DELETE"))).status, 200);
});
