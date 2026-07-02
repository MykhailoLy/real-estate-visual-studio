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

export function getBaselineSecurityHeaders(): ResponseHeader[] {
  return BASELINE_SECURITY_HEADERS.map((header) => ({ ...header }));
}
