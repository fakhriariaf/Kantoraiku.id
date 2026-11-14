import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // PGlite memuat WASM + file data: jalankan lewat require Node biasa, jangan di-bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
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
