/**
 * OSS Pipecat voice adapter - local runner fallback (Apache/MIT stack).
 * Same seam as Cartesia; uses PIPECAT_CONNECT_URL from the Integrations portal.
 */
import type {
  AgentPersona,
  InterviewMode,
  VoiceGrant,
  VoiceSource,
} from "@/lib/interview/types";
import { getSecret } from "@/lib/secrets";
import { getSecretSync } from "@/lib/secrets/sync";

function connectUrl(): string | undefined {
  return getSecretSync("PIPECAT_CONNECT_URL");
}

export function localVoiceConfigured(): boolean {
  return Boolean(connectUrl());
}

export function localVoiceEnabled(): boolean {
  return getSecretSync("CARTESIA_VOICE_DISABLED") !== "1";
}

export function localVoiceSource(): VoiceSource {
  return {
    id: "local",
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
        provider: "local",
      };

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
          body: JSON.stringify({
            mode,
            persona: persona.agentIdEnv,
            warmth: persona.warmth,
            systemPrompt: persona.systemPrompt,
            opener: persona.opener,
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

        return { signedUrl: roomUrl, agentId: token, grantedSec, provider: "local" };
      } catch {
        return empty;
      }
    },
  };
}
