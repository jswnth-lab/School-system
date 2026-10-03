import { API_URL } from "./config";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

let token: string | null = null;
let onUnauthorized: () => void = () => {};
export const setToken = (t: string | null) => { token = t; };
export const getToken = () => token;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

/** Low-level fetch against /api/v1 with the bearer token. Throws only on network failure. */
export function rawFetch(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}) {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (token && init.auth !== false) headers.authorization = `Bearer ${token}`;
  return fetch(`${API_URL}/api/v1${path}`, { method: init.method ?? (init.body !== undefined ? "POST" : "GET"), headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined });
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await rawFetch(path, init);
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && token) onUnauthorized();
  if (!r.ok) throw new ApiError(r.status, data.error ?? `request failed (${r.status})`);
  return data as T;
}
