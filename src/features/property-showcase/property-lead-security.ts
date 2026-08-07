import { createHmac } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { resolveTrustedSupportClientIdentity } from "../../lib/support-assistant/ip.ts";

const RATE_LIMIT_TIMEOUT_MS = 1500;
export const TURNSTILE_TIMEOUT_MS = 10_000;
const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export type PropertyLeadSecurityEnvironment = Record<
  string,
  string | undefined
>;

export type PropertyLeadTurnstileReason =
  | "missing-site-key"
  | "missing-secret"
  | "invalid-site-url"
  | "siteverify-timeout"
  | "siteverify-network-error"
  | "siteverify-http-error"
  | "siteverify-invalid-json"
  | "cloudflare-invalid"
  | "hostname-mismatch"
  | "action-mismatch"
  | "internal-error"
  | "invalid-input-response"
  | "missing-input-response"
  | "timeout-or-duplicate"
  | "invalid-input-secret"
  | "missing-input-secret"
  | "bad-request";

export type PropertyLeadTurnstileDiagnostic = {
  reason: PropertyLeadTurnstileReason;
  httpStatus?: number;
  cloudflareErrorCodes?: string[];
  expectedHostname?: string;
  receivedHostname?: string;
  receivedAction?: string;
};

export type PropertyLeadTurnstileVerification =
  | { status: "valid" }
  | {
      status: "invalid" | "unavailable";
      diagnostic: PropertyLeadTurnstileDiagnostic;
    };

type TurnstileSiteverifyResponse = {
  success?: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: unknown;
};

let cachedLimiters:
  | { burst: Ratelimit; hourly: Ratelimit }
  | undefined;

function propertyLeadLimiters() {
  if (cachedLimiters) return cachedLimiters;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) throw new Error("Property lead rate limiting is not configured.");
  const redis = new Redis({ url, token });
  cachedLimiters = {
    burst: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "10 m"),
      prefix: "picchuspot:property-leads:burst",
      analytics: false,
      timeout: 0,
    }),
    hourly: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(8, "60 m"),
      prefix: "picchuspot:property-leads:hourly",
      analytics: false,
      timeout: 0,
    }),
  };
  return cachedLimiters;
}

function rateLimitIdentifier(request: Request, propertySlug: string): string {
  const identity = resolveTrustedSupportClientIdentity(request);
  if (!identity.ok) throw new Error("Trusted client identity is unavailable.");
  const secret = (
    process.env.PROPERTY_LEADS_RATE_LIMIT_SECRET ??
    process.env.SUPPORT_RATE_LIMIT_SECRET
  )?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("Property lead rate limit secret is not configured.");
  }
  return createHmac("sha256", secret)
    .update(`${propertySlug}\u0000${identity.identity}`)
    .digest("hex");
}

function retryAfterSeconds(reset: number): number {
  return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => reject(new Error("Security check timed out.")), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

export async function checkPropertyLeadRateLimit(
  request: Request,
  propertySlug: string,
): Promise<RateLimitDecision> {
  const identifier = rateLimitIdentifier(request, propertySlug);
  const limiters = propertyLeadLimiters();
  const burst = await withTimeout(
    limiters.burst.limit(identifier),
    RATE_LIMIT_TIMEOUT_MS,
  );
  if (!burst.success) {
    return { allowed: false, retryAfterSeconds: retryAfterSeconds(burst.reset) };
  }
  const hourly = await withTimeout(
    limiters.hourly.limit(identifier),
    RATE_LIMIT_TIMEOUT_MS,
  );
  return hourly.success
    ? { allowed: true }
    : { allowed: false, retryAfterSeconds: retryAfterSeconds(hourly.reset) };
}

export async function verifyPropertyLeadTurnstile(input: {
  request: Request;
  token: string;
  fetchImpl?: typeof fetch;
  env?: PropertyLeadSecurityEnvironment;
  createTimeoutSignal?: (timeoutMs: number) => AbortSignal;
}): Promise<PropertyLeadTurnstileVerification> {
  const env = input.env ?? process.env;
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  const production = env.NODE_ENV === "production";
  if (!siteKey && !secret) {
    return production
      ? unavailable({ reason: "missing-site-key" })
      : { status: "valid" };
  }
  if (!siteKey) return unavailable({ reason: "missing-site-key" });
  if (!secret) return unavailable({ reason: "missing-secret" });
  if (!input.token.trim()) return invalid({ reason: "cloudflare-invalid" });

  const expectedHostname = production
    ? turnstileExpectedHostname(env) ?? undefined
    : undefined;
  if (production && !expectedHostname) {
    return unavailable({ reason: "invalid-site-url" });
  }

  const signal = (input.createTimeoutSignal ?? AbortSignal.timeout)(
    TURNSTILE_TIMEOUT_MS,
  );
  try {
    const identity = resolveTrustedSupportClientIdentity(input.request, env);
    const body: Record<string, string> = {
      secret,
      response: input.token.trim(),
    };
    if (identity.ok && identity.identity !== "local-development") {
      body.remoteip = identity.identity;
    }
    const response = await (input.fetchImpl ?? fetch)(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: JSON.stringify(body),
      signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
    const result = await readTurnstileSiteverifyResponse(response);
    if (!response.ok) {
      return siteverifyHttpFailure(result, response.status, expectedHostname);
    }
    if (!result) {
      return unavailable({ reason: "siteverify-invalid-json", expectedHostname });
    }

    const receivedHostname = result.hostname?.trim().toLowerCase();
    const receivedAction = result.action?.trim();
    const diagnostic = {
      expectedHostname,
      receivedHostname,
      receivedAction,
      cloudflareErrorCodes: cloudflareErrorCodes(result["error-codes"]),
    };

    if (result.success !== true) {
      return cloudflareFailure(diagnostic);
    }
    if (receivedAction !== "property_lead") {
      return invalid({ ...diagnostic, reason: "action-mismatch" });
    }
    if (expectedHostname && receivedHostname !== expectedHostname) {
      return invalid({ ...diagnostic, reason: "hostname-mismatch" });
    }
    return { status: "valid" };
  } catch {
    return unavailable({
      reason: signal.aborted
        ? "siteverify-timeout"
        : "siteverify-network-error",
      expectedHostname,
    });
  }
}

function invalid(
  diagnostic: PropertyLeadTurnstileDiagnostic,
): PropertyLeadTurnstileVerification {
  return { status: "invalid", diagnostic: compactDiagnostic(diagnostic) };
}

function unavailable(
  diagnostic: PropertyLeadTurnstileDiagnostic,
): PropertyLeadTurnstileVerification {
  return { status: "unavailable", diagnostic: compactDiagnostic(diagnostic) };
}

function compactDiagnostic(
  diagnostic: PropertyLeadTurnstileDiagnostic,
): PropertyLeadTurnstileDiagnostic {
  return {
    reason: diagnostic.reason,
    ...(diagnostic.httpStatus === undefined
      ? {}
      : { httpStatus: diagnostic.httpStatus }),
    ...(diagnostic.cloudflareErrorCodes?.length
      ? { cloudflareErrorCodes: diagnostic.cloudflareErrorCodes }
      : {}),
    ...(diagnostic.expectedHostname
      ? { expectedHostname: diagnostic.expectedHostname }
      : {}),
    ...(diagnostic.receivedHostname
      ? { receivedHostname: diagnostic.receivedHostname }
      : {}),
    ...(diagnostic.receivedAction
      ? { receivedAction: diagnostic.receivedAction }
      : {}),
  };
}

async function readTurnstileSiteverifyResponse(
  response: Response,
): Promise<TurnstileSiteverifyResponse | null> {
  try {
    const parsed: unknown = await response.json();
    return isTurnstileSiteverifyResponse(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isTurnstileSiteverifyResponse(
  value: unknown,
): value is TurnstileSiteverifyResponse {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloudflareErrorCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (code): code is string =>
        typeof code === "string" && /^[a-z0-9-]{1,80}$/.test(code),
    )
    .slice(0, 10);
}

function siteverifyHttpFailure(
  result: TurnstileSiteverifyResponse | null,
  httpStatus: number,
  expectedHostname?: string,
): PropertyLeadTurnstileVerification {
  const codes = cloudflareErrorCodes(result?.["error-codes"]);
  const diagnostic = {
    httpStatus,
    expectedHostname,
    cloudflareErrorCodes: codes,
  };
  for (const code of [
    "internal-error",
    "invalid-input-secret",
    "missing-input-secret",
    "missing-input-response",
    "bad-request",
    "invalid-input-response",
    "timeout-or-duplicate",
  ] as const) {
    if (codes.includes(code)) return unavailable({ ...diagnostic, reason: code });
  }
  return unavailable({ ...diagnostic, reason: "siteverify-http-error" });
}

function cloudflareFailure(input: Omit<PropertyLeadTurnstileDiagnostic, "reason">) {
  const codes = input.cloudflareErrorCodes ?? [];
  if (codes.includes("internal-error")) {
    return unavailable({ ...input, reason: "internal-error" });
  }
  for (const code of [
    "invalid-input-secret",
    "missing-input-secret",
    "missing-input-response",
    "bad-request",
  ] as const) {
    if (codes.includes(code)) return unavailable({ ...input, reason: code });
  }
  for (const code of ["invalid-input-response", "timeout-or-duplicate"] as const) {
    if (codes.includes(code)) return invalid({ ...input, reason: code });
  }
  return invalid({ ...input, reason: "cloudflare-invalid" });
}

function turnstileExpectedHostname(
  env: PropertyLeadSecurityEnvironment,
): string | null {
  const siteUrl = env.NEXT_PUBLIC_SITE_URL?.trim() || "https://picchuspot.com";
  try {
    const url = new URL(siteUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}
