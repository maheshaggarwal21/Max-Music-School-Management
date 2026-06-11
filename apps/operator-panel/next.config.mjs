/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @maxmusic/ui and @maxmusic/utils ship TypeScript source — Next transpiles them.
  transpilePackages: ["@maxmusic/ui", "@maxmusic/utils", "@maxmusic/types"],
  // Same-origin API proxy (dev): with NEXT_PUBLIC_API_PROXY=1 the client calls
  // /api/* on THIS origin and Next forwards to the backend, so the auth cookie is
  // first-party. Target configurable; defaults to the local API on :4000.
  async rewrites() {
    const target = process.env.API_PROXY_TARGET || "http://localhost:4000";
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
