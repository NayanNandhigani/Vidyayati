# Deployment — Vidya Yati

Deployment-readiness audit, current as of 2026-09-15 (updated same day in
a follow-up round that resolved the redirect-loop item originally flagged
as this audit's top blocker). This documents the current deployment path,
what was actually verified (and how, given the constraints of the
auditing environment), what's still broken or unverified, and one open
risk that needs a product decision rather than a code fix.

## Current deployment path

- **Target**: Railway, via `railway.json` — `build.builder: DOCKERFILE`
  pointing at the repo-root `Dockerfile`.
- **Build**: multi-stage (`deps` → `builder` → `runner`), `node:20-slim`.
  Deliberately does **not** use Next's `standalone` output — the
  Dockerfile's own comment explains why: standalone output prunes
  `node_modules` to only what's traced from `import`/`require`, which
  drops the `prisma` CLI (invoked via `npx prisma ...`, never imported)
  and would silently break `scripts/migrate.sh`. Full `node_modules` is
  carried into the runner stage instead — larger image, but correct.
- **Pre-deploy**: `railway.json`'s `preDeployCommand` runs
  `bash scripts/migrate.sh` (→ `prisma migrate deploy`) once against the
  live `DATABASE_URL` before the new container is promoted to take
  traffic.
- **Start command**: `npm run start` → `next start --port ${PORT-3000}`,
  matching both the Dockerfile's `CMD` and Railway's own `startCommand`.
- **Health check**: `railway.json` points at `/api/health`
  (`app/api/health/route.ts`) — a dependency-free `200 OK` with no auth/DB
  involved, specifically so deploy-gating never depends on app logic (see
  the `/login`→`/signin` investigation write-up below for why that
  mattered).

## What was verified

Docker itself has no daemon available in this sandbox (`docker build .`
fails at the connection step, not a Dockerfile problem), so I couldn't run
the literal command asked for. Instead I verified every step the
Dockerfile actually runs, natively, in the same order:

- `npm ci` — succeeds, installs cleanly (Prisma's own `postinstall` runs
  `prisma generate` automatically; the Dockerfile's explicit
  `npx prisma generate` in the builder stage is redundant but harmless).
- `npx prisma validate` — schema is valid. **Note:** this requires
  `DATABASE_URL` to be *set* (not reachable, just present) or it fails
  with `P1012`; this matters for CI (see below).
- `npm run build` — succeeds, both with and without `DATABASE_URL`/
  `AUTH_SECRET` present. Confirmed every route in the app renders on
  demand (`ƒ`, not `○` static) except the true statics (`/_not-found`),
  so `next build` never touches the database — no build-time DB
  dependency to worry about on Railway or in CI.
- `npm run start` reads `PORT` correctly (Railway injects this
  automatically; `EXPOSE 3000`/`ENV PORT=3000` in the Dockerfile are just
  the local-run default).

**Net**: I'm confident the Dockerfile builds and runs correctly, but
nobody has run the literal `docker build .` since this audit — do that
once with real Docker before treating it as fully proven.

`railway.json` itself checks out: correct Dockerfile path, correct start
command, a real dependency-free health check route, `ON_FAILURE` restart
policy with 3 retries.

### Migrations (`prisma/migrations/`, cross-checked against `scripts/migrate.sh`)

`scripts/migrate.sh` runs `prisma migrate deploy` (the correct
production-safe command — never `migrate dev`, which can prompt or
reset). Reviewed all 68 migrations for destructive changes run against a
real database. Found several `DROP COLUMN`/`DROP TABLE` migrations, but
essentially all of them are properly handled:

- `student_surname` splits `Student.name` into `first_name`/`surname`
  with a data-preserving `UPDATE` before the `NOT NULL` is added.
- `transport_vehicles_and_attendance` backfills a new `transport_vehicles`
  row per existing route *before* dropping the old columns off
  `transport_routes`.
- `website_elements` and `id_card_templates` both migrate existing
  content into the new element-based tables before dropping the old
  columns/tables, with inline comments explaining the mapping.
- `fee_structure_by_grade` drops and recreates `class_fee_defaults`
  outright, with an explicit code comment: "No real data exists in this
  table yet, so a clean drop/recreate is safe."

**One exception**: `20260829000000_remove_school_plan` drops
`contracts.plan` and `schools.plan` with no backfill or safety comment —
it's the one migration in the history that doesn't follow the
otherwise-consistent pattern of justifying a drop. Low actual risk today
(the project has never been deployed to production, so there's no real
customer data to lose), but worth a retroactive comment, and worth
enforcing the "justify every drop" convention the rest of the history
already follows for anything written from here on — the app *does* have
a first real school onboarding somewhere on the near horizon.

### `.env.example` vs. actual `process.env` usage

Grepped the whole codebase for `process.env`. Only `NODE_ENV` is read
directly in app code (`lib/db.ts`); `DATABASE_URL` and `AUTH_SECRET` are
consumed implicitly by Prisma and NextAuth respectively (and both are
documented in `.env.example`). `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/
`WHATSAPP_API_TOKEN` are documented but commented out and genuinely
unused — that's intentional, matching CLAUDE.md's "on hold" phases
(payments, WhatsApp), not a bug. **No undocumented-but-used or
documented-but-unused env vars found.**

### CI (`.github/workflows/`)

None existed. Added `.github/workflows/ci.yml` — runs on every PR (and
pushes to `main`): `npx prisma validate`, `npm run lint`, `npm test`,
`npm run build`, using placeholder (non-secret) `DATABASE_URL`/
`AUTH_SECRET` values since `prisma validate` requires the var to be set
and it costs nothing to set the same placeholders for `build`. The test
step was added in a follow-up round once a Vitest suite landed on this
branch via a merge from `claude/busy-faraday-y5460a` (67 tests across 5
files, all passing).

Getting this working surfaced a real, separate gap: **`npm run lint` was
non-functional before this change.** No `.eslintrc.json` (or any ESLint
config) existed anywhere in the repo, so `next lint` drops into an
interactive "how would you like to configure ESLint?" prompt — which
hangs forever in a non-interactive shell (CI, Docker, this sandbox). I
added a minimal `.eslintrc.json` (`next/core-web-vitals`, the standard
default) so `npm run lint` actually completes. Running it surfaced ~25
pre-existing `react/no-unescaped-entities` warnings (curly-quote escaping
in JSX text) spread across ~20 unrelated files — a cosmetic, non-bug
finding, and fixing all of them was out of scope for a deployment-
readiness pass. Since this is the very first ESLint config the project
has had, I set that one rule to `"warn"` rather than leaving the default
`"error"`, so CI is green today without either masking new issues or
turning this round into an unrelated 20-file cleanup. Everything else
lint checks stays at its default severity — the two `useMemo` dependency
warnings and one missing `alt` prop are pre-existing too and still show
as warnings, not silenced.

### Dependency security (adjacent finding, fixed)

`npm audit` on a fresh `npm ci` showed 9 vulnerabilities including one
**critical**: an unauthenticated RCE in the exact Next.js version range
this app was pinned to, plus 2 more via the `sharp` image library. `npm
audit fix` (non-`--force`, no breaking changes) resolved the critical RCE
and 2 of the highs by bumping `next` within its already-declared
`^15.1.0` range (installed: 15.5.25) and bumping transitive deps
(`js-yaml`, `deepmerge-ts`, `sharp`) — `package.json` didn't need to
change, only `package-lock.json`. Re-ran the full build afterward to
confirm nothing broke. **Remaining 7 (3 moderate, 4 high)** all require
a major-version bump (`next@16`, breaking; or `exceljs@3.4.0` for a
`uuid` fix, breaking) — deliberately left alone since that's a real
upgrade decision, not a hygiene fix, and belongs to whoever owns the
Next.js 15→16 migration.

## What's broken or unverified

- **`docker build .` itself was never run** (no daemon in this sandbox).
  Every command inside it was verified natively instead (see above). Run
  it for real once, before the next deploy, as final confirmation.
- **CI is new and unproven on real GitHub Actions runners** — validated
  every step locally with the same commands, but the workflow itself
  hasn't executed on `actions/checkout` + `actions/setup-node` yet.

### `/login`→`/signin` redirect-loop investigation — resolved (statically); one thing still needs a live deploy to fully confirm

This was the audit's top blocker; a follow-up round investigated and
closed it out. Recap of what was found and fixed:

**Application-level cause: ruled out.** Re-read `app/signin/page.tsx`,
`app/signin/actions.ts`, `auth.config.ts`, and `middleware.ts` end to end.
`middleware.ts`'s matcher (`["/app/:path*", "/super-admin/:path*"]`)
never touches `/signin` or `/login` — it structurally cannot produce this
redirect. The sign-in flow itself is a plain form POST to a server action
(`loginAction`) with no client-side `callbackUrl` redirect logic and no
`signIn()` call with `redirect: true` on the GET path — there is no
in-app code path that could make `GET /signin` redirect anywhere, let
alone to itself. `app/signin/page.tsx` already had `export const dynamic
= "force-dynamic"` from the prior round, so it wasn't even a candidate
for build-time static prerendering.

**Root cause, on the balance of evidence: a browser-level permanent-
redirect cache, not a server-side loop.** The `/login`→`/signin` redirect
in `next.config.js` was declared `permanent: true` (a 308). Browsers
cache 301/308 redirects **indefinitely, client-side, regardless of any
`Cache-Control` header the server sends** — a behavior no server-side fix
can undo for a client that already cached it. This matches every
observed symptom exactly: it persisted across redeploys (a redeploy
rebuilds the container, not a visitor's browser cache), it was tied to
one specific hostname (`vidyayati-production.up.railway.app`, previously
used by a now-deleted project that "really did have this exact
redirect-loop bug on old code" per the original investigation's commit
message), and it produced "zero React render evidence" (a cached
redirect is served entirely from the browser's own cache — the request
for `/signin` never reaches the server or the React tree at all).

**Fixes applied:**
1. `next.config.js`: changed the `/login`→`/signin` redirect from
   `permanent: true` (308) to `permanent: false` (307) — 307s are not
   cached by browsers by default, so a mistake here (or a future one on
   any other redirect) can't get stuck the same way again.
2. `next.config.js`: restored `headers()`, scoped narrowly to `/signin`
   and `/api/auth/:path*` (not the wide/global scope hinted at in the
   removed version) — `Cache-Control: no-store, must-revalidate` on both,
   as defense-in-depth against any layer trying to cache a fresh response
   in the future.
3. Removed the `TEMP DEBUG` `console.log` statements from
   `middleware.ts`, `app/page.tsx`, and `app/signin/page.tsx` — this
   round is the investigation's conclusion they were left pending.

**Verified locally** (`next build && next start`, real `curl` against the
running server — as close to a real repro as this sandbox allows without
a live Railway deploy):
- `curl -D- /login` → `307 Temporary Redirect`, `Location: /signin`, no
  `Refresh` header artifact.
- `curl -D- /signin` → `200 OK`, `Cache-Control: no-store, must-revalidate`,
  real rendered HTML body, no debug logging anywhere in the response.
- `curl -D- /api/auth/session` → `200 OK`, also carries `no-store` (plus
  NextAuth's own `expires: 0`/`pragma: no-cache`).
- **One concrete discovery worth recording**: `headers()` rules do
  **not** apply to a response served by `redirects()` — confirmed by
  curling `/login` and seeing no `Cache-Control` header at all, even with
  a matching `headers()` rule in place. I removed that dead rule from the
  config rather than leave a header declaration that silently does
  nothing. `/login`'s actual protection is the non-permanent redirect
  (fix #1), not a response header.
- `npm run lint`, `npm test` (67/67 passing), and `npm run build` all
  pass with these changes.

**What this doesn't (and can't) confirm without a live deploy**: whether
the *original* production report was actually this exact browser-cache
mechanism, versus something at a CDN/reverse-proxy layer in front of
Railway (if a custom domain ever sat behind e.g. Cloudflare) independently
caching the old 308. There is still no live Railway project under this
account (confirmed again this round), so there's nothing to deploy this
to and re-curl for a real repro. **If the loop is ever reported again
after this fix ships**, the next step is checking for a CDN/custom-domain
layer in front of Railway and purging its cache there — that's
infrastructure outside this repo, not something further code changes here
can reach.

## Storage / persistent volume risk (point 4 — flagging, not fixing)

`lib/storage.ts` writes every uploaded file (student/staff photos, ID
card assets, certificates, website images, vehicle/person documents) to
local disk under `DATA/uploads`, and reads them back the same way. This
is a deliberate, documented decision in `ARCHITECTURE.md` — object
storage (S3/R2) was explicitly declined for V1, "until there's an actual
deployment target with no persistent filesystem."

**That deployment target now exists, and the risk is real and
unmitigated:**

- `railway.json` has **no volume configuration at all** — nothing in it
  mounts a persistent path.
- I checked whether a volume might already be attached at the Railway
  project level (outside the repo, via the Railway API) rather than in
  `railway.json`. Querying the connected Railway account directly
  (`list-projects`) returned **zero projects** — there is currently no
  live Railway project under this account to even attach a volume to.
  So today, there is neither a `railway.json` volume declaration nor a
  live provisioned volume anywhere.
- On Railway (like most container platforms), a deploy replaces the
  container's filesystem outright. Without an explicitly attached Railway
  Volume mounted at the same path `lib/storage.ts` writes to
  (`/app/DATA` inside the container), **every previously uploaded file is
  permanently lost on the next deploy or restart** — not degraded, gone.
  This also breaks the moment the service is scaled to more than one
  instance, since a Railway Volume is single-instance-attached.

**Recommendation** (decision, not implementation — deliberately not doing
this myself):

1. **Short-term, same platform**: attach a Railway Volume mounted at
   `/app/DATA` before any real school's data goes live. Quick, but still
   single-instance and still Railway-specific — doesn't survive a future
   move off Railway or a scale-out.
2. **Correct long-term fix**: migrate `lib/storage.ts` to S3/R2-compatible
   object storage, as `ARCHITECTURE.md` already anticipates ("a prior
   pass added a Netlify Blobs branch... but it was removed"). This is a
   bigger, cross-cutting change (every upload/read/delete call site, plus
   the auth-gated serving routes in `app/api/*-assets`) and is exactly
   the kind of decision `ARCHITECTURE.md` flags as needing a real owner
   — not something to bolt on inside a readiness audit.

Given the app already ships real file-upload features (ID cards,
certificates, student/staff documents), I'd treat this as a **pre-launch
blocker**, not a nice-to-have, the moment a Railway volume is attached or
the first real school's data is expected to survive a redeploy.

## Summary: blockers vs. nice-to-haves

**Blockers** (must resolve before a real school's data goes live):

1. **No persistent volume for `DATA/uploads`** — uploaded files will not
   survive a redeploy on the current Railway config. Needs a Volume
   attached (quick) or an S3/R2 migration (correct long-term); either is
   a decision for the Team Leader/user, not something I implemented.
2. **`docker build .` has never actually been run** — every underlying
   command was verified natively, but the real Dockerfile build itself
   is still unproven end-to-end.

**Resolved this round:**

3. **`/login`→`/signin` redirect-loop investigation** — root-caused
   (browser-side permanent-redirect caching, not a server loop),
   application code ruled out end-to-end, fixed (307 instead of 308,
   scoped `no-store` headers restored), debug logging removed, and
   verified via a real local `next build && next start` + `curl` repro.
   See "What's broken or unverified" above for the one piece that still
   genuinely needs a live Railway deploy to fully close out (a
   CDN/custom-domain layer, if one ever existed, is outside this repo's
   reach).

**Nice-to-haves / lower priority:**

4. New/updated CI workflow (`.github/workflows/ci.yml`) is unproven on
   real GitHub Actions runners — first PR against this branch will be the
   real test.
5. `20260829000000_remove_school_plan` migration lacks the
   safety-justification comment every other destructive migration has —
   low risk today (no production data exists yet), worth a retroactive
   comment for consistency.
6. Remaining 7 `npm audit` findings (3 moderate, 4 high) all require a
   breaking major-version bump (`next@16` or `exceljs@3.4.0`) — deferred
   as a deliberate upgrade decision, not hygiene.
7. `.eslintrc.json` downgrades `react/no-unescaped-entities` to a warning
   to unblock CI on ~25 pre-existing, purely cosmetic findings across
   ~20 files — worth a real cleanup pass at some point, but not urgent.
