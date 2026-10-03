import type { Auth } from "./auth.ts";

// Students without email sign in with a username; stored as a synthetic address unique per school.
export const emailFor = (slug: string, identifier: string) =>
  identifier.includes("@") ? identifier.toLowerCase() : `${identifier.toLowerCase()}@${slug}.users.invalid`;

export async function createCredentialUser(auth: Auth, v: { email: string; name: string; password: string; verified?: boolean }) {
  const ctx = await auth.$context;
  const u = await ctx.internalAdapter.createUser({ email: v.email, name: v.name, emailVerified: !!v.verified }, { method: "admin" });
  await ctx.internalAdapter.linkAccount({ userId: u.id, providerId: "credential", accountId: u.id, password: await ctx.password.hash(v.password) });
  return u;
}
