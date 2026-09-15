# Vidya Yati — Implementation Backlog

Audit of the implemented app (`app/app/*`, `app/super-admin/*`, `prisma/schema.prisma`)
against `CLAUDE.md`'s product intent and `ARCHITECTURE.md`'s own account of what's
built, as of 2026-09-15. This is a backlog, not a changelog — items below are gaps,
bugs, and polish work found during review; things `ARCHITECTURE.md`'s "Architecture V1
status" already documents as done (tenant-scoping extension, setup-token account
creation, cross-tenant FK-injection sweep in the ~30 call sites it names, exam/student
transactions, marks-range validation, etc.) are not repeated here unless a specific
violation of that work was found in a module's own code.

**Totals: 8 P0, 27 P1, 18 P2 (53 findings).**

Scope-creep checks (online payment gateways, WhatsApp/SMS/external messaging) came back
**clean everywhere** — Fees, Accounts, Subscriptions & Billing, and Communication are all
manual-entry / in-app-only as `CLAUDE.md` requires. No payment SDK, checkout flow, or
external messaging provider was found anywhere in the codebase.

**Biggest risks (P0):**
- **Super Admin permission bypass, 3 modules wide open**: `Schools.onboardSchool`,
  the entire Subscriptions & Billing module, and the entire (platform) Accounts module
  have **no permission check at all** — any `PLATFORM_STAFF` session, including one
  explicitly granted `NONE`, can onboard schools, view/bill every school's
  subscription, and view Vidya Yati's internal ledger. This is a bigger version of the
  exact class of bug `CLAUDE.md` calls "the single worst thing this app could ship
  with," just one layer up (platform staff vs. platform staff, not tenant vs. tenant).
- **`IdCardElement` has no `schoolId`** — the one non-platform model in the whole
  105-model schema that fell through the DMMF-driven tenant-scoping walk in
  `lib/tenant-db.ts`, leaving every element-level ID-card mutation a true cross-tenant
  IDOR.
- **Raw `db` import pattern recurring across modules** — `attendance/actions.ts`,
  `homework/actions.ts`, `hostel/attendance-actions.ts` (and reportedly
  `certificates/actions.ts`) bypass `getScopedDb()` for a `staffProfile` lookup keyed
  on the session's own `userId`. Not exploitable today (the key isn't client-supplied),
  but it's the same shape of bug that becomes exploitable the next time one of these
  functions is extended, and it violates the single-path-for-tenant-scoping rule
  `ARCHITECTURE.md` states as load-bearing.

---

## Dashboard (School portal)

No issues found. Every panel (Reminders, Staff availability, Pending approvals, Notes,
charts) uses `getScopedDb()`, has a real empty state, and is backed by real actions —
no dead-end controls.

## Admissions

- [P1] [GAP] Applicant photo field captured nowhere in the UI — `photoPath` is threaded
  through `ApplicationFields`/the enquiry object (`app/app/admissions/depth-actions.ts:17`,
  `app/app/admissions/[id]/page.tsx:47`, `app/app/admissions/[id]/ApplicationDetailForm.tsx:45`)
  but there is no file input, upload control, or preview anywhere in
  `ApplicationDetailForm.tsx` or the printable form. The field exists in the type/model
  but can never be set from the app.

Otherwise solid: pipeline board, enquiry→application→admitted flow, admit-with-fee
approval, class/fee validation, atomic student creation, and good empty states are all
real and working.

## Academic Management ("institute")

- [P1] [GAP] `Term` and `AcademicGrade` models are fully unused — no `sdb.term.*` or
  `sdb.academicGrade.*` call exists anywhere under `app/app` (checked including
  Settings). `AcademicGrade` even has `Class.academicGradeId` already wired as a
  nullable FK (`prisma/schema.prisma:1025-1039`), but the Classes & Sections tab
  (`app/app/institute/InstituteClassesPanel.tsx`) has no create form or display for
  either model — schema modeled ahead of the UI that was supposed to use it.

Otherwise well built: class/subject create/delete validate client-supplied relation ids
via `findUniqueOrThrow`, deletion is correctly blocked with informative messages when a
row is still referenced, and `bulkReshuffleStudents` is safely wrapped in one
`$transaction` (an apparent check-after-write turned out to be transactional, not a bug).

## Students

No P0/P1 issues found. Every tab (Profile/Attendance/Academics/Fees/Transport/Records/
Documents/Admission) has a real empty state, every mutation goes through
`getScopedDb()`/`requireModuleAccess`, fee-cap validation is enforced both client- and
server-side, and bulk import validates all rows before writing any (all-or-nothing).

## Employees

- [P1] [BUG] Stale "default password: 12345" copy on both Add Staff forms —
  `app/app/employees/new/NewStaffForm.tsx:45`, `NewStaffDetailedForm.tsx:69`, and
  `app/app/employees/new/page.tsx:21` tell the admin to share a "12345" default
  password. Actual behavior (both `createStaff` and `createStaffDetailed`) now calls
  `createPendingAccount()`, which sets an unusable random hash and issues a one-time
  setup link instead — "12345" will never work. Leftover copy from before the
  Architecture V1 Milestone 1 fix; actively misleads onboarding admins.
- [P1] [GAP] Most of the "detailed" staff profile is write-only — `NewStaffDetailedForm.tsx`
  collects ~25 fields (Aadhaar/PAN, both mobile numbers, addresses, emergency contact,
  employment type, bank/PF/UAN/ESI details, etc.) onto `StaffProfile`, but
  `StaffDetailTabs.tsx`'s Profile tab only ever surfaces 9 of them. The dedicated edit
  action `updateStaffDetailedProfile` (`detailed-profile-actions.ts:147`) is never
  called from anywhere in the UI — the other ~16 fields are effectively dead once set.
- [P1] [BUG] Cross-tenant FK-injection gap in staff creation — `createStaffDetailed`
  writes `reportingManagerId` (`detailed-profile-actions.ts:83`) straight into the
  create payload with no `findUniqueOrThrow` check first, unlike the equivalent guards
  used consistently elsewhere (e.g. `institute/actions.ts:198-200`). Low practical
  impact since the field is never displayed (see GAP above), but it's a real gap in the
  FK-injection sweep `ARCHITECTURE.md` says covers "employees."

Otherwise solid: list/search/sort, Attendance/Payroll/Leave/Access & Permissions/
Documents tabs, structured payroll and leave/LOP math, and permission cycling all work
against real data with proper validation.

## Attendance

- [P0] [BUG] Raw `db` import bypasses tenant-scoped client —
  `app/app/attendance/actions.ts:6,16` imports `db` from `@/lib/db` directly instead of
  `getScopedDb()`, used for `db.staffProfile.findUnique({ where: { userId: ... } })`.
  Keyed on the session's own `userId`, so not demonstrated as exploitable today, but
  breaks the mandated single-path-for-tenant-scoping pattern.
- [P1] [GAP] `StaffAttendance` is display-only, no way to ever mark it — read in
  `app/app/employees/[id]/page.tsx:30-31` but there is no create/upsert of
  `staffAttendance` anywhere in `app/`. The employee detail panel's staff-attendance
  stats are permanently empty.
- [P2] [POLISH] Misleading empty state when a school has zero classes —
  `app/app/attendance/page.tsx:105-111` renders the roster with `classId` possibly
  `""`, showing "No students in this class" instead of "No classes set up yet" (which
  Timetable gets right at `timetable/page.tsx:140`).

Confirmed: no biometric/RFID integration anywhere, purely manual PRESENT/ABSENT/
HALF_DAY marking as `CLAUDE.md` requires; the "no class assignment" empty state is
good and purpose-built.

## Exams

- [P2] [GAP] `AssessmentComponent`/`ExamSchedule` modeled but completely unread —
  zero references anywhere under `app/` (`prisma/schema.prisma:1473,1493`). No UI
  exists for weighted assessment components (e.g. 70% written + 30% practical) or
  per-subject exam-day scheduling within a multi-day window. `ARCHITECTURE.md` already
  documents this as additive/unused metadata, but it's a real, user-facing gap.

Otherwise the strongest-built module in the app: approval workflow, seating
randomization, validated CSV bulk marks import, PDF hall tickets/report cards, and
fee-lock/result-release gating for parents are all real and properly scoped.

## Homework

- [P0] [BUG] Raw `db` import bypasses tenant-scoped client —
  `app/app/homework/actions.ts:7,34`, same pattern as Attendance above (session's own
  `userId`, not client-supplied — but still the wrong call path).
- [P2] [POLISH] Feature flag name overpromises — `lib/feature-flags.ts:95-97` labels
  `homework.attachmentsAndDigest` as "Attachments & parent digest," but the only
  "digest" behavior is an inline "Overdue homework" card shown when a parent happens to
  open the tab (`homework/page.tsx:153-166`) — no periodic digest exists. Not scope
  creep (nothing external is wired up), just a label that overpromises.

Verified in-app-only: `remindPending` only writes `Announcement` rows, no SMS/WhatsApp.
No dead-end buttons; create/submission-cycling/scoring/attachment-upload for both staff
and parent-on-behalf-of-child are all wired to real actions.

## Timetable

- [P1] [BUG] Room management has no EDIT permission check — `createRoom`/`deleteRoom`
  (`app/app/timetable/depth-actions.ts:20-33`) call only `requireFeature`, never
  `requireModuleAccess("Timetable","EDIT", ...)`, unlike the correctly-gated sibling
  `setTimetableSlotWithRoom` (line 50). `RoomsPanel` is gated only by a feature flag in
  `timetable/page.tsx:89-91`, not by `canEdit` — any Staff session with VIEW-only
  Timetable access can add/delete school-wide rooms. Not cross-tenant (writes still go
  through `scopedCreateData`), but a real access-ladder violation within the school.
- [P2] [POLISH] Dead code — `listRooms()` (`depth-actions.ts:15-18`) is exported but
  never called; the page fetches rooms directly via `sdb.room.findMany` instead.

Confirmed teacher/room double-booking conflict detection is real and functional, not a
stub. No SMS/WhatsApp, no other dead-end buttons.

## Teaching

- [P1] [GAP] Confirmed placeholder-only, exactly as `ARCHITECTURE.md` states —
  `app/app/teaching/page.tsx` is 16 lines: `requireModuleAccess("Teaching","VIEW")`
  then a single static card reading "This module hasn't been set up yet." No
  `actions.ts`, no client components. This is a real, clickable sidebar nav entry
  leading to a dead end — precisely the stub `CLAUDE.md`'s "nothing should read as a
  stub" instruction warns against.
  - Suggested scope (nothing here duplicates Homework/Timetable/Exams, and there's no
    separate teacher login to build around): (1) **lesson planning & syllabus
    tracking** — per-subject curriculum broken into topics/units, a teacher marks
    topics covered per class/date with notes/resources, an Admin-facing "syllabus
    completion %" view per class/subject; needs new models (e.g.
    `SyllabusTopic`/`SyllabusProgress` keyed on `subjectId`+`classId`+`schoolId`) —
    genuinely new work, not just wiring existing data. (2) a personalized "My
    Teaching" dashboard aggregating a staff member's own day (today's periods,
    homework awaiting grading, upcoming exam duties) — something none of the three
    existing modules do since they're organized by class/exam/assignment, not by
    teacher.

## Fees

- [P1] [BUG] Overpayment guard ignores discounts/adjustments/late fine —
  `recordPayment` (`app/app/fees/actions.ts:34-49`) computes outstanding balance from
  raw `FeeStructure.amount` minus prior payments only, never applying
  `FeeDiscount`/`FeeAdjustment`/late-fine, even though the admin-visible "pending"
  figure (`fees/page.tsx:39-58`, `FeesView.tsx:194`) is net of those. A student with an
  active scholarship discount can be recorded as paying more than their actual net due
  before the guard trips.
- [P1] [GAP] "GST-compliant receipts" feature produces no receipt — the
  `fees.gstReceipts` flag (`lib/feature-flags.ts:105-109`) promises "tax breakdown on
  fee receipts," but the only surface is an inline tax-component text line in the
  payment panel (`FeesView.tsx:203-207`) — no printable/downloadable receipt document
  exists anywhere.
- [P1] [GAP] No way to correct or remove a recorded `FeePayment` — `fees/actions.ts`
  only exposes create. `FeePayment` is in `AUDITED_MODELS` (`lib/tenant-db.ts:24`),
  implying edits/deletes were expected, but a wrong-amount/date/method entry can never
  be fixed short of a manual DB edit.
- [P2] [GAP] No `loading.tsx`/`error.tsx` route boundaries anywhere under `app/app/`
  (app-wide, not unique to Fees) — a slow query or thrown error falls through to
  Next's default unstyled error screen.

## Accounts

- [P1] [BUG] Auto-source label map is missing `AUTO_INVENTORY_SALE` —
  `AUTO_SOURCE_LABEL` (`app/app/accounts/page.tsx:9-14`) omits it from the `TxnSource`
  enum (`prisma/schema.prisma:1847`); every inventory-sale-sourced ledger row falls
  through to the `?? "Payroll"` fallback and is mislabeled "Auto: Payroll."
- [P1] [GAP] Chart-of-accounts tagging is dead in the UI — `setTransactionAccountHead`
  (`accounts/depth-actions.ts:31-36`) is the only way to attach a `SchoolAccountHead`
  to a transaction, but no component ever calls it. A school can build a chart of
  accounts but never assign one to a transaction, so the Income & Expenditure report's
  account-head grouping always falls back to free-text `category`.
- [P1] [GAP] No way to edit or delete a manual `AccountsTransaction` — create,
  approve/reject, and account-head tagging only. `AccountsTransaction` is in
  `AUDITED_MODELS`, implying corrections were expected, but a mis-entered manual
  income/expense row is permanent.

Confirmed clean: no payment-gateway/checkout code anywhere; `FeePayment`/
`PayrollRun`/`PurchaseOrder`/`InventorySale` all correctly write matching
`AUTO_*` `AccountsTransaction` rows atomically.

## Inventory

- [P2] [POLISH] Inconsistent error handling on stock adjustment —
  `ConsumableRow`'s `adjustStock` (`app/app/inventory/InventoryForms.tsx:179-190`)
  swallows a failed OUT (insufficient stock) in an empty `catch` block; the near-identical
  `StockItemRow.move()` (lines 299-311) correctly surfaces the error via local state —
  Consumables should follow the same pattern.
- [P2] [GAP] `notes` fields modeled but never collected — both `InventoryAsset.notes`
  and `PurchaseOrder.notes` exist in the schema and are accepted by their create
  actions, but `AssetForm` always passes `notes: null` and `PurchaseOrderForm` has no
  notes field at all.

Confirmed clean on tenant-scoping and scope-creep: no raw `db` usage, no payment
gateway/checkout code anywhere in fees/accounts/inventory.

## Transport

- [P1] [GAP] Vehicle-detail sections ignore `canEdit`, exposing live write controls to
  VIEW-only staff — `app/app/transport/vehicles/[id]/VehicleSections.tsx`'s
  `DetailsSection` (incl. "Post location") and `ServiceLogSection` (incl. delete)
  render without ever checking `canEdit`, unlike the sibling toggle-active pill/Edit
  link a few lines above which do. `PersonDocumentsPanel` similarly always renders
  Upload/Delete unconditionally. A VIEW-level Transport staffer sees fully interactive
  controls that throw an uncaught permission error on submit.
- [P2] [GAP] No way to delete/remove a Route, Stop, or Vehicle once created — only
  `toggleVehicleActive` (deactivate) exists; a typo'd stop or duplicate route/vehicle
  is permanent, inconsistent with the guarded-delete pattern used elsewhere (e.g.
  `deleteClass`).

## Hostel

- [P0] [BUG] Raw `db` import bypasses tenant-scoped client —
  `app/app/hostel/attendance-actions.ts:6,18`, same pattern as Attendance/Homework
  (session's own `userId`, not directly exploitable, but still the wrong call path and
  now the third confirmed instance of it).
- [P1] [BUG] Visitor/Canteen/Maintenance tabs never receive or check `canEdit` —
  `hostel/page.tsx:93-98`'s tab dispatcher omits `canEdit` for `VisitorsTab`,
  `CanteenTab`, `MaintenanceTab` (unlike `AllocationTab`/`LaundryTab`/`AttendanceTab`
  which thread it through correctly). `VisitorLogPanel`, `OutingRequestsPanel`,
  `MessMenuEditor`, and all of `MaintenancePanel.tsx` render live add/approve/reject/
  delete controls for VIEW-only staff, most with no try/catch, so a VIEW-only click
  throws an unhandled error with zero feedback.
- [P1] [GAP] `allocateRoom` doesn't prevent double-allocating an already-housed student
  — `hostel/actions.ts:79-110` never checks for an existing `HostelAllocation` for that
  student, and the column has no unique constraint. The only guard is a client-side
  dropdown filter, so a stale page or a race between two staff sessions can create two
  simultaneous allocations, corrupting occupancy counts, attendance, and the parent view.
- [P2] [GAP] No delete for a `HostelRoom` once created — a mis-entered room is
  permanent.

Otherwise unusually well-built: Visitor/Canteen/Maintenance/Laundry tabs are all
backed by genuine models (`HostelVisitorLog`, `HostelOutingRequest`, `HostelMessMenu`,
`HostelMealServed`, `HostelMaintenanceLog`, `LaundryTicket`/`LaundryItem`), not stubs.

## Library

- [P2] [POLISH] Add/Edit Book tabs are reachable by direct URL manipulation for
  VIEW-only staff — `library/page.tsx` hides the tab *links* behind `canEdit` but
  renders the tab *content* purely off the `?tab=` query param with no `canEdit` check
  passed to `NewBookForm`/`EditBookPanel`. `NewBookForm`'s `createBook` throws
  uncaught with no error boundary in scope. Low real-world severity (requires manual
  URL tampering).

Otherwise real Prisma-backed circulation/fines with correct auto-`AccountsTransaction`
writes, no dead-end controls found.

## Events

- [P1] [GAP] "Send reminder to parents" shows a false-success state —
  `sendEventReminder` (`app/app/events/actions.ts:59-75`) creates an `Announcement`
  that defaults to `approvalStatus: PENDING` and does not reach any parent until a
  School Admin later approves it in Communication. `EventDetail.tsx:44-49,128`
  immediately flips the button to "Reminder sent ✓," misleading the Staff user into
  thinking parents were notified when the message may be sitting unapproved
  indefinitely (Staff may not even have Communication view access to check).

## Certificates

- [P2] [POLISH] Certificate pronoun/possessive merge fields are hardcoded —
  `lib/certificates.ts:45-46` always substitutes `{{pronoun}}`→"They" and
  `{{possessive}}`→"their" regardless of the student's recorded `gender`, even though
  that field exists and is used elsewhere (e.g. report filters).

Otherwise solid: real generation/issuance, tenant-scoped, working PDF export, good
empty states.

## Communication

Confirmed clean (highest-priority check for this module): zero hits for whatsapp/
twilio/sms/sendgrid/nodemailer/smtp/firebase/fcm/onesignal anywhere in the codebase.
Built exactly as `ARCHITECTURE.md`'s Milestone-10 deferral describes — one-way
`Announcement`/`AnnouncementRead` broadcast, no two-way messaging UI or dead-end chat
controls.

- [P1] [GAP] "Schedule for later" toggle in the compose form is functionally inert —
  `ComposeForm.tsx:88-98` persists a `scheduledFor` date
  (`app/app/communication/actions.ts:28,37,46`), but it's never read anywhere in the
  codebase, and `approveAnnouncement` (`actions.ts:55-60`) always publishes
  immediately on approval regardless of the chosen schedule. The control submits
  successfully and looks functional but has zero effect on send timing — a genuinely
  misleading control, not just a missing one, against `CLAUDE.md`'s "every control ...
  needs to actually do something."

Approval workflow and recipient views (audience filtering, mark-as-read) are real and
correctly gated; no raw `db` misuse found.

## Reports

No bugs found. All dashboard cards and detail reports compute live aggregates from
real Prisma queries (Attendance, FeePayment/FeeStructure, Mark/ExamSubject,
AdmissionEnquiry, StaffAttendance, TransportRoute) — no hardcoded/mocked numbers.
Empty states present, Excel export and the feature-flagged custom CSV report builder
both run the same real query path, all tenant-scoped.

## Settings

- [P0] [BUG] Cross-tenant IDOR on ID Card template elements — `IdCardElement`
  (`prisma/schema.prisma:2964-2989`) is the **only** non-platform model in the entire
  schema that lacks a `schoolId` field, so it falls outside `lib/tenant-db.ts`'s
  DMMF-driven `TENANT_SCOPED_MODELS` walk entirely — `sdb.idCardElement.*` behaves
  exactly like the raw, unscoped client. Every element-level mutation in
  `app/app/settings/id-card-actions.ts` (`updateIdCardElementBox`,
  `updateIdCardElementText`, `updateIdCardElementStyle`, `replaceIdCardElementImage`,
  `deleteIdCardElement`, lines 155-218) takes a client-supplied `id` with no
  ownership/schoolId check at all — a School Admin from Tenant A who obtains/guesses an
  element id belonging to Tenant B can edit or delete it. `GradeBand`
  (`schema.prisma:998-1002`) has an explicit comment showing the team already caught
  and fixed this exact class of bug elsewhere; `IdCardElement` was missed. Exactly the
  tenant-isolation class of bug `CLAUDE.md` calls "the single worst thing this app
  could ship with."
- [P1] [GAP] `ScreenCustomization` model has zero consuming code anywhere in the app —
  wired into `School`'s relations but never read or written by any route/action/
  component. Not in `ARCHITECTURE.md`'s "stubbed or deferred" list, so it reads as an
  undocumented orphan from the original 41-table dictionary rather than a deliberate
  deferral.
- [P2] [POLISH] Not flagged as a functional bug, but worth recording: no other gaps
  found — General, Academic Years, ID Card template CRUD/activation, Grading
  scales/bands, Certificate/Document Editor, feature-flagged UDISE+ Compliance, Audit
  Log, and the Website Builder link-out are all genuinely wired end-to-end with real
  persistence and reflect real DB state on reload.

---

## Super Admin — Schools

- [P0] [BUG] School onboarding has zero permission check — `onboardSchool`
  (`app/super-admin/schools/actions.ts:51`) never calls `auth()`/
  `requirePlatformModuleAccess` at all. The "+ Onboard a school" button is hidden
  client-side when `canManage` is false, but the server action is wide open — any
  `PLATFORM_STAFF` session, even one granted `NONE` on "Schools," can create a new
  school plus its `SCHOOL_ADMIN` account by hitting the action directly.
- [P1] [BUG] Every other School mutation (`updateSchool`, `updateSchoolStatus`,
  `toggleSchoolModule`, `toggleSchoolFeature`, `updateSchoolCaps`,
  `setSchoolLoginBlock`, `updateSchoolAdminAccount`, `updateSchoolAddress`,
  `upsertSchoolContact`, `updateRelationshipManager`, `addSchoolNote` — all in
  `app/super-admin/schools/actions.ts`) hardcodes `session?.user.role !== "SUPER_ADMIN"`
  instead of `requirePlatformModuleAccess("Schools","EDIT")`. Net effect: a
  `PLATFORM_STAFF` explicitly granted `EDIT` on "Schools" (a module
  `lib/platform-modules.ts:6` declares gateable) still cannot use most of "the
  fullest-built" Super Admin module — the granular permission system is non-functional
  here. Only `uploadSchoolDocument`/`deleteSchoolDocument` and
  `group-actions.ts`'s school-group actions use the real permission system.
- [P1] [GAP] Client components discard the `{error}` a denied write returns —
  `ModuleAccessGrid.tsx:12-16` and `FeatureAccessGrid.tsx` call their toggle actions
  inside `startTransition` and never check the result; a denied toggle silently no-ops
  with zero user feedback.
- [P2] [POLISH] `schools/[id]/page.tsx` passes `canManage` to only 3 of ~12 child forms
  (lines 184-273) — the rest render as fully-interactive edit forms even for VIEW-only
  access, relying entirely on the server to reject the write.

## Super Admin — Subscriptions & Billing

- [P0] [BUG] The entire module has no permission check — neither
  `app/super-admin/subscriptions/page.tsx` nor `subscriptions/actions.ts`
  (`recordSubscriptionPayment`, `createInvoice`) nor `subscriptions/new/page.tsx` call
  `auth()`/`requirePlatformModuleAccess` anywhere. Any `PLATFORM_STAFF` session — even
  one granted `NONE` on "Subscriptions & Billing" (a module declared gateable and
  hidden from their nav) — can browse directly to `/super-admin/subscriptions`, view
  every school's billing, create invoices, and record payments.

Confirmed clean on scope creep: `recordSubscriptionPayment` is pure manual entry, no
gateway SDK/checkout anywhere, consistent with `CLAUDE.md`'s on-hold instruction.

## Super Admin — Accounts (platform ledger; extra module beyond CLAUDE.md's list)

- [P0] [BUG] No permission check on any of the six tabs (Overview/Ledger/Bills/
  Invoices/Vendors/Chart of accounts) in `app/super-admin/accounts/page.tsx` — any
  `PLATFORM_STAFF`, even with `NONE` granted on "Accounts," can view Vidya Yati's
  entire internal ledger, vendors, bills, and subscription-invoice detail.
- [P1] [BUG] Conversely, every write action in `accounts/actions.ts`
  (`createLedgerAccount`, `createVendor`, `createBill`, `recordBillPayment`,
  `recordInboundPayment`/`recordOutboundPayment`, `setInvoiceRecurrence`,
  `generateNextInvoice`) hardcodes `SUPER_ADMIN`-only instead of
  `requirePlatformModuleAccess("Accounts","EDIT")` — a `PLATFORM_STAFF` granted `EDIT`
  on Accounts still cannot use any of it (same read/write mismatch as Schools above).
- [P2] [BUG] `InvoiceRecurrenceControl.tsx:12-16` optimistically updates local state
  before the (failing, for non-`SUPER_ADMIN`) server call resolves — the dropdown shows
  a value that was never persisted, with no rollback or error shown.

## Super Admin — Dashboard (extra module beyond CLAUDE.md's list)

- [P1] [GAP] `logReminder`/`markLost` (`app/super-admin/dashboard/actions.ts:7-31`)
  hardcode `assertSuperAdmin()`, but Dashboard is deliberately un-gated by design and
  `AttentionList.tsx:25-36` renders both actions to every viewer including
  `PLATFORM_STAFF`. Clicking either as non-Super-Admin throws inside an unhandled
  `startTransition` — the control appears simply broken. (Read side — revenue/ARR/
  attention list/account health — is intentionally open to all platform staff and is
  not a bug.)

## Super Admin — Plans (extra module beyond CLAUDE.md's list)

- [P2] [POLISH] `plans/page.tsx:8` discards the access level returned by
  `requirePlatformModuleAccess("Plans","VIEW")`, so create/toggle controls always
  render even for VIEW-only staff; submission correctly fails server-side but with a
  thrown error rather than a hidden/disabled control.

## Super Admin — Leads, Contracts, Audit Log (extra modules beyond CLAUDE.md's list)

No findings — all three are excellently and consistently gated end to end (page +
every action calls `requirePlatformModuleAccess`, `canEdit`/`canManage` threaded
through every client component). Contracts' print flow is real, not a dead end.

## Super Admin — Staff (extra module beyond CLAUDE.md's list)

- [P2] [POLISH] All Staff mutations hardcode `SUPER_ADMIN`-only rather than
  `requirePlatformModuleAccess("Staff","EDIT")`. Likely a deliberate, sound call
  (letting `PLATFORM_STAFF` manage their own team's module permissions would be a
  privilege-escalation path) but it's undocumented and inconsistent with the rest of
  the portal — worth confirming as intentional and recording in `ARCHITECTURE.md`
  rather than leaving it looking like an oversight.

## Super Admin — Reports

- [P2] [GAP] Report cards for "Platform Accounts P&L," "Vendor Spend," and "Platform
  Staff & Access" (`reports/page.tsx:96-106`) surface Accounts/Staff-owned figures to
  anyone with just "Reports" VIEW access, regardless of their own Accounts/Staff
  grant — compounded by, but distinct from, the platform-Accounts view-bypass flagged
  above.

## Super Admin — Settings / Change password

No findings — both correctly scope every read/write to `session.user.id`;
deliberately excluded from `PLATFORM_MODULES` gating (own-account settings, not a
resource to grant/deny) — the right call.
