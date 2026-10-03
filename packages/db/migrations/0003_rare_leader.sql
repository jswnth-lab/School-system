CREATE TABLE "plan" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"max_students" integer,
	"max_storage_mb" integer,
	"white_label" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "plan" ("id","name") VALUES ('trial','Trial');--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "plan" TO app_user;--> statement-breakpoint
REVOKE ALL ON "plan" FROM anon, authenticated;--> statement-breakpoint
ALTER TABLE "school" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "school" ADD COLUMN "plan_id" text DEFAULT 'trial' NOT NULL;--> statement-breakpoint
ALTER TABLE "school" ADD COLUMN "logo_key" text;--> statement-breakpoint
ALTER TABLE "school" ADD COLUMN "primary_color" text;--> statement-breakpoint
ALTER TABLE "school" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "school" ADD COLUMN "features" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "platform_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "school" ADD CONSTRAINT "school_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "plan_app" ON "plan" AS PERMISSIVE FOR ALL TO "app_user" USING (true) WITH CHECK (true);