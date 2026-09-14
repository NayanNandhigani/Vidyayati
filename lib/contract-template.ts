// No server-only imports here (no `db`) — this is shared between the
// Contracts server action (fallback template generation) and the client-side
// "insert standard template" button in NewContractForm, so it must stay
// safe to bundle for the browser.

const CYCLE_LABEL: Record<string, string> = { MONTHLY: "monthly", QUARTERLY: "quarterly", YEARLY: "annual", NONE: "one-time" };

function displayDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
}

// Deliberately "Rs." rather than the ₹ glyph (lib/format.ts's formatINR) —
// this text is persisted to the database, and a legal document should spell
// out the exact amount rather than formatINR's abbreviated "1.5L" form.
function displayAmount(n: number): string {
  return `Rs. ${n.toLocaleString("en-IN")}`;
}

/** Standard subscription-agreement boilerplate, filled in from the deal terms — the starting point for a contract's editable body text. */
export function buildContractTemplate(params: { schoolName: string; billingCycle: string; annualFee: number; startDate: Date; endDate: Date }): string {
  const { schoolName, billingCycle, annualFee, startDate, endDate } = params;
  return `SUBSCRIPTION AGREEMENT

This Subscription Agreement ("Agreement") is entered into between Vidya Yati ("Vidya Yati", "the Platform") and ${schoolName} ("the School"), governing the School's use of the Vidya Yati school management platform.

1. SUBSCRIPTION FEES
The School subscribes to the Vidya Yati platform, billed on a ${CYCLE_LABEL[billingCycle] ?? billingCycle} basis at a rate of ${displayAmount(annualFee)} per year, exclusive of applicable taxes.

2. TERM
This Agreement is effective from ${displayDate(startDate)} and continues through ${displayDate(endDate)}, unless renewed or terminated earlier in accordance with this Agreement.

3. SERVICES
Vidya Yati shall provide the School with access to its school management software, including but not limited to student records, attendance, academics, fee management, and communication modules, as enabled for the School's account.

4. FEES AND PAYMENT
The School agrees to pay the subscription fee as invoiced by Vidya Yati. Invoices are payable within the period specified on each invoice. Continued access to the platform is contingent on timely payment.

5. DATA OWNERSHIP AND PRIVACY
All student, staff, and parent data entered into the platform remains the property of the School. Vidya Yati shall not access, share, or use this data except as necessary to provide the subscribed services, and shall maintain reasonable safeguards to protect its confidentiality.

6. TERMINATION
Either party may terminate this Agreement by providing written notice, subject to any minimum term or notice period agreed separately. Upon termination, the School may request an export of its data within a reasonable period.

7. GOVERNING LAW
This Agreement shall be governed by and construed in accordance with the laws of India.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date signed below.`;
}
