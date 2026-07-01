import {
  supportChatCopy,
  type SupportChatLanguage,
} from "./support-chat-copy.ts";

export type SupportChatApiRole = "user" | "assistant";

export interface SupportChatApiHistoryMessage {
  role: SupportChatApiRole;
  content: string;
}

export type SupportChatMessageOrigin = "local" | "remote";
export type SupportChatMessageStatus = "complete" | "loading" | "error";
export type SupportChatLocalKind = "welcome" | "human_support" | "error";

export interface SupportChatMessage {
  id: string;
  role: SupportChatApiRole;
  content: string;
  origin: SupportChatMessageOrigin;
  status: SupportChatMessageStatus;
  localKind?: SupportChatLocalKind;
}

export interface BuildSupportChatHistoryOptions {
  excludeMessageId?: string;
  maxMessages?: number;
  maxCharacters?: number;
}

export type SupportChatLauncherMode = "public" | "dashboard" | "none";

export type SupportChatClientErrorCode =
  | "invalid_input"
  | "rate_limited"
  | "support_unavailable"
  | "generation_failed"
  | "network"
  | "aborted";

export type SupportChatClientResult =
  | { ok: true; message: string }
  | {
      ok: false;
      code: SupportChatClientErrorCode;
      retryAfterSeconds?: number;
    };

interface SubmitSupportChatMessageOptions {
  message: string;
  history: SupportChatApiHistoryMessage[];
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}

const SUPPORT_CHAT_EXCLUDED_PREFIXES = [
  "/admin",
  "/order",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth",
] as const;

const SUPPORT_CHAT_HISTORY_MAX_MESSAGES = 6;
const SUPPORT_CHAT_HISTORY_MAX_CHARACTERS = 5500;
const RATE_LIMIT_FALLBACK_SECONDS = 60;

export function detectSupportChatLanguage(
  pathname: string | null | undefined,
): SupportChatLanguage {
  return pathname === "/es" || pathname?.startsWith("/es/") ? "es" : "en";
}

export function normalizeSupportChatPath(pathname: string | null | undefined) {
  const rawPath = pathname?.split(/[?#]/, 1)[0] || "/";
  const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const withoutTrailingSlash =
    path.length > 1 ? path.replace(/\/+$/, "") : path;

  if (withoutTrailingSlash === "/es") return "/";
  if (withoutTrailingSlash.startsWith("/es/")) {
    return withoutTrailingSlash.slice(3) || "/";
  }

  return withoutTrailingSlash || "/";
}

export function isSupportChatRouteVisible(
  pathname: string | null | undefined,
) {
  return getSupportChatLauncherMode(pathname) !== "none";
}

export function getSupportChatLauncherMode(
  pathname: string | null | undefined,
): SupportChatLauncherMode {
  const normalizedPath = normalizeSupportChatPath(pathname);
  const excluded = SUPPORT_CHAT_EXCLUDED_PREFIXES.some(
    (prefix) =>
      normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
  );

  if (excluded) return "none";
  if (
    normalizedPath === "/dashboard" ||
    normalizedPath.startsWith("/dashboard/")
  ) {
    return "dashboard";
  }

  return "public";
}

export function buildSupportChatHistory(
  messages: readonly SupportChatMessage[],
  options: BuildSupportChatHistoryOptions = {},
): SupportChatApiHistoryMessage[] {
  const maxMessages = options.maxMessages ?? SUPPORT_CHAT_HISTORY_MAX_MESSAGES;
  const maxCharacters =
    options.maxCharacters ?? SUPPORT_CHAT_HISTORY_MAX_CHARACTERS;
  const history: SupportChatApiHistoryMessage[] = [];
  let characterTotal = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message || message.id === options.excludeMessageId) continue;
    if (!isEligibleHistoryMessage(message)) continue;

    const content = message.content.trim();
    if (!content) continue;
    if (history.length >= maxMessages) break;
    if (characterTotal + content.length > maxCharacters) break;

    history.unshift({ role: message.role, content });
    characterTotal += content.length;
  }

  return history;
}

export async function submitSupportChatMessage({
  message,
  history,
  signal,
  fetcher = fetch,
}: SubmitSupportChatMessageOptions): Promise<SupportChatClientResult> {
  try {
    const response = await fetcher("/api/support", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal,
      body: JSON.stringify({ message, history }),
    });

    if (response.ok) {
      return parseSupportChatSuccess(response);
    }

    return mapSupportChatErrorResponse(response);
  } catch (error) {
    if (isAbortError(error)) {
      return { ok: false, code: "aborted" };
    }
    return { ok: false, code: "network" };
  }
}

export function parseRetryAfterSeconds(
  retryAfterHeader: string | null,
  fallbackSeconds = RATE_LIMIT_FALLBACK_SECONDS,
) {
  if (!retryAfterHeader) return fallbackSeconds;
  const trimmedHeader = retryAfterHeader.trim();
  if (!/^\d+$/.test(trimmedHeader)) return fallbackSeconds;
  const seconds = Number(trimmedHeader);
  return Number.isSafeInteger(seconds) && seconds > 0
    ? seconds
    : fallbackSeconds;
}

export function getSupportChatErrorMessage(
  language: SupportChatLanguage,
  result: Extract<SupportChatClientResult, { ok: false }>,
  countdownSeconds?: number,
) {
  const copy = supportChatCopy[language].errors;

  switch (result.code) {
    case "invalid_input":
      return copy.invalidInput;
    case "rate_limited":
      return copy.rateLimited(
        Math.max(1, countdownSeconds ?? result.retryAfterSeconds ?? 60),
      );
    case "generation_failed":
      return copy.generationFailed;
    case "support_unavailable":
      return copy.unavailable;
    case "network":
    case "aborted":
      return copy.network;
  }
}

function isEligibleHistoryMessage(message: SupportChatMessage) {
  if (message.status !== "complete") return false;
  if (message.role === "user") return true;
  return message.role === "assistant" && message.origin === "remote";
}

async function parseSupportChatSuccess(
  response: Response,
): Promise<SupportChatClientResult> {
  const json = await safeJson(response);
  if (!isRecord(json)) return { ok: false, code: "generation_failed" };

  const data = json.data;
  if (!isRecord(data)) return { ok: false, code: "generation_failed" };

  const message = data.message;
  if (typeof message !== "string" || !message.trim()) {
    return { ok: false, code: "generation_failed" };
  }

  return { ok: true, message };
}

async function mapSupportChatErrorResponse(
  response: Response,
): Promise<SupportChatClientResult> {
  const json = await safeJson(response);
  const responseCode = isRecord(json) ? json.code : undefined;

  if (response.status === 429) {
    return {
      ok: false,
      code: "rate_limited",
      retryAfterSeconds: parseRetryAfterSeconds(response.headers.get("Retry-After")),
    };
  }

  if (
    response.status === 400 ||
    responseCode === "invalid_input" ||
    responseCode === "invalid_json"
  ) {
    return { ok: false, code: "invalid_input" };
  }

  if (response.status === 502 || responseCode === "generation_failed") {
    return { ok: false, code: "generation_failed" };
  }

  if (response.status === 503 || responseCode === "support_unavailable") {
    return { ok: false, code: "support_unavailable" };
  }

  return { ok: false, code: "support_unavailable" };
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAbortError(error: unknown) {
  return (
    error instanceof DOMException && error.name === "AbortError"
  );
}
