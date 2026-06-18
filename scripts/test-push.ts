/**
 * Self-test for Phase 14 (Gmail Pub/Sub push relay). THIS IS THE test:push gate.
 * Pure + offline - covers the security-critical parsing/verification the webhook
 * depends on (the live watch/sync calls are network and aren't exercised here):
 *   A. parsePushEnvelope - decode a real Pub/Sub envelope; reject every malformed
 *      shape (bad JSON, missing data, bad base64, missing fields).
 *   B. verifyPushToken - the shared-secret gate: equal ⇒ ok; anything else ⇒ reject,
 *      and an UNSET expected secret never authorizes (relay not armed).
 * Run: npx tsx scripts/test-push.ts
 */
import { parsePushEnvelope, verifyPushToken } from "@/lib/gmail/push";

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

function envelope(payload: unknown): string {
  const data = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  return JSON.stringify({ message: { data, messageId: "1" }, subscription: "s" });
}

// ===========================================================================
// A. parsePushEnvelope
// ===========================================================================
console.log("\npush - parse Pub/Sub envelope:");
const good = parsePushEnvelope(envelope({ emailAddress: "me@gmail.com", historyId: 4242 }));
check("valid envelope parses", good?.emailAddress === "me@gmail.com" && good?.historyId === "4242");
check("numeric historyId is stringified", typeof good?.historyId === "string");
check("non-JSON body → null", parsePushEnvelope("not json") === null);
check("missing message → null", parsePushEnvelope(JSON.stringify({ subscription: "s" })) === null);
check("missing data → null", parsePushEnvelope(JSON.stringify({ message: {} })) === null);
check("non-base64 garbage data → null", parsePushEnvelope(JSON.stringify({ message: { data: "%%%not base64%%%" } })) === null);
check("payload missing emailAddress → null", parsePushEnvelope(envelope({ historyId: 1 })) === null);
check("payload missing historyId → null", parsePushEnvelope(envelope({ emailAddress: "x@y.com" })) === null);
check("empty body → null", parsePushEnvelope("") === null);

// ===========================================================================
// B. verifyPushToken
// ===========================================================================
console.log("\npush - shared-secret verification:");
check("equal tokens → authorized", verifyPushToken("s3cr3t-token", "s3cr3t-token") === true);
check("different tokens → rejected", verifyPushToken("wrong", "s3cr3t-token") === false);
check("length mismatch → rejected", verifyPushToken("s3cr3t", "s3cr3t-token") === false);
check("missing provided → rejected", verifyPushToken(null, "s3cr3t-token") === false);
check("UNSET expected secret never authorizes (relay not armed)", verifyPushToken("anything", undefined) === false);
check("both empty → rejected", verifyPushToken("", "") === false);

console.log(`\npush ${passed}/${passed + failed}\n`);
if (failed > 0) process.exit(1);
