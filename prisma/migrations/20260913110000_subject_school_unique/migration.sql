-- Architecture V1, Milestone 5 (People/Subjects/Admissions hardening),
-- Phase 8 item 72: subjects had no DB-level uniqueness at all, only an
-- application-level case-insensitive check in createSubject() — a race
-- between two concurrent requests could still create duplicates. Verified
-- zero existing (school_id, name) duplicates before adding this.
CREATE UNIQUE INDEX "subjects_school_id_name_key" ON "subjects"("school_id", "name");
