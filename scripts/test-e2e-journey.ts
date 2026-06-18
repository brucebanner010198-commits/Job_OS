/**
 * E2E Journey Orchestrator - verifies the full Job OS user journey.
 * Uses fixture/mocks where LLM or OAuth are unavailable; exercises DB paths when
 * DATABASE_URL is reachable.
 *
 * Run: npm run test:e2e-journey
 */
import fs from "node:fs";
import path from "node:path";
import { ProfileEntryKind } from "@prisma/client";
import { db } from "@/lib/db";
import { getPrimaryUser } from "@/lib/user";
import { getSecret } from "@/lib/secrets";
import {
  createProfile,
  deleteProfile,
  ensureDefaultProfile,
} from "@/lib/profiles/service";
import { scopeData } from "@/lib/profiles/scope";
import {
  addEntries,
  listFacts,
  saveNote,
  toFacts,
} from "@/lib/profile/service";
import { flattenFact } from "@/lib/profile/types";
import { importResumeText } from "@/lib/import/import";
import { extractFromDictation } from "@/lib/profile/extract";
import { upsertGoal, getGoal, nonSensitiveProfileText } from "@/lib/goals/service";
import { goalText, type CareerGoalData } from "@/lib/goals/types";
import { goalAwareRelevance } from "@/lib/scoring/relevance";
import { ingestAndScore, listQueue, previewQueue } from "@/lib/jobs/service";
import { composeBrief } from "@/lib/brief/compose";
import { proposeCandidates } from "@/lib/brief/candidates";
import { briefFixtures } from "@/lib/brief/sources";
import { auditProvenance, type SourceEntry } from "@/lib/resume/provenance";
import type { TailoredResume } from "@/lib/resume/schema";
import { applySkimLayout } from "@/lib/resume/skim-layout";
import { scoreScreening } from "@/lib/resume/screening-score";
import { saveTailoredResume } from "@/lib/resume/service";
import { auditCoverLetterProvenance } from "@/lib/coverletter/provenance";
import { validateCoverLetterStandards } from "@/lib/coverletter/standards";
import { saveCoverLetter } from "@/lib/coverletter/service";
import { buildApplyPlan, canSubmit } from "@/lib/apply/engine";
import { previewRouteFromJob } from "@/lib/pipeline/route-preview";
import { fixtureJobs } from "@/lib/jobs/sources/fixtures";
import { getGmailSource } from "@/lib/gmail/index";
import { processEmails, previewTrack } from "@/lib/track/pipeline";
import { fixtureApps } from "@/lib/track/fixtures";
import { previewInterview } from "@/lib/interview/pipeline";
import { buildPersona } from "@/lib/interview/persona";
import { fixturePrep } from "@/lib/interview/fixtures";
import { fixtureVoiceSource } from "@/lib/interview/voice-fixture";
import { selectVoiceProvider } from "@/lib/interview/index";
import type { AppScope } from "@/lib/profiles/types";

const E2E_TAG = "e2e-journey";
const NOW = new Date("2026-06-18T12:00:00Z");

const FIXTURE_RESUME =
  "Jane Doe\nSenior Backend Engineer\n\n" +
  "Acme Corp (2020–Present): Built Go microservices on Postgres; cut p95 latency 40%.\n" +
  "Skills: Go, Postgres, distributed systems, APIs, reliability.";

const FIXTURE_DICTATION =
  "I just shipped a payments rewrite at Acme that cut checkout errors by 25%.";

const managerGoal: CareerGoalData = {
  northStar: "VP of Engineering",
  summary: "Move from IC into people leadership.",
  targetTitles: ["Engineering Manager", "Director of Engineering"],
  targetIndustries: ["fintech"],
  milestones: [
    { horizon: "SIX_MONTHS", text: "Start managing a small backend team" },
    { horizon: "ONE_YEAR", text: "Own hiring and mentorship" },
    { horizon: "TWO_YEARS", text: "Lead a platform org" },
    { horizon: "THREE_YEARS", text: "Director of Engineering" },
    { horizon: "FOUR_YEARS", text: "Run multiple teams" },
    { horizon: "FIVE_YEARS", text: "Senior engineering leadership" },
    { horizon: "TEN_YEARS", text: "VP of Engineering" },
  ],
};

interface StepResult {
  step: number;
  name: string;
  status: "pass" | "fail" | "skip";
  mode: "live" | "fixture" | "offline";
  notes: string[];
}

const results: StepResult[] = [];
let dbAvailable = false;

function record(
  step: number,
  name: string,
  status: StepResult["status"],
  mode: StepResult["mode"],
  notes: string[] = [],
): void {
  results.push({ step, name, status, mode, notes });
  const icon = status === "pass" ? "✓" : status === "fail" ? "✗" : "○";
  console.log(`\n[${step}] ${icon} ${name} (${mode})`);
  for (const n of notes) console.log(`    ${n}`);
}

async function dbPing(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function cleanupScope(scope: AppScope): Promise<void> {
  await db.profileEntry.deleteMany({
    where: { userId: scope.userId, profileId: scope.profileId, sourceNote: E2E_TAG },
  });
  await db.profileNote.deleteMany({
    where: {
      userId: scope.userId,
      profileId: scope.profileId,
      source: { in: ["import", "dictation"] },
      rawText: { contains: E2E_TAG },
    },
  });
  await db.careerGoal.deleteMany({ where: { profileId: scope.profileId } });
  await db.target.deleteMany({
    where: {
      userId: scope.userId,
      profileId: scope.profileId,
      company: { startsWith: "E2E-" },
    },
  });
}

// --- Step 1: Import resume → ProfileEntry ------------------------------------

async function step1Import(scope: AppScope): Promise<void> {
  const name = "Upload/import master resume → ProfileEntry populated";
  const notes: string[] = [];
  let ok = false;
  let mode: StepResult["mode"] = "fixture";

  await cleanupScope(scope);

  const apiKey = await getSecret("OPENROUTER_API_KEY");
  if (apiKey) {
    try {
      const res = await importResumeText(scope, `${E2E_TAG}\n${FIXTURE_RESUME}`);
      const entries = await listFacts(scope);
      ok = res.added > 0 && entries.length > 0;
      mode = "live";
      notes.push(`live importResumeText added ${res.added} entries`);
      notes.push(`kinds: ${res.kinds.join(", ")}`);
    } catch (err) {
      notes.push(`live import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    notes.push("OPENROUTER_API_KEY unset - using fixture seed");
  }

  if (!ok) {
    await saveNote(scope, `${E2E_TAG} resume import`, null, "import");
    const added = await addEntries(scope, [
      {
        kind: ProfileEntryKind.EXPERIENCE,
        data: {
          title: "Senior Backend Engineer",
          company: "Acme Corp",
          start: "2020-01",
          end: "present",
          bullets: ["Built Go services; cut p95 latency 40%"],
        },
        sourceNote: E2E_TAG,
      },
      {
        kind: ProfileEntryKind.SKILL,
        data: { name: "Backend", skills: ["Go", "Postgres", "distributed systems"] },
        sourceNote: E2E_TAG,
      },
    ]);
    const entries = await listFacts(scope);
    ok = added === 2 && entries.some((e) => e.sourceNote === E2E_TAG);
    mode = "fixture";
    notes.push(`fixture seed added ${added} entries`);
  }

  record(1, name, ok ? "pass" : "fail", mode, notes);
}

// --- Step 2: Voice dictation updates resume ----------------------------------

async function step2Dictation(scope: AppScope): Promise<void> {
  const name = "Voice dictation updates resume";
  const notes: string[] = [];
  let ok = false;
  let mode: StepResult["mode"] = "fixture";

  const before = (await listFacts(scope)).length;
  const apiKey = await getSecret("OPENROUTER_API_KEY");

  if (apiKey) {
    try {
      const extracted = await extractFromDictation(`${E2E_TAG} ${FIXTURE_DICTATION}`);
      await saveNote(scope, `${E2E_TAG} ${FIXTURE_DICTATION}`, null, "dictation");
      await addEntries(
        scope,
        extracted.entries.map((e) => ({
          kind: e.kind as ProfileEntryKind,
          data: e.data,
          sensitive: e.sensitive,
          sourceNote: E2E_TAG,
        })),
      );
      const after = (await listFacts(scope)).length;
      ok = after > before && extracted.entries.length > 0;
      mode = "live";
      notes.push(`live dictation extracted ${extracted.entries.length} entries`);
    } catch (err) {
      notes.push(`live dictation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    notes.push("OPENROUTER_API_KEY unset - using fixture dictation seed");
  }

  if (!ok) {
    await saveNote(scope, `${E2E_TAG} ${FIXTURE_DICTATION}`, null, "dictation");
    const added = await addEntries(scope, [
      {
        kind: ProfileEntryKind.ACHIEVEMENT,
        data: { text: "Cut checkout errors 25% via payments rewrite at Acme" },
        sourceNote: E2E_TAG,
      },
    ]);
    const after = (await listFacts(scope)).length;
    ok = added === 1 && after > before;
    mode = "fixture";
    notes.push("fixture dictation achievement entry added");
  }

  record(2, name, ok ? "pass" : "fail", mode, notes);
}

// --- Step 3: Career goals → scoring uses goals -------------------------------

async function step3Goals(scope: AppScope): Promise<void> {
  const name = "Career goals saved → scoring uses goals";
  const notes: string[] = [];

  await upsertGoal(scope, managerGoal, `${E2E_TAG} goals`);
  const saved = await getGoal(scope);
  const resumeText = await nonSensitiveProfileText(scope);

  const mlGoal: CareerGoalData = {
    ...managerGoal,
    northStar: "Principal ML Engineer",
    targetTitles: ["Machine Learning Engineer"],
    summary: "Deep technical ML path",
  };

  const backendJob =
    "Engineering Manager role leading backend teams, hiring, mentorship, fintech.";
  const mlJob =
    "Machine Learning Engineer training models, LLM applications, MLOps pipelines.";

  const withManager = goalAwareRelevance(backendJob, {
    resumeText,
    goalText: goalText(managerGoal),
  });
  const withMlOnBackend = goalAwareRelevance(backendJob, {
    resumeText,
    goalText: goalText(mlGoal),
  });
  const goalsRerank = withManager.relevance > withMlOnBackend.relevance;

  const noGoals = previewQueue({
    resumeText,
    goalText: "",
    profileText: resumeText,
    now: NOW,
  });
  const withGoals = previewQueue({
    resumeText,
    goalText: goalText(managerGoal),
    profileText: resumeText,
    now: NOW,
  });
  const queueDiffers =
    noGoals.queue[0]?.id !== withGoals.queue[0]?.id ||
    noGoals.queue[0]?.relevanceDriver !== withGoals.queue[0]?.relevanceDriver;

  const goalsInQueue = withGoals.queue.some(
    (j) => j.relevanceDriver === "goals" || j.relevanceDriver === "both",
  );
  const ok = Boolean(saved?.northStar) && goalsRerank && (queueDiffers || goalsInQueue);
  if (saved) notes.push(`saved northStar: ${saved.northStar}`);
  notes.push(
    `EM job relevance manager=${withManager.relevance.toFixed(3)} ml=${withMlOnBackend.relevance.toFixed(3)}`,
  );
  notes.push(
    `queue top: no-goals=${noGoals.queue[0]?.title} / with-goals=${withGoals.queue[0]?.title}`,
  );

  record(3, name, ok ? "pass" : "fail", dbAvailable ? "live" : "offline", notes);
}

// --- Step 4: Job discovery → scored queue ------------------------------------

async function step4Jobs(scope: AppScope): Promise<void> {
  const name = "Job discovery (OSS sources) → scored queue";
  const notes: string[] = [];

  const resumeText = await nonSensitiveProfileText(scope);
  const gt = goalText(managerGoal);
  const preview = previewQueue({
    resumeText,
    goalText: gt,
    profileText: resumeText,
    now: NOW,
  });

  const previewOk =
    preview.queue.length > 0 &&
    preview.queue.every((j, i, arr) => i === 0 || (j.score ?? 0) <= (arr[i - 1].score ?? 0));

  notes.push(`offline preview queue: ${preview.queue.length} jobs`);
  notes.push(`filtered audit: ${preview.filtered.length}`);

  let dbOk = false;
  if (dbAvailable) {
    const ingest = await ingestAndScore(scope, "backend engineer go postgres");
    const queue = await listQueue(scope);
    dbOk =
      ingest.kept > 0 &&
      queue.length > 0 &&
      queue.every((j, i, arr) => i === 0 || j.score <= arr[i - 1].score);
    notes.push(`DB ingest: ${ingest.ingested} raw, ${ingest.kept} kept, queue=${queue.length}`);
    if (queue[0]) {
      notes.push(`top job: ${queue[0].title} @ ${queue[0].company} score=${queue[0].score}`);
    }
  } else {
    notes.push("DB unavailable - offline preview only");
  }

  const ok = previewOk && (dbAvailable ? dbOk : true);
  record(4, name, ok ? "pass" : "fail", dbAvailable ? "live" : "offline", notes);
}

// --- Step 5: Company brief with citations ------------------------------------

async function step5Brief(): Promise<void> {
  const name = "Company brief generated with citations";
  const notes: string[] = [];

  const sources = briefFixtures["Acme AI"];
  const candidates = proposeCandidates(sources);
  const brief = composeBrief({
    company: { name: "Acme AI", domain: "acme.ai" },
    candidates,
    sources,
    now: NOW,
  });

  const hasVerified = brief.claims.some((c) => c.status === "verified");
  const allCited = brief.claims.every((c) => c.sources.length > 0);
  const ok = brief.claims.length > 0 && hasVerified && allCited;

  notes.push(`claims=${brief.claims.length}, refused=${brief.refused.length}`);
  notes.push(`verified claims=${brief.claims.filter((c) => c.status === "verified").length}`);

  record(5, name, ok ? "pass" : "fail", "offline", notes);
}

// --- Step 6: Tailor resume + cover letter ----------------------------------

async function step6Tailor(scope: AppScope): Promise<void> {
  const name = "Tailor resume + cover letter for a job";
  const notes: string[] = [];

  const facts = toFacts(await listFacts(scope)).filter((f) => !f.sensitive);
  const expFact = facts.find((f) => f.kind === "EXPERIENCE") ?? facts[0];
  if (!expFact) {
    record(6, name, "fail", "fixture", ["no profile facts to tailor against"]);
    return;
  }

  const job = fixtureJobs.find((j) => j.sourceId === "acme-sbe-001")!;
  const target = await db.target.create({
    data: {
      ...scopeData(scope),
      title: job.title,
      company: `E2E-${job.company}`,
      jobDescription: job.description,
      sourceUrl: job.url,
    },
  });

  const sources: SourceEntry[] = facts.map((f) => ({
    id: f.id,
    text: flattenFact(f),
  }));

  const tailored: TailoredResume = {
    name: "Jane Doe",
    headline: job.title,
    contact: { email: "jane@example.com" },
    experience: [
      {
        title: "Senior Backend Engineer",
        company: "Acme Corp",
        start: "01/2020",
        end: "Present",
        bullets: [{ text: "Cut p95 latency 40% building Go services", sources: [expFact.id] }],
        sources: [expFact.id],
      },
    ],
    education: [],
    skills: [],
    forJobTitle: job.title,
    forCompany: job.company,
  };

  const provenance = auditProvenance(tailored, sources);
  const skim = applySkimLayout(tailored);
  const screening = scoreScreening({
    resume: skim.resume,
    jobDescription: job.description,
  });
  const resumeId = await saveTailoredResume(scope, target.id, {
    resume: skim.resume,
    provenance,
    screening,
    skim,
    exportable: provenance.ok,
  });

  const coverBody =
    `When I led backend services at Acme Corp, we cut p95 latency 40% - the kind of ` +
    `measurable reliability outcome ${job.company} needs for its ${job.title} opening.\n\n` +
    `Your posting emphasizes Go, Postgres, and distributed systems. I built high-throughput ` +
    `APIs with on-call ownership and shipped migrations without downtime.\n\n` +
    `I would welcome a conversation about contributing to your infrastructure team.`;

  const coverAudit = auditCoverLetterProvenance({
    body: coverBody,
    usedFactIds: [expFact.id],
    allowedFacts: facts,
  });
  const coverId = await saveCoverLetter(scope, target.id, {
    body: coverBody,
    wordCount: coverBody.split(/\s+/).length,
    provenanceOk: coverAudit.ok,
    violations: [],
    genericnessFlag: false,
    standards: validateCoverLetterStandards({
      body: coverBody,
      company: job.company,
      jobTitle: job.title,
      wordCount: coverBody.split(/\s+/).length,
      provenanceOk: coverAudit.ok,
    }),
    requiresHumanEdit: true,
  });

  const ok = provenance.ok && coverAudit.ok && Boolean(resumeId) && Boolean(coverId);
  notes.push(`resume provenance ok=${provenance.ok}, cover provenance ok=${coverAudit.ok}`);
  notes.push(`saved resumeVersion=${resumeId.slice(0, 8)}… coverLetter=${coverId.slice(0, 8)}…`);

  record(6, name, ok ? "pass" : "fail", "fixture", notes);
}

// --- Step 7: Apply prepare → REVIEW gate → route tags ------------------------

async function step7Apply(): Promise<void> {
  const name = "Apply prepare → REVIEW gate → route tags";
  const notes: string[] = [];

  const job = fixtureJobs.find((j) => j.sourceId === "acme-sbe-001")!;
  const linkedinJob = fixtureJobs.find((j) => j.sourceId === "linkedin-67890")!;

  const qualifiedAnswers = {
    workAuthorized: true,
    requiresSponsorship: false,
    yearsExperience: 6,
    willingToRelocate: false,
    remoteOnly: true,
    locations: ["Remote"] as string[],
    salaryExpectation: 155000,
    salaryCurrency: "USD",
    noticePeriod: "2 weeks",
    hasClearance: false,
    linkedinUrl: "https://linkedin.com/in/sample",
    githubUrl: "https://github.com/sample",
    websiteUrl: "https://sample.dev",
    customAnswers: [] as [],
  };

  const plan = buildApplyPlan({
    jobText: job.description,
    answers: qualifiedAnswers,
    contact: { name: "Jane Doe", email: "jane@example.com" },
    signals: { url: job.url!, host: "acmecloud.example", markers: [], hasLoginForm: false, hasCaptcha: false },
    local: true,
    surface: "greenhouse",
  });

  const linkedinPlan = buildApplyPlan({
    jobText: linkedinJob.description,
    answers: qualifiedAnswers,
    contact: { name: "Jane Doe", email: "jane@example.com" },
    signals: { url: linkedinJob.url!, host: "linkedin.example", markers: [], hasLoginForm: false, hasCaptcha: false },
    local: true,
    surface: "linkedin",
  });

  const routeTag = previewRouteFromJob({
    source: job.source,
    url: job.url,
    atsType: job.atsType,
  });

  const ok =
    plan.nextState === "REVIEW" &&
    canSubmit("REVIEW") &&
    !canSubmit("QUEUED") &&
    plan.route === "ASSISTED" &&
    linkedinPlan.route === "MANUAL" &&
    routeTag === "ASSISTED";

  notes.push(`greenhouse plan: route=${plan.route} nextState=${plan.nextState}`);
  notes.push(`linkedin plan: route=${linkedinPlan.route}`);
  notes.push(`queue routePreview for greenhouse job: ${routeTag}`);
  notes.push(`canSubmit(REVIEW)=${canSubmit("REVIEW")}`);

  record(7, name, ok ? "pass" : "fail", "offline", notes);
}

// --- Step 8: Gmail proposal flow ---------------------------------------------

async function step8Gmail(): Promise<void> {
  const name = "Gmail proposal flow (mock if no OAuth)";
  const notes: string[] = [];

  const source = await getGmailSource();
  const emails = await source.listJobEmails();
  const processed = processEmails(emails, fixtureApps);
  const proposals = processed.filter((p) => p.proposal !== null);
  const trackPreview = previewTrack();

  const ok =
    !source.isLive &&
    emails.length > 0 &&
    proposals.length > 0 &&
    trackPreview.proposals.length > 0;

  notes.push(`source=${source.id} live=${source.isLive}`);
  notes.push(`emails=${emails.length}, proposals=${proposals.length}`);
  notes.push(`track preview proposals=${trackPreview.proposals.length}`);

  record(8, name, ok ? "pass" : "fail", source.isLive ? "live" : "fixture", notes);
}

// --- Step 9: Study guide + interview voice fixture session -------------------

async function step9Interview(): Promise<void> {
  const name = "Study guide + interview voice fixture session";
  const notes: string[] = [];

  const board = previewInterview();
  const prep = board.preps[0];
  const persona = buildPersona("AI_SCREEN", fixturePrep);
  const grant = await fixtureVoiceSource().grant("AI_SCREEN", persona, 600);
  const provider = selectVoiceProvider({ elevenOk: false, localOk: false });

  const ok =
    board.preps.length > 0 &&
    (prep?.guide.questions.length ?? 0) >= 5 &&
    grant.provider === "fixture" &&
    grant.mock !== undefined &&
    (grant.mock.turns?.length ?? 0) > 0 &&
    provider === "fixture";

  notes.push(`preps=${board.preps.length}, questions=${prep?.guide.questions.length}`);
  notes.push(`voice provider=${provider}, grant.mock turns=${grant.mock?.turns?.length ?? 0}`);
  notes.push(`provenanceOk=${prep?.guide.provenanceOk}`);

  record(9, name, ok ? "pass" : "fail", "fixture", notes);
}

// --- Step 10: Multi-profile isolation smoke ----------------------------------

async function step10Profiles(userId: string, defaultProfileId: string): Promise<void> {
  const name = "Multi-profile isolation smoke";
  const notes: string[] = [];

  const testName = `E2E-Iso-${Date.now()}`;
  const second = await createProfile(userId, testName);

  const scopeA: AppScope = { userId, profileId: defaultProfileId };
  const scopeB: AppScope = { userId, profileId: second.id };

  await addEntries(scopeA, [
    { kind: ProfileEntryKind.SKILL, data: { name: "marker-a" }, sourceNote: E2E_TAG },
  ]);
  await addEntries(scopeB, [
    { kind: ProfileEntryKind.SKILL, data: { name: "marker-b" }, sourceNote: E2E_TAG },
  ]);

  const entriesA = await db.profileEntry.findMany({
    where: { ...scopeData(scopeA), sourceNote: E2E_TAG },
  });
  const entriesB = await db.profileEntry.findMany({
    where: { ...scopeData(scopeB), sourceNote: E2E_TAG },
  });

  const aHasA = entriesA.some(
    (e) =>
      typeof e.data === "object" &&
      e.data !== null &&
      (e.data as { name?: string }).name === "marker-a",
  );
  const bHasB = entriesB.some(
    (e) =>
      typeof e.data === "object" &&
      e.data !== null &&
      (e.data as { name?: string }).name === "marker-b",
  );
  const crossA = entriesA.some(
    (e) =>
      typeof e.data === "object" &&
      e.data !== null &&
      (e.data as { name?: string }).name === "marker-b",
  );

  await deleteProfile(userId, second.id);

  const ok = aHasA && bHasB && !crossA;
  notes.push(`profile A marker=${aHasA}, profile B marker=${bHasB}, cross-leak=${crossA}`);

  record(10, name, ok ? "pass" : "fail", "live", notes);
}

// --- Report writer -----------------------------------------------------------

async function step4Offline(): Promise<void> {
  const resumeText =
    "Senior backend engineer. Go, Postgres, distributed systems, APIs, latency 40%.";
  const preview = previewQueue({
    resumeText,
    goalText: goalText(managerGoal),
    profileText: resumeText,
    now: NOW,
  });
  const ok = preview.queue.length > 0;
  record(4, "Job discovery (OSS sources) → scored queue", ok ? "pass" : "fail", "offline", [
    `offline preview queue: ${preview.queue.length} jobs`,
    `top: ${preview.queue[0]?.title} @ ${preview.queue[0]?.company}`,
  ]);
}

function writeReport(): void {
  const reportPath = path.join(process.cwd(), ".cursor/plans/swarm_e2e_report.md");

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;

  const fixes: string[] = [];
  for (const r of results.filter((x) => x.status === "fail")) {
    fixes.push(`- **Step ${r.step}** (${r.name}): ${r.notes.join("; ") || "investigate failure"}`);
  }
  const llmGaps = results.filter(
    (r) => r.notes.some((n) => n.includes("OpenRouter") || n.includes("OPENROUTER")),
  );
  if (llmGaps.length > 0) {
    fixes.push(
      "- **LLM path (Steps 1–2)**: Configure a valid `OPENROUTER_API_KEY` via Integrations portal to exercise live resume import and dictation extraction (currently falls back to fixture seed).",
    );
  }
  if (!dbAvailable) {
    fixes.push("- **Infrastructure**: Start Postgres (`npm run db:up`) so DB-backed ingest and profile steps run live.");
  }

  const lines = [
    "---",
    "name: Swarm E2E Journey Report",
    `generated: ${new Date().toISOString()}`,
    `db_available: ${dbAvailable}`,
    "---",
    "",
    "# Swarm E2E Journey Report",
    "",
    `**Summary:** ${passed} passed, ${failed} failed, ${skipped} skipped (of ${results.length} steps)`,
    "",
    "## Results",
    "",
    "| Step | Journey | Status | Mode | Notes |",
    "|------|---------|--------|------|-------|",
    ...results.map(
      (r) =>
        `| ${r.step} | ${r.name} | ${r.status.toUpperCase()} | ${r.mode} | ${r.notes.join("; ").replace(/\|/g, "/") || "-"} |`,
    ),
    "",
    "## Fixes needed",
    "",
    fixes.length > 0 ? fixes.join("\n") : "_None - all steps passed._",
    "",
    "## Known gaps (non-blocking)",
    "",
    "- **Step 1–2**: Live LLM extraction (`importResumeText`, `extractFromDictation`) not exercised when OpenRouter key is missing/invalid; fixture seed validates DB persistence only.",
    "- **Step 6**: Uses hand-crafted resume + provenance audit, not `tailorResume()` / `generateCoverLetter()` LLM paths.",
    "- **Step 8**: Gmail runs on fixture corpus; live OAuth sync not validated in this gate.",
    "- **Step 9**: Voice session uses fixture `MOCK_SCRIPT`; ElevenLabs/Pipecat live grants not validated.",
    "",
    "## Run",
    "",
    "```bash",
    "npm run test:e2e-journey",
    "```",
    "",
  ];

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
  console.log(`\nReport written: ${reportPath}`);
}

// --- Main --------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("\n=== Job OS E2E Journey ===\n");

  dbAvailable = await dbPing();
  console.log(`Database: ${dbAvailable ? "reachable" : "unavailable (fixture/offline fallbacks)"}`);

  if (!dbAvailable) {
    const dbSkip = [
      [1, "Upload/import master resume → ProfileEntry populated"],
      [2, "Voice dictation updates resume"],
      [3, "Career goals saved → scoring uses goals"],
      [6, "Tailor resume + cover letter for a job"],
      [10, "Multi-profile isolation smoke"],
    ] as const;
    for (const [step, name] of dbSkip) {
      record(step, name, "skip", "offline", ["requires DATABASE_URL"]);
    }
    await step4Offline();
    await step5Brief();
    await step7Apply();
    await step8Gmail();
    await step9Interview();
  } else {
    const user = await getPrimaryUser();
    const profile = await ensureDefaultProfile(user.id);
    const scope: AppScope = { userId: user.id, profileId: profile.id };

    await step1Import(scope);
    await step2Dictation(scope);
    await step3Goals(scope);
    await step4Jobs(scope);
    await step5Brief();
    await step6Tailor(scope);
    await step7Apply();
    await step8Gmail();
    await step9Interview();
    await step10Profiles(user.id, profile.id);

    await cleanupScope(scope);
  }

  writeReport();

  const failed = results.filter((r) => r.status === "fail").length;
  console.log(
    `\n=== Done: ${results.filter((r) => r.status === "pass").length} passed, ${failed} failed, ${results.filter((r) => r.status === "skip").length} skipped ===\n`,
  );
  if (failed > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
