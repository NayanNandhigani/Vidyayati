import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// Same hardcoded palette as lib/certificate-pdf.tsx / lib/report-card-pdf.tsx.
const INK = "#17223b";
const INK2 = "#22315a";
const MUTED = "#667085";
const FAINT = "#98a1b3";
const MARIGOLD = "#e08a2c";
const MARIGOLD_DEEP = "#b96e1e";
const MARIGOLD_TINT = "#fbeadb";
const PAPER = "#f7f6f2";
const LINE = "#e5e8ee";
const WHITE = "#ffffff";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica" },
  card: { borderWidth: 1.5, borderColor: MARIGOLD, borderRadius: 10, overflow: "hidden" },
  banner: { backgroundColor: INK, paddingVertical: 16, paddingHorizontal: 24, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  schoolName: { fontSize: 16, fontWeight: 700, color: WHITE },
  bannerTitle: { fontSize: 11, fontWeight: 700, color: MARIGOLD, textTransform: "uppercase", letterSpacing: 1.5 },
  body: { padding: 24 },
  examBand: { backgroundColor: MARIGOLD_TINT, borderRadius: 6, padding: "10 14", marginBottom: 16 },
  examName: { fontSize: 13, fontWeight: 700, color: MARIGOLD_DEEP },
  examDates: { fontSize: 9.5, color: INK2, marginTop: 2 },
  detailsRow: { flexDirection: "row", gap: 20 },
  photoBox: { width: 84, height: 100, borderWidth: 1, borderColor: LINE, borderStyle: "dashed", borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: PAPER },
  photoText: { fontSize: 8, color: FAINT, textAlign: "center" },
  fieldsCol: { flex: 1, flexDirection: "column", gap: 9 },
  fieldRow: { flexDirection: "row" },
  fieldLabel: { fontSize: 8.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, width: 110 },
  fieldValue: { fontSize: 11, fontWeight: 700, color: INK, flex: 1 },
  seatBand: { flexDirection: "row", marginTop: 18, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 12, gap: 14 },
  seatBox: { flex: 1, backgroundColor: PAPER, borderRadius: 6, padding: "8 12", alignItems: "center" },
  seatLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 },
  seatValue: { fontSize: 13, fontWeight: 700, color: INK },
  instructions: { marginTop: 18, borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 12, backgroundColor: PAPER },
  instructionsTitle: { fontSize: 8.5, fontWeight: 700, color: INK, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  instructionLine: { fontSize: 8.5, color: INK2, marginBottom: 3, lineHeight: 1.4 },
  footer: { flexDirection: "row", justifyContent: "space-between", marginTop: 30, paddingHorizontal: 4 },
  signatureLine: { width: 130, borderTopWidth: 1, borderTopColor: INK, paddingTop: 5, fontSize: 8.5, fontWeight: 700, textAlign: "center", color: INK },
});

const INSTRUCTIONS = [
  "Carry this hall ticket along with your school ID card to every exam session — entry will not be permitted without it.",
  "Report to the exam room at least 15 minutes before the scheduled start time.",
  "Mobile phones, smart watches, and other electronic devices are strictly not allowed in the exam hall.",
  "Use of unfair means during the examination will lead to disciplinary action as per school policy.",
];

export type HallTicketStudent = {
  name: string;
  admissionNo: string;
  className: string;
  guardianName: string | null;
  roomName: string | null;
  seatNo: number | null;
};

export function HallTicketDocument({
  schoolName,
  examName,
  examDates,
  students,
}: {
  schoolName: string;
  examName: string;
  examDates: string;
  students: HallTicketStudent[];
}) {
  return (
    <Document>
      {students.map((s, i) => (
        <Page key={i} size="A4" style={styles.page}>
          <View style={styles.card}>
            <View style={styles.banner}>
              <Text style={styles.schoolName}>{schoolName}</Text>
              <Text style={styles.bannerTitle}>Hall Ticket</Text>
            </View>

            <View style={styles.body}>
              <View style={styles.examBand}>
                <Text style={styles.examName}>{examName}</Text>
                <Text style={styles.examDates}>{examDates}</Text>
              </View>

              <View style={styles.detailsRow}>
                <View style={styles.photoBox}>
                  <Text style={styles.photoText}>Student{"\n"}Photo</Text>
                </View>
                <View style={styles.fieldsCol}>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Student name</Text>
                    <Text style={styles.fieldValue}>{s.name}</Text>
                  </View>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Roll / Adm. no.</Text>
                    <Text style={styles.fieldValue}>{s.admissionNo}</Text>
                  </View>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Class</Text>
                    <Text style={styles.fieldValue}>{s.className}</Text>
                  </View>
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Parent / Guardian</Text>
                    <Text style={styles.fieldValue}>{s.guardianName ?? "—"}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.seatBand}>
                <View style={styles.seatBox}>
                  <Text style={styles.seatLabel}>Exam room</Text>
                  <Text style={styles.seatValue}>{s.roomName ?? "To be announced"}</Text>
                </View>
                <View style={styles.seatBox}>
                  <Text style={styles.seatLabel}>Seat number</Text>
                  <Text style={styles.seatValue}>{s.seatNo ?? "—"}</Text>
                </View>
              </View>

              <View style={styles.instructions}>
                <Text style={styles.instructionsTitle}>Instructions</Text>
                {INSTRUCTIONS.map((line, j) => (
                  <Text key={j} style={styles.instructionLine}>
                    {j + 1}. {line}
                  </Text>
                ))}
              </View>

              <View style={styles.footer}>
                <Text style={styles.signatureLine}>Student's Signature</Text>
                <Text style={styles.signatureLine}>Invigilator</Text>
                <Text style={styles.signatureLine}>Principal</Text>
              </View>
            </View>
          </View>
        </Page>
      ))}
    </Document>
  );
}
