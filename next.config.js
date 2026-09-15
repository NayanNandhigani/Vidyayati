/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    // /login was the route's name before it was renamed to /signin —
    // keep old bookmarks/links working. `permanent: false` (307) is
    // deliberate, not the Next.js default: the prior investigation into
    // this exact redirect loop (see git history on this file and
    // DEPLOYMENT.md) found a genuine self-redirect on this hostname on
    // the *previous* app that lived here, with no code path in the
    // current app that could produce it — the leading theory was a
    // stale cache of a `permanent: true` (308) redirect from that old
    // deploy, since browsers cache 301/308 redirects indefinitely
    // regardless of any Cache-Control header, surviving redeploys and
    // even outliving the code that issued them. Never mark this redirect
    // (or any other redirect from a path that's ever pointed at itself)
    // permanent, so a future mistake here can't get stuck the same way.
    return [{ source: "/login", destination: "/signin", permanent: false }];
  },
  // Auth entry points must never be cached by an intermediate layer (CDN,
  // edge cache, browser). Scoped to the two real auth routes rather than
  // applied globally, so it can't reproduce the "interacting badly with
  // redirects()" concern raised while this was being investigated.
  // Note: verified locally (`next build && next start`, then curl) that
  // this does NOT apply to /login — Next.js's headers() rules never
  // attach to a response served by redirects(), only to a route that
  // actually renders/responds. /login's protection is the non-permanent
  // redirect above, not this header; /signin and /api/auth/* do get it,
  // confirmed via curl showing `Cache-Control: no-store` on both.
  async headers() {
    const noStore = { key: "Cache-Control", value: "no-store, must-revalidate" };
    return [
      { source: "/signin", headers: [noStore] },
      { source: "/api/auth/:path*", headers: [noStore] },
    ];
  },
};

module.exports = nextConfig;
