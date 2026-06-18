/**
 * Real Playwright ApplyDriver (Phase 10) - SERVER-ONLY, LOCAL-ONLY.
 *
 * Implements the same `ApplyDriver` interface as the simulated adapter, so it
 * drops into approveAndSubmit via `opts.driver` (or the env-gated resolver) with
 * zero call-site changes. It drives the user's OWN installed Chrome through a
 * dedicated, persistent automation profile (`channel: "chrome"`), so:
 *   - it reuses real logins (no scraping, no separate browser download), and
 *   - it stays local even after any future cloud move (plan: "cloud brain +
 *     local hands"); autonomy auto-disables on cloud via the resolver.
 *
 * Safety spine (unchanged from Phase 5, plus a runtime re-check):
 *   - submit() enforces concurrency=1 (throws on a second call → no double-submit).
 *   - the service runs the LIVE detection scan right before submit and aborts if
 *     a CAPTCHA/login/Cloudflare signal appears - automation never blasts through.
 *   - a `dryRun` mode fills the form but never clicks submit (safe live testing).
 *
 * Testability: all browser work goes through the small `BrowserPage` seam, and
 * the signal-mapping + selector strategy are PURE functions. The gate injects a
 * fake page; production wraps a real Playwright Page. playwright-core is only
 * imported (dynamically) when the real launcher actually runs.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Page } from "playwright-core";
import type { ApplyDriver, PageSignals, PreparedField } from "@/lib/apply/types";
import { isPublicHttpUrl } from "@/lib/security/url";

// --- pure: field → selector strategy -----------------------------------------

export interface SelectorCandidate {
  by: "name" | "id" | "label" | "placeholder";
  value: string;
}

/** Common ATS field-name synonyms, keyed by our PreparedField.key. */
const FIELD_SYNONYMS: Record<string, string[]> = {
  name: ["name", "full_name", "fullname", "candidate_name", "your_name"],
  firstName: ["first_name", "firstname", "given_name"],
  lastName: ["last_name", "lastname", "family_name", "surname"],
  email: ["email", "candidate_email", "e-mail", "email_address"],
  phone: ["phone", "candidate_phone", "telephone", "mobile", "phone_number"],
  location: ["location", "city", "candidate_location", "current_location"],
  linkedinUrl: ["linkedin", "linkedin_url", "linkedinurl", "linkedin_profile"],
  githubUrl: ["github", "github_url", "githuburl"],
  websiteUrl: ["website", "portfolio", "url", "personal_website"],
  salaryExpectation: ["salary", "salary_expectation", "expected_salary", "compensation"],
};

/** Only safe attribute values become name/id CSS selectors (avoid injection). */
function isSafeAttr(v: string): boolean {
  return /^[A-Za-z][\w-]*$/.test(v);
}

/**
 * Ordered selector candidates for a field, most-specific first: known
 * name/id synonyms, then the human label and placeholder. PURE + deterministic.
 */
export function fieldSelectorCandidates(field: PreparedField): SelectorCandidate[] {
  const syn = FIELD_SYNONYMS[field.key] ?? [field.key];
  const out: SelectorCandidate[] = [];
  for (const s of syn) {
    if (isSafeAttr(s)) out.push({ by: "name", value: s }, { by: "id", value: s });
  }
  if (field.label && field.label.trim()) {
    out.push({ by: "label", value: field.label }, { by: "placeholder", value: field.label });
  }
  return out;
}

// --- pure: raw page → PageSignals (the runtime detection scan inputs) ---------

export interface RawPage {
  url: string;
  /** `src` of every <script src>. */
  scriptSrcs: string[];
  /** Whole-page HTML, lowercased. */
  htmlLower: string;
  hasPasswordField: boolean;
}

const CAPTCHA_MARKERS = [
  "recaptcha",
  "g-recaptcha",
  "hcaptcha",
  "h-captcha",
  "turnstile",
  "cf-turnstile",
  "cf-challenge",
  "challenges.cloudflare",
];

/** Extract detection markers from a raw page. PURE. */
export function detectMarkers(raw: RawPage): {
  markers: string[];
  hasCaptcha: boolean;
  hasLoginForm: boolean;
} {
  const hay = `${raw.scriptSrcs.join(" ")} ${raw.htmlLower}`.toLowerCase();
  const markers = CAPTCHA_MARKERS.filter((m) => hay.includes(m));
  if (hay.includes("cloudflare")) markers.push("cloudflare");
  const hasLoginForm =
    raw.hasPasswordField || /\/(login|signin|sign-in|auth)\b/i.test(raw.url);
  return {
    markers: Array.from(new Set(markers)),
    hasCaptcha: markers.length > 0,
    hasLoginForm,
  };
}

/** Map a raw page into the PageSignals the detection brain classifies. PURE. */
export function buildSignals(raw: RawPage): PageSignals {
  let host = "";
  try {
    host = new URL(raw.url).hostname;
  } catch {
    /* invalid URL - host stays "" */
  }
  const { markers, hasCaptcha, hasLoginForm } = detectMarkers(raw);
  return { url: raw.url, host, markers, hasLoginForm, hasCaptcha };
}

// --- the browser seam (real ⇄ fake) ------------------------------------------

export interface BrowserPage {
  url(): string;
  /** Gather the raw signals for the detection scan. */
  readRaw(): Promise<RawPage>;
  /** Try each selector candidate in order; return true once a field is filled. */
  fillField(candidates: SelectorCandidate[], value: string): Promise<boolean>;
  /** Click the submit/apply control; return whether one was found. */
  clickSubmit(): Promise<boolean>;
  /** Upload a resume PDF to the first matching file input. */
  attachResumeFile(pdfPath: string): Promise<boolean>;
}

export interface BrowserSession {
  page: BrowserPage;
  close(): Promise<void>;
}

export type Launcher = (url: string) => Promise<BrowserSession>;

// --- the real system-Chrome launcher (the only part that needs a browser) ----

/**
 * Launch the user's installed Chrome with a dedicated, persistent automation
 * profile. Uses `channel: "chrome"` so NO browser binary download is needed and
 * real logins are reused (plan §D - the profile is the crown jewel: kept in the
 * gitignored /.secrets dir, mode 0700). Honors APPLY_HEADLESS / APPLY_CHROME_PROFILE_DIR.
 */
export const systemChromeLauncher: Launcher = async (url) => {
  if (!isPublicHttpUrl(url)) {
    throw new Error(`playwrightDriver: refused non-public URL: ${url}`);
  }
  const { chromium } = await import("playwright-core");
  const userDataDir =
    process.env.APPLY_CHROME_PROFILE_DIR ??
    path.join(process.cwd(), ".secrets", "apply-chrome-profile");
  await fs.mkdir(userDataDir, { recursive: true, mode: 0o700 });

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chrome",
    headless: process.env.APPLY_HEADLESS === "1",
    viewport: { width: 1280, height: 900 },
  });
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });

  return {
    page: playwrightBrowserPage(page),
    close: async () => {
      await context.close();
    },
  };
};

/** Adapter: wrap a real Playwright Page into the BrowserPage seam. */
export function playwrightBrowserPage(page: Page): BrowserPage {
  return {
    url: () => page.url(),

    async readRaw(): Promise<RawPage> {
      const scriptSrcs = await page
        .$$eval("script[src]", (els) =>
          els.map((e) => (e as HTMLScriptElement).src),
        )
        .catch(() => [] as string[]);
      const htmlLower = (await page.content().catch(() => "")).toLowerCase();
      const hasPasswordField =
        (await page.$('input[type="password"]').catch(() => null)) !== null;
      return { url: page.url(), scriptSrcs, htmlLower, hasPasswordField };
    },

    async fillField(candidates, value) {
      for (const c of candidates) {
        try {
          const loc =
            c.by === "name"
              ? page.locator(
                  `input[name="${c.value}"], textarea[name="${c.value}"], select[name="${c.value}"]`,
                )
              : c.by === "id"
                ? page.locator(`#${c.value}`)
                : c.by === "label"
                  ? page.getByLabel(c.value, { exact: false })
                  : page.getByPlaceholder(c.value, { exact: false });
          if ((await loc.count()) > 0) {
            await loc.first().fill(value, { timeout: 4_000 });
            return true;
          }
        } catch {
          /* try the next candidate */
        }
      }
      return false;
    },

    async clickSubmit() {
      const candidates = [
        page.getByRole("button", { name: /submit|apply|send/i }),
        page.locator('button[type="submit"], input[type="submit"]'),
      ];
      for (const loc of candidates) {
        try {
          if ((await loc.count()) > 0) {
            await loc.first().click({ timeout: 5_000 });
            return true;
          }
        } catch {
          /* try the next control */
        }
      }
      return false;
    },

    async attachResumeFile(pdfPath: string) {
      const selectors = [
        'input[type="file"][accept*="pdf" i]',
        'input[type="file"][name*="resume" i]',
        'input[type="file"][name*="cv" i]',
        'input[type="file"]',
      ];
      for (const sel of selectors) {
        try {
          const loc = page.locator(sel);
          if ((await loc.count()) > 0) {
            await loc.first().setInputFiles(pdfPath);
            return true;
          }
        } catch {
          /* try the next input */
        }
      }
      return false;
    },
  };
}

// --- the driver --------------------------------------------------------------

export function playwrightDriver(opts?: {
  /** Injectable for tests; defaults to the real system-Chrome launcher. */
  launcher?: Launcher;
  /** Fill the form but never click submit - safe live testing. */
  dryRun?: boolean;
}): ApplyDriver {
  const launcher = opts?.launcher ?? systemChromeLauncher;
  const dryRun = opts?.dryRun ?? false;
  let session: BrowserSession | null = null;
  let openedUrl = "";
  let submitted = false;

  function requireSession(): BrowserSession {
    if (!session) {
      throw new Error("playwrightDriver: open() must be called before this step.");
    }
    return session;
  }

  return {
    name: dryRun ? "playwright(dry-run)" : "playwright",

    async open(url: string): Promise<void> {
      openedUrl = url;
      session = await launcher(url);
    },

    async scan(): Promise<PageSignals> {
      const raw = await requireSession().page.readRaw();
      return buildSignals({ ...raw, url: raw.url || openedUrl });
    },

    async fill(fields: PreparedField[]): Promise<void> {
      const { page } = requireSession();
      for (const f of fields) {
        // Only fill known values - never invent at submit time; unmatched fields
        // are skipped (the human already approved every value at the review gate).
        if (!f.value || f.source === "unknown") continue;
        await page.fillField(fieldSelectorCandidates(f), f.value);
      }
    },

    async attachResume(pdfPath: string): Promise<boolean> {
      return requireSession().page.attachResumeFile(pdfPath);
    },

    async submit(): Promise<{ ok: boolean; detail?: string }> {
      // CONCURRENCY=1: a second submit() on the same driver is a no-double-submit
      // violation and throws (mirrors the simulated adapter / plan §8c, §C).
      if (submitted) {
        throw new Error(
          "playwrightDriver: submit() called twice - concurrency=1 invariant " +
            "violated (no double-submit).",
        );
      }
      submitted = true;
      const { page } = requireSession();

      if (dryRun) {
        return { ok: true, detail: "dry run - form filled, NOT submitted" };
      }
      const clicked = await page.clickSubmit();
      if (!clicked) {
        return { ok: false, detail: "no submit control found on the page" };
      }
      return { ok: true };
    },

    async close(): Promise<void> {
      if (session) {
        await session.close();
        session = null;
      }
    },
  };
}
