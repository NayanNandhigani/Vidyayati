import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { formatINR, studentName } from "@/lib/format";
import { feeStatusFor, FEE_STATUS_STYLE } from "@/lib/academic";
import { hasFeature } from "@/lib/feature-flags";
import { computeDiscountAmount, computeLateFine } from "@/lib/fees";
import FeesView from "./FeesView";
import FeeSettingsPanel from "./FeeSettingsPanel";

export default async function FeesPage() {
  const session = await auth();
  const sdb = await getScopedDb();

  if (session!.user.role === "PARENT") {
    return <ParentFeesView />;
  }

  const accessLevel = await requireModuleAccess("Fees", "VIEW");
  const canEdit = accessLevel === "EDIT";

  const currentYear = await sdb.academicYear.findFirst({ where: { isCurrent: true } });
  const structures = currentYear ? await sdb.feeStructure.findMany({ where: { yearId: currentYear.id } }) : [];
  const structuresByClass = new Map<string, typeof structures>();
  for (const fs of structures) structuresByClass.set(fs.classId, [...(structuresByClass.get(fs.classId) ?? []), fs]);

  const students = await sdb.student.findMany({
    where: { status: "ACTIVE" },
    include: { class: true, feePayments: { orderBy: { paidOn: "desc" } }, feeDiscounts: true, feeAdjustments: { orderBy: { addedOn: "desc" } } },
    orderBy: [{ firstName: "asc" }, { surname: "asc" }],
  });

  const [showDiscounts, showGst, school] = await Promise.all([
    hasFeature(session!.user.schoolId, "fees.discountsAndFines"),
    hasFeature(session!.user.schoolId, "fees.gstReceipts"),
    sdb.school.findUnique({ where: { id: session!.user.schoolId! }, select: { feeLateFinePerDay: true, feeLateFineGraceDays: true, gstNumber: true, gstRatePercent: true } }),
  ]);

  const rows = students.map((s) => {
    const classStructures = structuresByClass.get(s.classId) ?? [];
    const total = classStructures.reduce((sum, fs) => sum + Number(fs.amount), 0);
    const paid = s.feePayments.reduce((sum, p) => sum + Number(p.amount), 0);

    const discountAmount = showDiscounts
      ? computeDiscountAmount(total, s.feeDiscounts.map((d) => ({ valueType: d.valueType, value: Number(d.value) })))
      : 0;
    const lateFine = showDiscounts
      ? computeLateFine(
          classStructures.map((fs) => ({ amount: Number(fs.amount), dueDate: fs.dueDate, paid: s.feePayments.filter((p) => p.feeStructureId === fs.id).reduce((sm, p) => sm + Number(p.amount), 0) })),
          school?.feeLateFinePerDay ? Number(school.feeLateFinePerDay) : null,
          school?.feeLateFineGraceDays ?? null
        )
      : 0;

    const adjustmentAmount = s.feeAdjustments.reduce((sum, a) => sum + Number(a.amount), 0);
    const netTotal = Math.max(0, total - discountAmount + lateFine + adjustmentAmount);
    const pending = Math.max(0, netTotal - paid);
    const hasOverdue = classStructures.some((fs) => fs.dueDate < new Date()) && paid < netTotal;
    return {
      id: s.id,
      name: studentName(s),
      className: `${s.class.grade}-${s.class.section}`,
      classId: s.classId,
      total: netTotal,
      paid,
      pending,
      discountAmount,
      lateFine,
      adjustmentAmount,
      status: feeStatusFor(netTotal, paid, hasOverdue),
      recentPayments: s.feePayments.slice(0, 5).map((p) => ({ paidOn: p.paidOn.toISOString(), method: p.method, amount: Number(p.amount) })),
      discounts: s.feeDiscounts.map((d) => ({ id: d.id, kind: d.kind, valueType: d.valueType, value: Number(d.value), note: d.note })),
      adjustments: s.feeAdjustments.map((a) => ({ id: a.id, description: a.description, amount: Number(a.amount) })),
    };
  });

  const totalBilled = rows.reduce((s, r) => s + r.total, 0);
  const totalCollected = rows.reduce((s, r) => s + r.paid, 0);
  const totalPending = rows.reduce((s, r) => s + r.pending, 0);
  const overdueCount = rows.filter((r) => r.status === "OVERDUE").length;

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 16, height: "100dvh", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="disp" style={{ fontSize: 21 }}>
          Fees {currentYear && <span style={{ fontSize: 14, fontWeight: 500, color: "var(--faint)" }}>· {currentYear.label}</span>}
        </div>
        {canEdit && (showDiscounts || showGst) && (
          <FeeSettingsPanel
            showLateFine={showDiscounts}
            showGst={showGst}
            latePerDay={school?.feeLateFinePerDay ? Number(school.feeLateFinePerDay) : null}
            lateGraceDays={school?.feeLateFineGraceDays ?? null}
            gstNumber={school?.gstNumber ?? null}
            gstRatePercent={school?.gstRatePercent ? Number(school.gstRatePercent) : null}
          />
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 13 }}>
        <Stat label="Total billed" value={formatINR(totalBilled)} />
        <Stat label="Collected" value={formatINR(totalCollected)} color="var(--good)" />
        <Stat label="Pending" value={formatINR(totalPending)} color="var(--warn)" />
        <Stat label="Overdue accounts" value={overdueCount} color="var(--critical)" />
      </div>

      <FeesView rows={rows} canEdit={canEdit} showDiscounts={showDiscounts} showGst={showGst} gstNumber={school?.gstNumber ?? null} gstRatePercent={school?.gstRatePercent ? Number(school.gstRatePercent) : null} />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="card" style={{ padding: "14px 17px" }}>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      <div className="mono" style={{ fontSize: 21, fontWeight: 700, color: color ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}

async function ParentFeesView() {
  const session = await auth();
  const sdb = await getScopedDb();

  const parent = await sdb.parent.findUnique({
    where: { userId: session!.user.id },
    include: {
      studentLinks: {
        include: {
          student: { include: { class: true, feePayments: { orderBy: { paidOn: "desc" } } } },
        },
      },
    },
  });

  const students = parent?.studentLinks.map((l) => l.student) ?? [];
  const currentYear = await sdb.academicYear.findFirst({ where: { isCurrent: true } });
  const [showDiscounts, school] = await Promise.all([
    hasFeature(session!.user.schoolId, "fees.discountsAndFines"),
    sdb.school.findUnique({ where: { id: session!.user.schoolId! }, select: { feeLateFinePerDay: true, feeLateFineGraceDays: true } }),
  ]);

  const studentFeeData = await Promise.all(
    students.map(async (s) => {
      const structures = currentYear ? await sdb.feeStructure.findMany({ where: { classId: s.classId, yearId: currentYear.id }, orderBy: { dueDate: "asc" } }) : [];
      const total = structures.reduce((sum, fs) => sum + Number(fs.amount), 0);
      const paid = s.feePayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const paidTerms = new Set(s.feePayments.map((p) => p.feeStructureId));

      let discountAmount = 0;
      let lateFine = 0;
      if (showDiscounts) {
        const discounts = await sdb.feeDiscount.findMany({ where: { studentId: s.id } });
        discountAmount = computeDiscountAmount(total, discounts.map((d) => ({ valueType: d.valueType, value: Number(d.value) })));
        lateFine = computeLateFine(
          structures.map((fs) => ({ amount: Number(fs.amount), dueDate: fs.dueDate, paid: s.feePayments.filter((p) => p.feeStructureId === fs.id).reduce((sm, p) => sm + Number(p.amount), 0) })),
          school?.feeLateFinePerDay ? Number(school.feeLateFinePerDay) : null,
          school?.feeLateFineGraceDays ?? null
        );
      }
      const netTotal = Math.max(0, total - discountAmount + lateFine);
      return { student: s, structures, total: netTotal, paid, paidTerms, discountAmount, lateFine };
    })
  );

  return (
    <div style={{ padding: "26px 34px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="disp" style={{ fontSize: 21 }}>
        Fees
      </div>
      {students.length === 0 && <div style={{ color: "var(--muted)" }}>No students linked to your account.</div>}
      {studentFeeData.map(({ student: s, structures, total, paid, paidTerms, discountAmount, lateFine }) => {
        return (
          <div key={s.id} className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 15.5, fontWeight: 700 }}>{studentName(s)}</div>
              <div style={{ textAlign: "right" }}>
                <div className="mono" style={{ fontSize: 13, color: "var(--muted)" }}>
                  {formatINR(paid)} / {formatINR(total)}
                </div>
                {(discountAmount > 0 || lateFine > 0) && (
                  <div style={{ fontSize: 10.5, color: "var(--muted)" }}>
                    {discountAmount > 0 && <span style={{ color: "var(--good)" }}>−{formatINR(discountAmount)} discount</span>}
                    {discountAmount > 0 && lateFine > 0 && " · "}
                    {lateFine > 0 && <span style={{ color: "var(--critical)" }}>+{formatINR(lateFine)} late fine</span>}
                  </div>
                )}
              </div>
            </div>
            {structures.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 13.5 }}>No fee structure set for this class yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {structures.map((fs) => {
                  const paidThis = paidTerms.has(fs.id);
                  const overdue = !paidThis && fs.dueDate < new Date();
                  const style = FEE_STATUS_STYLE[paidThis ? "PAID" : overdue ? "OVERDUE" : "PENDING"];
                  return (
                    <div key={fs.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.9fr auto", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--paper)", borderRadius: 8 }}>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{fs.term}</div>
                        <div style={{ fontSize: 10.5, color: "var(--faint)" }}>{paidThis ? "Paid" : `Due ${fs.dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}</div>
                      </div>
                      <div className="mono" style={{ fontWeight: 700, textAlign: "right" }}>
                        {formatINR(Number(fs.amount))}
                      </div>
                      <span className="pill" style={{ background: style.bg, color: style.fg }}>
                        {style.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
