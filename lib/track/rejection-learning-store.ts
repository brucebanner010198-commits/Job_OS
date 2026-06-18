/**
 * Server-only persistence for rejection learning coach notes.
 */
import {
  failureModesForSignals,
  formatProfileFixesSection,
  suggestProfileFixes,
} from "@/lib/candidate/failure-modes";
import { storeCoachNote } from "@/lib/coach/notes";
import type { AppScope } from "@/lib/profiles/types";
import {
  explainRejection,
  parseRejectionLearning,
  type RejectionIntel,
} from "@/lib/track/rejection-learning";

function formatNoteBody(intel: RejectionIntel, emailText: string): string {
  const explanation = explainRejection(emailText);
  const modes = failureModesForSignals(intel.signals);
  const profileFixes = suggestProfileFixes(intel);
  const lines = [
    `# Rejection learning - ${intel.company} (${intel.role})`,
    "",
    `Application: ${intel.applicationId}`,
    `Category: ${intel.category}`,
    "",
    "## Why (categorized)",
    `Primary: ${explanation.primaryCategory}`,
    `All: ${explanation.categories.join(", ")}`,
    explanation.summary,
    "",
    "## Signals",
    ...(intel.signals.length ? intel.signals.map((s) => `- ${s}`) : ["- (none parsed)"]),
    "",
    "## Failure modes",
    ...modes.map((m) => `- ${m.id}: ${m.systemFix}`),
    "",
    "## Suggestions",
    ...intel.suggestions.map((s) => `- [${s.kind}] ${s.text}`),
    "",
    "## Fixes by module",
    ...explanation.fixes.map((f) => `- [${f.module}] ${f.text}`),
    formatProfileFixesSection(profileFixes),
  ];
  return lines.join("\n");
}

/** Persist learning as a coach ProfileNote for Knowledge Notebook indexing. */
export async function storeRejectionLearning(
  scope: AppScope,
  intel: RejectionIntel,
  emailText?: string,
): Promise<void> {
  const haystack = emailText ?? intel.signals.join(" ");
  const body = formatNoteBody(intel, haystack);
  await storeCoachNote(scope, {
    kind: "rejection",
    title: `${intel.company} - ${intel.role}`,
    body,
  });
}

/** Called from confirmProposal when user accepts a REJECTED status move. */
export async function captureRejectionOnConfirm(
  scope: AppScope,
  proposal: {
    toStatus: string;
    applicationId: string | null;
    rationale: string;
    inboxItem: {
      subject: string;
      snippet: string | null;
      category: string;
    };
    application: {
      job: { company: string; title: string };
    } | null;
  },
): Promise<RejectionIntel | null> {
  if (proposal.toStatus !== "REJECTED" || !proposal.applicationId || !proposal.application) {
    return null;
  }

  const cat =
    proposal.inboxItem.category === "SOFT_REJECTION" ? "SOFT_REJECTION" : "REJECTION";

  const intel = parseRejectionLearning({
    applicationId: proposal.applicationId,
    company: proposal.application.job.company,
    role: proposal.application.job.title,
    category: cat,
    subject: proposal.inboxItem.subject,
    snippet: proposal.inboxItem.snippet,
    rationale: proposal.rationale,
  });

  const emailText = [
    proposal.inboxItem.subject,
    proposal.inboxItem.snippet ?? "",
    proposal.rationale,
  ].join(" ");

  await storeRejectionLearning(scope, intel, emailText);
  return intel;
}
