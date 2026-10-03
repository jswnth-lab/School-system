CREATE TABLE "class_subject_teacher" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	CONSTRAINT "cst_unique" UNIQUE("academic_year_id","section_id","subject_id")
);
--> statement-breakpoint
ALTER TABLE "class_subject_teacher" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "enrollment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"roll_no" text,
	CONSTRAINT "enrollment_student_year" UNIQUE("student_id","academic_year_id")
);
--> statement-breakpoint
ALTER TABLE "enrollment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "guardian" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"contact_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "guardian_contact" UNIQUE("school_id","contact_key")
);
--> statement-breakpoint
ALTER TABLE "guardian" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"user_id" text,
	"admission_no" text NOT NULL,
	"dob" date,
	"gender" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "student_admission" UNIQUE("school_id","admission_no")
);
--> statement-breakpoint
ALTER TABLE "student" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_guardian" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"relationship" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "student_guardian_pair" UNIQUE("student_id","guardian_id")
);
--> statement-breakpoint
ALTER TABLE "student_guardian" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "teacher" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"user_id" text,
	"employee_no" text NOT NULL,
	"email" text,
	"phone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_employee" UNIQUE("school_id","employee_no")
);
--> statement-breakpoint
ALTER TABLE "teacher" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "class_subject_teacher" ADD CONSTRAINT "class_subject_teacher_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subject_teacher" ADD CONSTRAINT "class_subject_teacher_academic_year_id_academic_year_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_year"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subject_teacher" ADD CONSTRAINT "class_subject_teacher_section_id_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."section"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subject_teacher" ADD CONSTRAINT "class_subject_teacher_subject_id_subject_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subject"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subject_teacher" ADD CONSTRAINT "class_subject_teacher_teacher_id_teacher_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teacher"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_academic_year_id_academic_year_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_year"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_section_id_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."section"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian" ADD CONSTRAINT "guardian_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian" ADD CONSTRAINT "guardian_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_guardian" ADD CONSTRAINT "student_guardian_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_guardian" ADD CONSTRAINT "student_guardian_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_guardian" ADD CONSTRAINT "student_guardian_guardian_id_guardian_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardian"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher" ADD CONSTRAINT "teacher_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher" ADD CONSTRAINT "teacher_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cst_school" ON "class_subject_teacher" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "cst_teacher" ON "class_subject_teacher" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "enrollment_school" ON "enrollment" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "enrollment_section" ON "enrollment" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "guardian_school" ON "guardian" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "student_school" ON "student" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "student_guardian_school" ON "student_guardian" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "student_guardian_guardian" ON "student_guardian" USING btree ("guardian_id");--> statement-breakpoint
CREATE INDEX "teacher_school" ON "teacher" USING btree ("school_id");--> statement-breakpoint
CREATE POLICY "class_subject_teacher_tenant" ON "class_subject_teacher" AS PERMISSIVE FOR ALL TO "app_user" USING (school_id = current_setting('app.school_id')::uuid) WITH CHECK (school_id = current_setting('app.school_id')::uuid);--> statement-breakpoint
CREATE POLICY "enrollment_tenant" ON "enrollment" AS PERMISSIVE FOR ALL TO "app_user" USING (school_id = current_setting('app.school_id')::uuid) WITH CHECK (school_id = current_setting('app.school_id')::uuid);--> statement-breakpoint
CREATE POLICY "guardian_tenant" ON "guardian" AS PERMISSIVE FOR ALL TO "app_user" USING (school_id = current_setting('app.school_id')::uuid) WITH CHECK (school_id = current_setting('app.school_id')::uuid);--> statement-breakpoint
CREATE POLICY "student_tenant" ON "student" AS PERMISSIVE FOR ALL TO "app_user" USING (school_id = current_setting('app.school_id')::uuid) WITH CHECK (school_id = current_setting('app.school_id')::uuid);--> statement-breakpoint
CREATE POLICY "student_guardian_tenant" ON "student_guardian" AS PERMISSIVE FOR ALL TO "app_user" USING (school_id = current_setting('app.school_id')::uuid) WITH CHECK (school_id = current_setting('app.school_id')::uuid);--> statement-breakpoint
CREATE POLICY "teacher_tenant" ON "teacher" AS PERMISSIVE FOR ALL TO "app_user" USING (school_id = current_setting('app.school_id')::uuid) WITH CHECK (school_id = current_setting('app.school_id')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
