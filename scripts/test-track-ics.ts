/**
 * Self-test for the iCalendar (.ics) VEVENT parser (Phase 6).
 * Pure, offline, deterministic. No LLM, no DB, no network.
 * Run: npx tsx scripts/test-track-ics.ts
 */
import { parseIcs } from "@/lib/track/ics";
import { fixtureRawEmails } from "@/lib/track/fixtures";
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

function icsById(id: string): string {
  const email = fixtureRawEmails.find((e: RawEmail) => e.gmailMessageId === id);
  if (!email) throw new Error(`fixture email not found: ${id}`);
  if (!email.icsRaw) throw new Error(`fixture email has no icsRaw: ${id}`);
  return email.icsRaw;
}

// --- REQUEST: timed UTC invite (the Stripe interview) -------------------------

console.log("\nics - Stripe REQUEST invite:");

const request = parseIcs(icsById("pos-stripe-invite-1"));
check("REQUEST parses to an event", request !== undefined);
check("REQUEST start = 2026-06-22T16:00:00.000Z", request?.start === "2026-06-22T16:00:00.000Z");
check("REQUEST allDay = false", request?.allDay === false);
check("REQUEST cancelled = false", request?.cancelled === false);
check('REQUEST method = "REQUEST"', request?.method === "REQUEST");
check("REQUEST summary is truthy", Boolean(request?.summary));

// --- CANCEL: cancelled invite (method + STATUS both signal it) ----------------

console.log("\nics - Stripe CANCEL:");

const cancel = parseIcs(icsById("pos-stripe-cancel-1"));
check("CANCEL parses to an event", cancel !== undefined);
check("CANCEL cancelled = true", cancel?.cancelled === true);
check('CANCEL method = "CANCEL"', cancel?.method === "CANCEL");

// --- All-day: VALUE=DATE onsite (the Datadog onsite) --------------------------

console.log("\nics - Datadog all-day onsite:");

const allDay = parseIcs(icsById("pos-datadog-onsite-1"));
check("all-day parses to an event", allDay !== undefined);
check("all-day allDay = true", allDay?.allDay === true);
check("all-day start = 2026-07-01", allDay?.start === "2026-07-01");

// --- Summary ------------------------------------------------------------------

console.log(`\nics ${passed}/${passed + failed}\n`);
if (failed > 0) process.exit(1);
