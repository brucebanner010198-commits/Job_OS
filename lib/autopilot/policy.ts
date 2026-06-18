/**
 * Autopilot policy - locked rules for unattended operation.
 */
import type { ApplyRoute } from "@/lib/apply/types";

export interface AutopilotPolicy {
  /** Only AUTONOMOUS-route applications may auto-submit. */
  autoSubmitRoutes: ApplyRoute[];
  /** ASSISTED/MANUAL stop at REVIEW for human approval. */
  reviewRoutes: ApplyRoute[];
  maxAutoSubmitsPerRun: number;
  topJobsToBrief: number;
}

export const DEFAULT_AUTOPILOT_POLICY: AutopilotPolicy = {
  autoSubmitRoutes: ["AUTONOMOUS"],
  reviewRoutes: ["ASSISTED", "MANUAL"],
  maxAutoSubmitsPerRun: 3,
  topJobsToBrief: 5,
};

export function mayAutoSubmit(route: ApplyRoute): boolean {
  return DEFAULT_AUTOPILOT_POLICY.autoSubmitRoutes.includes(route);
}

export function mustStopAtReview(route: ApplyRoute): boolean {
  return DEFAULT_AUTOPILOT_POLICY.reviewRoutes.includes(route);
}
