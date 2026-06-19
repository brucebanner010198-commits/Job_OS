/**
 * Rejection learnings view models for the Outcomes page feed.
 * Reads persisted coach notes (post-confirm) and provides offline preview data.
 */
import "server-only";

import { db } from "@/lib/db";
import type { AppScope } from "@/lib/profiles/types";
import { scopeWhere } from "@/lib/profiles/scope";
import { fixtureApps, fixtureEmails } from "@/lib/track/fixtures";
import {
  explainRejection,
  parseRejectionLearning,
  type RejectionCategory,
  type RejectionSuggestion,
} from "@/lib/track/rejection-learning";

export interface RejectionLearningView {
  id: string;
  company: string;
  role: string;
  category: "SOFT_REJECTION" | "REJECTION";
  summary: string;
  primaryCategory: RejectionCategory;
  suggestions: RejectionSuggestion[];
  signals: string[];
  createdAt: string;
}

function parseCoachNote(
  id: string,
  rawText: string,
  createdAt: Date,
): RejectionLearningView | null {
  if (!rawText.includes("kind: rejection")) return null;

  const titleMatch = rawText.match(/^# Coach: (.+?) - (.+)$/m);
  const company = titleMatch?.[1]?.trim() ?? "Unknown company";
  const role = titleMatch?.[2]?.trim() ?? "Unknown role";

  const categoryLine = rawText.match(/^Category: (SOFT_REJECTION|REJECTION)$/m);
  const category =
    categoryLine?.[1] === "SOFT_REJECTION" ? "SOFT_REJECTION" : "REJECTION";

  const summaryMatch = rawText.match(
    /Likely rejection driver:[^\n]*|No specific reason parsed[^\n]*/m,
  );
  const summary =
    summaryMatch?.[0] ??
    "Rejection captured — review suggestions before similar applications.";

  const signals: string[] = [];
  const inSignals = rawText.split("## Signals")[1]?.split("##")[0] ?? "";
  for (const line of inSignals.split("\n")) {
    const m = line.match(/^- (.+)$/);
    if (m && m[1] !== "(none parsed)") signals.push(m[1]!);
  }

  const suggestions: RejectionSuggestion[] = [];
  const inSuggestions = rawText.split("## Suggestions")[1]?.split("##")[0] ?? "";
  for (const line of inSuggestions.split("\n")) {
    const m = line.match(/^- \[(\w+)\] (.+)$/);
    if (m) {
      suggestions.push({
        kind: m[1] as RejectionSuggestion["kind"],
        text: m[2]!,
        confidence: "high",
        provenance: "email_quote",
      });
    }
  }

  const explanation = explainRejection(rawText);

  return {
    id,
    company,
    role,
    category,
    summary: explanation.summary || summary,
    primaryCategory: explanation.primaryCategory,
    suggestions:
      suggestions.length > 0
        ? suggestions
        : [
            {
              kind: "targeting",
              text: "Review ATS match and materials for similar roles.",
              confidence: "medium",
              provenance: "inferred",
            },
          ],
    signals,
    createdAt: createdAt.toISOString(),
  };
}

/** Live learnings from coach ProfileNotes written on REJECTED confirm. */
export async function listRejectionLearnings(
  scope: AppScope,
  limit = 20,
): Promise<RejectionLearningView[]> {
  const notes = await db.profileNote.findMany({
    where: { ...scopeWhere(scope), source: "coach" },
    orderBy: { createdAt: "desc" },
    take: limit * 2,
    select: { id: true, rawText: true, createdAt: true },
  });

  const views: RejectionLearningView[] = [];
  for (const note of notes) {
    const view = parseCoachNote(note.id, note.rawText, note.createdAt);
    if (view) views.push(view);
    if (views.length >= limit) break;
  }
  return views;
}

/** Offline preview — fixture rejection emails parsed into learning cards. */
export function previewRejectionLearnings(): RejectionLearningView[] {
  const rejectionFixtures = fixtureEmails.filter(
    (f) =>
      f.expectedCategory === "REJECTION" || f.expectedCategory === "SOFT_REJECTION",
  );

  return rejectionFixtures.map(({ email, expectedCategory }) => {
    const app =
      fixtureApps.find((a) => email.subject.toLowerCase().includes(a.company.toLowerCase())) ??
      fixtureApps[0]!;

    const intel = parseRejectionLearning({
      applicationId: app.id,
      company: app.company,
      role: app.jobTitle ?? "Role",
      category: expectedCategory === "SOFT_REJECTION" ? "SOFT_REJECTION" : "REJECTION",
      subject: email.subject,
      snippet: email.snippet,
      rationale: "Fixture rejection for offline preview.",
    });

    const explanation = explainRejection(
      [email.subject, email.snippet ?? ""].join(" "),
    );

    return {
      id: email.gmailMessageId,
      company: intel.company,
      role: intel.role,
      category: intel.category,
      summary: explanation.summary,
      primaryCategory: explanation.primaryCategory,
      suggestions: intel.suggestions,
      signals: intel.signals,
      createdAt: email.receivedAt,
    };
  });
}
