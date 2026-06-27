import { z } from "zod";
import {
  CreateOrderDraftInputSchema,
  UpdateOrderDraftInputSchema,
  UuidSchema,
} from "./schema.ts";
import { normalizeDraftListLimit } from "./database.ts";
import type {
  DraftUpdatePublicErrorCode,
  DraftUpdateResult,
  OrderDraftRepositoryErrorCode,
  OrderDraftRepositoryResult,
} from "./types.ts";

export const ORDER_DRAFT_API_MAX_BODY_BYTES = 256 * 1024;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

export const DeleteOrderDraftBodySchema = z
  .object({
    expectedVersion: z.number().int().min(1),
  })
  .strict();

export type OrderDraftApiErrorCode =
  | "unauthenticated"
  | "invalid_json"
  | "invalid_input"
  | "not_found"
  | "version_conflict"
  | "invalid_status"
  | "database_error"
  | "unexpected_error";

export interface OrderDraftApiErrorBody {
  error: string;
  code: OrderDraftApiErrorCode;
  details?: unknown;
}

export type SafeJsonParseResult =
  | { ok: true; data: unknown }
  | { ok: false; response: Response };

const REPOSITORY_STATUS: Record<OrderDraftRepositoryErrorCode, number> = {
  invalid_input: 400,
  not_found: 404,
  database_error: 500,
};

const DRAFT_UPDATE_STATUS: Record<DraftUpdatePublicErrorCode, number> = {
  invalid_input: 400,
  not_found: 404,
  version_conflict: 409,
  invalid_status: 422,
  database_error: 500,
};

export function orderDraftSuccessResponse<T>(
  data: T,
  status = 200,
): Response {
  return Response.json({ data }, { status, headers: NO_STORE_HEADERS });
}

export function orderDraftErrorResponse(
  error: string,
  code: OrderDraftApiErrorCode,
  status: number,
  details?: unknown,
): Response {
  const body: OrderDraftApiErrorBody = { error, code };
  if (details !== undefined) body.details = details;
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

export function unauthenticatedOrderDraftResponse(): Response {
  return orderDraftErrorResponse(
    "Authentication is required.",
    "unauthenticated",
    401,
  );
}

export function invalidDraftIdResponse(): Response {
  return orderDraftErrorResponse(
    "Invalid order draft identifier.",
    "invalid_input",
    400,
  );
}

export function validateDraftId(draftId: string): boolean {
  return UuidSchema.safeParse(draftId).success;
}

export function parseDraftListLimit(searchParams: URLSearchParams): number {
  const rawLimit = searchParams.get("limit");
  if (rawLimit === null || rawLimit.trim() === "") {
    return normalizeDraftListLimit();
  }
  return normalizeDraftListLimit(Number(rawLimit));
}

export async function parseOrderDraftJsonRequest(
  request: Request,
): Promise<SafeJsonParseResult> {
  const contentLength = request.headers.get("content-length");
  if (
    contentLength !== null &&
    Number(contentLength) > ORDER_DRAFT_API_MAX_BODY_BYTES
  ) {
    return {
      ok: false,
      response: orderDraftErrorResponse(
        "Request body is too large.",
        "invalid_input",
        400,
      ),
    };
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return {
      ok: false,
      response: orderDraftErrorResponse(
        "Invalid JSON body.",
        "invalid_json",
        400,
      ),
    };
  }

  if (text.length > ORDER_DRAFT_API_MAX_BODY_BYTES) {
    return {
      ok: false,
      response: orderDraftErrorResponse(
        "Request body is too large.",
        "invalid_input",
        400,
      ),
    };
  }

  try {
    const data: unknown = JSON.parse(text);
    if (containsDisallowedDraftPayloadValue(data)) {
      return {
        ok: false,
        response: orderDraftErrorResponse(
          "Draft payload cannot include embedded file data.",
          "invalid_input",
          400,
        ),
      };
    }
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      response: orderDraftErrorResponse(
        "Invalid JSON body.",
        "invalid_json",
        400,
      ),
    };
  }
}

export function createOrderDraftValidationResponse(input: unknown): Response | null {
  const result = CreateOrderDraftInputSchema.safeParse(input);
  if (result.success) return null;
  return orderDraftErrorResponse(
    "Invalid order draft input.",
    "invalid_input",
    400,
    result.error.flatten(),
  );
}

export function updateOrderDraftValidationResponse(input: unknown): Response | null {
  const result = UpdateOrderDraftInputSchema.safeParse(input);
  if (result.success) return null;
  return orderDraftErrorResponse(
    "Invalid order draft update input.",
    "invalid_input",
    400,
    result.error.flatten(),
  );
}

export function deleteOrderDraftValidationResponse(input: unknown): Response | null {
  const result = DeleteOrderDraftBodySchema.safeParse(input);
  if (result.success) return null;
  return orderDraftErrorResponse(
    "Invalid order draft delete input.",
    "invalid_input",
    400,
    result.error.flatten(),
  );
}

export function repositoryResultToResponse<T>(
  result: OrderDraftRepositoryResult<T>,
  successStatus = 200,
): Response {
  if (result.ok) return orderDraftSuccessResponse(result.data, successStatus);
  return orderDraftErrorResponse(
    result.message,
    result.code,
    REPOSITORY_STATUS[result.code],
  );
}

export function draftUpdateResultToResponse<T>(
  result: DraftUpdateResult<T>,
): Response {
  if (result.ok) {
    return orderDraftSuccessResponse(
      { draft: result.draft, version: result.version },
      200,
    );
  }
  return orderDraftErrorResponse(
    result.message,
    result.code,
    DRAFT_UPDATE_STATUS[result.code],
  );
}

export function unexpectedOrderDraftResponse(): Response {
  return orderDraftErrorResponse(
    "Order draft operation failed.",
    "unexpected_error",
    500,
  );
}

export function containsDisallowedDraftPayloadValue(value: unknown): boolean {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^data:/i.test(trimmed)) return true;
    if (
      trimmed.length > 4096 &&
      /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed) &&
      trimmed.length % 4 === 0
    ) {
      return true;
    }
    return false;
  }

  if (!value || typeof value !== "object") return false;

  if (Array.isArray(value)) {
    return value.some(containsDisallowedDraftPayloadValue);
  }

  return Object.values(value).some(containsDisallowedDraftPayloadValue);
}
