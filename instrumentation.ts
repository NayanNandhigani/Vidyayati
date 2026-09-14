export async function register() {
  // Only the Node.js runtime has access to process.env the way this check
  // needs — the Edge runtime (middleware) never reaches this file.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkProductionEnv } = await import("./lib/env-check");
    checkProductionEnv();
  }
}
