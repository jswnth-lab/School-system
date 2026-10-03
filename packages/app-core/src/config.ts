import Constants from "expo-constants";

// Baked at build time by app.config.ts. A white-label build sets schoolSlug; the shared app leaves it empty and asks for a school code.
const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string; schoolSlug?: string };

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? "https://sms-api.jaswanthjangiti1.workers.dev";
export const BAKED_SCHOOL: string | null = extra.schoolSlug || null;
export const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";
export type AppKind = "teacher" | "student";
