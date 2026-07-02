import assert from "node:assert/strict";
import test from "node:test";
import nextConfig from "../../next.config.ts";
import {
  getBaselineSecurityHeaders,
  getContentSecurityPolicyReportOnlyHeader,
  type ResponseHeader,
} from "./security-headers.ts";

const expectedHeaders: ResponseHeader[] = [
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
];

const forbiddenHeaders = [
  "Strict-Transport-Security",
  "Content-Security-Policy",
  "Content-Security-Policy-Report-Only",
  "X-XSS-Protection",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Embedder-Policy",
  "Cross-Origin-Resource-Policy",
];

const expectedContentSecurityPolicyReportOnly =
  "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://client.crisp.chat; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://grvltquwenaorucsvooc.supabase.co https://www.google-analytics.com https://www.googletagmanager.com; font-src 'self'; connect-src 'self' https://grvltquwenaorucsvooc.supabase.co https://www.google-analytics.com https://region1.google-analytics.com; frame-src 'self' https://grvltquwenaorucsvooc.supabase.co; media-src 'self' blob: https://grvltquwenaorucsvooc.supabase.co; worker-src 'self'; manifest-src 'self'";

const expectedContentSecurityPolicyReportOnlyHeader: ResponseHeader = {
  key: "Content-Security-Policy-Report-Only",
  value: expectedContentSecurityPolicyReportOnly,
};

const expectedContentSecurityPolicyDirectives = [
  "default-src",
  "base-uri",
  "object-src",
  "frame-ancestors",
  "form-action",
  "script-src",
  "style-src",
  "img-src",
  "font-src",
  "connect-src",
  "frame-src",
  "media-src",
  "worker-src",
  "manifest-src",
];

const forbiddenContentSecurityPolicyTokens = [
  "report-uri",
  "report-to",
  "upgrade-insecure-requests",
  "block-all-mixed-content",
  "'unsafe-eval'",
  "'strict-dynamic'",
  "*.crisp.chat",
  "*.crisp.website",
];

const expectedContentSecurityPolicyOrigins = [
  "https://www.googletagmanager.com",
  "https://www.google-analytics.com",
  "https://region1.google-analytics.com",
  "https://client.crisp.chat",
  "https://grvltquwenaorucsvooc.supabase.co",
];

test("baseline security headers match the approved policy exactly", () => {
  const headers = getBaselineSecurityHeaders();

  assert.deepEqual(headers, expectedHeaders);
  assert.equal(headers.length, 4);
});

test("baseline security headers do not include duplicate or forbidden headers", () => {
  const headers = getBaselineSecurityHeaders();
  const headerNames = headers.map((header) => header.key.toLowerCase());

  assert.equal(new Set(headerNames).size, headerNames.length);

  for (const forbiddenHeader of forbiddenHeaders) {
    assert.equal(headerNames.includes(forbiddenHeader.toLowerCase()), false);
  }
});

test("baseline security header values do not contain newline characters", () => {
  for (const header of getBaselineSecurityHeaders()) {
    assert.equal(/[\r\n]/.test(header.value), false);
  }
});

test("baseline security headers are returned as independent arrays", () => {
  const firstHeaders = getBaselineSecurityHeaders();
  const secondHeaders = getBaselineSecurityHeaders();

  assert.notEqual(firstHeaders, secondHeaders);

  firstHeaders.push({
    key: "X-Test-Mutation",
    value: "mutated",
  });
  firstHeaders[0].value = "mutated";

  assert.deepEqual(getBaselineSecurityHeaders(), expectedHeaders);
});

test("content security policy report-only header matches the approved policy exactly", () => {
  assert.deepEqual(
    getContentSecurityPolicyReportOnlyHeader(),
    expectedContentSecurityPolicyReportOnlyHeader,
  );
});

test("content security policy report-only value contains each approved directive once", () => {
  const { value } = getContentSecurityPolicyReportOnlyHeader();

  for (const directive of expectedContentSecurityPolicyDirectives) {
    const matches = value.match(new RegExp(`(?:^|; )${directive}\\b`, "g"));

    assert.equal(matches?.length ?? 0, 1);
  }
});

test("content security policy report-only value excludes disallowed directives and source patterns", () => {
  const { key, value } = getContentSecurityPolicyReportOnlyHeader();
  const sourceTokens = value.split(/\s+/);

  assert.equal(key, "Content-Security-Policy-Report-Only");
  assert.notEqual(key, "Content-Security-Policy");
  assert.equal(/[\r\n]/.test(value), false);

  for (const forbiddenToken of forbiddenContentSecurityPolicyTokens) {
    assert.equal(value.includes(forbiddenToken), false);
  }

  assert.equal(/'nonce-|nonce-/.test(value), false);
  assert.equal(/'sha(256|384|512)-/.test(value), false);
  assert.equal(sourceTokens.includes("https:"), false);
  assert.equal(sourceTokens.includes("wss:"), false);
  assert.equal(sourceTokens.includes("*"), false);
});

test("content security policy report-only value includes the approved external origins", () => {
  const { value } = getContentSecurityPolicyReportOnlyHeader();

  for (const expectedOrigin of expectedContentSecurityPolicyOrigins) {
    assert.equal(value.includes(expectedOrigin), true);
  }
});

test("content security policy report-only header is returned without shared mutable state", () => {
  const firstHeader = getContentSecurityPolicyReportOnlyHeader();
  const secondHeader = getContentSecurityPolicyReportOnlyHeader();

  assert.notEqual(firstHeader, secondHeader);

  firstHeader.value = "mutated";

  assert.deepEqual(
    getContentSecurityPolicyReportOnlyHeader(),
    expectedContentSecurityPolicyReportOnlyHeader,
  );
});

test("next config exposes baseline security headers for all paths", async () => {
  assert.equal(typeof nextConfig.headers, "function");

  const headerRules = await nextConfig.headers();

  assert.deepEqual(headerRules, [
    {
      source: "/:path*",
      headers: [
        ...expectedHeaders,
        expectedContentSecurityPolicyReportOnlyHeader,
      ],
    },
  ]);
});

test("next config exposes one report-only CSP and no enforced CSP", async () => {
  assert.equal(typeof nextConfig.headers, "function");

  const headerRules = await nextConfig.headers();
  const headerNames = headerRules.flatMap((rule) =>
    rule.headers.map((header) => header.key),
  );

  assert.equal(headerRules.length, 1);
  assert.equal(headerRules[0].source, "/:path*");
  assert.equal(headerRules[0].headers.length, 5);
  assert.equal(
    headerNames.filter(
      (headerName) => headerName === "Content-Security-Policy-Report-Only",
    ).length,
    1,
  );
  assert.equal(
    headerNames.some((headerName) => headerName === "Content-Security-Policy"),
    false,
  );
});

test("next config keeps the existing redirects and image configuration", async () => {
  assert.equal(typeof nextConfig.redirects, "function");
  assert.deepEqual(await nextConfig.redirects(), [
    {
      source: "/:path*",
      has: [
        {
          type: "host",
          value: "www.picchuspot.com",
        },
      ],
      destination: "https://picchuspot.com/:path*",
      permanent: true,
    },
  ]);

  assert.deepEqual(nextConfig.images, {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "grvltquwenaorucsvooc.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  });
});
