# Deploying to Railway

This branch (`deployment-pack`) makes the app safe to run in a real,
publicly reachable environment. Nothing here changes local dev — `npm run
dev` still works exactly as before.

## What this branch adds

- **`instrumentation.ts` + `lib/env-check.ts`** — refuses to boot when
  `NODE_ENV=production` if `AUTH_SECRET` is still the local dev placeholder,
  or `DATABASE_URL` still points at `localhost`. Fails loudly at startup
  instead of silently running with an insecure session secret.
- **`next.config.js`** — adds a Content-Security-Policy and standard
  security headers (`X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`, HSTS) to every response.
- **`prisma/seed.ts`** — refuses to run when `NODE_ENV=production` unless
  `ALLOW_PROD_SEED=true` is explicitly set. The seed script wipes every
  existing school and creates ~400 accounts sharing the password `12345`
  — exactly the two things that must never happen to a live database.
- **`package.json`** — `postinstall: prisma generate` (so the Prisma
  client regenerates for Railway's Linux build, not just your local
  Windows one), a `db:migrate:deploy` script (`prisma migrate deploy` —
  the production-safe migration command; never use `db:migrate`/`prisma
  migrate dev` outside local dev), and `embedded-postgres` moved to
  devDependencies (it's a local-only tool, started by `npm run db:local`;
  Railway never needs it in the production install).
- **Dependency bump** (`npm audit fix`) — resolved a **critical** Next.js
  unauthenticated-RCE advisory plus several high-severity ones, without
  any breaking version changes. Three lower-severity issues remain that
  would need a breaking major-version bump (Next.js 15→16, or a downgrade
  of `exceljs`) — deliberately not forced here; worth a dedicated upgrade
  pass later, not bundled into a deploy-prep branch.
- **`railway.json`** — tells Railway to run migrations before every start
  (`prisma migrate deploy && npm run start`) and sets a health check.
- **`.env.example`** — brought up to date (was still describing a Docker
  Postgres setup and on-hold Razorpay/WhatsApp keys from the original
  design phase).

## Setting up the Railway project

1. **Add a Postgres plugin** to your Railway project (if not already
   there). Set the app service's `DATABASE_URL` variable to reference it.
2. **Generate a real `AUTH_SECRET`**: run `openssl rand -base64 32`
   locally and set the result as a Railway variable. Never reuse the
   local dev value (`dev-placeholder-secret-change-me-...` in `.env`).
3. **Add a persistent Volume** mounted at `/app/DATA` (or wherever your
   Railway build places the app root — check the build logs if unsure).
   Uploaded files (photos, documents, certificates, ID cards, website
   assets) live under `DATA/uploads/` relative to the app's working
   directory; without a volume there, every redeploy wipes them.
4. **Deploy.** Railway will run `npm install` (triggers `prisma
   generate` via postinstall), `npm run build`, then the `startCommand`
   from `railway.json` (`prisma migrate deploy && npm run start`) — so
   your schema is always current before the app accepts traffic.
5. **Seed data (optional, first deploy only)**: if you want the same
   comprehensive demo school this repo ships with for local dev, run
   `ALLOW_PROD_SEED=true npm run db:seed` via Railway's one-off command
   runner — **do this once, on a fresh database, before pointing real
   users at it.** It wipes any existing schools and creates demo accounts
   with the password `12345`; never run it again once real data exists.

## What's still on you

- Rotate `AUTH_SECRET` if it's ever exposed (e.g. committed by mistake).
- The remaining `npm audit` items (Next.js 15→16, `exceljs` v3) are a
  deliberate, separate upgrade decision — see `README.md`/`ARCHITECTURE.md`
  for how this project sequences larger changes.
- Object storage (S3/R2) is still explicitly out of scope for V1 per
  `ARCHITECTURE.md` — the Volume approach above is what makes local-disk
  storage work on Railway. If you ever move to a platform without a
  persistent-volume option (e.g. Vercel), that decision needs revisiting.
