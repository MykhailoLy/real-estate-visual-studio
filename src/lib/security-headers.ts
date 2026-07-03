export interface ResponseHeader {
  key: string;
  value: string;
}

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
      "camera=(), microphone=(), geolocation=(), payment=(), accelerometer=(), gyroscope=(), magnetometer=(), browsing-topics=()",
  },
] as const satisfies readonly ResponseHeader[];

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
  "frame-src 'self' https://grvltquwenaorucsvooc.supabase.co https://challenges.cloudflare.com",
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
