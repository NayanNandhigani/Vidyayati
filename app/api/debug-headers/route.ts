// TEMP DIAG round 2: is NOW_BUILDER (forcing next's trustHostHeader) even
// taking effect as a runtime-only variable, or does it need to be present
// at `next build` time? Remove once the /signin self-redirect
// investigation concludes.
export async function GET(request: Request) {
  return Response.json({
    url: request.url,
    nowBuilderEnv: process.env.NOW_BUILDER ?? null,
    headers: Object.fromEntries(request.headers.entries()),
  });
}
