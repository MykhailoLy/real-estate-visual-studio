import assert from "node:assert/strict";
import test from "node:test";
import nextConfig from "../../next.config.ts";
import {
  getBaselineSecurityHeaders,
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

test("next config exposes baseline security headers for all paths", async () => {
  assert.equal(typeof nextConfig.headers, "function");

  const headerRules = await nextConfig.headers();

  assert.deepEqual(headerRules, [
    {
      source: "/:path*",
      headers: expectedHeaders,
    },
  ]);
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
