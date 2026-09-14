import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { getScopedDb } from "@/lib/tenant-db";
import { mergeFieldsFor, sampleMergeContext } from "@/lib/id-cards";
import { listStudentsForPreview, listStaffForPreview } from "../../id-card-actions";
import IdCardEditor from "./IdCardEditor";

export default async function IdCardTemplateEditorPage({ params }: { params: Promise<{ templateId: string }> }) {
  const session = await auth();
  if (session!.user.role !== "SCHOOL_ADMIN") redirect("/app/dashboard");

  const { templateId } = await params;
  const sdb = await getScopedDb();

  const template = await sdb.idCardTemplate.findUnique({
    where: { id: templateId },
    include: { elements: { orderBy: { zIndex: "asc" } } },
  });
  if (!template) notFound();

  const previewPeople = template.audience === "STAFF" ? await listStaffForPreview() : await listStudentsForPreview();

  return (
    <IdCardEditor
      templateId={template.id}
      audience={template.audience}
      initialName={template.name}
      orientation={template.orientation}
      backgroundColor={template.backgroundColor}
      elements={template.elements.map((e) => ({
        id: e.id,
        type: e.type,
        x: e.x,
        y: e.y,
        width: e.width,
        height: e.height,
        text: e.text,
        imagePath: e.imagePath,
        fontSize: e.fontSize,
        fontFamily: e.fontFamily,
        fontWeight: e.fontWeight,
        italic: e.italic,
        textAlign: e.textAlign,
        color: e.color,
        backgroundColor: e.backgroundColor,
        shapeKind: e.shapeKind,
        borderColor: e.borderColor,
        borderWidth: e.borderWidth,
        borderRadius: e.borderRadius,
      }))}
      mergeFields={mergeFieldsFor(template.audience)}
      sampleCtx={sampleMergeContext(template.audience)}
      previewPeople={previewPeople}
    />
  );
}
