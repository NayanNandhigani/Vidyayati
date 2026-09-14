// Dedicated healthcheck target for Railway's preDeploy gate — deliberately
// has no dependencies (no auth, no DB, no cookies) so deploy promotion
// never depends on anything but the process being up and able to respond.
export async function GET() {
  return new Response("ok", { status: 200 });
}
