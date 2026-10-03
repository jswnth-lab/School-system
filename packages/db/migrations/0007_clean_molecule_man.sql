CREATE TABLE "device_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"platform" text NOT NULL,
	"app" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "device_token_unique" UNIQUE("school_id","token")
);
--> statement-breakpoint
ALTER TABLE "device_token" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "device_token" ADD CONSTRAINT "device_token_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."school"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_token" ADD CONSTRAINT "device_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_token_user" ON "device_token" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "device_token_tenant" ON "device_token" AS PERMISSIVE FOR ALL TO "app_user" USING (school_id = current_setting('app.school_id')::uuid) WITH CHECK (school_id = current_setting('app.school_id')::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
