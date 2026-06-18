/**
 * Security audit events (Phase 4A). Metadata only — never log secret values,
 * profile payloads, or export contents.
 */
import { logger } from "@/lib/observability/logger";

export type AuditEventType =
  | "integration.secret.saved"
  | "backup.export"
  | "profile.deleted";

export interface AuditContext {
  requestId?: string;
  domain?: string;
}

function record(
  event: AuditEventType,
  metadata: Record<string, unknown>,
  ctx?: AuditContext,
): void {
  logger.info("audit", {
    domain: ctx?.domain ?? "audit",
    requestId: ctx?.requestId,
    event,
    metadata,
  });
}

/** Integration secret fields were saved or cleared (keys only, no values). */
export function auditIntegrationSecretSaved(input: {
  integrationId: string;
  keys: string[];
  requestId?: string;
}): void {
  record(
    "integration.secret.saved",
    { integrationId: input.integrationId, keys: input.keys },
    { requestId: input.requestId, domain: "integrations" },
  );
}

/** User downloaded a plaintext profile export. */
export function auditBackupExport(input: {
  userId: string;
  profileId: string;
  requestId?: string;
}): void {
  record(
    "backup.export",
    { userId: input.userId, profileId: input.profileId },
    { requestId: input.requestId, domain: "backup" },
  );
}

/** A named profile and its scoped data were deleted. */
export function auditProfileDeleted(input: {
  userId: string;
  profileId: string;
  profileName: string;
  requestId?: string;
}): void {
  record(
    "profile.deleted",
    {
      userId: input.userId,
      profileId: input.profileId,
      profileName: input.profileName,
    },
    { requestId: input.requestId, domain: "profiles" },
  );
}
