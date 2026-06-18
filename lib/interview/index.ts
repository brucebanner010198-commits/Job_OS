/**
 * Interview voice-source selector - elevenlabs → local (Pipecat) → fixture.
 */
import type { VoiceSource, VoiceStatus } from "@/lib/interview/types";
import { fixtureVoiceSource } from "@/lib/interview/voice-fixture";
import {
  liveVoiceConfigured,
  liveVoiceEnabled,
  liveVoiceSource,
} from "@/lib/interview/voice-live";
import {
  localVoiceConfigured,
  localVoiceEnabled,
  localVoiceSource,
} from "@/lib/interview/voice-local";
import {
  cartesiaVoiceConfigured,
  cartesiaVoiceEnabled,
  cartesiaVoiceSource,
} from "@/lib/interview/voice-cartesia";

export type VoiceProvider = "elevenlabs" | "local" | "cartesia" | "fixture";

/**
 * PURE provider selection. Default chain: ElevenLabs → local Pipecat → fixture.
 * VOICE_PROVIDER=cartesia maps to the legacy Cartesia adapter (alias of local).
 */
export function selectVoiceProvider(opts: {
  preference?: string;
  elevenOk: boolean;
  localOk: boolean;
  cartesiaOk?: boolean;
}): VoiceProvider {
  const pref = (opts.preference ?? "").toLowerCase();
  const localOk = opts.localOk || (opts.cartesiaOk ?? false);

  if (pref === "cartesia" || pref === "local") {
    return localOk ? "local" : opts.elevenOk ? "elevenlabs" : "fixture";
  }
  if (pref === "elevenlabs") {
    return opts.elevenOk ? "elevenlabs" : localOk ? "local" : "fixture";
  }
  if (opts.elevenOk) return "elevenlabs";
  if (localOk) return "local";
  return "fixture";
}

function elevenOk(): boolean {
  return liveVoiceConfigured() && liveVoiceEnabled();
}
function localOk(): boolean {
  return (localVoiceConfigured() || cartesiaVoiceConfigured()) &&
    localVoiceEnabled() &&
    cartesiaVoiceEnabled();
}
function activeProvider(): VoiceProvider {
  return selectVoiceProvider({
    preference: process.env.VOICE_PROVIDER,
    elevenOk: elevenOk(),
    localOk: localOk(),
    cartesiaOk: cartesiaVoiceConfigured(),
  });
}

export function getVoiceSource(): VoiceSource {
  switch (activeProvider()) {
    case "elevenlabs":
      return liveVoiceSource();
    case "local":
      return localVoiceSource();
    case "cartesia":
      return cartesiaVoiceSource();
    default:
      return fixtureVoiceSource();
  }
}

export function voiceStatus(): VoiceStatus {
  const provider = activeProvider();

  if (provider === "local" || provider === "cartesia") {
    return {
      configured: true,
      enabled: true,
      provider: provider === "local" ? "local" : "cartesia",
      detail:
        "Live voice ready via Pipecat OSS runner (Whisper + Kokoro). " +
        "Sessions are capped per-session and per-day.",
    };
  }
  if (provider === "elevenlabs") {
    return {
      configured: true,
      enabled: true,
      provider: "elevenlabs",
      detail:
        "Live voice ready via ElevenLabs. Sessions are capped per-session and " +
        "per-day. OSS Pipecat fallback available via PIPECAT_CONNECT_URL.",
    };
  }

  if (liveVoiceConfigured() && !liveVoiceEnabled()) {
    return {
      configured: true,
      enabled: false,
      provider: "fixture",
      detail:
        "Live voice is force-disabled (ELEVENLABS_VOICE_DISABLED=1) - running mock sessions.",
    };
  }
  return {
    configured: false,
    enabled: true,
    provider: "fixture",
    detail:
      "Live voice not configured - running zero-cost mock sessions. Set " +
      "ELEVENLABS_API_KEY + an agent id, or PIPECAT_CONNECT_URL for OSS fallback.",
  };
}
