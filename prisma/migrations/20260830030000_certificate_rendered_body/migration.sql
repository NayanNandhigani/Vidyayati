-- Certificates: snapshot the rendered text at issuance time, so a
-- previously issued certificate doesn't silently change if its template
-- is edited later.

ALTER TABLE "certificates_issued" ADD COLUMN "rendered_body" TEXT NOT NULL DEFAULT '';
