import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Modern formats — Next.js negotiates AVIF/WebP per request and
    // falls back to the original format for unsupported browsers.
    formats: ["image/avif", "image/webp"],
    // Keep optimized variants on the Vercel image cache for 31 days.
    // Supabase public objects currently respond with `cache-control:
    // no-cache`, which would otherwise cap the optimizer cache at the
    // 4-hour default and re-fetch the origin constantly. All public
    // media URLs are versioned (timestamp + random nonce), so a
    // replacement always gets a new URL — a long optimizer TTL can
    // never serve a stale image.
    minimumCacheTTL: 2678400, // 31 days

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
