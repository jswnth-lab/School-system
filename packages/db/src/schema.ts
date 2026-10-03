import { pgTable, uuid, text, timestamp, pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// school is the tenant root; not RLS-scoped itself (resolved by slug before tenant context exists).
export const school = pgTable("school", {
  id: uuid().primaryKey().defaultRandom(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  createdAt: timestamp().notNull().defaultNow(),
});

const tenantPolicy = (name: string) =>
  pgPolicy(`${name}_tenant`, {
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
  () => [tenantPolicy("academic_year")],
).enableRLS();
