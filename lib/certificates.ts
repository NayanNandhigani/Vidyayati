import { CertificateType } from "@prisma/client";

// Seed content for the 4 built-in certificate types only — used once,
// when a new school's Certificates module is first opened and these
// don't exist yet (see app/app/certificates/page.tsx's auto-provisioning).
// CUSTOM templates have no default; a School Admin writes their own
// label/title/body from scratch in the Certificate Builder panel.
export const DEFAULT_TEMPLATE_BODY: Record<Exclude<CertificateType, "CUSTOM">, { label: string; description: string; title: string; body: string }> = {
  BONAFIDE: {
    label: "Bonafide / Study Certificate",
    description: "Confirms current class & enrolment",
    title: "Bonafide Certificate",
    body: "This is to certify that {{name}}, Admission No. {{admissionNo}}, is a bona fide student of {{school}}. {{pronoun}} is currently studying in {{class}}, for the academic year {{year}}.\n\nConduct and academic progress during this period have been found to be satisfactory. This certificate is issued at the request of the parent/guardian for whatever purpose it may serve.",
  },
  TRANSFER: {
    label: "Transfer Certificate",
    description: "For students leaving the school",
    title: "Transfer Certificate",
    body: "This is to certify that {{name}}, Admission No. {{admissionNo}}, a student of {{class}}, {{school}}, is relieved from the rolls of this school in good standing, all dues cleared, at the close of the academic year {{year}}.",
  },
  CHARACTER: {
    label: "Character Certificate",
    description: "Conduct & discipline record",
    title: "Character Certificate",
    body: "This is to certify that {{name}}, a student of {{class}}, {{school}}, has borne a good moral character throughout {{possessive}} stay here. Conduct, discipline, and behaviour towards peers and staff have been commendable.",
  },
  ACHIEVEMENT: {
    label: "Achievement Certificate",
    description: "Recognises academic / co-curricular merit",
    title: "Achievement Certificate",
    body: "This is to certify that {{name}}, a student of {{class}}, {{school}}, has been awarded this certificate in recognition of outstanding achievement and dedication during the academic year {{year}}.",
  },
};

export function renderCertificateBody(
  template: string,
  ctx: { name: string; admissionNo: string; school: string; class: string; year: string }
): string {
  return template
    .replaceAll("{{name}}", ctx.name)
    .replaceAll("{{admissionNo}}", ctx.admissionNo)
    .replaceAll("{{school}}", ctx.school)
    .replaceAll("{{class}}", ctx.class)
    .replaceAll("{{year}}", ctx.year)
    .replaceAll("{{pronoun}}", "They")
    .replaceAll("{{possessive}}", "their");
}
