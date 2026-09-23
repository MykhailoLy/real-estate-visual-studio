"use client";

export type OrderSubmissionServiceType =
  | "virtual-staging"
  | "virtual-renovation"
  | "3d-floor-plans"
  | "photo-editing";

export interface OrderSubmissionSessionRecord<TItemFiles = unknown> {
  submissionId: string;
  intentHash: string;
  stage: "allocated" | "uploaded" | "ambiguous";
  referenceIds: string[][];
  itemFiles?: TItemFiles;
  /** Exact JSON sent to /api/order; never contains File bytes or upload tokens. */
  requestBody?: string;
}

export type OrderSubmissionRecoveryResult =
  | { status: "none" }
  | {
      status: "committed";
      submissionId: string;
      orderId: string;
      orderNumber: string;
    }
  | { status: "processing"; submissionId: string }
  | { status: "retryable"; submissionId: string; serviceType: string; canRetry: boolean }
  | { status: "unauthorized"; submissionId: string }
  | { status: "error"; submissionId: string };

const STORAGE_PREFIX = "picchuspot:order-submission:v1:";
export const ORDER_SUBMISSION_RECOVERY_EVENT = "picchuspot:order-submission-recovery";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export const ORDER_SUBMISSION_SERVICE_TYPES: readonly OrderSubmissionServiceType[] = [
  "virtual-staging",
  "virtual-renovation",
  "3d-floor-plans",
  "photo-editing",
];

export function readOrderSubmissionRecord<TItemFiles = unknown>(
  serviceType: string,
): OrderSubmissionSessionRecord<TItemFiles> | null {
  try {
    const value = sessionStorage.getItem(storageKey(serviceType));
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<
      OrderSubmissionSessionRecord<TItemFiles>
    >;
    if (
      typeof parsed.submissionId !== "string" ||
      !UUID_PATTERN.test(parsed.submissionId) ||
      typeof parsed.intentHash !== "string" ||
      !SHA256_PATTERN.test(parsed.intentHash) ||
      !isSubmissionStage(parsed.stage) ||
      !isReferenceIdMatrix(parsed.referenceIds)
    ) {
      return null;
    }
    return parsed as OrderSubmissionSessionRecord<TItemFiles>;
  } catch {
    return null;
  }
}

export function writeOrderSubmissionRecord<TItemFiles>(
  serviceType: string,
  value: OrderSubmissionSessionRecord<TItemFiles>,
): boolean {
  try {
    const serialized = JSON.stringify(value);
    sessionStorage.setItem(storageKey(serviceType), serialized);
    return sessionStorage.getItem(storageKey(serviceType)) === serialized;
  } catch {
    return false;
  }
}

export function clearOrderSubmissionRecord(serviceType: string): void {
  try {
    sessionStorage.removeItem(storageKey(serviceType));
  } catch {
    // Best effort only.
  }
}

/**
 * Reconcile one potentially sent logical submission before any new form intent or
 * browser File is inspected. Owned state is returned by the server endpoint;
 * a 404 is deliberately indistinguishable from another user's submission.
 */
export async function recoverAmbiguousOrderSubmission(
  serviceType: string,
  request: typeof fetch = fetch,
): Promise<OrderSubmissionRecoveryResult> {
  const record = readOrderSubmissionRecord(serviceType);
  // Older clients persisted uploaded before POST and only marked ambiguous
  // after it failed. An uploaded record can therefore already be committed.
  if (!record || record.stage === "allocated") return { status: "none" };

  let response: Response;
  try {
    response = await request(
      `/api/order/submissions/${encodeURIComponent(record.submissionId)}`,
      { method: "GET", cache: "no-store" },
    );
  } catch {
    return { status: "error", submissionId: record.submissionId };
  }

  const payload = await readRecoveryPayload(response);
  if (response.status === 401) {
    return { status: "unauthorized", submissionId: record.submissionId };
  }
  if (response.status === 404 && payload?.code === "submission_unavailable") {
    // Also covers an original POST that has not claimed yet. Never allocate a
    // new ID here. Replaying the exact original request is safe under claim;
    // foreign ownership is still checked by the authenticated POST endpoint.
    return retryableResult(serviceType, record);
  }
  if (!response.ok || payload?.submissionId !== record.submissionId) {
    return { status: "error", submissionId: record.submissionId };
  }
  if (payload.status === "processing") {
    return { status: "processing", submissionId: record.submissionId };
  }
  if (payload.status === "retryable") return retryableResult(serviceType, record);
  if (
    payload.status === "committed" &&
    typeof payload.orderId === "string" &&
    UUID_PATTERN.test(payload.orderId) &&
    typeof payload.orderNumber === "string" &&
    payload.orderNumber.trim() !== ""
  ) {
    clearRecordIfCurrent(serviceType, record.submissionId);
    return {
      status: "committed",
      submissionId: record.submissionId,
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
    };
  }
  return { status: "error", submissionId: record.submissionId };
}

/** Reconcile every supported order flow so an unknown result blocks new work. */
export async function recoverAnyAmbiguousOrderSubmission(
  request: typeof fetch = fetch,
): Promise<OrderSubmissionRecoveryResult> {
  for (const serviceType of ORDER_SUBMISSION_SERVICE_TYPES) {
    const result = await recoverAmbiguousOrderSubmission(serviceType, request);
    if (result.status === "none") continue;
    return result;
  }
  return { status: "none" };
}

/** Only replay a stored body belonging to this exact logical submission. */
export function readOrderSubmissionRequestBody(
  serviceType: string,
  record: OrderSubmissionSessionRecord,
): string | null {
  if (typeof record.requestBody !== "string") return null;
  try {
    const payload: unknown = JSON.parse(record.requestBody);
    if (!payload || typeof payload !== "object" ||
        !("submissionId" in payload) || payload.submissionId !== record.submissionId ||
        !("serviceType" in payload) || payload.serviceType !== serviceType ||
        !("items" in payload) || !Array.isArray(payload.items) ||
        !("itemFiles" in payload) || !Array.isArray(payload.itemFiles)) return null;
    return record.requestBody;
  } catch {
    return null;
  }
}

function retryableResult(
  serviceType: string,
  record: OrderSubmissionSessionRecord,
): OrderSubmissionRecoveryResult {
  return {
    status: "retryable",
    submissionId: record.submissionId,
    serviceType,
    canRetry: readOrderSubmissionRequestBody(serviceType, record) !== null,
  };
}

function storageKey(serviceType: string): string {
  return `${STORAGE_PREFIX}${serviceType}`;
}

export function clearRecordIfCurrent(serviceType: string, submissionId: string): void {
  const current = readOrderSubmissionRecord(serviceType);
  if (current?.submissionId === submissionId) {
    clearOrderSubmissionRecord(serviceType);
  }
}

function isSubmissionStage(
  value: unknown,
): value is OrderSubmissionSessionRecord["stage"] {
  return value === "allocated" || value === "uploaded" || value === "ambiguous";
}

function isReferenceIdMatrix(value: unknown): value is string[][] {
  return Array.isArray(value) && value.every(
    (row) => Array.isArray(row) && row.every(
      (referenceId) => typeof referenceId === "string" && UUID_PATTERN.test(referenceId),
    ),
  );
}

async function readRecoveryPayload(response: Response): Promise<{
  status?: unknown;
  code?: unknown;
  submissionId?: unknown;
  orderId?: unknown;
  orderNumber?: unknown;
} | null> {
  try {
    const value = await response.json();
    return value && typeof value === "object"
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}
