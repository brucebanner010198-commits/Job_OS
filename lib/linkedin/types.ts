/**
 * LinkedIn Presence Optimizer - shared types.
 * Self-contained; no imports from other modules.
 */

/** Raw profile data the user supplies (paste-parsed or form-entered). */
export interface LinkedInProfileInput {
  /** The 220-char headline shown under the name. */
  headline: string;
  /** The "About" / summary section text. */
  about: string;
  /** Does the profile have a photo? */
  hasPhoto: boolean;
  /** Does the profile have a custom vanity URL (linkedin.com/in/your-name)? */
  hasCustomUrl: boolean;
  /** Number of skills listed (out of LinkedIn's 50-skill max). */
  skillsCount: number;
  /** First-degree connection count; 500 means "500+". */
  connections: number;
  /** Number of experience entries. */
  experienceCount: number;
  /** Is the #OpenToWork frame active? */
  hasOpenToWork?: boolean;
  /** Number of items in the Featured section. */
  featuredCount?: number;
  /** Number of recommendations received. */
  recommendationsCount?: number;
}

/** How bad is this gap? */
export type Severity = "high" | "medium" | "low";

/** A single actionable gap found during the audit. */
export interface AuditFinding {
  /** Which profile section this covers (e.g. "Headline", "About"). */
  area: string;
  severity: Severity;
  /** Plain description of the problem. */
  issue: string;
  /** Concrete, specific fix the user can apply today. */
  suggestion: string;
}

/** LinkedIn's informal completion tiers. */
export type AuditTier = "Beginner" | "Intermediate" | "Advanced" | "All-Star";

/** Full audit result returned to the UI. */
export interface AuditResult {
  /** 0–100 weighted completion score. */
  score: number;
  tier: AuditTier;
  findings: AuditFinding[];
  /** Criteria already met - displayed as positive reinforcement. */
  strengths: string[];
}
