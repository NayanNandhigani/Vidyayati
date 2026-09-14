import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

// Hardcoded to match app/globals.css's design tokens — PDF styles can't
// read CSS custom properties, so these are copied values, not derived.
const INK = "#17223b";
const INK2 = "#22315a";
const MUTED = "#667085";
const MARIGOLD = "#e08a2c";
const MARIGOLD_DEEP = "#b96e1e";
const LINE = "#e5e8ee";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, color: INK2, fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  schoolNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logo: { width: 28, height: 28, objectFit: "contain" },
  schoolName: { fontSize: 18, fontWeight: 700, color: INK },
  dateLabel: { fontSize: 9, color: MUTED },
  divider: { height: 2, backgroundColor: MARIGOLD, marginTop: 14, marginBottom: 16 },
  title: { fontSize: 14, fontWeight: 700, color: INK, textAlign: "center", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 },
  body: { fontSize: 11, lineHeight: 1.8, color: INK2, textAlign: "justify" },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 40 },
  seal: { width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderColor: MARIGOLD, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  sealText: { fontSize: 7, color: MARIGOLD_DEEP, fontWeight: 700, textAlign: "center" },
  signatureBlock: { alignItems: "center" },
  signatureLine: { width: 160, borderTopWidth: 1, borderTopColor: INK, paddingTop: 6, fontSize: 10, fontWeight: 700, textAlign: "center" },
  signatureSchool: { fontSize: 9, color: MUTED, marginTop: 2 },
});

export function CertificateDocument({
  schoolName,
  title,
  body,
  issuedDate,
  logoDataUri,
}: {
  schoolName: string;
  title: string;
  body: string;
  issuedDate: Date;
  logoDataUri?: string | null;
}) {
  const dateLabel = issuedDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.schoolNameRow}>
            {logoDataUri && <Image src={logoDataUri} style={styles.logo} />}
            <Text style={styles.schoolName}>{schoolName}</Text>
          </View>
          <Text style={styles.dateLabel}>Date: {dateLabel}</Text>
        </View>
        <View style={styles.divider} />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <View style={styles.footer}>
          <View style={styles.seal}>
            <Text style={styles.sealText}>OFFICIAL{"\n"}SEAL</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLine}>Principal</Text>
            <Text style={styles.signatureSchool}>{schoolName}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
