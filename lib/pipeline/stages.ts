/**
 * Six-stage job-search pipeline - shared by the rail, dashboard, and setup wizard.
 */

export type PipelineStageId =
  | "setup"
  | "searching"
  | "applying"
  | "applied"
  | "interview"
  | "outcome";

export interface PipelineStage {
  id: PipelineStageId;
  label: string;
  shortLabel: string;
  href: string;
  /** Path prefixes that map to this stage (first match wins). */
  prefixes: string[];
}

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: "setup",
    label: "Setup",
    shortLabel: "Setup",
    href: "/setup",
    prefixes: ["/setup", "/onboarding", "/import", "/master-resume", "/goals"],
  },
  {
    id: "searching",
    label: "Searching",
    shortLabel: "Search",
    href: "/jobs",
    prefixes: ["/jobs"],
  },
  {
    id: "applying",
    label: "Applying",
    shortLabel: "Apply",
    href: "/apply",
    prefixes: ["/apply", "/companies", "/resume"],
  },
  {
    id: "applied",
    label: "Applied",
    shortLabel: "Applied",
    href: "/track",
    prefixes: ["/track"],
  },
  {
    id: "interview",
    label: "Interview",
    shortLabel: "Interview",
    href: "/interview",
    prefixes: ["/interview"],
  },
  {
    id: "outcome",
    label: "Outcome",
    shortLabel: "Outcome",
    href: "/outcomes",
    prefixes: ["/outcomes"],
  },
];

/** Resolve the active pipeline stage from a pathname. Dashboard `/` maps to setup or searching via caller. */
export function stageFromPathname(pathname: string): PipelineStageId | null {
  if (pathname === "/") return null;
  for (const stage of PIPELINE_STAGES) {
    if (stage.prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return stage.id;
    }
  }
  return null;
}

export function stageById(id: PipelineStageId): PipelineStage {
  const stage = PIPELINE_STAGES.find((s) => s.id === id);
  if (!stage) throw new Error(`Unknown pipeline stage: ${id}`);
  return stage;
}

export function stageIndex(id: PipelineStageId): number {
  return PIPELINE_STAGES.findIndex((s) => s.id === id);
}
