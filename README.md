# Vidya Yati

Multi-tenant school/kindergarten management SaaS. See **`CLAUDE.md`** for the
product/design brief and **`ARCHITECTURE.md`** for how the codebase is
actually put together (routing, auth, multi-tenancy, permissions, data
model) — this file is just setup steps.

## First-time setup

```bash
npm install

cp .env.example .env
# edit .env: AUTH_SECRET (generate with `openssl rand -base64 32`)
# DATABASE_URL is already set to match the local Postgres started below

npm run db:local          # starts a local Postgres via embedded-postgres —
                           # leave this running in its own terminal, no
                           # Docker or system install needed

npx prisma validate       # confirm the schema is well-formed
npx prisma migrate deploy # applies every migration
npm run db:seed           # optional — realistic demo data for one school

npm run dev               # http://localhost:3000
```

Default logins after seeding (see `prisma/seed.ts`): Super Admin is
`vidyayati` / `12345`; every seeded School Admin/Staff/Parent account is
also `12345`. **This default password is a known, tracked gap** — see
`ARCHITECTURE.md` → "Auth and session."

## What's here

This is a working, actively-developed application, not a scaffold — auth,
multi-tenancy, and every module in `CLAUDE.md`'s module list have at least
a full first pass built and running. Specifically:

- `prisma/schema.prisma` — the full data model (99 models, 60 enums),
  under active migration. `npx prisma migrate status` should always report
  "up to date" against a freshly-seeded local database.
- `app/app/*` — the school portal (Dashboard, Admissions, Academic
  Management, Students, Employees, Attendance, Exams, Homework, Timetable,
  Fees, Accounts, Transport, Hostel, Library, Inventory, Events,
  Certificates, Communication, Reports, Settings).
- `app/super-admin/*` — the platform portal Vidya Yati's own team uses
  (Schools, Subscriptions & Billing, Reports, Settings).
- `app/globals.css`, `tailwind.config.ts` — the approved design tokens
  (colors, fonts).
- `design-reference/sections/` — the original clickable-prototype
  fragments the client reviewed during design. Still useful as an
  interaction reference for a screen's original intent, though several
  modules have since been rebuilt with additional functionality beyond
  what's shown there.
- `design-reference/data-model.html` — the plain-language version of the
  *original* 41-model data dictionary from the design phase. The schema
  has grown substantially since; treat this file as historical context,
  not a current reference (see `ARCHITECTURE.md` → "Data model").

## Active development

An "Architecture V1" hardening pass is in progress on the `architecture-v1`
branch — see that branch's roadmap doc for the full schedule (multi-tenancy
audit, Enrollment/Grade modeling, testing, CI/CD, documentation). It does
not add online payments or WhatsApp/SMS/email — both stay explicitly
out of scope per `CLAUDE.md`.
