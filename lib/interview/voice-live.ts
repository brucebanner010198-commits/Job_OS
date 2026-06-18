/**
 * Live VoiceSource - mints a short-lived ElevenLabs signed URL for an in-browser
 * WebRTC interview session (plan §5, Hardening §A/§E).
 *
 * --------------------------------------------------------------------------
 * SECURITY SPINE (encoded here as the contract)
 * --------------------------------------------------------------------------
 *   - THE API KEY NEVER LEAVES THE SERVER. `ELEVENLABS_API_KEY` is read from the
 *     server environment to fetch a signed URL; only that short-lived URL is
 *     handed to the browser SDK. The key is never serialized into a grant, a
 *     prop, or any client bundle. THIS MODULE IS SERVER-ONLY - never import it
 *     into a "use client" component.
 *   - TWO DISTINCT AGENT IDS. AI_SCREEN and REAL_HR bind to separate agent ids
 *     (ELEVENLABS_AGENT_AI_SCREEN / ELEVENLABS_AGENT_REAL_HR) so the two personas
 *     never bleed. STUDY has no voice.
 *   - CONFIGURED ⇒ LIVE, ELSE FIXTURE. Until the key + at least one agent id are
 *     set, this is dormant; getVoiceSource() falls back to the fixture source and
 *     the UI runs the zero-cost scripted mock. A force-off env kills it outright.
 *   - NEVER THROWS. A missing key, a bad agent id, or a failed fetch degrades to
 *     an empty grant (signedUrl "") so the caller can fall back to fixtures - a
 *     mock session, not a crash.
 *   - CAPS ARE THE CALLER'S JOB. grantedSec is decided by the guard (per-session
 *     limit ∧ daily kill-switch) and echoed here; this module never widens it.
 */

import type {
  AgentPersona,
  InterviewMode,
  VoiceGrant,
  VoiceSource,
} from "@/lib/interview/types";
import { getSecret } from "@/lib/secrets";
import { getSecretSync } from "@/lib/secrets/sync";

const SIGNED_URL_ENDPOINT =
  "https://api.elevenlabs.io/v1/convai/conversation/get_signed_url";

/** The server-side API key, or undefined when unset. Never sent to the client. */
function apiKey(): string | undefined {
  return getSecretSync("ELEVENLABS_API_KEY");
}

/** The configured agent id for a live mode, or undefined. */
function agentIdFor(persona: AgentPersona): string | undefined {
  return getSecretSync(persona.agentIdEnv);
}

/**
 * Live voice is CONFIGURED when the key and at least one agent id are present.
 * (Either persona may be configured independently; grant() checks the specific
 * one it needs.)
 */
export function liveVoiceConfigured(): boolean {
  if (!apiKey()) return false;
  const screen = getSecretSync("ELEVENLABS_AGENT_AI_SCREEN");
  const hr = getSecretSync("ELEVENLABS_AGENT_REAL_HR");
  return Boolean(screen || hr);
}

/**
 * A hard kill-switch independent of cost caps: set ELEVENLABS_VOICE_DISABLED=1 to
 * force live voice off (the app then runs the fixture mock everywhere).
 */
export function liveVoiceEnabled(): boolean {
  return process.env.ELEVENLABS_VOICE_DISABLED !== "1";
}

/**
 * Fetch a short-lived signed URL for the chosen agent. Server-side only. Returns
 * an empty signedUrl (never throws) on any misconfiguration or transport error so
 * the caller falls back to the fixture mock.
 */
export function liveVoiceSource(): VoiceSource {
  return {
    id: "elevenlabs",
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
        provider: "elevenlabs",
      };

      // STUDY has no voice; live voice requires a configured key + agent id.
      if (mode === "STUDY") return empty;
      const key = (await getSecret("ELEVENLABS_API_KEY")) ?? apiKey();
      const agentId =
        (await getSecret(persona.agentIdEnv)) ?? agentIdFor(persona);
      if (!key || !agentId) return empty;

      try {
        const res = await fetch(
          `${SIGNED_URL_ENDPOINT}?agent_id=${encodeURIComponent(agentId)}`,
          {
            method: "GET",
            // The key is attached ONLY to this server→ElevenLabs request.
            headers: { "xi-api-key": key },
            cache: "no-store",
          },
        );
        if (!res.ok) return empty;
        const data: unknown = await res.json();
        const signedUrl =
          typeof data === "object" && data !== null && "signed_url" in data
            ? String((data as { signed_url: unknown }).signed_url ?? "")
            : "";
        if (!signedUrl) return empty;

        return { signedUrl, agentId, grantedSec, provider: "elevenlabs" };
      } catch {
        // Never throw - degrade to an empty grant → caller falls back to mock.
        return empty;
      }
    },
  };
}
