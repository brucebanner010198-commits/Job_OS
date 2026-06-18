/**
 * The module registry - the map of the whole system. Drives the dashboard now
 * and navigation later.
 *
 * `uiStatus` - is the page/workflow shippable in the app?
 * `liveStatus` - is the production adapter wired (vs fixtures/offline)?
 */
export type ModuleStatus = "ready" | "building" | "planned";

export type LiveAdapterStatus = "live" | "partial" | "fixture";

export interface ModuleMeta {
  id: string;
  name: string;
  blurb: string;
  /** lucide-react icon name */
  icon: string;
  phase: number;
  /** UI / workflow completeness */
  uiStatus: ModuleStatus;
  /** Live adapter wiring (network, browser, voice, etc.) */
  liveStatus: LiveAdapterStatus;
  href?: string;
}

/** @deprecated use uiStatus */
export type { ModuleStatus as ModuleUiStatus };

export const UI_STATUS_LABEL: Record<ModuleStatus, string> = {
  ready: "Ready",
  building: "Building",
  planned: "Planned",
};

export const LIVE_STATUS_LABEL: Record<LiveAdapterStatus, string> = {
  live: "Live",
  partial: "Partial",
  fixture: "Fixture",
};

export const MODULES: ModuleMeta[] = [
  {
    id: "import",
    name: "Cold-start Import",
    blurb: "Bring in an existing resume or LinkedIn profile so you can start on day one.",
    icon: "Upload",
    phase: 1,
    uiStatus: "ready",
    liveStatus: "partial",
    href: "/import",
  },
  {
    id: "master-resume",
    name: "Master Resume",
    blurb: "One profile with everything about you. Update it by voice or text.",
    icon: "Mic",
    phase: 1,
    uiStatus: "ready",
    liveStatus: "live",
    href: "/master-resume",
  },
  {
    id: "resume",
    name: "Tailored ATS Resume",
    blurb: "A truthful, one-page resume tailored to each job and safe for resume scanners.",
    icon: "FileText",
    phase: 1,
    uiStatus: "ready",
    liveStatus: "live",
    href: "/resume",
  },
  {
    id: "cover-letter",
    name: "Cover Letter",
    blurb: "Tailored and fact-checked, with nothing made up. You add the final touch.",
    icon: "PenLine",
    phase: 1,
    uiStatus: "ready",
    liveStatus: "live",
    href: "/resume",
  },
  {
    id: "goals",
    name: "Career Goals",
    blurb: "Your long-term goal plus milestones from 6 months to 10 years. Job matches re-rank to fit.",
    icon: "Target",
    phase: 2,
    uiStatus: "ready",
    liveStatus: "live",
    href: "/goals",
  },
  {
    id: "jobs",
    name: "Job Engine",
    blurb: "Find jobs, score them on fit and reachability, then apply and track.",
    icon: "Compass",
    phase: 3,
    uiStatus: "ready",
    liveStatus: "partial",
    href: "/jobs",
  },
  {
    id: "company-brief",
    name: "Company Brief",
    blurb: "A one-page company summary where every claim is cited and checked against its source.",
    icon: "Building2",
    phase: 4,
    uiStatus: "ready",
    liveStatus: "partial",
    href: "/companies",
  },
  {
    id: "apply",
    name: "Apply Engine",
    blurb: "The app fills out the application. You review each item, then submit.",
    icon: "SendHorizontal",
    phase: 5,
    uiStatus: "ready",
    liveStatus: "partial",
    href: "/apply",
  },
  {
    id: "tracker",
    name: "Tracker + Gmail",
    blurb: "A board for your applications. Gmail suggests status changes, and you confirm them.",
    icon: "KanbanSquare",
    phase: 6,
    uiStatus: "ready",
    liveStatus: "partial",
    href: "/track",
  },
  {
    id: "warm-path",
    name: "Warm-Path / Referrals",
    blurb: "Find someone who can refer you before you apply cold. It is the biggest lever you have.",
    icon: "Users",
    phase: 7,
    uiStatus: "ready",
    liveStatus: "fixture",
    href: "/warm-path",
  },
  {
    id: "interview",
    name: "Interview Prep",
    blurb: "Study the most likely questions, then practice with AI-screen and real-HR voice mocks.",
    icon: "MessagesSquare",
    phase: 8,
    uiStatus: "ready",
    liveStatus: "partial",
    href: "/interview",
  },
  {
    id: "linkedin",
    name: "LinkedIn Optimizer",
    blurb: "Check your profile against LinkedIn's All-Star criteria and get specific fixes.",
    icon: "Network",
    phase: 7,
    uiStatus: "ready",
    liveStatus: "fixture",
    href: "/linkedin",
  },
  {
    id: "boosters",
    name: "Funnel Boosters",
    blurb: "Follow-up reminders and a salary negotiation coach.",
    icon: "TrendingUp",
    phase: 7,
    uiStatus: "ready",
    liveStatus: "live",
    href: "/boosters",
  },
  {
    id: "training",
    name: "Job Training Hub",
    blurb: "Resume basics, gap analysis, clear reasons for rejections, and guides for reaching HR.",
    icon: "BookOpen",
    phase: 7,
    uiStatus: "ready",
    liveStatus: "live",
    href: "/training",
  },
  {
    id: "outcomes",
    name: "Outcomes & Automation",
    blurb: "Interviews per 10 applications by route, plus scheduled background jobs.",
    icon: "Gauge",
    phase: 9,
    uiStatus: "ready",
    liveStatus: "live",
    href: "/outcomes",
  },
  {
    id: "integrations",
    name: "Integrations",
    blurb: "Paste your API keys here: OpenRouter, ElevenLabs, Gmail, and JSearch.",
    icon: "Plug",
    phase: 1,
    uiStatus: "ready",
    liveStatus: "live",
    href: "/integrations",
  },
  {
    id: "backups",
    name: "Backups & Export",
    blurb:
      "Encrypted, versioned snapshots of your profile. Restore or export them anytime.",
    icon: "ShieldCheck",
    phase: 11,
    uiStatus: "ready",
    liveStatus: "live",
    href: "/backups",
  },
];
