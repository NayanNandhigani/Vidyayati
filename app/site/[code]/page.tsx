import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import CanvasEditor from "./CanvasEditor";
import type { ElementData } from "./CanvasElement";

// A school's own public website — unauthenticated by design for most
// visitors (no session exists to scope a query from, hence the raw `db`
// import rather than getScopedDb() when read-only; this is the one
// legitimate exception documented in lib/tenant-db.ts's own comment).
// When the visitor IS that exact school's own SCHOOL_ADMIN, this same
// route becomes the live editor (CanvasEditor) — one URL, one visual
// source of truth for what the site looks like, editor and public view
// alike. Always rendered fresh — this is a live-editable page.
export const dynamic = "force-dynamic";

const CANVAS_WIDTH = 1200;

function assetUrl(path: string) {
  return `/api/website-assets/${path}`;
}

// The shape of one element inside WebsiteSettings.publishedSnapshot —
// see publishWebsite() in ./actions.ts, which is the only writer of this
// JSON blob. Kept structurally identical to ElementData (minus the id
// being guaranteed, since it's just JSON) so the public render below can
// reuse the exact same per-type rendering logic as the live rows used to.
type SnapshotElement = Omit<ElementData, "id"> & { id: string };
type Snapshot = { canvasBackground: string | null; elements: SnapshotElement[] };

export default async function SchoolSitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const school = await db.school.findUnique({ where: { code } });
  if (!school) notFound();

  const settings = await db.websiteSettings.findUnique({ where: { schoolId: school.id } });
  const session = await auth();
  const isOwningAdmin = session?.user.role === "SCHOOL_ADMIN" && session.user.schoolId === school.id;

  if (isOwningAdmin) {
    const elements = await db.websiteElement.findMany({ where: { schoolId: school.id }, orderBy: { zIndex: "asc" } });
    const elementData: ElementData[] = elements.map((e) => ({
      id: e.id,
      type: e.type,
      x: e.x,
      y: e.y,
      width: e.width,
      height: e.height,
      visible: e.visible,
      text: e.text,
      href: e.href,
      imagePath: e.imagePath,
      images: e.images,
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
    }));

    const host = (await headers()).get("host") ?? "";
    const siteUrl = `${host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"}://${host}/site/${code}`;

    return (
      <CanvasEditor
        schoolCode={code}
        schoolName={school.name}
        canvasBackground={settings?.canvasBackground ?? null}
        elements={elementData}
        publishedAt={settings?.publishedAt ? settings.publishedAt.toISOString() : null}
        siteUrl={siteUrl}
      />
    );
  }

  // Everyone else sees only what was last explicitly Published — the
  // live website_elements rows above are the admin's in-progress draft.
  const snapshot = settings?.publishedSnapshot as unknown as Snapshot | null;
  const elementData = snapshot?.elements ?? [];
  const canvasBg = snapshot?.canvasBackground ?? "#ffffff";

  if (!snapshot) {
    return (
      <div style={{ background: "#f4f5f7", minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", color: "var(--muted)" }}>
          <div className="disp" style={{ fontSize: 22, color: "var(--ink)", marginBottom: 8 }}>
            {school.name}
          </div>
          <div style={{ fontSize: 14 }}>This school&apos;s website hasn&apos;t been published yet.</div>
        </div>
      </div>
    );
  }

  const canvasHeight = Math.max(600, ...elementData.map((e) => e.y + e.height + 60), 600);

  return (
    <div style={{ background: "#f4f5f7", minHeight: "100dvh", display: "flex", justifyContent: "center", padding: "0" }}>
      <div style={{ position: "relative", width: CANVAS_WIDTH, height: canvasHeight, background: canvasBg, maxWidth: "100%" }}>
        {elementData
          .filter((e) => e.visible)
          .map((el) => (
            <div key={el.id} style={{ position: "absolute", left: el.x, top: el.y, width: el.width, height: el.height }}>
              {el.type === "IMAGE" &&
                (el.imagePath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetUrl(el.imagePath)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
                ) : null)}
              {el.type === "IMAGE_CAROUSEL" && el.images.length > 0 && (
                <div style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: 8 }}>
                  <style>{`@keyframes scroll-${el.id} { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
                  <div style={{ display: "flex", height: "100%", width: "max-content", animation: `scroll-${el.id} ${Math.max(12, el.images.length * 4)}s linear infinite` }}>
                    {[...el.images, ...el.images].map((path, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={assetUrl(path)} alt="" style={{ height: "100%", width: "auto", objectFit: "cover", marginRight: 8, borderRadius: 6 }} />
                    ))}
                  </div>
                </div>
              )}
              {el.type === "TEXT" && (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    fontSize: el.fontSize ?? 16,
                    color: el.color ?? "var(--ink)",
                    background: el.backgroundColor || "transparent",
                    fontFamily: el.fontFamily || "inherit",
                    fontWeight: el.fontWeight ?? 400,
                    fontStyle: el.italic ? "italic" : "normal",
                    textAlign: (el.textAlign as React.CSSProperties["textAlign"]) ?? "left",
                    padding: el.backgroundColor ? 6 : 0,
                    boxSizing: "border-box",
                    borderRadius: 6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {el.text}
                </div>
              )}
              {el.type === "BUTTON" && (
                <a
                  href={el.href ?? "#"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: el.textAlign === "left" ? "flex-start" : el.textAlign === "right" ? "flex-end" : "center",
                    width: "100%",
                    height: "100%",
                    fontSize: el.fontSize ?? 14,
                    fontFamily: el.fontFamily || "inherit",
                    fontWeight: el.fontWeight ?? 700,
                    fontStyle: el.italic ? "italic" : "normal",
                    color: el.color ?? "#fff",
                    background: el.backgroundColor ?? "var(--marigold)",
                    borderRadius: 10,
                    textDecoration: "none",
                  }}
                >
                  {el.text}
                </a>
              )}
              {el.type === "SHAPE" && (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: el.backgroundColor ?? "#e08a2c",
                    border: el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor ?? "#e08a2c"}` : "none",
                    borderRadius: el.shapeKind === "circle" ? "50%" : el.borderRadius ?? 8,
                  }}
                />
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
