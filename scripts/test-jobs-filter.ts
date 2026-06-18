/**
 * Phase 3 filter validation gate - dedupe + ghost + scam.
 * Pure, deterministic, no LLM, no network, no DB.
 * Run: npx tsx scripts/test-jobs-filter.ts
 */

import { screen, NEARDUP_THRESHOLD, GHOST_THRESHOLD, SCAM_THRESHOLD } from "@/lib/jobs/filter/index";
import { identityHash } from "@/lib/jobs/filter/identity";
import { shingles, minhashSignature, estimatedJaccard, bandKey } from "@/lib/jobs/filter/minhash";
import { assessGhost } from "@/lib/jobs/filter/ghost";
import { assessScam } from "@/lib/jobs/filter/scam";
import type { RawJob } from "@/lib/jobs/types";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

// --- Fixtures --------------------------------------------------------------

const REAL_JD = `
  We are looking for a Senior Software Engineer to join our platform team.
  You will design and implement distributed backend services using Go and Postgres.
  Responsibilities include: API design, database schema ownership, on-call rotation,
  code review, mentoring junior engineers, improving observability and reliability.
  Requirements: 5+ years of software engineering experience, strong knowledge of
  relational databases, proficiency in at least one systems language (Go, Rust, C++).
  Experience with Kubernetes and cloud platforms (AWS or GCP) is preferred.
  Salary: $150,000 – $190,000 per year. Remote-friendly with optional San Francisco HQ.
  We offer comprehensive health, dental, vision, and 401k matching.
`;

// Near-identical copy of REAL_JD - same posting scraped from a second source.
// Only minor formatting differences (punctuation, whitespace, one synonym).
// True k=3-shingle Jaccard is ~0.85 for this kind of copy-paste near-dup.
const NEARDUP_JD = `
  We are looking for a Senior Software Engineer to join our platform team.
  You will design and implement distributed backend services using Go and Postgres.
  Responsibilities include: API design, database schema ownership, on-call rotation,
  code review, mentoring junior engineers, improving observability and reliability.
  Requirements: 5+ years of software engineering experience, strong knowledge of
  relational databases, proficiency in at least one systems language (Go, Rust, C++).
  Experience with Kubernetes and cloud platforms (AWS or GCP) is preferred.
  Salary: $150,000 to $190,000 per year. Remote-friendly with optional San Francisco office.
  We offer health, dental, vision, and 401k matching.
`;

// A genuinely different job - data scientist
const DIFFERENT_JD = `
  Data Scientist - Machine Learning Platform.
  You will build and deploy production ML models using Python, PyTorch, and MLflow.
  Responsibilities: feature engineering, model training and evaluation, A/B testing
  infrastructure, collaboration with product teams to define metrics.
  Requirements: MS or PhD in a quantitative field, 3+ years ML/data science experience,
  proficiency in Python and SQL, familiarity with distributed training frameworks.
  Salary: $140,000 – $175,000. New York or remote.
`;

// Ghost job: evergreen language + very short description
const GHOST_JD = `
  We're always looking for talented engineers to join our talent community.
  If you're interested in future opportunities at Acme Corp, submit your resume here.
  No specific opening at this time. We will reach out when a suitable role opens.
`;

// Scam job: upfront fee + unofficial contact
const SCAM_JD = `
  Customer Service Representative - work from home! No experience required.
  Earn $5,000/week from home. Immediate start available.
  To apply, contact us via WhatsApp only: +1-555-0199.
  A small registration fee of $49 is required to cover your onboarding materials.
  Limited positions available - act now!
`;

// Clean, normal job
const CLEAN_JD = `
  Product Designer at Notion.
  We are hiring a Product Designer to help design and refine our core editor experience.
  You will work closely with product managers and engineers to ship new features.
  Responsibilities: user research, wireframing, prototyping, design system maintenance.
  Requirements: 3+ years of product design experience, strong portfolio, Figma proficiency.
  Salary: $130,000 – $160,000. San Francisco or remote.
`;

// --- Helpers ---------------------------------------------------------------

function makeJob(overrides: Partial<RawJob> & { company: string; title: string; description: string }): RawJob {
  return {
    source: "test",
    location: "Remote",
    remote: true,
    ...overrides,
  };
}

// --- identity.ts ----------------------------------------------------------

console.log("\nidentity hash:");

check(
  "same company+title+location → same hash",
  identityHash("Acme Inc.", "Senior Engineer", "New York") ===
    identityHash("Acme Inc.", "Senior Engineer", "New York"),
);
check(
  "legal suffix stripped: 'Acme Inc.' == 'Acme'",
  identityHash("Acme Inc.", "Engineer", "NY") === identityHash("Acme", "Engineer", "NY"),
);
check(
  "extra whitespace collapsed: '  Acme  ' == 'Acme'",
  identityHash("  Acme  ", "Engineer", "NY") === identityHash("Acme", "Engineer", "NY"),
);
check(
  "different company → different hash",
  identityHash("Acme", "Engineer", "NY") !== identityHash("Beta", "Engineer", "NY"),
);
check(
  "different title → different hash",
  identityHash("Acme", "Engineer", "NY") !== identityHash("Acme", "Designer", "NY"),
);
check(
  "no location vs location → different hash",
  identityHash("Acme", "Engineer") !== identityHash("Acme", "Engineer", "NY"),
);

// --- minhash.ts -----------------------------------------------------------

console.log("\nminhash + LSH:");

const sA = shingles(REAL_JD);
const sB = shingles(NEARDUP_JD);
const sDiff = shingles(DIFFERENT_JD);

check("shingles: non-empty for a real JD", sA.size > 0);
check("shingles: k=3 shingles contain 3 words", [...sA][0].split(" ").length === 3);

const sigA = minhashSignature(sA);
const sigB = minhashSignature(sB);
const sigDiff = minhashSignature(sDiff);

check("signature length = 64 by default", sigA.length === 64);
check("deterministic: same shingles → same signature", JSON.stringify(sigA) === JSON.stringify(minhashSignature(sA)));
check("no NaN or negative in signature", sigA.every((v) => v >= 0 && !isNaN(v)));

const jNearDup = estimatedJaccard(sigA, sigB);
const jDiff = estimatedJaccard(sigA, sigDiff);

check(
  `near-dup Jaccard (${jNearDup.toFixed(3)}) ≥ NEARDUP_THRESHOLD (${NEARDUP_THRESHOLD})`,
  jNearDup >= NEARDUP_THRESHOLD,
);
check(
  `different JD Jaccard (${jDiff.toFixed(3)}) < NEARDUP_THRESHOLD (${NEARDUP_THRESHOLD})`,
  jDiff < NEARDUP_THRESHOLD,
);

const bkA = bandKey(sigA);
const bkA2 = bandKey(minhashSignature(sA));
check("bandKey is deterministic", bkA === bkA2);
check("bandKey is a non-empty string", bkA.length > 0);

// --- ghost.ts ------------------------------------------------------------

console.log("\nghost detection:");

const ghostJob = makeJob({ company: "Acme Corp", title: "Software Engineer", description: GHOST_JD });
const cleanJob = makeJob({
  company: "Notion",
  title: "Product Designer",
  description: CLEAN_JD,
  salaryMin: 130_000,
  salaryMax: 160_000,
});
const seniorNoSalaryJob = makeJob({
  company: "Startup",
  title: "Senior Software Engineer",
  description: REAL_JD.replace(/\$[\d,]+ – \$[\d,]+ per year/i, ""),
});

const ghostResult = assessGhost(ghostJob);
const cleanGhostResult = assessGhost(cleanJob);

check(
  `ghost job score (${ghostResult.score.toFixed(3)}) ≥ GHOST_THRESHOLD (${GHOST_THRESHOLD})`,
  ghostResult.score >= GHOST_THRESHOLD,
);
check("ghost job is flagged", ghostResult.flagged === true);
check("ghost job has reasons", ghostResult.reasons.length > 0);

check(
  `clean job ghost score (${cleanGhostResult.score.toFixed(3)}) < GHOST_THRESHOLD (${GHOST_THRESHOLD})`,
  cleanGhostResult.score < GHOST_THRESHOLD,
);
check("clean job is NOT ghost-flagged", cleanGhostResult.flagged === false);

// --- scam.ts -------------------------------------------------------------

console.log("\nscam detection:");

const scamJob = makeJob({ company: "COMPANY", title: "Customer Service Representative", description: SCAM_JD });
const cleanScamResult = assessScam(cleanJob);
const scamResult = assessScam(scamJob);

check(
  `scam job score (${scamResult.score.toFixed(3)}) ≥ SCAM_THRESHOLD (${SCAM_THRESHOLD})`,
  scamResult.score >= SCAM_THRESHOLD,
);
check("scam job is flagged", scamResult.flagged === true);
check("scam job has reasons", scamResult.reasons.length > 0);

check(
  `clean job scam score (${cleanScamResult.score.toFixed(3)}) < SCAM_THRESHOLD (${SCAM_THRESHOLD})`,
  cleanScamResult.score < SCAM_THRESHOLD,
);
check("clean job is NOT scam-flagged", cleanScamResult.flagged === false);

// --- screen() - the orchestrator -----------------------------------------

console.log("\nscreen() orchestrator:");

// Test A: exact duplicate
const jobA = makeJob({ company: "Acme Inc.", title: "Senior Software Engineer", description: REAL_JD, location: "Remote", url: "https://acme.com/jobs/1" });
const jobA_dup = makeJob({ company: "Acme Inc.", title: "Senior Software Engineer", description: REAL_JD.slice(0, 200), location: "Remote" }); // shorter - should lose
const resultA = screen([jobA, jobA_dup]);

check("exact dup: total = 2", resultA.stats.total === 2);
check("exact dup: kept = 1", resultA.stats.kept === 1);
check("exact dup: duplicates = 1", resultA.stats.duplicates === 1);
check("exact dup: dropped job has excludeReason 'duplicate'", resultA.dropped[0]?.excludeReason === "duplicate");
check("exact dup: canonical has longer description", resultA.kept[0].raw.description.length > resultA.dropped[0].raw.description.length);

// Test B: near-duplicate (same role, reworded JD)
const jobB1 = makeJob({ company: "NearCo", title: "Senior Software Engineer", description: REAL_JD, location: "New York" });
const jobB2 = makeJob({ company: "NearCo", title: "Senior Software Engineer", description: NEARDUP_JD, location: "New York" });
// These have the SAME identity hash (same company/title/location) so they'll be exact dups.
// To test near-dup, use different companies but same JD text.
const jobB3 = makeJob({ company: "SourceAlpha", title: "Backend Engineer", description: REAL_JD, location: "San Francisco" });
const jobB4 = makeJob({ company: "SourceBeta", title: "Backend Engineer", description: NEARDUP_JD, location: "San Francisco" });
const resultB = screen([jobB3, jobB4]);

// Near-dup should collapse the two if their Jaccard >= threshold
const jB = estimatedJaccard(minhashSignature(shingles(REAL_JD)), minhashSignature(shingles(NEARDUP_JD)));
check(
  `near-dup JDs have MinHash Jaccard (${jB.toFixed(3)}) ≥ NEARDUP_THRESHOLD (${NEARDUP_THRESHOLD})`,
  jB >= NEARDUP_THRESHOLD,
);
check(`near-dup collapse: kept = 1`, resultB.stats.kept === 1);
check("near-dup: dropped has excludeReason 'duplicate'", resultB.dropped.some((d) => d.excludeReason === "duplicate"));

// Test C: genuinely different roles do NOT collapse
const jobC1 = makeJob({ company: "TechCo", title: "Senior Software Engineer", description: REAL_JD, location: "Austin" });
const jobC2 = makeJob({ company: "TechCo", title: "Data Scientist", description: DIFFERENT_JD, location: "Austin" });
const resultC = screen([jobC1, jobC2]);

check("different roles: both kept", resultC.stats.kept === 2);
check("different roles: 0 duplicates", resultC.stats.duplicates === 0);

// Test D: ghost job excluded
const jobD_ghost = makeJob({ company: "GhostCo", title: "Software Engineer", description: GHOST_JD, location: "Remote" });
const resultD = screen([jobD_ghost]);

check("ghost: excluded = true", resultD.dropped.length === 1);
check("ghost: excludeReason = 'ghost'", resultD.dropped[0]?.excludeReason === "ghost");
check("ghost: 0 kept", resultD.stats.kept === 0);
check("ghost: ghosts stat = 1", resultD.stats.ghosts === 1);

// Test E: scam job excluded
const jobE_scam = makeJob({ company: "COMPANY", title: "Customer Service", description: SCAM_JD, location: "Remote" });
const resultE = screen([jobE_scam]);

check("scam: excluded = true", resultE.dropped.length === 1);
check("scam: excludeReason = 'scam'", resultE.dropped[0]?.excludeReason === "scam");
check("scam: 0 kept", resultE.stats.kept === 0);
check("scam: scams stat = 1", resultE.stats.scams === 1);

// Test F: clean job passes
const jobF = makeJob({ company: "Notion", title: "Product Designer", description: CLEAN_JD, location: "San Francisco", salaryMin: 130_000, salaryMax: 160_000 });
const resultF = screen([jobF]);

check("clean job: kept = 1", resultF.stats.kept === 1);
check("clean job: 0 dropped", resultF.dropped.length === 0);
check("clean job: ghost score < threshold", resultF.kept[0].ghost.score < GHOST_THRESHOLD);
check("clean job: scam score < threshold", resultF.kept[0].scam.score < SCAM_THRESHOLD);
check("clean job: excluded = false", resultF.kept[0].excluded === false);

// Test G: stats consistency
const mixedJobs = [jobA, jobA_dup, jobD_ghost, jobE_scam, jobF];
const resultG = screen(mixedJobs);

check(
  `stats consistent: total(${resultG.stats.total}) = kept(${resultG.stats.kept}) + dup(${resultG.stats.duplicates}) + ghost(${resultG.stats.ghosts}) + scam(${resultG.stats.scams})`,
  resultG.stats.total ===
    resultG.stats.kept + resultG.stats.duplicates + resultG.stats.ghosts + resultG.stats.scams,
);
check(
  "kept + dropped = total",
  resultG.kept.length + resultG.dropped.length === resultG.stats.total,
);
check("all kept items have excluded=false", resultG.kept.every((j) => j.excluded === false));
check("all dropped items have excluded=true", resultG.dropped.every((j) => j.excluded === true));
check("every ScreenedJob has identityHash", [...resultG.kept, ...resultG.dropped].every((j) => j.identityHash.length > 0));
check("every ScreenedJob has fingerprint", [...resultG.kept, ...resultG.dropped].every((j) => j.fingerprint.length > 0));

// Test H: empty input
const resultEmpty = screen([]);
check("empty input: total = 0", resultEmpty.stats.total === 0);
check("empty input: kept = []", resultEmpty.kept.length === 0);

// -------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
