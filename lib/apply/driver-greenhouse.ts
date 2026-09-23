/**
 * Greenhouse ApplyDriver - SERVER-ONLY, LOCAL-ONLY.
 *
 * Fills a hosted Greenhouse application (job-boards.greenhouse.io) from the
 * question list its public API publishes, typing only into the exact input ids
 * the plan names. No model drives the browser.
 *
 * It never presses submit. It fills what the approved answers cover, attaches
 * the resume, and hands the open window to the user with the list of required
 * questions still blank. The user submits; "I submitted it" records it.
 *
 * Greenhouse forms load an invisible reCAPTCHA that only runs when the user
 * submits. It is not a challenge on the page, so the live scan ignores it; a
 * visible challenge, a login wall or Cloudflare still stops the run.
 */
import type { Page } from "playwright-core";
import type { ApplyDriver, PageSignals, PreparedField, SubmitResult } from "@/lib/apply/types";
import { buildSignals, launchSystemChrome, type RawPage } from "@/lib/apply/driver-playwright";
import {
  fetchGreenhouseForm,
  parseGreenhouseJobUrl,
  planGreenhouseFill,
  type GreenhouseForm,
  type GreenhousePlan,
} from "@/lib/apply/greenhouse";

// --- pure: invisible reCAPTCHA is not a challenge -----------------------------

const RECAPTCHA_MARKERS = new Set(["recaptcha", "g-recaptcha"]);

/**
 * Drop reCAPTCHA markers when the page only carries the invisible variant
 * (size=invisible, no challenge frame). Everything else is kept. PURE.
 */
export function ignoreInvisibleRecaptcha(signals: PageSignals, raw: RawPage): PageSignals {
  const html = raw.htmlLower;
  const invisibleOnly = html.includes("size=invisible") && !html.includes("recaptcha/api2/bframe")
    && !html.includes("recaptcha/enterprise/bframe");
  if (!invisibleOnly) return signals;
  const markers = signals.markers.filter((m) => !RECAPTCHA_MARKERS.has(m));
  return { ...signals, markers, hasCaptcha: markers.length > 0 };
}

// --- the browser seam (real ⇄ fake) ------------------------------------------

export interface GreenhousePage {
  readRaw(): Promise<RawPage>;
  fillText(id: string, value: string): Promise<boolean>;
  chooseOption(id: string, option: string): Promise<boolean>;
  attachFile(id: string, filePath: string): Promise<boolean>;
}

export interface GreenhouseSession {
  page: GreenhousePage;
  close(): Promise<void>;
}

export type GreenhouseLauncher = (url: string) => Promise<GreenhouseSession>;

const SAFE_ID = /^[A-Za-z][\w-]*$/;

/** Wrap a real Playwright page. Ids come from Greenhouse's API and are checked first. */
export function playwrightGreenhousePage(page: Page): GreenhousePage {
  return {
    async readRaw() {
      const scriptSrcs = await page
        .$$eval("script[src]", (els) => els.map((e) => (e as HTMLScriptElement).src))
        .catch(() => [] as string[]);
      const htmlLower = (await page.content().catch(() => "")).toLowerCase();
      const hasPasswordField = (await page.$('input[type="password"]').catch(() => null)) !== null;
      return { url: page.url(), scriptSrcs, htmlLower, hasPasswordField };
    },

    async fillText(id, value) {
      if (!SAFE_ID.test(id)) return false;
      const loc = page.locator(`#${id}`);
      if ((await loc.count()) === 0) return false;
      await loc.first().fill(value, { timeout: 5_000 });
      return true;
    },

    async chooseOption(id, option) {
      if (!SAFE_ID.test(id)) return false;
      const input = page.locator(`#${id}`);
      if ((await input.count()) === 0) return false;
      await input.first().click({ timeout: 5_000 });
      // Each dropdown owns its own menu; other menus (e.g. phone country) stay hidden.
      const menuId = await input.first().getAttribute("aria-controls");
      const scope = menuId && SAFE_ID.test(menuId) ? page.locator(`#${menuId}`) : page.locator('[role="listbox"]:visible');
      const exact = new RegExp(`^\\s*${option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
      const choice = scope.locator('[role="option"]', { hasText: exact });
      if ((await choice.count()) === 0) {
        await page.keyboard.press("Escape");
        return false;
      }
      await choice.first().click({ timeout: 5_000 });
      return true;
    },

    async attachFile(id, filePath) {
      if (!SAFE_ID.test(id)) return false;
      const loc = page.locator(`input[type="file"]#${id}`);
      if ((await loc.count()) === 0) return false;
      await loc.first().setInputFiles(filePath);
      return true;
    },
  };
}

const realLauncher: GreenhouseLauncher = async (url) => {
  const { page, close } = await launchSystemChrome(url);
  // Wait for the form's scripts to settle: typing earlier can be wiped when the
  // page finishes loading, and the invisible reCAPTCHA frame (which the scan
  // needs to see to know it is invisible) only appears late.
  await page.waitForSelector("#first_name", { timeout: 20_000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
  return { page: playwrightGreenhousePage(page), close };
};

// --- the driver --------------------------------------------------------------

export function greenhouseDriver(opts?: {
  launcher?: GreenhouseLauncher;
  /** Injectable for tests; defaults to the public job-board API. */
  loadForm?: (url: string) => Promise<GreenhouseForm>;
  /** Close the browser at the end instead of leaving it open for the user. */
  closeWhenDone?: boolean;
}): ApplyDriver {
  const launcher = opts?.launcher ?? realLauncher;
  const loadForm =
    opts?.loadForm ??
    (async (url: string) => {
      const ref = parseGreenhouseJobUrl(url);
      if (!ref) throw new Error("greenhouseDriver: not a hosted Greenhouse job URL");
      return fetchGreenhouseForm(ref);
    });
  const closeWhenDone = opts?.closeWhenDone ?? process.env.APPLY_HEADLESS === "1";

  let session: GreenhouseSession | null = null;
  let form: GreenhouseForm | null = null;
  let plan: GreenhousePlan | null = null;
  const missed: string[] = [];
  let resumeAttached = false;
  let finished = false;

  function requireSession(): GreenhouseSession {
    if (!session) throw new Error("greenhouseDriver: open() must be called before this step.");
    return session;
  }

  return {
    name: "greenhouse",

    async open(url) {
      form = await loadForm(url);
      session = await launcher(url);
    },

    async scan() {
      const raw = await requireSession().page.readRaw();
      return ignoreInvisibleRecaptcha(buildSignals(raw), raw);
    },

    async fill(fields: PreparedField[]) {
      const { page } = requireSession();
      if (!form) throw new Error("greenhouseDriver: form not loaded");
      plan = planGreenhouseFill(form, fields);
      for (const a of plan.actions) {
        if (a.kind === "file") continue; // attachResume handles the upload
        const ok =
          a.kind === "text" ? await page.fillText(a.id, a.value) : await page.chooseOption(a.id, a.option);
        if (!ok) missed.push(a.id);
      }
    },

    async attachResume(pdfPath: string) {
      const { page } = requireSession();
      if (!plan?.actions.some((a) => a.kind === "file" && a.id === "resume")) return false;
      resumeAttached = await page.attachFile("resume", pdfPath);
      return resumeAttached;
    },

    async submit(): Promise<SubmitResult> {
      if (finished) {
        throw new Error("greenhouseDriver: submit() called twice (no double-submit).");
      }
      finished = true;
      const unanswered = [...(plan?.unanswered ?? [])];
      if (!resumeAttached) unanswered.push("Resume/CV (attach it before submitting)");
      if (missed.length) unanswered.push(`Fields the page did not accept: ${missed.join(", ")}`);
      const filled = (plan?.actions.length ?? 0) - missed.length - (plan?.actions.some((a) => a.kind === "file") ? 1 : 0);
      return {
        outcome: "stopped_at_review",
        detail: `Greenhouse form filled (${filled} fields); left open for you to review and submit`,
        unanswered,
      };
    },

    async close() {
      if (!session) return;
      // After a hand-off the window stays open so the user can finish and submit.
      if (finished && !closeWhenDone) {
        session = null;
        return;
      }
      await session.close();
      session = null;
    },
  };
}
