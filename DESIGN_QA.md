# Design QA — audit of `app/app/*` and `app/super-admin/*`

Audited against `design-reference/sections/*.section.html` + `.style.css`
(the approved clickable-prototype fragments) and the live design tokens in
`app/globals.css` / `tailwind.config.ts`. The marketing site (`app/page.tsx`
and friends) is intentionally dark/high-tech and was **not** judged against
the light app-shell tokens.

**Overall finding: the implementation is in very good shape.** Every status
pill / semantic color mapping I sampled across the school portal and the
Super Admin portal (Fees, Attendance, Homework, Exams, Admissions,
Employees, Library, Transport, Hostel, Reports, Communication, Schools,
Subscriptions, Accounts, Dashboard) uses the correct token
(`--good`/`--warn`/`--critical`/`--info`) for its semantic meaning, with no
hardcoded hex standing in for a token and no leftover `--bad` naming from
the older reference fragments. No stray Tailwind default-palette classes
(`bg-red-500` etc.) exist anywhere in `app/app` or `app/super-admin`. I
found three small, isolated issues and fixed them directly (see bottom);
everything else below is either a real gap worth a Developer pass, or
context worth knowing rather than a defect.

## Cross-cutting (spans modules)

- [P1] **No route-level loading states anywhere except one page** — Only
  `app/super-admin/dashboard/loading.tsx` exists. Every other
  `app/app/*/page.tsx` and `app/super-admin/*/page.tsx` awaits its Prisma
  queries directly with no `loading.tsx` sibling, so a slow query renders a
  blank white flash instead of the `.skeleton-block` shimmer pattern
  `globals.css` already defines for exactly this purpose (see
  `dash-grid-5`/`skeleton-block` comments there). This is a real,
  systematic gap, not a one-file fix — flagging for the Developer rather
  than mass-adding ~20 files myself.
- [P1] **No `error.tsx` boundary anywhere** — `find app/app app/super-admin
  -name error.tsx` returns nothing. An unhandled throw in any module
  (a bad Prisma lookup, a `findUniqueOrThrow` miss) currently falls through
  to Next's generic unstyled crash overlay instead of a light, on-brand
  error state. Same reasoning as above — worth a shared `error.tsx`
  pattern from the Developer, not a per-file patch from me.
- Context, not a defect: `institute` (Academic Management), `inventory`,
  `hostel` (as its own module), `teaching`, and `change-password` have no
  matching `design-reference/sections/*.section.html` fragment — they were
  added after the original 20-screen design phase, so there's no approved
  prototype to diff against. I gave these extra scrutiny by hand for token
  consistency instead; see Inventory/Hostel notes below.

## Teaching

- [P1] **Reads as an explicit stub** — `app/app/teaching/page.tsx` renders
  only `"This module hasn't been set up yet."` inside a `.card`. This is a
  literal violation of CLAUDE.md's "nothing should read as a stub" rule.
  `ARCHITECTURE.md` confirms this is a known, intentional placeholder
  ("nav entry + placeholder page only — no functionality yet"), so it's a
  Developer-scope gap to close, not something to patch cosmetically.

## Reports

- [P2] **Thinner than the approved spec** — `Reports.section.html` shows a
  top row of four stat tiles ("Reports generated this month", "Scheduled
  reports", "Most requested", "Avg. generation time"), a featured
  "Attendance trend — Term 2" bar chart above the report catalogue, and a
  "+ Schedule report" action next to the page header. `app/app/reports/page.tsx`
  has none of these — it goes straight to the 6-card report catalogue (plus
  the custom report builder, which is itself new relative to the
  prototype). The report cards themselves are well built with real,
  correctly-colored live stats, so this isn't a token/color issue — it's a
  content gap. Given report scheduling doesn't appear to exist as a backend
  feature yet, this needs a Developer decision (build the scheduling
  feature + chart, or treat the simplification as accepted and drop it from
  spec) rather than a design-only fix.

## Inventory (no design-reference fragment)

- [P2, fixed] Purchase Order status pill (`PurchaseOrderRow` in
  `InventoryForms.tsx`) rendered as an outlined/transparent pill (`border:
  1px solid <color>`, transparent background) instead of the filled
  tint-background style every other status pill in the app uses (`.pill`
  with a `*-tint` background + matching foreground). Also used `--critical`
  directly as a border/text color for `CANCELLED` without a corresponding
  tint background, and used bare `--faint` for `DRAFT` instead of the
  `--line`/`--faint` pairing used for "neutral/no status" everywhere else
  (e.g. `FeesView`'s `NONE`, Super Admin's `CANCELLED`). Fixed directly:
  replaced the single-color map with a `{bg, fg}` map matching the
  filled-pill convention (`DRAFT` → `--line`/`--faint`, `ORDERED` →
  `--info-tint`/`--info`, `RECEIVED` → `--good-tint`/`--good`, `CANCELLED`
  → `--critical-tint`/`--critical`).

## Hostel

- [P2, fixed] `MaintenancePanel.tsx`'s `STATUS_STYLE.IN_PROGRESS` used
  `var(--info-tint, var(--marigold-tint))` / `var(--info,
  var(--marigold-deep))` — a CSS fallback that never actually triggers
  since `--info` and `--info-tint` are both defined in `globals.css`. Read
  as defensive code from a point where the author wasn't sure the token
  existed; harmless visually but confusing to a future reader. Fixed
  directly: simplified to the plain token references.

## Attendance

- [P2, fixed] `AttendanceRoster.tsx`'s `MARKS` array declared a `className`
  field (`att-p` / `att-a` / `att-h`) that is never applied to any element
  and has no matching CSS anywhere in the codebase — the actual pill colors
  come from a separate `statusColor()` helper. Dead code, no visual impact.
  Fixed directly: removed the unused field.

## Everything else I spot-checked and found solid

Dashboard, Students, Fees (the `OVERDUE` pill's white background is
intentional and matches the fragment exactly — not a bug), Homework
(status-cycle pill correctly uses `--critical` instead of the fragment's
old `--bad` naming, per CLAUDE.md's explicit override), Exams,
Communication (empty state, live view-count bars, and audience pills all
match the fragment's design and colors, just with real data instead of
"Illustrative data"), Admissions (the Kanban intentionally drops the
fragment's ad-hoc "Positive/Tentative" interview-outcome pills and
"Admitted" column in favor of the real `approvalStatus` enum and a
documented architectural choice to convert admitted enquiries straight to
Student records — a reasonable adaptation, not a regression), Transport
(restructured into tabs per `ARCHITECTURE.md`, a deliberate expansion
beyond the original single-page prototype), Super Admin Schools/
Subscriptions/Accounts/Dashboard (status pill maps are identical to the
fragment's `--good`/`--info`/`--warn`/`--critical` scheme everywhere, plus
correctly modeling a `CANCELLED` state the prototype didn't have),
Settings, Employees, Library, Certificates, Events — all use `.card`/
`.pill`/`.field` conventions correctly, have real empty-state copy, and
show no hardcoded colors standing in for tokens.

## Fixes applied this pass

1. `app/app/inventory/InventoryForms.tsx` — Purchase Order status pill
   switched from an outlined single-color style to the standard filled
   tint/foreground pattern.
2. `app/app/hostel/MaintenancePanel.tsx` — removed redundant/dead CSS
   `var()` fallback for the `IN_PROGRESS` status color.
3. `app/app/attendance/AttendanceRoster.tsx` — removed an unused
   `className` field from the `MARKS` array.

All three are single-component, visually-inert-or-improving changes with
no shared-component or layout impact.
