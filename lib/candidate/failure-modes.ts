/**
 * Failure mode registry - maps rejection/screening signals to remediation actions.
 * Powers the Failure → Fix loop across tailor, scoring, apply, and track.
 */
import type { RejectionIntel, RejectionSuggestion } from "@/lib/track/rejection-learning";

export type FailureOwner =
  | "resume"
  | "scoring"
  | "tailor"
  | "apply"
  | "autopilot"
  | "track"
  | "goals";

export interface FailureMode {
  id: string;
  cause: string;
  detection: string;
  systemFix: string;
  owner: FailureOwner;
}

/** Canonical catalog - IDs referenced in vision doc and tests. */
export const FAILURE_MODES: FailureMode[] = [
  {
    id: "fm-ats-format",
    cause: "Tables, columns, graphics break ATS parsers",
    detection: "ats-rules format flags; export validator",
    systemFix: "Force single-column HTML export; strip tables/headers",
    owner: "resume",
  },
  {
    id: "fm-ats-keywords-low",
    cause: "Lexical JD match below ~40–70% pass band",
    detection: "screening-score keyword axis; computeAtsMatch on queue",
    systemFix: "Re-tailor with JD mirror; surface gaps on job card",
    owner: "tailor",
  },
  {
    id: "fm-skim-headline",
    cause: "Headline does not signal target role in 6s skim",
    detection: "skim-headline-match rule; passesSkim gate",
    systemFix: "Tailor prompt sets headline = target title; skim layout",
    owner: "tailor",
  },
  {
    id: "fm-skim-metrics",
    cause: "Top-fold bullets lack quantified impact",
    detection: "metricsInTopFold < required; hasMetricSignal",
    systemFix: "applySkimLayout reorders metric bullets first",
    owner: "resume",
  },
  {
    id: "fm-role-fit",
    cause: "Semantic mismatch vs goals or seniority band",
    detection: "job score + hard gate caps; rejection 'experience' signal",
    systemFix: "Tighten discovery query; raise QUALITY_GATE_MIN_JOB_SCORE",
    owner: "scoring",
  },
  {
    id: "fm-apply-route",
    cause: "CAPTCHA, login wall, or MANUAL surface",
    detection: "apply detection scan; route preview",
    systemFix: "Stop at REVIEW; cooperative Playwright handoff (future)",
    owner: "apply",
  },
  {
    id: "fm-apply-answers",
    cause: "Knockout on sponsorship, salary, or work auth",
    detection: "apply knockouts; rejection 'sponsorship'/'salary'",
    systemFix: "Pre-fill ApplicationAnswers; flag in readiness badge",
    owner: "apply",
  },
  {
    id: "fm-volume-spray",
    cause: "Low-quality bulk apply hurts signal and ethics",
    detection: "quality-gate block; daily cap",
    systemFix: "AUTONOMOUS-only auto-submit; score thresholds + daily cap",
    owner: "autopilot",
  },
  {
    id: "fm-slow-followup",
    cause: "No status tracking or post-rejection learning",
    detection: "stale APPLIED rows; empty rejection intel",
    systemFix: "Gmail sync proposals; rejection-learning → ProfileNote",
    owner: "track",
  },
  {
    id: "fm-generic-materials",
    cause: "Untailored resume/cover for specific JD",
    detection: "keyword gap vs tailored baseline; cover standards",
    systemFix: "Per-target tailor + cover; block export when generic",
    owner: "tailor",
  },
];

const SIGNAL_TO_MODE: Record<string, string> = {
  "other candidates": "fm-role-fit",
  experience: "fm-role-fit",
  skills: "fm-ats-keywords-low",
  sponsorship: "fm-apply-answers",
  salary: "fm-apply-answers",
  location: "fm-role-fit",
};

export function getFailureMode(id: string): FailureMode | undefined {
  return FAILURE_MODES.find((m) => m.id === id);
}

export function failureModesForSignals(signals: string[]): FailureMode[] {
  const ids = new Set<string>();
  for (const s of signals) {
    const id = SIGNAL_TO_MODE[s];
    if (id) ids.add(id);
  }
  if (ids.size === 0) ids.add("fm-role-fit");
  return [...ids]
    .map((id) => getFailureMode(id))
    .filter((m): m is FailureMode => m !== undefined);
}

export interface ProfileFixSuggestion {
  failureModeId: string;
  action: string;
  priority: "high" | "medium";
}

/** Map rejection intel + suggestions into concrete profile improvement actions. */
export function suggestProfileFixes(intel: RejectionIntel): ProfileFixSuggestion[] {
  const modes = failureModesForSignals(intel.signals);
  const fixes: ProfileFixSuggestion[] = modes.map((m) => ({
    failureModeId: m.id,
    action: m.systemFix,
    priority: intel.category === "REJECTION" ? "high" : "medium",
  }));

  for (const s of intel.suggestions) {
    fixes.push({
      failureModeId: suggestionToModeId(s),
      action: s.text,
      priority: s.confidence === "high" ? "high" : "medium",
    });
  }

  const seen = new Set<string>();
  return fixes.filter((f) => {
    const key = `${f.failureModeId}:${f.action}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function suggestionToModeId(s: RejectionSuggestion): string {
  switch (s.kind) {
    case "resume":
      return "fm-ats-keywords-low";
    case "cover_letter":
      return "fm-generic-materials";
    case "apply_answer":
      return "fm-apply-answers";
    case "targeting":
      return "fm-role-fit";
    default:
      return "fm-role-fit";
  }
}

export function formatProfileFixesSection(
  fixes: ProfileFixSuggestion[],
): string {
  if (fixes.length === 0) return "";
  const lines = [
    "",
    "## Profile fixes (suggested)",
    ...fixes.map(
      (f) => `- [${f.priority}] (${f.failureModeId}) ${f.action}`,
    ),
  ];
  return lines.join("\n");
}
