/**
 * Jev browser loop on Playwright, ported from browser-use/jev-ultrafast
 * (agent.py + browser.py, commit 1231850, MIT; notice in ./snapshot.ts).
 *
 * Observe → Jev picks one operation + target → execute on the observed DOM
 * node (never a model-written selector) → observe again. Job OS additions:
 *   - Submit guard: a click whose label looks like submit/apply/send stops
 *     the run BEFORE the click. The user always submits.
 *   - Field text comes from `writeText` (local), and a field with no known
 *     value is skipped and shown to Jev as skipped.
 *   - `allFields`: offer off-screen form controls and scroll to them first.
 * SERVER-ONLY.
 */
import type { Page } from "playwright-core";
import { snapshotScript } from "@/lib/apply/jev/snapshot";
import {
  choose,
  type Decision,
  type HistoryItem,
  type Snapshot,
  type SnapshotAction,
} from "@/lib/apply/jev/policy";

export const SUBMIT_RE = /\b(submit|send application|apply now|finish|complete application)\b/i;
const MAX_STEPS = 60;

export interface TextRequest {
  goal: string;
  field: { label: string; role?: string; value?: string };
  pageText: string;
  recent: { action: string; text: string | null }[];
  /** Text of the question the control sits under (for Yes/No buttons, checkboxes). */
  question?: string;
}

/** Clicks that answer a question on the applicant's behalf. */
const CHOICE_ROLES = new Set(["checkbox", "radio", "switch", "option", "menuitemradio"]);
const YES_NO = /^(yes|no)$/i;

export interface JevRunOptions {
  apiKey: string;
  goal: string;
  /** Returns the value to type, or null when it is not known (field skipped). */
  writeText: (req: TextRequest) => Promise<string | null>;
  allFields?: boolean;
  redact?: boolean;
  maxMs?: number;
  fetchImpl?: typeof fetch;
}

export interface JevRunResult {
  outcome: "done" | "blocked" | "stopped_at_submit" | "stuck" | "timeout" | "error";
  error?: string;
  submitLabel?: string;
  steps: HistoryItem[];
  decisions: Omit<Decision, "usage">[];
  skipped: string[];
  jevMs: number;
  textMs: number;
  inputTokens: number;
  outputTokens: number;
  wallMs: number;
}

async function observe(page: Page, allFields: boolean, skippedNodes: Set<number>): Promise<Snapshot> {
  for (let i = 0; i < 10; i++) {
    const snap = (await page.evaluate(snapshotScript(allFields)).catch(() => null)) as Snapshot | null;
    if (snap) {
      // A field we have no answer for is taken off the table, so Jev can't pick it again.
      snap.actions = snap.actions.filter((a) => a.node === undefined || !skippedNodes.has(a.node) || a.kind === "select");
      return snap;
    }
    await page.waitForTimeout(50);
  }
  throw new Error("Page did not settle");
}

/** The question text a control sits under: the nearest ancestor that says more than the control does. */
async function questionText(page: Page, node: number): Promise<string> {
  return page.evaluate((n) => {
    const w = window as unknown as { __jevFast?: { nodes: Map<number, HTMLElement> } };
    const e = w.__jevFast?.nodes.get(n);
    if (!e) return "";
    const own = (e.innerText || e.getAttribute("aria-label") || "").trim();
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
      const t = (a.innerText || "").trim();
      if (t.length > own.length + 8) return t.slice(0, 400);
    }
    return own;
  }, node);
}

/** Resolve the observed node to a clickable point (scrolling it into view first). */
async function locate(page: Page, action: SnapshotAction): Promise<{ x: number; y: number } | null> {
  return page.evaluate(
    ({ node, kind, value }) => {
      const w = window as unknown as { __jevFast?: { nodes: Map<number, HTMLElement> } };
      const e = w.__jevFast?.nodes.get(node) as (HTMLElement & { readOnly?: boolean; value?: string }) | undefined;
      if (!e?.isConnected || e.matches(":disabled")) return null;
      // "instant" overrides CSS smooth scrolling, so the hit-test below sees the final position.
      e.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      if (!e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return null;
      if (kind === "fill" && (e.readOnly || e.getAttribute("aria-readonly") === "true")) return null;
      const r = e.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      if (!r.width || !r.height || x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return null;
      if (!e.contains(document.elementFromPoint(x, y))) return null;
      if (kind === "select") {
        const s = e as unknown as HTMLSelectElement;
        if (s.tagName !== "SELECT" || ![...s.options].some((o) => o.value === value && !o.disabled)) return null;
        s.value = value ?? "";
        s.dispatchEvent(new Event("input", { bubbles: true }));
        s.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return { x, y };
    },
    { node: action.node!, kind: action.kind, value: action.value },
  );
}

async function execute(page: Page, action: SnapshotAction, text: string | null): Promise<boolean> {
  if (action.kind === "wait") {
    await page.waitForTimeout(100);
    return true;
  }
  if (action.kind === "scroll") {
    await page.mouse.wheel(0, action.delta ?? 560);
    return true;
  }
  const point = await locate(page, action);
  if (!point) return false;
  if (action.kind === "select") return true;
  await page.mouse.click(point.x, point.y);
  if (action.kind === "fill") {
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await page.keyboard.insertText(text ?? "");
  }
  // Let menus and autocomplete render (the harness waits up to 200 ms).
  await page.waitForTimeout(action.role === "combobox" ? 200 : 50);
  return true;
}

export async function runJev(page: Page, opts: JevRunOptions): Promise<JevRunResult> {
  const allFields = opts.allFields ?? true;
  const redact = opts.redact ?? true;
  const maxMs = opts.maxMs ?? 300_000;
  const started = performance.now();
  const history: HistoryItem[] = [];
  const decisions: JevRunResult["decisions"] = [];
  const skipped: string[] = [];
  let jevMs = 0;
  let textMs = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let outcome: JevRunResult["outcome"] | null = null;
  let error: string | undefined;
  let submitLabel: string | undefined;
  const skippedNodes = new Set<number>();
  const failures = new Map<number, number>();
  let lastTyped: string | null = null;

  try {
    let snap = await observe(page, allFields, skippedNodes);
    while (!outcome) {
      if (performance.now() - started > maxMs) {
        outcome = "timeout";
        break;
      }
      if (decisions.length >= MAX_STEPS * 2 || history.length >= MAX_STEPS) {
        outcome = "stuck";
        break;
      }
      const d = await choose(snap, opts.goal, history, {
        apiKey: opts.apiKey,
        redact,
        fetchImpl: opts.fetchImpl,
      });
      jevMs += d.latencyMs;
      inputTokens += d.usage.input_tokens ?? 0;
      outputTokens += d.usage.output_tokens ?? 0;
      decisions.push({
        choice: d.choice,
        operation: d.operation,
        target: d.target,
        confidence: d.confidence,
        probability: d.probability,
        latencyMs: d.latencyMs,
      });

      if (d.choice === "DONE" || d.choice === "BLOCKED") {
        outcome = d.choice === "DONE" ? "done" : "blocked";
        break;
      }
      const action = snap.actions.find((a) => a.id === d.choice);
      if (!action) throw new Error(`Jev chose an unknown element ${d.choice}`);

      // A button with no readable label: we can't tell what it does, so don't press it.
      if (action.kind === "click" && action.node !== undefined && (!action.label.trim() || action.label.trim() === action.role)) {
        skipped.push("click: unlabeled control");
        skippedNodes.add(action.node);
        history.push({ action: action.label, kind: "click", text: "(skipped: control has no label)", page_changed: false });
        snap = await observe(page, allFields, skippedNodes);
        continue;
      }

      if (action.kind === "click" && SUBMIT_RE.test(action.label)) {
        outcome = "stopped_at_submit";
        submitLabel = action.label;
        break;
      }

      // A click that picks an answer (Yes/No button, checkbox, radio, dropdown option)
      // must match a saved answer. A dropdown option right after typing that same
      // answer is fine; anything else is checked against the question it sits under.
      const answering =
        action.kind === "click" && action.node !== undefined &&
        (CHOICE_ROLES.has(action.role ?? "") || YES_NO.test(action.label.trim()));
      if (answering) {
        const typedMatch = lastTyped !== null && action.label.trim().toLowerCase().startsWith(lastTyped.trim().toLowerCase());
        let allowed = typedMatch;
        if (!allowed) {
          const q = await questionText(page, action.node!);
          const t = performance.now();
          const value = await opts.writeText({
            goal: opts.goal,
            field: { label: q || action.label, role: action.role },
            pageText: snap.text.slice(0, 6000),
            recent: history.slice(-6).map((h) => ({ action: h.action, text: h.text })),
            question: q,
          });
          textMs += performance.now() - t;
          allowed = value !== null && value.trim().toLowerCase() === action.label.trim().toLowerCase();
        }
        if (!allowed) {
          skipped.push(`click: ${action.label}`);
          skippedNodes.add(action.node!);
          history.push({ action: action.label, kind: "click", text: "(skipped: not one of the applicant's answers)", page_changed: false });
          snap = await observe(page, allFields, skippedNodes);
          continue;
        }
      }

      let text: string | null = null;
      if (action.kind === "fill") {
        const t = performance.now();
        text = await opts.writeText({
          goal: opts.goal,
          field: { label: action.label, role: action.role, value: action.value },
          pageText: snap.text.slice(0, 6000),
          recent: history.slice(-6).map((h) => ({ action: h.action, text: h.text })),
        });
        textMs += performance.now() - t;
        if (!text) {
          skipped.push(action.label);
          if (action.node !== undefined) skippedNodes.add(action.node);
          history.push({ action: action.label, kind: "fill", text: "(skipped: no value for this field)", page_changed: false });
          snap = await observe(page, allFields, skippedNodes);
          continue;
        }
      }

      const before = JSON.stringify(snap.marker);
      const ok = await execute(page, action, text);
      if (!ok && action.node !== undefined) {
        // Target moved or is covered (often by another field's suggestion list).
        // Close pop-ups; after two misses, give the field back to the user.
        const n = (failures.get(action.node) ?? 0) + 1;
        failures.set(action.node, n);
        await page.keyboard.press("Escape").catch(() => undefined);
        if (n >= 2) {
          skipped.push(`unreachable: ${action.label}`);
          skippedNodes.add(action.node);
        }
      }
      snap = await observe(page, allFields, skippedNodes);
      const changed = JSON.stringify(snap.marker) !== before;
      if (!ok) continue;
      lastTyped = action.kind === "fill" ? text : null;
      history.push({ action: action.label, kind: action.kind, text, page_changed: changed });
      const last3 = history.slice(-3);
      if (last3.length === 3 && last3.every((h) => h.page_changed === false && h.kind !== "wait")) {
        outcome = "stuck";
      }
    }
  } catch (err) {
    outcome = "error";
    error = err instanceof Error ? err.message : String(err);
  }

  return {
    outcome: outcome ?? "error",
    error,
    submitLabel,
    steps: history,
    decisions,
    skipped,
    jevMs,
    textMs: Math.round(textMs),
    inputTokens,
    outputTokens,
    wallMs: Math.round(performance.now() - started),
  };
}
