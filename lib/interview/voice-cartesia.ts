/**
 * Cartesia + Pipecat live VoiceSource (Phase 13) - the COST-CONTROL voice path
 * (plan §5: Cartesia ~$0.03–0.05/min vs ElevenLabs ~$0.08–0.16/min, the default
 * for heavy mock-interview practice). Same VoiceSource seam as the ElevenLabs
 * adapter, so getVoiceSource() can pick it with zero call-site changes.
 *
 * Architecture: Cartesia is TTS/STT, so the conversational loop runs on a small
 * Pipecat bot runner you host locally. This app-side adapter NEVER holds the
 * Cartesia API key - the Pipecat runner owns it. grant() POSTs to your runner's
 * connect endpoint (PIPECAT_CONNECT_URL) and gets back a short-lived room
 * URL + token (the browser joins via the Pipecat client). Configured ⇒ live,
 * else the caller falls back to the zero-cost fixture mock. Never throws.
 *
 * SERVER-ONLY: reaches the network with optional runner auth; never import into a
 * "use client" component.
 */
import type {
  AgentPersona,
  InterviewMode,
  VoiceGrant,
  VoiceSource,
} from "@/lib/interview/types";
import { getSecret } from "@/lib/secrets";
import { getSecretSync } from "@/lib/secrets/sync";

/** The local Pipecat runner's connect endpoint, or undefined when unset. */
function connectUrl(): string | undefined {
  return getSecretSync("PIPECAT_CONNECT_URL");
}

/** Cartesia voice is configured when a Pipecat connect endpoint is set. */
export function cartesiaVoiceConfigured(): boolean {
  return Boolean(connectUrl());
}

/** Hard kill-switch: CARTESIA_VOICE_DISABLED=1 forces this provider off. */
export function cartesiaVoiceEnabled(): boolean {
  return process.env.CARTESIA_VOICE_DISABLED !== "1";
}

export function cartesiaVoiceSource(): VoiceSource {
  return {
    id: "cartesia",
    isLive: true,

    async grant(
      mode: InterviewMode,
      persona: AgentPersona,
      grantedSec: number,
    ): Promise<VoiceGrant> {
      const empty: VoiceGrant = {
        signedUrl: "",
        agentId: "",
        grantedSec,
        provider: "cartesia",
      };

      // STUDY has no voice; live voice needs the runner endpoint.
      if (mode === "STUDY") return empty;
      const url = (await getSecret("PIPECAT_CONNECT_URL")) ?? connectUrl();
      if (!url) return empty;

      const authToken = (await getSecret("PIPECAT_CONNECT_TOKEN"))?.trim();
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          // The runner starts the bot with the chosen persona + the cap budget.
          // No Cartesia key here - the runner owns it.
          body: JSON.stringify({
            mode,
            persona: persona.agentIdEnv,
            warmth: persona.warmth,
            maxSeconds: grantedSec,
          }),
          cache: "no-store",
        });
        if (!res.ok) return empty;
        const data: unknown = await res.json();
        const obj =
          typeof data === "object" && data !== null
            ? (data as Record<string, unknown>)
            : {};
        const roomUrl =
          typeof obj.roomUrl === "string"
            ? obj.roomUrl
            : typeof obj.room_url === "string"
              ? obj.room_url
              : "";
        const token = typeof obj.token === "string" ? obj.token : "";
        if (!roomUrl) return empty;

        return { signedUrl: roomUrl, agentId: token, grantedSec, provider: "cartesia" };
      } catch {
        // Never throw - degrade to an empty grant → caller falls back to mock.
        return empty;
      }
    },
  };
}
