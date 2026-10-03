import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { authTables, type Db } from "@sms/db";
import { hash, verify } from "./password.ts";

export type Bindings = { DATABASE_URL: string; BETTER_AUTH_SECRET: string; FILES: R2Bucket };

export const createAuth = (db: Db, env: Bindings, baseURL: string) =>
  betterAuth({
    baseURL,
    basePath: "/api/v1/auth",
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "pg", schema: authTables }),
    // Users are created by school admins only (no public signup).
    emailAndPassword: { enabled: true, disableSignUp: true, password: { hash, verify } },
    // platformAdmin can only be set by the create-platform-admin script (input:false blocks API writes).
    user: { additionalFields: { platformAdmin: { type: "boolean", defaultValue: false, input: false } } },
    plugins: [bearer()], // mobile apps send the session token as a Bearer header
    rateLimit: { enabled: true, storage: "database" }, // memory storage is useless across Workers isolates
    advanced: { ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] } },
  });
export type Auth = ReturnType<typeof createAuth>;
