-- Split Student.name ("First Last") into first_name + surname, preserving
-- existing data. Every seeded student is exactly "{first} {last}", so
-- splitting on the last space is lossless for current data; a name with no
-- space at all ends up duplicated into both columns (documented fallback,
-- not expected to occur in practice).

ALTER TABLE "students" ADD COLUMN "surname" TEXT;

UPDATE "students" SET
  "surname" = substring("name" from '[^ ]+$'),
  "name" = trim(regexp_replace("name", '\s+\S+$', ''));

ALTER TABLE "students" ALTER COLUMN "surname" SET NOT NULL;

ALTER TABLE "students" RENAME COLUMN "name" TO "first_name";
