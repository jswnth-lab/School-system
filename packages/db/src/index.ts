import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "./schema.ts";

export * from "./schema.ts";

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });

/** Run fn inside a transaction scoped to one school; RLS enforces isolation. */
export function withTenant<T>(schoolId: string, fn: (tx: typeof db) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.school_id', ${schoolId}, true)`);
    return fn(tx as unknown as typeof db);
  });
}
