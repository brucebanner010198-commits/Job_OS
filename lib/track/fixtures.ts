/**
 * Deterministic email corpus for Phase 6 (Track + Gmail). Used by the fixture
 * Gmail adapter, the test gate, and the offline /track preview.
 *
 * The NEGATIVES here are seeded from the user's REAL inbox (observed during the
 * Gmail connection test): a GitHub "third-party application added" security
 * notice, a "welcome to Google AI Studio" email, an OpenRouter product
 * newsletter, "career prep" marketing from Google, and a health-app onboarding
 * nudge. These all *contain* trigger words ("application", "interview",
 * "career", "resume") yet are NOT job-search mail - the classifier MUST file
 * them as NOT_JOB, or every newsletter would spawn a bogus status proposal.
 *
 * The POSITIVES are realistic synthetic job emails covering every category,
 * including a real `.ics` REQUEST invite and a CANCEL, a soft rejection, a hard
 * rejection, an offer, recruiter outreach, an application receipt, and an
 * online assessment. A subset thread onto the fixture applications below.
 *
 * NOTE: all timestamps are fixed; tests inject a constant NOW so nothing here
 * depends on the wall clock.
 */

import type { AppRef, EmailCategory, RawEmail } from "@/lib/track/types";

// A real-looking Google Calendar REQUEST invite (the parser reads this MIME part).
const ICS_INTERVIEW_REQUEST = `BEGIN:VCALENDAR
PRODID:-//Google Inc//Google Calendar 70.9054//EN
VERSION:2.0
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
DTSTART:20260622T160000Z
DTEND:20260622T164500Z
DTSTAMP:20260616T120000Z
ORGANIZER;CN=Stripe Recruiting:mailto:recruiting@stripe.com
UID:stripe-interview-001@google.com
SUMMARY:Interview: Backend Engineer @ Stripe
LOCATION:Google Meet (https://meet.google.com/abc-defg-hij)
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;

// The same invite, cancelled (method + status both signal cancellation).
const ICS_INTERVIEW_CANCEL = `BEGIN:VCALENDAR
PRODID:-//Google Inc//Google Calendar 70.9054//EN
VERSION:2.0
CALSCALE:GREGORIAN
METHOD:CANCEL
BEGIN:VEVENT
DTSTART:20260622T160000Z
DTEND:20260622T164500Z
DTSTAMP:20260617T090000Z
ORGANIZER;CN=Stripe Recruiting:mailto:recruiting@stripe.com
UID:stripe-interview-001@google.com
SUMMARY:Interview: Backend Engineer @ Stripe
STATUS:CANCELLED
SEQUENCE:1
END:VEVENT
END:VCALENDAR`;

// An all-day event (VALUE=DATE → no time component → allDay true).
const ICS_ALLDAY_ONSITE = `BEGIN:VCALENDAR
PRODID:-//Acme//EN
VERSION:2.0
METHOD:REQUEST
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260701
DTEND;VALUE=DATE:20260702
UID:datadog-onsite-7@greenhouse.io
SUMMARY:Onsite: Senior Software Engineer @ Datadog
LOCATION:620 8th Ave, New York, NY
ORGANIZER;CN=Datadog Talent:mailto:talent@datadog.com
END:VEVENT
END:VCALENDAR`;

function base(
  partial: Omit<RawEmail, "references" | "to" | "labelIds" | "listUnsubscribe"> &
    Partial<Pick<RawEmail, "references" | "to" | "labelIds" | "listUnsubscribe">>,
): RawEmail {
  return {
    references: [],
    to: ["brucebanner010198@gmail.com"],
    labelIds: ["INBOX"],
    listUnsubscribe: false,
    ...partial,
  };
}

/**
 * The corpus. `expectedCategory` is the ground truth the test gate asserts
 * against - colocated so the corpus is self-documenting.
 */
export interface FixtureEmail {
  email: RawEmail;
  expectedCategory: EmailCategory;
  note: string;
}

export const fixtureEmails: FixtureEmail[] = [
  // --- REAL-INBOX NEGATIVES (must be NOT_JOB) ------------------------------
  {
    note: "GitHub security notice - 'application' means OAuth app, not a job.",
    expectedCategory: "NOT_JOB",
    email: base({
      gmailMessageId: "neg-github-1",
      gmailThreadId: "t-neg-github-1",
      from: "GitHub <noreply@github.com>",
      fromEmail: "noreply@github.com",
      fromName: "GitHub",
      fromDomain: "github.com",
      subject: "[GitHub] A third-party GitHub Application has been added to your account",
      snippet:
        "A third-party GitHub Application (Google Labs Jules) with the following permissions was recently authorized to access your account.",
      receivedAt: "2026-05-21T02:47:26.000Z",
    }),
  },
  {
    note: "Google AI Studio welcome - product onboarding, not a job offer.",
    expectedCategory: "NOT_JOB",
    email: base({
      gmailMessageId: "neg-aistudio-1",
      gmailThreadId: "t-neg-aistudio-1",
      from: "Google AI Studio <googleaistudio-noreply@google.com>",
      fromEmail: "googleaistudio-noreply@google.com",
      fromDomain: "google.com",
      subject: "Hi Bruce, welcome to Google AI Studio",
      snippet: "Build with the latest state-of-the-art models from Google DeepMind.",
      receivedAt: "2026-05-03T20:40:36.000Z",
      listUnsubscribe: true,
      labelIds: ["INBOX", "CATEGORY_UPDATES"],
    }),
  },
  {
    note: "OpenRouter product newsletter - bulk marketing.",
    expectedCategory: "NOT_JOB",
    email: base({
      gmailMessageId: "neg-openrouter-1",
      gmailThreadId: "t-neg-openrouter-1",
      from: "OpenRouter <welcome@openrouter.ai>",
      fromEmail: "welcome@openrouter.ai",
      fromDomain: "openrouter.ai",
      subject: "What shipped in May: Workspace Guardrails, Speech APIs, Model Fusion, 20 new models.",
      snippet: "Spend limits, prompt-injection blocking, voice in and out, and one answer from many models.",
      receivedAt: "2026-06-04T19:50:06.000Z",
      listUnsubscribe: true,
      labelIds: ["INBOX", "CATEGORY_PROMOTIONS"],
    }),
  },
  {
    note: "Google 'career prep' MARKETING - mentions resume+interview but is an ad.",
    expectedCategory: "NOT_JOB",
    email: base({
      gmailMessageId: "neg-gemini-career-1",
      gmailThreadId: "t-neg-gemini-career-1",
      from: "Google Gemini <google-gemini-noreply@google.com>",
      fromEmail: "google-gemini-noreply@google.com",
      fromDomain: "google.com",
      subject: "Bruce, navigate career prep and land the right role",
      snippet: "Craft a compelling resume and level up your interview skills.",
      receivedAt: "2025-09-17T00:17:24.000Z",
      listUnsubscribe: true,
      labelIds: ["INBOX", "CATEGORY_PROMOTIONS"],
    }),
  },
  {
    note: "Health-app onboarding nudge - unrelated bulk mail.",
    expectedCategory: "NOT_JOB",
    email: base({
      gmailMessageId: "neg-perplexity-1",
      gmailThreadId: "t-neg-perplexity-1",
      from: "Perplexity <team@mail.perplexity.ai>",
      fromEmail: "team@mail.perplexity.ai",
      fromDomain: "mail.perplexity.ai",
      subject: "Complete onboarding to get personalized health insights",
      snippet: "Connect your wearables, records, goals, and labs in just a few steps.",
      receivedAt: "2026-04-27T20:12:39.000Z",
      listUnsubscribe: true,
      labelIds: ["INBOX", "CATEGORY_UPDATES"],
    }),
  },

  // --- POSITIVES -----------------------------------------------------------
  {
    note: "Interview invite WITH an .ics REQUEST - threads onto the Stripe app.",
    expectedCategory: "INTERVIEW_INVITE",
    email: base({
      gmailMessageId: "pos-stripe-invite-1",
      gmailThreadId: "t-stripe-1",
      rfcMessageId: "<stripe-invite-1@mail.stripe.com>",
      from: "Stripe Recruiting <recruiting@stripe.com>",
      fromEmail: "recruiting@stripe.com",
      fromName: "Stripe Recruiting",
      fromDomain: "stripe.com",
      subject: "Interview with Stripe - Backend Engineer",
      snippet:
        "We'd love to schedule a 45-minute interview for the Backend Engineer role. Please find the calendar invite attached.",
      bodyText:
        "Hi Bruce, thanks for applying to the Backend Engineer role at Stripe. We'd love to schedule a 45-minute video interview. The calendar invite is attached - let us know if the time doesn't work.",
      receivedAt: "2026-06-16T13:00:00.000Z",
      icsRaw: ICS_INTERVIEW_REQUEST,
    }),
  },
  {
    note: "Interview CANCEL with an .ics CANCEL - still job-related; event.cancelled.",
    expectedCategory: "INTERVIEW_INVITE",
    email: base({
      gmailMessageId: "pos-stripe-cancel-1",
      gmailThreadId: "t-stripe-1",
      rfcMessageId: "<stripe-cancel-1@mail.stripe.com>",
      references: ["<stripe-invite-1@mail.stripe.com>"],
      from: "Stripe Recruiting <recruiting@stripe.com>",
      fromEmail: "recruiting@stripe.com",
      fromDomain: "stripe.com",
      subject: "Canceled: Interview with Stripe - Backend Engineer",
      snippet: "Unfortunately we need to cancel and will follow up to reschedule.",
      receivedAt: "2026-06-17T09:00:00.000Z",
      icsRaw: ICS_INTERVIEW_CANCEL,
    }),
  },
  {
    note: "Onsite invite with an ALL-DAY .ics - threads onto the Datadog app.",
    expectedCategory: "INTERVIEW_INVITE",
    email: base({
      gmailMessageId: "pos-datadog-onsite-1",
      gmailThreadId: "t-datadog-2",
      from: "Datadog Talent <talent@datadog.com>",
      fromEmail: "talent@datadog.com",
      fromDomain: "datadog.com",
      subject: "Your onsite interview at Datadog",
      snippet: "We're excited to invite you for a full-day onsite. Invite attached.",
      receivedAt: "2026-06-18T15:00:00.000Z",
      icsRaw: ICS_ALLDAY_ONSITE,
    }),
  },
  {
    note: "Application receipt - proposes APPLIED, low risk. Threads to Datadog.",
    expectedCategory: "APPLICATION_RECEIVED",
    email: base({
      gmailMessageId: "pos-datadog-received-1",
      gmailThreadId: "t-datadog-2",
      from: "Datadog Careers <no-reply@greenhouse.io>",
      fromEmail: "no-reply@greenhouse.io",
      fromDomain: "greenhouse.io",
      subject: "Thank you for applying to Datadog - Senior Software Engineer",
      snippet:
        "We've received your application for the Senior Software Engineer role and our team is reviewing it.",
      receivedAt: "2026-06-10T17:30:00.000Z",
    }),
  },
  {
    note: "SOFT rejection ('keep your resume on file') - propose REJECTED, soft=true.",
    expectedCategory: "SOFT_REJECTION",
    email: base({
      gmailMessageId: "pos-figma-soft-1",
      gmailThreadId: "t-figma-3",
      from: "Figma Talent <talent@figma.com>",
      fromEmail: "talent@figma.com",
      fromDomain: "figma.com",
      subject: "Update on your application - Figma",
      snippet:
        "We've decided to move forward with other candidates at this time, but we'll keep your resume on file for future roles.",
      receivedAt: "2026-06-12T18:05:00.000Z",
    }),
  },
  {
    note: "Hard rejection - propose REJECTED.",
    expectedCategory: "REJECTION",
    email: base({
      gmailMessageId: "pos-airbnb-reject-1",
      gmailThreadId: "t-airbnb-4",
      from: "Airbnb Recruiting <recruiting@airbnb.com>",
      fromEmail: "recruiting@airbnb.com",
      fromDomain: "airbnb.com",
      subject: "Your application to Airbnb",
      snippet:
        "After careful consideration we have decided not to move forward with your application for this position.",
      receivedAt: "2026-06-09T16:40:00.000Z",
    }),
  },
  {
    note: "OFFER - the worst to get wrong; always confirm. Threads to Vercel.",
    expectedCategory: "OFFER",
    email: base({
      gmailMessageId: "pos-vercel-offer-1",
      gmailThreadId: "t-vercel-5",
      from: "Vercel Recruiting <recruiting@vercel.com>",
      fromEmail: "recruiting@vercel.com",
      fromDomain: "vercel.com",
      subject: "Your offer from Vercel",
      snippet:
        "We are delighted to extend an offer for the Senior Frontend Engineer position. The formal offer letter is attached.",
      receivedAt: "2026-06-15T19:20:00.000Z",
    }),
  },
  {
    note: "Recruiter cold outreach - a LEAD, not a status change on an existing app.",
    expectedCategory: "RECRUITER_OUTREACH",
    email: base({
      gmailMessageId: "pos-meta-outreach-1",
      gmailThreadId: "t-meta-6",
      from: "Jane Recruiter <jane.recruiter@meta.com>",
      fromEmail: "jane.recruiter@meta.com",
      fromDomain: "meta.com",
      subject: "Opportunity at Meta - Staff Software Engineer",
      snippet:
        "I came across your profile and thought you'd be a great fit for a Staff Engineer role on our infrastructure team. Would you be open to a quick chat?",
      receivedAt: "2026-06-14T14:10:00.000Z",
    }),
  },
  {
    note: "Online assessment request - a screening step; propose INTERVIEWING.",
    expectedCategory: "ASSESSMENT",
    email: base({
      gmailMessageId: "pos-coinbase-assess-1",
      gmailThreadId: "t-coinbase-7",
      from: "Coinbase via HackerRank <no-reply@hackerrank.com>",
      fromEmail: "no-reply@hackerrank.com",
      fromDomain: "hackerrank.com",
      subject: "Complete your coding assessment for your Coinbase application",
      snippet:
        "As the next step in your application, please complete the online coding assessment within 5 days.",
      receivedAt: "2026-06-13T15:55:00.000Z",
    }),
  },
];

/** Convenience: just the RawEmail list, newest first (matches Gmail order). */
export const fixtureRawEmails: RawEmail[] = [...fixtureEmails]
  .map((f) => f.email)
  .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

/**
 * Fixture applications for threading + the offline board preview. Each maps to
 * a column and (where relevant) the threads/domains above.
 */
export const fixtureApps: AppRef[] = [
  {
    id: "app-stripe",
    status: "APPLIED",
    company: "Stripe",
    companyDomain: "stripe.com",
    jobTitle: "Backend Engineer",
    gmailThreadIds: ["t-stripe-1"],
    rfcMessageIds: ["<stripe-invite-1@mail.stripe.com>"],
  },
  {
    id: "app-datadog",
    status: "APPLIED",
    company: "Datadog",
    companyDomain: "datadog.com",
    jobTitle: "Senior Software Engineer",
    gmailThreadIds: ["t-datadog-2"],
    rfcMessageIds: [],
  },
  {
    id: "app-figma",
    status: "APPLIED",
    company: "Figma",
    companyDomain: "figma.com",
    jobTitle: "Product Engineer",
    gmailThreadIds: ["t-figma-3"],
    rfcMessageIds: [],
  },
  {
    id: "app-airbnb",
    status: "INTERVIEWING",
    company: "Airbnb",
    companyDomain: "airbnb.com",
    jobTitle: "Software Engineer",
    gmailThreadIds: ["t-airbnb-4"],
    rfcMessageIds: [],
  },
  {
    id: "app-vercel",
    status: "INTERVIEWING",
    company: "Vercel",
    companyDomain: "vercel.com",
    jobTitle: "Senior Frontend Engineer",
    gmailThreadIds: ["t-vercel-5"],
    rfcMessageIds: [],
  },
  {
    id: "app-coinbase",
    status: "APPLIED",
    company: "Coinbase",
    companyDomain: "coinbase.com",
    jobTitle: "Backend Engineer",
    gmailThreadIds: ["t-coinbase-7"],
    rfcMessageIds: [],
  },
  {
    id: "app-warm-notion",
    status: "WARM_PATH",
    company: "Notion",
    companyDomain: "notion.so",
    jobTitle: "Software Engineer",
    gmailThreadIds: [],
    rfcMessageIds: [],
  },
  {
    id: "app-toapply-linear",
    status: "TO_APPLY",
    company: "Linear",
    companyDomain: "linear.app",
    jobTitle: "Full-Stack Engineer",
    gmailThreadIds: [],
    rfcMessageIds: [],
  },
];
