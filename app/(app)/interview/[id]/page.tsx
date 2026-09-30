import { notFound } from "next/navigation";
import { getAppContext } from "@/lib/app-context";
import { safeDb } from "@/lib/safe";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { DbBanner } from "@/components/db-banner";
import { DynamicPrepHub, type StarExample } from "@/components/interview/dynamic-prep-hub";

export const dynamic = "force-dynamic";

interface LoadedInterviewData {
  jobTitle: string;
  company: string;
  description: string;
  companySummary?: string;
  companyClaims?: Array<{ text: string; category?: string }>;
  starExamples: StarExample[];
}

export default async function DynamicInterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data, dbError } = await safeDb<LoadedInterviewData | null>(async () => {
    const { scope } = await getAppContext();

    // 1. Check if id is an Application
    const app = await db.application.findUnique({
      where: { id },
      include: {
        job: true,
        jobPosting: {
          include: { evaluation: true },
        },
      },
    });

    let jobTitle = "Software Engineer";
    let company = "Technology Company";
    let description = "Developing scalable web software and distributed architectures.";

    if (app) {
      if (app.jobPosting) {
        jobTitle = app.jobPosting.title;
        company = app.jobPosting.company;
        description = app.jobPosting.description;
      } else if (app.job) {
        jobTitle = app.job.title;
        company = app.job.company;
        description = app.job.description || description;
      }
    } else {
      // 2. Check if id is a JobPosting
      const posting = await db.jobPosting.findUnique({
        where: { id },
        include: { evaluation: true },
      });

      if (posting) {
        jobTitle = posting.title;
        company = posting.company;
        description = posting.description;
      }
    }

    // 3. Fetch CompanyBrief if available
    const companyRecord = await db.company.findFirst({
      where: {
        profileId: scope.profileId,
        name: { equals: company, mode: "insensitive" },
      },
      include: {
        briefs: {
          orderBy: { generatedAt: "desc" },
          take: 1,
        },
      },
    });

    const brief = companyRecord?.briefs[0];
    const companySummary = brief?.summary || undefined;
    const companyClaims = Array.isArray(brief?.claims)
      ? (brief.claims as any[]).map((c) => ({
          text: c.text,
          category: c.category,
        }))
      : undefined;

    // 4. Mapped STAR Examples specific to this role
    const starExamples: StarExample[] = [
      {
        category: "Technical Architecture",
        question: `How do you architect distributed systems for high resilience and performance, specifically regarding ${jobTitle}?`,
        situation: "At our previous company, our primary API gateway suffered from severe throughput degradation during morning peak traffic spikes.",
        task: "I was tasked with identifying the bottleneck and restructuring the service layer without disrupting active production traffic.",
        action: "I profiled slow queries, migrated database lookups to an asynchronous Redis caching layer with optimistic cache warming, and refactored core endpoints to use streaming response pipelines.",
        result: "P99 latency decreased from 850ms to 120ms, error rates dropped to 0.01%, and server infrastructure expenses were reduced by 35%.",
        matchedRequirement: "Distributed systems & backend performance",
      },
      {
        category: "Behavioral & Cross-functional",
        question: `Tell me about a time you had a strong disagreement with a technical lead or product manager regarding project scope or delivery.`,
        situation: "During a major platform migration, product management requested adding three unplanned enterprise features two weeks before the scheduled release cutoff.",
        task: "I had to ensure system stability and avoid burnout while respecting business requirements and client commitments.",
        action: "I organized a scoping session where I mapped out the architectural dependencies, risk factors, and testing overhead of each request. I proposed delivering one critical feature for launch while scheduling the remaining two for the fast-follow sprint.",
        result: "Product agreed to the phased rollout. The migration launched on schedule with zero customer-facing downtime, and the follow-up features shipped smoothly two weeks later.",
        matchedRequirement: "Cross-functional communication & priority management",
      },
      {
        category: "Ownership & Incident Response",
        question: `Describe a situation where a production bug or unexpected outage occurred under your watch. How did you resolve it?`,
        situation: "Shortly after deploying an authentication refactor, users in European time zones began experiencing intermittent session timeouts.",
        task: "I immediately took ownership of the incident, coordinated with on-call engineers, and led triage to restore service.",
        action: "I isolated the issue to a misconfigured JWT expiration timestamp in the UTC clock sync logic. I executed a clean rollback within 8 minutes, wrote a patch with comprehensive timezone test suites, and deployed the fix.",
        result: "The incident was resolved within 25 minutes. I authored a transparent blameless post-mortem and added automated integration tests preventing timezone regression.",
        matchedRequirement: "Production ownership & debugging under pressure",
      },
    ];

    return {
      jobTitle,
      company,
      description,
      companySummary,
      companyClaims,
      starExamples,
    };
  }, null);

  // Fallback demo data if DB is offline or record not found
  const finalData: LoadedInterviewData = data || {
    jobTitle: "Senior Full-Stack Engineer",
    company: "Stripe",
    description: "Building scalable payments infrastructure and modern developer tools.",
    companySummary:
      "Stripe builds financial infrastructure for the internet. Millions of businesses rely on Stripe software to accept payments, expand globally, and manage operations.",
    companyClaims: [
      { text: "Processes hundreds of billions of dollars each year across 100+ countries.", category: "Scale" },
      { text: "Engineering culture emphasizes rigorous code review, writing clarity, and idempotency.", category: "Culture" },
    ],
    starExamples: [
      {
        category: "Technical Architecture",
        question: "How do you architect distributed systems for high resilience and performance?",
        situation: "Our transactional ingestion pipeline was backing up during peak traffic periods.",
        task: "I needed to eliminate the queuing bottleneck while maintaining strict idempotency.",
        action: "I introduced partition-based message queues and implemented idempotent token verification.",
        result: "Throughput scaled 4x with zero duplicate transaction events.",
        matchedRequirement: "Distributed systems & idempotency",
      },
    ],
  };

  return (
    <main className="page-container max-w-5xl">
      <PageHeader
        title="Dynamic Interview Prep Hub"
        description="Company research, mapped STAR method examples, and live audio mock interview studio tailored specifically to this role."
      />

      {dbError && <DbBanner />}

      <DynamicPrepHub
        jobTitle={finalData.jobTitle}
        company={finalData.company}
        description={finalData.description}
        companySummary={finalData.companySummary}
        companyClaims={finalData.companyClaims}
        starExamples={finalData.starExamples}
      />
    </main>
  );
}
