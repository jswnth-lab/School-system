import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

const id = () => text().primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => integer({ mode: "timestamp" }).notNull().$defaultFn(() => new Date());

// school = tenant root, resolved by slug before tenant context exists.
export const school = sqliteTable("school", {
  id: id(),
  slug: text().notNull().unique(),
  name: text().notNull(),
  createdAt: createdAt(),
});

// Every tenant table: schoolId notNull + index. Access only via tenantDb().
export const academicYear = sqliteTable(
  "academic_year",
  {
    id: id(),
    schoolId: text("school_id").notNull().references(() => school.id),
    name: text().notNull(),
  },
  (t) => [index("academic_year_school").on(t.schoolId)],
);
