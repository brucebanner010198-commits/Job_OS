import type { NextConfig } from "next";

// Production builds write to a separate output dir so `next build` /
// `build:standalone` never delete or rewrite the `.next` cache that a live
// `next dev` server depends on. Without this, a build (or `rm -rf .next`)
// running alongside dev corrupts the shared cache and the dev server starts
// returning HTTP 500. `next build` and `next start` run with
// NODE_ENV=production; `BUILD=1` is an explicit override for scripts/tooling.
const isProductionBuild =
  process.env.NODE_ENV === "production" || process.env.BUILD === "1";
const distDir = isProductionBuild ? ".next-build" : ".next";

const nextConfig: NextConfig = {
  // Keep dev and production caches on separate dirs (see distDir note above).
  distDir,
  // Standalone output for the Tauri desktop sidecar (Phase 12).
  output: "standalone",
  // Prisma must stay external to the server bundle.
  serverExternalPackages: ["@prisma/client", "prisma"],
  experimental: {
    // Server Actions are used for profile updates, apply flows, etc.
    serverActions: {
      bodySizeLimit: "8mb", // resume/PDF uploads
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:;",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
