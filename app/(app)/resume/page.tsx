import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { scopeWhere } from "@/lib/profiles/scope";
import { safeDb } from "@/lib/safe";
import { DbBanner } from "@/components/db-banner";
import {
  ResumeWorkspace,
  type TargetWithVersions,
} from "@/components/resume/resume-workspace";
import { renderResumeHtml } from "@/lib/resume/render";
import { applySkimLayout } from "@/lib/resume/skim-layout";
import { scoreScreening } from "@/lib/resume/screening-score";
import { generateRecruiterSummary } from "@/lib/resume/recruiter-summary";
import { tailoredResumeSchema } from "@/lib/resume/schema";
import type { ProvenanceViolation } from "@/lib/resume/provenance";

export const dynamic = "force-dynamic";

export default async function ResumePage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; title?: string }>;
}) {
  const params = await searchParams;
  const skimCompany = params.company?.trim();
  const skimTitle = params.title?.trim();
  const { data: targets, dbError } = await safeDb<TargetWithVersions[]>(
    async () => {
      const { scope } = await getAppContext();
      const raw = await db.target.findMany({
        where: scopeWhere(scope),
        orderBy: { createdAt: "desc" },
        include: {
          resumeVersions: { orderBy: { createdAt: "desc" }, take: 1 },
          coverLetters: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });

      return raw.map((t) => {
        const rv = t.resumeVersions[0];
        const cl = t.coverLetters[0];
        const out: TargetWithVersions = {
          id: t.id,
          title: t.title,
          company: t.company,
        };

        if (rv) {
          const parsed = tailoredResumeSchema.safeParse(rv.data);
          if (parsed.success) {
            const skim = applySkimLayout(parsed.data);
            const screening = scoreScreening({
              resume: skim.resume,
              jobDescription: t.jobDescription,
            });
            out.latestResume = {
              createdAt: rv.createdAt.toISOString(),
              provenanceOk: rv.provenanceOk,
              html: renderResumeHtml(skim.resume),
              skimHtml: renderResumeHtml(skim.resume, {
                highlightSkim: skim.zone,
              }),
              screening,
              recruiterSummary: generateRecruiterSummary({
                resume: skim.resume,
                screening,
                jobTitle: t.title,
                company: t.company,
              }),
              violations: Array.isArray(rv.violations)
                ? (rv.violations as unknown as ProvenanceViolation[])
                : [],
            };
          } else {
            out.latestResume = {
              createdAt: rv.createdAt.toISOString(),
              provenanceOk: rv.provenanceOk,
              html: "",
              skimHtml: "",
              screening: scoreScreening({
                resume: {
                  name: "",
                  headline: "",
                  contact: {},
                  experience: [],
                  education: [],
                  skills: [],
                  forJobTitle: t.title,
                  forCompany: t.company,
                },
                jobDescription: t.jobDescription,
              }),
              violations: [],
            };
          }
        }

        if (cl) {
          out.latestCover = {
            createdAt: cl.createdAt.toISOString(),
            provenanceOk: cl.provenanceOk,
            body: cl.body,
            wordCount: cl.wordCount,
          };
        }

        return out;
      });
    },
    [],
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Tailored resume</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {skimCompany && skimTitle ? (
            <>
              Recruiter skim for{" "}
              <span className="text-foreground">
                {skimTitle} at {skimCompany}
              </span>
              . A truthful, one-page preview built only from your profile.
            </>
          ) : (
            <>
              A truthful, one-page resume for a specific role, safe for resume
              scanners. Built only from your profile, with every claim checked
              against its source.
            </>
          )}
        </p>
      </header>
      {dbError && <DbBanner />}
      <ResumeWorkspace
        targets={targets}
        initialCompany={skimCompany}
        initialTitle={skimTitle}
      />
    </main>
  );
}
