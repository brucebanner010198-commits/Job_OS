/**
 * Extractive intro-DRAFT brain (Phase 7, plan §9 + Hardening §B/§F).
 *
 * Pure, deterministic, and free of DB / network / LLM / wall clock. Turns a
 * ranked {@link WarmPath} into a short, polite referral ask that the human then
 * edits and sends from their OWN account - the engine NEVER sends.
 *
 * SAFETY SPINE - TRUTHFUL / EXTRACTIVE:
 *   The body may only state ties and specifics that literally appear in the
 *   inputs (connection.howKnown / sharedContext / headline / company, the target
 *   company + role, and the requester's own name / headline / pitch). Every real
 *   fact the body quotes is recorded in `usedFacts`, and each entry is a verbatim
 *   source string - i.e. a substring of the concatenation of all input fields.
 *   We NEVER assert "we worked together" (or any relationship) unless a real
 *   howKnown / sharedContext backs it; when those are absent we fall back to
 *   generic-but-true phrasing (first name + the shared company) and
 *   `provenanceOk` stays true because nothing was fabricated.
 *
 *   A NONE path (no genuine connection) refuses to draft at all: empty body,
 *   provenanceOk=false, and a violation telling the human to apply cold instead.
 */

import type {
  IntroChannel,
  IntroDraft,
  RequesterProfile,
  WarmPath,
} from "@/lib/warm/types";

/** The leading word of a name, used for the greeting / sign-off. */
function firstWord(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}

/**
 * Draft an extractive warm-intro / referral ask grounded ONLY in real input
 * facts. See the file header for the provenance contract.
 */
export function draftIntroRequest(
  path: WarmPath,
  requester: RequesterProfile,
): IntroDraft {
  const channel: IntroChannel = path.channel;

  // No genuine path → never manufacture a tie. Recommend applying cold.
  if (path.pathKind === "NONE" || !path.connection) {
    return {
      channel,
      subject: undefined,
      body: "",
      provenanceOk: false,
      usedFacts: [],
      violations: ["No connection to address, so apply directly instead."],
    };
  }

  const conn = path.connection;
  const target = path.target;

  // Every entry pushed here is a verbatim input field (a substring of the
  // joined inputs) - the provenance trail the review UI shows the human.
  const usedFacts: string[] = [];

  // Greeting - grounded in the connection's real name.
  const greetName = firstWord(conn.fullName);
  usedFacts.push(conn.fullName);

  // The company we reference is where they work = the target company (real).
  const company = target.company;
  usedFacts.push(target.company);

  const sentences: string[] = [];

  // The tie sentence is the EXTRACTIVE crux: quote a real grounding fact
  // verbatim, or - when none exists - stay generic-but-true (no invented tie).
  const tie = conn.howKnown ?? conn.sharedContext;
  if (tie) {
    sentences.push(`I hope you're well - ${tie}, and I saw you're now at ${company}.`);
    usedFacts.push(tie);
  } else {
    // No howKnown / sharedContext: address by first name and reference only the
    // shared company. NEVER assert a shared employer, team, or "we worked together".
    sentences.push(
      `I hope you're well - I'm reaching out because I see you're at ${company}.`,
    );
  }

  // The ask: a quick chat about the real role, or a referral.
  if (target.jobTitle) {
    sentences.push(
      `I'm exploring the ${target.jobTitle} role there and would really value a quick chat - or a referral, if you think I'd be a good fit.`,
    );
    usedFacts.push(target.jobTitle);
  } else {
    sentences.push(
      `I'm exploring a role there and would really value a quick chat - or a referral, if you think I'd be a good fit.`,
    );
  }

  // Optional one-line, extractive context from the requester's own profile.
  if (requester.pitch) {
    sentences.push(`For context: ${requester.pitch}.`);
    usedFacts.push(requester.pitch);
  } else if (requester.headline) {
    sentences.push(`For context, I work as a ${requester.headline}.`);
    usedFacts.push(requester.headline);
  }

  // Sign with the requester's real name.
  usedFacts.push(requester.fullName);

  const body = [
    `Hi ${greetName},`,
    "",
    sentences.join(" "),
    "",
    "Thanks so much,",
    requester.fullName,
  ].join("\n");

  // Email gets a short 2–4 word subject; a LinkedIn DM has none.
  const subject =
    channel === "email" ? `Quick question - ${company}` : undefined;

  return {
    channel,
    subject,
    body,
    provenanceOk: true,
    usedFacts,
    violations: [],
  };
}
