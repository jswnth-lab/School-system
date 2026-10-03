import { Hono } from "hono";
import { and, eq, ilike, or, sql, getTableColumns, asc } from "drizzle-orm";
import { z } from "zod";
import {
  student, teacher, guardian, studentGuardian, enrollment, classSubjectTeacher, academicYear, section, gradeLevel, subject,
  membership, auditLog, withTenant,
} from "@sms/db";
import type { Env } from "./types.ts";
import { crud } from "./crud.ts";
import { session } from "./session.ts";
import { requireRole } from "./rbac.ts";
import { emailFor, createCredentialUser } from "./users.ts";

const STAFF = ["principal", "admin", "teacher"] as const;
const date = z.string().date().nullable().optional();
const nm = z.string().trim().min(1).max(120);
const opt = (n = 200) => z.string().trim().max(n).nullable().optional();

export const people = new Hono<Env>();

// Students: custom list (search, paging, current section) registered before the generic CRUD so it wins on GET.
people.get("/students", session, requireRole(...STAFF), async (c) => {
  const limit = Math.min(Number(c.req.query("limit")) || 50, 200);
  const offset = Math.max(Number(c.req.query("offset")) || 0, 0);
  const q = c.req.query("q")?.trim();
  const sectionId = c.req.query("sectionId");
  const where = and(
    q ? or(ilike(student.firstName, `%${q}%`), ilike(student.lastName, `%${q}%`), ilike(student.admissionNo, `%${q}%`)) : undefined,
    sectionId ? eq(section.id, sectionId) : undefined,
  );
  const out = await withTenant(c.get("db"), c.get("schoolId"), async (tx) => {
    const from = () =>
      tx.select({ ...getTableColumns(student), sectionId: section.id, section: section.name, grade: gradeLevel.name }).from(student)
        .leftJoin(enrollment, and(eq(enrollment.studentId, student.id), eq(enrollment.academicYearId, sql`(select id from academic_year where "current" limit 1)`)))
        .leftJoin(section, eq(section.id, enrollment.sectionId))
        .leftJoin(gradeLevel, eq(gradeLevel.id, section.gradeLevelId));
    const rows = await from().where(where).orderBy(asc(student.lastName), asc(student.firstName)).limit(limit).offset(offset);
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(student)
      .leftJoin(enrollment, and(eq(enrollment.studentId, student.id), eq(enrollment.academicYearId, sql`(select id from academic_year where "current" limit 1)`)))
      .leftJoin(section, eq(section.id, enrollment.sectionId)).where(where);
    return { rows, total: n };
  });
  return c.json(out);
});

crud(people, {
  path: "/students", entity: "student", table: student, read: [...STAFF],
  create: z.object({
    admissionNo: nm.max(40), firstName: nm, lastName: nm, dob: date,
    gender: z.enum(["female", "male", "other"]).nullable().optional(), status: z.enum(["active", "inactive"]).optional(),
  }),
});
crud(people, {
  path: "/teachers", entity: "teacher", table: teacher, read: [...STAFF], orderBy: asc(teacher.lastName),
  create: z.object({ employeeNo: nm.max(40), firstName: nm, lastName: nm, email: z.string().email().nullable().optional(), phone: opt(30) }),
});
const contactKey = (v: { email?: string | null; phone?: string | null }) => (v.email?.toLowerCase() || v.phone?.replace(/[^0-9+]/g, "") || "");
crud(people, {
  path: "/guardians", entity: "guardian", table: guardian, read: [...STAFF], orderBy: asc(guardian.name),
  create: z.object({ name: nm, email: z.string().email().nullable().optional(), phone: opt(30) })
    .refine((v) => contactKey(v), "email or phone required"),
  patch: z.object({ name: nm }), // contact details define identity; changing them would break de-duplication
  prepare: (b) => ({ ...b, contactKey: contactKey(b) }),
});
crud(people, {
  path: "/student-guardians", entity: "student_guardian", table: studentGuardian, read: [...STAFF],
  refs: { studentId: student, guardianId: guardian },
  create: z.object({ studentId: z.string().uuid(), guardianId: z.string().uuid(), relationship: opt(40), isPrimary: z.boolean().optional() }),
});
crud(people, {
  path: "/enrollments", entity: "enrollment", table: enrollment, read: [...STAFF],
  refs: { studentId: student, academicYearId: academicYear, sectionId: section },
  create: z.object({ studentId: z.string().uuid(), academicYearId: z.string().uuid(), sectionId: z.string().uuid(), rollNo: opt(20) }),
});
crud(people, {
  path: "/teaching", entity: "class_subject_teacher", table: classSubjectTeacher, read: [...STAFF],
  refs: { academicYearId: academicYear, sectionId: section, subjectId: subject, teacherId: teacher },
  create: z.object({ academicYearId: z.string().uuid(), sectionId: z.string().uuid(), subjectId: z.string().uuid(), teacherId: z.string().uuid() }),
});

// ---- Logins: a person record gets credentials on demand. The password is returned once. ----
const KINDS = {
  students: { table: student, role: "student" as const, ident: (r: any) => r.admissionNo, name: (r: any) => `${r.firstName} ${r.lastName}` },
  teachers: { table: teacher, role: "teacher" as const, ident: (r: any) => r.email ?? r.employeeNo, name: (r: any) => `${r.firstName} ${r.lastName}` },
  guardians: { table: guardian, role: "parent" as const, ident: (r: any) => r.email ?? r.phone?.replace(/[^0-9a-z]/gi, ""), name: (r: any) => r.name },
};
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no look-alikes
const tempPassword = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => ALPHABET[b % ALPHABET.length]).join("");

people.post("/:kind/:id/login", session, requireRole("principal", "admin"), async (c) => {
  const k = KINDS[c.req.param("kind") as keyof typeof KINDS];
  if (!k) return c.json({ error: "not found" }, 404);
  const db = c.get("db");
  const schoolId = c.get("schoolId");
  const [row] = await withTenant(db, schoolId, (tx) => tx.select().from(k.table as any).where(eq((k.table as any).id, c.req.param("id")!)));
  if (!row) return c.json({ error: "not found" }, 404);
  if ((row as any).userId) return c.json({ error: "login already exists" }, 409);
  const identifier = k.ident(row);
  if (!identifier) return c.json({ error: "needs an email or phone first" }, 400);
  const email = emailFor(c.get("slug"), String(identifier));
  const password = tempPassword();
  let u;
  try { u = await createCredentialUser(c.get("auth"), { email, name: k.name(row), password, verified: !String(identifier).includes("@") }); }
  catch { return c.json({ error: "an account with this email or username already exists" }, 409); }
  await withTenant(db, schoolId, async (tx) => {
    await tx.update(k.table as any).set({ userId: u.id }).where(eq((k.table as any).id, (row as any).id));
    await tx.insert(membership).values({ schoolId, userId: u.id, role: k.role });
    await tx.insert(auditLog).values({ schoolId, actorUserId: c.get("userId"), action: "login.provision", entity: c.req.param("kind"), entityId: (row as any).id, meta: { role: k.role } });
  });
  return c.json({ identifier: String(identifier), password }, 201);
});
