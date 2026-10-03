import { connect, withTenant } from "@sms/db";
import { app } from "./app.ts";
import type { Bindings } from "./auth.ts";

export default {
  fetch: app.fetch,
  // daily ping so the Supabase free project never pauses
  scheduled: async (_e: ScheduledController, env: Bindings) => {
    const db = connect(env.DATABASE_URL);
    await withTenant(db, "00000000-0000-0000-0000-000000000000", async () => {});
    await db.$client.end();
  },
};
