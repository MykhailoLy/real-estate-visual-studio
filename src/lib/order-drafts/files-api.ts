import { z } from "zod";
import { MAX_FILE_SIZE_BYTES } from "../upload-config.ts";
import {
  PrepareOrderDraftFileUploadInputSchema,
  type OrderDraftFileOperationResult,
  type OrderDraftFilePublicErrorCode,
} from "./files.ts";
import { UuidSchema } from "./schema.ts";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

const FILE_ERROR_STATUS: Record<OrderDraftFilePublicErrorCode, number> = {
  invalid_input: 400,
  not_found: 404,
  invalid_status: 422,
  version_conflict: 409,
  item_not_found: 422,
  file_too_large: 413,
  file_type_not_allowed: 400,
  storage_error: 500,
  upload_not_found: 404,
  upload_mismatch: 409,
  database_error: 500,
  unexpected_error: 500,
};

export interface OrderDraftFileApiErrorBody {
  error: string;
  code: OrderDraftFilePublicErrorCode | "unauthenticated" | "invalid_json";
  details?: unknown;
}

export type DraftFileJsonParseResult =
  | { ok: true; data: unknown }
  | { ok: false; response: Response };

export function validateDraftFileRouteId(value: string): boolean {
  return UuidSchema.safeParse(value).success;
}

export function orderDraftFileSuccessResponse<T>(
  data: T,
  status = 200,
): Response {
  return Response.json({ data }, { status, headers: NO_STORE_HEADERS });
}

export function orderDraftFileErrorResponse(
  error: string,
  code: OrderDraftFileApiErrorBody["code"],
  status: number,
  details?: unknown,
): Response {
  const body: OrderDraftFileApiErrorBody = { error, code };
  if (details !== undefined) body.details = details;
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

export function unauthenticatedDraftFileResponse(): Response {
  return orderDraftFileErrorResponse(
    "Authentication is required.",
    "unauthenticated",
    401,
  );
}

export function invalidDraftFileRouteIdResponse(): Response {
  return orderDraftFileErrorResponse(
    "Invalid order draft file identifier.",
    "invalid_input",
    400,
  );
}

export async function parseDraftFileJsonRequest(
  request: Request,
): Promise<DraftFileJsonParseResult> {
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return {
      ok: false,
      response: orderDraftFileErrorResponse(
        "Invalid JSON body.",
        "invalid_json",
        400,
      ),
    };
  }

  return { ok: true, data };
}

export function prepareDraftFileValidationResponse(
  input: unknown,
): Response | null {
  const oversized =
    input !== null &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    typeof (input as { size?: unknown }).size === "number" &&
    (input as { size: number }).size > MAX_FILE_SIZE_BYTES;

  if (oversized) {
    return orderDraftFileErrorResponse(
      "File is too large.",
      "file_too_large",
      FILE_ERROR_STATUS.file_too_large,
    );
  }

  const result = PrepareOrderDraftFileUploadInputSchema.safeParse(input);
  if (result.success) return null;
  return orderDraftFileErrorResponse(
    "Invalid draft file upload input.",
    "invalid_input",
    400,
    result.error.flatten(),
  );
}

export function draftFileResultToResponse<T>(
  result: OrderDraftFileOperationResult<T>,
  successStatus = 200,
): Response {
  if (result.ok) {
    return orderDraftFileSuccessResponse(result.data, successStatus);
  }

  return orderDraftFileErrorResponse(
    result.message,
    result.code,
    FILE_ERROR_STATUS[result.code],
  );
}

export function unexpectedDraftFileResponse(): Response {
  return orderDraftFileErrorResponse(
    "Order draft file operation failed.",
    "unexpected_error",
    500,
  );
}

export function disallowsTrustedDraftFileFields(input: unknown): boolean {
  const result = PrepareOrderDraftFileUploadInputSchema.safeParse(input);
  if (result.success) return false;

  const trustedFieldNames = new Set([
    "userId",
    "serviceType",
    "bucket",
    "storagePath",
    "path",
    "itemIndex",
    "draftStatus",
    "uploadStatus",
  ]);
  return result.error.issues.some(
    (issue) =>
      issue.code === z.ZodIssueCode.unrecognized_keys &&
      "keys" in issue &&
      issue.keys.some((key) => trustedFieldNames.has(key)),
  );
}
