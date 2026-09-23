/**
 * Jev ApplyDriver - SERVER-ONLY, LOCAL browser, cloud decisions.
 *
 * Jev (TypeSafe) picks each step on the page and which saved answer fits each
 * field. It sees the page's own text, the field labels and the NAMES of the
 * approved answers; typed values are sent as "(filled)". The saved value is
 * typed exactly; nothing is generated. Submit is never pressed: the window is
 * handed to the user with the questions still blank.
 *
 * Runs only in Enhanced mode with consent for "applyAgent" and a
 * TYPESAFE_API_KEY in the secret store. Otherwise it quietly falls back to the
 * local Playwright filler. Every Jev call is written to the privacy ledger.
 */
import type { Page } from "playwright-core";
import type { ApplyDriver, PageSignals, PreparedField, SubmitResult } from "@/lib/apply/types";
import {
  buildSignals,
  launchSystemChrome,
  playwrightBrowserPage,
  playwrightDriver,
} from "@/lib/apply/driver-playwright";
import { ignoreInvisibleRecaptcha } from "@/lib/apply/driver-greenhouse";
import { pickAnswer, TYPESAFE_URL } from "@/lib/apply/jev/policy";
import { runJev, type JevRunResult, type TextRequest } from "@/lib/apply/jev/runner";
import { getAiSettings } from "@/lib/ai/settings";
import { byteLength, hostOf, recordToLedger } from "@/lib/ai/ledger";
import { getSecret } from "@/lib/secrets";
import { splitName } from "@/lib/apply/greenhouse";

/** PreparedField key → the answer name Jev sees. EEO answers are never offered. */
const ANSWER_NAMES: Record<string, string> = {
  email: "email address",
  phone: "phone number",
  location: "current location (city, state, country)",
  linkedinUrl: "LinkedIn profile URL",
  githubUrl: "GitHub profile URL",
  websiteUrl: "personal website or portfolio URL",
  workAuthorization: "Yes/No: legally authorized to work in the United States",
  requiresSponsorship: "Yes/No: requires visa sponsorship now or in the future",
  willingToRelocate: "Yes/No: willing to relocate",
  salaryExpectation: "salary expectation",
  yearsExperience: "years of professional experience",
  noticePeriod: "notice period",
  clearance: "Yes/No: holds a security clearance",
};

/** Approved answers as name → exact value. Unknown values are left out. PURE. */
export function answerBook(fields: PreparedField[]): Record<string, string> {
  const book: Record<string, string> = {};
  for (const f of fields) {
    if (f.source === "unknown" || !f.value.trim()) continue;
    if (f.key === "fullName") {
      const { first, last } = splitName(f.value);
      book["full name (first and last)"] = f.value.trim();
      if (first) book["first name"] = first;
      if (last) book["last name"] = last;
      continue;
    }
    const name = ANSWER_NAMES[f.key];
    if (name) book[name] = f.value.trim();
  }
  return book;
}

export function jevGoal(names: string[]): string {
  return (
    "Fill in this job application form. The applicant has saved answers for these fields only: " +
    names.join(", ") +
    ". Fill only fields that ask for one of those; leave every other field (essays, salary unless " +
    "listed, resume upload, agreements, voluntary demographic questions) untouched. If the page " +
    "shows a job description with an Apply button instead of a form, open the application form " +
    "first. For a dropdown, type the answer, then click the matching option. Never submit: when " +
    "every field you can fill is filled, choose DONE."
  );
}

/** fetch wrapper that logs each TypeSafe call to the privacy ledger (metadata only). */
function ledgerFetch(): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const started = Date.now();
    const bytesOut = typeof init?.body === "string" ? byteLength(init.body) : 0;
    try {
      const res = await fetch(input, init);
      recordToLedger({
        kind: "ai",
        purpose: "applyAgent",
        provider: "typesafe",
        model: "jev-latest",
        destination: hostOf(TYPESAFE_URL),
        local: false,
        redacted: true,
        bytesOut,
        durationMs: Date.now() - started,
        ok: res.ok,
        errorReason: res.ok ? undefined : `HTTP ${res.status}`,
      });
      return res;
    } catch (err) {
      recordToLedger({
        kind: "ai",
        purpose: "applyAgent",
        provider: "typesafe",
        destination: hostOf(TYPESAFE_URL),
        local: false,
        redacted: true,
        bytesOut,
        durationMs: Date.now() - started,
        ok: false,
        errorReason: "network",
      });
      throw err;
    }
  }) as typeof fetch;
}

/** The TypeSafe key, but only when the user allowed the apply agent to use the cloud. */
export async function jevApiKeyIfAllowed(): Promise<string | null> {
  const settings = await getAiSettings();
  if (settings.mode !== "enhanced" || !settings.consent?.tasks.includes("applyAgent")) return null;
  const key = (await getSecret("TYPESAFE_API_KEY"))?.trim();
  return key || null;
}

export function jevDriver(opts?: {
  /** Injectable for tests. */
  apiKey?: () => Promise<string | null>;
  launch?: (url: string) => Promise<{ page: Page; close(): Promise<void> }>;
  closeWhenDone?: boolean;
  /** Dry-run setting for the local fallback, so it behaves exactly as before. */
  fallbackDryRun?: boolean;
}): ApplyDriver {
  const getKey = opts?.apiKey ?? jevApiKeyIfAllowed;
  const launch = opts?.launch ?? launchSystemChrome;
  const closeWhenDone = opts?.closeWhenDone ?? process.env.APPLY_HEADLESS === "1";

  let fallback: ApplyDriver | null = null;
  let apiKey: string | null = null;
  let session: { page: Page; close(): Promise<void> } | null = null;
  let result: JevRunResult | null = null;
  let finished = false;

  const requirePage = (): Page => {
    if (!session) throw new Error("jevDriver: open() must be called before this step.");
    return session.page;
  };

  return {
    name: "jev",

    async open(url) {
      apiKey = await getKey();
      if (!apiKey) {
        // No consent or no key: the local filler does the job, nothing goes to the cloud.
        fallback = playwrightDriver({ dryRun: opts?.fallbackDryRun ?? true });
        return fallback.open(url);
      }
      session = await launch(url);
      await session.page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    },

    async scan(): Promise<PageSignals> {
      if (fallback) return fallback.scan();
      const raw = await playwrightBrowserPage(requirePage()).readRaw();
      return ignoreInvisibleRecaptcha(buildSignals(raw), raw);
    },

    async fill(fields: PreparedField[]) {
      if (fallback) return fallback.fill(fields);
      const book = answerBook(fields);
      const names = Object.keys(book);
      const fetchImpl = ledgerFetch();
      const writeText = async (req: TextRequest): Promise<string | null> => {
        const pick = await pickAnswer(req.field, req.pageText, names, { apiKey: apiKey!, fetchImpl });
        return pick.key ? book[pick.key]! : null;
      };
      result = await runJev(requirePage(), {
        apiKey: apiKey!,
        goal: jevGoal(names),
        writeText,
        fetchImpl,
      });
    },

    async attachResume(pdfPath: string) {
      if (fallback) return fallback.attachResume?.(pdfPath) ?? false;
      // Jev can't upload files; attach to the page's file input directly.
      return playwrightBrowserPage(requirePage()).attachResumeFile(pdfPath);
    },

    async submit(): Promise<SubmitResult> {
      if (fallback) return fallback.submit();
      if (finished) throw new Error("jevDriver: submit() called twice (no double-submit).");
      finished = true;
      const skipped = [...new Set(result?.skipped ?? [])];
      return {
        outcome: result?.outcome === "error" ? "failed" : "stopped_at_review",
        detail:
          result?.outcome === "error"
            ? `Jev run failed: ${result.error ?? "unknown error"}`
            : `Jev filled the form (${result?.steps.filter((s) => !s.text?.startsWith("(skipped")).length ?? 0} steps, ` +
              `ended ${result?.outcome}); left open for you to review and submit`,
        unanswered: skipped.map((s) => `Left for you: ${s}`),
      };
    },

    async close() {
      if (fallback) return fallback.close?.();
      if (!session) return;
      if (finished && !closeWhenDone && result?.outcome !== "error") {
        session = null; // hand-off: the window stays open for the user
        return;
      }
      await session.close();
      session = null;
    },
  };
}
