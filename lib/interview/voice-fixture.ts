/**
 * Fixture VoiceSource - the zero-cost, no-key default. It hands back an empty
 * signedUrl plus the scripted MOCK_SCRIPT, so the UI can play a full mock session
 * (opener → turn-taking → transcript → score) with no ElevenLabs key and no spend.
 * This is what makes the entire live-session FLOW demonstrable offline, mirroring
 * the fixture sources for connections (warm-path) and Gmail.
 */

import { MOCK_SCRIPT } from "@/lib/interview/fixtures";
import type {
  AgentPersona,
  InterviewMode,
  VoiceGrant,
  VoiceSource,
} from "@/lib/interview/types";

export function fixtureVoiceSource(): VoiceSource {
  return {
    id: "fixture",
    isLive: false,

    async grant(
      mode: InterviewMode,
      _persona: AgentPersona,
      grantedSec: number,
    ): Promise<VoiceGrant> {
      return {
        // No real connection - the UI plays `mock` instead of opening WebRTC.
        signedUrl: "",
        agentId: `mock-${mode.toLowerCase()}`,
        grantedSec,
        provider: "fixture",
        mock: MOCK_SCRIPT,
      };
    },
  };
}
