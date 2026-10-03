CREATE TABLE "academic_year" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academic_year" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "school" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "school_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "school" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "academic_year" ADD CONSTRAINT "academic_year_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "academic_year_school" ON "academic_year" USING btree ("school_id");--> statement-breakpoint
CREATE POLICY "academic_year_tenant" ON "academic_year" AS PERMISSIVE FOR ALL TO "app_user" USING (school_id = current_setting('app.school_id')::uuid) WITH CHECK (school_id = current_setting('app.school_id')::uuid);--> statement-breakpoint
CREATE POLICY "school_app" ON "school" AS PERMISSIVE FOR ALL TO "app_user" USING (true) WITH CHECK (true);