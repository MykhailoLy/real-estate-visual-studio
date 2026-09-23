"use client";

import type { DeliveryPreferencesData } from "@/components/order/DeliveryPreferences";
import type { OrderTermsData } from "@/components/order/OrderTermsBlock";
import { TERMS_VERSION } from "@/lib/order-terms";
import { EARLY_PERFORMANCE_VERSION } from "@/lib/early-performance";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { readBrowserCurrency } from "@/lib/currency";
import {
  ORDER_FILES_BUCKET,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  pendingTokenForSubmissionId,
} from "@/lib/upload-config";
import { validateReferenceFiles } from "@/lib/reference-files";
import { canonicalJson } from "@/lib/orders/canonical-json";
import type { PricingSnapshot } from "@/lib/pricing/types";
import type { PricingExpectation } from "@/lib/pricing/expectation";
import {
  clearRecordIfCurrent,
  ORDER_SUBMISSION_RECOVERY_EVENT,
  ORDER_SUBMISSION_SERVICE_TYPES,
  readOrderSubmissionRecord,
  readOrderSubmissionRequestBody,
  recoverAnyAmbiguousOrderSubmission,
  writeOrderSubmissionRecord,
  type OrderSubmissionRecoveryResult,
  type OrderSubmissionSessionRecord,
} from "@/lib/orders/submission-recovery";

// ============================================================
// CLIENT-SIDE ORDER SUBMISSION
//
// Files are uploaded DIRECTLY to Supabase Storage via signed upload
// URLs issued by /api/upload-url. The order itself (lightweight JSON
// metadata, including a reference to each uploaded file's storage
// path) is then POSTed to /api/order.
//
// IDENTITY: the order forms no longer collect or send any contact
// fields. /api/order and /api/upload-url require a verified Supabase
// session and source client identity server-side from the session +
// client_profiles. The browser never sends name/email/phone/company
// or user_id.
// ============================================================

export interface OrderSubmitResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  recovered?: boolean;
  /**
   * Whether the post-submit client confirmation email was actually
   * sent. Only `true` when the API reports the Resend send was
   * accepted; `false` when email is unconfigured or failed. The order
   * itself succeeds independently of this flag.
   */
  confirmationEmailSent?: boolean;
  /** Human-readable error message, if any. Always set when !success. */
  error?: string;
  /**
   * Stable code so the UI can change copy or styling without parsing
   * the message. See `OrderErrorCode` for the closed set.
   */
  errorCode?: OrderErrorCode;
  /** Trusted current quote returned when an uncommitted submission price changed. */
  currentPricingSnapshot?: PricingSnapshot;
}

export type OrderErrorCode =
  | "file-too-large"
  | "file-type-not-allowed"
  | "upload-url-failed"
  | "upload-failed"
  | "payload-too-large"
  | "validation-failed"
  | "unauthorized"
  | "profile-incomplete"
  | "custom-quote-required"
  | "in-progress"
  | "submission-conflict"
  | "submission-unavailable"
  | "retry-required"
  | "pricing-changed"
  | "client-upgrade-required"
  | "server-error"
  | "network-error";

interface FileRef {
  file: File | null;
  referenceFile?: File | null;
  referenceFiles?: File[];
}

interface UploadedFileRef {
  bucket: string;
  path: string;
  originalFilename: string;
  size: number;
  mimeType: string;
}

interface UploadedReferenceFileRef extends UploadedFileRef {
  referenceId: string;
  position: number;
}

type UploadedItemFiles = Array<{
  original: UploadedFileRef;
  reference: UploadedFileRef | null;
  references: UploadedReferenceFileRef[];
}>;

/**
 * Ask the server for a signed Supabase Storage upload URL. The server
 * validates size + mime type before issuing one, so a 4xx here means
 * the file itself is rejected.
 */
async function requestSignedUploadUrl(params: {
  submissionId: string;
  serviceType: string;
  pendingToken: string;
  itemIndex: number;
  kind: "original" | "reference";
  file: File;
  referenceId?: string;
  referencePosition?: number;
}): Promise<
  | { ok: true; data: { bucket: string; path: string; token: string; signedUrl: string } }
  | { ok: false; status: number; message: string }
> {
  const {
    submissionId,
    serviceType,
    pendingToken,
    itemIndex,
    kind,
    file,
    referenceId,
    referencePosition,
  } = params;

  let response: Response;
  try {
    response = await fetch("/api/upload-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        submissionId,
        serviceType,
        pendingToken,
        itemIndex,
        kind,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        referenceId,
        referencePosition,
      }),
    });
  } catch {
    return { ok: false, status: 0, message: "Network error" };
  }

  let payload: { error?: string; bucket?: string; path?: string; token?: string; signedUrl?: string } = {};
  try {
    payload = await response.json();
  } catch {
    // fall through; we'll surface the status code
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: payload.error || `Upload URL request failed (${response.status}).`,
    };
  }

  if (!payload.bucket || !payload.path || !payload.token || !payload.signedUrl) {
    return {
      ok: false,
      status: response.status,
      message: "Upload URL response was malformed.",
    };
  }

  return {
    ok: true,
    data: {
      bucket: payload.bucket,
      path: payload.path,
      token: payload.token,
      signedUrl: payload.signedUrl,
    },
  };
}

/**
 * Upload a single file straight to Supabase Storage using a signed
 * upload URL. This call goes browser -> Supabase, NOT through Vercel.
 */
async function uploadOneFile(args: {
  file: File;
  path: string;
  token: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { file, path, token } = args;
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.storage
    .from(ORDER_FILES_BUCKET)
    .uploadToSignedUrl(path, token, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) {
    return { ok: false, message: error.message || "Storage upload failed." };
  }
  return { ok: true };
}

/**
 * Pre-flight a single File and (if a referenceFile is present) the
 * reference too. Local-only; mirrors the server cap so we can fail
 * fast with a clear message before doing any network work.
 */
function localFileCheck(
  itemIndex: number,
  file: File | null,
  referenceFile: File | null | undefined
): { ok: true } | { ok: false; code: OrderErrorCode; message: string } {
  if (!file) {
    return {
      ok: false,
      code: "validation-failed",
      message: `Item ${itemIndex + 1} is missing an uploaded file.`,
    };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      code: "file-too-large",
      message: `Item ${itemIndex + 1}: "${file.name}" is ${(file.size / (1024 * 1024)).toFixed(
        2
      )} MB which exceeds the ${MAX_FILE_SIZE_MB} MB limit. Please use a smaller image.`,
    };
  }
  if (referenceFile && referenceFile.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      code: "file-too-large",
      message: `Item ${itemIndex + 1} reference image "${referenceFile.name}" is ${(referenceFile.size /
        (1024 * 1024)
      ).toFixed(2)} MB which exceeds the ${MAX_FILE_SIZE_MB} MB limit.`,
    };
  }
  return { ok: true };
}

/**
 * Submit an order.
 *
 * Flow:
 *   1. Local file size check.
 *   2. For each item: ask /api/upload-url for a signed URL, upload the
 *      file (and optional reference) directly to Supabase Storage.
 *   3. POST a JSON-only metadata payload to /api/order with the
 *      uploaded file descriptors.
 *
 * Errors are always returned as { success: false, error, errorCode }
 * rather than thrown, so the order pages can render them inline.
 */
let submissionInFlight = false;

export async function submitOrder(
  ...args: Parameters<typeof submitOrderOnce>
): Promise<OrderSubmitResult> {
  return withSubmissionLock(() => submitOrderOnce(...args));
}

/** Explicitly retry only the original saved request, never the current form. */
export async function retryOrderSubmission(serviceType: string): Promise<OrderSubmitResult> {
  return withSubmissionLock(async () => {
    const recovery = await recoverAnyAmbiguousOrderSubmission();
    if (recovery.status !== "retryable" || recovery.serviceType !== serviceType || !recovery.canRetry) {
      return resultFromRecovery(recovery) ?? {
        success: false, errorCode: "submission-unavailable",
        error: "The original submission details are unavailable. Check the order status before continuing.",
      };
    }
    const record = readOrderSubmissionRecord(serviceType);
    if (!record || record.submissionId !== recovery.submissionId) {
      return { success: false, errorCode: "submission-conflict", error: "The submission context changed. Check its status again." };
    }
    return postStoredOrder(serviceType, record, "recovery");
  });
}

async function withSubmissionLock(action: () => Promise<OrderSubmitResult>): Promise<OrderSubmitResult> {
  if (submissionInFlight) return {
    success: false, errorCode: "in-progress", error: "Your order submission is already in progress.",
  };
  submissionInFlight = true;
  try {
    return await action();
  } finally {
    submissionInFlight = false;
    // A failed direct attempt can happen while the form is already mounted.
    // Let the existing layout show recovery without a reload or polling loop.
    const needsRecovery = ORDER_SUBMISSION_SERVICE_TYPES.some((serviceType) => {
      const stage = readOrderSubmissionRecord(serviceType)?.stage;
      return stage === "uploaded" || stage === "ambiguous";
    });
    if (needsRecovery && typeof window !== "undefined") {
      window.dispatchEvent(new Event(ORDER_SUBMISSION_RECOVERY_EVENT));
    }
  }
}

function resultFromRecovery(recovery: OrderSubmissionRecoveryResult): OrderSubmitResult | null {
  if (recovery.status === "none") return null;
  if (recovery.status === "committed") return {
    success: true, orderId: recovery.orderId, orderNumber: recovery.orderNumber,
    recovered: true, confirmationEmailSent: false,
  };
  if (recovery.status === "processing") return {
    success: false, errorCode: "in-progress",
    error: "Your previous order submission is still processing. Check again in a moment.",
  };
  if (recovery.status === "retryable") return {
    success: false, errorCode: "retry-required",
    error: "Recover the original submission before starting another order. Its original details and submission ID have been retained.",
  };
  if (recovery.status === "unauthorized") return {
    success: false, errorCode: "unauthorized", error: "Please sign in to recover the previous order submission.",
  };
  return {
    success: false, errorCode: "server-error",
    error: "The previous order outcome could not be confirmed. No new submission was started.",
  };
}

async function submitOrderOnce(
  serviceType: string,
  items: Record<string, unknown>[],
  files: FileRef[],
  orderTerms: OrderTermsData,
  /**
   * Required order-level Job Title. Sent as a top-level field (NOT item
   * metadata). Trimmed before submission; the server re-validates it
   * (3–120 trimmed chars) and persists it to orders.job_title.
   */
  jobTitle: string,
  deliveryPreferences?: DeliveryPreferencesData,
  pricingExpectation?: PricingExpectation,
): Promise<OrderSubmitResult> {
  // Reconcile a previous unknown outcome before reading the current form or
  // requiring browser File objects. This is also a defense-in-depth guard for
  // callers outside the shared new-order recovery layout.
  const recovery = await recoverAnyAmbiguousOrderSubmission();
  const recoveryResult = resultFromRecovery(recovery);
  if (recoveryResult) return recoveryResult;

  if (!orderTerms.accepted || !orderTerms.earlyPerformanceRequested) {
    return {
      success: false,
      error:
        "Accept the Terms and request the confirmed-payment start of service before submitting.",
      errorCode: "validation-failed",
    };
  }

  // ---- 1. Local pre-flight ----
  for (let i = 0; i < files.length; i++) {
    const references = (
      files[i].referenceFiles ??
      (files[i].referenceFile ? [files[i].referenceFile] : [])
    ).filter((file): file is File => Boolean(file));
    const check = localFileCheck(i, files[i].file, references[0] ?? null);
    if (!check.ok) {
      return { success: false, error: check.message, errorCode: check.code };
    }
    const referenceErrors = validateReferenceFiles(
      references.map((file) => ({
        filename: file.name,
        fileSize: file.size,
        mimeType: file.type,
      })),
    );
    if (referenceErrors.length > 0) {
      return {
        success: false,
        error: referenceErrors[0],
        errorCode: "validation-failed",
      };
    }
  }

  const currency = readBrowserCurrency();
  const intentHash = await browserSha256({
    serviceType,
    currency,
    jobTitle: jobTitle.trim(),
    termsVersion: TERMS_VERSION,
    termsAccepted: orderTerms.accepted,
    earlyPerformanceVersion: EARLY_PERFORMANCE_VERSION,
    earlyPerformanceRequested: orderTerms.earlyPerformanceRequested,
    portfolioAllowed: orderTerms.allowPortfolio,
    deliveryPreferences: deliveryPreferences ?? null,
    pricingExpectation: pricingExpectation ?? null,
    items,
    files: files.map((slot) => ({
      original: fileIdentity(slot.file),
      references: (slot.referenceFiles ?? (slot.referenceFile ? [slot.referenceFile] : []))
        .filter((file): file is File => Boolean(file))
        .map(fileIdentity),
    })),
  });
  const previous = readOrderSubmissionRecord<UploadedItemFiles>(serviceType);
  if (previous && previous.intentHash !== intentHash && previous.stage === "ambiguous") {
    return {
      success: false,
      error: "The previous order outcome is still unknown. Refresh to recover it before submitting changed details.",
      errorCode: "submission-conflict",
    };
  }
  const record: OrderSubmissionSessionRecord<UploadedItemFiles> = previous?.intentHash === intentHash
    ? previous
    : {
        submissionId: crypto.randomUUID(),
        intentHash,
        stage: "allocated",
        referenceIds: files.map((slot) =>
          (slot.referenceFiles ?? (slot.referenceFile ? [slot.referenceFile] : []))
            .filter(Boolean)
            .map(() => crypto.randomUUID()),
        ),
      };
  if (!writeOrderSubmissionRecord(serviceType, record)) return storageUnavailableResult();
  const pendingToken = pendingTokenForSubmissionId(record.submissionId);
  if (!pendingToken) {
    return { success: false, error: "Could not allocate order submission.", errorCode: "server-error" };
  }

  // ---- 2. Upload each file directly to Supabase Storage ----
  const itemFiles: UploadedItemFiles = record.itemFiles ? [...record.itemFiles] : [];

  if (!record.itemFiles) for (let i = 0; i < files.length; i++) {
    const { file } = files[i];
    const referenceFiles = (
      files[i].referenceFiles ??
      (files[i].referenceFile ? [files[i].referenceFile] : [])
    ).filter((referenceFile): referenceFile is File => Boolean(referenceFile));
    if (!file) {
      // Already covered by localFileCheck, but TypeScript narrows here.
      return {
        success: false,
        error: `Item ${i + 1} is missing an uploaded file.`,
        errorCode: "validation-failed",
      };
    }

    // -- original --
    const origUrl = await requestSignedUploadUrl({
      submissionId: record.submissionId,
      serviceType,
      pendingToken,
      itemIndex: i,
      kind: "original",
      file,
    });
    if (!origUrl.ok) {
      return {
        success: false,
        error: origUrl.message,
        errorCode:
          origUrl.status === 401
            ? "unauthorized"
            : origUrl.status === 413
            ? "payload-too-large"
            : origUrl.status === 400
            ? "file-type-not-allowed"
            : origUrl.status === 0
            ? "network-error"
            : "upload-url-failed",
      };
    }
    const origUpload = await uploadOneFile({
      file,
      path: origUrl.data.path,
      token: origUrl.data.token,
    });
    if (!origUpload.ok) {
      return {
        success: false,
        error: `Upload failed for item ${i + 1}: ${origUpload.message}`,
        errorCode: "upload-failed",
      };
    }

    const originalRef: UploadedFileRef = {
      bucket: origUrl.data.bucket,
      path: origUrl.data.path,
      originalFilename: file.name,
      size: file.size,
      mimeType: file.type || "application/octet-stream",
    };

    // -- reference (optional) --
    const referenceRefs: UploadedReferenceFileRef[] = [];
    for (
      let referencePosition = 0;
      referencePosition < referenceFiles.length;
      referencePosition += 1
    ) {
      const referenceFile = referenceFiles[referencePosition];
      const referenceId = record.referenceIds[i]?.[referencePosition];
      if (!referenceId) {
        return { success: false, error: "Could not allocate reference upload.", errorCode: "server-error" };
      }
      const refUrl = await requestSignedUploadUrl({
        submissionId: record.submissionId,
        serviceType,
        pendingToken,
        itemIndex: i,
        kind: "reference",
        file: referenceFile,
        referenceId,
        referencePosition,
      });
      if (!refUrl.ok) {
        return {
          success: false,
          error: `Reference image upload could not start for item ${i + 1}: ${refUrl.message}`,
          errorCode:
            refUrl.status === 401
              ? "unauthorized"
              : refUrl.status === 413
              ? "payload-too-large"
              : refUrl.status === 400
              ? "file-type-not-allowed"
              : refUrl.status === 0
              ? "network-error"
              : "upload-url-failed",
        };
      }
      const refUpload = await uploadOneFile({
        file: referenceFile,
        path: refUrl.data.path,
        token: refUrl.data.token,
      });
      if (!refUpload.ok) {
        return {
          success: false,
          error: `Reference image upload failed for item ${i + 1}: ${refUpload.message}`,
          errorCode: "upload-failed",
        };
      }
      referenceRefs.push({
        bucket: refUrl.data.bucket,
        path: refUrl.data.path,
        originalFilename: referenceFile.name,
        size: referenceFile.size,
        mimeType: referenceFile.type || "application/octet-stream",
        referenceId,
        position: referencePosition,
      });
    }

    itemFiles.push({
      original: originalRef,
      reference: null,
      references: referenceRefs,
    });
  }
  if (!record.itemFiles) {
    record.itemFiles = itemFiles;
    record.stage = "uploaded";
    writeOrderSubmissionRecord(serviceType, record);
  }

  // ---- 3. Submit lightweight order metadata ----
  const payload = {
    submissionId: record.submissionId,
    serviceType,
    currency,
    // Order-level Job Title — trimmed here, re-validated + persisted
    // server-side. Kept separate from item metadata on purpose.
    jobTitle: jobTitle.trim(),
    termsAcceptance: {
      accepted: orderTerms.accepted,
      version: TERMS_VERSION,
      // Replaced server-side, kept here only so older server builds
      // that still validated the field don't reject the request.
      acceptedAt: new Date().toISOString(),
    },
    earlyPerformanceRequest: {
      requested: orderTerms.earlyPerformanceRequested,
      version: EARLY_PERFORMANCE_VERSION,
    },
    pricingExpectation,
    portfolioPermission: {
      allowed: orderTerms.allowPortfolio,
    },
    deliveryPreferences: deliveryPreferences
      ? {
          fileSizeLimit: deliveryPreferences.fileSizeLimit || "",
          disclaimerText: deliveryPreferences.disclaimerText || "",
        }
      : undefined,
    items,
    itemFiles,
  };

  record.requestBody = JSON.stringify(payload);
  return postStoredOrder(serviceType, record, "fresh");
}

function storageUnavailableResult(): OrderSubmitResult {
  return {
    success: false, errorCode: "server-error",
    error: "Your browser could not save the order recovery details. Allow session storage before submitting. No order request was sent.",
  };
}

async function postStoredOrder(
  serviceType: string,
  record: OrderSubmissionSessionRecord,
  attempt: "fresh" | "recovery",
): Promise<OrderSubmitResult> {
  const body = readOrderSubmissionRequestBody(serviceType, record);
  if (!body) return {
    success: false, errorCode: "submission-unavailable",
    error: "The original order details could not be restored. Check the submission status or contact support.",
  };
  // This synchronous durable write MUST precede the mutating fetch. A reload
  // can occur before fetch settles, including before the server's first claim.
  record.stage = "ambiguous";
  if (!writeOrderSubmissionRecord(serviceType, record)) {
    // This fresh attempt never called POST. Its uploaded record must not trap
    // the mounted form in legacy recovery. A replay may have an older POST
    // still running, so its context must survive even this local failure.
    if (attempt === "fresh") clearRecordIfCurrent(serviceType, record.submissionId);
    return storageUnavailableResult();
  }

  let response: Response;
  try {
    response = await fetch("/api/order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
  } catch {
    return {
      success: false,
      error:
        "The order response was interrupted. Check its status before retrying the original submission.",
      errorCode: "network-error",
    };
  }

  // 413 should not happen now (payload is small JSON), but if some
  // proxy still flags it we want a precise message instead of the old
  // generic "Network error".
  if (response.status === 413) {
    return {
      success: false,
      error:
        "Order payload was rejected as too large. Please contact support — this should not happen with file uploads now handled separately.",
      errorCode: "payload-too-large",
    };
  }

  let result: {
    error?: string;
    code?: string;
    orderId?: string;
    orderNumber?: string;
    details?: unknown;
    currentPricingSnapshot?: PricingSnapshot;
    emailNotifications?: {
      clientConfirmation?: boolean;
      adminNotification?: boolean;
    };
  } = {};
  try {
    const parsed: unknown = await response.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) result = parsed;
  } catch {
    // Empty / non-JSON body: fall through and surface status code.
  }
  // A malformed error response must not put an object into the recovery UI.
  if (typeof result.error !== "string") result.error = undefined;

  if (!response.ok) {
    // Only the first POST on this page can establish a definitive rejection.
    // A replay's rejection says nothing about an earlier unknown request.
    if (attempt === "fresh" && isDefinitiveOrderRejection(response.status, result.code, result.error)) {
      clearRecordIfCurrent(serviceType, record.submissionId);
    }
    // Not signed in (or session expired) → caller sends user to login.
    if (response.status === 401) {
      return {
        success: false,
        error: result.error || "Please sign in to submit your order.",
        errorCode: "unauthorized",
      };
    }
    // Profile missing required fields → caller sends user to profile completion.
    if (result.code === "profile-incomplete") {
      return {
        success: false,
        error:
          result.error ||
          "Please complete your profile before submitting an order.",
        errorCode: "profile-incomplete",
      };
    }
    if (result.code === "custom-quote-required") {
      return {
        success: false,
        error:
          result.error ||
          "This order quantity requires a custom quote. Please contact us.",
        errorCode: "custom-quote-required",
      };
    }
    if (result.code === "pricing_changed") {
      // Keep the authoritative snapshot available to the existing form's
      // confirmation flow. Recovery replays retain their original identity.
      return {
        success: false,
        error: result.error || "Pricing changed. Review the updated total and confirm again.",
        errorCode: "pricing-changed",
        currentPricingSnapshot: result.currentPricingSnapshot,
      };
    }
    if (result.code === "submission_in_progress") {
      return {
        success: false,
        error: result.error || "This order is still processing. Retry in a moment.",
        errorCode: "in-progress",
      };
    }
    if (result.code === "submission_payload_conflict") {
      return {
        success: false,
        error: result.error || "This submissionId belongs to different order details.",
        errorCode: "submission-conflict",
      };
    }
    if (result.code === "submission_unavailable") {
      return {
        success: false,
        error: result.error || "This submission is unavailable for the current account. Sign in with the account that started it.",
        errorCode: "submission-unavailable",
      };
    }
    if (result.code === "client_upgrade_required") {
      return {
        success: false,
        error: result.error || "Refresh before submitting this order.",
        errorCode: "client-upgrade-required",
      };
    }
    if (response.status >= 500) {
      return {
        success: false,
        error:
          result.error || "Order submit failed (server error). Please try again in a moment.",
        errorCode: "server-error",
      };
    }
    return {
      success: false,
      error: result.error || "Order validation failed. Please review your order and try again.",
      errorCode: "validation-failed",
    };
  }

  if (typeof result.orderId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.orderId) ||
      typeof result.orderNumber !== "string" || !result.orderNumber.trim()) {
    return {
      success: false,
      error: "The order result could not be confirmed. Check its status before retrying.",
      errorCode: "server-error",
    };
  }

  clearRecordIfCurrent(serviceType, record.submissionId);
  return {
    success: true,
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    confirmationEmailSent: result.emailNotifications?.clientConfirmation === true,
  };
}

function isDefinitiveOrderRejection(status: number, code: string | undefined, error: string | undefined): boolean {
  if (!error?.trim()) return false;
  if (status === 409) {
    return code === "pricing_changed" || code === "client_upgrade_required" || code === "custom-quote-required";
  }
  if (status === 422) return code === "profile-incomplete";
  if (status !== 400) return false;
  // The route's uncoded validation responses and these service validation
  // codes precede order creation. Do not include invalid_upload: it can mean
  // ownership ambiguity. Unknown codes, malformed responses and 5xx stay held.
  return code === undefined || [
    "invalid_input",
    "unknown-option-id",
    "duplicate-option-id",
    "missing-renovation-option",
    "invalid-quantity",
    "unknown-floor-plan-type",
    "missing-photo-editing-option",
    "invalid-base-option-id",
  ].includes(code);
}

async function browserSha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fileIdentity(file: File | null) {
  return file ? {
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    lastModified: file.lastModified,
  } : null;
}
