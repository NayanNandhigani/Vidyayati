# Architecture — Vidya Yati

This documents how the codebase is actually put together — the routing structure, the auth/session model, and the multi-tenancy enforcement mechanism. It is the **one official architecture document** for this project; `CLAUDE.md` at the project root is the product/design brief (what to build, in what order, on what visual system). When the two overlap, `CLAUDE.md` wins on product decisions and this file should be updated to match whatever gets built. This file was last reconciled against the actual code on 2026-09-14, after Architecture V1 Milestones 1–9 plus the Phase 22 (transactions) cross-cutting pass — see "Architecture V1 status" below for exactly what that covers and what's still open.

## Stack

Next.js 15 (App Router) + React 19 + TypeScript, one codebase for the marketing site and the app. PostgreSQL via Prisma 6 (`prisma/schema.prisma` — 105 models, 61 enums; see "Data model" below). Tailwind 3 for styling, with design tokens as both Tailwind theme colors and CSS custom properties in `app/globals.css`. Auth is NextAuth v5 (Auth.js) with a Credentials provider (username + bcrypt password hash — not email; see "Auth and session") — no OAuth or OTP provider wired up yet. Zod is available for input validation but not yet used consistently across every server action (see Architecture V1 roadmap, Phase 23).

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

Default accounts (see `prisma/seed.ts`): Super Admin username is `vidyayati`, seeded with a real password (not the pattern below — seed data only). Every account a Super Admin/School Admin creates now goes through `lib/account-setup.ts`'s `createPendingAccount()`: no default password is ever set. Instead, a one-time setup token is generated, only its SHA-256 hash is persisted (`User.setupTokenHash`, unique-indexed, with an expiry), and the raw token is shown exactly once via `SetupLinkBanner.tsx` on the new account's detail page (`?setupToken=...` — a one-shot redirect param, never re-derivable after the page is left). The recipient visits `/setup-account` to set their own password before they can log in (`mustChangePassword` gates this). This replaced the old `bcrypt.hash("12345", 10)` pattern in Architecture V1 Milestone 1.

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

Client-supplied IDs (a `classId`, `studentId`, `examId`, etc. arriving in a form or query param) are still only as safe as the query that uses them — `getScopedDb()` guarantees the *row itself* is scoped to the right school, but it does not validate *other* foreign-key ids referenced in that row's data (e.g. a `classId` passed into a create). Architecture V1 Milestones 5 and 9 did a systematic sweep for this across the app (~30 call sites fixed: institute, timetable, homework, exams, attendance, admissions, students, transport, inventory, hostel, library, events, fees, settings, employees) — the pattern is: before any create/upsert that takes a client-supplied relation id, look it up first through the same scoped client (`sdb.<model>.findUniqueOrThrow({ where: { id } })`), which 404s on a cross-tenant id before the write happens. New call sites should follow the same pattern; it isn't automatic the way `schoolId` scoping is.

## Permissions within a school

Staff access is per-module, not a fixed role — enforced by `lib/permissions.ts`. `requireModuleAccess(moduleName, minimum)` checks the current session: School Admins get `EDIT` on everything implicitly; Staff get whatever `AccessLevel` their `StaffPermission` row for that module says. **The access ladder is two-tier above NONE: `NONE < VIEW < EDIT`** — there is no fourth "FULL" tier in the current schema (Architecture V1 considered adding one and deliberately did not, since `EDIT` already means full read/write on a module; delegated sub-admin permissions would be a distinct, separate feature if ever needed).

A `StaffPermission` row with `classId = null` is school-wide for that module; a row with a real `classId` restricts it to one class, and the school-wide row always wins if both exist. This is what a module's `page.tsx`/`actions.ts` calls before doing anything — the `module` field in `sidebar-config.ts`'s `NavItem`s only controls nav *visibility*, not enforcement. Attendance is the clearest real example of class-scoped permissions in practice: assigning a Staff member as a class's teacher (or co-teacher) auto-grants them a class-scoped Attendance row, and a Staff member with no class assignment sees nothing in Attendance — by design.

The Super Admin portal mirrors this exactly for Vidya Yati's own team: `PlatformStaffPermission` (same `AccessLevel` ladder) gates `PLATFORM_STAFF` sessions per platform module; `SUPER_ADMIN` sessions get implicit full access the same way `SCHOOL_ADMIN` does within a school.

## Data model

`prisma/schema.prisma` — 105 models and 61 enums, grouped by domain (platform & billing, sales/contracts/records, platform accounting, people & access, academics, finance, admissions, transport, hostel, library, inventory, engagement, website & settings). For a full field-level reference organized by domain with relationship diagrams, see the generated Domain Model artifact (ask for it to be regenerated if it's gone stale — it's not checked into the repo). `design-reference/data-model.html` documents only the *original* 41-model dictionary from the design phase and should be treated as historical, not current.

Two schema conventions worth knowing: every non-platform model denormalizes `schoolId` directly onto itself (even where it's only transitively related to `School`) specifically so `tenant-db.ts` can scope centrally; and `AccountsTransaction` is intentionally simple cash-in/cash-out rather than double-entry — `FeePayment`, `PayrollRun`, `PurchaseOrder` (on receipt), `InventorySale`, and `LibraryCirculation` (fines) all write a matching `AccountsTransaction` row automatically (`source: AUTO_FEES` / `AUTO_PAYROLL` / `AUTO_INVENTORY_PURCHASE` / `AUTO_INVENTORY_SALE` / `AUTO_LIBRARY_FINE`) so the ledger self-maintains.

Fee allocation is per-**grade**, not per-class-section: `ClassFeeDefault` keys on `(yearId, grade)` — the free-text grade label, not the `AcademicGrade` entity below — and is read live wherever a student's "actual fee" is needed, never copied onto the student. A student's own `chargedFee` lives on `Student`; scholarship is always `actualFee − chargedFee`, computed at read time, never stored.

Architecture V1's additive schema layer, built alongside (not replacing) the models above: `Term` under `AcademicYear` (Milestone 2); `AcademicGrade` grouping `Class` rows by `(yearId, name)` — deliberately named `AcademicGrade`, not `Grade`, to avoid colliding with the pre-existing, unrelated `GradeScale`/`GradeBand` exam-grading models — with `Class.academicGradeId` as a nullable, backfilled parallel link (`Class.grade`, the free-text label, is still what everything reads) (Milestone 3); `Enrollment` (`studentId` + `academicYearId` + `classId` + `status` + roll number) recording a student's placement per year, created/updated by `lib/domain/enrollment.ts`'s `enrollStudent()`/`promoteStudent()` alongside every place `Student.classId` itself gets written — `Student.classId` is still the source of truth read everywhere else in the app; `Enrollment` is a parallel history that hasn't had its consumers migrated over yet (Milestone 4); `AssessmentComponent` and `ExamSchedule`, additive metadata for a weighted marks breakdown and per-subject scheduling that no UI reads yet; and `StudentResult` (total/percentage/grade/rank per student per exam), computed by `lib/domain/exam-results.ts`'s `calculateExamResults()` and kept in sync with the Report Card panel's own identical inline computation every time marks are saved (Milestone 7).

`School` also carries a unique `code`, an optional `relationshipManager` (free-text — Vidya Yati team members who aren't `PlatformStaffProfile` rows aren't modeled as their own entity), and a large block of per-school configuration (fee/attendance/payroll compliance rates, module toggles via `disabledModules`, seat caps). `SchoolFeatureFlag` is a second, more granular axis on top of `disabledModules` — where `disabledModules` turns an entire module off, `SchoolFeatureFlag` turns individual depth sub-features within an enabled module on/off (see `lib/feature-flags.ts` for the registry).

## What's stubbed or deferred

Per `CLAUDE.md`: no payment gateway (fee/invoice/payment rows exist, entered manually, no checkout flow), no WhatsApp/SMS/Email/push notifications (Communication is in-app only), no biometric/RFID attendance (manual entry by Staff only), and phone-OTP login for parents is not implemented — the Credentials provider covers all five roles the same way, by username + password. Object storage (S3/Cloudflare R2) was explicitly declined for V1 — local disk stays the storage backend until there's an actual deployment target with no persistent filesystem.

## Architecture V1 status

A 30-phase hardening roadmap, reordered into 11 dependency-ordered milestones. As of 2026-09-14:

**Done, verified, on `architecture-v1`:**
- **Milestones 1–9** — first-time password setup (replacing default `12345`s); `Term`; `AcademicGrade`; `Enrollment` (see "Data model" above for all four); People/Subjects/Admissions hardening (admission-to-enrollment wired for every admission path, DB-level subject uniqueness); Attendance gained its own `classId` so a later promotion can't rewrite which class old attendance appears to belong to; Exam Architecture (`AssessmentComponent`/`ExamSchedule`/`StudentResult`, marks-range validation); Finance hardening (payroll/inventory-sale/subscription-payment writes made atomic, excess-payment guards on Fees and Subscription billing); Operations validation.
- **Cross-tenant FK-injection sweep** (spans Milestones 5 and 9, ~30 call sites): the "client-supplied IDs" gap described under "Multi-tenancy enforcement" above, fixed everywhere it was found.
- **Phase 22 (transactions)**: student creation + enrollment, admission conversion, and exam + its subject list now commit atomically — a failure partway through rolls back the whole operation instead of leaving an orphaned row.
- **Phase 19 (audit)**: `Exam`, `FeeDiscount`, and `FeeAdjustment` added to `AUDITED_MODELS`.
- **Phase 18 (Certificates) and Phase 24 (DB constraints)**: reviewed, already sound — no changes needed.

**Explicitly deferred, not started (a deliberate decision, not an oversight):**
- **Milestone 10 — Messaging** (`Conversation`/`ConversationParticipant`/`Message`/`MessageAttachment`/`MessageRead`/`Notification`, replacing `Announcement`'s one-way broadcast). Unlike every other milestone, this has zero existing UI to extend — a real thread/compose/notification surface would be new screens, not additive backend work, so it was held back for a dedicated design pass rather than built without one.
- **Phase 23 (Zod validation)** — every server action currently validates `FormData` by hand (`typeof`/`.trim()` checks); Zod is installed and used in exactly one place (`lib/validation.ts`, password rules). Standardizing it means rewriting validation across ~50+ action files for consistency, not to fix a bug — real regression risk for a style change.
- **Phase 25 (soft delete)** — `deletedAt` on Students/Staff/Exams/Certificates/financial records, with every existing query updated to filter it. The highest-risk item on the list: a single missed query silently resurfaces "deleted" rows everywhere from lists to reports.
- **Phase 26 (error handling standardization)** — actions currently mix `throw new Error(...)` and `{ error: string }` returns; picking one consistent shape (and auditing that no thrown error leaks a raw Prisma message) is a wide mechanical sweep across the same files as Phase 23.
- **Phases 27–29 (Testing, CI/CD, Observability)** — no automated test suite, no CI pipeline, no structured logging/error monitoring exist yet.
- **Phase 30 (Documentation)** — this file and `README.md` are current; the roadmap's own ask (`docs/architecture/overview.md` + per-topic files, ADRs) hasn't been built out as separate files.

## Build order (as of this writing)

The original `CLAUDE.md` suggested order (auth/multi-tenancy → core entities → highest-traffic screens → the rest) has been substantially completed — every module in the route list above has at least a full first pass, and most have had one or more "depth" passes adding richer functionality behind feature flags. Current active work follows the separately-tracked Architecture V1 roadmap (see "Architecture V1 status" above) rather than the original build-order list, which is now historical.
