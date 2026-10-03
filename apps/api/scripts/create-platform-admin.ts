// Usage: PLATFORM_ADMIN_PASSWORD='...' pnpm --filter @sms/api create-platform-admin you@example.com "Your Name"
// Creates the platform owner login, or promotes an existing user. Sign in at POST /api/v1/auth/sign-in/email.
import { eq } from "drizzle-orm";
import { connect, user } from "@sms/db";
import { createAuth } from "../src/auth.ts";
import { createCredentialUser } from "../src/users.ts";

const [email, name = "Platform Admin"] = process.argv.slice(2);
const password = process.env.PLATFORM_ADMIN_PASSWORD;
if (!email || !password || password.length < 12) {
  console.error("need <email> as arg and PLATFORM_ADMIN_PASSWORD (12+ chars) in env");
  process.exit(1);
}
const db = connect(process.env.DATABASE_URL!);
const auth = createAuth(db, { DATABASE_URL: process.env.DATABASE_URL!, BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!, FILES: null as never }, "http://localhost");
const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email.toLowerCase()));
const id = existing?.id ?? (await createCredentialUser(auth, { email: email.toLowerCase(), name, password, verified: true })).id;
await db.update(user).set({ platformAdmin: true }).where(eq(user.id, id));
console.log(existing ? "promoted existing user" : "created platform admin");
await db.$client.end();
