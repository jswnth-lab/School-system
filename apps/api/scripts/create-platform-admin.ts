// Usage (from apps/api): pnpm create-platform-admin you@example.com "Your Name"   (prompts for the password; or set PLATFORM_ADMIN_PASSWORD)
// Creates the platform owner login, or promotes an existing user. Sign in at POST /api/v1/auth/sign-in/email.
import { eq } from "drizzle-orm";
import { createInterface } from "node:readline";
import { connect, user } from "@sms/db";
import { createAuth } from "../src/auth.ts";
import { createCredentialUser } from "../src/users.ts";

const [email, name = "Platform Admin"] = process.argv.slice(2);
async function promptHidden(q: string) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  (rl as any)._writeToOutput = (t: string) => { if (t.includes(q)) process.stdout.write(t); }; // mute typed characters
  const a = await new Promise<string>((r) => rl.question(q, r));
  rl.close();
  process.stdout.write("\n");
  return a;
}
if (!email) { console.error("usage: pnpm create-platform-admin <email> [name]"); process.exit(1); }
const password = process.env.PLATFORM_ADMIN_PASSWORD ?? (await promptHidden("Password (12+ chars, hidden): "));
if (password.length < 12) { console.error(`password too short (${password.length} chars, need 12+)`); process.exit(1); }
const db = connect(process.env.DATABASE_URL!);
const auth = createAuth(db, { DATABASE_URL: process.env.DATABASE_URL!, BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!, FILES: null as never }, "http://localhost");
const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email.toLowerCase()));
const id = existing?.id ?? (await createCredentialUser(auth, { email: email.toLowerCase(), name, password, verified: true })).id;
await db.update(user).set({ platformAdmin: true }).where(eq(user.id, id));
console.log(existing ? "promoted existing user" : "created platform admin");
await db.$client.end();
