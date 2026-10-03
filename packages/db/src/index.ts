import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import * as schema from "./schema.ts";

export * from "./schema.ts";

// prepare:false required for Supavisor transaction pooler.
export const connect = (url: string) => drizzle(postgres(url, { prepare: false, max: 1 }), { schema });
export type Db = ReturnType<typeof connect>;

/** Run fn in a transaction scoped to one school; RLS enforces isolation. */
export function withTenant<T>(db: Db, schoolId: string, fn: (tx: Db) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.school_id', ${schoolId}, true)`);
    return fn(tx as unknown as Db);
  });
}
