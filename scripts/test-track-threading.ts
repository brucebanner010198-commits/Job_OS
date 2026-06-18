/**
 * Self-test for email → application threading (Phase 6).
 * Pure, offline, deterministic. No LLM, no DB, no network.
 * Run: npx tsx scripts/test-track-threading.ts
 */
import { matchEmailToApp } from "@/lib/track/threading";
import { fixtureRawEmails, fixtureApps } from "@/lib/track/fixtures";
import type { RawEmail } from "@/lib/track/types";

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

function byId(id: string): RawEmail {
  const email = fixtureRawEmails.find((e) => e.gmailMessageId === id);
  if (!email) throw new Error(`fixture email not found: ${id}`);
  return email;
}

// --- thread: hard Gmail-thread links (strongest) ------------------------------

console.log("\nthreading - thread id (strongest):");

const stripeInvite = matchEmailToApp(byId("pos-stripe-invite-1"), fixtureApps);
check(
  "Stripe interview invite → app-stripe",
  stripeInvite.applicationId === "app-stripe",
);
check(
  "Stripe interview invite matchedBy 'thread' @ 0.99",
  stripeInvite.matchedBy === "thread" && stripeInvite.confidence === 0.99,
);

const datadogReceived = matchEmailToApp(
  byId("pos-datadog-received-1"),
  fixtureApps,
);
check(
  "Datadog 'Thank you for applying' → app-datadog",
  datadogReceived.applicationId === "app-datadog",
);
check(
  "Datadog receipt matchedBy 'thread'",
  datadogReceived.matchedBy === "thread",
);

// --- none: a real-inbox negative threads to nothing ---------------------------

console.log("\nthreading - negative (must match nothing):");

const github = matchEmailToApp(byId("neg-github-1"), fixtureApps);
check("GitHub security notice → matchedBy 'none'", github.matchedBy === "none");
check(
  "GitHub security notice → no applicationId, confidence 0",
  github.applicationId === undefined && github.confidence === 0,
);

// --- domain: synthetic email, no thread/refs but a known domain ---------------

console.log("\nthreading - domain fallback:");

const syntheticFigma: RawEmail = {
  gmailMessageId: "x",
  gmailThreadId: "zzz",
  references: [],
  from: "",
  fromEmail: "a@figma.com",
  fromDomain: "figma.com",
  to: [],
  subject: "Re: your role",
  receivedAt: "2026-06-16T00:00:00.000Z",
  labelIds: [],
  listUnsubscribe: false,
};
const figmaMatch = matchEmailToApp(syntheticFigma, fixtureApps);
check("synthetic figma.com email → app-figma", figmaMatch.applicationId === "app-figma");
check(
  "synthetic figma.com email matchedBy 'domain' @ 0.7",
  figmaMatch.matchedBy === "domain" && figmaMatch.confidence === 0.7,
);

// --- Summary ------------------------------------------------------------------

console.log(`\nthreading ${passed}/${passed + failed}\n`);
if (failed > 0) process.exit(1);
