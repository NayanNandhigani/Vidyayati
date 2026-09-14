# Vidya Yati — project brief for Claude Code

Read this before writing code. It's the accumulated product/design decisions
from the design phase, condensed into what a build needs to know. When
something here conflicts with what you find in the reference material,
treat this file as current and the reference material as the visual/
behavioral source of truth for how a screen should look and act.

## What this is

Vidya Yati is a multi-tenant school & kindergarten management SaaS for the
Indian market. Vidya Yati (the company) sells annual subscriptions to
individual schools ("tenants"). Each school gets its own isolated data and
its own set of users.

Two portals:

- **Super Admin portal** — used by the Vidya Yati team, not by schools.
  Onboards schools, tracks subscription billing/invoicing, sees
  cross-school platform reports, manages platform-wide settings.
- **School Admin / Staff / Parent portal** — used by an individual school.
  One login system, three roles:
  - **Admin** (school-level administrator)
  - **Staff** (teachers and non-teaching staff — permissions are granted
    per module, not by a fixed "Teacher" role; see Staff Permissions below)
  - **Parent**

Earlier prototypes had separate Student and Teacher logins — those were
deliberately removed. Students and Teachers don't get their own accounts;
Staff and Parent cover everyone who needs app access.

## On hold — do not build yet

- **Online payments** (fee collection, subscription billing) — no payment
  gateway integration yet. Fee/invoice/payment records still need to exist
  in the data model (a school admin or Vidya Yati staff records a payment
  manually), just not an online checkout flow.
- **WhatsApp / SMS messaging** — the Communication/Announcements module is
  **in-app only** for this phase. Don't wire up any external messaging
  provider.

Both are explicitly scoped for a later phase — don't let their absence
block anything else.

## Attendance

Marked manually by a teacher inside the app (Staff role, Attendance
module) — no biometric/RFID/external integration.

## Tech stack (already decided)

- **Next.js (App Router) + TypeScript**, one codebase for the marketing
  site and the app itself.
- **PostgreSQL** via **Prisma** — see `prisma/schema.prisma`, already
  written from the data dictionary (41 tables, see below). Run
  `npx prisma validate` and `npx prisma migrate dev` as your first step to
  confirm it applies cleanly in your environment before building on it —
  it hasn't been run against a real database yet.
- **Tailwind CSS**, configured in `tailwind.config.ts` with the design
  tokens as custom colors (`bg-marigold`, `text-critical`, etc.) — the
  same hex values also live as CSS custom properties in
  `app/globals.css` for anything Tailwind's utility classes don't cover.
- **NextAuth (Auth.js)** is in `package.json` as the assumed auth
  solution, but no auth config has been written yet — decide the
  provider/strategy (credentials + email/password is the simplest fit
  for school staff/admin logins; parents may want OTP-based phone login
  given the Indian market) and wire it up as one of the first things you
  build, since almost every route needs a session.

## Multi-tenancy

Every table below the platform level carries a `schoolId`. The rule for
every query in the app: **a session belongs to exactly one school** (or to
no school, for Super Admin), and every query must be scoped to it. The
Super Admin portal is the only place allowed to query across schools.
Enforce this centrally — e.g. a Prisma Client extension or middleware
that injects the current session's `schoolId` into every relevant query —
rather than trusting each route handler to remember it. A tenant-isolation
bug here is the single worst thing this app could ship with.

## Design system

Colors, type, and shared component patterns (`.card`, `.pill`, `.field`,
sidebar nav items, etc.) are already fully specified and carried over
into `app/globals.css` and `tailwind.config.ts` — use them as-is rather
than inventing new ones. Fonts: **Fraunces** (display headings — `.disp`
class or `font-display` in Tailwind), **Plus Jakarta Sans** (body/UI —
default), **IBM Plex Mono** (numbers, IDs, timestamps — `.mono` class or
`font-mono`).

Color tokens and what they mean (all defined in `globals.css`):
`--ink`/`--ink2` (primary text), `--paper` (page background), `--card`
(surface background), `--line` (borders), `--muted`/`--faint` (secondary
text), `--marigold` (primary brand/accent — buttons, active nav),
`--teal`, `--clay` (secondary accents used for variety in charts/tags),
`--good` (success/positive — e.g. "Paid", "Present"), `--warn`
(caution — e.g. "Late", "Expiring"), `--critical` (negative/overdue —
e.g. "Absent", "Overdue"; this is the canonical name — some older
reference fragments call it `--bad`, ignore that, `--critical` is
correct), `--info` (neutral informational).

The **marketing site** (public, pre-login) should be visually distinct
from the app — "high tech" / dark-themed, more visually ambitious. The
**app itself** (post-login, all three roles + Super Admin) stays light,
functional, and information-dense per the tokens above. Don't carry the
dark marketing aesthetic into the app shell.

**Every module should be built to a genuinely high visual/functional
standard** — this was an explicit, repeated instruction during design:
not just the dashboards, every screen. The client was firm that nothing
should read as a stub, placeholder, or "coming later" — every control a
user can reach needs to actually do something.

## Data model

`prisma/schema.prisma` is the working schema, generated from a 41-table
data dictionary. `design-reference/data-model.html` is the plain-language
version of the same thing — open it in a browser for descriptions of what
each table/field is for and how tables connect; useful when a Prisma
model's shape isn't self-explanatory. Domains, for orientation:

- **Platform & billing** (Super Admin only) — `School`,
  `SubscriptionInvoice`, `SubscriptionPayment`
- **People & access** — `User`, `StaffProfile`, `StaffPermission`,
  `Parent`, `StudentParentLink`
- **Academics** — `AcademicYear`, `Class`, `Subject`, `Student`,
  `Attendance`, `StaffAttendance`, `Exam`, `ExamSubject`, `Mark`,
  `Homework`, `HomeworkSubmission`, `TimetableSlot`
- **Finance** (School Admin's own cash flow — separate from what the
  school pays Vidya Yati) — `FeeStructure`, `FeePayment`,
  `AccountsTransaction`, `PayrollRun`
- **Admissions** — `AdmissionEnquiry` (the Kanban: Enquiry → Application
  → Admitted)
- **Operations** — `TransportRoute`, `TransportStop`,
  `StudentTransportAssignment`, `HostelRoom`, `HostelAllocation`,
  `LibraryBook`, `LibraryCirculation`
- **Engagement** — `Event`, `EventChecklistItem`, `CertificateTemplate`,
  `CertificateIssued`, `Announcement`, `AnnouncementRead`
- **Settings** — `WebsiteSettings`, `IdCardTemplate`,
  `ScreenCustomization`

`AccountsTransaction` is deliberately simple cash-in/cash-out, not formal
double-entry accounting — don't over-engineer it. Fee payments and payroll
runs should write a matching `AccountsTransaction` row automatically
(`source: AUTO_FEES` / `AUTO_PAYROLL`) so the school's cash-flow ledger
stays correct without the admin re-entering anything.

## The screens to build — and your ground truth for each

`design-reference/sections/` has one `<Module>.section.html` +
`<Module>.style.css` pair per screen — these are hand-built, framework-free
HTML/CSS/JS fragments from a clickable prototype the client has already
reviewed and approved (including several rounds of "this still isn't
functional enough" feedback that got addressed). **Treat these as the
authoritative interaction spec** — what fields exist, what a click does,
what states a status pill can be in, what the empty/detail/edit states
look like — not just a rough sketch. Re-implement each as a real
Next.js route/component with real data from Postgres via Prisma, rather
than starting the UI from scratch. The prefixed class/id naming inside
each fragment (`stu-`, `emp-`, `att-`, etc.) was a merge-collision
convention for the flat-HTML prototype — you don't need to preserve that
convention in real components, just the layout/behavior it encodes.

Module list (School Admin/Staff/Parent portal): Dashboard, Admissions,
Academic Management, Students, Employees, Attendance, Exams, Homework,
Timetable, Fees, Accounts, Transport, Hostel (its own module, not a
Transport tab), Library, Inventory, Events, Certificates, Communication,
Reports, Settings. (Current, actual list — see `ARCHITECTURE.md` for the
authoritative one going forward; this file is the original design brief
and won't be kept in lockstep with every subsequent module added.)

Module list (Super Admin portal): Dashboard, Schools, Subscriptions &
Billing, Reports, Settings.

Two other artifacts from the design phase (URLs, private to the client's
account — ask them to share access if you need to view them and can't
reach `design-reference/` for some reason):

- Design canvas (static, high-fidelity mockups of all 20 screens, used to
  work out visual design before interaction was built):
  `https://claude.ai/code/artifact/cd0c1fc0-f49e-446d-a6bf-74511f83adba`
- Clickable prototype (what `design-reference/sections/` is extracted
  from — click through it directly if you want to see the actual
  interactions rather than reading code):
  `https://claude.ai/code/artifact/7b6cb61e-69fb-409f-b39c-17d32fd8f3e5`

## Suggested build order

1. Auth (NextAuth) + session-based multi-tenant scoping — get this right
   before building any data screen, it's the foundation everything else
   sits on.
2. Core academic entities: School, User/StaffProfile/Parent, AcademicYear,
   Class, Student — this unlocks almost every other module.
3. Dashboard (School Admin) + Students + Attendance — the highest-traffic
   day-to-day screens.
4. Exams, Homework, Timetable.
5. Fees + Accounts (finance).
6. Admissions, Employees, Communication.
7. Transport/Hostel, Library, Events, Certificates, Reports, Settings —
   the "operations & long tail" modules.
8. Super Admin portal (Schools, Subscriptions & Billing, Reports,
   Settings) — can be built in parallel with step 7 once auth/multi-
   tenancy is solid, since it's a much smaller surface.
9. Marketing site (dark/high-tech, separate from the app shell).

This is a suggestion, not a contract — reorder if you find a good reason
to.
