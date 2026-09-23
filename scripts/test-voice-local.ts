/**
 * Local speech-to-text gate. Needs the STT service (npm run jobos starts it).
 * Synthesizes a short clip with macOS `say`, sends it through the app's own
 * transcribeLocally, and checks the key words come back.
 *
 * Run: npx tsx scripts/test-voice-local.ts
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { transcribeLocally } from "@/lib/voice/transcribe";
import { flushLedger } from "@/lib/ai/ledger";

async function main() {
  const dir = mkdtempSync(path.join(tmpdir(), "jobos-stt-"));
  const aiff = path.join(dir, "clip.aiff");
  const webm = path.join(dir, "clip.webm");
  execFileSync("say", ["-o", aiff, "I finished the billing migration and completed module three of the Kubernetes course."]);
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", aiff, "-c:a", "libopus", webm]);

  const bytes = readFileSync(webm);
  const t0 = Date.now();
  const text = (await transcribeLocally(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))).toLowerCase();
  const ms = Date.now() - t0;
  const ok = ["billing", "migration", "kubernetes"].every((w) => text.includes(w));
  console.log(`${ok ? "✓" : "✗"} transcribed in ${ms} ms: "${text}"`);
  await flushLedger();
  process.exit(ok ? 0 : 1);
}
main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
