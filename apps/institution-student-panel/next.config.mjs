/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @maxmusic/ui and @maxmusic/utils ship TypeScript source — Next transpiles them.
  transpilePackages: ["@maxmusic/ui", "@maxmusic/utils", "@maxmusic/types"],
  experimental: {
    // Tree-shake the @maxmusic/ui barrel per-import. Without this, importing one
    // Button compiles the ENTIRE barrel (recharts, motion, all primitives) into
    // every page chunk (~2 MB/page in dev) — the source of panel-wide UI lag.
    optimizePackageImports: ["@maxmusic/ui", "recharts"],
  },
};

export default nextConfig;
