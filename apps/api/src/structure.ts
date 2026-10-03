import { Hono } from "hono";
import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { academicYear, term, gradeLevel, section, subject, room, withTenant } from "@sms/db";
import type { Env } from "./types.ts";
import { crud } from "./crud.ts";
import { session } from "./session.ts";

const date = z.string().date().nullable().optional();
const name = z.string().trim().min(1).max(120);

export const structure = new Hono<Env>();

crud(structure, {
  path: "/years", entity: "academic_year", table: academicYear, orderBy: asc(academicYear.name),
  create: z.object({ name, startDate: date, endDate: date, current: z.boolean().optional() }),
  // only one current year per school
  after: async (tx, row) => {
    if (row.current) await tx.update(academicYear).set({ current: false }).where(and(eq(academicYear.schoolId, row.schoolId), ne(academicYear.id, row.id)));
  },
});
crud(structure, {
  path: "/terms", entity: "term", table: term, orderBy: asc(term.startDate), refs: { academicYearId: academicYear },
  create: z.object({ academicYearId: z.string().uuid(), name, startDate: date, endDate: date }),
});
crud(structure, {
  path: "/grades", entity: "grade_level", table: gradeLevel, orderBy: asc(gradeLevel.position),
  create: z.object({ name, position: z.number().int().min(0).max(1000).optional() }),
});
// sections list carries "Grade 5 A" so pickers can tell sections apart across grades (registered first: wins on GET)
structure.get("/sections", session, async (c) =>
  c.json(await withTenant(c.get("db"), c.get("schoolId"), async (tx) => {
    const rows = await tx.select({ id: section.id, gradeLevelId: section.gradeLevelId, name: section.name, grade: gradeLevel.name, position: gradeLevel.position })
      .from(section).innerJoin(gradeLevel, eq(gradeLevel.id, section.gradeLevelId)).orderBy(asc(gradeLevel.position), asc(gradeLevel.name), asc(section.name));
    return rows.map(({ grade, position: _p, ...r }) => ({ ...r, label: `${grade} ${r.name}` }));
  })),
);
crud(structure, {
  path: "/sections", entity: "section", table: section, orderBy: asc(section.name), refs: { gradeLevelId: gradeLevel },
  create: z.object({ gradeLevelId: z.string().uuid(), name }),
});
crud(structure, {
  path: "/subjects", entity: "subject", table: subject, orderBy: asc(subject.name),
  create: z.object({ name, code: z.string().trim().max(20).nullable().optional() }),
});
crud(structure, {
  path: "/rooms", entity: "room", table: room, orderBy: asc(room.name),
  create: z.object({ name, capacity: z.number().int().min(1).max(5000).nullable().optional() }),
});
