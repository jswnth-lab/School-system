import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import * as schema from "./schema.ts";

export * from "./schema.ts";
export const connect = (d1: D1Database) => drizzle(d1, { schema });

type TenantTable = SQLiteTable & { schoolId: any };

/** Only sanctioned way to touch tenant tables. D1 has no RLS, so scoping lives here. */
export function tenantDb(d1: D1Database, schoolId: string) {
  const db = connect(d1);
  return {
    select: <T extends TenantTable>(t: T, extra?: any) =>
      db.select().from(t).where(extra ? and(eq(t.schoolId, schoolId), extra) : eq(t.schoolId, schoolId)),
    insert: <T extends TenantTable>(t: T, values: Omit<T["$inferInsert"], "schoolId">) =>
      db.insert(t).values({ ...values, schoolId } as any),
    // update/delete helpers added with first use (YAGNI)
  };
}
