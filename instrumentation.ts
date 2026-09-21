/**
 * Next.js startup hook (Phase 12 + 4A). Desktop keychain bootstrap runs from
 * `lib/secrets/desktop-install.ts` via Tauri sidecar startup or explicit call —
 * kept out of instrumentation so the web build never bundles fs/path for edge.
 */
export async function register(): Promise<void> {
  const { logStartupWarnings, logger } = await import("@/lib/observability/logger");
  logStartupWarnings();

  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.on("uncaughtException", (err) => {
      logger.error("Uncaught exception (crashing process)", { error: err.message, stack: err.stack });
      process.exit(1);
    });
    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled rejection (crashing process)", { reason: String(reason) });
      process.exit(1);
    });
  }
}
