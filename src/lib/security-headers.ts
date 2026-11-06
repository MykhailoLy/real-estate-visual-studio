import { getTrustedPropertyFrameOrigins } from "../features/property-showcase/provider-urls.ts";
import { TRUSTED_GOOGLE_MAP_FRAME_ORIGINS } from "../features/property-showcase/listing-details.ts";
import { getTrustedPropertyVideoFrameOrigins } from "../features/property-showcase/video-urls.ts";

export interface ResponseHeader {
  key: string;
  value: string;
}

const TRUSTED_PROPERTY_FRAME_ORIGINS = getTrustedPropertyFrameOrigins();
const TRUSTED_PROPERTY_VIDEO_FRAME_ORIGINS =
  getTrustedPropertyVideoFrameOrigins();
const TRUSTED_MAP_FRAME_ORIGINS = [...TRUSTED_GOOGLE_MAP_FRAME_ORIGINS];
const TRUSTED_PROPERTY_PERMISSION_ORIGINS = TRUSTED_PROPERTY_FRAME_ORIGINS.map(
  (origin) => `"${origin}"`,
).join(" ");

const BASELINE_SECURITY_HEADERS = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Permissions-Policy",
    value:
      `camera=(), microphone=(), geolocation=(), payment=(), accelerometer=(self ${TRUSTED_PROPERTY_PERMISSION_ORIGINS}), gyroscope=(self ${TRUSTED_PROPERTY_PERMISSION_ORIGINS}), magnetometer=(), browsing-topics=()`,
  },
] as const satisfies readonly ResponseHeader[];

// CSP nonce migration plan (deferred 2026-11-06, audit F5):
// 'unsafe-inline' in script-src is the current deliberate compromise. Per the
// Next.js 16.3.8 CSP guide (node_modules/next/dist/docs/01-app/02-guides/
// content-security-policy.md), a site-wide nonce policy requires Proxy on page
// routes and DYNAMIC rendering: static generation and ISR are disabled, CDN
// caching needs additional configuration, and static shells get no nonce.
// This mostly-static marketing/portfolio/blog app therefore needs a rendering
// and caching migration, plus build and browser verification. Per CSP3,
// browsers IGNORE 'unsafe-inline' when 'nonce-…' is present in script-src:
// inline scripts still need a matching nonce or an allowed hash.
// Google Analytics rendering after hydration is not itself a blocker: a
// dynamic server layout can pass the nonce through GoogleAnalytics props to
// both <Script> components. Crisp's runtime injections need separate checks.
// Full migration therefore needs ALL of:
// 1. src/proxy.ts: match all page routes (not just /dashboard), generate a
//    per-request nonce, set CSP with 'nonce-…' + 'strict-dynamic' on both the
//    request and response headers, and pass the nonce via x-nonce.
// 2. Force dynamic rendering on pages using the policy (await connection())
//    and re-verify rendering, caching and sitemap behavior.
// 3. Read the nonce via headers() in the server layout, pass it through
//    GoogleAnalytics props to both GA <Script> components, and verify Crisp.
//    'strict-dynamic' allows non-parser-inserted external scripts, not inline
//    blocks or styles; those need separate CSP authorization.
// 4. Rebuild the security-headers tests around the nonce-based policy, and
//    verify with a real next build + production smoke before removing
//    'unsafe-inline'. The experimental SRI (hash-based) alternative in the
//    same guide keeps static generation but is experimental and also needs
//    build-time verification.
const CONTENT_SECURITY_POLICY_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://client.crisp.chat https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://client.crisp.chat",
  "img-src 'self' data: blob: https://grvltquwenaorucsvooc.supabase.co https://www.google-analytics.com https://www.googletagmanager.com https://client.crisp.chat https://image.crisp.chat https://storage.crisp.chat",
  "font-src 'self' https://client.crisp.chat",
  "connect-src 'self' https://grvltquwenaorucsvooc.supabase.co https://www.google-analytics.com https://region1.google-analytics.com https://client.crisp.chat https://storage.crisp.chat wss://client.relay.crisp.chat",
  `frame-src 'self' https://grvltquwenaorucsvooc.supabase.co https://challenges.cloudflare.com ${TRUSTED_PROPERTY_FRAME_ORIGINS.join(" ")} ${TRUSTED_PROPERTY_VIDEO_FRAME_ORIGINS.join(" ")} ${TRUSTED_MAP_FRAME_ORIGINS.join(" ")}`,
  "media-src 'self' blob: https://grvltquwenaorucsvooc.supabase.co https://client.crisp.chat https://storage.crisp.chat",
  "worker-src 'self' blob: https://client.crisp.chat",
  "manifest-src 'self'",
] as const;

export function getBaselineSecurityHeaders(): ResponseHeader[] {
  return BASELINE_SECURITY_HEADERS.map((header) => ({ ...header }));
}

export function getContentSecurityPolicyHeader(): ResponseHeader {
  return {
    key: "Content-Security-Policy",
    value: CONTENT_SECURITY_POLICY_DIRECTIVES.join("; "),
  };
}
