import { getAppContext } from "@/lib/app-context";
import { safeDb } from "@/lib/safe";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { DbBanner } from "@/components/db-banner";
import { JobFeed } from "@/components/feed/job-feed";
import type { EvaluatedJob } from "@/components/feed/one-click-apply-modal";
import type { SkillGapItem } from "@/components/feed/skill-gap-heatmap";

export const dynamic = "force-dynamic";

const SAMPLE_EVALUATED_JOBS: EvaluatedJob[] = [
  {
    id: "sample_1",
    url: "https://boards.greenhouse.io/stripe/jobs/567890",
    title: "Senior Full-Stack Engineer, Connect",
    company: "Stripe",
    location: "Remote (US)",
    description:
      "Stripe is looking for a Senior Full-Stack Engineer to architect resilient distributed payment systems. You will lead development in TypeScript, React, Node.js, and PostgreSQL.",
    fitScore: 94,
    pros: [
      "Extensive production experience in TypeScript, React, and Node.js",
      "Proven track record building microservices and relational schemas",
      "Matches remote preference and exceeds minimum base compensation requirement",
    ],
    cons: [
      "Preferred 3+ years experience with high-throughput distributed ledger transactions",
      "Stripe uses Ruby on Rails for core services alongside TypeScript",
    ],
    missingKeywords: ["Ruby on Rails", "Distributed Transactions", "Kafka", "Idempotency"],
  },
  {
    id: "sample_2",
    url: "https://jobs.lever.co/vercel/123456",
    title: "Platform Engineer, AI SDK & Next.js",
    company: "Vercel",
    location: "San Francisco, CA / Remote",
    description:
      "Help build the future of the web and AI applications. We are seeking a Platform Engineer fluent in Next.js App Router, edge runtimes, streaming AI interfaces, and TypeScript.",
    fitScore: 88,
    pros: [
      "Direct mastery of Next.js App Router architecture and server components",
      "Strong background in LLM orchestration and streaming API integrations",
      "Aligned with team culture of shipping high-polish user experiences",
    ],
    cons: [
      "Requires familiarity with V8 isolates and Cloudflare Workers runtime internals",
    ],
    missingKeywords: ["Edge Runtime", "WebAssembly", "Cloudflare Workers"],
  },
  {
    id: "sample_3",
    url: "https://jobs.ashbyhq.com/linear/45678",
    title: "Product Engineer, Desktop & Sync Engine",
    company: "Linear",
    location: "Remote",
    description:
      "Build high-performance, local-first software. Requires deep expertise with SQLite, CRDT synchronization, React, and Tauri/Electron architectures.",
    fitScore: 76,
    pros: [
      "Strong frontend systems intuition and focus on snappy keyboard-first UX",
      "Proficient in local data persistence and reactive UI states",
    ],
    cons: [
      "Limited direct production history with CRDT algorithms (Yjs / Automerge)",
      "Role prefers experience with Rust for desktop client extensions",
    ],
    missingKeywords: ["CRDT", "Rust", "SQLite Sync", "Tauri"],
  },
];

const SAMPLE_SKILL_GAPS: SkillGapItem[] = [
  {
    skill: "CRDT & Local-First Sync",
    category: "Architecture",
    frequencyCount: 4,
    priority: 1,
    status: "IN_PROGRESS",
    curriculum: [
      {
        title: "Local-First Software: You Own Your Data, in spite of the Cloud (Kleppmann et al.)",
        url: "https://www.inkandswitch.com/local-first/",
        resourceType: "Paper",
      },
      {
        title: "Yjs CRDT Framework Documentation & Tutorials",
        url: "https://docs.yjs.dev/",
        resourceType: "Documentation",
      },
    ],
  },
  {
    skill: "Rust Systems Programming",
    category: "Languages",
    frequencyCount: 3,
    priority: 2,
    status: "PLANNED",
    curriculum: [
      {
        title: "The Rust Programming Language Book",
        url: "https://doc.rust-lang.org/book/",
        resourceType: "Book",
      },
    ],
  },
  {
    skill: "Kafka & Event Streaming",
    category: "Infrastructure",
    frequencyCount: 3,
    priority: 2,
    status: "PLANNED",
    curriculum: [
      {
        title: "Apache Kafka Quickstart and Architecture",
        url: "https://kafka.apache.org/quickstart",
        resourceType: "Documentation",
      },
    ],
  },
];

export default async function FeedPage() {
  const { data, dbError } = await safeDb<{
    jobs: EvaluatedJob[];
    skillGaps: SkillGapItem[];
  }>(async () => {
    const { scope } = await getAppContext();

    const [postings, learningGoals] = await Promise.all([
      db.jobPosting.findMany({
        where: { profileId: scope.profileId },
        include: {
          evaluation: true,
        },
        orderBy: {
          evaluation: {
            fitScore: "desc",
          },
        },
      }),
      db.learningGoal.findMany({
        where: { profileId: scope.profileId },
        orderBy: [{ priority: "desc" }, { frequencyCount: "desc" }],
      }),
    ]);

    const mappedJobs: EvaluatedJob[] = postings.map((p) => ({
      id: p.id,
      url: p.url,
      title: p.title,
      company: p.company,
      location: p.location,
      description: p.description,
      fitScore: p.evaluation?.fitScore ?? 50,
      pros: p.evaluation?.pros ?? [],
      cons: p.evaluation?.cons ?? [],
      missingKeywords: p.evaluation?.missingKeywords ?? [],
    }));

    const mappedGaps: SkillGapItem[] = learningGoals.map((g) => ({
      id: g.id,
      skill: g.skill,
      category: g.category,
      frequencyCount: g.frequencyCount,
      priority: g.priority,
      status: g.status,
      curriculum: Array.isArray(g.curriculum)
        ? (g.curriculum as Array<{ title: string; url: string; resourceType?: string }>)
        : [],
    }));

    return {
      jobs: mappedJobs,
      skillGaps: mappedGaps,
    };
  }, { jobs: [], skillGaps: [] });

  const finalJobs = data.jobs.length > 0 ? data.jobs : SAMPLE_EVALUATED_JOBS;
  const finalGaps = data.skillGaps.length > 0 ? data.skillGaps : SAMPLE_SKILL_GAPS;

  return (
    <main className="page-container">
      <PageHeader
        title="Autonomous JEV Feed"
        description="Jobs ranked strictly by JEV's fit score. Transparent pros, honest gaps, real-time Drafter-Reviewer application generation, and continuous upskilling curricula."
      />

      {dbError && <DbBanner />}

      <JobFeed initialJobs={finalJobs} initialSkillGaps={finalGaps} />
    </main>
  );
}
