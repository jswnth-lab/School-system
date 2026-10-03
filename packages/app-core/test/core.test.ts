import { test } from "node:test";
import assert from "node:assert/strict";
import { isOlder } from "../src/semver.ts";
import { readableOn, isHex } from "../src/color.ts";
import { createQueue, type KV, type Job } from "../src/queue-core.ts";

test("isOlder compares dotted versions", () => {
  assert.equal(isOlder("1.0.0", "1.0.1"), true);
  assert.equal(isOlder("1.2", "1.10"), true);
  assert.equal(isOlder("2.0.0", "1.9.9"), false);
  assert.equal(isOlder("1.0", "1.0.0"), false);
});

test("readableOn picks a legible text color", () => {
  assert.equal(readableOn("#ffffff"), "#111111");
  assert.equal(readableOn("#0a2540"), "#ffffff");
  assert.equal(isHex("#12ab9F"), true);
  assert.equal(isHex("red"), false);
});

const memory = (): KV => { const m = new Map<string, string>(); return { get: async (k) => m.get(k) ?? null, set: async (k, v) => void m.set(k, v) }; };

test("queue keeps order, retries on failure, drops rejected jobs", async () => {
  const q = createQueue(memory());
  for (const path of ["/a", "/b", "/c", "/d"]) await q.add({ method: "POST", path });
  const seen: string[] = [];
  // offline: nothing is sent, nothing is lost
  assert.deepEqual(await q.flush(async () => { throw new Error("offline"); }), { sent: 0, dropped: 0, left: 4 });
  // /a ok, /b rejected (422, dropped), /c server error -> stop; /d must not jump ahead
  const res = await q.flush(async (j: Job) => { seen.push(j.path); return { status: j.path === "/a" ? 200 : j.path === "/b" ? 422 : 503 }; });
  assert.deepEqual(res, { sent: 1, dropped: 1, left: 2 });
  assert.deepEqual(seen, ["/a", "/b", "/c"]);
  // 401 (signed out) keeps the queue for later
  assert.equal((await q.flush(async () => ({ status: 401 }))).left, 2);
  // back online: the rest goes through in order
  const order: string[] = [];
  assert.deepEqual(await q.flush(async (j) => { order.push(j.path); return { status: 200 }; }), { sent: 2, dropped: 0, left: 0 });
  assert.deepEqual(order, ["/c", "/d"]);
  assert.equal(await q.size(), 0);
});

test("concurrent flushes share one run", async () => {
  const q = createQueue(memory());
  await q.add({ method: "POST", path: "/x" });
  let calls = 0;
  const send = async () => { calls++; await new Promise((r) => setTimeout(r, 20)); return { status: 200 }; };
  await Promise.all([q.flush(send), q.flush(send)]);
  assert.equal(calls, 1);
});
