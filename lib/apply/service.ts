/**
 * Apply-engine data service (Phase 5) - the ONLY file in the apply engine that
 * imports @/lib/db. All Prisma reads and writes live here; the pure brain
 * modules (engine, state-machine, driver) are DB-free and unit-testable.
 *
 * Safety guarantees enforced here (plan §8c / §A / §C):
 *
 *   prepareApplication:
 *     Drives QUEUED → PREPARING → REVIEW (or FAILED) through nextState().
 *     The PREPARING → FAILED case is the only deliberate state-machine bypass:
 *     APPLY_TRANSITIONS has no PREPARING→FAILED edge, but a knocked-out app
 *     MUST land in FAILED (not REVIEW) so canSubmit() is structurally false
 *     and the submit path is unreachable.
 *
 *   approveAndSubmit - three idempotency/safety guards:
 *     1. Terminal (SUBMITTED|FAILED) → early-return, never re-submit.
 *     2. SUBMITTING → resumeAction returns "manual"; return ok:false.
 *        A process that died mid-submit may have already submitted the form -
 *        we cannot know. A human must inspect the employer portal and advance
 *        the row manually. DO NOT auto-retry.
 *     3. Only REVIEW proceeds: REVIEW --APPROVE--> SUBMITTING.
 *     4. submit() wrapped in try/catch: any throw lands the row in FAILED via
 *        SUBMITTED_FAIL. The row is never left stranded in SUBMITTING after a
 *        throw.
 */

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { buildApplyPlan } from "@/lib/apply/engine";
import { resolveApplyDriver } from "@/lib/apply/driver";
import { resolveResumePdfPath } from "@/lib/apply/resume-pdf";
import { scanPage } from "@/lib/apply/detection";
import {
  nextState as machineNextState,
  isTerminal,
  resumeAction,
} from "@/lib/apply/state-machine";
import { getContact } from "@/lib/profile/service";
import type { AppScope } from "@/lib/profiles/types";
import { scopeData, scopeWhere } from "@/lib/profiles/scope";
import { fixtureJobs } from "@/lib/jobs/sources/fixtures";
import type {
  ApplyState,
  ApplyRoute,
  ApplyEvent,
  ApplicationAnswersData,
  PreparedField,
  KnockoutResult,
  DetectionResult,
  PageSignals,
  ApplyPlan,
  ApplyDriver,
} from "@/lib/apply/types";

// --- Serializable view --------------------------------------------------------

/** Plain-serializable row for the UI (dates → ISO strings, JSON → typed). */
export interface ApplicationRowView {
  id: string;
  jobTitle: string;
  company: string;
  route: ApplyRoute | null;
  applyState: ApplyState;
  status: string;
  fields: PreparedField[];
  knockouts: KnockoutResult | null;
  detection: DetectionResult | null;
  /** Not persisted in its own column; undefined for DB-loaded rows. */
  routeReasons?: string[];
  submittedAt: string | null;
}

// --- Internal helpers ---------------------------------------------------------

/**
 * Derive the router's surface key from a job record.
 *
 * Priority: atsType (most specific) → source string keywords → URL hostname.
 * Unknown surface falls through to source lowercased, which the router treats
 * as "standard" → ASSISTED (the safe default).
 */
function deriveSurface(job: {
  source: string;
  atsType?: string | null;
  url?: string | null;
}): string {
  if (job.atsType) return job.atsType.toLowerCase().trim();

  const src = job.source.toLowerCase().trim();
  if (src.includes("linkedin")) return "linkedin";
  if (src.includes("dice")) return "dice";
  if (src.includes("wellfound")) return "wellfound";
  if (src.includes("workday")) return "workday";

  if (job.url) {
    try {
      const host = new URL(job.url).hostname.toLowerCase();
      if (host.includes("linkedin")) return "linkedin";
      if (host.includes("workday")) return "workday";
      if (host.includes("dice")) return "dice";
      if (host.includes("wellfound")) return "wellfound";
      if (host.includes("greenhouse")) return "greenhouse";
      if (host.includes("lever")) return "lever";
      if (host.includes("ashby")) return "ashby";
    } catch {
      // invalid URL - ignore
    }
  }

  return src; // fallback: router treats unknown as "standard" → ASSISTED
}

/** Build a default clean PageSignals from a job URL (no live browser available offline). */
function defaultSignals(url: string | null | undefined): PageSignals {
  let host = "";
  if (url) {
    try {
      host = new URL(url).hostname;
    } catch {
      // invalid URL - host stays ""
    }
  }
  return { url: url ?? "", host, markers: [], hasLoginForm: false, hasCaptcha: false };
}

/**
 * Wrap nextState() and throw on illegal transitions.
 * Illegal transitions are programming errors - the caller passed the wrong
 * event for the current state.
 */
function transition(current: ApplyState, event: ApplyEvent): ApplyState {
  const target = machineNextState(current, event);
  if (!target) {
    throw new Error(
      `Illegal apply-state transition: ${current} + ${event} → no target (APPLY_TRANSITIONS)`,
    );
  }
  return target;
}

// --- Answers ------------------------------------------------------------------

/** Read the profile's confirmed answers (singleton). Returns empty defaults when absent. */
export async function getAnswers(
  scope: AppScope,
): Promise<ApplicationAnswersData> {
  const row = await db.applicationAnswers.findUnique({
    where: { profileId: scope.profileId },
  });
  if (!row) return { locations: [], customAnswers: [] };

  return {
    workAuthorized: row.workAuthorized ?? undefined,
    requiresSponsorship: row.requiresSponsorship ?? undefined,
    yearsExperience: row.yearsExperience ?? undefined,
    willingToRelocate: row.willingToRelocate ?? undefined,
    remoteOnly: row.remoteOnly ?? undefined,
    locations: row.locations,
    salaryExpectation: row.salaryExpectation ?? undefined,
    salaryCurrency: row.salaryCurrency ?? undefined,
    noticePeriod: row.noticePeriod ?? undefined,
    hasClearance: row.hasClearance ?? undefined,
    linkedinUrl: row.linkedinUrl ?? undefined,
    githubUrl: row.githubUrl ?? undefined,
    websiteUrl: row.websiteUrl ?? undefined,
    eeo:
      row.eeo !== null
        ? (row.eeo as unknown as Record<string, string>)
        : undefined,
    customAnswers: Array.isArray(row.customAnswers)
      ? (row.customAnswers as unknown as { question: string; answer: string }[])
      : [],
  };
}

/** Create or replace the profile's confirmed answers. */
export async function upsertAnswers(
  scope: AppScope,
  data: ApplicationAnswersData,
): Promise<void> {
  const customAnswers = data.customAnswers as unknown as Prisma.InputJsonValue;
  const eeo =
    data.eeo !== undefined
      ? (data.eeo as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull;

  const fields = {
    workAuthorized: data.workAuthorized ?? null,
    requiresSponsorship: data.requiresSponsorship ?? null,
    yearsExperience: data.yearsExperience ?? null,
    willingToRelocate: data.willingToRelocate ?? null,
    remoteOnly: data.remoteOnly ?? null,
    locations: data.locations,
    salaryExpectation: data.salaryExpectation ?? null,
    salaryCurrency: data.salaryCurrency ?? null,
    noticePeriod: data.noticePeriod ?? null,
    hasClearance: data.hasClearance ?? null,
    linkedinUrl: data.linkedinUrl ?? null,
    githubUrl: data.githubUrl ?? null,
    websiteUrl: data.websiteUrl ?? null,
    eeo,
    customAnswers,
  };

  await db.applicationAnswers.upsert({
    where: { profileId: scope.profileId },
    create: { ...scopeData(scope), ...fields },
    update: fields,
  });
}

// --- prepareApplication -------------------------------------------------------

/**
 * Prepare a job application: load context → build plan → persist via state
 * machine. The `jobId` parameter is the Job's `identityHash` (the UI-facing
 * stable id returned by listQueue / JobView.id).
 *
 * State-machine path:
 *   QUEUED --PREPARE--> PREPARING --PREPARED--> REVIEW          (normal)
 *   QUEUED --PREPARE--> PREPARING --[disqualified]--> FAILED    (bypass)
 *
 * The PREPARING → FAILED bypass exists because APPLY_TRANSITIONS has no
 * PREPARING → FAILED edge. A knocked-out app must land in FAILED (not REVIEW)
 * so the submit path is structurally blocked (canSubmit("FAILED") === false).
 *
 * Idempotent: if the application already exists and has been advanced past
 * QUEUED, this is a no-op.
 */
export async function prepareApplication(
  scope: AppScope,
  jobId: string,
): Promise<void> {
  // 1. Load context in parallel (job by identityHash, answers, contact)
  const [job, answers, contact] = await Promise.all([
    db.job.findFirstOrThrow({
      where: { ...scopeWhere(scope), identityHash: jobId },
    }),
    getAnswers(scope),
    getContact(scope),
  ]);

  // 2. Upsert Application row at QUEUED if this is the first prepare
  //    Application.jobId is the Prisma Job.id (cuid), not identityHash
  let application = await db.application.findUnique({
    where: { jobId: job.id },
  });

  if (!application) {
    application = await db.application.create({
      data: {
        ...scopeData(scope),
        jobId: job.id,
        applyState: "QUEUED",
        status: "TO_APPLY",
      },
    });
  }

  // Idempotency: skip if already past QUEUED
  if ((application.applyState as ApplyState) !== "QUEUED") return;

  // 3. QUEUED --PREPARE--> PREPARING (via state machine)
  const preparingState = transition("QUEUED", "PREPARE");
  await db.application.update({
    where: { id: application.id },
    data: { applyState: preparingState },
  });

  // 4. Build the plan (pure - no DB, no LLM, no network)
  const surface = deriveSurface(job);
  const signals = defaultSignals(job.url);
  const plan = buildApplyPlan({
    jobText: job.description ?? "",
    answers,
    contact,
    signals,
    local: true, // offline prep; cloud autonomy gate re-checked at submit time
    surface,
  });

  // 5. Determine final DB state and persist
  const preparedFields = plan.fields as unknown as Prisma.InputJsonValue;
  const knockoutsJson = plan.knockouts as unknown as Prisma.InputJsonValue;
  const detectionJson = plan.detection as unknown as Prisma.InputJsonValue;

  // Non-disqualified: PREPARING --PREPARED--> REVIEW (legal transition)
  // Disqualified:     set FAILED directly - no PREPARING→FAILED edge in the
  //   machine, but safety requires FAILED (not REVIEW) for knocked-out apps.
  const finalState: ApplyState =
    plan.nextState === "FAILED" ? "FAILED" : transition("PREPARING", "PREPARED");

  await db.application.update({
    where: { id: application.id },
    data: {
      applyState: finalState,
      route: plan.route,
      preparedFields,
      knockouts: knockoutsJson,
      detection: detectionJson,
    },
  });

  // 6. Record event for audit trail
  await db.applicationEvent.create({
    data: {
      applicationId: application.id,
      type: "prepared",
      detail: {
        route: plan.route,
        finalState,
        knockedOut: plan.knockouts.disqualified,
        failureCount: plan.knockouts.failures.length,
        surface,
      } as unknown as Prisma.InputJsonValue,
    },
  });
}

// --- approveAndSubmit ---------------------------------------------------------

/**
 * Human approves the itemized review gate → attempt submit via driver.
 *
 * Idempotency + crash-safety layer:
 *
 *   terminal (SUBMITTED | FAILED):
 *     Early-return with ok:(state==="SUBMITTED"). Never re-submit.
 *
 *   SUBMITTING:
 *     resumeAction("SUBMITTING") === "manual" - a prior process may have
 *     already submitted the form and died before recording the result. We
 *     cannot know whether the employer received it. Return ok:false; surface
 *     a "manual resolution needed" message in the UI. DO NOT auto-retry.
 *
 *   REVIEW only:
 *     Proceed: REVIEW --APPROVE--> SUBMITTING (set reviewedAt), then execute
 *     the driver sequence. Any throw from the driver lands the row in FAILED
 *     via SUBMITTED_FAIL - never stranded in SUBMITTING.
 */
export async function approveAndSubmit(
  scope: AppScope,
  applicationId: string,
  opts?: { failSubmit?: boolean; driver?: ApplyDriver },
): Promise<{ ok: boolean; state: ApplyState }> {
  const application = await db.application.findFirstOrThrow({
    where: { id: applicationId, ...scopeWhere(scope) },
    include: { job: true },
  });

  const state = application.applyState as ApplyState;

  // Guard 1: terminal - no re-submit
  if (isTerminal(state)) {
    return { ok: state === "SUBMITTED", state };
  }

  // Guard 2: SUBMITTING - manual resolution only (crash-safety invariant)
  if (resumeAction(state) === "manual") {
    // state === "SUBMITTING": unknown submission state; do not auto-retry
    return { ok: false, state };
  }

  // Guard 3: only REVIEW may proceed to submission
  if (state !== "REVIEW") {
    return { ok: false, state };
  }

  // Transition REVIEW → SUBMITTING (via APPROVE; records reviewedAt)
  const submittingState = transition(state, "APPROVE");
  await db.application.update({
    where: { id: application.id },
    data: { applyState: submittingState, reviewedAt: new Date() },
  });

  // Build driver and execute open → scan → fill → submit
  const fields = Array.isArray(application.preparedFields)
    ? (application.preparedFields as unknown as PreparedField[])
    : [];

  // Default to the env-resolved driver (simulated unless APPLY_DRIVER=playwright
  // AND local); callers may inject one explicitly via opts.driver.
  const driver = opts?.driver ?? resolveApplyDriver({ failSubmit: opts?.failSubmit });

  let submitResult: { ok: boolean; detail?: string };
  try {
    await driver.open(application.job.url ?? "");

    // Runtime detection re-check at submit time (plan §A): if the LIVE page now
    // shows a CAPTCHA / login / Cloudflare wall, ABORT before submitting -
    // automation never blasts through a challenge. (The simulated driver scans
    // clean, so offline/test behavior is unchanged.)
    const liveSignals = await driver.scan();
    const liveDetection = scanPage(liveSignals);
    if (!liveDetection.clean) {
      const abortedState = transition("SUBMITTING", "SUBMITTED_FAIL");
      await db.application.update({
        where: { id: application.id },
        data: { applyState: abortedState },
      });
      await db.applicationEvent.create({
        data: {
          applicationId: application.id,
          type: "submit_aborted",
          detail: {
            reason: "live detection scan not clean - captcha/login/cloudflare",
            signals: liveDetection.signals,
            driver: driver.name,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      return { ok: false, state: abortedState };
    }

    await driver.fill(fields);

    const resumePdf = await resolveResumePdfPath();
    if (resumePdf && driver.attachResume) {
      await driver.attachResume(resumePdf);
    }

    submitResult = await driver.submit();
  } catch (err) {
    // Unexpected throw - land deterministically in FAILED; never re-submit
    const failedState = transition("SUBMITTING", "SUBMITTED_FAIL");
    await db.application.update({
      where: { id: application.id },
      data: { applyState: failedState },
    });
    await db.applicationEvent.create({
      data: {
        applicationId: application.id,
        type: "submit_failed",
        detail: {
          error: err instanceof Error ? err.message : String(err),
          source: "driver_throw",
        } as unknown as Prisma.InputJsonValue,
      },
    });
    return { ok: false, state: failedState };
  } finally {
    // Always tear the browser down (real driver closes the Chrome context);
    // best-effort so it never masks the real submit outcome.
    try {
      await driver.close?.();
    } catch {
      /* ignore teardown errors */
    }
  }

  if (submitResult.ok) {
    // SUBMITTING → SUBMITTED
    const submittedState = transition("SUBMITTING", "SUBMITTED_OK");
    await db.application.update({
      where: { id: application.id },
      data: { applyState: submittedState, status: "APPLIED", submittedAt: new Date() },
    });
    await db.applicationEvent.create({
      data: {
        applicationId: application.id,
        type: "submitted",
        detail: {} as unknown as Prisma.InputJsonValue,
      },
    });
    return { ok: true, state: submittedState };
  } else {
    // SUBMITTING → FAILED (driver reported failure)
    const failedState = transition("SUBMITTING", "SUBMITTED_FAIL");
    await db.application.update({
      where: { id: application.id },
      data: { applyState: failedState },
    });
    await db.applicationEvent.create({
      data: {
        applicationId: application.id,
        type: "submit_failed",
        detail: { detail: submitResult.detail ?? "unknown" } as unknown as Prisma.InputJsonValue,
      },
    });
    return { ok: false, state: failedState };
  }
}

// --- listApplications ---------------------------------------------------------

/** Read all applications for the profile, joined with Job, as serializable view rows. */
export async function listApplications(
  scope: AppScope,
): Promise<ApplicationRowView[]> {
  const rows = await db.application.findMany({
    where: scopeWhere(scope),
    include: { job: true },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((app) => {
    const fields = Array.isArray(app.preparedFields)
      ? (app.preparedFields as unknown as PreparedField[])
      : [];
    const knockouts =
      app.knockouts !== null
        ? (app.knockouts as unknown as KnockoutResult)
        : null;
    const detection =
      app.detection !== null
        ? (app.detection as unknown as DetectionResult)
        : null;

    return {
      id: app.id,
      jobTitle: app.job.title,
      company: app.job.company,
      route: (app.route as ApplyRoute | null) ?? null,
      applyState: app.applyState as ApplyState,
      status: app.status as string,
      fields,
      knockouts,
      detection,
      // routeReasons not persisted in its own column; undefined for DB rows
      submittedAt: app.submittedAt?.toISOString() ?? null,
    };
  });
}

// --- previewApply -------------------------------------------------------------

/**
 * Offline preview - PURE, no DB, no LLM, no network.
 *
 * Runs buildApplyPlan over three curated fixtureJobs so the Apply page can
 * show the full routing + review-gate UI without a database:
 *
 *   NovaSpark  (greenhouse → ASSISTED, clean detection, no knockout)
 *   ClearPath  (ashby + clearance required → MANUAL route, FAILED state, knocked out)
 *   Acme Cloud (linkedin-feed → MANUAL route, blocked surface)
 *
 * The sample answers include hasClearance:false to trigger the ClearPath KO.
 */
export function previewApply(): {
  plans: { job: string; company: string; plan: ApplyPlan }[];
} {
  const sampleAnswers: ApplicationAnswersData = {
    workAuthorized: true,
    requiresSponsorship: false,
    yearsExperience: 5,
    willingToRelocate: false,
    remoteOnly: true,
    locations: ["San Francisco, CA", "Remote"],
    salaryExpectation: 160000,
    salaryCurrency: "USD",
    noticePeriod: "2 weeks",
    hasClearance: false, // triggers ClearPath knockout
    linkedinUrl: "https://linkedin.com/in/sample",
    githubUrl: "https://github.com/sample",
    websiteUrl: "https://sample.dev",
    customAnswers: [],
  };

  const sampleContact = {
    name: "Alex Sample",
    email: "alex@sample.dev",
    phone: "+1 555 0100",
    location: "San Francisco, CA",
  };

  const fixtures = [
    fixtureJobs.find((j) => j.sourceId === "novaspark-jfd-001"), // greenhouse → ASSISTED, no KO
    fixtureJobs.find((j) => j.sourceId === "clearpath-ise-005"), // ashby + clearance KO → FAILED
    fixtureJobs.find((j) => j.sourceId === "linkedin-67890"),    // linkedin-feed → MANUAL
  ].filter((j): j is NonNullable<typeof j> => j !== undefined);

  return {
    plans: fixtures.map((job) => {
      const surface = deriveSurface({
        source: job.source,
        atsType: job.atsType,
        url: job.url,
      });
      const signals = defaultSignals(job.url);
      const plan = buildApplyPlan({
        jobText: job.description,
        answers: sampleAnswers,
        contact: sampleContact,
        signals,
        local: true,
        surface,
      });
      return { job: job.title, company: job.company, plan };
    }),
  };
}
