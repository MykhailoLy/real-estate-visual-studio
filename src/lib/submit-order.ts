"use client";

import type { DeliveryPreferencesData } from "@/components/order/DeliveryPreferences";
import type { OrderTermsData } from "@/components/order/OrderTermsBlock";
import { TERMS_VERSION } from "@/components/order/OrderTermsBlock";
import { getSupabaseBrowser } from "@/lib/supabase";
import {
  ORDER_FILES_BUCKET,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
} from "@/lib/upload-config";

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
  orderNumber?: string;
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
  | "server-error"
  | "network-error";

interface FileRef {
  file: File | null;
  referenceFile?: File | null;
}

interface UploadedFileRef {
  bucket: string;
  path: string;
  originalFilename: string;
  size: number;
  mimeType: string;
}

/**
 * Generate a short, URL-safe random token used to namespace pending
 * uploads for one submission. Uses the Web Crypto API where available
 * and falls back to Math.random for older environments.
 */
function generatePendingToken(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Ask the server for a signed Supabase Storage upload URL. The server
 * validates size + mime type before issuing one, so a 4xx here means
 * the file itself is rejected.
 */
async function requestSignedUploadUrl(params: {
  serviceType: string;
  pendingToken: string;
  itemIndex: number;
  kind: "original" | "reference";
  file: File;
}): Promise<
  | { ok: true; data: { bucket: string; path: string; token: string; signedUrl: string } }
  | { ok: false; status: number; message: string }
> {
  const { serviceType, pendingToken, itemIndex, kind, file } = params;

  let response: Response;
  try {
    response = await fetch("/api/upload-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceType,
        pendingToken,
        itemIndex,
        kind,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
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
  const supabase = getSupabaseBrowser();
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
export async function submitOrder(
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
  deliveryPreferences?: DeliveryPreferencesData
): Promise<OrderSubmitResult> {
  // ---- 1. Local pre-flight ----
  for (let i = 0; i < files.length; i++) {
    const check = localFileCheck(i, files[i].file, files[i].referenceFile ?? null);
    if (!check.ok) {
      return { success: false, error: check.message, errorCode: check.code };
    }
  }

  const pendingToken = generatePendingToken();

  // ---- 2. Upload each file directly to Supabase Storage ----
  const itemFiles: Array<{
    original: UploadedFileRef;
    reference: UploadedFileRef | null;
  }> = [];

  for (let i = 0; i < files.length; i++) {
    const { file, referenceFile } = files[i];
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
    let referenceRef: UploadedFileRef | null = null;
    if (referenceFile) {
      const refUrl = await requestSignedUploadUrl({
        serviceType,
        pendingToken,
        itemIndex: i,
        kind: "reference",
        file: referenceFile,
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
      referenceRef = {
        bucket: refUrl.data.bucket,
        path: refUrl.data.path,
        originalFilename: referenceFile.name,
        size: referenceFile.size,
        mimeType: referenceFile.type || "application/octet-stream",
      };
    }

    itemFiles.push({ original: originalRef, reference: referenceRef });
  }

  // ---- 3. Submit lightweight order metadata ----
  const payload = {
    serviceType,
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

  let response: Response;
  try {
    response = await fetch("/api/order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return {
      success: false,
      error:
        "Network error while submitting your order. Your files were uploaded — please retry the order in a moment.",
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
    orderNumber?: string;
    details?: unknown;
    emailNotifications?: {
      clientConfirmation?: boolean;
      adminNotification?: boolean;
    };
  } = {};
  try {
    result = await response.json();
  } catch {
    // Empty / non-JSON body: fall through and surface status code.
  }

  if (!response.ok) {
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

  if (!result.orderNumber) {
    return {
      success: false,
      error: "Order saved but no order number was returned. Please contact support.",
      errorCode: "server-error",
    };
  }

  return {
    success: true,
    orderNumber: result.orderNumber,
    confirmationEmailSent: result.emailNotifications?.clientConfirmation === true,
  };
}
