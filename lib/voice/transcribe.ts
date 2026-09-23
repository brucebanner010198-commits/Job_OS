/**
 * Speech-to-text through the local Parakeet service (scripts/stt_server.py).
 * Audio goes to 127.0.0.1 only and is not stored.
 */
import { recordToLedger } from "@/lib/ai/ledger";
import { JobOSError } from "@/lib/errors/job-os-error";

export const STT_URL = process.env.JOBOS_STT_URL ?? "http://127.0.0.1:8765";

export async function transcribeLocally(audio: ArrayBuffer): Promise<string> {
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(`${STT_URL}/transcribe`, {
      method: "POST",
      body: audio,
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw JobOSError.failedPrecondition({
      domain: "job_os.voice",
      reason: "STT_OFFLINE",
      location: "lib/voice/transcribe.ts",
      message: "The local speech service is not running.",
      remedy: "Start Job OS with `npm run jobos`, which starts it for you.",
    });
  }
  const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
  recordToLedger({
    kind: "ai",
    purpose: "transcribe",
    provider: "parakeet",
    destination: new URL(STT_URL).host,
    local: true,
    bytesOut: audio.byteLength,
    bytesIn: Buffer.byteLength(body.text ?? "", "utf8"),
    durationMs: Date.now() - started,
    ok: res.ok,
    errorReason: res.ok ? undefined : body.error,
  });
  if (!res.ok) {
    throw JobOSError.invalidArgument({
      domain: "job_os.voice",
      reason: "STT_FAILED",
      location: "lib/voice/transcribe.ts",
      message: body.error === "could not decode audio" ? "That recording could not be read." : "Transcription failed.",
      remedy: "Try recording again.",
    });
  }
  return body.text ?? "";
}
