import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { kv, useAuth, type Person } from "@sms/app-core";

// "Who am I looking at?" A student sees themself; a parent picks one of their children (remembered per school).
type Ctx = { people: Person[]; current: Person | null; isParent: boolean; select(id: string): void };
const ChildCtx = createContext<Ctx>({ people: [], current: null, isParent: false, select: () => {} });

export function ChildProvider({ children }: { children: ReactNode }) {
  const { profile, slug } = useAuth();
  const people = useMemo(() => (profile?.student ? [profile.student] : profile?.children ?? []), [profile]);
  const [id, setId] = useState<string | null>(null);
  const key = `child:${slug}`;
  useEffect(() => { kv.get(key).then(setId); }, [key]);
  const current = people.find((p) => p.id === id) ?? people[0] ?? null;
  const value = useMemo<Ctx>(() => ({
    people, current, isParent: !profile?.student && people.length > 0,
    select: (next) => { setId(next); kv.set(key, next); },
  }), [people, current, profile, key]);
  return <ChildCtx.Provider value={value}>{children}</ChildCtx.Provider>;
}
export const useChild = () => useContext(ChildCtx);
