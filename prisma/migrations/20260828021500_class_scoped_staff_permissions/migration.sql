-- AlterTable: add nullable class_id (null = school-wide, preserving every
-- existing row's current behavior unchanged) + its FK to classes.
ALTER TABLE "staff_permissions" ADD COLUMN     "class_id" TEXT;

ALTER TABLE "staff_permissions" ADD CONSTRAINT "staff_permissions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Widen the unique constraint from (staff_id, module_name) to
-- (staff_id, module_name, class_id) so a staff member can hold one
-- school-wide row plus one row per class they're scoped to.
DROP INDEX "staff_permissions_staff_id_module_name_key";

CREATE UNIQUE INDEX "staff_permissions_staff_id_module_name_class_id_key" ON "staff_permissions"("staff_id", "module_name", "class_id");
