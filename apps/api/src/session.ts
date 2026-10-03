import { eq } from "drizzle-orm";
import { membership, auditLog, withTenant } from "@sms/db";

export const session = async (c: any, next: any) => {
  const s = await c.get("auth").api.getSession({ headers: c.req.raw.headers });
  if (!s) return c.json({ error: "unauthenticated" }, 401);
  const rows = await withTenant(c.get("db"), c.get("schoolId"), (tx) =>
    tx.select({ role: membership.role }).from(membership).where(eq(membership.userId, s.user.id)),
  );
  // Platform admins act as principal in any school; every non-GET request is audited.
  const impersonating = !rows.length && !!s.user.platformAdmin;
  if (!rows.length && !impersonating) return c.json({ error: "forbidden" }, 403); // valid session, not a member of this school
  c.set("userId", s.user.id);
  c.set("roles", impersonating ? ["principal"] : rows.map((r: { role: string }) => r.role));
  c.set("impersonating", impersonating);
  await next();
  if (impersonating && c.req.method !== "GET") {
    await withTenant(c.get("db"), c.get("schoolId"), (tx) =>
      tx.insert(auditLog).values({
        schoolId: c.get("schoolId"), actorUserId: s.user.id, action: "impersonation.write",
        meta: { method: c.req.method, path: new URL(c.req.url).pathname, status: c.res.status },
      }),
    );
  }
};

