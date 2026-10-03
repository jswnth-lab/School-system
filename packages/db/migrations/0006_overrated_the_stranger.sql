CREATE TABLE "room" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" text NOT NULL,
	"capacity" integer,
	CONSTRAINT "room_name" UNIQUE("school_id","name")
);
--> statement-breakpoint
ALTER TABLE "room" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "room" ADD CONSTRAINT "room_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "room_school" ON "room" USING btree ("school_id");--> statement-breakpoint
CREATE POLICY "room_tenant" ON "room" AS PERMISSIVE FOR ALL TO "app_user" USING (school_id = current_setting('app.school_id')::uuid) WITH CHECK (school_id = current_setting('app.school_id')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
