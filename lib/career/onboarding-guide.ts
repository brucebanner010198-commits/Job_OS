export interface OnboardingGuide {
  company: string;
  role: string;
  firstDayHrChecklist: { id: string; title: string; detail: string }[];
  firstThirtyDaysRoadmap: { phase: string; focus: string; actions: string[] }[];
}

/**
 * Builds a personalized first-day HR meet and 30-60-90 day onboarding guide
 * once an offer is accepted or detected via email sync.
 */
export function buildOnboardingGuide(company: string, role: string): OnboardingGuide {
  return {
    company,
    role,
    firstDayHrChecklist: [
      {
        id: "legal-id",
        title: "Identification and Right-to-Work Documents",
        detail: "Passport or driver's license plus social security card for Form I-9 verification.",
      },
      {
        id: "banking",
        title: "Direct Deposit and Payroll Setup",
        detail: "Routing number and voided check or banking statement for payroll processing.",
      },
      {
        id: "benefits",
        title: "Health & Retirement Benefits Selection",
        detail: "Review 401(k) employer match thresholds, HSA/FSA options, and equity vesting schedule.",
      },
      {
        id: "equipment",
        title: "Hardware & Secure Access Verification",
        detail: "Set up laptop, hardware 2FA keys, company SSO, and dev environment credentials.",
      },
    ],
    firstThirtyDaysRoadmap: [
      {
        phase: "Days 1–30: Absorb & Ship Fast",
        focus: "Understand system architecture and ship your first production PR in week 2.",
        actions: [
          "Meet 1-on-1 with team members to map dependencies and unwritten norms.",
          "Identify setup friction in developer documentation and submit an onboarding fix.",
          "Deliver an early end-to-end bug fix or small feature to validate deployment pipelines.",
        ],
      },
      {
        phase: "Days 31–60: Own a Domain",
        focus: "Take primary ownership of a core subsystem or service.",
        actions: [
          "Run on-call shadow rotations and document runbooks.",
          "Lead technical design reviews and RFC discussions for upcoming initiatives.",
          "Collaborate with product managers on backlog refinement and technical debt reduction.",
        ],
      },
      {
        phase: "Days 61–90: Strategic Leadership",
        focus: "Establish cross-team visibility and advance internal career growth.",
        actions: [
          "Propose architectural improvements to cut latency or cloud operating costs.",
          "Mentor newer team members and conduct peer code reviews.",
          "Align with engineering manager on promotion criteria and growth milestones.",
        ],
      },
    ],
  };
}
