CREATE TABLE "grade_level" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "grade_level_name" UNIQUE("school_id","name")
);
--> statement-breakpoint
ALTER TABLE "grade_level" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "section" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"grade_level_id" uuid NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "section_name" UNIQUE("grade_level_id","name")
);
--> statement-breakpoint
ALTER TABLE "section" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "subject" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text,
	CONSTRAINT "subject_name" UNIQUE("school_id","name")
);
--> statement-breakpoint
ALTER TABLE "subject" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "term" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" date,
	"end_date" date
);
--> statement-breakpoint
ALTER TABLE "term" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "academic_year" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "academic_year" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "academic_year" ADD COLUMN "current" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "grade_level" ADD CONSTRAINT "grade_level_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section" ADD CONSTRAINT "section_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "section" ADD CONSTRAINT "section_grade_level_id_grade_level_id_fk" FOREIGN KEY ("grade_level_id") REFERENCES "public"."grade_level"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject" ADD CONSTRAINT "subject_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term" ADD CONSTRAINT "term_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term" ADD CONSTRAINT "term_academic_year_id_academic_year_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_year"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grade_level_school" ON "grade_level" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "section_school" ON "section" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "subject_school" ON "subject" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "term_school" ON "term" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "term_year" ON "term" USING btree ("academic_year_id");--> statement-breakpoint
CREATE POLICY "grade_level_tenant" ON "grade_level" AS PERMISSIVE FOR ALL TO "app_user" USING (school_id = current_setting('app.school_id')::uuid) WITH CHECK (school_id = current_setting('app.school_id')::uuid);--> statement-breakpoint
CREATE POLICY "section_tenant" ON "section" AS PERMISSIVE FOR ALL TO "app_user" USING (school_id = current_setting('app.school_id')::uuid) WITH CHECK (school_id = current_setting('app.school_id')::uuid);--> statement-breakpoint
CREATE POLICY "subject_tenant" ON "subject" AS PERMISSIVE FOR ALL TO "app_user" USING (school_id = current_setting('app.school_id')::uuid) WITH CHECK (school_id = current_setting('app.school_id')::uuid);--> statement-breakpoint
CREATE POLICY "term_tenant" ON "term" AS PERMISSIVE FOR ALL TO "app_user" USING (school_id = current_setting('app.school_id')::uuid) WITH CHECK (school_id = current_setting('app.school_id')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
