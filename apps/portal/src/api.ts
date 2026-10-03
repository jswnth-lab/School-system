export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

/** Same-origin JSON call; the session cookie rides along. */
export async function api<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch(`/api/v1${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: init.body ? { 'content-type': 'application/json' } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new ApiError(r.status, data.error ?? `request failed (${r.status})`)
  return data
}
