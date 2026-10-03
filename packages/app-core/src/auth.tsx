import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Linking, useColorScheme } from "react-native";
import { ApiError, api, getToken, rawFetch, setToken, setUnauthorizedHandler } from "./api";
import { APP_VERSION, BAKED_SCHOOL, type AppKind } from "./config";
import { isHex, readableOn } from "./color";
import { setLocale, t } from "./i18n";
import { startQueueSync } from "./offline";
import { registerForPush, unregisterPush } from "./push";
import { isOlder } from "./semver";
import { secure } from "./storage";

export type Config = { schoolId: string; slug: string; name: string; locale: string; primaryColor: string | null; logoUrl: string | null };
export type Person = { id: string; admissionNo: string; firstName: string; lastName: string; grade: string | null; section: string | null };
export type Profile = {
  userId: string; roles: string[]; name?: string; impersonating: boolean;
  student: Person | null; teacher: { id: string; employeeNo: string; firstName: string; lastName: string } | null; children: Person[];
};
export type Status = "loading" | "needs-school" | "signed-out" | "signed-in" | "update-required" | "wrong-app" | "error";
type State = { status: Status; slug: string | null; cfg: Config | null; profile: Profile | null; message: string | null };

type Ctx = State & {
  app: AppKind;
  setSchool(code: string): Promise<void>;
  forgetSchool(): Promise<void>;
  signIn(identifier: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  retry(): void;
  theme: Theme;
  /** true when the school is fixed by the build (white-label), so there is no school switching */
  baked: boolean;
};
const AuthCtx = createContext<Ctx | null>(null);

export type Theme = { bg: string; surface: string; text: string; muted: string; line: string; accent: string; accentFg: string; danger: string; dark: boolean };
export function buildTheme(primary: string | null, dark: boolean): Theme {
  const accent = isHex(primary) ? primary : "#2457d6";
  return {
    dark, accent, accentFg: readableOn(accent),
    bg: dark ? "#0f151c" : "#f4f6f9", surface: dark ? "#18212b" : "#ffffff", text: dark ? "#e8edf2" : "#15202b",
    muted: dark ? "#93a2b2" : "#5d6b7a", line: dark ? "#28343f" : "#dbe2ea", danger: dark ? "#f2b8b5" : "#b3261e",
  };
}

const SCHOOL_KEY = "school";
const tokenKey = (slug: string) => `token:${slug}`;
const slugFromUrl = (url: string | null) => url?.match(/[?&]school=([a-z0-9-]{3,32})/)?.[1] ?? null;

export function AuthProvider({ app, roles, children }: { app: AppKind; roles: string[]; children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading", slug: null, cfg: null, profile: null, message: null });
  const scheme = useColorScheme();
  const pushToken = useRef<string | null>(null);
  const stopSync = useRef<() => void>(() => {});
  const set = (patch: Partial<State>) => setState((s) => ({ ...s, ...patch }));

  const loadProfile = useCallback(async (slug: string, cfg: Config) => {
    const profile = await api<Profile>(`/${slug}/me/profile`);
    if (!profile.roles.some((r) => roles.includes(r))) return set({ status: "wrong-app", slug, cfg, profile, message: null });
    set({ status: "signed-in", slug, cfg, profile, message: null });
    stopSync.current(); stopSync.current = startQueueSync();
    registerForPush(slug, app).then((tok) => { pushToken.current = tok; });
  }, [app, roles]);

  const boot = useCallback(async () => {
    set({ status: "loading", message: null });
    try {
      const cfgRes = await rawFetch("/app-config", { auth: false });
      const min = ((await cfgRes.json()) as { minVersion?: Record<string, string> }).minVersion?.[app];
      if (min && isOlder(APP_VERSION, min)) return set({ status: "update-required" });

      const slug = BAKED_SCHOOL ?? slugFromUrl(await Linking.getInitialURL()) ?? (await secure.get(SCHOOL_KEY));
      if (!slug) return set({ status: "needs-school", slug: null, cfg: null, profile: null });
      const r = await rawFetch(`/${slug}/config`, { auth: false });
      const body = await r.json().catch(() => ({}));
      if (r.status === 403) return set({ status: "error", message: t("suspended") });
      if (!r.ok) { await secure.del(SCHOOL_KEY); return set({ status: "needs-school", slug: null, message: t("unknownSchool") }); }
      const cfg = body as Config;
      setLocale(cfg.locale);
      await secure.set(SCHOOL_KEY, slug);
      const saved = await secure.get(tokenKey(slug));
      if (!saved) return set({ status: "signed-out", slug, cfg, profile: null });
      setToken(saved);
      try { await loadProfile(slug, cfg); }
      catch (e) {
        if (e instanceof ApiError && e.status === 401) { setToken(null); await secure.del(tokenKey(slug)); set({ status: "signed-out", slug, cfg, profile: null }); }
        else throw e;
      }
    } catch {
      set({ status: "error", message: t("offline") });
    }
  }, [app, loadProfile]);

  useEffect(() => { boot(); }, [boot]);
  useEffect(() => {
    // a 401 mid-session means the session ended (revoked, expired, password reset)
    setUnauthorizedHandler(() => { setToken(null); stopSync.current(); setState((s) => (s.status === "signed-in" ? { ...s, status: "signed-out", profile: null } : s)); });
  }, []);

  const value = useMemo<Ctx>(() => ({
    ...state, app, baked: !!BAKED_SCHOOL,
    theme: buildTheme(state.cfg?.primaryColor ?? null, scheme === "dark"),
    retry: boot,
    async setSchool(code) {
      const slug = code.trim().toLowerCase();
      const r = await rawFetch(`/${slug}/config`, { auth: false }).catch(() => { throw new Error(t("offline")); });
      if (r.status === 403) throw new Error(t("suspended"));
      if (!r.ok) throw new Error(t("unknownSchool"));
      await secure.set(SCHOOL_KEY, slug);
      await boot();
    },
    async forgetSchool() { await secure.del(SCHOOL_KEY); setToken(null); set({ status: "needs-school", slug: null, cfg: null, profile: null, message: null }); },
    async signIn(identifier, password) {
      const { slug, cfg } = state;
      if (!slug || !cfg) return;
      const r = await rawFetch(`/${slug}/login`, { body: { identifier, password }, auth: false });
      if (r.status === 429) throw new ApiError(429, t("tooMany"));
      const tok = r.headers.get("set-auth-token");
      if (!r.ok || !tok) throw new ApiError(401, t("wrongLogin"));
      await secure.set(tokenKey(slug), tok);
      setToken(tok);
      await loadProfile(slug, cfg);
    },
    async signOut() {
      const { slug } = state;
      if (slug && pushToken.current) await unregisterPush(slug, pushToken.current);
      pushToken.current = null;
      stopSync.current();
      if (getToken()) await rawFetch("/auth/sign-out", { method: "POST", body: {} }).catch(() => {});
      if (slug) await secure.del(tokenKey(slug));
      setToken(null);
      set({ status: "signed-out", profile: null });
    },
  }), [state, app, scheme, boot, loadProfile]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
export const useTheme = () => useAuth().theme;
