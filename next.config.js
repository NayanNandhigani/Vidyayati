/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The actual root cause of the long-running /signin (and even /)
  // self-redirect loop under `next start` on Railway (and any reverse
  // proxy without an explicit --hostname passed to `next start`):
  // node_modules/next/dist/server/next-server.js constructs the URL it
  // hands to the middleware runtime as
  // `${protocol}://${this.fetchHostname || 'localhost'}:${port}${path}`
  // — with no --hostname flag, this.fetchHostname is unset and it falls
  // back to the literal string "localhost", regardless of the real
  // incoming Host/X-Forwarded-Host headers (confirmed live: a temporary
  // /api/debug-headers route showed `request.url` as
  // "https://localhost:8080/..." even though Host and X-Forwarded-Host
  // both correctly showed the public domain). Every downstream URL this
  // app derives from that request — next-auth's trustHost origin
  // detection included — inherits the wrong "localhost" origin, and
  // something in that chain issues a same-path redirect that resolves
  // to a no-op self-redirect on whatever page triggered it.
  // skipMiddlewareUrlNormalize makes Next.js use the real incoming
  // request URL instead of reconstructing this synthetic one. We don't
  // use i18n or trailingSlash, so this has no other effect for us.
  skipMiddlewareUrlNormalize: true,
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
