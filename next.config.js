/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    // /login was the route's name before it was renamed to /signin —
    // keep old bookmarks/links working.
    return [{ source: "/login", destination: "/signin", permanent: true }];
  },
  async headers() {
    // Belt-and-suspenders against any caching layer (browser, CDN, or
    // Railway's edge) serving a stale response for an app this
    // session-driven — every response should be revalidated.
    return [{ source: "/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] }];
  },
};

module.exports = nextConfig;
