/**
 * Client-safe display helpers for coaching coverage UI.
 * Kept separate from coaching.ts to avoid pulling server-only LLM code into the browser bundle.
 */
import type { CoachingCoverage, SectionStatus } from "./types";

/** Human-readable label for section coverage in UI. */
export function sectionLabel(key: keyof CoachingCoverage["sections"]): string {
  const labels: Record<keyof CoachingCoverage["sections"], string> = {
    experience: "Experience",
    education: "Education",
    skills: "Skills",
    certifications: "Certifications",
    projects: "Projects",
    goals: "Career goals",
  };
  return labels[key];
}

export function sectionStatusColor(status: SectionStatus): string {
  switch (status) {
    case "confirmed":
      return "text-success";
    case "partial":
      return "text-accent";
    default:
      return "text-muted-foreground";
  }
}
