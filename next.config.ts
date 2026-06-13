import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Modern formats — Next.js negotiates AVIF/WebP per request and
    // falls back to the original format for unsupported browsers.
    formats: ["image/avif", "image/webp"],
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
