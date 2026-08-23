import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  readOrderSubmissionRecord,
  recoverAmbiguousOrderSubmission,
  writeOrderSubmissionRecord,
} from "./submission-recovery.ts";

const SUBMISSION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const SERVICE_TYPE = "virtual-staging";
const SUBMIT_ORDER_SOURCE = readFileSync("src/lib/submit-order.ts", "utf8");
const RECOVERY_GATE_SOURCE = readFileSync(
  "src/components/order/OrderSubmissionRecoveryGate.tsx",
  "utf8",
);
const NEW_ORDER_LAYOUT_SOURCE = readFileSync(
  "src/app/(dashboard)/dashboard/orders/new/layout.tsx",
  "utf8",
);

class MemorySessionStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

const session = new MemorySessionStorage();
Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: session,
});

test.beforeEach(() => {
  session.clear();
  writeAmbiguousRecord();
});

test("response loss after commit is recovered after reload without File objects", async () => {
  let requestedUrl = "";
  const result = await recoverAmbiguousOrderSubmission(
    SERVICE_TYPE,
    async (input) => {
      requestedUrl = String(input);
      return Response.json({
        submissionId: SUBMISSION_ID,
        status: "committed",
        orderId: ORDER_ID,
        orderNumber: "VS-0042",
      });
    },
  );

  assert.deepEqual(result, {
    status: "committed",
    submissionId: SUBMISSION_ID,
    orderId: ORDER_ID,
    orderNumber: "VS-0042",
  });
  assert.equal(
    requestedUrl,
    `/api/order/submissions/${SUBMISSION_ID}`,
  );
  assert.equal(readOrderSubmissionRecord(SERVICE_TYPE), null);
});

test("ambiguous processing remains durable and produces a wait state", async () => {
  const result = await recoverAmbiguousOrderSubmission(
    SERVICE_TYPE,
    async () => Response.json({
      submissionId: SUBMISSION_ID,
      status: "processing",
      orderId: null,
      orderNumber: null,
    }),
  );

  assert.deepEqual(result, {
    status: "processing",
    submissionId: SUBMISSION_ID,
  });
  assert.equal(
    readOrderSubmissionRecord(SERVICE_TYPE)?.submissionId,
    SUBMISSION_ID,
  );
});

test("unavailable recovery clears only the stale submission context", async () => {
  session.setItem("unrelated", "preserve-me");
  const result = await recoverAmbiguousOrderSubmission(
    SERVICE_TYPE,
    async () => Response.json(
      { status: "unavailable", code: "submission_unavailable" },
      { status: 404 },
    ),
  );

  assert.deepEqual(result, {
    status: "unavailable",
    submissionId: SUBMISSION_ID,
  });
  assert.equal(readOrderSubmissionRecord(SERVICE_TYPE), null);
  assert.equal(session.getItem("unrelated"), "preserve-me");
});

test("changed form state cannot bypass ambiguous recovery", () => {
  const recoveryIndex = SUBMIT_ORDER_SOURCE.indexOf(
    "const recovery = await recoverAnyAmbiguousOrderSubmission()",
  );
  const fileValidationIndex = SUBMIT_ORDER_SOURCE.indexOf(
    "const check = localFileCheck",
  );
  const intentIndex = SUBMIT_ORDER_SOURCE.indexOf(
    "const intentHash = await browserSha256",
  );

  assert.ok(recoveryIndex >= 0);
  assert.ok(fileValidationIndex > recoveryIndex);
  assert.ok(intentIndex > recoveryIndex);
  assert.match(RECOVERY_GATE_SOURCE, /recoverAnyAmbiguousOrderSubmission/);
  assert.match(RECOVERY_GATE_SOURCE, /window\.location\.replace/);
  assert.match(NEW_ORDER_LAYOUT_SOURCE, /OrderSubmissionRecoveryGate/);
});

test("malformed or failed recovery preserves the ambiguous context", async () => {
  const result = await recoverAmbiguousOrderSubmission(
    SERVICE_TYPE,
    async () => Response.json({
      submissionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      status: "committed",
      orderId: ORDER_ID,
      orderNumber: "VS-0042",
    }),
  );

  assert.deepEqual(result, { status: "error", submissionId: SUBMISSION_ID });
  assert.equal(
    readOrderSubmissionRecord(SERVICE_TYPE)?.submissionId,
    SUBMISSION_ID,
  );
});

function writeAmbiguousRecord(): void {
  writeOrderSubmissionRecord(SERVICE_TYPE, {
    submissionId: SUBMISSION_ID,
    intentHash: "a".repeat(64),
    stage: "ambiguous",
    referenceIds: [],
  });
}
