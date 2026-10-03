import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { connect, school, withTenant, type Db } from "@sms/db";

type Env = { Bindings: { DATABASE_URL: string }; Variables: { db: Db; schoolId: string } };
const app = new Hono<Env>();

app.get("/api/v1/health", (c) => c.json({ ok: true }));

// Tenant = path segment until custom domains exist: /api/v1/:school/...
const tenant = new Hono<Env>();
tenant.use("*", async (c, next) => {
  const db = connect(c.env.DATABASE_URL);
  const [s] = await db.select().from(school).where(eq(school.slug, c.req.param("school")!));
  if (!s) return c.json({ error: "unknown school" }, 404);
  c.set("db", db);
  c.set("schoolId", s.id);
  await next();
});
tenant.get("/config", (c) => c.json({ schoolId: c.get("schoolId") })); // branding config goes here
app.route("/api/v1/:school", tenant);

export default {
  fetch: app.fetch,
  // daily ping so Supabase free tier never pauses
  scheduled: async (_e: ScheduledController, env: Env["Bindings"]) => {
    await withTenant(connect(env.DATABASE_URL), "00000000-0000-0000-0000-000000000000", async () => {});
  },
};
