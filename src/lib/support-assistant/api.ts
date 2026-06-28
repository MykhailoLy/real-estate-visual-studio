import { SupportAssistantRequestSchema } from "./schema.ts";
import {
  SUPPORT_ASSISTANT_MAX_BODY_BYTES,
} from "./schema.ts";
import {
  buildSupportAssistantTranscript,
  generateSupportAssistantReply,
  validateSupportAssistantTranscriptLength,
} from "./service.ts";
import {
  SupportAssistantConfigurationError,
  SupportAssistantGenerationError,
  SupportAssistantInputError,
  type SupportAssistantRequestInput,
  type SupportAssistantTransport,
} from "./types.ts";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

export type SupportAssistantPublicErrorCode =
  | "invalid_json"
  | "invalid_input"
  | "support_unavailable"
  | "generation_failed";

export interface SupportAssistantApiErrorBody {
  error: string;
  code: SupportAssistantPublicErrorCode;
  details?: unknown;
}

export type SupportAssistantJsonParseResult =
  | { ok: true; input: SupportAssistantRequestInput }
  | { ok: false; response: Response };

const textEncoder = new TextEncoder();

function byteLength(value: string): number {
  return textEncoder.encode(value).byteLength;
}

export function supportAssistantSuccessResponse(message: string): Response {
  return Response.json(
    { data: { message } },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}

export function supportAssistantErrorResponse(
  error: string,
  code: SupportAssistantPublicErrorCode,
  status: number,
  details?: unknown,
): Response {
  const body: SupportAssistantApiErrorBody = { error, code };
  if (details !== undefined) body.details = details;
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function invalidInputResponse(details?: unknown): Response {
  return supportAssistantErrorResponse(
    "Invalid support request.",
    "invalid_input",
    400,
    details,
  );
}

export async function parseSupportAssistantJsonRequest(
  request: Request,
): Promise<SupportAssistantJsonParseResult> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsedContentLength = Number(contentLength);
    if (
      Number.isFinite(parsedContentLength) &&
      parsedContentLength > SUPPORT_ASSISTANT_MAX_BODY_BYTES
    ) {
      return {
        ok: false,
        response: supportAssistantErrorResponse(
          "Request body is too large.",
          "invalid_input",
          400,
        ),
      };
    }
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return {
      ok: false,
      response: supportAssistantErrorResponse(
        "Invalid JSON body.",
        "invalid_json",
        400,
      ),
    };
  }

  if (byteLength(text) > SUPPORT_ASSISTANT_MAX_BODY_BYTES) {
    return {
      ok: false,
      response: supportAssistantErrorResponse(
        "Request body is too large.",
        "invalid_input",
        400,
      ),
    };
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      ok: false,
      response: supportAssistantErrorResponse(
        "Invalid JSON body.",
        "invalid_json",
        400,
      ),
    };
  }

  const result = SupportAssistantRequestSchema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      response: invalidInputResponse(result.error.flatten()),
    };
  }

  try {
    validateSupportAssistantTranscriptLength(
      buildSupportAssistantTranscript(result.data),
    );
  } catch (error) {
    if (error instanceof SupportAssistantInputError) {
      return {
        ok: false,
        response: invalidInputResponse({
          formErrors: ["Combined support assistant transcript is too long."],
          fieldErrors: {},
        }),
      };
    }
    throw error;
  }

  return { ok: true, input: result.data };
}

export async function handleSupportAssistantPostRequest(
  request: Request,
  transport: SupportAssistantTransport,
): Promise<Response> {
  const parsed = await parseSupportAssistantJsonRequest(request);
  if (!parsed.ok) return parsed.response;

  try {
    const message = await generateSupportAssistantReply(parsed.input, transport);
    return supportAssistantSuccessResponse(message);
  } catch (error) {
    if (error instanceof SupportAssistantConfigurationError) {
      return supportAssistantErrorResponse(
        "Support assistant is currently unavailable.",
        "support_unavailable",
        503,
      );
    }

    logSupportAssistantError("generate reply", error);
    return supportAssistantErrorResponse(
      "Support assistant could not generate a response.",
      "generation_failed",
      502,
    );
  }
}

function logSupportAssistantError(operation: string, error: unknown): void {
  const safeName =
    error instanceof SupportAssistantGenerationError
      ? error.name
      : error instanceof Error
        ? error.name
        : "UnknownError";
  console.error(`[support-assistant-api] ${operation} failed`, safeName);
}
