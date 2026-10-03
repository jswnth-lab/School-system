import { pgTable, pgRole, uuid, text, timestamp, pgPolicy, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Created outside migrations (password): see migrations/README.
export const appUser = pgRole("app_user").existing();

// school = tenant root, looked up by slug before tenant context exists.
// RLS on with a policy for app_user only, so Supabase anon/authenticated (PostgREST) see nothing.
export const school = pgTable(
  "school",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  () => [pgPolicy("school_app", { for: "all", to: appUser, using: sql`true`, withCheck: sql`true` })],
).enableRLS();

const tenant = (t: string) =>
  pgPolicy(`${t}_tenant`, {
    for: "all",
    to: appUser,
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
