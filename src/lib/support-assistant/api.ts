import { SupportAssistantRequestSchema } from "./schema.ts";
import { SUPPORT_ASSISTANT_MAX_BODY_BYTES } from "./schema.ts";
import {
  buildSupportAssistantTranscript,
  generateSupportAssistantReply,
  validateSupportAssistantTranscriptLength,
} from "./service.ts";
import {
  SupportAssistantConfigurationError,
  SupportAssistantGenerationError,
  SupportAssistantInputError,
  SupportAssistantRateLimitUnavailableError,
  type SupportAssistantRateLimiter,
  type SupportAssistantRequestInput,
  type SupportAssistantTransport,
} from "./types.ts";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

export type SupportAssistantPublicErrorCode =
  | "invalid_json"
  | "invalid_input"
  | "rate_limited"
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

const textDecoder = new TextDecoder();

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

function oversizedBodyResponse(): Response {
  return supportAssistantErrorResponse(
    "Request body is too large.",
    "invalid_input",
    400,
  );
}

function unsupportedContentTypeResponse(): Response {
  return supportAssistantErrorResponse(
    "Content-Type must be application/json.",
    "invalid_input",
    400,
  );
}

function rateLimitedResponse(retryAfterSeconds: number): Response {
  const retryAfter = Math.max(1, Math.ceil(retryAfterSeconds));
  return Response.json(
    {
      error: "Too many support requests. Please try again later.",
      code: "rate_limited",
    },
    {
      status: 429,
      headers: {
        ...NO_STORE_HEADERS,
        "Retry-After": String(retryAfter),
      },
    },
  );
}

export function isSupportedJsonContentType(value: string | null): boolean {
  if (!value) return false;
  const mediaType = value.split(";")[0]?.trim().toLowerCase();
  return (
    mediaType === "application/json" ||
    (mediaType?.startsWith("application/") === true &&
      mediaType.endsWith("+json"))
  );
}

export async function readBoundedRequestText(
  request: Request,
): Promise<{ ok: true; text: string } | { ok: false; response: Response }> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsedContentLength = Number(contentLength);
    if (
      Number.isFinite(parsedContentLength) &&
      parsedContentLength > SUPPORT_ASSISTANT_MAX_BODY_BYTES
    ) {
      return { ok: false, response: oversizedBodyResponse() };
    }
  }

  if (!request.body) return { ok: true, text: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      receivedBytes += value.byteLength;
      if (receivedBytes > SUPPORT_ASSISTANT_MAX_BODY_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // The request is already rejected; cancellation is best-effort.
        }
        return { ok: false, response: oversizedBodyResponse() };
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bodyBytes = new Uint8Array(receivedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, text: textDecoder.decode(bodyBytes) };
}

export async function parseSupportAssistantJsonRequest(
  request: Request,
): Promise<SupportAssistantJsonParseResult> {
  if (!isSupportedJsonContentType(request.headers.get("content-type"))) {
    return { ok: false, response: unsupportedContentTypeResponse() };
  }

  let text: string;
  try {
    const body = await readBoundedRequestText(request);
    if (!body.ok) return body;
    text = body.text;
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
  rateLimiter: SupportAssistantRateLimiter,
): Promise<Response> {
  const parsed = await parseSupportAssistantJsonRequest(request);
  if (!parsed.ok) return parsed.response;

  try {
    const rateLimit = await rateLimiter.check(request);
    if (!rateLimit.allowed) {
      return rateLimitedResponse(rateLimit.retryAfterSeconds);
    }
  } catch (error) {
    logSupportAssistantError("rate limit", error);
    return supportAssistantErrorResponse(
      "Support assistant is currently unavailable.",
      "support_unavailable",
      503,
    );
  }

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
    error instanceof SupportAssistantGenerationError ||
    error instanceof SupportAssistantRateLimitUnavailableError
      ? error.name
      : error instanceof Error
        ? error.name
        : "UnknownError";
  console.error(`[support-assistant-api] ${operation} failed`, safeName);
}
