import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// Hardcoded to match app/globals.css's design tokens — PDF styles can't
// read CSS custom properties, so these are copied values, not derived.
// Same palette as lib/certificate-pdf.tsx, for visual consistency across
// every generated document.
const INK = "#17223b";
const INK2 = "#22315a";
const MUTED = "#667085";
const FAINT = "#98a1b3";
const MARIGOLD = "#e08a2c";
const MARIGOLD_TINT = "#fbeadb";
const GOOD = "#3f9b6f";
const WARN = "#c98a2e";
const CRITICAL = "#c14545";
const LINE = "#e5e8ee";
const PAPER = "#f7f6f2";

function gradeColorHex(grade: string): string {
  if (grade === "A+" || grade === "A") return GOOD;
  if (grade === "B+" || grade === "B") return WARN;
  return CRITICAL;
}

const styles = StyleSheet.create({
  page: { padding: 44, fontSize: 10.5, color: INK2, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 2, borderBottomColor: INK, paddingBottom: 14, marginBottom: 4 },
  schoolName: { fontSize: 18, fontWeight: 700, color: INK },
  schoolAddress: { fontSize: 9, color: MUTED, marginTop: 2 },
  docTitle: { fontSize: 12, fontWeight: 700, color: INK, textAlign: "right", letterSpacing: 1, textTransform: "uppercase" },
  examLine: { fontSize: 9.5, color: MUTED, textAlign: "right", marginTop: 3 },
  studentBand: { flexDirection: "row", justifyContent: "space-between", backgroundColor: PAPER, borderRadius: 6, padding: "10 14", marginTop: 16, marginBottom: 16 },
  studentName: { fontSize: 13, fontWeight: 700, color: INK },
  studentMeta: { fontSize: 9.5, color: MUTED, marginTop: 2 },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 4 },
  tHeadRow: { flexDirection: "row", backgroundColor: INK, paddingVertical: 6, paddingHorizontal: 10 },
  tHeadCell: { fontSize: 8.5, color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 },
  tRow: { flexDirection: "row", paddingVertical: 7, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: LINE },
  tCell: { fontSize: 10 },
  totalsRow: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 10, borderTopWidth: 1.5, borderTopColor: INK, backgroundColor: MARIGOLD_TINT },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  summaryBox: { alignItems: "center", flex: 1 },
  summaryLabel: { fontSize: 8.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  summaryValue: { fontSize: 15, fontWeight: 700, color: INK },
  footer: { flexDirection: "row", justifyContent: "space-between", marginTop: 46 },
  signatureLine: { width: 140, borderTopWidth: 1, borderTopColor: INK, paddingTop: 5, fontSize: 9, fontWeight: 700, textAlign: "center", color: INK },
  pageBreak: { marginTop: 0 },
});

export type ReportCardStudent = {
  name: string;
  admissionNo: string;
  className: string;
  subjects: { name: string; obtained: number; max: number }[];
  total: number;
  maxTotal: number;
  pct: number;
  grade: string;
  rank: number;
  outOf: number;
};

export function ReportCardDocument({
  schoolName,
  schoolAddress,
  examName,
  examDates,
  students,
}: {
  schoolName: string;
  schoolAddress: string;
  examName: string;
  examDates: string;
  students: ReportCardStudent[];
}) {
  return (
    <Document>
      {students.map((s, i) => (
        <Page key={i} size="A4" style={styles.page}>
          <View style={styles.header}>
            <View>
              <Text style={styles.schoolName}>{schoolName}</Text>
              {schoolAddress && <Text style={styles.schoolAddress}>{schoolAddress}</Text>}
            </View>
            <View>
              <Text style={styles.docTitle}>Report Card</Text>
              <Text style={styles.examLine}>{examName}</Text>
              <Text style={styles.examLine}>{examDates}</Text>
            </View>
          </View>

          <View style={styles.studentBand}>
            <View>
              <Text style={styles.studentName}>{s.name}</Text>
              <Text style={styles.studentMeta}>Class {s.className} · Adm. No. {s.admissionNo}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.studentMeta}>Rank in class</Text>
              <Text style={{ fontSize: 13, fontWeight: 700, color: INK }}>{s.rank} of {s.outOf}</Text>
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.tHeadRow}>
              <Text style={[styles.tHeadCell, { flex: 2.2 }]}>Subject</Text>
              <Text style={[styles.tHeadCell, { flex: 1, textAlign: "right" }]}>Obtained</Text>
              <Text style={[styles.tHeadCell, { flex: 1, textAlign: "right" }]}>Maximum</Text>
              <Text style={[styles.tHeadCell, { flex: 1, textAlign: "right" }]}>%</Text>
            </View>
            {s.subjects.map((sub, j) => {
              const subPct = sub.max > 0 ? (sub.obtained / sub.max) * 100 : 0;
              return (
                <View key={j} style={styles.tRow}>
                  <Text style={[styles.tCell, { flex: 2.2 }]}>{sub.name}</Text>
                  <Text style={[styles.tCell, { flex: 1, textAlign: "right" }]}>{sub.obtained}</Text>
                  <Text style={[styles.tCell, { flex: 1, textAlign: "right", color: FAINT }]}>{sub.max}</Text>
                  <Text style={[styles.tCell, { flex: 1, textAlign: "right", color: gradeColorHex(subPct >= 90 ? "A+" : subPct >= 80 ? "A" : subPct >= 70 ? "B+" : subPct >= 60 ? "B" : subPct >= 50 ? "C" : "D") }]}>{subPct.toFixed(0)}%</Text>
                </View>
              );
            })}
            <View style={styles.totalsRow}>
              <Text style={[styles.tCell, { flex: 2.2, fontWeight: 700 }]}>Total</Text>
              <Text style={[styles.tCell, { flex: 1, textAlign: "right", fontWeight: 700 }]}>{s.total}</Text>
              <Text style={[styles.tCell, { flex: 1, textAlign: "right", fontWeight: 700, color: FAINT }]}>{s.maxTotal}</Text>
              <Text style={[styles.tCell, { flex: 1, textAlign: "right", fontWeight: 700 }]}>{s.pct.toFixed(1)}%</Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Percentage</Text>
              <Text style={styles.summaryValue}>{s.pct.toFixed(1)}%</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Grade</Text>
              <Text style={[styles.summaryValue, { color: gradeColorHex(s.grade) }]}>{s.grade}</Text>
            </View>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>Result</Text>
              <Text style={[styles.summaryValue, { color: s.pct >= 33 ? GOOD : CRITICAL }]}>{s.pct >= 33 ? "PASS" : "FAIL"}</Text>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.signatureLine}>Class Teacher</Text>
            <Text style={styles.signatureLine}>Parent / Guardian</Text>
            <Text style={styles.signatureLine}>Principal</Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}
