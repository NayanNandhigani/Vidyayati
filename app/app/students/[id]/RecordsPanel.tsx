"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  updateStudentMedicalInfo,
  addEmergencyContact,
  deleteEmergencyContact,
  updateStudentPriorSchool,
} from "../depth-actions";

type Contact = { id: string; name: string; relation: string; phone: string; priority: number };
type Sibling = { id: string; name: string; className: string; admissionNo: string };

export default function RecordsPanel({
  studentId,
  showMedical,
  showPriorSchool,
  showSiblings,
  medical,
  contacts,
  priorSchool,
  siblings,
}: {
  studentId: string;
  showMedical: boolean;
  showPriorSchool: boolean;
  showSiblings: boolean;
  medical: { address: string | null; bloodGroup: string | null; medicalNotes: string | null };
  contacts: Contact[];
  priorSchool: { previousSchoolName: string | null; previousTcNo: string | null; previousTcDate: string | null; priorPerformanceNote: string | null };
  siblings: Sibling[];
}) {
  const [, startTransition] = useTransition();
  const [address, setAddress] = useState(medical.address ?? "");
  const [bloodGroup, setBloodGroup] = useState(medical.bloodGroup ?? "");
  const [medicalNotes, setMedicalNotes] = useState(medical.medicalNotes ?? "");
  const [contactForm, setContactForm] = useState({ name: "", relation: "", phone: "", priority: contacts.length + 1 });
  const [prevSchool, setPrevSchool] = useState(priorSchool.previousSchoolName ?? "");
  const [tcNo, setTcNo] = useState(priorSchool.previousTcNo ?? "");
  const [tcDate, setTcDate] = useState(priorSchool.previousTcDate?.slice(0, 10) ?? "");
  const [priorNote, setPriorNote] = useState(priorSchool.priorPerformanceNote ?? "");

  function saveMedical() {
    startTransition(() => updateStudentMedicalInfo(studentId, { address, bloodGroup, medicalNotes }));
  }
  function saveContact() {
    if (!contactForm.name.trim() || !contactForm.phone.trim()) return;
    startTransition(async () => {
      await addEmergencyContact(studentId, contactForm);
      setContactForm({ name: "", relation: "", phone: "", priority: contacts.length + 2 });
    });
  }
  function removeContact(id: string) {
    startTransition(() => deleteEmergencyContact(studentId, id));
  }
  function savePriorSchool() {
    startTransition(() => updateStudentPriorSchool(studentId, { previousSchoolName: prevSchool, previousTcNo: tcNo, previousTcDate: tcDate, priorPerformanceNote: priorNote }));
  }

  if (!showMedical && !showPriorSchool && !showSiblings) {
    return <div style={{ color: "var(--muted)", fontSize: 13, padding: "16px 0" }}>No additional record-keeping features are enabled for this school.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {showMedical && (
        <div>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 10 }}>
            Medical & address
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
            <div className="field">
              <label>Address</label>
              <textarea className="in" value={address} onChange={(e) => setAddress(e.target.value)} onBlur={saveMedical} rows={2} />
            </div>
            <div className="field">
              <label>Blood group</label>
              <input className="in" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} onBlur={saveMedical} placeholder="e.g. O+" />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 18 }}>
            <label>Allergies / medical conditions</label>
            <textarea className="in" value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} onBlur={saveMedical} rows={2} />
          </div>

          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 10 }}>
            Emergency contacts (called in priority order)
          </div>
          {contacts.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 10 }}>No emergency contacts added yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {[...contacts].sort((a, b) => a.priority - b.priority).map((c) => (
                <div key={c.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr auto", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--paper)", borderRadius: 8 }}>
                  <span className="pill" style={{ background: "var(--marigold-tint)", color: "var(--marigold-deep)" }}>
                    #{c.priority}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>
                    {c.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>({c.relation})</span>
                  </span>
                  <span className="mono" style={{ fontSize: 12 }}>{c.phone}</span>
                  <span onClick={() => removeContact(c.id)} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--critical)", cursor: "pointer" }}>
                    Remove
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <input className="in" placeholder="Name" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} style={{ width: 140 }} />
            <input className="in" placeholder="Relation" value={contactForm.relation} onChange={(e) => setContactForm({ ...contactForm, relation: e.target.value })} style={{ width: 110 }} />
            <input className="in" placeholder="Phone" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} style={{ width: 130 }} />
            <input
              className="in"
              type="number"
              min={1}
              placeholder="Priority"
              value={contactForm.priority}
              onChange={(e) => setContactForm({ ...contactForm, priority: Number(e.target.value) })}
              style={{ width: 80 }}
            />
            <button
              type="button"
              onClick={saveContact}
              style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", background: "var(--marigold)", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}
            >
              + Add contact
            </button>
          </div>
        </div>
      )}

      {showPriorSchool && (
        <div>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 10 }}>
            Prior school & academic history
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 10 }}>
            <div className="field">
              <label>Previous school</label>
              <input className="in" value={prevSchool} onChange={(e) => setPrevSchool(e.target.value)} onBlur={savePriorSchool} />
            </div>
            <div className="field">
              <label>Transfer certificate no.</label>
              <input className="in" value={tcNo} onChange={(e) => setTcNo(e.target.value)} onBlur={savePriorSchool} />
            </div>
            <div className="field">
              <label>TC date</label>
              <input className="in" type="date" value={tcDate} onChange={(e) => setTcDate(e.target.value)} onBlur={savePriorSchool} />
            </div>
          </div>
          <div className="field">
            <label>Prior academic performance (summary)</label>
            <textarea className="in" value={priorNote} onChange={(e) => setPriorNote(e.target.value)} onBlur={savePriorSchool} rows={2} />
          </div>
        </div>
      )}

      {showSiblings && (
        <div>
          <div className="mono" style={{ fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--faint)", marginBottom: 10 }}>
            Siblings at this school
          </div>
          {siblings.length === 0 ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>No siblings found (based on shared parent/guardian accounts).</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {siblings.map((s) => (
                <Link
                  key={s.id}
                  href={`/app/students/${s.id}`}
                  style={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--paper)", borderRadius: 8, textDecoration: "none", color: "inherit" }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{s.name}</span>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{s.className}</span>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--faint)" }}>{s.admissionNo}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
