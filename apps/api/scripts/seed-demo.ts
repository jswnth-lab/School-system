// Fills the "demo" school with realistic data through the real API (so validation, RLS and audit all apply).
// Usage (from apps/api): pnpm seed-demo     Safe to re-run: structure/people upsert or 409-skip, staff passwords are re-issued.
// Writes logins to apps/api/.demo-credentials.txt (gitignored). Never prints passwords.
import { eq } from "drizzle-orm";
import { writeFileSync } from "node:fs";
import { connect, school, user, membership, withTenant } from "@sms/db";
import { app } from "../src/app.ts";
import { createAuth } from "../src/auth.ts";
import { createCredentialUser, emailFor } from "../src/users.ts";

const SLUG = "demo";
const env = { DATABASE_URL: process.env.DATABASE_URL!, BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!, FILES: null as never };
const db = connect(env.DATABASE_URL);
const [demo] = await db.select().from(school).where(eq(school.slug, SLUG));
if (!demo) throw new Error(`school "${SLUG}" not found`);

// deterministic pseudo-random so re-runs produce the same people
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const ALPHA = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const password = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => ALPHA[b % ALPHA.length]).join("");

const creds: string[] = [`School: ${SLUG}  (sign in at /${SLUG})`, "role | username | password"];
const auth = createAuth(db, env, "http://localhost");
async function ensureStaff(username: string, name: string, role: "principal" | "admin") {
  const email = emailFor(SLUG, username);
  const pw = password();
  const ctx = await auth.$context;
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (existing) await ctx.internalAdapter.updatePassword(existing.id, await ctx.password.hash(pw));
  else {
    const u = await createCredentialUser(auth, { email, name, password: pw, verified: true });
    await withTenant(db, demo.id, (tx) => tx.insert(membership).values({ schoolId: demo.id, userId: u.id, role }));
  }
  creds.push(`${role} | ${username} | ${pw}`);
  return pw;
}
const principalPw = await ensureStaff("principal", "Priya Menon", "principal");
await ensureStaff("admin", "Arjun Nair", "admin");

const login = await app.request(`/api/v1/${SLUG}/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier: "principal", password: principalPw }) }, env);
if (!login.ok) throw new Error(`principal login failed (${login.status})`);
const H = { authorization: `Bearer ${login.headers.get("set-auth-token")}`, "content-type": "application/json" };
const call = async (method: string, path: string, body?: unknown) => {
  const r = await app.request(`/api/v1/${SLUG}${path}`, { method, headers: H, body: body ? JSON.stringify(body) : undefined }, env);
  const data = await r.json().catch(() => ({}));
  if (!r.ok && r.status !== 409) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(data).slice(0, 300)}`);
  return { status: r.status, data: data as any };
};
const pool = async <T,>(items: T[], n: number, fn: (t: T) => Promise<unknown>) => {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
};
const list = async (path: string) => { const d = (await call("GET", path)).data; return (Array.isArray(d) ? d : d.rows) as any[]; };

// ---- structure ----
await call("POST", "/structure/years", { name: "2025-26", startDate: "2025-04-01", endDate: "2026-03-31" });
const year = (await call("POST", "/structure/years", { name: "2026-27", startDate: "2026-04-01", endDate: "2027-03-31", current: true }));
const years = await list("/structure/years");
const yearId = years.find((y) => y.name === "2026-27").id;
for (const [name, s, e] of [["Term 1", "2026-04-06", "2026-08-31"], ["Term 2", "2026-09-07", "2026-12-18"], ["Term 3", "2027-01-04", "2027-03-26"]])
  await call("POST", "/structure/terms", { academicYearId: yearId, name, startDate: s, endDate: e });
for (let g = 1; g <= 8; g++) await call("POST", "/structure/grades", { name: `Grade ${g}`, position: g });
const grades = await list("/structure/grades");
await pool(grades.flatMap((g) => ["A", "B"].map((n) => ({ gradeLevelId: g.id, name: n }))), 8, (b) => call("POST", "/structure/sections", b));
const SUBJECTS: [string, string][] = [["English", "ENG"], ["Mathematics", "MTH"], ["Science", "SCI"], ["Social Studies", "SOC"], ["Hindi", "HIN"], ["Computer Science", "CSC"], ["Physical Education", "PED"], ["Art", "ART"]];
await pool(SUBJECTS, 8, ([name, code]) => call("POST", "/structure/subjects", { name, code }));
const ROOMS = [...Array.from({ length: 8 }, (_, i) => [`Room ${101 + i}`, 36]), ["Science Lab", 30], ["Computer Lab", 30], ["Library", 60], ["Art Room", 28], ["Auditorium", 300]] as [string, number][];
await pool(ROOMS, 8, ([name, capacity]) => call("POST", "/structure/rooms", { name, capacity }));
console.log("structure done");

// ---- teachers ----
const FIRST_F = ["Aarti", "Meera", "Divya", "Sana", "Kavya", "Neha", "Fatima", "Riya", "Anjali", "Zoya", "Lakshmi", "Pooja", "Isha", "Nadia", "Sneha", "Tara", "Aisha", "Swati"];
const FIRST_M = ["Aarav", "Rohan", "Vivaan", "Imran", "Karthik", "Arjun", "Yusuf", "Rahul", "Dev", "Omar", "Sanjay", "Vikram", "Farhan", "Nikhil", "Ayaan", "Rajesh", "Kabir", "Siddharth"];
const LAST = ["Rao", "Iyer", "Nair", "Khan", "Sharma", "Menon", "Patel", "Reddy", "Singh", "Verma", "Das", "Joshi", "Ahmed", "Kulkarni", "Bose", "Pillai", "Gupta", "Mehta", "Shaikh", "Chopra"];
const teachers = Array.from({ length: 18 }, (_, i) => {
  const f = i % 2 ? pick(FIRST_F) : pick(FIRST_M), l = pick(LAST);
  return { employee_no: `T${String(i + 1).padStart(3, "0")}`, first_name: f, last_name: l, email: `${f}.${l}.${i + 1}@demo.example`.toLowerCase(), phone: `+9198${String(10000000 + Math.floor(rnd() * 89999999))}` };
});
await call("POST", "/import/teachers", { rows: teachers });
console.log("teachers done");

// ---- students + guardians (siblings share a guardian) ----
// only the sections this script created ("Grade N X"); leaves anything added by hand alone
const sections = (await list("/structure/sections")).filter((s) => /^Grade \d+ /.test(s.label));
const families: { last: string; name: string; email: string; phone: string }[] = [];
const students: Record<string, string>[] = [];
let n = 0;
for (const sec of sections) {
  const grade = Number(sec.label.match(/Grade (\d+)/)![1]);
  const size = 10 + Math.floor(rnd() * 5);
  for (let r = 1; r <= size; r++) {
    n++;
    const sibling = families.length > 3 && rnd() < 0.2;
    const fam = sibling ? pick(families) : (() => {
      const last = pick(LAST), idx = families.length + 1;
      const f = { last, name: `${pick(["Mr", "Mrs"])} ${last}`, email: `${last}.family${idx}@demo.example`.toLowerCase(), phone: `+9199${String(10000000 + Math.floor(rnd() * 89999999))}` };
      families.push(f); return f;
    })();
    const female = rnd() < 0.5;
    students.push({
      admission_no: `A2026${String(n).padStart(4, "0")}`, first_name: pick(female ? FIRST_F : FIRST_M), last_name: fam.last,
      dob: `${2026 - 5 - grade}-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rnd() * 28)).padStart(2, "0")}`,
      gender: female ? "female" : "male", grade: `Grade ${grade}`, section: sec.name, roll_no: String(r),
      guardian_name: fam.name, guardian_email: fam.email, guardian_phone: fam.phone, guardian_relationship: fam.name.startsWith("Mr") ? "father" : "mother",
    });
  }
}
for (let i = 0; i < students.length; i += 200) await call("POST", "/import/students", { rows: students.slice(i, i + 200) });
console.log(`students done: ${students.length} students, ${families.length} guardians`);

// ---- teaching assignments: every section gets every subject ----
const subjects = await list("/structure/subjects");
const teacherRows = (await list("/people/teachers")).sort((a, b) => a.employeeNo.localeCompare(b.employeeNo));
const jobs = sections.flatMap((s, si) => subjects.map((sub, ui) => ({ academicYearId: yearId, sectionId: s.id, subjectId: sub.id, teacherId: teacherRows[(si * 3 + ui) % teacherRows.length].id })));
await pool(jobs, 8, (b) => call("POST", "/people/teaching", b));
console.log(`teaching done: ${jobs.length} assignments`);

// ---- a few real logins to try the other roles ----
const provision = async (kind: string, rows: any[], label: string) => {
  for (const r of rows) {
    const res = await call("POST", `/people/${kind}/${r.id}/login`, {});
    if (res.status === 201) creds.push(`${label} | ${res.data.identifier} | ${res.data.password}`);
  }
};
await provision("teachers", teacherRows.slice(0, 3), "teacher");
const stuRows = (await call("GET", "/people/students?limit=200")).data.rows as any[];
await provision("students", stuRows.slice(0, 3), "student");
await provision("guardians", (await list("/people/guardians")).slice(0, 2), "parent");

writeFileSync(new URL("../.demo-credentials.txt", import.meta.url), creds.join("\n") + "\n", { mode: 0o600 });
console.log("logins written to apps/api/.demo-credentials.txt");
await db.$client.end();
