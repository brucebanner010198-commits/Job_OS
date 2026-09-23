/**
 * Browser Use ApplyDriver: hands the prepared fields to the Python agent
 * (scripts/apply_with_browser_use.py) and maps its report to a SubmitResult.
 *
 * Privacy: the model is chosen by resolveAgentModel (local unless the user
 * consented), the child process gets a minimal environment with at most one
 * API key, and the run is recorded in the privacy ledger.
 */

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ApplyDriver, PageSignals, PreparedField, SubmitResult } from "@/lib/apply/types";
import { isPublicHttpUrl } from "@/lib/security/url";
import { JobOSError } from "@/lib/errors/job-os-error";
import { resolveAgentModel } from "@/lib/ai/agent-model";
import { recordToLedger } from "@/lib/ai/ledger";

export interface BrowserUseDriverOptions {
  dryRun?: boolean;
  headless?: boolean;
  pythonPath?: string;
  timeoutMs?: number;
}

interface PythonAgentResult {
  ok: boolean;
  outcome: "submitted" | "stopped_at_review" | "failed";
  detail: string;
  error?: string;
  confirmation?: string | null;
  unanswered?: string[];
}

/** Environment passed to the agent. Nothing else from process.env leaks in. */
function childEnv(apiKey?: string): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    LANG: process.env.LANG ?? "en_US.UTF-8",
    TMPDIR: process.env.TMPDIR,
    ANONYMIZED_TELEMETRY: "false",
    BROWSER_USE_CLOUD_SYNC: "false",
  };
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (apiKey) env.JOBOS_LLM_API_KEY = apiKey;
  return env;
}

export function browserUseDriver(opts?: BrowserUseDriverOptions): ApplyDriver {
  const dryRun = opts?.dryRun ?? true;
  const headless = opts?.headless ?? true;
  // Local vision models are slower than cloud ones; 30 agent steps can take minutes.
  const timeoutMs = opts?.timeoutMs ?? 600_000;
  let openedUrl = "";
  let submitted = false;
  let preparedFields: PreparedField[] = [];
  let attachedPdfPath: string | null = null;

  const pythonExe = opts?.pythonPath ?? path.resolve(process.cwd(), ".venv-browser-use/bin/python");

  return {
    name: dryRun ? "browser-use(dry-run)" : "browser-use",

    async open(url: string): Promise<void> {
      if (!isPublicHttpUrl(url)) {
        throw JobOSError.invalidArgument({
          domain: "apply.browser-use",
          reason: "NON_PUBLIC_URL",
          location: "lib/apply/driver-browser-use.ts:open",
          message: "Refused a non-public application URL.",
          remedy: "Provide a public HTTPS or HTTP job application URL.",
        });
      }
      openedUrl = url;
    },

    async scan(): Promise<PageSignals> {
      if (!openedUrl) {
        throw JobOSError.failedPrecondition({
          domain: "apply.browser-use",
          reason: "SESSION_NOT_OPENED",
          location: "lib/apply/driver-browser-use.ts:scan",
          message: "open() must be called before scan().",
        });
      }
      // The agent detects walls itself and reports blocked_reason; this
      // pre-check has no page to look at yet.
      return {
        url: openedUrl,
        host: new URL(openedUrl).host,
        markers: ["browser-use"],
        hasLoginForm: false,
        hasCaptcha: false,
      };
    },

    async fill(fields: PreparedField[]): Promise<void> {
      // Only confirmed values travel; unknown fields stay blank and the agent
      // reports them as unanswered.
      preparedFields = fields.filter((f) => f.value && f.source !== "unknown");
    },

    async attachResume(pdfPath: string): Promise<boolean> {
      try {
        await fs.access(pdfPath);
        attachedPdfPath = pdfPath;
        return true;
      } catch {
        return false;
      }
    },

    async submit(): Promise<SubmitResult> {
      if (submitted) {
        throw JobOSError.failedPrecondition({
          domain: "apply.browser-use",
          reason: "DOUBLE_SUBMISSION",
          location: "lib/apply/driver-browser-use.ts:submit",
          message: "submit() called twice; concurrency=1 invariant violated.",
        });
      }
      submitted = true;
      if (!openedUrl) {
        throw JobOSError.failedPrecondition({
          domain: "apply.browser-use",
          reason: "NO_OPEN_URL",
          location: "lib/apply/driver-browser-use.ts:submit",
          message: "open() must be called before submit().",
        });
      }

      const agent = await resolveAgentModel("applyAgent");

      const scratch = path.resolve(process.cwd(), "storage/scratch");
      await fs.mkdir(scratch, { recursive: true });
      const fieldsPath = path.join(scratch, `fields_${Date.now()}.json`);
      const payload = preparedFields.map(({ key, label, value }) => ({ key, label, value }));
      // Owner-only: the file holds contact details for the few seconds it exists.
      await fs.writeFile(fieldsPath, JSON.stringify({ fields: payload }), { encoding: "utf-8", mode: 0o600 });

      const args = [
        path.resolve(process.cwd(), "scripts/apply_with_browser_use.py"),
        "--url", openedUrl,
        "--candidate-json", fieldsPath,
        "--provider", agent.provider,
        "--model", agent.model,
        "--ollama-url", agent.ollamaUrl,
        dryRun ? "--dry-run" : "--no-dry-run",
        headless ? "--headless" : "--no-headless",
      ];
      if (attachedPdfPath) args.push("--resume", attachedPdfPath);

      const started = Date.now();
      try {
        const result = await runAgent(pythonExe, args, childEnv(agent.apiKey), timeoutMs);
        recordToLedger({
          kind: "ai",
          purpose: "applyAgent",
          provider: agent.provider,
          model: agent.model,
          destination: agent.destination,
          local: agent.provider === "ollama",
          // Page screenshots are sent to the model; their size is not measured.
          bytesOut: 0,
          durationMs: Date.now() - started,
          ok: result.ok,
          errorReason: result.error,
        });
        return {
          outcome: result.outcome,
          detail: result.detail,
          confirmation: result.confirmation ?? undefined,
          unanswered: result.unanswered ?? [],
        };
      } finally {
        await fs.rm(fieldsPath, { force: true });
      }
    },

    async close(): Promise<void> {
      preparedFields = [];
      attachedPdfPath = null;
    },
  };
}

function runAgent(
  pythonExe: string,
  args: string[],
  env: Record<string, string | undefined>,
  timeoutMs: number,
): Promise<PythonAgentResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(/*turbopackIgnore: true*/ pythonExe, args, {
      env: env as NodeJS.ProcessEnv,
      cwd: process.cwd(),
    });
    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(
        JobOSError.unavailable({
          domain: "apply.browser-use",
          reason: "TIMEOUT",
          location: "lib/apply/driver-browser-use.ts:runAgent",
          message: `The application agent timed out after ${Math.round(timeoutMs / 1000)}s.`,
          remedy: "Try again, or finish this application yourself from the review screen.",
        }),
      );
    }, timeoutMs);

    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));

    child.on("close", (code) => {
      clearTimeout(timer);
      // The script prints exactly one JSON object; logs go to stderr.
      const jsonStart = stdout.indexOf("{");
      try {
        resolve(JSON.parse(stdout.slice(jsonStart)) as PythonAgentResult);
      } catch {
        reject(
          JobOSError.internal({
            domain: "apply.browser-use",
            reason: "BAD_AGENT_OUTPUT",
            location: "lib/apply/driver-browser-use.ts:runAgent",
            message: `The application agent exited (code ${code}) without a readable report.`,
            remedy: "Run `npm run test:browser-use` to check the agent setup.",
            metadata: { stderrTail: stderr.slice(-500) },
          }),
        );
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(
        JobOSError.internal({
          domain: "apply.browser-use",
          reason: "SPAWN_ERROR",
          location: "lib/apply/driver-browser-use.ts:runAgent",
          message: "Could not start the application agent.",
          remedy: "Create the Python environment: python3 -m venv .venv-browser-use && .venv-browser-use/bin/pip install -r requirements-browser-use.txt",
          metadata: { originalError: err.message },
        }),
      );
    });
  });
}
