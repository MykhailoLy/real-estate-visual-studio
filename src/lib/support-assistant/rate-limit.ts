import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import {
  createSupportRateLimitIdentifier,
  resolveTrustedSupportClientIdentity,
  type SupportAssistantRuntimeEnv,
} from "./ip.ts";
import {
  SupportAssistantRateLimitUnavailableError,
  type SupportAssistantRateLimiter,
  type SupportRateLimitDecision,
} from "./types.ts";

export const SUPPORT_RATE_LIMIT_TIMEOUT_MS = 1500;

export type SupportRateLimitWindowName = "burst" | "hourly";

export interface SupportRateLimitWindowConfig {
  name: SupportRateLimitWindowName;
  requests: number;
  window: Duration;
  prefix: string;
  algorithm: "slidingWindow";
  analytics: false;
  timeout: 0;
  ephemeralCache: false;
  enableProtection: false;
  dynamicLimits: false;
}

export interface SupportRateLimitResult {
  success: boolean;
  reset: number;
}

export interface SupportRateLimitWindowLimiter {
  limit(identifier: string): Promise<SupportRateLimitResult>;
}

export interface SupportRateLimitWindows {
  burst: SupportRateLimitWindowLimiter;
  hourly: SupportRateLimitWindowLimiter;
}

type SupportRateLimitWindowsFactory = () => SupportRateLimitWindows;

const SUPPORT_RATE_LIMIT_WINDOW_CONFIGS = [
  {
    name: "burst",
    requests: 5,
    window: "60 s",
    prefix: "picchuspot:support:burst",
    algorithm: "slidingWindow",
    analytics: false,
    timeout: 0,
    ephemeralCache: false,
    enableProtection: false,
    dynamicLimits: false,
  },
  {
    name: "hourly",
    requests: 30,
    window: "60 m",
    prefix: "picchuspot:support:hourly",
    algorithm: "slidingWindow",
    analytics: false,
    timeout: 0,
    ephemeralCache: false,
    enableProtection: false,
    dynamicLimits: false,
  },
] as const satisfies readonly SupportRateLimitWindowConfig[];

let cachedProductionLimiter: SupportAssistantRateLimiter | null = null;
let cachedProductionWindows: SupportRateLimitWindows | null = null;

export function buildSupportRateLimitWindowConfigs(): SupportRateLimitWindowConfig[] {
  return SUPPORT_RATE_LIMIT_WINDOW_CONFIGS.map((config) => ({ ...config }));
}

export class UpstashSupportAssistantRateLimiter
  implements SupportAssistantRateLimiter
{
  private readonly getLimiters: SupportRateLimitWindowsFactory;
  private readonly env: SupportAssistantRuntimeEnv;
  private readonly timeoutMs: number;

  constructor(
    getLimiters: SupportRateLimitWindowsFactory,
    env: SupportAssistantRuntimeEnv = process.env,
    timeoutMs = SUPPORT_RATE_LIMIT_TIMEOUT_MS,
  ) {
    this.getLimiters = getLimiters;
    this.env = env;
    this.timeoutMs = timeoutMs;
  }

  async check(request: Request): Promise<SupportRateLimitDecision> {
    return withRateLimitTimeout(
      this.checkWithoutTimeout(request),
      this.timeoutMs,
    );
  }

  private async checkWithoutTimeout(
    request: Request,
  ): Promise<SupportRateLimitDecision> {
    const identity = resolveTrustedSupportClientIdentity(request, this.env);
    if (!identity.ok) {
      throw new SupportAssistantRateLimitUnavailableError(
        "Trusted support client identity is unavailable.",
      );
    }

    const identifier = createSupportRateLimitIdentifier(
      identity.identity,
      this.env.SUPPORT_RATE_LIMIT_SECRET,
    );
    const limiters = this.getLimiters();

    const burst = await limiters.burst.limit(identifier);
    if (!burst.success) {
      return blockedDecision(burst.reset);
    }

    const hourly = await limiters.hourly.limit(identifier);
    if (!hourly.success) {
      return blockedDecision(hourly.reset);
    }

    return { allowed: true };
  }
}

export function createUpstashSupportAssistantRateLimiter(): SupportAssistantRateLimiter {
  cachedProductionLimiter ??= new UpstashSupportAssistantRateLimiter(() => {
    cachedProductionWindows ??= createUpstashRateLimitWindows();
    return cachedProductionWindows;
  });
  return cachedProductionLimiter;
}

function createUpstashRateLimitWindows(): SupportRateLimitWindows {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    throw new SupportAssistantRateLimitUnavailableError(
      "Upstash Redis is not configured.",
    );
  }

  const redis = new Redis({ url, token });
  const limiters = buildSupportRateLimitWindowConfigs().map((config) => [
    config.name,
    new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.requests, config.window),
      prefix: config.prefix,
      analytics: config.analytics,
      timeout: config.timeout,
      ephemeralCache: config.ephemeralCache,
      enableProtection: config.enableProtection,
      dynamicLimits: config.dynamicLimits,
    }),
  ] as const);

  return Object.fromEntries(limiters) as unknown as SupportRateLimitWindows;
}

function blockedDecision(reset: number): SupportRateLimitDecision {
  return {
    allowed: false,
    retryAfterSeconds: retryAfterSecondsFromReset(reset),
  };
}

export function retryAfterSecondsFromReset(reset: number, now = Date.now()): number {
  if (!Number.isFinite(reset)) return 1;
  return Math.max(1, Math.ceil((reset - now) / 1000));
}

function withRateLimitTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => {
      reject(
        new SupportAssistantRateLimitUnavailableError(
          "Support assistant rate limit timed out.",
        ),
      );
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}
