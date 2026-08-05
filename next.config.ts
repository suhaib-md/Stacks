import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Pin the workspace root. Without this, Turbopack walks up and finds a stray
  // package-lock.json in the home directory, then warns on every build.
  turbopack: { root: import.meta.dirname },
  images: {
    // Cloudflare Workers has no Next image optimizer. Covers are remote URLs
    // rendered at small sizes, so serving them as-is is the right trade.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "covers.openlibrary.org" },
      { protocol: "https", hostname: "books.google.com" },
      { protocol: "https", hostname: "books.googleusercontent.com" },
    ],
  },
};

export default nextConfig;

// Makes D1 and secrets available to `next dev` via the wrangler runtime.
initOpenNextCloudflareForDev();
