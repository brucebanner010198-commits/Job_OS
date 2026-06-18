/**
 * Self-test for the interview persona BRAIN (Phase 8, plan §5, Hardening §B).
 * THIS IS THE test:interview-persona gate. Pure, offline, deterministic: built
 * from the fixture prep only, no clock / DB / network / LLM.
 * Run: npx tsx scripts/test-interview-persona.ts
 */
import { buildPersona, buildPersonas } from "@/lib/interview/persona";
import { fixturePrep } from "@/lib/interview/fixtures";
import type { AgentPersona, InterviewMode } from "@/lib/interview/types";

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

/** The fixture sensitive fact text - must NEVER appear in any persona field. */
const SENSITIVE_TEXT = "chronic health condition";

/** Every string field of a persona, concatenated, for leak scanning. */
function allText(p: AgentPersona): string {
  return [p.mode, p.name, p.style, p.systemPrompt, p.opener, p.agentIdEnv].join(
    "\n",
  );
}

const ai = buildPersona("AI_SCREEN", fixturePrep);
const hr = buildPersona("REAL_HR", fixturePrep);

// --- 1. The two live personas are genuinely DISTINCT (no bleed) --------------

console.log("\npersona - AI_SCREEN and REAL_HR are distinct:");
check("different warmth", ai.warmth !== hr.warmth);
check("different agentIdEnv", ai.agentIdEnv !== hr.agentIdEnv);
check("different name", ai.name !== hr.name);
check("different opener", ai.opener !== hr.opener);
check("different systemPrompt", ai.systemPrompt !== hr.systemPrompt);

// --- 2. Warmth ordering: REAL_HR is warmer than AI_SCREEN --------------------

console.log("\npersona - warmth ordering:");
check("REAL_HR.warmth > AI_SCREEN.warmth", hr.warmth > ai.warmth);

// --- 3. Each live persona binds to its OWN agent-id env ----------------------

console.log("\npersona - correct agent-id binding:");
check(
  "AI_SCREEN → ELEVENLABS_AGENT_AI_SCREEN",
  ai.agentIdEnv === "ELEVENLABS_AGENT_AI_SCREEN",
);
check(
  "REAL_HR → ELEVENLABS_AGENT_REAL_HR",
  hr.agentIdEnv === "ELEVENLABS_AGENT_REAL_HR",
);

// --- 4. Each live systemPrompt is grounded in company AND role ---------------

console.log("\npersona - live system prompts are grounded:");
for (const p of [ai, hr]) {
  check(
    `${p.mode}: systemPrompt mentions company "${fixturePrep.company}"`,
    p.systemPrompt.includes(fixturePrep.company),
  );
  check(
    `${p.mode}: systemPrompt mentions role "${fixturePrep.role}"`,
    p.systemPrompt.includes(fixturePrep.role ?? ""),
  );
}

// --- 5. The sensitive fact NEVER leaks into any field ------------------------

console.log("\npersona - sensitive fact never leaks:");
for (const p of [ai, hr]) {
  check(
    `${p.mode}: no "${SENSITIVE_TEXT}" anywhere`,
    !allText(p).includes(SENSITIVE_TEXT),
  );
}

// --- 6. buildPersonas returns exactly the two LIVE personas ------------------

console.log("\npersona - buildPersonas covers exactly the live modes:");
const live = buildPersonas(fixturePrep);
check("buildPersonas length === 2", live.length === 2);
const modes = live.map((p) => p.mode).sort();
check(
  "buildPersonas modes === [AI_SCREEN, REAL_HR]",
  modes.length === 2 && modes[0] === "AI_SCREEN" && modes[1] === "REAL_HR",
);
check(
  "buildPersonas excludes STUDY",
  !live.some((p) => p.mode === "STUDY"),
);
check(
  "buildPersonas personas are sensitive-clean",
  live.every((p) => !allText(p).includes(SENSITIVE_TEXT)),
);

// --- 7. STUDY is TOTAL - buildPersona never throws ---------------------------

console.log("\npersona - STUDY is total (never throws):");
let studyOk = true;
let study: AgentPersona | undefined;
try {
  study = buildPersona("STUDY" as InterviewMode, fixturePrep);
} catch {
  studyOk = false;
}
check("buildPersona('STUDY', prep) returns without throwing", studyOk);
check("STUDY persona is defined", study !== undefined);
check("STUDY warmth is 0 (non-voice)", study?.warmth === 0);
check(
  "STUDY systemPrompt is sensitive-clean",
  study !== undefined && !allText(study).includes(SENSITIVE_TEXT),
);

// --- Summary -----------------------------------------------------------------

console.log(`\npersona ${passed}/${passed + failed}\n`);
if (failed > 0) process.exit(1);
