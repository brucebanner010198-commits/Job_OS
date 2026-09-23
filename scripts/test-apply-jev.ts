/**
 * Jev port gate: offline, no network, no browser.
 *   A. Redaction: typed values reach Jev only as "(filled)"/"(empty)".
 *   B. Request/response handling with a fake TypeSafe endpoint.
 *   C. Submit guard pattern.
 * Run: npx tsx scripts/test-apply-jev.ts
 */
import { actionSpace, choose, shownValue, type Snapshot } from "@/lib/apply/jev/policy";
import { SUBMIT_RE } from "@/lib/apply/jev/runner";
import { snapshotScript } from "@/lib/apply/jev/snapshot";

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

const SNAP: Snapshot = {
  url: "https://job-boards.greenhouse.io/x/jobs/1",
  title: "Apply",
  text: "First Name Email",
  marker: 1,
  page_key: 1,
  guards: {},
  actions: [
    { id: "e1", kind: "fill", node: 1, role: "textbox", label: "First Name", value: "Ada" },
    { id: "e2", kind: "click", node: 1, role: "textbox", label: "Open First Name", value: "Ada" },
    { id: "e3", kind: "fill", node: 2, role: "textbox", label: "Email", value: "" },
    { id: "e4", kind: "select", node: 3, role: "combobox", label: "Country → Canada", value: "CA", current_value: "United States" },
    { id: "e5", kind: "click", node: 4, role: "button", label: "Submit application" },
    { id: "wait", kind: "wait", label: "Wait for the page to update" },
  ],
};

async function main(): Promise<void> {
  console.log("\nA. Redaction:");
  check("filled value hidden", shownValue("Ada", true) === "(filled)");
  check("empty value marked empty", shownValue("  ", true) === "(empty)");
  check("no redaction passes value through", shownValue("Ada", false) === "Ada");
  const { elements, targets } = actionSpace(SNAP.actions, true);
  check("element value redacted", elements[0]!.value === "(filled)" && elements[1]!.value === "(empty)");
  check("dropdown keeps the form's own option text", elements[2]!.value === "United States");
  check("TYPE_TEXT targets are the two text fields", Object.keys(targets.TYPE_TEXT!).join() === "1,2");
  check("SELECT target is indexed element:option", Object.keys(targets.SELECT!).join() === "3:1");

  console.log("\nB. Request handling:");
  let sent = "";
  const fakeFetch = (async (_url: string, init: RequestInit) => {
    sent = String(init.body);
    const body = JSON.parse(sent) as { questions: Record<string, { criteria: Record<string, unknown> }> };
    const ops = Object.keys(body.questions.operation!.criteria);
    const typeTargets = Object.keys(body.questions.type_text_target!.criteria);
    const uniform = (ids: string[], pick: string) => ({
      choice: pick,
      confidence: 0.9,
      probabilities: Object.fromEntries(ids.map((id) => [id, id === pick ? 1 : 0])),
    });
    return new Response(
      JSON.stringify({
        answers: { operation: uniform(ops, "TYPE_TEXT"), type_text_target: uniform(typeTargets, "2") },
        usage: { input_tokens: 10, output_tokens: 2 },
      }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
  const d = await choose(SNAP, "fill email", [{ action: "First Name", kind: "fill", text: "Ada", page_changed: true }], {
    apiKey: "test",
    redact: true,
    fetchImpl: fakeFetch,
  });
  check("decision maps target 2 to element e3", d.operation === "TYPE_TEXT" && d.choice === "e3");
  check("the typed name never appears in the request", !sent.includes("Ada"));
  check("history text is redacted too", sent.includes('"text":"(filled)"'));

  const badFetch = (async () =>
    new Response(JSON.stringify({ answers: { operation: { choice: "HACK", confidence: 1, probabilities: { HACK: 1 } } } }), {
      status: 200,
    })) as unknown as typeof fetch;
  let threw = false;
  try {
    await choose(SNAP, "x", [], { apiKey: "t", redact: true, fetchImpl: badFetch });
  } catch {
    threw = true;
  }
  check("an invalid Jev answer executes nothing (throws)", threw);

  console.log("\nC. Submit guard and snapshot:");
  for (const label of ["Submit application", "Submit", "Apply now", "Send application"]) {
    check(`guard stops "${label}"`, SUBMIT_RE.test(label));
  }
  for (const label of ["Apply", "Apply for this job", "Attach", "Country"]) {
    check(`guard allows "${label}" (opens or edits the form)`, !SUBMIT_RE.test(label));
  }
  check("all-fields snapshot differs from original", snapshotScript(true) !== snapshotScript(false));
  let parses = true;
  try {
    // Syntax check only: the body is our own bundled constant and is never called.
    new Function(`return ${snapshotScript(true)}`);
  } catch {
    parses = false;
  }
  check("patched snapshot is valid JavaScript", parses);

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
