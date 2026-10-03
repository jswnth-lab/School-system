import { test, after } from "node:test";
import assert from "node:assert/strict";
import { call, json, db, seedSchool } from "./helpers.ts";

after(() => db.$client.end());

test("people, CSV import, logins", async () => {
  const a = await seedSchool("pa");
  const b = await seedSchool("pb");
  const S = `/api/v1/${a.school.slug}/structure`, P = `/api/v1/${a.school.slug}/people`, I = `/api/v1/${a.school.slug}/import`;
  const pri = a.principal;
  const post = (path: string, body: unknown, h = pri) => call(path, json(body, h));

  // structure the import resolves against
  const grade = (await (await post(`${S}/grades`, { name: "Grade 5" })).json()) as any;
  assert.equal((await post(`${S}/sections`, { gradeLevelId: grade.id, name: "A" })).status, 201);
  const noYear = await post(`${I}/students`, { dryRun: true, rows: [{ admission_no: "1", first_name: "A", last_name: "B", grade: "Grade 5", section: "A" }] });
  assert.equal(noYear.status, 422); // no current academic year yet
  assert.equal((await post(`${S}/years`, { name: "2026", current: true })).status, 201);

  // dry run reports original row numbers; nothing is written
  const bad = await post(`${I}/students`, { dryRun: true, rows: [
    { admission_no: "S1", first_name: "Asha", last_name: "Rao", dob: "2015-03-02", gender: "F", grade: "grade 5", section: "a", guardian_name: "Mr Rao", guardian_email: "rao@example.com" },
    { admission_no: "", first_name: "X", last_name: "Y" },
    { admission_no: "S3", first_name: "Ravi", last_name: "Rao", dob: "02/03/2015" },
    { admission_no: "S1", first_name: "Dup", last_name: "Dup" },
    { admission_no: "S5", first_name: "Z", last_name: "Z", grade: "Grade 9", section: "Q" },
  ] });
  assert.equal(bad.status, 422);
  const errs = ((await bad.json()) as any).errors as { row: number; field: string }[];
  assert.deepEqual(errs.map((e) => `${e.row}:${e.field}`).sort(), ["1:admission_no", "2:dob", "3:admission_no", "4:section"]);
  assert.equal(((await (await call(`${P}/students`, { headers: pri })).json()) as any).total, 0);

  // real import: siblings share one guardian
  const rows = [
    { admission_no: "S1", first_name: "Asha", last_name: "Rao", dob: "2015-03-02", gender: "F", grade: "Grade 5", section: "A", roll_no: "1", guardian_name: "Mr Rao", guardian_email: "RAO@example.com", guardian_relationship: "father" },
    { admission_no: "S2", first_name: "Ravi", last_name: "Rao", grade: "Grade 5", section: "A", guardian_name: "Mr Rao", guardian_email: "rao@example.com" },
    { admission_no: "S3", first_name: "Meera", last_name: "Iyer" },
  ];
  assert.equal((await post(`${I}/students`, { rows })).status, 200);
  assert.equal((await post(`${I}/students`, { rows })).status, 200); // idempotent re-import
  const list = (await (await call(`${P}/students`, { headers: a.teacher })).json()) as any;
  assert.equal(list.total, 3);
  const asha = list.rows.find((r: any) => r.admissionNo === "S1");
  assert.equal(asha.section, "A");
  assert.equal(asha.grade, "Grade 5");
  assert.equal(asha.gender, "female");
  assert.equal(((await (await call(`${P}/students?q=meera`, { headers: pri })).json()) as any).rows.length, 1);
  assert.equal(((await (await call(`${P}/guardians`, { headers: pri })).json()) as any[]).length, 1);

  // isolation + role gating
  assert.equal(((await (await call(`/api/v1/${b.school.slug}/people/students`, { headers: b.principal })).json()) as any).total, 0);
  assert.equal((await post(`${I}/students`, { rows }, a.teacher)).status, 403);

  // teachers import
  assert.equal((await post(`${I}/teachers`, { rows: [{ employee_no: "T1", first_name: "Tina", last_name: "Roy", email: "tina@example.com" }] })).status, 200);
  assert.equal(((await (await call(`${P}/teachers`, { headers: pri })).json()) as any[]).length, 1);

  // provision a student login: works once, student cannot read the student list
  const first = list.rows.find((r: any) => r.admissionNo === "S2");
  const prov = await post(`${P}/students/${first.id}/login`, {});
  assert.equal(prov.status, 201);
  const cred = (await prov.json()) as { identifier: string; password: string };
  assert.equal(cred.identifier, "S2");
  assert.equal((await post(`${P}/students/${first.id}/login`, {})).status, 409);
  const login = await call(`/api/v1/${a.school.slug}/login`, json({ identifier: cred.identifier, password: cred.password }));
  assert.equal(login.status, 200);
  const stu = { authorization: `Bearer ${login.headers.get("set-auth-token")}` };
  assert.equal((await call(`${P}/students`, { headers: stu })).status, 403);
  assert.equal((await call(`/api/v1/${a.school.slug}/structure/grades`, { headers: stu })).status, 200); // structure is readable by members
});
