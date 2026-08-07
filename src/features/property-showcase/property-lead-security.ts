import { createHmac } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { resolveTrustedSupportClientIdentity } from "../../lib/support-assistant/ip.ts";

const RATE_LIMIT_TIMEOUT_MS = 1500;
const TURNSTILE_TIMEOUT_MS = 4000;
const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export type PropertyLeadSecurityEnvironment = Record<
  string,
  string | undefined
>;

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
}): Promise<"valid" | "invalid" | "unavailable"> {
  const env = input.env ?? process.env;
  const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  const production = env.NODE_ENV === "production";
  if (!siteKey && !secret) return production ? "unavailable" : "valid";
  if (!siteKey || !secret) return "unavailable";
  if (!input.token.trim()) return "invalid";

  const expectedHostname = production
    ? turnstileExpectedHostname(env)
    : undefined;
  if (production && !expectedHostname) return "unavailable";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TURNSTILE_TIMEOUT_MS);
  try {
    const identity = resolveTrustedSupportClientIdentity(input.request, env);
    const body = new URLSearchParams({
      secret,
      response: input.token.trim(),
    });
    if (identity.ok && identity.identity !== "local-development") {
      body.set("remoteip", identity.identity);
    }
    const response = await (input.fetchImpl ?? fetch)(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body,
      signal: controller.signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (!response.ok) return "unavailable";
    const result = (await response.json()) as {
      success?: boolean;
      action?: string;
      hostname?: string;
    };
    const receivedHostname = result.hostname?.trim().toLowerCase();
    return result.success === true &&
        result.action === "property_lead" &&
        (!expectedHostname || receivedHostname === expectedHostname)
      ? "valid"
      : "invalid";
  } catch {
    return "unavailable";
  } finally {
    clearTimeout(timeout);
  }
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
