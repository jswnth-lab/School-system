import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { school, auditLog, withTenant } from "@sms/db";
import type { Env } from "./types.ts";

const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"]; // no SVG: scriptable, served same-origin

/** Store a school logo in R2 (key prefixed by school id). Caller has already authorized. */
export async function uploadLogo(c: Context<Env>, schoolId: string) {
  const type = c.req.header("content-type") ?? "";
  if (!LOGO_TYPES.includes(type)) return c.json({ error: "png, jpeg or webp only" }, 415);
  const buf = await c.req.arrayBuffer();
  if (buf.byteLength === 0 || buf.byteLength > 512 * 1024) return c.json({ error: "logo must be 1 B to 512 KB" }, 413);
  const db = c.get("db");
  if (!(await db.select({ id: school.id }).from(school).where(eq(school.id, schoolId))).length) return c.json({ error: "not found" }, 404);
  const key = `${schoolId}/branding/logo`;
  await c.env.FILES.put(key, buf, { httpMetadata: { contentType: type } });
  await db.update(school).set({ logoKey: key }).where(eq(school.id, schoolId));
  await withTenant(db, schoolId, (tx) =>
    tx.insert(auditLog).values({ schoolId, actorUserId: c.get("userId"), action: "school.logo", entity: "school", entityId: schoolId }),
  );
  return c.json({ ok: true });
}
