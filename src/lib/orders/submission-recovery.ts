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
  | { status: "unavailable"; submissionId: string }
  | { status: "unauthorized"; submissionId: string }
  | { status: "error"; submissionId: string };

const STORAGE_PREFIX = "picchuspot:order-submission:v1:";
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
): void {
  try {
    sessionStorage.setItem(storageKey(serviceType), JSON.stringify(value));
  } catch {
    // A single attempt remains safe even when browser storage is unavailable.
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
 * Reconcile one ambiguous logical submission before any new form intent or
 * browser File is inspected. Owned state is returned by the server endpoint;
 * a 404 is deliberately indistinguishable from another user's submission.
 */
export async function recoverAmbiguousOrderSubmission(
  serviceType: string,
  request: typeof fetch = fetch,
): Promise<OrderSubmissionRecoveryResult> {
  const record = readOrderSubmissionRecord(serviceType);
  if (!record || record.stage !== "ambiguous") return { status: "none" };

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
  if (
    response.status === 404 ||
    payload?.status === "unavailable" ||
    payload?.code === "submission_unavailable"
  ) {
    clearRecordIfCurrent(serviceType, record.submissionId);
    return { status: "unavailable", submissionId: record.submissionId };
  }
  if (!response.ok || payload?.submissionId !== record.submissionId) {
    return { status: "error", submissionId: record.submissionId };
  }
  if (payload.status === "processing") {
    return { status: "processing", submissionId: record.submissionId };
  }
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
  let unavailable: OrderSubmissionRecoveryResult | null = null;
  for (const serviceType of ORDER_SUBMISSION_SERVICE_TYPES) {
    const result = await recoverAmbiguousOrderSubmission(serviceType, request);
    if (result.status === "none") continue;
    if (result.status === "unavailable") {
      unavailable = result;
      continue;
    }
    return result;
  }
  return unavailable ?? { status: "none" };
}

function storageKey(serviceType: string): string {
  return `${STORAGE_PREFIX}${serviceType}`;
}

function clearRecordIfCurrent(serviceType: string, submissionId: string): void {
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
