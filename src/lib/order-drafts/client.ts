import type {
  CreateOrderDraftInput,
  DraftUpdatePublicErrorCode,
  OrderDraftRow,
  UpdateOrderDraftInput,
} from "./types.ts";

export type OrderDraftClientErrorCode =
  | "unauthenticated"
  | "invalid_json"
  | "invalid_input"
  | "not_found"
  | "version_conflict"
  | "invalid_status"
  | "database_error"
  | "unexpected_error"
  | "network_error";

export type OrderDraftClientResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      status: number;
      code: OrderDraftClientErrorCode;
      message: string;
      details?: unknown;
    };

interface ApiSuccess<T> {
  data?: T;
}

interface ApiError {
  error?: string;
  code?: OrderDraftClientErrorCode;
  details?: unknown;
}

async function parseApiJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function requestOrderDraftApi<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<OrderDraftClientResult<T>> {
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
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return {
      ok: false,
      status: 0,
      code: "network_error",
      message: "Network error while saving the draft.",
    };
  }

  const payload = await parseApiJson(response);
  if (!response.ok) {
    const errorPayload = (payload ?? {}) as ApiError;
    return {
      ok: false,
      status: response.status,
      code: errorPayload.code ?? "unexpected_error",
      message: errorPayload.error ?? "Draft request failed.",
      details: errorPayload.details,
    };
  }

  const successPayload = (payload ?? {}) as ApiSuccess<T>;
  if (successPayload.data === undefined) {
    return {
      ok: false,
      status: response.status,
      code: "unexpected_error",
      message: "Draft response was malformed.",
    };
  }
  return { ok: true, data: successPayload.data };
}

export function createOrderDraft(
  input: CreateOrderDraftInput,
): Promise<OrderDraftClientResult<OrderDraftRow>> {
  return requestOrderDraftApi<OrderDraftRow>("/api/order-drafts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getOrderDraft(
  draftId: string,
  signal?: AbortSignal,
): Promise<OrderDraftClientResult<OrderDraftRow>> {
  return requestOrderDraftApi<OrderDraftRow>(
    `/api/order-drafts/${encodeURIComponent(draftId)}`,
    { method: "GET", signal },
  );
}

export function updateOrderDraft(
  draftId: string,
  input: UpdateOrderDraftInput,
): Promise<
  OrderDraftClientResult<{ draft: OrderDraftRow; version: number }>
> {
  return requestOrderDraftApi<{ draft: OrderDraftRow; version: number }>(
    `/api/order-drafts/${encodeURIComponent(draftId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function deleteOrderDraft(
  draftId: string,
  expectedVersion: number,
): Promise<
  OrderDraftClientResult<{ draft: OrderDraftRow; version: number }>
> {
  return requestOrderDraftApi<{ draft: OrderDraftRow; version: number }>(
    `/api/order-drafts/${encodeURIComponent(draftId)}`,
    {
      method: "DELETE",
      body: JSON.stringify({ expectedVersion }),
    },
  );
}

export function isOrderDraftVersionConflict(
  result: OrderDraftClientResult<unknown>,
): result is {
  ok: false;
  status: 409;
  code: Extract<DraftUpdatePublicErrorCode, "version_conflict">;
  message: string;
} {
  return !result.ok && result.status === 409 && result.code === "version_conflict";
}
