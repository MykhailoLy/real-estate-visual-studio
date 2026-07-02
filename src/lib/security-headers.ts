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

const CONTENT_SECURITY_POLICY_REPORT_ONLY_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://client.crisp.chat",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://grvltquwenaorucsvooc.supabase.co https://www.google-analytics.com https://www.googletagmanager.com",
  "font-src 'self'",
  "connect-src 'self' https://grvltquwenaorucsvooc.supabase.co https://www.google-analytics.com https://region1.google-analytics.com",
  "frame-src 'self' https://grvltquwenaorucsvooc.supabase.co",
  "media-src 'self' blob: https://grvltquwenaorucsvooc.supabase.co",
  "worker-src 'self'",
  "manifest-src 'self'",
] as const;

export function getBaselineSecurityHeaders(): ResponseHeader[] {
  return BASELINE_SECURITY_HEADERS.map((header) => ({ ...header }));
}

export function getContentSecurityPolicyReportOnlyHeader(): ResponseHeader {
  return {
    key: "Content-Security-Policy-Report-Only",
    value: CONTENT_SECURITY_POLICY_REPORT_ONLY_DIRECTIVES.join("; "),
  };
}
