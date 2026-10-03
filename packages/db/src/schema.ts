import { pgTable, uuid, text, timestamp, pgPolicy, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// school = tenant root, looked up by slug before tenant context exists. Not RLS-scoped.
export const school = pgTable("school", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

const tenant = (t: string) =>
  pgPolicy(`${t}_tenant`, {
    for: "all",
    using: sql`school_id = current_setting('app.school_id')::uuid`,
    withCheck: sql`school_id = current_setting('app.school_id')::uuid`,
  });

export const academicYear = pgTable(
  "academic_year",
  {
    id: uuid().primaryKey().defaultRandom(),
    schoolId: uuid("school_id").notNull().references(() => school.id),
    name: text().notNull(),
  },
  (t) => [index("academic_year_school").on(t.schoolId), tenant("academic_year")],
).enableRLS();
