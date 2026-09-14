import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { auth } from "@/auth";

// Renders a QR code PNG for arbitrary text — used by the ID Card canvas's
// BARCODE element (see app/app/settings/id-cards/[templateId]/IdCardElement.tsx),
// both while designing (sample data) and when previewing/generating for a
// real person (their admission number, etc). Any authenticated session can
// use it — the text itself is passed by the client at render time and
// nothing here is stored, so there's nothing school-specific to scope.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const text = new URL(req.url).searchParams.get("data");
  if (!text) return NextResponse.json({ error: "Missing data." }, { status: 400 });

  const png = await QRCode.toBuffer(text.slice(0, 500), { type: "png", width: 240, margin: 1 });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=300",
    },
  });
}
