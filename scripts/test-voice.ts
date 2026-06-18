/**
 * Self-test for Phase 13 (Cartesia + Pipecat low-cost voice). THIS IS THE
 * test:voice gate. Pure + offline:
 *   A. selectVoiceProvider - preference handling + fallback across what's
 *      configured, and the safe default (prefer ElevenLabs, then Cartesia, then
 *      the zero-cost fixture mock).
 *   B. Cartesia source - unconfigured ⇒ empty grant (fixture fallback), never
 *      throws, STUDY has no voice, key/runner details stay server-side.
 * Run: npx tsx scripts/test-voice.ts
 */
import { selectVoiceProvider } from "@/lib/interview/index";
import {
  cartesiaVoiceConfigured,
  cartesiaVoiceSource,
} from "@/lib/interview/voice-cartesia";
import type { AgentPersona } from "@/lib/interview/types";

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

const persona: AgentPersona = {
  mode: "AI_SCREEN",
  name: "Automated screener",
  style: "robotic, structured",
  systemPrompt: "You are an automated screener.",
  opener: "Hello, let's begin.",
  agentIdEnv: "ELEVENLABS_AGENT_AI_SCREEN",
  warmth: 0.2,
};

async function main(): Promise<void> {
  // =========================================================================
  // A. PROVIDER SELECTION (pure)
  // =========================================================================
  console.log("\nvoice - provider selection:");
  check("nothing configured → fixture", selectVoiceProvider({ elevenOk: false, localOk: false }) === "fixture");
  check("eleven only → elevenlabs", selectVoiceProvider({ elevenOk: true, localOk: false }) === "elevenlabs");
  check("local only → local", selectVoiceProvider({ elevenOk: false, localOk: true }) === "local");
  check("both, no preference → elevenlabs (default realism)", selectVoiceProvider({ elevenOk: true, localOk: true }) === "elevenlabs");
  check("pref local + localOk → local (OSS path)", selectVoiceProvider({ preference: "local", elevenOk: true, localOk: true }) === "local");
  check("pref local but only eleven → elevenlabs (fallback)", selectVoiceProvider({ preference: "local", elevenOk: true, localOk: false }) === "elevenlabs");
  check("pref local + nothing → fixture", selectVoiceProvider({ preference: "local", elevenOk: false, localOk: false }) === "fixture");
  check("pref elevenlabs but only local → local (fallback)", selectVoiceProvider({ preference: "elevenlabs", elevenOk: false, localOk: true }) === "local");
  check("preference is case-insensitive", selectVoiceProvider({ preference: "LOCAL", elevenOk: false, localOk: true }) === "local");

  // =========================================================================
  // B. CARTESIA SOURCE (unconfigured → safe fallback)
  // =========================================================================
  console.log("\nvoice - cartesia source (unconfigured):");
  const prev = process.env.PIPECAT_CONNECT_URL;
  delete process.env.PIPECAT_CONNECT_URL;

  check("not configured without PIPECAT_CONNECT_URL", cartesiaVoiceConfigured() === false);

  const src = cartesiaVoiceSource();
  check("source identifies as cartesia + live", src.id === "cartesia" && src.isLive === true);

  const g1 = await src.grant("AI_SCREEN", persona, 600);
  check("unconfigured grant → empty signedUrl (fixture fallback)", g1.signedUrl === "" && g1.provider === "cartesia" && g1.grantedSec === 600);

  const g2 = await src.grant("STUDY", persona, 600);
  check("STUDY mode → no voice grant", g2.signedUrl === "");

  if (prev === undefined) delete process.env.PIPECAT_CONNECT_URL;
  else process.env.PIPECAT_CONNECT_URL = prev;

  console.log(`\nvoice ${passed}/${passed + failed}\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
