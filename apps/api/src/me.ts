import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { student, teacher, guardian, studentGuardian, enrollment, section, gradeLevel, deviceToken, user, withTenant } from "@sms/db";
import type { Env } from "./types.ts";
import { session } from "./session.ts";

export const me = new Hono<Env>();

// Minimum supported app versions. Old binaries stay in the stores forever, so apps check this at launch.
export const MIN_APP_VERSION = { teacher: "1.0.0", student: "1.0.0" };

/** What the signed-in person is in this school: their own student/teacher record and, for parents, their children. */
me.get("/me/profile", session, async (c) => {
  const uid = c.get("userId");
  const out = await withTenant(c.get("db"), c.get("schoolId"), async (tx) => {
    const withClass = () =>
      tx.select({ id: student.id, admissionNo: student.admissionNo, firstName: student.firstName, lastName: student.lastName, grade: gradeLevel.name, section: section.name })
        .from(student)
        .leftJoin(enrollment, and(eq(enrollment.studentId, student.id), eq(enrollment.academicYearId, sql`(select id from academic_year where "current" limit 1)`)))
        .leftJoin(section, eq(section.id, enrollment.sectionId))
        .leftJoin(gradeLevel, eq(gradeLevel.id, section.gradeLevelId));
    const [u] = await tx.select({ name: user.name }).from(user).where(eq(user.id, uid));
    const [self] = await withClass().where(eq(student.userId, uid));
    const [teacherRow] = await tx.select({ id: teacher.id, employeeNo: teacher.employeeNo, firstName: teacher.firstName, lastName: teacher.lastName }).from(teacher).where(eq(teacher.userId, uid));
    const children = await withClass()
      .innerJoin(studentGuardian, eq(studentGuardian.studentId, student.id))
      .innerJoin(guardian, eq(guardian.id, studentGuardian.guardianId))
      .where(eq(guardian.userId, uid));
    return { name: u?.name, student: self ?? null, teacher: teacherRow ?? null, children };
  });
  return c.json({ userId: uid, roles: c.get("roles"), impersonating: c.get("impersonating"), ...out });
});

const device = z.object({
  token: z.string().min(10).max(300).regex(/^(Expo|Exponent)PushToken\[.+\]$/, "not an Expo push token"),
  platform: z.enum(["ios", "android"]),
  app: z.enum(["teacher", "student"]),
});

// Register this device for push. A token belongs to whoever signed in on the device last.
me.post("/devices", session, async (c) => {
  const body = device.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: "invalid input", issues: body.error.issues }, 400);
  await withTenant(c.get("db"), c.get("schoolId"), (tx) =>
    tx.insert(deviceToken).values({ schoolId: c.get("schoolId"), userId: c.get("userId"), ...body.data })
      .onConflictDoUpdate({ target: [deviceToken.schoolId, deviceToken.token], set: { userId: c.get("userId"), platform: body.data.platform, app: body.data.app, updatedAt: new Date() } }),
  );
  return c.json({ ok: true });
});

me.delete("/devices", session, async (c) => {
  const token = z.object({ token: z.string() }).safeParse(await c.req.json().catch(() => null));
  if (!token.success) return c.json({ error: "invalid input" }, 400);
  await withTenant(c.get("db"), c.get("schoolId"), (tx) => tx.delete(deviceToken).where(and(eq(deviceToken.token, token.data.token), eq(deviceToken.userId, c.get("userId")))));
  return c.json({ ok: true });
});
