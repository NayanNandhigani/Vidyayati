// TEMP DIAG round 3: directly introspect Next.js's own internal
// hasNextSupport/trustHostHeader detection from inside the running
// process, rather than inferring it indirectly — remove once the
// /signin self-redirect investigation concludes.
export async function GET(request: Request) {
  let hasNextSupport: unknown = "unavailable";
  try {
    // eval'd require to dodge bundler static analysis of this internal path
    // eslint-disable-next-line no-eval
    const req = eval("require");
    const ciInfo = req("next/dist/server/ci-info");
    hasNextSupport = ciInfo.hasNextSupport;
  } catch (e) {
    hasNextSupport = `error: ${e instanceof Error ? e.message : String(e)}`;
  }

  return Response.json({
    url: request.url,
    nowBuilderEnv: process.env.NOW_BUILDER ?? null,
    hasNextSupport,
    headers: Object.fromEntries(request.headers.entries()),
  });
}
