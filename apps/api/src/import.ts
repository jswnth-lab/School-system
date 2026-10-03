import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { student, teacher, guardian, studentGuardian, enrollment, academicYear, section, gradeLevel, auditLog, withTenant } from "@sms/db";
import type { Env } from "./types.ts";
import { session } from "./session.ts";
import { requireRole } from "./rbac.ts";

// CSV is parsed in the browser; the API takes JSON rows in chunks (Workers CPU limits).
// Idempotent: rows upsert by admission_no / employee_no, so a corrected file can be re-imported.
export const MAX_ROWS = 200;
export const importer = new Hono<Env>();

const cell = z.string().trim().max(200).optional().transform((v) => v || undefined);
const gender = z.string().trim().toLowerCase().optional().transform((v) => (v ? ({ f: "female", m: "male" } as Record<string, string>)[v] ?? v : undefined))
  .pipe(z.enum(["female", "male", "other"]).optional());
const studentRow = z.object({
  admission_no: z.string().trim().min(1, "required").max(40),
  first_name: z.string().trim().min(1, "required").max(120),
  last_name: z.string().trim().min(1, "required").max(120),
  dob: cell.pipe(z.string().date("use YYYY-MM-DD").optional()),
  gender, grade: cell, section: cell, roll_no: cell,
  guardian_name: cell, guardian_email: cell.pipe(z.string().email("not an email").optional()), guardian_phone: cell, guardian_relationship: cell,
});
const teacherRow = z.object({
  employee_no: z.string().trim().min(1, "required").max(40),
  first_name: z.string().trim().min(1, "required").max(120),
  last_name: z.string().trim().min(1, "required").max(120),
  email: cell.pipe(z.string().email("not an email").optional()), phone: cell,
});
const payload = z.object({ rows: z.array(z.record(z.string(), z.any())).min(1).max(MAX_ROWS), dryRun: z.boolean().default(false) });

type RowError = { row: number; field?: string; message: string };
const issues = (row: number, e: z.ZodError): RowError[] => e.issues.map((i) => ({ row, field: String(i.path[0] ?? ""), message: i.message }));
const dupes = <T,>(items: T[], key: (t: T) => string, row: (i: number) => RowError) => {
  const seen = new Set<string>();
  return items.flatMap((t, i) => (seen.size === seen.add(key(t)).size ? [row(i)] : []));
};
const guardianKey = (r: { guardian_email?: string; guardian_phone?: string }) => r.guardian_email?.toLowerCase() || r.guardian_phone?.replace(/[^0-9+]/g, "") || "";

importer.post("/students", session, requireRole("principal", "admin"), async (c) => {
  const body = payload.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: `send 1 to ${MAX_ROWS} rows as { rows: [...] }` }, 400);
  const errors: RowError[] = [];
  const rows: z.infer<typeof studentRow>[] = [];
  const idx: number[] = []; // original row number of each valid row, for error reporting
  body.data.rows.forEach((raw, i) => {
    const p = studentRow.safeParse(raw);
    if (p.success) { rows.push(p.data); idx.push(i); } else errors.push(...issues(i, p.error));
  });
  errors.push(...dupes(rows, (r) => r.admission_no, (i) => ({ row: idx[i], field: "admission_no", message: "duplicate in this file" })));

  const schoolId = c.get("schoolId");
  return withTenant(c.get("db"), schoolId, async (tx) => {
    // resolve "grade" + "section" names to ids in the current academic year
    const sections = await tx.select({ id: section.id, name: section.name, grade: gradeLevel.name }).from(section).innerJoin(gradeLevel, eq(gradeLevel.id, section.gradeLevelId));
    const bySection = new Map(sections.map((s) => [`${s.grade.toLowerCase()}|${s.name.toLowerCase()}`, s.id]));
    const [year] = await tx.select({ id: academicYear.id }).from(academicYear).where(eq(academicYear.current, true));
    const sectionOf = rows.map((r, i) => {
      if (!r.grade && !r.section) return null;
      if (!r.grade || !r.section) { errors.push({ row: idx[i], field: "section", message: "give both grade and section" }); return null; }
      const id = bySection.get(`${r.grade.toLowerCase()}|${r.section.toLowerCase()}`);
      if (!id) errors.push({ row: idx[i], field: "section", message: `unknown grade/section "${r.grade} ${r.section}"` });
      else if (!year) errors.push({ row: idx[i], field: "section", message: "no current academic year set" });
      return id ?? null;
    });
    rows.forEach((r, i) => { if (r.guardian_name && !guardianKey(r)) errors.push({ row: idx[i], field: "guardian_email", message: "guardian needs an email or phone" }); });

    if (errors.length || body.data.dryRun) return c.json({ ok: !errors.length, errors, count: rows.length }, errors.length ? 422 : 200);

    const saved = await tx.insert(student).values(rows.map((r) => ({
      schoolId, admissionNo: r.admission_no, firstName: r.first_name, lastName: r.last_name, dob: r.dob ?? null, gender: r.gender ?? null,
    }))).onConflictDoUpdate({
      target: [student.schoolId, student.admissionNo],
      set: { firstName: sql`excluded.first_name`, lastName: sql`excluded.last_name`, dob: sql`excluded.dob`, gender: sql`excluded.gender` },
    }).returning({ id: student.id, admissionNo: student.admissionNo });
    const id = new Map(saved.map((s) => [s.admissionNo, s.id]));

    const enrol = rows.flatMap((r, i) => (sectionOf[i] ? [{ schoolId, studentId: id.get(r.admission_no)!, academicYearId: year!.id, sectionId: sectionOf[i]!, rollNo: r.roll_no ?? null }] : []));
    if (enrol.length) await tx.insert(enrollment).values(enrol).onConflictDoUpdate({ target: [enrollment.studentId, enrollment.academicYearId], set: { sectionId: sql`excluded.section_id`, rollNo: sql`excluded.roll_no` } });

    // guardians shared by siblings: one row per contact key
    const gs = new Map<string, { name: string; email: string | null; phone: string | null }>();
    for (const r of rows) if (r.guardian_name) gs.set(guardianKey(r), { name: r.guardian_name, email: r.guardian_email?.toLowerCase() ?? null, phone: r.guardian_phone ?? null });
    if (gs.size) {
      const g = await tx.insert(guardian).values([...gs].map(([contactKey, v]) => ({ schoolId, contactKey, ...v })))
        .onConflictDoUpdate({ target: [guardian.schoolId, guardian.contactKey], set: { name: sql`excluded.name` } })
        .returning({ id: guardian.id, contactKey: guardian.contactKey });
      const gid = new Map(g.map((x) => [x.contactKey, x.id]));
      const links = rows.flatMap((r) => (r.guardian_name ? [{ schoolId, studentId: id.get(r.admission_no)!, guardianId: gid.get(guardianKey(r))!, relationship: r.guardian_relationship ?? null, isPrimary: true }] : []));
      await tx.insert(studentGuardian).values(links).onConflictDoUpdate({ target: [studentGuardian.studentId, studentGuardian.guardianId], set: { relationship: sql`excluded.relationship` } });
    }
    await tx.insert(auditLog).values({ schoolId, actorUserId: c.get("userId"), action: "student.import", entity: "student", meta: { count: rows.length } });
    return c.json({ ok: true, errors: [], count: rows.length });
  });
});

importer.post("/teachers", session, requireRole("principal", "admin"), async (c) => {
  const body = payload.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: `send 1 to ${MAX_ROWS} rows as { rows: [...] }` }, 400);
  const errors: RowError[] = [];
  const rows: z.infer<typeof teacherRow>[] = [];
  const idx: number[] = [];
  body.data.rows.forEach((raw, i) => {
    const p = teacherRow.safeParse(raw);
    if (p.success) { rows.push(p.data); idx.push(i); } else errors.push(...issues(i, p.error));
  });
  errors.push(...dupes(rows, (r) => r.employee_no, (i) => ({ row: idx[i], field: "employee_no", message: "duplicate in this file" })));
  if (errors.length || body.data.dryRun) return c.json({ ok: !errors.length, errors, count: rows.length }, errors.length ? 422 : 200);
  const schoolId = c.get("schoolId");
  return withTenant(c.get("db"), schoolId, async (tx) => {
    await tx.insert(teacher).values(rows.map((r) => ({ schoolId, employeeNo: r.employee_no, firstName: r.first_name, lastName: r.last_name, email: r.email?.toLowerCase() ?? null, phone: r.phone ?? null })))
      .onConflictDoUpdate({ target: [teacher.schoolId, teacher.employeeNo], set: { firstName: sql`excluded.first_name`, lastName: sql`excluded.last_name`, email: sql`excluded.email`, phone: sql`excluded.phone` } });
    await tx.insert(auditLog).values({ schoolId, actorUserId: c.get("userId"), action: "teacher.import", entity: "teacher", meta: { count: rows.length } });
    return c.json({ ok: true, errors: [], count: rows.length });
  });
});
