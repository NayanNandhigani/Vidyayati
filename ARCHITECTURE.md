# Architecture — Vidya Yati

This documents how the codebase is actually put together — the routing structure, the auth/session model, and the multi-tenancy enforcement mechanism. It is the **one official architecture document** for this project; `CLAUDE.md` at the project root is the product/design brief (what to build, in what order, on what visual system). When the two overlap, `CLAUDE.md` wins on product decisions and this file should be updated to match whatever gets built. This file was last reconciled against the actual code on 2026-09-13 (Architecture V1, Milestone 1).

## Stack

Next.js 15 (App Router) + React 19 + TypeScript, one codebase for the marketing site and the app. PostgreSQL via Prisma 6 (`prisma/schema.prisma` — 99 models, 60 enums; see "Data model" below). Tailwind 3 for styling, with design tokens as both Tailwind theme colors and CSS custom properties in `app/globals.css`. Auth is NextAuth v5 (Auth.js) with a Credentials provider (username + bcrypt password hash — not email; see "Auth and session") — no OAuth or OTP provider wired up yet. Zod is available for input validation but not yet used consistently across every server action (see Architecture V1 roadmap, Phase 23).

Files are stored on local disk under `DATA/uploads` via `lib/storage.ts` (`saveUploadedFile`/`readUploadedFile`/`deleteUploadedFile`), served back through authenticated API routes rather than Next's `public/` folder. This is deliberately local-disk-only for now — a prior pass added a Netlify Blobs branch for deployments with no persistent filesystem, but it was removed; if the app is ever deployed somewhere without persistent disk, that decision needs revisiting (see "What's stubbed or deferred").

For local development, Postgres runs on the machine itself via `embedded-postgres` rather than a hosted database or Docker — see "Local development database" below.

## Route structure and portal split

Three top-level route groups under `app/`:

- `app/login` — shared login page for every role (School Admin, Staff, Parent, Super Admin all authenticate through the same Credentials form; the role that comes back on the session decides where they land).
- `app/app/*` — the school portal. Every module folder follows the same shape: a server-rendered `page.tsx`, an `actions.ts` (and often a `depth-actions.ts` for feature-flagged additions) for its server actions, and one or more client components for interactive pieces. Current module routes (see `components/sidebar-config.ts` for the definitive, always-current list):
  `dashboard`, `admissions`, `institute` (labeled "Academic Management" in the UI — Classes & Sections, Subjects, and Fee Structure as three tabs), `students`, `employees`, `attendance`, `exams`, `homework`, `timetable`, `teaching` (nav entry + placeholder page only — no functionality yet), `fees`, `accounts`, `transport` (Vehicles/Routes/Student Assignments/Attendance tabs, with vehicles as their own Students-style list + detail page under `transport/vehicles/[id]`), `hostel` (its own top-level module, not a Transport tab — Room Details/Student Allocation/Visitor Entry & Permit/Canteen-Mess/Maintenance/Laundry Management tabs), `library`, `inventory` (Assets/Consumables/Stock/Billing/Vendors/Purchase Orders tabs), `events`, `certificates`, `communication`, `reports`, `settings`.
- `app/super-admin/*` — the platform portal: `dashboard`, `schools`, `subscriptions`, `reports`, `settings`. Same page/actions/client-component pattern. `schools` is the fullest-built of these: `page.tsx` renders the directory (left half) and a per-school detail panel (right half) with inline-editable school details, an inline-editable relationship manager, an append-only notes feed, and a module-usage bar chart fed by the activity logging described below.
- `app/api/auth/[...nextauth]` — the NextAuth route handler. Other `app/api/*` routes serve uploaded files back out (`id-card-assets`, `person-documents`, `vehicle-documents`, `website-assets`, `certificate-assets`) with tenant-isolation checks on the path's schoolId segment.

Marketing/public content lives at the app root (`app/page.tsx`, `app/layout.tsx`); it stays visually distinct (dark/high-tech) from the app shell (light, dense), per `CLAUDE.md`.

`components/` holds the shared app shell: `Sidebar.tsx` plus `sidebar-config.ts`, the single source of truth for the nav — each `NavItem` declares its href/icon, which `StaffPermission.moduleName` it's gated behind, and which roles can see it at all (Dashboard has no module gate; Settings and Academic Management are School-Admin-only). Adding a module's nav entry means adding one entry here, not touching the sidebar component. Also here: `Avatar.tsx` and `ProfilePhotoUpload.tsx` (shared profile-picture display/upload, used by Students and Employees, reusing the same photo storage path the ID Card feature already established), `PersonDocumentsPanel.tsx` (shared document-upload UI used by Students/Staff/Vehicles), `SortableHeader.tsx`, `AuditLogTable.tsx`.

## Auth and session

Split across two files because Next.js middleware always runs on the Edge runtime, which can't load bcrypt or the Prisma client:

- `auth.config.ts` — the Edge-safe half: JWT session strategy, `/login` as the sign-in page, the `jwt`/`session` callbacks that carry `role`, `schoolId`, and `username` from the JWT onto `session.user`. No providers.
- `auth.ts` — extends `auth.config.ts` with the actual Credentials provider (looks up `User` by `username`, lowercased and trimmed at both write and lookup time — not email; `email` is optional and unused for login — checks `status === "ACTIVE"`, verifies the bcrypt hash). On a successful login it also stamps `User.lastLoginAt` and writes a `LOGIN` `ActivityLog` row (see "Activity logging"). Imported from route handlers and server components/actions — anything running in the Node runtime.
- `middleware.ts` — imports only `auth.config.ts`. Gates `/app/:path*` and `/super-admin/:path*`, redirects unauthenticated requests to `/login` with a `callbackUrl`, and cross-redirects a logged-in user to the portal matching their role. Also stamps an `x-pathname` request header for the school portal — see "Activity logging".

A session's `user` object carries `role` (`SCHOOL_ADMIN` / `STAFF` / `PARENT` / `SUPER_ADMIN` / `PLATFORM_STAFF`), `schoolId` (`null` for the two platform roles), and `username`.

Default accounts (see `prisma/seed.ts`): Super Admin username is `vidyayati`; every account a Super Admin/School Admin creates defaults to password `12345` with no email required. **This is a known, tracked gap, not an oversight** — Architecture V1 Milestone 1 replaces this with a secure invitation/first-time-password-setup flow; until that lands, do not use this pattern for any real (non-demo) deployment.

## Activity logging

The `ActivityLog` model (`type: LOGIN | PAGE_VIEW`, optional `module`, `occurredAt`) backs the Super Admin's per-school engagement view:

- **Logins**: `auth.ts`'s `authorize()` writes one `LOGIN` row per successful sign-in (fire-and-forget).
- **Page views**: `app/app/layout.tsx` wraps every school-portal request; `middleware.ts` stamps the current pathname onto an `x-pathname` header (skipping Next.js prefetch requests), and the layout resolves it to a human label via `moduleLabelForPath()` in `sidebar-config.ts` — the same table that drives the sidebar, so a module's nav entry and its activity-log label can't drift apart.

`MutationAuditLog` is a separate, distinct concern: who changed what data (not who viewed what page). It's append-only and system-written for an allowlist of models by the scoped Prisma client extension (see "Multi-tenancy enforcement"), never by individual call sites. `changes` is a JSON diff (`{ field: { before, after } }` on UPDATE, `{ deleted: {...} }` on DELETE, omitted on CREATE).

`User.lastLoginAt` is a denormalized convenience alongside `ActivityLog` — what the Schools detail panel checks for "account activated" instead of aggregating the log.

## Local development database

There is no hosted database wired up for local dev. `npm run db:local` (`scripts/local-db.ts`, using the `embedded-postgres` package) initializes and runs a real Postgres server as a plain child process — no Docker, no system install — with its data directory at `DATA/postgres` (gitignored). `DATABASE_URL` in `.env` points at it (`postgresql://postgres:postgres@localhost:5432/vidyayati`); a previous external (Neon) connection string is kept there commented out. Run `npm run db:local` before `npm run dev`; migrations and seeding (`npx prisma migrate deploy`, `npm run db:seed`) work against it exactly as they would against any other Postgres instance.

`embedded-postgres`'s bundled binaries do **not** include `pg_dump`/`pg_restore` — a full backup is a logical export (walk every Prisma model and dump to JSON, or `DATA/postgres`-directory-level filesystem copy while the server is stopped), not a `.sql` dump. See `DATA/backups/` for the Architecture V1 pre-change baseline export.

## Multi-tenancy enforcement

This is the load-bearing piece of the whole app, centralized in `lib/tenant-db.ts` rather than left to each route to get right:

- At module load, it walks the Prisma DMMF and builds `TENANT_SCOPED_MODELS` — every model that has a `schoolId` field — instead of hardcoding a list, so a new model is automatically covered the moment someone adds `schoolId` to it in the schema.
- `scopedDb(schoolId)` returns a Prisma Client extension that intercepts every query against a tenant-scoped model: reads/updates/deletes get `schoolId` merged into `where`, creates get `schoolId` stamped onto `data`, upserts get it in both. Non-tenant-scoped models (platform-level things like `School` itself, `SubscriptionPlan`, `LedgerAccount`/`Vendor`/`Bill` on the platform-accounting side) pass through untouched.
- `getScopedDb()` is the call-site API: it pulls `schoolId` off the current session via `auth()` and returns a client scoped to it. It throws if there's no session or no `schoolId` — deliberate, since a Super Admin session has neither and Super Admin code is expected to import the raw `db` export from `lib/db.ts` and query across schools on purpose.
- `scopedCreateData()` is a small typing helper so call sites can omit `schoolId` from a Prisma create payload without an inline cast at every call site.

The rule this enforces: **every school-portal route reads/writes through `getScopedDb()`, never the raw `db` export.** The raw client is for Super Admin routes and platform-level models only.

Client-supplied IDs (a `classId`, `studentId`, `examId`, etc. arriving in a form or query param) are still only as safe as the query that uses them — `getScopedDb()` guarantees the query is scoped to the right school, but a server action that trusts a relation (e.g. "this studentId belongs to this classId") without checking still needs its own validation. This is tracked explicitly in the Architecture V1 roadmap (Phase 2, items 18-20) as an area to audit systematically, not something already exhaustively covered everywhere.

## Permissions within a school

Staff access is per-module, not a fixed role — enforced by `lib/permissions.ts`. `requireModuleAccess(moduleName, minimum)` checks the current session: School Admins get `EDIT` on everything implicitly; Staff get whatever `AccessLevel` their `StaffPermission` row for that module says. **The access ladder is two-tier above NONE: `NONE < VIEW < EDIT`** — there is no fourth "FULL" tier in the current schema (Architecture V1 considered adding one and deliberately did not, since `EDIT` already means full read/write on a module; delegated sub-admin permissions would be a distinct, separate feature if ever needed).

A `StaffPermission` row with `classId = null` is school-wide for that module; a row with a real `classId` restricts it to one class, and the school-wide row always wins if both exist. This is what a module's `page.tsx`/`actions.ts` calls before doing anything — the `module` field in `sidebar-config.ts`'s `NavItem`s only controls nav *visibility*, not enforcement. Attendance is the clearest real example of class-scoped permissions in practice: assigning a Staff member as a class's teacher (or co-teacher) auto-grants them a class-scoped Attendance row, and a Staff member with no class assignment sees nothing in Attendance — by design.

The Super Admin portal mirrors this exactly for Vidya Yati's own team: `PlatformStaffPermission` (same `AccessLevel` ladder) gates `PLATFORM_STAFF` sessions per platform module; `SUPER_ADMIN` sessions get implicit full access the same way `SCHOOL_ADMIN` does within a school.

## Data model

`prisma/schema.prisma` — 99 models and 60 enums, grouped by domain (platform & billing, sales/contracts/records, platform accounting, people & access, academics, finance, admissions, transport, hostel, library, inventory, engagement, website & settings). For a full field-level reference organized by domain with relationship diagrams, see the generated Domain Model artifact (ask for it to be regenerated if it's gone stale — it's not checked into the repo). `design-reference/data-model.html` documents only the *original* 41-model dictionary from the design phase and should be treated as historical, not current.

Two schema conventions worth knowing: every non-platform model denormalizes `schoolId` directly onto itself (even where it's only transitively related to `School`) specifically so `tenant-db.ts` can scope centrally; and `AccountsTransaction` is intentionally simple cash-in/cash-out rather than double-entry — `FeePayment`, `PayrollRun`, `PurchaseOrder` (on receipt), `InventorySale`, and `LibraryCirculation` (fines) all write a matching `AccountsTransaction` row automatically (`source: AUTO_FEES` / `AUTO_PAYROLL` / `AUTO_INVENTORY_PURCHASE` / `AUTO_INVENTORY_SALE` / `AUTO_LIBRARY_FINE`) so the ledger self-maintains.

Fee allocation is per-**grade**, not per-class-section: `ClassFeeDefault` keys on `(yearId, grade)` and is read live wherever a student's "actual fee" is needed — never copied onto the student. A student's own `chargedFee` lives on `Student`; scholarship is always `actualFee − chargedFee`, computed at read time, never stored. This is a deliberate, recent design decision (2026-09-12) — see Architecture V1 Phase 5 for how a formal `Grade` entity, if added, needs to compose with this rather than replace it.

`School` also carries a unique `code`, an optional `relationshipManager` (free-text — Vidya Yati team members who aren't `PlatformStaffProfile` rows aren't modeled as their own entity), and a large block of per-school configuration (fee/attendance/payroll compliance rates, module toggles via `disabledModules`, seat caps). `SchoolFeatureFlag` is a second, more granular axis on top of `disabledModules` — where `disabledModules` turns an entire module off, `SchoolFeatureFlag` turns individual depth sub-features within an enabled module on/off (see `lib/feature-flags.ts` for the registry).

## What's stubbed or deferred

Per `CLAUDE.md`: no payment gateway (fee/invoice/payment rows exist, entered manually, no checkout flow), no WhatsApp/SMS/Email/push notifications (Communication is in-app only — `Announcement`/`AnnouncementRead`, broadcast-style, not a full messaging system), no biometric/RFID attendance (manual entry by Staff only), and phone-OTP login for parents is not implemented — the Credentials provider covers all five roles the same way, by username + password.

Also currently deferred (Architecture V1 roadmap, not yet scheduled or explicitly declined):
- `Term` (under `AcademicYear`) and `Campus` entities — School Core currently stops at `AcademicYear`.
- A formal `Grade` entity above `Class` and an `Enrollment` model replacing `Student.classId`'s direct FK — the single largest piece of the Architecture V1 roadmap; see the roadmap doc for the additive migration approach agreed for this.
- A proper Conversation/Message/Notification system — Communication is currently one-way broadcast only.
- Object storage (S3/Cloudflare R2) — explicitly declined for now; local disk stays the storage backend until there's an actual deployment target with no persistent filesystem.
- A standing automated test suite and CI pipeline.

## Build order (as of this writing)

The original `CLAUDE.md` suggested order (auth/multi-tenancy → core entities → highest-traffic screens → the rest) has been substantially completed — every module in the route list above has at least a full first pass, and most have had one or more "depth" passes adding richer functionality behind feature flags. Current active work follows the separately-tracked Architecture V1 roadmap (schema hardening, Enrollment redesign, testing/CI, documentation) rather than the original build-order list, which is now historical.
