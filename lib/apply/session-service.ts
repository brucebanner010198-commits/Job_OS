/**
 * Cooperative Playwright session service - long-lived browser sessions with
 * pause / handoff / resume AI control (Phase 5). Persisted in Postgres (Phase 3A).
 */
import type { ApplyState } from "@/lib/apply/types";
import { db } from "@/lib/db";
import type { AppScope } from "@/lib/profiles/types";
import { scopeWhere } from "@/lib/profiles/scope";
import type { ApplyState as PrismaApplyState, SessionControlMode } from "@prisma/client";

export type { SessionControlMode };

export interface ApplySession {
  applicationId: string;
  profileId: string;
  mode: SessionControlMode;
  applyState: ApplyState;
  captchaDetected: boolean;
  updatedAt: string;
}

function toDomain(row: {
  applicationId: string;
  profileId: string;
  mode: SessionControlMode;
  applyState: PrismaApplyState;
  captchaDetected: boolean;
  updatedAt: Date;
}): ApplySession {
  return {
    applicationId: row.applicationId,
    profileId: row.profileId,
    mode: row.mode,
    applyState: row.applyState as ApplyState,
    captchaDetected: row.captchaDetected,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getSession(
  scope: AppScope,
  applicationId: string,
): Promise<ApplySession | undefined> {
  const row = await db.applySession.findFirst({
    where: { applicationId, ...scopeWhere(scope) },
  });
  return row ? toDomain(row) : undefined;
}

export async function upsertSession(
  scope: AppScope,
  applicationId: string,
  patch: Partial<Omit<ApplySession, "applicationId" | "profileId">>,
): Promise<ApplySession> {
  const app = await db.application.findFirst({
    where: { id: applicationId, ...scopeWhere(scope) },
    select: { id: true },
  });
  if (!app) {
    throw new Error("Application not found");
  }

  const existing = await db.applySession.findFirst({
    where: { applicationId, ...scopeWhere(scope) },
  });

  const row = await db.applySession.upsert({
    where: { applicationId },
    create: {
      applicationId,
      profileId: scope.profileId,
      mode: patch.mode ?? "AI",
      applyState: (patch.applyState ?? "PREPARING") as PrismaApplyState,
      captchaDetected: patch.captchaDetected ?? false,
    },
    update: {
      mode: patch.mode ?? existing?.mode ?? "AI",
      applyState: (patch.applyState ??
        existing?.applyState ??
        "PREPARING") as PrismaApplyState,
      captchaDetected:
        patch.captchaDetected ?? existing?.captchaDetected ?? false,
    },
  });

  if (row.profileId !== scope.profileId) {
    throw new Error("ApplySession profile mismatch");
  }

  return toDomain(row);
}

/** User takes manual control - automation pauses. */
export async function takeControl(
  scope: AppScope,
  applicationId: string,
): Promise<ApplySession> {
  return upsertSession(scope, applicationId, { mode: "HANDOFF" });
}

/** CAPTCHA detected - pause (not fail). */
export async function pauseForCaptcha(
  scope: AppScope,
  applicationId: string,
): Promise<ApplySession> {
  return upsertSession(scope, applicationId, {
    mode: "PAUSED",
    captchaDetected: true,
    applyState: "PAUSED",
  });
}

/** User solved CAPTCHA or finished manual edits - resume AI. */
export async function resumeAi(
  scope: AppScope,
  applicationId: string,
): Promise<ApplySession> {
  return upsertSession(scope, applicationId, {
    mode: "AI",
    captchaDetected: false,
    applyState: "PREPARING",
  });
}

export async function clearSession(
  scope: AppScope,
  applicationId: string,
): Promise<void> {
  await db.applySession.deleteMany({
    where: { applicationId, ...scopeWhere(scope) },
  });
}

/** Test helper */
export async function clearAllSessions(): Promise<void> {
  await db.applySession.deleteMany();
}
