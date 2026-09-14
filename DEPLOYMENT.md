# Deploying to Railway

This makes the app safe to run in a real, publicly reachable environment,
and buildable via a real Dockerfile matching what the Railway project's
`Vidyayati` service already expects. Nothing here changes local dev —
`npm run dev` still works exactly as before.

## What's here

- **`Dockerfile` + `.dockerignore`** — multi-stage build (`deps` → `builder`
  → `runner`). Deliberately does **not** use Next.js's "standalone" output
  mode: that mode prunes `node_modules` down to only what's traced from
  `import`/`require` statements, which drops the `prisma` CLI package
  (invoked via `npx prisma ...`, never imported, so Next's tracer never
  sees it) — and would silently break `scripts/migrate.sh` in production.
  The full `node_modules` is carried into the final image instead; costs
  size, not correctness.
- **`scripts/migrate.sh`** — runs `prisma migrate deploy` (the
  production-safe migration command — never `prisma migrate dev`, which
  can prompt interactively or reset data). Matches the Railway service's
  own `preDeployCommand: bash scripts/migrate.sh`, which runs this as a
  one-off container from the same built image before a new deployment is
  promoted to take traffic.
- **`railway.json`** — declares `builder: DOCKERFILE`, the pre-deploy
  migration command, and a health check, so the repo's own config matches
  what's set on the live service rather than drifting from it.
- **`instrumentation.ts` + `lib/env-check.ts`** — refuses to boot when
  `NODE_ENV=production` if `AUTH_SECRET` is still the local dev
  placeholder, or `DATABASE_URL` still points at `localhost`.
- **`next.config.js`** — Content-Security-Policy and standard security
  headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, HSTS) on every response.
- **`prisma/seed.ts`** — refuses to run when `NODE_ENV=production` unless
  `ALLOW_PROD_SEED=true` is explicitly set (it wipes every existing
  school and creates ~400 accounts sharing the password `12345`).
- **`package.json`** — `postinstall: prisma generate`; `prisma` and `tsx`
  are real (not dev) dependencies since `scripts/migrate.sh` and the
  optional seed command both need them at runtime; `embedded-postgres`
  stays dev-only (`npm run db:local`, never needed in the image).
- **Dependency bump** (`npm audit fix`) — resolved a **critical** Next.js
  unauthenticated-RCE advisory plus several high-severity ones, no
  breaking changes. Three lower-severity issues remain that need a
  breaking bump (Next.js 15→16, or downgrading `exceljs`) — deliberately
  not forced here, a separate upgrade decision.

## The actual Railway project (as found)

The `vidya-yati` project already had two services — `Vidyayati` (the app)
and `postgres` — but neither was in a working state:

- `Vidyayati` was building from a `Dockerfile` that didn't exist
  anywhere in the repo (hence its last deployment showing `FAILED`), and
  reading env vars (`ADMIN_DATABASE_URL`, `SESSION_SECRET`, ...) that
  don't match anything the code actually reads (`DATABASE_URL`,
  `AUTH_SECRET`) — leftover naming from an earlier planning stage.
  Tracked `main`, not a test branch. No volume, so uploads would have
  been wiped on every redeploy anyway.
- `postgres` was a raw `postgres:16` image with **no volume** and had
  **never been deployed** — `latestDeployment: null`.

Fixed (staged, not yet deployed — see below):
- `postgres`: added a volume at `/var/lib/postgresql/data`, and set
  `PGDATA=/var/lib/postgresql/data/pgdata` — a subdirectory *within* the
  mount, not the mount root itself, per Postgres's own Docker image
  guidance (some volume/filesystem types leave a `lost+found` entry at
  the mount root, which trips Postgres's "data directory must be empty"
  check on first init).
- `Vidyayati`: switched source to the `test-version` branch; added a
  volume at `/app/DATA` (matches `lib/storage.ts`'s `UPLOAD_ROOT`, since
  the Dockerfile's `WORKDIR` is `/app`); set `DATABASE_URL` (a Railway
  reference to the `postgres` service's own credentials — the value is
  never read or exposed, just wired via `${{postgres.VAR}}` syntax),
  `AUTH_SECRET` (freshly generated, real), and `NODE_ENV=production`.
- Left the old mismatched variable names (`ADMIN_DATABASE_URL`, `SEED`,
  `SESSION_SECRET`, `VIDYA_APP_DATABASE_URL`) in place rather than
  deleting them — unused by the code, harmless, and deleting Railway
  config isn't something to do without being asked.

## Seed data (optional, first deploy only)

If you want the same comprehensive demo school this repo ships with for
local dev, run `ALLOW_PROD_SEED=true npm run db:seed` via Railway's
one-off command runner — **do this once, on a fresh database, before
pointing real users at it.** It wipes any existing schools and creates
demo accounts with the password `12345`; never run it again once real
data exists.

## What's still on you

- Rotate `AUTH_SECRET` if it's ever exposed (e.g. committed by mistake).
- The remaining `npm audit` items (Next.js 15→16, `exceljs` v3) are a
  deliberate, separate upgrade decision — see `README.md`/`ARCHITECTURE.md`
  for how this project sequences larger changes.
- Object storage (S3/R2) is still explicitly out of scope for V1 per
  `ARCHITECTURE.md` — the Volume approach above is what makes local-disk
  storage work on Railway. If you ever move to a platform without a
  persistent-volume option (e.g. Vercel), that decision needs revisiting.
