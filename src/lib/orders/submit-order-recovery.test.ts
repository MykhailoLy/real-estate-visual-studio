import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import {
  readOrderSubmissionRecord,
  recoverAmbiguousOrderSubmission,
  writeOrderSubmissionRecord,
} from "./submission-recovery.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/supabase/browser") {
      return {
        shortCircuit: true,
        url: `data:text/javascript,${encodeURIComponent('export function createBrowserSupabaseClient(){return {storage:{from(){return {uploadToSignedUrl:async()=>({error:null})}}}}}')}`,
      };
    }
    if (specifier.startsWith("@/")) {
      const file = resolve("src", specifier.slice(2)) + ".ts";
      if (existsSync(file)) return { shortCircuit: true, url: pathToFileURL(file).href };
    }
    return nextResolve(specifier, context);
  },
});

const { submitOrder, retryOrderSubmission } = await import("../submit-order.ts");
const SERVICE = "virtual-staging";
const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
  },
});
const originalFetch = globalThis.fetch;
test.beforeEach(() => storage.clear());
test.afterEach(() => { globalThis.fetch = originalFetch; });

function barrier<T>() {
  let release!: (value: T) => void;
  const promise = new Promise<T>((resolve) => { release = resolve; });
  return { promise, release };
}

function submit() {
  return submitOrder(SERVICE, [{ roomType: "living-room" }],
    [{ file: new File(["synthetic"], "room.jpg", { type: "image/jpeg" }) }],
    { accepted: true, earlyPerformanceRequested: true, allowPortfolio: false }, "Original job");
}

function uploadUrlResponse() {
  return Response.json({ bucket: "order-files", path: "synthetic/original.jpg", token: "fixture-only", signedUrl: "http://127.0.0.1/upload" });
}

test("reload while actual POST is awaiting a response can recover the committed order", async () => {
  const entered = barrier<void>();
  const response = barrier<Response>();
  let submissionId = "";
  globalThis.fetch = async (input, init) => {
    if (String(input) === "/api/upload-url") {
      return uploadUrlResponse();
    }
    assert.equal(String(input), "/api/order");
    submissionId = JSON.parse(String(init?.body)).submissionId;
    entered.release();
    return response.promise;
  };
  const pending = submit();
  await entered.promise;
  const persistedBeforeResponse = readOrderSubmissionRecord(SERVICE);
  const recovered = await recoverAmbiguousOrderSubmission(SERVICE, async () => Response.json({
    submissionId, status: "committed", orderId: ORDER_ID, orderNumber: "VS-0042",
  }));
  response.release(Response.json({ orderId: ORDER_ID, orderNumber: "VS-0042" }));
  await pending;
  assert.equal(persistedBeforeResponse?.stage, "ambiguous", "persist uncertainty before invoking fetch");
  assert.equal(recovered.status, "committed");
});

test("released submission retries the exact saved body without File selection or new uploads", async () => {
  const bodies: string[] = [];
  let uploads = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input) === "/api/upload-url") { uploads++; return uploadUrlResponse(); }
    if (init?.method === "GET") return Response.json({
      submissionId: readOrderSubmissionRecord(SERVICE)?.submissionId, status: "retryable",
    });
    bodies.push(String(init?.body));
    return bodies.length === 1
      ? Response.json({ code: "storage_error" }, { status: 500 })
      : Response.json({ orderId: ORDER_ID, orderNumber: "VS-0042" });
  };
  assert.equal((await submit()).success, false);
  const original = readOrderSubmissionRecord(SERVICE);
  assert.equal(original?.requestBody, bodies[0]);
  assert.ok(!original?.requestBody?.includes("fixture-only"), "never persist signed upload tokens");
  const changedForm = await submitOrder("photo-editing", [{ changed: true }], [{ file: null }],
    { accepted: false, earlyPerformanceRequested: false, allowPortfolio: true }, "Changed title");
  assert.equal(changedForm.errorCode, "retry-required");
  assert.equal(bodies.length, 1, "changed intent never sends another POST");
  assert.equal((await retryOrderSubmission(SERVICE)).success, true);
  assert.deepEqual(bodies, [original?.requestBody, original?.requestBody]);
  assert.equal(uploads, 1);
  assert.equal(readOrderSubmissionRecord(SERVICE), null);
});

test("404 after response loss replays only the same ID and preserves a conflicting payload", async () => {
  const bodies: string[] = [];
  globalThis.fetch = async (input, init) => {
    if (String(input) === "/api/upload-url") return uploadUrlResponse();
    if (init?.method === "GET") return Response.json({ code: "submission_unavailable" }, { status: 404 });
    bodies.push(String(init?.body));
    if (bodies.length === 1) throw new TypeError("response lost before claim");
    return Response.json({ code: "submission_payload_conflict" }, { status: 409 });
  };
  assert.equal((await submit()).errorCode, "network-error");
  const original = readOrderSubmissionRecord(SERVICE);
  assert.equal((await retryOrderSubmission(SERVICE)).errorCode, "submission-conflict");
  assert.deepEqual(bodies, [original?.requestBody, original?.requestBody]);
  assert.equal(readOrderSubmissionRecord(SERVICE)?.submissionId, original?.submissionId);
});

test("repeated clicks cannot allocate or post a second submission while the first awaits its response", async () => {
  const entered = barrier<void>();
  const response = barrier<Response>();
  let posts = 0;
  globalThis.fetch = async (input) => {
    if (String(input) === "/api/upload-url") return uploadUrlResponse();
    posts++;
    entered.release();
    return response.promise;
  };
  const pending = submit();
  await entered.promise;
  const repeated = await submit();
  const repeatedRetry = await retryOrderSubmission(SERVICE);
  response.release(Response.json({ orderId: ORDER_ID, orderNumber: "VS-0042" }));
  await pending;
  assert.equal(repeated.errorCode, "in-progress");
  assert.equal(repeatedRetry.errorCode, "in-progress");
  assert.equal(posts, 1);
});

test("malformed POST results never claim success or lose recovery context", async () => {
  for (const response of [new Response("invalid"), Response.json(null), Response.json({ orderId: "invalid", orderNumber: 42 }), Response.json({}, { status: 503 })]) {
    storage.clear();
    globalThis.fetch = async (input) => String(input) === "/api/upload-url" ? uploadUrlResponse() : response;
    assert.equal((await submit()).success, false);
    assert.equal(readOrderSubmissionRecord(SERVICE)?.stage, "ambiguous");
    assert.ok(readOrderSubmissionRecord(SERVICE)?.requestBody);
  }
});

test("401, foreign-owner rejection and pricing rejection during retry all retain the original request", async () => {
  for (const rejection of [
    { code: "unauthorized", status: 401, expected: "unauthorized" },
    { code: "submission_unavailable", status: 404, expected: "submission-unavailable" },
    { code: "pricing_changed", status: 409, expected: "pricing-changed" },
  ]) {
    storage.clear();
    let posts = 0;
    globalThis.fetch = async (input, init) => {
      if (String(input) === "/api/upload-url") return uploadUrlResponse();
      if (init?.method === "GET") return Response.json({ code: "submission_unavailable" }, { status: 404 });
      if (++posts === 1) throw new TypeError("response lost");
      return Response.json({ code: rejection.code }, { status: rejection.status });
    };
    await submit();
    const saved = readOrderSubmissionRecord(SERVICE)?.requestBody;
    assert.equal((await retryOrderSubmission(SERVICE)).errorCode, rejection.expected);
    assert.equal(readOrderSubmissionRecord(SERVICE)?.requestBody, saved);
  }
});

test("active lease and recovery errors cannot send a retry POST", async () => {
  writeOrderSubmissionRecord(SERVICE, {
    submissionId: ID, intentHash: "a".repeat(64), stage: "ambiguous", referenceIds: [],
    requestBody: JSON.stringify({ submissionId: ID, serviceType: SERVICE, items: [], itemFiles: [] }),
  });
  for (const response of [Response.json({ submissionId: ID, status: "processing" }), new Response("invalid"), Response.json({}, { status: 401 })]) {
    globalThis.fetch = async (_input, init) => { assert.equal(init?.method, "GET"); return response; };
    assert.equal((await retryOrderSubmission(SERVICE)).success, false);
    assert.equal(readOrderSubmissionRecord(SERVICE)?.submissionId, ID);
  }
});

test("a failed durable pre-POST write prevents the mutating request", async () => {
  const originalStorage = globalThis.sessionStorage;
  let posts = 0;
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    ...originalStorage,
    setItem(key: string, value: string) {
      if (JSON.parse(value).stage === "ambiguous") throw new Error("quota exceeded");
      originalStorage.setItem(key, value);
    },
  } });
  globalThis.fetch = async (input) => {
    if (String(input) === "/api/upload-url") return uploadUrlResponse();
    posts++;
    throw new Error("must not POST");
  };
  try {
    assert.equal((await submit()).success, false);
    assert.equal(posts, 0);
  } finally {
    Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: originalStorage });
  }
});

test("legacy uploaded can already represent a committed POST", async () => {
  writeOrderSubmissionRecord(SERVICE, { submissionId: ID, intentHash: "a".repeat(64), stage: "uploaded", referenceIds: [] });
  const recovered = await recoverAmbiguousOrderSubmission(SERVICE, async () => Response.json({
    submissionId: ID, status: "committed", orderId: ORDER_ID, orderNumber: "VS-0042",
  }));
  assert.equal(recovered.status, "committed");
});

test("404 before the original POST claims does not discard its logical identity", async () => {
  writeOrderSubmissionRecord(SERVICE, { submissionId: ID, intentHash: "a".repeat(64), stage: "ambiguous", referenceIds: [] });
  await recoverAmbiguousOrderSubmission(SERVICE, async () => Response.json({ code: "submission_unavailable" }, { status: 404 }));
  assert.equal(readOrderSubmissionRecord(SERVICE)?.submissionId, ID);
});
