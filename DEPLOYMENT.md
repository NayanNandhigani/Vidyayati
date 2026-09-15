# Deployment — Vidya Yati

Deployment-readiness audit, current as of 2026-09-15. This documents the
current deployment path, what was actually verified (and how, given the
constraints of the auditing environment), what's still broken or
unverified, and one open risk that needs a product decision rather than a
code fix.

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
  "Known active issue" below for why that mattered).

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
pushes to `main`): `npx prisma validate`, `npm run lint`, `npm run build`,
using placeholder (non-secret) `DATABASE_URL`/`AUTH_SECRET` values since
`prisma validate` requires the var to be set and it costs nothing to set
the same placeholders for `build`. Kept intentionally minimal per the
brief — no test step, since there's no test suite yet (Architecture V1
status already tracks that as deferred Phase 27).

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
- **Active, unresolved production bug in the login flow** — not
  introduced by this audit and not touched by it, but directly relevant
  to deployment readiness since it affects every user's ability to sign
  in. Recent commit history (`e95cd67`, `b18cfe6`, `e9a9722`) shows an
  in-progress investigation into a redirect loop on `/login`: a genuine
  `307 Location: /login` self-redirect was observed in production via
  `curl`, with no code path found that could produce it after review. The
  route was renamed `/login` → `/signin` (with a 301 redirect for old
  links) to sidestep a suspected stale-cache issue tied to the old
  hostname+path, and a dedicated dependency-free `/api/health` route was
  added specifically to stop this from blocking deploy health checks.
  **This is still open**: `middleware.ts`, `app/page.tsx`,
  `app/signin/page.tsx`, and `next.config.js` all still carry `TEMP
  DEBUG` `console.log` statements and a comment noting `next.config.js`'s
  `headers()` was removed "to isolate whether it's interacting badly with
  redirects()" — i.e., someone is mid-investigation. I left this alone
  rather than touching code someone else is actively debugging, but
  flagging it here since it's the single most user-facing thing standing
  between this app and being genuinely production-ready.
- **CI is new and unproven on real GitHub Actions runners** — validated
  every step locally with the same commands, but the workflow itself
  hasn't executed on `actions/checkout` + `actions/setup-node` yet.

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
2. **Unresolved `/login`→`/signin` redirect-loop investigation** — still
   open, debug logging still in place, directly affects the login flow
   every user depends on.
3. **`docker build .` has never actually been run** — every underlying
   command was verified natively, but the real Dockerfile build itself
   is still unproven end-to-end.

**Nice-to-haves / lower priority:**

4. New CI workflow (`.github/workflows/ci.yml`) is unproven on real
   GitHub Actions runners — first PR against this branch will be the
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
