/**
 * Offline fixture dataset (plan §8 Phase 3) - deterministic, no network, no DB.
 * Provides 19 realistic postings that exercise every downstream pipeline path:
 * a near-dup cluster (×3), a near-dup pair (×2), an exact duplicate (×2), a
 * ghost, a scam, four hard-requirement entries, and a diverse spread of legit
 * roles across seniorities and domains.
 *
 * Hard-requirement phrases present in this dataset (for the hard-gate parser):
 *   "8+ years"            → Zenith Platform, Staff Software Engineer
 *   "PhD in Computer Science required" → NeuralLabs, ML Research Engineer
 *   "must be a US citizen with an active security clearance" → ClearPath Defense
 *   "must be authorized to work in the US without sponsorship" → PaymentPro
 */

import type { RawJob, JobSource } from "@/lib/jobs/types";

// --- Fixture dataset -----------------------------------------------------------

export const fixtureJobs: RawJob[] = [
  // -- Near-duplicate cluster: "Senior Backend Engineer" at Acme Cloud, 3 sources -

  {
    source: "fixtures",
    sourceId: "acme-sbe-001",
    url: "https://acmecloud.example/jobs/sbe-001",
    company: "Acme Cloud",
    title: "Senior Backend Engineer",
    location: "San Francisco, CA",
    remote: false,
    description:
      "Acme Cloud is hiring a Senior Backend Engineer to build and scale our core " +
      "infrastructure. You will design high-throughput services in Go and Postgres, own " +
      "on-call rotations, and drive architectural decisions across a system serving " +
      "millions of requests per day. We need someone who thrives in a fast-paced, " +
      "reliability-first environment with 5+ years of backend engineering experience.",
    atsType: "greenhouse",
    salaryMin: 160000,
    salaryMax: 210000,
    postedAt: new Date("2026-06-01"),
  },
  {
    source: "indeed-feed",
    sourceId: "indeed-12345",
    url: "https://indeed.example/jobs/12345",
    company: "Acme Cloud",
    title: "Senior Backend Engineer",
    location: "San Francisco, CA",
    remote: false,
    description:
      "We are looking for a Senior Backend Engineer at Acme Cloud to scale distributed " +
      "systems for millions of daily users. The ideal candidate brings strong proficiency " +
      "in Go or Rust, deep Postgres expertise, and a passion for reliability engineering. " +
      "You will be embedded in our Infrastructure team setting technical direction and " +
      "collaborating cross-functionally. Minimum 5 years of professional software " +
      "engineering experience.",
    salaryMin: 160000,
    salaryMax: 210000,
    postedAt: new Date("2026-06-02"),
  },
  {
    source: "linkedin-feed",
    sourceId: "linkedin-67890",
    url: "https://linkedin.example/jobs/67890",
    company: "Acme Cloud",
    title: "Senior Backend Engineer",
    location: "San Francisco, CA",
    remote: false,
    description:
      "Acme Cloud seeks a Senior Backend Engineer to join a world-class infrastructure " +
      "team. Responsibilities include designing scalable APIs, optimizing Postgres " +
      "performance, and mentoring junior engineers. You will contribute to our " +
      "reliability roadmap and sustain millions of transactions per day in Go-based " +
      "services, ideally with 5+ years in a production backend environment.",
    salaryMin: 165000,
    salaryMax: 215000,
    postedAt: new Date("2026-06-03"),
  },

  // -- Near-duplicate pair: "Frontend Engineer" at Brightpath Technologies -----

  {
    source: "fixtures",
    sourceId: "brightpath-fe-001",
    url: "https://brightpath.example/jobs/fe-001",
    company: "Brightpath Technologies",
    title: "Frontend Engineer",
    location: "Austin, TX",
    remote: true,
    description:
      "Brightpath Technologies is looking for a Frontend Engineer to build performant " +
      "React applications used by 500,000+ monthly active users. You will work closely " +
      "with design and product to ship features that delight customers, write clean " +
      "TypeScript, and own end-to-end quality. Experience with Next.js, accessibility " +
      "standards, and design systems is a strong plus.",
    atsType: "lever",
    salaryMin: 130000,
    salaryMax: 170000,
    postedAt: new Date("2026-06-05"),
  },
  {
    source: "greenhouse-feed",
    sourceId: "gh-brightpath-001",
    url: "https://boards.greenhouse.io/brightpath/jobs/fe-001",
    company: "Brightpath Technologies",
    title: "Frontend Engineer",
    location: "Austin, TX",
    remote: true,
    description:
      "Brightpath Technologies needs a Frontend Engineer to craft high-quality React " +
      "and Next.js UIs for our flagship product reaching 500k+ users each month. The " +
      "role involves owning components in our design system, collaborating with Product, " +
      "and driving performance improvements. You should be comfortable in TypeScript " +
      "and have a solid grasp of web accessibility best practices.",
    atsType: "greenhouse",
    salaryMin: 130000,
    salaryMax: 170000,
    postedAt: new Date("2026-06-06"),
  },

  // -- Exact duplicate: identical company + title + location, two sources --------

  {
    source: "fixtures",
    sourceId: "gridstack-pm-001",
    url: "https://gridstack.example/jobs/pm-platform",
    company: "GridStack Inc.",
    title: "Product Manager, Platform",
    location: "New York, NY",
    remote: false,
    description:
      "GridStack Inc. is hiring a Product Manager for our Platform team. You will own " +
      "the roadmap for our core developer APIs and infrastructure products, working " +
      "closely with engineering, design, and go-to-market. 3–5 years of product " +
      "management experience in a B2B SaaS environment required.",
    atsType: "workday",
    salaryMin: 145000,
    salaryMax: 185000,
    postedAt: new Date("2026-05-20"),
  },
  {
    source: "glassdoor-feed",
    sourceId: "gd-gridstack-pm",
    url: "https://www.glassdoor.com/gridstack/jobs/pm-platform",
    company: "GridStack Inc.",
    title: "Product Manager, Platform",
    location: "New York, NY",
    remote: false,
    description:
      "GridStack Inc. is hiring a Product Manager for our Platform team. You will own " +
      "the roadmap for our core developer APIs and infrastructure products, working " +
      "closely with engineering, design, and go-to-market. 3–5 years of product " +
      "management experience in a B2B SaaS environment required.",
    atsType: "workday",
    salaryMin: 145000,
    salaryMax: 185000,
    postedAt: new Date("2026-05-20"),
  },

  // -- Ghost job: evergreen, vague, no responsibilities, no salary ---------------

  {
    source: "fixtures",
    sourceId: "bigcorp-talent-community",
    url: "https://careers.bigcorpglobal.example/talent-community",
    company: "BigCorp Global",
    title: "Software Engineer – Talent Community",
    location: "Anywhere",
    remote: true,
    description:
      "We're always looking for talented people to join our growing team at BigCorp " +
      "Global. Join our talent community and be the first to know about exciting " +
      "opportunities across our engineering organization. We welcome engineers at all " +
      "levels who are passionate about technology and want to make an impact. Submit " +
      "your resume and we'll reach out when the right opportunity arises.",
    // no salary, no atsType - classic evergreen ghost
    postedAt: new Date("2025-01-15"),
  },

  // -- Scam job: $5k/week, Telegram, processing fee, gmail recruiter ------------

  {
    source: "fixtures",
    sourceId: "clickearnings-wfh",
    url: "https://clickearnings.example/apply-now",
    company: "ClickEarnings LLC",
    title: "Remote Data Entry Specialist / Work From Home",
    location: "Work From Home",
    remote: true,
    description:
      "EARN $5,000+ PER WEEK working from home - no experience needed, no degree " +
      "required! This flexible data entry position lets you set your own hours and work " +
      "from anywhere. To get started, contact our hiring manager directly on Telegram " +
      "or WhatsApp: +1-555-SCAM-999. A one-time onboarding and processing fee of $49 " +
      "is required to access our secure client portal. Apply now - positions fill fast! " +
      "Recruiter contact: john.hiring2026@gmail.com.",
    postedAt: new Date("2026-06-10"),
  },

  // -- Legit roles ---------------------------------------------------------------

  // Junior - frontend
  {
    source: "fixtures",
    sourceId: "novaspark-jfd-001",
    url: "https://boards.greenhouse.io/novaspark/jobs/jfd-001",
    company: "NovaSpark",
    title: "Junior Frontend Developer",
    location: "Remote",
    remote: true,
    description:
      "NovaSpark is a seed-stage startup building collaborative design tools. We're " +
      "looking for a Junior Frontend Developer eager to grow alongside a senior team. " +
      "You'll build features in React 19 and TypeScript, write unit tests, and learn " +
      "our design system from the ground up. 0–2 years of professional experience is " +
      "fine - we care more about curiosity and craft than tenure.",
    atsType: "greenhouse",
    salaryMin: 90000,
    salaryMax: 115000,
    postedAt: new Date("2026-06-08"),
  },

  // Mid-senior - data engineering
  {
    source: "fixtures",
    sourceId: "dataflow-de-002",
    url: "https://jobs.lever.co/dataflowsystems/de-002",
    company: "DataFlow Systems",
    title: "Senior Data Engineer",
    location: "Chicago, IL",
    remote: false,
    description:
      "DataFlow Systems processes petabyte-scale event streams for Fortune 500 clients. " +
      "As a Senior Data Engineer you will design and maintain real-time pipelines in " +
      "Apache Spark and Kafka, model dimensional data warehouses in Snowflake, and " +
      "collaborate with analytics engineers on dbt models. 3–6 years of data " +
      "engineering experience and strong SQL skills are expected.",
    atsType: "lever",
    salaryMin: 140000,
    salaryMax: 175000,
    postedAt: new Date("2026-06-07"),
  },

  // Staff IC - HARD REQUIREMENT: 8+ years
  {
    source: "fixtures",
    sourceId: "zenith-sse-003",
    url: "https://jobs.ashby.io/zenithplatform/sse-003",
    company: "Zenith Platform",
    title: "Staff Software Engineer",
    location: "Seattle, WA",
    remote: true,
    description:
      "Zenith Platform is a Series C infrastructure company solving developer " +
      "productivity at scale. This role requires 8+ years of experience in distributed " +
      "systems, with deep expertise in at least one of: Kubernetes, service meshes, or " +
      "large-scale storage systems. You will drive technical strategy across three " +
      "product lines, mentor a team of eight engineers, and represent engineering in " +
      "executive planning. Principal-track IC role with equity and strong comp.",
    atsType: "ashby",
    salaryMin: 220000,
    salaryMax: 280000,
    postedAt: new Date("2026-06-04"),
  },

  // Senior ML - HARD REQUIREMENT: PhD in Computer Science required
  {
    source: "fixtures",
    sourceId: "neurallabs-mle-004",
    url: "https://neurallabs.example/jobs/mle-004",
    company: "NeuralLabs",
    title: "ML Research Engineer",
    location: "Palo Alto, CA",
    remote: false,
    description:
      "NeuralLabs is an AI research company commercializing next-generation foundation " +
      "models. We are hiring a ML Research Engineer to contribute to pre-training " +
      "infrastructure, RLHF pipelines, and evaluation harnesses. PhD in Computer " +
      "Science required, with a strong publication record in ML, NLP, or computer " +
      "vision. Experience with PyTorch, large-scale distributed training, and CUDA " +
      "optimization is highly valued.",
    atsType: "workday",
    salaryMin: 250000,
    salaryMax: 350000,
    postedAt: new Date("2026-05-30"),
  },

  // Security engineer - HARD REQUIREMENT: US citizen + active security clearance
  {
    source: "fixtures",
    sourceId: "clearpath-ise-005",
    url: "https://jobs.ashby.io/clearpathdefense/ise-005",
    company: "ClearPath Defense",
    title: "Software Engineer, Infrastructure Security",
    location: "Arlington, VA",
    remote: false,
    description:
      "ClearPath Defense builds mission-critical security software for US government " +
      "and DoD clients. This role requires that the candidate must be a US citizen with " +
      "an active security clearance (TS/SCI preferred). Responsibilities include " +
      "hardening cloud infrastructure on AWS GovCloud, implementing zero-trust " +
      "networking, and conducting threat modeling for classified systems. 5+ years of " +
      "software engineering in a secure environment required.",
    atsType: "ashby",
    salaryMin: 170000,
    salaryMax: 220000,
    postedAt: new Date("2026-06-01"),
  },

  // Senior backend - HARD REQUIREMENT: must be authorized to work in the US without sponsorship
  {
    source: "fixtures",
    sourceId: "paymentpro-sbe-006",
    url: "https://boards.greenhouse.io/paymentpro/jobs/sbe-006",
    company: "PaymentPro",
    title: "Senior Backend Engineer",
    location: "Miami, FL",
    remote: true,
    description:
      "PaymentPro is a fast-growing fintech processing $10B+ in annual transaction " +
      "volume. We are hiring a Senior Backend Engineer to own payment gateway " +
      "infrastructure, build fraud-detection microservices in Java and Kotlin, and " +
      "ensure PCI-DSS compliance across the stack. Applicants must be authorized to " +
      "work in the US without sponsorship - we are unable to sponsor or transfer visas " +
      "for this role. 4+ years of backend experience in payments or fintech preferred.",
    atsType: "greenhouse",
    salaryMin: 155000,
    salaryMax: 200000,
    postedAt: new Date("2026-06-09"),
  },

  // Engineering Manager
  {
    source: "fixtures",
    sourceId: "finforge-em-007",
    url: "https://jobs.lever.co/finforge/em-007",
    company: "FinForge",
    title: "Engineering Manager, Platform",
    location: "New York, NY",
    remote: false,
    description:
      "FinForge is a Series B fintech building the operating system for investment " +
      "funds. We are looking for an Engineering Manager to lead our five-person " +
      "Platform team, owning hiring, performance management, and technical direction. " +
      "You will collaborate with Product and Design, run quarterly planning, and remain " +
      "hands-on in code reviews and architecture. 3+ years of engineering management " +
      "and a background in distributed systems or data infrastructure preferred.",
    atsType: "lever",
    salaryMin: 200000,
    salaryMax: 250000,
    postedAt: new Date("2026-06-03"),
  },

  // Senior Data Scientist
  {
    source: "fixtures",
    sourceId: "healthmetrics-sds-008",
    url: "https://healthmetrics.example/jobs/sds-008",
    company: "HealthMetrics",
    title: "Senior Data Scientist",
    location: "Boston, MA",
    remote: true,
    description:
      "HealthMetrics uses ML and causal inference to help health systems reduce " +
      "readmissions and improve patient outcomes. As a Senior Data Scientist you will " +
      "build predictive models in Python and R, design A/B experiments, and communicate " +
      "insights to clinical and executive stakeholders. 4+ years of data science " +
      "experience with a strong statistics background required; healthcare domain " +
      "knowledge is a major plus.",
    salaryMin: 150000,
    salaryMax: 195000,
    postedAt: new Date("2026-06-06"),
  },

  // Mid - Full Stack
  {
    source: "fixtures",
    sourceId: "buildright-fsd-009",
    url: "https://jobs.ashby.io/buildright/fsd-009",
    company: "BuildRight",
    title: "Full Stack Developer",
    location: "Denver, CO",
    remote: true,
    description:
      "BuildRight makes construction project management software used by 20,000+ " +
      "contractors across North America. We are hiring a Full Stack Developer to build " +
      "new features across our React frontend and Node.js/PostgreSQL backend. You'll " +
      "own complete feature slices, write integration tests, and collaborate directly " +
      "with customers on the features they want most. 2–4 years of full stack " +
      "experience with React and Node.js expected.",
    atsType: "ashby",
    salaryMin: 120000,
    salaryMax: 155000,
    postedAt: new Date("2026-06-10"),
  },

  // Principal PM
  {
    source: "fixtures",
    sourceId: "cloudpeak-ppm-010",
    url: "https://jobs.lever.co/cloudpeak/ppm-010",
    company: "CloudPeak",
    title: "Principal Product Manager",
    location: "San Francisco, CA",
    remote: false,
    description:
      "CloudPeak is a developer cloud platform competing in the IaaS/PaaS space, " +
      "backed by Tier 1 VCs. The Principal Product Manager is an executive-track IC " +
      "position owning our compute and networking products. You will set multi-year " +
      "strategy, define OKRs, partner with engineering and sales, and represent product " +
      "in board-level conversations. 8+ years of product management experience and " +
      "prior experience shipping developer-facing infrastructure products required.",
    atsType: "lever",
    salaryMin: 220000,
    salaryMax: 290000,
    postedAt: new Date("2026-05-28"),
  },
];

// --- Source adapter ------------------------------------------------------------

export const fixturesSource: JobSource = {
  name: "fixtures",

  enabled(): boolean {
    return process.env.JOBS_USE_FIXTURES !== "0";
  },

  async fetch(query: string): Promise<RawJob[]> {
    if (!query.trim()) return fixtureJobs;
    const q = query.toLowerCase();
    return fixtureJobs.filter(
      (job) =>
        job.title.toLowerCase().includes(q) ||
        job.description.toLowerCase().includes(q),
    );
  },
};
