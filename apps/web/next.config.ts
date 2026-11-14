import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Driver Postgres: jalankan lewat require Node biasa, jangan di-bundle.
  serverExternalPackages: ["postgres"],
  // Kontrak bersama ditulis dalam TypeScript langsung (tanpa build step).
  transpilePackages: ["@kantoraiku/shared"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
