import type {
  DraftFinalizationPublicErrorCode,
  DraftFinalizationResult,
} from "./finalization.ts";
import { DraftFinalizationBodySchema } from "./finalization.ts";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

const FINALIZATION_ERROR_STATUS: Record<DraftFinalizationPublicErrorCode, number> = {
  invalid_input: 400,
  unauthenticated: 401,
  profile_incomplete: 422,
  not_found: 404,
  version_conflict: 409,
  invalid_status: 422,
  finalization_conflict: 409,
  missing_original: 422,
  file_mismatch: 409,
  storage_error: 500,
  database_error: 500,
  finalization_incomplete: 503,
  unexpected_error: 500,
};

export interface DraftFinalizationApiErrorBody {
  error: string;
  code: DraftFinalizationPublicErrorCode | "invalid_json";
  details?: unknown;
}

export type DraftFinalizationJsonParseResult =
  | { ok: true; data: unknown }
  | { ok: false; response: Response };

export function draftFinalizationSuccessResponse<T>(
  data: T,
  status = 200,
): Response {
  return Response.json({ data }, { status, headers: NO_STORE_HEADERS });
}

export function draftFinalizationErrorResponse(
  error: string,
  code: DraftFinalizationApiErrorBody["code"],
  status: number,
  details?: unknown,
): Response {
  const body: DraftFinalizationApiErrorBody = { error, code };
  if (details !== undefined) body.details = details;
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

export function unauthenticatedDraftFinalizationResponse(): Response {
  return draftFinalizationErrorResponse(
    "Authentication is required.",
    "unauthenticated",
    FINALIZATION_ERROR_STATUS.unauthenticated,
  );
}

export function profileIncompleteDraftFinalizationResponse(): Response {
  return draftFinalizationErrorResponse(
    "Please complete your profile before submitting this draft.",
    "profile_incomplete",
    FINALIZATION_ERROR_STATUS.profile_incomplete,
  );
}

export function invalidDraftFinalizationRouteIdResponse(): Response {
  return draftFinalizationErrorResponse(
    "Invalid order draft identifier.",
    "invalid_input",
    FINALIZATION_ERROR_STATUS.invalid_input,
  );
}

export async function parseDraftFinalizationJsonRequest(
  request: Request,
): Promise<DraftFinalizationJsonParseResult> {
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return {
      ok: false,
      response: draftFinalizationErrorResponse(
        "Invalid JSON body.",
        "invalid_json",
        400,
      ),
    };
  }

  return { ok: true, data };
}

export function draftFinalizationBodyValidationResponse(
  input: unknown,
): Response | null {
  const result = DraftFinalizationBodySchema.safeParse(input);
  if (result.success) return null;
  return draftFinalizationErrorResponse(
    "Invalid draft finalization input.",
    "invalid_input",
    FINALIZATION_ERROR_STATUS.invalid_input,
    result.error.flatten(),
  );
}

export function draftFinalizationResultToResponse<T>(
  result: DraftFinalizationResult<T>,
  successStatus = 200,
): Response {
  if (result.ok) return draftFinalizationSuccessResponse(result.data, successStatus);
  return draftFinalizationErrorResponse(
    result.message,
    result.code,
    FINALIZATION_ERROR_STATUS[result.code],
  );
}

export function unexpectedDraftFinalizationResponse(): Response {
  return draftFinalizationErrorResponse(
    "Draft finalization failed.",
    "unexpected_error",
    FINALIZATION_ERROR_STATUS.unexpected_error,
  );
}
