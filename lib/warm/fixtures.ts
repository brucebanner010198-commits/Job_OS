/**
 * Deterministic warm-path corpus for Phase 7. Used by the fixture
 * ConnectionSource, the test gate, and the offline /warm-path preview.
 *
 * The connections are aligned to the tracker's WARM_PATH / TO_APPLY companies
 * (Notion, Linear) so real paths-in light up, plus a target with NO path
 * (Datadog) to prove the reach-out gate correctly recommends applying cold
 * instead of fabricating a tie. Every `howKnown` / `sharedContext` is a concrete
 * grounding fact - the draft brain may quote these and nothing else.
 */

import type {
  Connection,
  RequesterProfile,
  WarmTarget,
} from "@/lib/warm/types";

/** The user, for grounding + signing the drafted ask (extractive facts only). */
export const fixtureRequester: RequesterProfile = {
  fullName: "Bruce Banner",
  headline: "Backend Engineer - distributed systems, TypeScript & Go",
  pitch: "shipped a payments ledger handling 2M+ daily transactions at Acme",
};

/**
 * The user's network. A mix of degrees and relationships so the ranker's
 * strongest-first cascade is fully exercised.
 */
export const fixtureConnections: Connection[] = [
  {
    fullName: "Priya Sharma",
    headline: "Senior Software Engineer at Notion",
    company: "Notion",
    companyDomain: "notion.so",
    title: "Senior Software Engineer",
    relationship: "COLLEAGUE",
    degree: 1,
    howKnown: "we worked together at Acme on the payments team",
    sharedContext: "both on the payments platform team 2019–2021",
    profileUrl: "https://www.linkedin.com/in/priya-sharma-eng",
    source: "fixture",
  },
  {
    fullName: "Marcus Webb",
    headline: "Open-source maintainer · Infra @ Notion",
    company: "Notion",
    companyDomain: "notion.so",
    title: "Infrastructure Engineer",
    relationship: "COMMUNITY",
    degree: 2,
    howKnown: "we both maintain the open-source `pgvector-helpers` project",
    sharedContext: "co-reviewed PRs on pgvector-helpers",
    profileUrl: "https://www.linkedin.com/in/marcus-webb-infra",
    source: "fixture",
  },
  {
    fullName: "Alex Chen",
    headline: "Product Engineer at Linear",
    company: "Linear",
    companyDomain: "linear.app",
    title: "Product Engineer",
    relationship: "ALUMNI",
    degree: 2,
    howKnown: "we studied CS together at the University of Washington",
    sharedContext: "both UW CS, class of 2018",
    profileUrl: "https://www.linkedin.com/in/alex-chen-dev",
    source: "fixture",
  },
  {
    fullName: "Jordan Lee",
    headline: "Engineering Manager at Stripe",
    company: "Stripe",
    companyDomain: "stripe.com",
    title: "Engineering Manager",
    relationship: "MUTUAL",
    degree: 2,
    howKnown: "introduced through our mutual friend Dana Kim",
    profileUrl: "https://www.linkedin.com/in/jordan-lee-em",
    source: "fixture",
  },
  {
    fullName: "Sam Patel",
    headline: "Staff Frontend Engineer at Vercel",
    company: "Vercel",
    companyDomain: "vercel.com",
    title: "Staff Frontend Engineer",
    relationship: "FRIEND",
    degree: 1,
    howKnown: "a close friend from my first job at Initech",
    sharedContext: "we were on the same team at Initech for two years",
    profileUrl: "https://www.linkedin.com/in/sam-patel-fe",
    source: "fixture",
  },
];

/**
 * The companies the user is targeting (the tracker's pre-cold columns). Notion
 * + Linear have a real path; Datadog deliberately has NONE so the gate must say
 * "apply cold" rather than invent a connection.
 */
export const fixtureTargets: WarmTarget[] = [
  {
    company: "Notion",
    companyDomain: "notion.so",
    jobTitle: "Software Engineer",
    applicationId: "app-warm-notion",
  },
  {
    company: "Linear",
    companyDomain: "linear.app",
    jobTitle: "Full-Stack Engineer",
    applicationId: "app-toapply-linear",
  },
  {
    company: "Datadog",
    companyDomain: "datadog.com",
    jobTitle: "Senior Software Engineer",
    applicationId: "app-datadog",
  },
];
