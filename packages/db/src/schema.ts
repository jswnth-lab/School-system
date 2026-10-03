import { pgTable, pgEnum, uuid, text, timestamp, jsonb, integer, boolean, pgPolicy, index, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { appUser } from "./roles.ts";
import { user } from "./auth-schema.ts";

// Platform plans. Limits enforced in Phase 9; null = unlimited. Global table (not tenant data).
export const plan = pgTable(
  "plan",
  {
    id: text().primaryKey(),
    name: text().notNull(),
    maxStudents: integer("max_students"),
    maxStorageMb: integer("max_storage_mb"),
    whiteLabel: boolean("white_label").notNull().default(false),
  },
  () => [pgPolicy("plan_app", { for: "all", to: appUser, using: sql`true`, withCheck: sql`true` })],
).enableRLS();

// school = tenant root, looked up by slug before tenant context exists.
// RLS on with a policy for app_user only, so Supabase anon/authenticated (PostgREST) see nothing.
export const school = pgTable(
  "school",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    status: text({ enum: ["active", "suspended"] }).notNull().default("active"),
    planId: text("plan_id").notNull().default("trial").references(() => plan.id),
    logoKey: text("logo_key"),
    primaryColor: text("primary_color"),
    locale: text().notNull().default("en"),
    features: jsonb().$type<Record<string, boolean>>().notNull().default({}),
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

export const role = pgEnum("role", ["principal", "admin", "teacher", "student", "parent"]);

// A user's role(s) inside one school. Authorization source of truth.
export const membership = pgTable(
  "membership",
  {
    id: uuid().primaryKey().defaultRandom(),
    schoolId: uuid("school_id").notNull().references(() => school.id),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    role: role().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("membership_unique").on(t.schoolId, t.userId, t.role), index("membership_user").on(t.userId), tenant("membership")],
).enableRLS();

// Append-only: only select + insert policies exist, so update/delete are denied.
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    schoolId: uuid("school_id").notNull().references(() => school.id),
    actorUserId: text("actor_user_id"),
    action: text().notNull(),
    entity: text(),
    entityId: text("entity_id"),
    meta: jsonb(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_school_time").on(t.schoolId, t.createdAt),
    pgPolicy("audit_log_select", { for: "select", to: appUser, using: sql`school_id = current_setting('app.school_id')::uuid` }),
    pgPolicy("audit_log_insert", { for: "insert", to: appUser, withCheck: sql`school_id = current_setting('app.school_id')::uuid` }),
  ],
).enableRLS();
