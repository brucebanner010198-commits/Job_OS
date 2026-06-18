/**
 * Email classifier (Phase 6 - Track + Gmail, plan §8d "classify").
 * Pure - no DB, no network, no LLM, no wall-clock reads. Maps a RawEmail to a
 * ClassificationResult by phrase-matching over a lowercased haystack of
 * subject + snippet + body.
 *
 * The hard constraint (plan §8d, fixtures.ts header): the flood of real-inbox
 * newsletters/notifications that merely *contain* "application" / "interview" /
 * "career" / "resume" (a GitHub OAuth-app notice, a product "welcome", a
 * "career prep" ad) MUST file as NOT_JOB so they never spawn a bogus status
 * proposal. STEP 0 marketing guards therefore run BEFORE any positive category
 * and win - guard (a) is unconditional and fires even when a job word is also
 * present (this is what catches the "career prep" ad, which contains the word
 * "interview").
 */
import type {
  ClassificationResult,
  EmailCategory,
  RawEmail,
} from "@/lib/track/types";

// --- STEP 0 vocabulary ----------------------------------------------------

/**
 * (a) Unconditional marketing/product phrases. Any hit → NOT_JOB, regardless of
 * whether a strong job signal is also present.
 */
const MARKETING_PHRASES: readonly string[] = [
  "has been added to your account",
  "third-party",
  "oauth application",
  "authorized to access",
  "welcome to",
  "what shipped",
  "new models",
  "get personalized",
  "complete onboarding",
  "navigate career prep",
  "level up your",
  "craft a compelling",
  "connect your",
];

/**
 * Strong transactional job signals. Their presence cancels the conditional
 * bulk/marketing guard (b) - real ATS mail carries List-Unsubscribe too, so a
 * "your application" / "interview" / invite must not be suppressed as bulk.
 */
const STRONG_SIGNAL_PHRASES: readonly string[] = [
  "your application",
  "thank you for applying",
  "we received your application",
  "interview",
  "offer letter",
  "extend an offer",
  "assessment",
  "coding challenge",
];

/** Domains whose no-reply senders are treated as bulk under guard (b). */
const BULK_GUARD_DOMAINS: ReadonlySet<string> = new Set([
  "github.com",
  "google.com",
  "openrouter.ai",
]);

// --- STEP 1 vocabulary (FIRST match wins, in this order) ------------------

const ICS_INTERVIEW_WORDS: readonly string[] = [
  "interview",
  "onsite",
  "schedule",
  "meeting",
];
const OFFER_PHRASES: readonly string[] = [
  "offer letter",
  "extend an offer",
  "pleased to offer",
  "delighted to extend",
  "your offer from",
];
const SOFT_KEEP_PHRASES: readonly string[] = [
  "keep your resume on file",
  "keep you in mind",
  "future opportunities",
  "future roles",
];
const SOFT_CLOSE_PHRASES: readonly string[] = [
  "other candidates",
  "move forward",
  "not move forward",
  "unable to",
];
const REJECTION_PHRASES: readonly string[] = [
  "not to move forward",
  "will not be moving forward",
  "not be proceeding",
  "decided not to",
  "regret to inform",
];
const ASSESSMENT_PHRASES: readonly string[] = [
  "assessment",
  "coding challenge",
  "coding test",
  "hackerrank",
  "codility",
  "take-home",
  "online test",
];
const INTERVIEW_VERB_PHRASES: readonly string[] = [
  "schedule",
  "invite",
  "availability",
  "book a time",
  "meet",
  "video",
  "phone screen",
];
const RECEIVED_PHRASES: readonly string[] = [
  "thank you for applying",
  "we received your application",
  "we've received your application",
  "received your application",
  "application has been received",
];
const OUTREACH_PHRASES: readonly string[] = [
  "came across your profile",
  "reaching out",
  "opportunity at",
  "would you be open",
  "i'm a recruiter",
  "sourcing for",
];

// --- helpers --------------------------------------------------------------

/** First phrase contained in `haystack`, or null. */
function firstHit(
  haystack: string,
  phrases: readonly string[],
): string | null {
  for (const phrase of phrases) {
    if (haystack.includes(phrase)) return phrase;
  }
  return null;
}

/** Every phrase contained in `haystack` (for richer reasons). */
function allHits(haystack: string, phrases: readonly string[]): string[] {
  return phrases.filter((phrase) => haystack.includes(phrase));
}

function classification(
  category: EmailCategory,
  confidence: number,
  reasons: string[],
): ClassificationResult {
  return {
    category,
    confidence,
    reasons: reasons.length > 0 ? reasons : [category],
    isJobRelated: category !== "NOT_JOB",
  };
}

// --- public API -----------------------------------------------------------

/**
 * Classify a single email. Deterministic and side-effect free: identical input
 * always yields identical output, with the matched phrase(s) recorded in
 * `reasons` so a proposal can explain itself to the human gate.
 */
export function classifyEmail(email: RawEmail): ClassificationResult {
  const subjectLower = email.subject.toLowerCase();
  const haystack =
    `${email.subject} ${email.snippet ?? ""} ${email.bodyText ?? ""}`.toLowerCase();

  const hasStrongSignal =
    email.icsRaw !== undefined ||
    firstHit(haystack, STRONG_SIGNAL_PHRASES) !== null;

  // --- STEP 0 - NOT_JOB guards -------------------------------------------

  // (a) unconditional marketing/product phrases - win even over a job word.
  const marketingHits = allHits(haystack, MARKETING_PHRASES);
  if (marketingHits.length > 0) {
    return classification(
      "NOT_JOB",
      0.85,
      marketingHits.map((phrase) => `marketing phrase: "${phrase}"`),
    );
  }

  // (b) conditional bulk/marketing - only when NO strong job signal is present.
  if (!hasStrongSignal) {
    const noReplySender =
      /noreply|no-reply/.test(email.fromEmail) &&
      email.fromDomain !== undefined &&
      BULK_GUARD_DOMAINS.has(email.fromDomain);
    if (noReplySender) {
      return classification("NOT_JOB", 0.85, [
        `bulk sender: no-reply on ${email.fromDomain ?? "?"} with no job signal`,
      ]);
    }
    if (email.listUnsubscribe) {
      return classification("NOT_JOB", 0.85, [
        "List-Unsubscribe present with no strong job signal",
      ]);
    }
  }

  // --- STEP 1 - positive categories, FIRST match wins --------------------

  // 1. Interview invite carried by a parsed calendar invite.
  if (email.icsRaw !== undefined) {
    const icsWord = firstHit(haystack, ICS_INTERVIEW_WORDS);
    if (icsWord !== null) {
      return classification("INTERVIEW_INVITE", 0.95, [
        `calendar invite + "${icsWord}"`,
      ]);
    }
  }

  // 2. Offer.
  const offerHit = firstHit(haystack, OFFER_PHRASES);
  if (offerHit !== null) {
    return classification("OFFER", 0.9, [`offer phrase: "${offerHit}"`]);
  }

  // 3. Soft rejection ("we'll keep your resume on file" close-out).
  const keepHit = firstHit(haystack, SOFT_KEEP_PHRASES);
  const closeHit = firstHit(haystack, SOFT_CLOSE_PHRASES);
  if (keepHit !== null && closeHit !== null) {
    return classification("SOFT_REJECTION", 0.85, [
      `soft close: "${keepHit}" + "${closeHit}"`,
    ]);
  }

  // 4. Hard rejection.
  const rejectHit = firstHit(haystack, REJECTION_PHRASES);
  if (rejectHit !== null) {
    return classification("REJECTION", 0.85, [
      `rejection phrase: "${rejectHit}"`,
    ]);
  }
  if (haystack.includes("unfortunately") && haystack.includes("other candidates")) {
    return classification("REJECTION", 0.85, [
      'rejection phrase: "unfortunately" + "other candidates"',
    ]);
  }

  // 5. Assessment / coding challenge.
  const assessHit = firstHit(haystack, ASSESSMENT_PHRASES);
  if (assessHit !== null) {
    return classification("ASSESSMENT", 0.85, [
      `assessment phrase: "${assessHit}"`,
    ]);
  }

  // 6. Interview invite without an .ics (body/subject signals).
  if (haystack.includes("interview")) {
    const verbHit = firstHit(haystack, INTERVIEW_VERB_PHRASES);
    if (verbHit !== null) {
      return classification("INTERVIEW_INVITE", 0.8, [
        `"interview" + "${verbHit}"`,
      ]);
    }
  }
  if (subjectLower.startsWith("interview with")) {
    return classification("INTERVIEW_INVITE", 0.8, [
      'subject starts with "interview with"',
    ]);
  }
  if (subjectLower.startsWith("canceled: interview")) {
    return classification("INTERVIEW_INVITE", 0.8, [
      'subject starts with "canceled: interview"',
    ]);
  }

  // 7. Application received.
  const receivedHit = firstHit(haystack, RECEIVED_PHRASES);
  if (receivedHit !== null) {
    return classification("APPLICATION_RECEIVED", 0.8, [
      `receipt phrase: "${receivedHit}"`,
    ]);
  }

  // 8. Recruiter cold outreach.
  const outreachHit = firstHit(haystack, OUTREACH_PHRASES);
  if (outreachHit !== null) {
    return classification("RECRUITER_OUTREACH", 0.7, [
      `outreach phrase: "${outreachHit}"`,
    ]);
  }

  // 9. Default - nothing job-related matched.
  return classification("NOT_JOB", 0.6, ["no job-related signal matched"]);
}
