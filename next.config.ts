import type { NextConfig } from "next";
import {
  getBaselineSecurityHeaders,
  getContentSecurityPolicyHeader,
} from "./src/lib/security-headers.ts";

const nextConfig: NextConfig = {
  // Multiple document roots otherwise lose the shared document on unmatched 404s.
  // Evidence and upgrade gate: docs/seo/DOCUMENT-ROOT-MIGRATION.md.
  experimental: { globalNotFound: true },
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/property/*/opengraph-image": [
      "./public/brand/property-social-emergency.png",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...getBaselineSecurityHeaders(),
          getContentSecurityPolicyHeader(),
        ],
      },
    ];
  },
  async redirects() {
    return [
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
    ];
  },
  images: {
    // Use one optimized format family so each responsive width maps to one
    // cache variant instead of separate AVIF and WebP transformations.
    formats: ["image/webp"],
    // Next.js 16 requires an explicit allowlist when components select a
    // quality. Public raster photo contexts use 70; hero and floor plans use
    // 75 where detail is more important than thumbnail byte savings.
    qualities: [70, 75],
    // Keep optimized variants on the Vercel image cache for 31 days.
    // Supabase public objects currently respond with `cache-control:
    // no-cache`, which would otherwise cap the optimizer cache at the
    // 4-hour default and re-fetch the origin constantly. All public
    // media URLs are versioned (timestamp + random nonce), so a
    // replacement always gets a new URL — a long optimizer TTL can
    // never serve a stale image.
    minimumCacheTTL: 2678400, // 31-day cache for versioned public media

    // Strictly allow ONLY the public Supabase Storage object path on
    // the project's host. No wildcard hostnames. Private buckets are
    // served via signed URLs (different path) and are not optimized.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "grvltquwenaorucsvooc.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
