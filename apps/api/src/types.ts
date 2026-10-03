import type { Db, school } from "@sms/db";
import type { Auth, Bindings } from "./auth.ts";
import type { Role } from "./rbac.ts";

export type Env = {
  Bindings: Bindings;
  Variables: {
    db: Db;
    auth: Auth;
    school: typeof school.$inferSelect;
    schoolId: string;
    slug: string;
    userId: string;
    roles: Role[];
    impersonating: boolean;
  };
};
