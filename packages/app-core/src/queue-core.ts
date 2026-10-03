// Offline write queue. Pure logic with injected storage so it can be tested in Node.
// Order is preserved: a failed job blocks the ones behind it, so "mark present" then "correct to late" never swap.
export type Job = { id: string; method: "POST" | "PUT" | "PATCH" | "DELETE"; path: string; body?: unknown; at: number };
export type KV = { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void> };
/** Sends one job. Throws on network failure; otherwise returns the HTTP status. */
export type Sender = (job: Job) => Promise<{ status: number }>;
export type FlushResult = { sent: number; dropped: number; left: number };

export function createQueue(kv: KV, key = "sms.queue") {
  const load = async () => JSON.parse((await kv.get(key)) ?? "[]") as Job[];
  const save = (q: Job[]) => kv.set(key, JSON.stringify(q));
  let running: Promise<FlushResult> | null = null;

  return {
    async add(job: Omit<Job, "id" | "at">) {
      const q = await load();
      q.push({ ...job, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, at: Date.now() });
      await save(q);
    },
    async size() { return (await load()).length; },
    /** Concurrent callers share one run. 2xx = sent; other 4xx = rejected, dropped; network/5xx/401/408/429 = keep and stop. */
    flush(send: Sender): Promise<FlushResult> {
      running ??= (async () => {
        let sent = 0, dropped = 0;
        const q = await load();
        while (q.length) {
          let status: number;
          try { status = (await send(q[0])).status; } catch { break; }
          if (status >= 500 || [401, 408, 429].includes(status)) break;
          q.shift();
          if (status < 300) sent++; else dropped++;
          await save(q);
        }
        return { sent, dropped, left: q.length };
      })().finally(() => { running = null; });
      return running;
    },
  };
}
