import type {
  DraftFinalizationStatusDto,
  DraftFinalizationPublicErrorCode,
} from "./finalization.ts";

export interface SubmitOrderDraftSuccess {
  orderNumber: string;
  orderId: string;
  draftId: string;
  alreadyFinalized: boolean;
  confirmationEmailSent: boolean;
}

export type SubmitVirtualStagingDraftSuccess = SubmitOrderDraftSuccess;

export type DraftFinalizationClientErrorCode =
  | DraftFinalizationPublicErrorCode
  | "invalid_json"
  | "network_error";

export type DraftFinalizationClientResult =
  | { ok: true; data: SubmitOrderDraftSuccess }
  | {
      ok: false;
      status: number;
      code: DraftFinalizationClientErrorCode;
      message: string;
      details?: unknown;
    };

export type DraftFinalizationStatusClientResult =
  | { ok: true; data: DraftFinalizationStatusDto }
  | {
      ok: false;
      status: number;
      code: DraftFinalizationClientErrorCode;
      message: string;
      details?: unknown;
    };

interface ApiSuccess<T> {
  data?: T;
}

interface ApiError {
  error?: string;
  code?: DraftFinalizationClientErrorCode;
  details?: unknown;
}

export async function submitOrderDraft(
  draftId: string,
  expectedVersion: number,
  finalizationKey: string,
  signal?: AbortSignal,
): Promise<DraftFinalizationClientResult> {
  let response: Response;
  try {
    response = await fetch(
      `/api/order-drafts/${encodeURIComponent(draftId)}/submit`,
      {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expectedVersion, finalizationKey }),
        signal,
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    return {
      ok: false,
      status: 0,
      code: "network_error",
      message: "Network error while creating the order.",
    };
  }

  const payload = await parseApiJson(response);
  if (!response.ok) {
    const errorPayload = (payload ?? {}) as ApiError;
    return {
      ok: false,
      status: response.status,
      code: errorPayload.code ?? "unexpected_error",
      message: errorPayload.error ?? "Draft finalization failed.",
      details: errorPayload.details,
    };
  }

  const successPayload = (payload ?? {}) as ApiSuccess<SubmitOrderDraftSuccess>;
  if (!successPayload.data?.orderNumber || !successPayload.data.orderId) {
    return {
      ok: false,
      status: response.status,
      code: "unexpected_error",
      message: "Draft finalization response was malformed.",
    };
  }

  return { ok: true, data: successPayload.data };
}

export const submitVirtualStagingDraft = submitOrderDraft;

export async function getOrderDraftFinalizationStatus(
  draftId: string,
  signal?: AbortSignal,
): Promise<DraftFinalizationStatusClientResult> {
  let response: Response;
  try {
    response = await fetch(
      `/api/order-drafts/${encodeURIComponent(draftId)}/finalization-status`,
      {
        method: "GET",
        cache: "no-store",
        signal,
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    return {
      ok: false,
      status: 0,
      code: "network_error",
      message: "Network error while checking draft finalization.",
    };
  }

  const payload = await parseApiJson(response);
  if (!response.ok) {
    const errorPayload = (payload ?? {}) as ApiError;
    return {
      ok: false,
      status: response.status,
      code: errorPayload.code ?? "unexpected_error",
      message: errorPayload.error ?? "Draft finalization status failed.",
      details: errorPayload.details,
    };
  }

  const successPayload = (payload ?? {}) as ApiSuccess<DraftFinalizationStatusDto>;
  const data = successPayload.data;
  if (!isDraftFinalizationStatusDto(data)) {
    return {
      ok: false,
      status: response.status,
      code: "unexpected_error",
      message: "Draft finalization status response was malformed.",
    };
  }

  return { ok: true, data };
}

export const getVirtualStagingDraftFinalizationStatus =
  getOrderDraftFinalizationStatus;

function isDraftFinalizationStatusDto(
  data: unknown,
): data is DraftFinalizationStatusDto {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }
  const record = data as Record<string, unknown>;
  if (typeof record.status !== "string" || typeof record.draftId !== "string") {
    return false;
  }

  switch (record.status) {
    case "not_found":
      return true;
    case "active":
    case "finalization_in_progress":
      return (
        typeof record.expectedVersion === "number" &&
        Number.isInteger(record.expectedVersion) &&
        record.expectedVersion >= 1
      );
    case "reconciliation_required":
    case "already_converted":
      return (
        typeof record.expectedVersion === "number" &&
        Number.isInteger(record.expectedVersion) &&
        record.expectedVersion >= 1 &&
        typeof record.orderId === "string" &&
        typeof record.orderNumber === "string"
      );
    default:
      return false;
  }
}

async function parseApiJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
