/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    // /login was the route's name before it was renamed to /signin —
    // keep old bookmarks/links working.
    return [{ source: "/login", destination: "/signin", permanent: true }];
  },
  // TEMP DEBUG: headers() removed to isolate whether it's interacting
  // badly with redirects() — /signin is looping on itself with zero
  // React render evidence (not even the root layout fires), meaning
  // something resolves the redirect before component rendering starts.
  // Restore once the actual cause is confirmed.
};

module.exports = nextConfig;
