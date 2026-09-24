import "./lib/use-test-database";
/**
 * "Human, please take over" gate (test database, fake browser).
 *
 *   A. Pure: which human step a page needs, and the plain-English instruction.
 *   B. Blocking step (login wall): the run pauses, the window stays open,
 *      Continue after the user signs in carries on in the same window.
 *   C. Still blocked on Continue: stays paused, window still held.
 *   D. "I am human" checkbox beside a fillable form: no pause; filled and
 *      handed off with a note to tick it before submitting.
 *   E. Window gone (restart/expiry): Continue hands the application back.
 *
 * Run: npx tsx scripts/test-apply-human.ts
 */
process.env.JOBOS_DESKTOP_NOTIFY = "0";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { approveAndSubmit, continueAfterHuman } from "@/lib/apply/service";
import { classifyHumanStep, humanInstruction, isHeld, release, BEFORE_SUBMIT_NOTE } from "@/lib/apply/human-gate";
import { scanPage } from "@/lib/apply/detection";
import { nextState } from "@/lib/apply/state-machine";
import type { ApplyDriver, PageSignals, PreparedField, SubmitResult } from "@/lib/apply/types";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

const clean: PageSignals = { url: "https://x.example/apply", host: "x.example", markers: [], hasLoginForm: false, hasCaptcha: false, formFields: 8 };
const login: PageSignals = { ...clean, hasLoginForm: true, formFields: 2 };
const checkbox: PageSignals = { ...clean, markers: ["hcaptcha"], hasCaptcha: true, formFields: 8 };
const cloudflare: PageSignals = { ...clean, markers: ["cf-challenge"], hasCaptcha: true, formFields: 0 };
const bareCaptcha: PageSignals = { ...clean, markers: ["hcaptcha"], hasCaptcha: true, formFields: 0 };

/** Fake driver: returns the given scans in order; records fill/submit/close/focus. */
function fakeDriver(scans: PageSignals[]) {
  const calls = { scans: 0, filled: 0, submitted: 0, closed: 0, focused: 0 };
  const driver: ApplyDriver = {
    name: "fake",
    async open() {},
    async scan() {
      const s = scans[Math.min(calls.scans, scans.length - 1)]!;
      calls.scans++;
      return s;
    },
    async fill() {
      calls.filled++;
    },
    async submit(): Promise<SubmitResult> {
      calls.submitted++;
      return { outcome: "stopped_at_review", detail: "fake: filled", unanswered: ["Why us?"] };
    },
    async focus() {
      calls.focused++;
    },
    async close() {
      calls.closed++;
    },
  };
  return { driver, calls };
}

async function main() {
  console.log("\nA. Pure:");
  check("clean page needs nobody", classifyHumanStep(clean, scanPage(clean)) === "none");
  check("login wall is blocking", classifyHumanStep(login, scanPage(login)) === "blocking");
  check("Cloudflare check is blocking", classifyHumanStep(cloudflare, scanPage(cloudflare)) === "blocking");
  check("checkbox beside a fillable form waits for submit", classifyHumanStep(checkbox, scanPage(checkbox)) === "before_submit");
  check("a check with no form behind it is blocking", classifyHumanStep(bareCaptcha, scanPage(bareCaptcha)) === "blocking");
  check("login instruction says sign in", humanInstruction(scanPage(login)).startsWith("Sign in"));
  check("state machine: PAUSED continues to SUBMITTING", nextState("PAUSED", "CONTINUE_SUBMIT") === "SUBMITTING");

  const tag = randomUUID().slice(0, 8);
  const user = await db.user.create({ data: { email: `human-${tag}@test.local` } });
  const profile = await db.profile.create({ data: { userId: user.id, name: "human test" } });
  const scope = { userId: user.id, profileId: profile.id };
  const field: PreparedField = { key: "email", label: "Email", value: "a@b.test", source: "profile", confidence: 1, critical: false, freeText: false };
  async function newApp(n: string) {
    const job = await db.job.create({
      data: { ...scope, identityHash: `human-${tag}-${n}`, source: "test", company: `Co ${n}`, title: "Engineer", url: "https://x.example/apply" },
    });
    return db.application.create({
      data: { ...scope, jobId: job.id, applyState: "REVIEW", preparedFields: [field] as unknown as object },
    });
  }
  const stateOf = async (id: string) => (await db.application.findUniqueOrThrow({ where: { id } })).applyState;
  const eventTypes = async (id: string) =>
    (await db.applicationEvent.findMany({ where: { applicationId: id }, orderBy: { createdAt: "asc" } })).map((e) => e.type);

  try {
    console.log("\nB. Blocking step, then Continue:");
    const b = await newApp("b");
    const fb = fakeDriver([login, clean]);
    const r1 = await approveAndSubmit(scope, b.id, { driver: fb.driver });
    check("run pauses instead of failing", r1.state === "PAUSED" && (await stateOf(b.id)) === "PAUSED");
    check("nothing was filled yet", fb.calls.filled === 0);
    check("browser window left open and brought to front", fb.calls.closed === 0 && fb.calls.focused === 1);
    check("paused run is held for Continue", isHeld(b.id));
    check("a paused_for_human event says what to do", (await eventTypes(b.id)).includes("paused_for_human"));
    const r2 = await continueAfterHuman(scope, b.id);
    check("Continue carries on and hands off for review", r2.state === "HANDOFF" && (await stateOf(b.id)) === "HANDOFF");
    check("same window: filled once, re-scanned, not reopened", fb.calls.filled === 1 && fb.calls.scans === 2);
    check("never counted as applied", (await db.application.findUniqueOrThrow({ where: { id: b.id } })).status !== "APPLIED");
    check("events record the human step", (await eventTypes(b.id)).join() === "paused_for_human,human_step_done,stopped_at_review");

    console.log("\nC. Still blocked on Continue:");
    const c = await newApp("c");
    const fc = fakeDriver([login, login]);
    await approveAndSubmit(scope, c.id, { driver: fc.driver });
    const rc = await continueAfterHuman(scope, c.id);
    check("stays paused with a 'still waiting' message", rc.state === "PAUSED" && (rc.message ?? "").startsWith("Still waiting"));
    check("window still held, nothing filled", isHeld(c.id) && fc.calls.filled === 0 && fc.calls.closed === 0);
    release(c.id);

    console.log("\nD. Checkbox beside the form:");
    const d = await newApp("d");
    const fd = fakeDriver([checkbox]);
    const rd = await approveAndSubmit(scope, d.id, { driver: fd.driver });
    check("no pause: filled and handed off", rd.state === "HANDOFF" && fd.calls.filled === 1);
    const ev = await db.applicationEvent.findFirstOrThrow({ where: { applicationId: d.id, type: "stopped_at_review" } });
    const detail = ev.detail as { unanswered?: string[]; humanBeforeSubmit?: boolean };
    check("hand-off tells the user to tick the box", (detail.unanswered ?? []).includes(BEFORE_SUBMIT_NOTE) && detail.humanBeforeSubmit === true);

    console.log("\nE. Window gone:");
    const e = await newApp("e");
    const fe = fakeDriver([login]);
    await approveAndSubmit(scope, e.id, { driver: fe.driver });
    release(e.id); // as after a restart
    const re = await continueAfterHuman(scope, e.id);
    check("Continue hands the application back", re.state === "HANDOFF" && (await stateOf(e.id)) === "HANDOFF");
    check("with a plain explanation", (re.message ?? "").includes("back with you"));
    check("and a pause_expired event so the pop-up says the window closed", (await eventTypes(e.id)).includes("pause_expired"));

    const notPaused = await continueAfterHuman(scope, d.id);
    check("Continue on an application not waiting is refused", !notPaused.ok && notPaused.state === "HANDOFF");
  } finally {
    await db.user.delete({ where: { id: user.id } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
