/**
 * Voice provider benchmark - measures fallback chain selection latency.
 * Run: npm run benchmark:voice
 */
import { selectVoiceProvider } from "@/lib/interview/index";
import {
  localVoiceConfigured,
  localVoiceSource,
} from "@/lib/interview/voice-local";
import {
  liveVoiceConfigured,
  liveVoiceEnabled,
} from "@/lib/interview/voice-live";

async function main(): Promise<void> {
  const start = performance.now();
  const provider = selectVoiceProvider({
    preference: process.env.VOICE_PROVIDER,
    elevenOk: liveVoiceConfigured() && liveVoiceEnabled(),
    localOk: localVoiceConfigured(),
    cartesiaOk: localVoiceConfigured(),
  });
  const ms = performance.now() - start;

  console.log(`provider: ${provider} (selected in ${ms.toFixed(2)}ms)`);

  if (provider === "local") {
    const grant = await localVoiceSource().grant(
      "AI_SCREEN",
      {
        mode: "AI_SCREEN",
        name: "Screener",
        style: "robotic",
        systemPrompt: "test",
        opener: "hi",
        agentIdEnv: "ELEVENLABS_AGENT_AI_SCREEN",
        warmth: 0.15,
      },
      60,
    );
    console.log(`local grant signedUrl length: ${grant.signedUrl.length}`);
  }
}

main().catch(console.error);
