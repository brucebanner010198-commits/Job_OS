export type WorkCategory =
  | "FEATURE"
  | "BUGFIX"
  | "ARCHITECTURE"
  | "LEADERSHIP"
  | "PROCESS"
  | "LEARNING";

export interface MetricItem {
  label: string;
  delta: string;
}

export interface CreateWorkLogInput {
  title: string;
  project?: string;
  tasksDone: string;
  pointOfView?: string;
  category?: WorkCategory;
  rawContext?: string;
  metrics?: MetricItem[];
  tags?: string[];
  date?: string;
}

export interface CandidateBulletData {
  id: string;
  workLogEntryId?: string | null;
  bulletText: string;
  impactClaim?: string | null;
  suggestedKind: "EXPERIENCE" | "PROJECT" | "ACHIEVEMENT" | "SKILL";
  approved: boolean;
  profileEntryId?: string | null;
  createdAt: string;
}
