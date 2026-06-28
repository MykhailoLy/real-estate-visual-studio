import assert from "node:assert/strict";
import test from "node:test";

import {
  SUPPORT_RATE_LIMIT_LOCAL_IDENTITY,
  createSupportRateLimitIdentifier,
  resolveTrustedSupportClientIdentity,
} from "./ip.ts";
import {
  SUPPORT_RATE_LIMIT_TIMEOUT_MS,
  UpstashSupportAssistantRateLimiter,
  buildSupportRateLimitWindowConfigs,
  createUpstashSupportAssistantRateLimiter,
  retryAfterSecondsFromReset,
  type SupportRateLimitResult,
  type SupportRateLimitWindowLimiter,
} from "./rate-limit.ts";

const validSecret = "0123456789abcdef0123456789abcdef";
const rawIp = "203.0.113.10";
const alternateIp = "198.51.100.20";

function request(headers?: HeadersInit): Request {
  return new Request("https://example.test/api/support", { headers });
}

class FakeWindowLimiter implements SupportRateLimitWindowLimiter {
  calls = 0;
  identifiers: string[] = [];
  private readonly results: Array<SupportRateLimitResult | Error>;

  constructor(results: Array<SupportRateLimitResult | Error>) {
    this.results = results;
  }

  async limit(identifier: string): Promise<SupportRateLimitResult> {
    this.calls += 1;
    this.identifiers.push(identifier);
    const result = this.results.shift() ?? {
      success: true,
      reset: Date.now() + 60_000,
    };
    if (result instanceof Error) throw result;
    return result;
  }
}

function limiterWith(
  burst: FakeWindowLimiter,
  hourly: FakeWindowLimiter,
  env: Record<string, string | undefined> = {
    VERCEL: "1",
    NODE_ENV: "production",
    SUPPORT_RATE_LIMIT_SECRET: validSecret,
  },
  timeoutMs = SUPPORT_RATE_LIMIT_TIMEOUT_MS,
) {
  return new UpstashSupportAssistantRateLimiter(
    () => ({ burst, hourly }),
    env,
    timeoutMs,
  );
}

test("burst-blocked request returns a blocked decision", async () => {
  const burst = new FakeWindowLimiter([
    { success: false, reset: Date.now() + 12_000 },
  ]);
  const hourly = new FakeWindowLimiter([
    { success: true, reset: Date.now() + 60_000 },
  ]);

  const decision = await limiterWith(burst, hourly).check(
    request({ "x-vercel-forwarded-for": rawIp }),
  );

  assert.deepEqual(decision, { allowed: false, retryAfterSeconds: 12 });
});

test("hourly-blocked request returns a blocked decision", async () => {
  const burst = new FakeWindowLimiter([
    { success: true, reset: Date.now() + 60_000 },
  ]);
  const hourly = new FakeWindowLimiter([
    { success: false, reset: Date.now() + 120_000 },
  ]);

  const decision = await limiterWith(burst, hourly).check(
    request({ "x-vercel-forwarded-for": rawIp }),
  );

  assert.deepEqual(decision, { allowed: false, retryAfterSeconds: 120 });
});

test("burst blocking prevents the hourly limiter call", async () => {
  const burst = new FakeWindowLimiter([
    { success: false, reset: Date.now() + 10_000 },
  ]);
  const hourly = new FakeWindowLimiter([
    { success: true, reset: Date.now() + 60_000 },
  ]);

  await limiterWith(burst, hourly).check(
    request({ "x-vercel-forwarded-for": rawIp }),
  );

  assert.equal(burst.calls, 1);
  assert.equal(hourly.calls, 0);
});

test("allowed request checks burst then hourly with the hashed identifier", async () => {
  const burst = new FakeWindowLimiter([
    { success: true, reset: Date.now() + 60_000 },
  ]);
  const hourly = new FakeWindowLimiter([
    { success: true, reset: Date.now() + 3_600_000 },
  ]);

  const decision = await limiterWith(burst, hourly).check(
    request({ "x-vercel-forwarded-for": rawIp }),
  );
  const expectedIdentifier = createSupportRateLimitIdentifier(
    rawIp,
    validSecret,
  );

  assert.deepEqual(decision, { allowed: true });
  assert.deepEqual(burst.identifiers, [expectedIdentifier]);
  assert.deepEqual(hourly.identifiers, [expectedIdentifier]);
  assert.equal(burst.identifiers[0]?.includes(rawIp), false);
});

test("Retry-After uses a minimum of one second", () => {
  assert.equal(retryAfterSecondsFromReset(Date.now() - 1000), 1);
  assert.equal(retryAfterSecondsFromReset(Number.NaN), 1);
});

test("limiter network failure is surfaced as a safe infrastructure failure", async () => {
  const burst = new FakeWindowLimiter([
    new Error("raw Upstash Redis connection error"),
  ]);
  const hourly = new FakeWindowLimiter([]);

  await assert.rejects(
    () =>
      limiterWith(burst, hourly).check(
        request({ "x-vercel-forwarded-for": rawIp }),
      ),
    /raw Upstash Redis connection error/,
  );
  assert.equal(hourly.calls, 0);
});

test("limiter timeout fails closed", async () => {
  const slowBurst: SupportRateLimitWindowLimiter = {
    async limit() {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { success: true, reset: Date.now() + 60_000 };
    },
  };
  const hourly = new FakeWindowLimiter([
    { success: true, reset: Date.now() + 60_000 },
  ]);

  await assert.rejects(
    () =>
      new UpstashSupportAssistantRateLimiter(
        () => ({ burst: slowBurst, hourly }),
        {
          VERCEL: "1",
          NODE_ENV: "production",
          SUPPORT_RATE_LIMIT_SECRET: validSecret,
        },
        5,
      ).check(request({ "x-vercel-forwarded-for": rawIp })),
    { name: "SupportAssistantRateLimitUnavailableError" },
  );
});

test("On Vercel x-vercel-forwarded-for is preferred", () => {
  const result = resolveTrustedSupportClientIdentity(
    request({
      "x-vercel-forwarded-for": rawIp,
      "x-forwarded-for": alternateIp,
    }),
    { VERCEL: "1", NODE_ENV: "production" },
  );

  assert.deepEqual(result, { ok: true, identity: rawIp });
});

test("On Vercel x-forwarded-for is the fallback", () => {
  const result = resolveTrustedSupportClientIdentity(
    request({ "x-forwarded-for": alternateIp }),
    { VERCEL: "1", NODE_ENV: "production" },
  );

  assert.deepEqual(result, { ok: true, identity: alternateIp });
});

test("comma-separated forwarding values use the first entry", () => {
  const result = resolveTrustedSupportClientIdentity(
    request({ "x-vercel-forwarded-for": ` ${rawIp}, ${alternateIp}` }),
    { VERCEL: "1", NODE_ENV: "production" },
  );

  assert.deepEqual(result, { ok: true, identity: rawIp });
});

test("invalid IP values fail safely", () => {
  const result = resolveTrustedSupportClientIdentity(
    request({ "x-vercel-forwarded-for": "not-an-ip" }),
    { VERCEL: "1", NODE_ENV: "production" },
  );

  assert.deepEqual(result, { ok: false });
});

test("non-Vercel production does not trust forwarded headers", () => {
  const result = resolveTrustedSupportClientIdentity(
    request({ "x-forwarded-for": rawIp }),
    { NODE_ENV: "production" },
  );

  assert.deepEqual(result, { ok: false });
});

test("local development uses the fixed local identity", () => {
  const result = resolveTrustedSupportClientIdentity(
    request({ "x-forwarded-for": rawIp }),
    { NODE_ENV: "development" },
  );

  assert.deepEqual(result, {
    ok: true,
    identity: SUPPORT_RATE_LIMIT_LOCAL_IDENTITY,
  });
});

test("HMAC output is deterministic for the same identity and secret", () => {
  assert.equal(
    createSupportRateLimitIdentifier(rawIp, validSecret),
    createSupportRateLimitIdentifier(rawIp, validSecret),
  );
});

test("different secrets produce different identifiers", () => {
  assert.notEqual(
    createSupportRateLimitIdentifier(rawIp, validSecret),
    createSupportRateLimitIdentifier(
      rawIp,
      "abcdef0123456789abcdef0123456789",
    ),
  );
});

test("short hashing secrets are rejected", () => {
  assert.throws(
    () => createSupportRateLimitIdentifier(rawIp, "short"),
    { name: "SupportAssistantRateLimitUnavailableError" },
  );
});

test("missing hashing secret is rejected", async () => {
  const burst = new FakeWindowLimiter([]);
  const hourly = new FakeWindowLimiter([]);

  await assert.rejects(
    () =>
      limiterWith(burst, hourly, {
        VERCEL: "1",
        NODE_ENV: "production",
      }).check(request({ "x-vercel-forwarded-for": rawIp })),
    { name: "SupportAssistantRateLimitUnavailableError" },
  );
});

test("production Upstash factory is lazy and build-safe without env values", () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const originalSecret = process.env.SUPPORT_RATE_LIMIT_SECRET;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.SUPPORT_RATE_LIMIT_SECRET;

  try {
    assert.doesNotThrow(() => createUpstashSupportAssistantRateLimiter());
  } finally {
    process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    process.env.SUPPORT_RATE_LIMIT_SECRET = originalSecret;
  }
});

test("configured burst and hourly algorithms use exact requested limits", () => {
  assert.deepEqual(buildSupportRateLimitWindowConfigs(), [
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
  ]);
});

test("analytics is disabled and no global limiter is configured", () => {
  const configs = buildSupportRateLimitWindowConfigs();

  assert.equal(configs.length, 2);
  assert.deepEqual(
    configs.map((config) => config.name),
    ["burst", "hourly"],
  );
  assert.deepEqual(
    configs.map((config) => config.analytics),
    [false, false],
  );
});
