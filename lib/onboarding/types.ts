/**
 * Shared types for the two-path onboarding + career-coaching flow.
 */

export type OnboardingPath = "resume" | "no-resume";

export type SectionStatus = "missing" | "partial" | "confirmed";

export interface CoachingTurn {
  role: "user" | "assistant";
  content: string;
}

/** Coverage snapshot returned after each coaching turn. */
export interface CoachingCoverage {
  sufficient: boolean;
  gaps: string[];
  sections: {
    experience: SectionStatus;
    education: SectionStatus;
    skills: SectionStatus;
    certifications: SectionStatus;
    projects: SectionStatus;
    goals: SectionStatus;
  };
}

export interface CoachingTurnResult {
  assistantMessage: string;
  coverage: CoachingCoverage;
  /** True when the coach believes enough info is collected to compile. */
  shouldStop: boolean;
  /** True when user signaled done but critical gaps remain — show confirmation UI. */
  finalGapCheck: boolean;
  remainingGaps: string[];
}

export type EntryProvenance = "resume" | "paste" | "conversation";

/** Compiled profile entry with provenance metadata for review UI. */
export interface CompiledEntry {
  kind: string;
  title: string;
  data: Record<string, unknown> & { inferred?: boolean };
  sensitive: boolean;
  provenance: EntryProvenance;
}

export interface CompiledProfile {
  entries: CompiledEntry[];
  goalsNote: string;
  unconfirmedCount: number;
}
