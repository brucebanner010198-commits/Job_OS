"use server";

/**
 * LinkedIn Presence Optimizer - server actions.
 *
 * Today: pure rules engine (no LLM call).
 *
 * TODO (future): Route `auditProfileTextAction` through OpenRouter after the
 * rules pass to rewrite `finding.suggestion` text with role/context-aware
 * language from the user's master profile. Keep the rules score as-is; only
 * the suggestion prose changes. Guard with a feature flag so offline / no-key
 * scenarios fall back to the static text.
 */

import { requireAccessForMutation } from "@/lib/auth/require-access";
import { getAppContext } from "@/lib/app-context";
import { safeDb } from "@/lib/safe";
import { listFacts, toFacts } from "@/lib/profile/service";
import { nonSensitive } from "@/lib/ai/redaction";
import { flattenFact } from "@/lib/profile/types";
import { auditProfile, profileFromText } from "@/lib/linkedin/audit";
import type { AuditResult, LinkedInProfileInput } from "@/lib/linkedin/types";

/**
 * Audit from a raw pasted profile blob.
 * profileFromText does a best-effort parse; auditProfile scores the result.
 */
export async function auditProfileTextAction(text: string): Promise<AuditResult> {
  await requireAccessForMutation();
  const input = profileFromText(text.trim());
  return auditProfile(input);
}

/**
 * Audit from a structured form submission.
 * Use this when the user fills in the individual fields directly.
 */
export async function auditProfileAction(
  input: LinkedInProfileInput,
): Promise<AuditResult> {
  await requireAccessForMutation();
  return auditProfile(input);
}

/**
 * Return the user's non-sensitive master-profile text as a paste-seed so the
 * UI can pre-populate the textarea. Falls back to "" when the DB is absent.
 */
export async function seedFromMasterProfileAction(): Promise<string> {
  await requireAccessForMutation();
  const { data } = await safeDb<string>(async () => {
    const { scope } = await getAppContext();
    const entries = await listFacts(scope);
    return toFacts(nonSensitive(entries)).map(flattenFact).join("\n");
  }, "");
  return data;
}
