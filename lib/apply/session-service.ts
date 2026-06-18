/**
 * Cooperative Playwright session service - long-lived browser sessions with
 * pause / handoff / resume AI control (Phase 5).
 */
import type { ApplyState } from "@/lib/apply/types";
import type { AppScope } from "@/lib/profiles/types";

export type SessionControlMode = "AI" | "PAUSED" | "HANDOFF";

export interface ApplySession {
  applicationId: string;
  profileId: string;
  mode: SessionControlMode;
  applyState: ApplyState;
  captchaDetected: boolean;
  updatedAt: string;
}

const sessions = new Map<string, ApplySession>();

function key(profileId: string, applicationId: string): string {
  return `${profileId}:${applicationId}`;
}

export function getSession(
  scope: AppScope,
  applicationId: string,
): ApplySession | undefined {
  return sessions.get(key(scope.profileId, applicationId));
}

export function upsertSession(
  scope: AppScope,
  applicationId: string,
  patch: Partial<Omit<ApplySession, "applicationId" | "profileId">>,
): ApplySession {
  const k = key(scope.profileId, applicationId);
  const existing = sessions.get(k);
  const next: ApplySession = {
    applicationId,
    profileId: scope.profileId,
    mode: patch.mode ?? existing?.mode ?? "AI",
    applyState: patch.applyState ?? existing?.applyState ?? "PREPARING",
    captchaDetected: patch.captchaDetected ?? existing?.captchaDetected ?? false,
    updatedAt: new Date().toISOString(),
  };
  sessions.set(k, next);
  return next;
}

/** User takes manual control - automation pauses. */
export function takeControl(
  scope: AppScope,
  applicationId: string,
): ApplySession {
  return upsertSession(scope, applicationId, { mode: "HANDOFF" });
}

/** CAPTCHA detected - pause (not fail). */
export function pauseForCaptcha(
  scope: AppScope,
  applicationId: string,
): ApplySession {
  return upsertSession(scope, applicationId, {
    mode: "PAUSED",
    captchaDetected: true,
    applyState: "PAUSED",
  });
}

/** User solved CAPTCHA or finished manual edits - resume AI. */
export function resumeAi(
  scope: AppScope,
  applicationId: string,
): ApplySession {
  return upsertSession(scope, applicationId, {
    mode: "AI",
    captchaDetected: false,
    applyState: "PREPARING",
  });
}

export function clearSession(scope: AppScope, applicationId: string): void {
  sessions.delete(key(scope.profileId, applicationId));
}

/** Test helper */
export function clearAllSessions(): void {
  sessions.clear();
}
