import NetInfo from "@react-native-community/netinfo";
import { AppState } from "react-native";
import { createQueue } from "./queue-core";
import { rawFetch } from "./api";
import { kv } from "./storage";

export const queue = createQueue(kv);

/** Queue a write for a school path; it is sent now if online, otherwise when the connection returns. */
export async function queueWrite(school: string, method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown) {
  await queue.add({ method, path: `/${school}${path}`, body });
  flushQueue();
}

export const flushQueue = () => queue.flush(async (j) => ({ status: (await rawFetch(j.path, { method: j.method, body: j.body })).status }));

/** Flush when the network comes back and when the app returns to the foreground. Returns an unsubscribe. */
export function startQueueSync() {
  const net = NetInfo.addEventListener((s) => { if (s.isConnected) flushQueue(); });
  const app = AppState.addEventListener("change", (s) => { if (s === "active") flushQueue(); });
  flushQueue();
  return () => { net(); app.remove(); };
}
