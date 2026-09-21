/**
 * lib/apply/driver-browser-use.ts
 *
 * Autonomous Browser Use ApplyDriver implementation.
 * Connects the Job OS application pipeline to the Python Browser Use agent
 * for visual multi-step ATS form navigation, resume uploading, and submission.
 */

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ApplyDriver, PageSignals, PreparedField } from "@/lib/apply/types";
import { isPublicHttpUrl } from "@/lib/security/url";
import { JobOSError } from "@/lib/errors/job-os-error";

export interface BrowserUseDriverOptions {
  dryRun?: boolean;
  model?: string;
  pythonPath?: string;
  timeoutMs?: number;
}

interface PythonAgentResult {
  ok: boolean;
  status: string;
  fieldsFilled: string[];
  detail: string;
  error?: string;
}

export function browserUseDriver(opts?: BrowserUseDriverOptions): ApplyDriver {
  const dryRun = opts?.dryRun ?? true;
  const timeoutMs = opts?.timeoutMs ?? 180_000;
  let openedUrl = "";
  let submitted = false;
  let candidateFields: PreparedField[] = [];
  let attachedPdfPath: string | null = null;

  function resolvePythonExecutable(): string {
    if (opts?.pythonPath) return opts.pythonPath;
    const localVenvPython = path.resolve(process.cwd(), ".venv-browser-use/bin/python");
    return localVenvPython;
  }

  return {
    name: dryRun ? "browser-use(dry-run)" : "browser-use",

    async open(url: string): Promise<void> {
      if (!isPublicHttpUrl(url)) {
        throw JobOSError.invalidArgument({
          domain: "apply.browser-use",
          reason: "NON_PUBLIC_URL",
          location: "lib/apply/driver-browser-use.ts:open",
          message: `browserUseDriver: refused non-public URL: ${url}`,
          remedy: "Provide a public HTTPS or HTTP job application URL.",
          metadata: { url },
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
          message: "browserUseDriver: open() must be called before scan().",
          remedy: "Call open(url) before attempting to scan page signals.",
        });
      }

      let host = "";
      try {
        host = new URL(openedUrl).host;
      } catch {
        host = openedUrl;
      }

      return {
        url: openedUrl,
        host,
        markers: ["browser-use", "job-portal"],
        hasLoginForm: false,
        hasCaptcha: false,
      };
    },

    async fill(fields: PreparedField[]): Promise<void> {
      candidateFields = fields.filter((f) => f.value && f.source !== "unknown");
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

    async submit(): Promise<{ ok: boolean; detail?: string }> {
      if (submitted) {
        throw JobOSError.failedPrecondition({
          domain: "apply.browser-use",
          reason: "DOUBLE_SUBMISSION",
          location: "lib/apply/driver-browser-use.ts:submit",
          message: "browserUseDriver: submit() called twice - concurrency=1 invariant violated.",
          remedy: "Ensure each driver instance submits at most once.",
        });
      }
      submitted = true;

      if (!openedUrl) {
        throw JobOSError.failedPrecondition({
          domain: "apply.browser-use",
          reason: "NO_OPEN_URL",
          location: "lib/apply/driver-browser-use.ts:submit",
          message: "browserUseDriver: no open URL available for application submission.",
          remedy: "Call open(url) before submitting.",
        });
      }

      const tempDir = path.resolve(process.cwd(), "storage/scratch");
      await fs.mkdir(tempDir, { recursive: true });
      const tempJsonPath = path.join(tempDir, `candidate_${Date.now()}.json`);

      const candidateMap: Record<string, string> = {};
      for (const field of candidateFields) {
        candidateMap[field.key] = field.value;
      }

      await fs.writeFile(tempJsonPath, JSON.stringify(candidateMap, null, 2), "utf-8");

      const scriptPath = path.resolve(process.cwd(), "scripts/apply_with_browser_use.py");
      const pythonExe = resolvePythonExecutable();

      const args = [
        scriptPath,
        "--url",
        openedUrl,
        "--candidate-json",
        tempJsonPath,
      ];

      if (attachedPdfPath) {
        args.push("--resume", attachedPdfPath);
      }
      if (dryRun) {
        args.push("--dry-run");
      }
      if (opts?.model) {
        args.push("--model", opts.model);
      }

      try {
        const result = await new Promise<PythonAgentResult>((resolve, reject) => {
          const child = spawn(pythonExe, args, {
            env: { ...process.env },
            cwd: process.cwd(),
            /*turbopackIgnore: true*/
          });

          let stdout = "";
          let stderr = "";

          const timer = setTimeout(() => {
            child.kill("SIGTERM");
            reject(
              JobOSError.unavailable({
                domain: "apply.browser-use",
                reason: "TIMEOUT",
                location: "lib/apply/driver-browser-use.ts:submit",
                message: `browser-use application agent timed out after ${timeoutMs / 1000}s.`,
                remedy: "Check network connectivity and consider increasing the driver timeout.",
                metadata: { url: openedUrl },
              }),
            );
          }, timeoutMs);

          child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
          });

          child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
          });

          child.on("close", (code) => {
            clearTimeout(timer);
            try {
              const parsed = JSON.parse(stdout.trim()) as PythonAgentResult;
              resolve(parsed);
            } catch {
              if (code !== 0) {
                reject(
                  JobOSError.internal({
                    domain: "apply.browser-use",
                    reason: "PROCESS_FAILED",
                    location: "lib/apply/driver-browser-use.ts:submit",
                    message: `browser-use agent exited with code ${code}: ${stderr || stdout}`,
                    remedy: "Verify Python environment dependencies and OpenRouter API key configuration.",
                    metadata: { stderr, stdout },
                  }),
                );
              } else {
                resolve({
                  ok: true,
                  status: "completed",
                  fieldsFilled: [],
                  detail: stdout.trim(),
                });
              }
            }
          });

          child.on("error", (err) => {
            clearTimeout(timer);
            reject(
              JobOSError.internal({
                domain: "apply.browser-use",
                reason: "SPAWN_ERROR",
                location: "lib/apply/driver-browser-use.ts:submit",
                message: `Failed to spawn browser-use process: ${err.message}`,
                remedy: "Ensure the Python virtual environment (.venv-browser-use) is created and accessible.",
                metadata: { originalError: err.message },
              }),
            );
          });
        });

        return {
          ok: result.ok,
          detail: result.detail || result.status,
        };
      } finally {
        await fs.unlink(tempJsonPath).catch(() => {});
      }
    },

    async close(): Promise<void> {
      candidateFields = [];
      attachedPdfPath = null;
    },
  };
}
