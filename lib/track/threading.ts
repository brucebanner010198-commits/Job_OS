/**
 * Email → Application threading (Phase 6, plan §8d).
 * Pure - no LLM, no network, no DB, no Math.random/Date.now.
 *
 * Maps an inbound RawEmail onto a known Application using a strength-ordered
 * cascade of signals. The cascade returns the FIRST hit, strongest first, so a
 * weak heuristic (company name in the subject) can never override a hard link
 * (the Gmail thread id, or a shared RFC Message-ID). Confidence travels with the
 * match so downstream proposal logic can gate low-confidence links.
 *
 *   thread     0.99  same Gmail thread id  - strongest
 *   references 0.95  shared RFC Message-ID (References / In-Reply-To)
 *   domain     0.70  fromDomain === app.companyDomain
 *   subject    0.50  company name appears in subject/snippet/fromName - weakest
 *   none       0.00  no application matched
 *
 * Import types only from "@/lib/track/types".
 */
import type { AppRef, RawEmail, ThreadMatch } from "@/lib/track/types";

/**
 * Match a single email to one of the candidate applications.
 *
 * Tries each strategy in descending strength and returns on the first hit:
 *   1. thread     - an app whose gmailThreadIds includes email.gmailThreadId.
 *   2. references - an app whose rfcMessageIds shares any id with the email's
 *                   references (plus its own rfcMessageId, when set).
 *   3. domain     - email.fromDomain set AND an app's companyDomain equals it.
 *   4. subject    - an app's lowercased company name is contained in the
 *                   combined subject + snippet + fromName text.
 *   5. none       - nothing matched; applicationId is left undefined.
 */
export function matchEmailToApp(email: RawEmail, apps: AppRef[]): ThreadMatch {
  // 1. thread - same Gmail thread id is the hardest link we have.
  const byThread = apps.find((app) =>
    app.gmailThreadIds.includes(email.gmailThreadId),
  );
  if (byThread) {
    return { applicationId: byThread.id, matchedBy: "thread", confidence: 0.99 };
  }

  // 2. references - any shared RFC Message-ID (References + In-Reply-To, plus
  //    this email's own Message-ID when present).
  const emailRefs = new Set(email.references);
  if (email.rfcMessageId) emailRefs.add(email.rfcMessageId);
  const byReferences = apps.find((app) =>
    app.rfcMessageIds.some((id) => emailRefs.has(id)),
  );
  if (byReferences) {
    return {
      applicationId: byReferences.id,
      matchedBy: "references",
      confidence: 0.95,
    };
  }

  // 3. domain - the sender's domain matches a known company domain.
  if (email.fromDomain) {
    const fromDomain = email.fromDomain;
    const byDomain = apps.find((app) => app.companyDomain === fromDomain);
    if (byDomain) {
      return {
        applicationId: byDomain.id,
        matchedBy: "domain",
        confidence: 0.7,
      };
    }
  }

  // 4. subject/name - the company name appears in the human-readable text.
  const haystack = `${email.subject} ${email.snippet ?? ""} ${
    email.fromName ?? ""
  }`.toLowerCase();
  const bySubject = apps.find((app) =>
    haystack.includes(app.company.toLowerCase()),
  );
  if (bySubject) {
    return { applicationId: bySubject.id, matchedBy: "subject", confidence: 0.5 };
  }

  // 5. none - no application matched.
  return { matchedBy: "none", confidence: 0 };
}
