# Test findings

Bugs found while writing the initial Vitest suite (see `lib/*.test.ts`,
`lib/domain/*.test.ts`). Not fixed here — flagging for the Developer per the
QA brief. Ordered most to least severe.

---

## 1. `getPermittedClassIds()` never checks `School.disabledModules` — the "disable this module" feature doesn't actually block Homework/Exams/Timetable for most users

**File:** `lib/permissions.ts:78-92` (`getPermittedClassIds`), contrasted with `lib/permissions.ts:38-42` (`requireModuleAccess`'s disabled-module check)

`requireModuleAccess()` unconditionally checks `school.disabledModules` before doing anything else (lines 38-42) and throws if the module is disabled — this is the mechanism a Super Admin uses (via the Schools → Module Access grid) to turn a module off for a school. `getPermittedClassIds()` has no equivalent check at all.

That would be fine if every page that uses `getPermittedClassIds()` also called `requireModuleAccess()` unconditionally. Three of them don't — they only call it in the *reject* branch, when the staffer has zero permitted classes:

- `app/app/homework/page.tsx:26-28`
- `app/app/exams/page.tsx:39-41`
- `app/app/timetable/page.tsx:45-47`

```ts
const permittedClassIds = await getPermittedClassIds("Homework", "VIEW");
if (permittedClassIds !== "ALL" && permittedClassIds.size === 0) {
  await requireModuleAccess("Homework", "VIEW"); // only place disabledModules gets checked
}
```

Consequences:
- **For a School Admin session, `disabledModules` is never checked on these three pages at all.** `getPermittedClassIds()` returns `"ALL"` immediately for `SCHOOL_ADMIN` (line 81) with no disabled-module check, so the `if` above is always false and `requireModuleAccess()` is never called. A School Admin can disable "Homework" for their school in Settings/via Super Admin and still fully use `/app/homework`.
- **For a Staff session, it's only checked when the check doesn't matter.** A Staff member with any real class access (the common, intended case) never trips the `size === 0` branch either, so the disabled-module check is skipped for them too. It only fires for a staffer who has zero permitted classes — exactly the case where the page would already render empty regardless.

Compare with `app/app/students/page.tsx:15` and `app/app/students/new/page.tsx:9`, which call `requireModuleAccess("Students", "VIEW")` unconditionally before anything else — those two are correct. Homework/Exams/Timetable are the odd ones out (Attendance is *mostly* safe too, since it separately re-derives `classId` and calls `requireModuleAccess()` whenever any class exists in the school — it only has the same gap when a school has literally zero classes).

**Repro:** As Super Admin, disable "Homework" for a school (Schools → school detail → Module Access). Log in as that school's Admin (or any Staff with a Homework permission row) and visit `/app/homework` directly — it renders normally instead of the "disabled for this school" error.

**Suggested fix direction:** either make `getPermittedClassIds()` do the same `disabledModules` check `requireModuleAccess()` does, or have these three pages call `requireModuleAccess(moduleName, "VIEW")` unconditionally (like Students does) before calling `getPermittedClassIds()`.

---

## 2. `getPermittedClassIds()` disagrees with `requireModuleAccess()` on school-wide vs. class-specific precedence — can show an "editable" class that then rejects the write

**File:** `lib/permissions.ts:89-90` (`getPermittedClassIds`), contrasted with `lib/permissions.ts:59-61` (`requireModuleAccess`)

Documented precedence (from `requireModuleAccess`'s own docstring and code, lines 59-61): a school-wide `StaffPermission` row (`classId: null`) for a module **always wins over a class-specific row, regardless of which one grants more access**. So a Staff member with a school-wide `VIEW` row and a class-specific `EDIT` row for `class-A` has **VIEW**, not EDIT, on `class-A` — the school-wide row wins even though it's the lower grant.

`getPermittedClassIds()` doesn't implement this. It filters permission rows by `minimum` *first* (line 89: `.filter((p) => LEVEL_RANK[p.accessLevel] >= LEVEL_RANK[minimum])`), then checks whether any *surviving* row is school-wide. In the scenario above, filtering for `EDIT` drops the school-wide VIEW row (it's below the minimum) and keeps the class-specific EDIT row, so `getPermittedClassIds("Homework", "EDIT")` returns `{class-A}` — the opposite of what `requireModuleAccess("Homework", "EDIT", "class-A")` will decide moments later.

This matters because list pages use `getPermittedClassIds(..., "EDIT")` purely to decide what edit UI to show (e.g. `app/app/homework/page.tsx:33-34`'s `editableClassIds`/`canEdit`), while the actual write goes through `requireModuleAccess(..., "EDIT", classId)` in the corresponding `actions.ts` (confirmed at `app/app/homework/actions.ts:29`, `app/app/exams/actions.ts:37,99,150`, `app/app/timetable/actions.ts:15`). So a Staff member in this permission shape sees "+ New assignment" / edit affordances for `class-A`, and gets a hard "Insufficient permission for module... has VIEW, needs EDIT" error on submit.

Verified with a test in `lib/permissions.test.ts` ("BUG: includes a class the staffer's school-wide row would actually block at requireModuleAccess() time") — both calls run against the identical `StaffPermission` rows and produce contradictory answers.

**Suggested fix direction:** `getPermittedClassIds()` should resolve the school-wide row first (same order `requireModuleAccess()` uses) and only fall through to class-specific rows when there isn't one, rather than filtering by level before checking for a school-wide row.

---

## 3. `calculateExamResults()` gives tied students consecutive ranks instead of a shared rank

**File:** `lib/domain/exam-results.ts:44-48`

```ts
const ranked = [...totals].sort((a, b) => b.total - a.total);
...
const rank = ranked.findIndex((r) => r.studentId === studentId) + 1;
```

Two students with the identical total score get **different** ranks (e.g. 1 and 2) rather than sharing rank 1 — `findIndex` just returns each student's position in the stably-sorted array, with no tie-handling (no "dense rank" / "competition rank" logic, no shared rank + skip). On a report card, this reads as if one of two equally-scoring students outperformed the other, which isn't true and isn't an obviously-intentional simplification (school report cards conventionally show tied students sharing a rank).

Verified with a test in `lib/domain/exam-results.test.ts` ("gives tied totals consecutive ranks rather than a shared rank") — two students with identical `totalMarks` come back with `rank: 1` and `rank: 2`.

This is lower severity than #1/#2 (a display/reporting correctness issue, not an access-control issue), but worth a product decision: either implement standard competition ranking (ties share the lower rank number, next rank skips accordingly) or, if consecutive ranking for ties is intentional, it'd be worth a comment saying so since it reads like an oversight.

---

## What was NOT flagged as a bug

- `requireModuleAccess()`'s "school-wide row always wins even if it grants less" behavior (lib/permissions.ts:59-61) matches its own docstring and `ARCHITECTURE.md`'s description exactly — that's a documented design choice, not a bug. It's finding #2 above (the *other* function disagreeing with it) that's the actual bug.
- `computeDiscountAmount()`/`computeLateFine()` in `lib/fees.ts` behaved correctly against every case tested, including the discount-cap-at-total edge case and the grace-period boundary.
- The ARCHITECTURE.md-documented "scholarship is always `actualFee − chargedFee`, computed at read time, never stored" rule doesn't actually live in `lib/fees.ts` as a pure function the way the task brief assumed — the read-time computation is inline in `StudentFeeAllocationPanel.tsx:22` (client component) and the write-side cap-at-actual-fee guard is inline in `app/app/students/actions.ts:75-89`'s `updateStudentChargedFee()`, not in `lib/fees.ts`. This isn't a bug, just a documentation/code-location mismatch worth noting — `lib/fees.ts` only holds `computeDiscountAmount()`/`computeLateFine()`. Both `updateStudentChargedFee()`'s guard and the panel's scholarship arithmetic were manually reviewed rather than unit-tested, since they'd need Prisma-boundary mocking (for the action) or a component-rendering setup (for the panel) neither of which was in this round's highest-priority list.
