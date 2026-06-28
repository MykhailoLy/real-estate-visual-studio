import type {
  DraftFinalizationPublicErrorCode,
} from "./finalization.ts";

export interface SubmitVirtualStagingDraftSuccess {
  orderNumber: string;
  orderId: string;
  draftId: string;
  alreadyFinalized: boolean;
  confirmationEmailSent: boolean;
}

export type DraftFinalizationClientErrorCode =
  | DraftFinalizationPublicErrorCode
  | "invalid_json"
  | "network_error";

export type DraftFinalizationClientResult =
  | { ok: true; data: SubmitVirtualStagingDraftSuccess }
  | {
      ok: false;
      status: number;
      code: DraftFinalizationClientErrorCode;
      message: string;
      details?: unknown;
    };

interface ApiSuccess {
  data?: SubmitVirtualStagingDraftSuccess;
}

interface ApiError {
  error?: string;
  code?: DraftFinalizationClientErrorCode;
  details?: unknown;
}

export async function submitVirtualStagingDraft(
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

  const successPayload = (payload ?? {}) as ApiSuccess;
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

async function parseApiJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
