/**
 * A small spread of illustrative roles, used ONLY to show - live and for free -
 * how setting goals re-ranks matches (plan §7: goals must measurably re-rank,
 * or they're decoration). These are not real postings; the real job engine
 * (Phase 3) scores live listings. Deliberately diverse so the shift is visible.
 */
export interface SampleRole {
  title: string;
  company: string;
  text: string;
}

export const SAMPLE_ROLES: SampleRole[] = [
  {
    title: "Engineering Manager",
    company: "Northwind",
    text: "Lead and grow a team of backend engineers. Own delivery, hiring, mentorship, roadmap, and people management for a payments platform. Coaching, 1:1s, performance.",
  },
  {
    title: "Staff Software Engineer",
    company: "Heliograph",
    text: "Technical leadership across services. Drive architecture, distributed systems, scalability, and engineering standards. Deep hands-on coding, mentoring senior engineers, no direct reports.",
  },
  {
    title: "Senior Backend Engineer",
    company: "Acme Cloud",
    text: "Build and operate high-throughput backend services in Go and Postgres. APIs, latency, reliability, on-call. Individual contributor on a small team.",
  },
  {
    title: "Product Manager, Platform",
    company: "Lumen Labs",
    text: "Own product strategy and roadmap for an internal developer platform. Talk to customers, write specs, prioritize, partner with engineering. No coding.",
  },
  {
    title: "Machine Learning Engineer",
    company: "Cinder AI",
    text: "Train and deploy ML models, build data pipelines, LLM applications, retrieval, evaluation, and inference infrastructure for a climate analytics product.",
  },
  {
    title: "Developer Advocate",
    company: "Forge",
    text: "Create content, demos, and talks for a developer audience. Community, docs, conference speaking, and developer experience for an API company.",
  },
];
