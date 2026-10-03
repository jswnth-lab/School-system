import { connect, user } from "@sms/db";
import { eq } from "drizzle-orm";
import { app } from "../src/app.ts";
import { createAuth } from "../src/auth.ts";
import { createCredentialUser } from "../src/users.ts";

// In-memory stand-in for the R2 binding.
const store = new Map<string, { body: ArrayBuffer; httpMetadata?: { contentType?: string } }>();
const FILES = {
  put: async (k: string, body: ArrayBuffer, o?: any) => void store.set(k, { body, httpMetadata: o?.httpMetadata }),
  get: async (k: string) => store.get(k) ?? null,
} as any;

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "test-secret-test-secret-test-secret-123",
  FILES,
};
export const db = connect(env.DATABASE_URL);
export const call = (path: string, init: RequestInit = {}) => app.request(path, init, env);
export const json = (body: unknown, extra: Record<string, string> = {}, method = "POST"): RequestInit => ({
  method, headers: { "content-type": "application/json", ...extra }, body: JSON.stringify(body),
});
export const authFor = () => createAuth(db, env, "http://localhost");

export async function makePlatformAdmin(email: string, password: string) {
  const u = await createCredentialUser(authFor(), { email, name: "Platform", password, verified: true });
  await db.update(user).set({ platformAdmin: true }).where(eq(user.id, u.id));
  return u;
}
/** Platform admins sign in through Better Auth directly (they belong to no school). */
export async function bearerFor(email: string, password: string) {
  const r = await call("/api/v1/auth/sign-in/email", json({ email, password }));
  return { authorization: `Bearer ${r.headers.get("set-auth-token")}` };
}
