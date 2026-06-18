/**
 * Simulated ApplyDriver (Phase 5) - deterministic, in-memory, offline.
 *
 * Proves the open → scan → fill → PAUSE-at-review → submit → idempotent
 * pipeline without a real browser. The concurrency=1 invariant (no double-
 * submit) is enforced by throwing on a second submit() call.
 *
 * Drop-in replacement note:
 *   The real Playwright adapter implements the same `ApplyDriver` interface
 *   and ALWAYS stays local - it needs the user's authenticated browser session
 *   and a residential IP for the autonomy gate. To swap it in, implement
 *   `ApplyDriver` in `lib/apply/driver-playwright.ts` (not in scope here) and
 *   pass it to `approveAndSubmit` via an `opts.driver` parameter. The simulated
 *   adapter is the default for offline use, testing, and the CI gate.
 */

import type { ApplyDriver, PageSignals, PreparedField } from "@/lib/apply/types";

export function simulatedDriver(config?: {
  /** Override the PageSignals returned by scan(). Defaults to a clean page. */
  signals?: PageSignals;
  /** When true, submit() resolves ok:false (simulates a failed submission). */
  failSubmit?: boolean;
}): ApplyDriver {
  let _openedUrl: string | null = null;
  let _filledFields: PreparedField[] | null = null;
  let _submitted = false;

  return {
    name: "simulated",

    async open(url: string): Promise<void> {
      _openedUrl = url;
    },

    async scan(): Promise<PageSignals> {
      if (config?.signals) return config.signals;
      let host = "";
      if (_openedUrl) {
        try {
          host = new URL(_openedUrl).hostname;
        } catch {
          // invalid URL - leave host empty
        }
      }
      return {
        url: _openedUrl ?? "",
        host,
        markers: [],
        hasLoginForm: false,
        hasCaptcha: false,
      };
    },

    async fill(fields: PreparedField[]): Promise<void> {
      _filledFields = fields;
    },

    async attachResume(_pdfPath: string): Promise<boolean> {
      return true;
    },

    /**
     * Submit the application.
     *
     * CONCURRENCY=1 INVARIANT: throws if called more than once on the same
     * driver instance. This proves the no-double-submit guarantee - callers
     * must never call submit() on an already-submitted driver.
     */
    async submit(): Promise<{ ok: boolean; detail?: string }> {
      if (_submitted) {
        throw new Error(
          "simulatedDriver: submit() called twice - concurrency=1 invariant " +
            "violated (no double-submit, plan §8c / §C). " +
            `filledFields count: ${_filledFields?.length ?? 0}, url: ${_openedUrl ?? "(none)"}`,
        );
      }
      _submitted = true;
      const ok = !(config?.failSubmit ?? false);
      return {
        ok,
        detail: ok ? undefined : "simulated submit failure (failSubmit: true)",
      };
    },

    // No browser to tear down - a no-op so it satisfies the same ApplyDriver
    // shape the real Playwright adapter uses (the service calls close() in a
    // finally regardless of which driver is active).
    async close(): Promise<void> {
      _openedUrl = null;
      _filledFields = null;
    },
  };
}
