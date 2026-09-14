import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getScopedDb } from "@/lib/tenant-db";
import { requireModuleAccess } from "@/lib/permissions";
import { studentName } from "@/lib/format";
import { HallTicketDocument, type HallTicketStudent } from "@/lib/hall-ticket-pdf";

/**
 * GET /api/exams/[examId]/hall-ticket/pdf                     — every student in the exam's class
 * GET /api/exams/[examId]/hall-ticket/pdf?studentId=X          — just that one student
 * GET /api/exams/[examId]/hall-ticket/pdf?studentIds=a,b,c     — a chosen subset (bulk selection)
 *
 * Streamed `inline` so the browser's own PDF viewer gives both "print" and
 * "download" from one link.
 */
export async function GET(req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const { examId } = await params;
  const url = new URL(req.url);
  const studentId = url.searchParams.get("studentId");
  const studentIdsParam = url.searchParams.get("studentIds");
  const studentIds = studentIdsParam ? studentIdsParam.split(",").filter(Boolean) : null;

  const sdb = await getScopedDb();
  const exam = await sdb.exam.findFirst({ where: { id: examId }, include: { class: true, school: true } });
  if (!exam) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    await requireModuleAccess("Exams", "VIEW", exam.classId);
  } catch {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const idFilter = studentId ? [studentId] : studentIds ?? undefined;

  const students = await sdb.student.findMany({
    where: { classId: exam.classId, status: "ACTIVE", ...(idFilter ? { id: { in: idFilter } } : {}) },
    include: { parentLinks: { include: { parent: true }, orderBy: { isPrimary: "desc" } } },
    orderBy: [{ firstName: "asc" }, { surname: "asc" }],
  });
  if (students.length === 0) return NextResponse.json({ error: "No students found." }, { status: 404 });

  const seating = await sdb.examSeating.findMany({ where: { examId, studentId: { in: students.map((s) => s.id) } }, include: { room: true } });
  const seatByStudent = new Map(seating.map((s) => [s.studentId, s]));

  const className = `${exam.class.grade}-${exam.class.section}`;
  const rows: HallTicketStudent[] = students.map((st) => {
    const seat = seatByStudent.get(st.id);
    return {
      name: studentName(st),
      admissionNo: st.admissionNo,
      className,
      guardianName: st.parentLinks[0]?.parent.name ?? null,
      roomName: seat?.room?.name ?? null,
      seatNo: seat?.seatNo ?? null,
    };
  });

  const examDates = `${exam.startDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} – ${exam.endDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;

  const buffer = await renderToBuffer(HallTicketDocument({ schoolName: exam.school.name, examName: exam.name, examDates, students: rows }));

  const fileName = studentId
    ? `Hall-Ticket-${rows[0].name.replace(/[^a-zA-Z0-9]+/g, "-")}.pdf`
    : `Hall-Tickets-${exam.name.replace(/[^a-zA-Z0-9]+/g, "-")}-${className}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${fileName}"`, "Cache-Control": "private, no-store" },
  });
}
