/**
 * Human gate: where an apply run needs a person, and how it waits for one.
 *
 * Two kinds of human step:
 *   - "before_submit": a "prove you're human" checkbox sits next to a form the
 *     app can fill. The app fills everything and the hand-off tells the user to
 *     tick it and submit. The app never touches the checkbox.
 *   - "blocking": a login wall, security interstitial, 2FA code, or a check with
 *     no form behind it. The run pauses with the browser window left open, the
 *     user is asked to take over, and Continue carries on in that same window.
 *
 * Paused runs are held in memory. `npm run jobos` is one long-lived process,
 * so a held window survives until Continue or expiry; a dev-server hot reload
 * can drop it, and Continue then falls back to preparing the application again.
 * Only one paused window at a time is expected: the automation Chrome profile
 * can be open once.
 */
import type { ApplyDriver, DetectionResult, PageSignals, PreparedField } from "@/lib/apply/types";
import type { AppScope } from "@/lib/profiles/types";

export type HumanStep = "none" | "before_submit" | "blocking";

const CHECKBOX_CAPTCHAS = new Set(["reCAPTCHA detected", "hCaptcha detected", "CAPTCHA detected"]);

/** Fewer fields than this and the page is not a form we can fill around a check. */
const MIN_FORM_FIELDS = 3;

/** Which kind of human step the live scan shows. PURE. */
export function classifyHumanStep(signals: PageSignals, detection: DetectionResult): HumanStep {
  if (detection.clean) return "none";
  const onlyCheckbox = detection.signals.every((s) => CHECKBOX_CAPTCHAS.has(s));
  if (onlyCheckbox && !signals.hasLoginForm && (signals.formFields ?? 0) >= MIN_FORM_FIELDS) {
    return "before_submit";
  }
  return "blocking";
}

/** What the person needs to do, in plain words. PURE. */
export function humanInstruction(detection: DetectionResult): string {
  const s = detection.signals.join(" ").toLowerCase();
  if (s.includes("login")) return "Sign in on the employer's site in the browser window.";
  if (s.includes("2fa") || s.includes("otp")) return "Enter the verification code in the browser window.";
  if (s.includes("cloudflare")) return "Complete the security check in the browser window.";
  if (s.includes("captcha")) return "Complete the \"I am human\" check in the browser window.";
  if (s.includes("bot")) return "The site flagged automation. Check the page in the browser window.";
  return "The page needs you. Check the browser window.";
}

export const BEFORE_SUBMIT_NOTE = "Tick the \"I am human\" box on the form, then submit.";

// --- held sessions -------------------------------------------------------------

export const PAUSE_EXPIRY_MS = 30 * 60 * 1000;

export interface HeldRun {
  scope: AppScope;
  driver: ApplyDriver;
  fields: PreparedField[];
  instruction: string;
  heldAt: number;
}

interface Entry extends HeldRun {
  timer: ReturnType<typeof setTimeout>;
}

// On globalThis so every module copy in the server process shares one table.
const g = globalThis as unknown as { __jobosHeldRuns?: Map<string, Entry> };
const held = (g.__jobosHeldRuns ??= new Map<string, Entry>());

/** Keep a paused run's driver (and its open window) until Continue or expiry. */
export function holdRun(
  applicationId: string,
  run: Omit<HeldRun, "heldAt">,
  onExpire: (run: HeldRun) => Promise<void>,
  ms = PAUSE_EXPIRY_MS,
): void {
  release(applicationId);
  const timer = setTimeout(() => {
    const entry = held.get(applicationId);
    if (!entry) return;
    held.delete(applicationId);
    void onExpire(entry).catch(() => undefined);
  }, ms);
  // Never keep a CLI or test process alive just for this timer.
  timer.unref?.();
  held.set(applicationId, { ...run, heldAt: Date.now(), timer });
}

/** Take a held run for Continue. Returns null when none is held (expired or restarted). */
export function takeRun(applicationId: string): HeldRun | null {
  const entry = held.get(applicationId);
  if (!entry) return null;
  clearTimeout(entry.timer);
  held.delete(applicationId);
  return { scope: entry.scope, driver: entry.driver, fields: entry.fields, instruction: entry.instruction, heldAt: entry.heldAt };
}

/** Drop a held run without closing its window. */
export function release(applicationId: string): void {
  const entry = held.get(applicationId);
  if (entry) clearTimeout(entry.timer);
  held.delete(applicationId);
}

export function isHeld(applicationId: string): boolean {
  return held.has(applicationId);
}

export function heldInstruction(applicationId: string): string | null {
  return held.get(applicationId)?.instruction ?? null;
}
