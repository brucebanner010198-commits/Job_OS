/**
 * Privacy routing gate (no network, no DB).
 *
 * Proves:
 *   1. Private mode never routes to the cloud, even with keys and consent.
 *   2. Enhanced mode without consent stays local.
 *   3. Enhanced mode sends only consented tasks, and scrubs contact details
 *      unless the task is resume import.
 *   4. Local-only tasks (Gmail classification) never leave the machine.
 *   5. Untagged calls stay local.
 *   6. Local base URLs normalise to the server root.
 *   7. Local model choice prefers the user's pick, then the preferred list,
 *      and never picks an embedding model.
 *
 * Run: npx tsx scripts/test-ai-routing.ts
 */
import { decideRoute, type CloudProvider } from "@/lib/ai/routing";
import { normalizeLocalBaseUrl, type AiSettings, CLOUD_CONSENT_VERSION } from "@/lib/ai/settings";
import { pickLocalModel } from "@/lib/ai/local";
import type { TaskName } from "@/lib/ai/models";

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

const allCloud = new Set<CloudProvider>(["gemini", "openrouter"]);
const consent = {
  version: CLOUD_CONSENT_VERSION,
  grantedAt: "2026-09-23T00:00:00Z",
  tasks: ["tailorResume", "parseResume", "classifyEmail"] as TaskName[],
};
const base: AiSettings = { mode: "private", consent: null, localBaseUrl: "http://127.0.0.1:11434" };

console.log("routing");
check(
  "private mode stays local even with consent and keys",
  decideRoute({ settings: { ...base, consent }, task: "tailorResume", availableCloud: allCloud }).kind === "local",
);
check(
  "enhanced without consent stays local",
  decideRoute({ settings: { ...base, mode: "enhanced" }, task: "tailorResume", availableCloud: allCloud }).kind ===
    "local",
);

const enhanced: AiSettings = { ...base, mode: "enhanced", consent };
const tailor = decideRoute({ settings: enhanced, task: "tailorResume", availableCloud: allCloud });
check("consented task goes to cloud", tailor.kind === "cloud");
check("gemini preferred when available", tailor.kind === "cloud" && tailor.provider === "gemini");
check("non-contact task is redacted", tailor.kind === "cloud" && tailor.redact);

const parse = decideRoute({ settings: enhanced, task: "parseResume", availableCloud: allCloud });
check("resume import is not redacted", parse.kind === "cloud" && !parse.redact);

check(
  "unconsented task stays local",
  decideRoute({ settings: enhanced, task: "coverLetter", availableCloud: allCloud }).kind === "local",
);
check(
  "gmail classification never leaves, even if consented",
  decideRoute({ settings: enhanced, task: "classifyEmail", availableCloud: allCloud }).kind === "local",
);
check("untagged call stays local", decideRoute({ settings: enhanced, availableCloud: allCloud }).kind === "local");
check(
  "no cloud keys means local",
  decideRoute({ settings: enhanced, task: "tailorResume", availableCloud: new Set() }).kind === "local",
);
check(
  "explicit ollama request stays local",
  decideRoute({ settings: enhanced, task: "tailorResume", availableCloud: allCloud, requested: "ollama" }).kind ===
    "local",
);

console.log("local endpoint");
check("empty → default", normalizeLocalBaseUrl(undefined) === "http://127.0.0.1:11434");
check("strips /v1 and pins localhost to IPv4", normalizeLocalBaseUrl("http://localhost:11434/v1") === "http://127.0.0.1:11434");
check("strips trailing slash", normalizeLocalBaseUrl("http://ollama.lan:11434/") === "http://ollama.lan:11434");
check("adds scheme", normalizeLocalBaseUrl("127.0.0.1:11434") === "http://127.0.0.1:11434");

console.log("local model choice");
const installed = ["nomic-embed-text:latest", "llama3.2:3b", "qwen3.5:9b", "gemma4:12b"];
check("configured model wins when installed", pickLocalModel(installed, "llama3.2:3b") === "llama3.2:3b");
check("configured name without tag matches :latest", pickLocalModel(["foo:latest"], "foo") === "foo:latest");
check("missing configured model falls back to preferred", pickLocalModel(installed, "llama3.2") === "gemma4:12b");
check("never picks an embedding model", pickLocalModel(["nomic-embed-text:latest"]) === null);
check("any chat model as last resort", pickLocalModel(["nomic-embed-text:latest", "phi4:14b"]) === "phi4:14b");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
