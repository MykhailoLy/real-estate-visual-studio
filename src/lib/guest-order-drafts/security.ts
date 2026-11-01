import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { resolveTrustedSupportClientIdentity } from "../support-assistant/ip.ts";
import { SITE_URL } from "../seo.ts";

export const GUEST_DRAFT_COOKIE_NAME = "picchu_guest_vs_draft";
export const newToken = () => randomBytes(32).toString("base64url");
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export function readToken(request: Request, secret: string, now = Date.now()): string | null | undefined {
  const entries =
    request.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .filter((part) => part.split("=", 1)[0] === GUEST_DRAFT_COOKIE_NAME) ?? [];
  if (!entries.length) return undefined; // Only absence permits an initial PUT.
  if (entries.length !== 1) return null;
  const value = entries[0].slice(GUEST_DRAFT_COOKIE_NAME.length + 1);
  const match = /^(v1\.([A-Za-z0-9_-]{43})\.([0-9]{1,12}))\.([a-f0-9]{64})$/.exec(value);
  if (!match || Number(match[3]) <= Math.floor(now / 1000)) return null;
  const signature = createHmac("sha256", secret).update(match[1]).digest();
  return timingSafeEqual(signature, Buffer.from(match[4], "hex")) ? match[2] : null;
}

export function setToken(
  response: Response,
  token: string,
  secret: string,
  expiresAt: string,
  now = Date.now(),
) {
  const expiry = Math.floor(Date.parse(expiresAt) / 1000) - 60;
  const maxAge = expiry - Math.floor(now / 1000);
  if (!Number.isFinite(expiry) || maxAge <= 0) return;
  const prefix = ["v1", token, expiry].join(".");
  const signature = createHmac("sha256", secret).update(prefix).digest("hex");
  const attributes = [
    GUEST_DRAFT_COOKIE_NAME + "=" + prefix + "." + signature,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=" + maxAge,
  ];
  if (process.env.NODE_ENV === "production") attributes.push("Secure");
  response.headers.set("Set-Cookie", attributes.join("; "));
}

export function sameOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  return (
    (site === null || site === "same-origin" || site === "none") &&
    (origin === null || origin === new URL(request.url).origin || origin === new URL(SITE_URL).origin)
  );
}

const quotas = {
  save: [30, "1 m"],
  hourly: [200, "1 h"],
  claim: [20, "1 m"],
  user: [10, "1 m"],
  new: [10, "1 h"],
} as const;
type Quota = keyof typeof quotas;
const limiters = new Map<Quota, Ratelimit>();

// The SDK allows a request on its timeout. Disable that fallback and impose a
// rejecting deadline on the entire operation, including both save quotas.
export async function checkRateLimit(
  request: Request,
  action: Exclude<Quota, "hourly">,
  secret: string,
  userId?: string,
) {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  const identity =
    action === "user" ? { ok: true, identity: userId } : resolveTrustedSupportClientIdentity(request);
  if (!url || !token || !identity.ok || !identity.identity) throw new Error("Limiter unavailable");
  const key = createHmac("sha256", secret)
    .update("guest-drafts\0" + identity.identity)
    .digest("hex");
  const limit = (quota: Quota) => {
    let limiter = limiters.get(quota);
    if (!limiter) {
      const [count, window] = quotas[quota];
      limiter = new Ratelimit({
        redis: new Redis({ url, token, retry: false }),
        limiter: Ratelimit.slidingWindow(count, window),
        prefix: "picchuspot:guest-drafts:" + quota,
        timeout: 0,
        analytics: false,
      });
      limiters.set(quota, limiter);
    }
    return limiter.limit(key);
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const decisions = await Promise.race([
      Promise.all(action === "save" ? [limit("save"), limit("hourly")] : [limit(action)]),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Limiter timeout")), 1500);
      }),
    ]);
    if (
      decisions.some(
        (d) =>
          d.reason === "timeout" ||
          typeof d.success !== "boolean" ||
          !Number.isFinite(d.remaining) ||
          !Number.isFinite(d.reset) ||
          !Number.isFinite(d.limit),
      )
    ) {
      throw new Error("Invalid limiter response");
    }
    return Math.max(
      0,
      ...decisions
        .filter((d) => !d.success)
        .map((d) => Math.max(1, Math.ceil((d.reset - Date.now()) / 1000))),
    );
  } finally {
    clearTimeout(timer);
  }
}
