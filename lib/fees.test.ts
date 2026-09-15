import { describe, it, expect } from "vitest";
import { computeDiscountAmount, computeLateFine } from "@/lib/fees";

describe("computeDiscountAmount()", () => {
  it("sums a flat discount directly", () => {
    expect(computeDiscountAmount(10000, [{ valueType: "FLAT", value: 1500 }])).toBe(1500);
  });

  it("computes a percent discount against the total", () => {
    expect(computeDiscountAmount(10000, [{ valueType: "PERCENT", value: 10 }])).toBe(1000);
  });

  it("sums multiple discounts of mixed type", () => {
    const total = computeDiscountAmount(10000, [
      { valueType: "PERCENT", value: 10 }, // 1000
      { valueType: "FLAT", value: 500 },
    ]);
    expect(total).toBe(1500);
  });

  it("caps the combined discount at the total owed — a scholarship can never make the fee negative", () => {
    const total = computeDiscountAmount(1000, [
      { valueType: "FLAT", value: 800 },
      { valueType: "PERCENT", value: 50 }, // another 500
    ]);
    expect(total).toBe(1000); // 1300 uncapped -> capped to 1000
  });

  it("returns 0 for no discounts", () => {
    expect(computeDiscountAmount(10000, [])).toBe(0);
  });
});

describe("computeLateFine()", () => {
  const DAY_MS = 86400000;

  it("returns 0 when there's no per-day fine configured", () => {
    const fine = computeLateFine([{ amount: 5000, dueDate: new Date(Date.now() - 10 * DAY_MS), paid: 0 }], null, 0);
    expect(fine).toBe(0);
  });

  it("charges nothing for a fee structure that's already fully paid, even if overdue", () => {
    const fine = computeLateFine([{ amount: 5000, dueDate: new Date(Date.now() - 30 * DAY_MS), paid: 5000 }], 50, 0);
    expect(fine).toBe(0);
  });

  it("charges nothing while still within the grace period", () => {
    const fine = computeLateFine([{ amount: 5000, dueDate: new Date(Date.now() - 3 * DAY_MS), paid: 0 }], 50, 5);
    expect(fine).toBe(0);
  });

  it("charges perDay * billable days once the grace period has elapsed", () => {
    // 10 days overdue, 3 grace days -> 7 billable days at 50/day = 350
    const fine = computeLateFine([{ amount: 5000, dueDate: new Date(Date.now() - 10 * DAY_MS), paid: 0 }], 50, 3);
    expect(fine).toBe(350);
  });

  it("charges the full overdue span when graceDays is null (treated as 0)", () => {
    const fine = computeLateFine([{ amount: 5000, dueDate: new Date(Date.now() - 5 * DAY_MS), paid: 0 }], 50, null);
    expect(fine).toBe(250);
  });

  it("sums fines across multiple overdue, still-outstanding fee structures", () => {
    const fine = computeLateFine(
      [
        { amount: 5000, dueDate: new Date(Date.now() - 10 * DAY_MS), paid: 0 }, // 10 days * 50 = 500
        { amount: 3000, dueDate: new Date(Date.now() - 4 * DAY_MS), paid: 0 }, // 4 days * 50 = 200
      ],
      50,
      0
    );
    expect(fine).toBe(700);
  });

  it("skips a partially-paid-but-still-outstanding structure only once it's fully paid, not before", () => {
    const fine = computeLateFine([{ amount: 5000, dueDate: new Date(Date.now() - 10 * DAY_MS), paid: 4999 }], 50, 0);
    expect(fine).toBe(500); // still counted as overdue since paid < amount
  });
});
