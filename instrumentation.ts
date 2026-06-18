/**
 * Next.js startup hook (Phase 12). Desktop keychain bootstrap runs from
 * `lib/secrets/desktop-install.ts` via Tauri sidecar startup or explicit call —
 * kept out of instrumentation so the web build never bundles fs/path for edge.
 */
export async function register(): Promise<void> {
  // no-op on web; see lib/secrets/desktop-install.ts
}
