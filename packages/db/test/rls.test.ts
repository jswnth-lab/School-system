import { test } from "node:test";
import assert from "node:assert/strict";
import { db, school, academicYear, withTenant } from "../src/index.ts";

// Needs DATABASE_URL pointing at a migrated DB whose role lacks BYPASSRLS.
test("tenant cannot read another tenant's rows", async () => {
  const [a, b] = await db.insert(school).values([
    { slug: `a-${Date.now()}`, name: "A" },
    { slug: `b-${Date.now()}`, name: "B" },
  ]).returning();
  await withTenant(a.id, (tx) => tx.insert(academicYear).values({ schoolId: a.id, name: "2026" }));
  const rows = await withTenant(b.id, (tx) => tx.select().from(academicYear));
  assert.equal(rows.length, 0);
});
