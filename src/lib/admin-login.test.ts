import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { after, beforeEach } from "node:test";

// Isolated shared-backend substitute. No network, credentials or production data.
// The real route, auth, identity resolver and timeout wrapper run unchanged.
type Options = { prefix: string; limiter: { limit: number; window: number }; [key: string]: unknown };
const configurations: Options[] = [];
const counts = new Map<string, { count: number; reset: number }>();
let now = Date.now();
let failure = false;
let stall = false;
let calls = 0;
const jar = new Map<string, { value: string; options: unknown }>();
class TestRatelimit {
  options: Options;
  constructor(options: Options) { this.options = options; configurations.push(options); }
  static slidingWindow(limit: number, duration: string) {
    return { limit, window: Number(duration.split(" ")[0]) * 60_000 };
  }
  async limit(identifier: string) {
    calls++;
    if (failure) throw new Error("private backend detail");
    if (stall) return new Promise<never>(() => {});
    assert.match(identifier, /^[a-f0-9]{64}$/);
    const key = `${this.options.prefix}:${identifier}`;
    const entry = counts.get(key);
    const state = entry && entry.reset > now ? entry : { count: 0, reset: now + this.options.limiter.window };
    // Atomic reservation before yielding, shared by all simulated instances.
    const success = state.count < this.options.limiter.limit;
    if (success) state.count++;
    counts.set(key, state);
    return { success, reset: state.reset };
  }
}
const globals = globalThis as typeof globalThis & { __adminLoginFixture?: unknown };
globals.__adminLoginFixture = {
  TestRatelimit,
  cookies: {
    set(name: string, value: string, options: unknown) { jar.set(name, { value, options }); },
    get(name: string) { return jar.get(name); },
  },
};
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  const source = specifier === "@upstash/ratelimit"
    ? "export const Ratelimit = globalThis.__adminLoginFixture.TestRatelimit"
    : specifier === "@upstash/redis"
      ? "export class Redis {}"
      : specifier === "next/headers"
        ? "export async function cookies(){ return globalThis.__adminLoginFixture.cookies }"
        : null;
  if (source) return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true };
  if (specifier.startsWith("@/lib/")) return { url: new URL(`./${specifier.slice(6)}.ts`, import.meta.url).href, shortCircuit: true };
  return nextResolve(specifier, context);
} });
const { POST } = await import("../app/(public)/api/admin/login/route.ts");
const { ADMIN_COOKIE_NAME, buildSessionCookieValue, verifySessionCookieValue, isAdminAuthenticated } = await import("./admin-auth.ts");
const env: Record<string, string | undefined> = process.env;
const saved = { ...process.env };
const password = "synthetic-admin-password";
beforeEach(() => {
  Object.assign(env, { ADMIN_PASSWORD: password, VERCEL: "1", VERCEL_ENV: "production", NODE_ENV: "production",
    SUPPORT_RATE_LIMIT_SECRET: "synthetic-test-secret-at-least-32-characters",
    UPSTASH_REDIS_REST_URL: "https://redis.example.test", UPSTASH_REDIS_REST_TOKEN: "synthetic" });
  counts.clear(); jar.clear(); failure = false; stall = false; calls = 0; now = Date.now();
});
after(() => {
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete env[key];
  Object.assign(env, saved);
  delete globals.__adminLoginFixture;
});
function request(body = JSON.stringify({ password: "wrong" }), headers: HeadersInit = {}) {
  return new Request("https://example.test/api/admin/login", { method: "POST", body,
    headers: { "x-vercel-forwarded-for": "203.0.113.10", ...headers } });
}
const login = () => POST(request(JSON.stringify({ password })));

test("missing Redis configuration fails closed before initialization", async () => {
  delete env.UPSTASH_REDIS_REST_TOKEN;
  assert.equal((await login()).status, 503);
  assert.equal(jar.size, 0);
});
test("correct password keeps the existing session and cookie attributes", async () => {
  assert.equal((await login()).status, 200);
  const cookie = jar.get(ADMIN_COOKIE_NAME)!;
  assert.equal(verifySessionCookieValue(cookie.value), true);
  assert.equal(await isAdminAuthenticated(), true);
  assert.deepEqual(cookie.options, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 604800 });
  assert.deepEqual(configurations.map(({ prefix, limiter }) => ({ prefix, limiter })), [
    { prefix: "picchuspot:admin-login:production:burst", limiter: { limit: 5, window: 300000 } },
    { prefix: "picchuspot:admin-login:production:hourly", limiter: { limit: 20, window: 3600000 } },
  ]);
  for (const config of configurations) {
    assert.equal(config.timeout, 0);
    for (const name of ["analytics", "ephemeralCache", "enableProtection", "dynamicLimits"]) assert.equal(config[name], false);
  }
});
test("five wrong passwords retain generic 401; subsequent correct password is blocked", async () => {
  for (let i = 0; i < 5; i++) {
    const response = await POST(request());
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "Incorrect password." });
  }
  const response = await login();
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get("retry-after")) > 0);
  assert.deepEqual(await response.json(), { error: "Unable to sign in. Please try again later." });
  assert.equal(jar.size, 0);
  now += 300001;
  assert.equal((await login()).status, 200);
});
test("hourly budget survives burst recovery and eventually expires", async () => {
  for (let batch = 0; batch < 4; batch++) {
    for (let i = 0; i < 5; i++) assert.equal((await POST(request())).status, 401);
    now += 300001;
  }
  assert.equal((await login()).status, 429);
  now += 3600001;
  assert.equal((await login()).status, 200);
});
test("malformed JSON and all invalid schema forms consume the same budget", async () => {
  for (const body of ["{", "null", "{}", '{"password":123}', JSON.stringify({ password: "a".repeat(513) })]) {
    assert.equal((await POST(request(body))).status, 400);
  }
  assert.equal((await POST(request("{"))).status, 429);
  assert.equal((await login()).status, 429);
  assert.equal(jar.size, 0);
});
test("25 concurrent attempts reserve only five password checks", async () => {
  const statuses = await Promise.all(Array.from({ length: 25 }, async () => (await POST(request())).status));
  assert.equal(statuses.filter(status => status === 401).length, 5);
  assert.equal(statuses.filter(status => status === 429).length, 20);
});
test("successful authentication never resets the attempt budget", async () => {
  for (let i = 0; i < 5; i++) assert.equal((await login()).status, 200);
  jar.clear();
  assert.equal((await login()).status, 429);
  assert.equal(jar.size, 0);
});
test("backend error and timeout deny even the correct password; existing sessions remain valid", async () => {
  const existing = buildSessionCookieValue().value;
  for (const mode of ["error", "timeout"]) {
    failure = mode === "error"; stall = mode === "timeout";
    const response = await login();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "Unable to sign in. Please try again later." });
    assert.equal(jar.size, 0);
    assert.equal(verifySessionCookieValue(existing), true);
  }
  failure = false; stall = false;
  assert.equal((await login()).status, 200);
});
test("untrusted forwarding headers cannot change the Vercel identity", async () => {
  for (let i = 0; i < 5; i++) assert.equal((await POST(request(undefined, { "x-forwarded-for": `198.51.100.${i + 1}` }))).status, 401);
  assert.equal((await POST(request(undefined, { "x-forwarded-for": "198.51.100.99" }))).status, 429);
  assert.equal((await POST(request(undefined, { "x-vercel-forwarded-for": "invalid" }))).status, 503);
  delete env.VERCEL;
  assert.equal((await login()).status, 503);
});
test("missing hashing secret fails closed and leaks no configuration details", async () => {
  delete env.SUPPORT_RATE_LIMIT_SECRET;
  assert.equal((await login()).status, 503);
  assert.equal(calls, 0);
  assert.equal(jar.size, 0);
});
test("session signature and expiry checks remain enforced", () => {
  const value = buildSessionCookieValue().value;
  assert.equal(verifySessionCookieValue(value), true);
  assert.equal(verifySessionCookieValue(`1.${value.split(".")[1]}`), false);
  assert.equal(verifySessionCookieValue(`${value.split(".")[0]}.${"0".repeat(64)}`), false);
  env.ADMIN_PASSWORD = "another-synthetic-password";
  assert.equal(verifySessionCookieValue(value), false);
});

test("preview and missing platform environment cannot use production buckets", async () => {
  for (const environment of ["preview", "development", undefined]) {
    if (environment) env.VERCEL_ENV = environment;
    else delete env.VERCEL_ENV;
    const moduleUrl = new URL(`./admin-login-rate-limit.ts?environment=${environment}`, import.meta.url);
    const { checkAdminLoginRateLimit } = await import(moduleUrl.href);
    const start = configurations.length;
    await checkAdminLoginRateLimit(request());
    assert.deepEqual(configurations.slice(start).map(config => config.prefix), [
      "picchuspot:admin-login:non-production:burst",
      "picchuspot:admin-login:non-production:hourly",
    ]);
  }
});
