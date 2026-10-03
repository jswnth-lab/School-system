import { test, after } from "node:test";
import assert from "node:assert/strict";
import { connect, school, academicYear, withTenant } from "../src/index.ts";

// DATABASE_URL must use the non-owner app role (no BYPASSRLS), else RLS is skipped.
let db: ReturnType<typeof connect>;
after(() => db.$client.end());

test("school B cannot read school A rows", async () => {
  db = connect(process.env.DATABASE_URL!);
  const t = Date.now();
  const [a, b] = await db.insert(school).values([
    { slug: `a-${t}`, name: "A" },
    { slug: `b-${t}`, name: "B" },
  ]).returning();
  await withTenant(db, a.id, (tx) => tx.insert(academicYear).values({ schoolId: a.id, name: "2026" }));
  assert.equal((await withTenant(db, b.id, (tx) => tx.select().from(academicYear))).length, 0);
  assert.equal((await withTenant(db, a.id, (tx) => tx.select().from(academicYear))).length, 1);
});
