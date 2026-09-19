import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import {
  UpstashSupportAssistantRateLimiter,
  type SupportRateLimitWindows,
} from "./support-assistant/rate-limit.ts";

let windows: SupportRateLimitWindows | undefined;

// Reuse the trusted Vercel identity, HMAC and fail-closed 1.5s deadline.
// Cache clients only: attempt counts live in Redis, not in this process.
const limiter = new UpstashSupportAssistantRateLimiter(() => {
  if (windows) return windows;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) throw new Error("Admin login limiter is unavailable.");
  const redis = new Redis({ url, token });
  // Only Vercel's server-side production environment uses production buckets.
  // Preview, local and test traffic stay separate even with shared credentials.
  const environment = process.env.VERCEL === "1" && process.env.VERCEL_ENV === "production"
    ? "production"
    : "non-production";
  const options = {
    redis,
    analytics: false,
    timeout: 0, // Disable the SDK's fail-open timeout; the shared wrapper fails closed.
    ephemeralCache: false as const,
    enableProtection: false,
    dynamicLimits: false,
  };
  windows = {
    burst: new Ratelimit({
      ...options,
      limiter: Ratelimit.slidingWindow(5, "5 m"),
      prefix: `picchuspot:admin-login:${environment}:burst`,
    }),
    hourly: new Ratelimit({
      ...options,
      limiter: Ratelimit.slidingWindow(20, "60 m"),
      prefix: `picchuspot:admin-login:${environment}:hourly`,
    }),
  };
  return windows;
});

export function checkAdminLoginRateLimit(request: Request) {
  return limiter.check(request);
}
