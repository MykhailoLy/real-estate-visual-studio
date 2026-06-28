import type {
  OrderDraftFilePublicErrorCode,
  OrderDraftUploadedFileSummary,
  PrepareOrderDraftFileUploadInput,
  PreparedOrderDraftFileUpload,
  DeletedOrderDraftFileSummary,
} from "./files.ts";
import { getSupabaseBrowser } from "../supabase.ts";
import { ORDER_FILES_BUCKET } from "../upload-config.ts";

export type OrderDraftFileClientErrorCode =
  | OrderDraftFilePublicErrorCode
  | "unauthenticated"
  | "invalid_json"
  | "network_error";

export type OrderDraftFileClientResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      status: number;
      code: OrderDraftFileClientErrorCode;
      message: string;
      details?: unknown;
    };

export type OrderDraftFileUploadResult =
  | { ok: true }
  | {
      ok: false;
      code: "invalid_input" | "storage_error";
      message: string;
    };

interface ApiSuccess<T> {
  data?: T;
}

interface ApiError {
  error?: string;
  code?: OrderDraftFileClientErrorCode;
  details?: unknown;
}

async function parseApiJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function requestOrderDraftFileApi<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<OrderDraftFileClientResult<T>> {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      cache: "no-store",
      headers: {
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    return {
      ok: false,
      status: 0,
      code: "network_error",
      message: "Network error while updating draft files.",
    };
  }

  const payload = await parseApiJson(response);
  if (!response.ok) {
    const errorPayload = (payload ?? {}) as ApiError;
    return {
      ok: false,
      status: response.status,
      code: errorPayload.code ?? "unexpected_error",
      message: errorPayload.error ?? "Draft file request failed.",
      details: errorPayload.details,
    };
  }

  const successPayload = (payload ?? {}) as ApiSuccess<T>;
  if (successPayload.data === undefined) {
    return {
      ok: false,
      status: response.status,
      code: "unexpected_error",
      message: "Draft file response was malformed.",
    };
  }

  return { ok: true, data: successPayload.data };
}

export function listOrderDraftFiles(
  draftId: string,
  signal?: AbortSignal,
): Promise<OrderDraftFileClientResult<OrderDraftUploadedFileSummary[]>> {
  return requestOrderDraftFileApi<OrderDraftUploadedFileSummary[]>(
    `/api/order-drafts/${encodeURIComponent(draftId)}/files`,
    { method: "GET", signal },
  );
}

export function prepareOrderDraftFileUpload(
  draftId: string,
  input: PrepareOrderDraftFileUploadInput,
  signal?: AbortSignal,
): Promise<OrderDraftFileClientResult<PreparedOrderDraftFileUpload>> {
  return requestOrderDraftFileApi<PreparedOrderDraftFileUpload>(
    `/api/order-drafts/${encodeURIComponent(draftId)}/files/upload-url`,
    {
      method: "POST",
      body: JSON.stringify(input),
      signal,
    },
  );
}

export function completeOrderDraftFileUpload(
  draftId: string,
  fileId: string,
  signal?: AbortSignal,
): Promise<OrderDraftFileClientResult<OrderDraftUploadedFileSummary>> {
  return requestOrderDraftFileApi<OrderDraftUploadedFileSummary>(
    `/api/order-drafts/${encodeURIComponent(draftId)}/files/${encodeURIComponent(fileId)}/complete`,
    { method: "POST", signal },
  );
}

export function deleteOrderDraftFile(
  draftId: string,
  fileId: string,
  signal?: AbortSignal,
): Promise<OrderDraftFileClientResult<DeletedOrderDraftFileSummary>> {
  return requestOrderDraftFileApi<DeletedOrderDraftFileSummary>(
    `/api/order-drafts/${encodeURIComponent(draftId)}/files/${encodeURIComponent(fileId)}`,
    { method: "DELETE", signal },
  );
}

export async function uploadPreparedOrderDraftFile(
  prepared: PreparedOrderDraftFileUpload,
  file: File,
): Promise<OrderDraftFileUploadResult> {
  if (prepared.upload.bucket !== ORDER_FILES_BUCKET) {
    return {
      ok: false,
      code: "invalid_input",
      message: "Draft upload target was not valid.",
    };
  }

  try {
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.storage
      .from(ORDER_FILES_BUCKET)
      .uploadToSignedUrl(prepared.upload.path, prepared.upload.token, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (error) {
      return {
        ok: false,
        code: "storage_error",
        message: "Could not upload this file to draft storage.",
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      code: "storage_error",
      message: "Could not upload this file to draft storage.",
    };
  }
}
