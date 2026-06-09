/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @maxmusic/ui and @maxmusic/utils ship TypeScript source — Next transpiles them.
  transpilePackages: ["@maxmusic/ui", "@maxmusic/utils"],
};

export default nextConfig;
