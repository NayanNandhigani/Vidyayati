// TEMP DIAG: dumps every incoming request header as JSON, to see exactly
// what Host/X-Forwarded-* values Railway's proxy chain actually sends —
// remove once the /signin self-redirect investigation concludes.
export async function GET(request: Request) {
  return Response.json({
    url: request.url,
    headers: Object.fromEntries(request.headers.entries()),
  });
}
