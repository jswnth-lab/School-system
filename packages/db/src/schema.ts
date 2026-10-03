import { pgTable, pgEnum, uuid, text, timestamp, jsonb, integer, boolean, date, pgPolicy, index, unique } from "drizzle-orm/pg-core";
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

const base = () => ({
  id: uuid().primaryKey().defaultRandom(),
  schoolId: uuid("school_id").notNull().references(() => school.id),
});

export const academicYear = pgTable(
  "academic_year",
  { ...base(), name: text().notNull(), startDate: date("start_date"), endDate: date("end_date"), current: boolean().notNull().default(false) },
  (t) => [index("academic_year_school").on(t.schoolId), tenant("academic_year")],
).enableRLS();

export const term = pgTable(
  "term",
  {
    ...base(),
    academicYearId: uuid("academic_year_id").notNull().references(() => academicYear.id, { onDelete: "cascade" }),
    name: text().notNull(),
    startDate: date("start_date"),
    endDate: date("end_date"),
  },
  (t) => [index("term_school").on(t.schoolId), index("term_year").on(t.academicYearId), tenant("term")],
).enableRLS();

export const gradeLevel = pgTable(
  "grade_level",
  { ...base(), name: text().notNull(), position: integer().notNull().default(0) },
  (t) => [index("grade_level_school").on(t.schoolId), unique("grade_level_name").on(t.schoolId, t.name), tenant("grade_level")],
).enableRLS();

export const section = pgTable(
  "section",
  {
    ...base(),
    gradeLevelId: uuid("grade_level_id").notNull().references(() => gradeLevel.id, { onDelete: "cascade" }),
    name: text().notNull(),
  },
  (t) => [index("section_school").on(t.schoolId), unique("section_name").on(t.gradeLevelId, t.name), tenant("section")],
).enableRLS();

export const subject = pgTable(
  "subject",
  { ...base(), name: text().notNull(), code: text() },
  (t) => [index("subject_school").on(t.schoolId), unique("subject_name").on(t.schoolId, t.name), tenant("subject")],
).enableRLS();

export const room = pgTable(
  "room",
  { ...base(), name: text().notNull(), capacity: integer() },
  (t) => [index("room_school").on(t.schoolId), unique("room_name").on(t.schoolId, t.name), tenant("room")],
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

// ---- People. A person record exists without a login; user_id is set when a login is provisioned. ----
const person = () => ({ firstName: text("first_name").notNull(), lastName: text("last_name").notNull() });
const login = () => ({ userId: text("user_id").references(() => user.id, { onDelete: "set null" }) });

export const student = pgTable(
  "student",
  {
    ...base(), ...person(), ...login(),
    admissionNo: text("admission_no").notNull(),
    dob: date(),
    gender: text({ enum: ["female", "male", "other"] }),
    status: text({ enum: ["active", "inactive"] }).notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("student_school").on(t.schoolId), unique("student_admission").on(t.schoolId, t.admissionNo), tenant("student")],
).enableRLS();

export const teacher = pgTable(
  "teacher",
  { ...base(), ...person(), ...login(), employeeNo: text("employee_no").notNull(), email: text(), phone: text(), createdAt: timestamp("created_at").notNull().defaultNow() },
  (t) => [index("teacher_school").on(t.schoolId), unique("teacher_employee").on(t.schoolId, t.employeeNo), tenant("teacher")],
).enableRLS();

// contact_key = lower(email) or phone: one guardian row per real contact, shared across siblings.
export const guardian = pgTable(
  "guardian",
  { ...base(), ...login(), name: text().notNull(), email: text(), phone: text(), contactKey: text("contact_key").notNull(), createdAt: timestamp("created_at").notNull().defaultNow() },
  (t) => [index("guardian_school").on(t.schoolId), unique("guardian_contact").on(t.schoolId, t.contactKey), tenant("guardian")],
).enableRLS();

export const studentGuardian = pgTable(
  "student_guardian",
  {
    ...base(),
    studentId: uuid("student_id").notNull().references(() => student.id, { onDelete: "cascade" }),
    guardianId: uuid("guardian_id").notNull().references(() => guardian.id, { onDelete: "cascade" }),
    relationship: text(),
    isPrimary: boolean("is_primary").notNull().default(false),
  },
  (t) => [index("student_guardian_school").on(t.schoolId), index("student_guardian_guardian").on(t.guardianId), unique("student_guardian_pair").on(t.studentId, t.guardianId), tenant("student_guardian")],
).enableRLS();

export const enrollment = pgTable(
  "enrollment",
  {
    ...base(),
    studentId: uuid("student_id").notNull().references(() => student.id, { onDelete: "cascade" }),
    academicYearId: uuid("academic_year_id").notNull().references(() => academicYear.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id").notNull().references(() => section.id, { onDelete: "cascade" }),
    rollNo: text("roll_no"),
  },
  (t) => [index("enrollment_school").on(t.schoolId), index("enrollment_section").on(t.sectionId), unique("enrollment_student_year").on(t.studentId, t.academicYearId), tenant("enrollment")],
).enableRLS();

export const classSubjectTeacher = pgTable(
  "class_subject_teacher",
  {
    ...base(),
    academicYearId: uuid("academic_year_id").notNull().references(() => academicYear.id, { onDelete: "cascade" }),
    sectionId: uuid("section_id").notNull().references(() => section.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id").notNull().references(() => subject.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id").notNull().references(() => teacher.id, { onDelete: "cascade" }),
  },
  (t) => [index("cst_school").on(t.schoolId), index("cst_teacher").on(t.teacherId), unique("cst_unique").on(t.academicYearId, t.sectionId, t.subjectId), tenant("class_subject_teacher")],
).enableRLS();
