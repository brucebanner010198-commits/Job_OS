/**
 * Automated system diagnostics and health inspector following Google SRE practices.
 * Probes core subsystems (database, storage, secrets, AI providers, and system environment)
 * and produces clear pass/fail status with exact locations and remedies for any failure.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { getSecret } from "@/lib/secrets";
import type { CanonicalErrorCode } from "@/lib/errors/canonical-codes";

export interface DiagnosticProbeResult {
  name: string;
  subsystem: string;
  status: "pass" | "warn" | "fail";
  code: CanonicalErrorCode;
  latencyMs?: number;
  message: string;
  location?: string;
  remedy?: string;
  details?: Record<string, unknown>;
}

export interface SystemHealthReport {
  overallStatus: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  durationMs: number;
  checks: DiagnosticProbeResult[];
}

async function checkDatabase(): Promise<DiagnosticProbeResult> {
  const start = Date.now();
  try {
    await db.$queryRaw`SELECT 1 as alive`;
    const [userCount, targetCount, profileCount] = await Promise.all([
      db.user.count(),
      db.target.count(),
      db.profile.count(),
    ]);
    const latencyMs = Date.now() - start;

    return {
      name: "Database Connectivity",
      subsystem: "job_os.db",
      status: "pass",
      code: "OK",
      latencyMs,
      message: "Database connected and query succeeded.",
      details: {
        users: userCount,
        targets: targetCount,
        profiles: profileCount,
        latencyMs,
      },
    };
  } catch (err: unknown) {
    return {
      name: "Database Connectivity",
      subsystem: "job_os.db",
      status: "fail",
      code: "UNAVAILABLE",
      latencyMs: Date.now() - start,
      message: `Database query failed: ${err instanceof Error ? err.message : String(err)}`,
      location: "lib/diagnostics/system-health.ts:checkDatabase",
      remedy: "Ensure PostgreSQL is running (e.g. npm run db:up) and DATABASE_URL in .env is reachable.",
      details: {
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

async function checkStorage(): Promise<DiagnosticProbeResult> {
  const start = Date.now();
  const storageDirs = [
    path.join(process.cwd(), "storage", "master-resumes"),
    path.join(process.cwd(), "storage", "certifications"),
    path.join(process.cwd(), "storage", "backups"),
  ];

  const probed: Record<string, string> = {};

  try {
    for (const dir of storageDirs) {
      await fs.mkdir(dir, { recursive: true });
      const testFile = path.join(dir, `.probe_${Date.now()}.tmp`);
      await fs.writeFile(testFile, "probe", { mode: 0o600 });
      await fs.unlink(testFile);
      probed[path.basename(dir)] = "writable";
    }

    return {
      name: "File Storage Access",
      subsystem: "job_os.storage",
      status: "pass",
      code: "OK",
      latencyMs: Date.now() - start,
      message: "All storage directories exist and are writable.",
      details: probed,
    };
  } catch (err: unknown) {
    return {
      name: "File Storage Access",
      subsystem: "job_os.storage",
      status: "fail",
      code: "PERMISSION_DENIED",
      latencyMs: Date.now() - start,
      message: `File storage permission or write check failed: ${err instanceof Error ? err.message : String(err)}`,
      location: "lib/diagnostics/system-health.ts:checkStorage",
      remedy: "Check write permissions on the local storage/ directory (e.g. chmod 755 storage).",
      details: {
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

async function checkSecrets(): Promise<DiagnosticProbeResult> {
  const keyPath = path.join(process.cwd(), ".secrets", "session.key");
  const envSecret = process.env.SESSION_SECRET?.trim();

  try {
    const stats = await fs.stat(keyPath).catch(() => null);
    if (stats) {
      const mode = stats.mode & 0o777;
      const insecure = (mode & 0o077) !== 0;
      return {
        name: "Session Key & Encryption",
        subsystem: "job_os.auth",
        status: insecure ? "warn" : "pass",
        code: "OK",
        message: insecure
          ? "Session key file exists but has loose permissions."
          : "Session key file exists with strict permissions.",
        remedy: insecure ? "Run chmod 600 .secrets/session.key" : undefined,
        details: {
          keyFilePresent: true,
          mode: `0${mode.toString(8)}`,
        },
      };
    }

    if (envSecret) {
      return {
        name: "Session Key & Encryption",
        subsystem: "job_os.auth",
        status: "pass",
        code: "OK",
        message: "SESSION_SECRET loaded from environment variables.",
        details: {
          keyFilePresent: false,
          envSecretConfigured: true,
        },
      };
    }

    return {
      name: "Session Key & Encryption",
      subsystem: "job_os.auth",
      status: "warn",
      code: "FAILED_PRECONDITION",
      message: "No persistent session key or SESSION_SECRET found. An ephemeral key will be generated.",
      location: "lib/diagnostics/system-health.ts:checkSecrets",
      remedy: "Set SESSION_SECRET in .env or allow the app to write .secrets/session.key.",
    };
  } catch (err: unknown) {
    return {
      name: "Session Key & Encryption",
      subsystem: "job_os.auth",
      status: "fail",
      code: "INTERNAL",
      message: `Failed inspecting secret storage: ${err instanceof Error ? err.message : String(err)}`,
      location: "lib/diagnostics/system-health.ts:checkSecrets",
      remedy: "Check permissions on the .secrets directory.",
    };
  }
}

async function checkAiConfiguration(): Promise<DiagnosticProbeResult> {
  const providers = ["openrouter", "gemini", "openai", "anthropic"];
  const configured: string[] = [];

  for (const p of providers) {
    const key = await getSecret(`ai.${p}.key`).catch(() => null);
    const envKey =
      p === "openrouter"
        ? process.env.OPENROUTER_API_KEY
        : p === "gemini"
          ? process.env.GEMINI_API_KEY
          : p === "openai"
            ? process.env.OPENAI_API_KEY
            : process.env.ANTHROPIC_API_KEY;

    if (key?.trim() || envKey?.trim()) {
      configured.push(p);
    }
  }

  // Check Ollama reachability
  let ollamaOnline = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const res = await fetch("http://127.0.0.1:11434/api/tags", {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      ollamaOnline = true;
      configured.push("ollama");
    }
  } catch {
    // Ollama not running locally
  }

  if (configured.length > 0) {
    return {
      name: "AI Model Providers",
      subsystem: "job_os.ai",
      status: "pass",
      code: "OK",
      message: `Active AI providers: ${configured.join(", ")}.`,
      details: {
        activeProviders: configured,
        ollamaReachable: ollamaOnline,
      },
    };
  }

  return {
    name: "AI Model Providers",
    subsystem: "job_os.ai",
    status: "warn",
    code: "FAILED_PRECONDITION",
    message: "No AI provider keys configured and local Ollama is offline.",
    location: "lib/diagnostics/system-health.ts:checkAiConfiguration",
    remedy: "Navigate to Integrations (/integrations) to configure an API key or run `ollama serve` locally.",
    details: {
      activeProviders: [],
      ollamaReachable: false,
    },
  };
}

function checkSystemEnvironment(): DiagnosticProbeResult {
  const nodeVersion = process.version;
  const memoryUsage = process.memoryUsage();
  const rssMb = Math.round(memoryUsage.rss / 1024 / 1024);
  const heapUsedMb = Math.round(memoryUsage.heapUsed / 1024 / 1024);

  return {
    name: "Runtime Environment",
    subsystem: "job_os.system",
    status: "pass",
    code: "OK",
    message: `Node.js ${nodeVersion} on ${process.platform} (${process.arch}).`,
    details: {
      nodeVersion,
      platform: process.platform,
      arch: process.arch,
      rssMb,
      heapUsedMb,
      uptimeSeconds: Math.round(process.uptime()),
    },
  };
}

export async function runSystemDiagnostics(): Promise<SystemHealthReport> {
  const start = Date.now();

  const [dbResult, storageResult, secretsResult, aiResult] = await Promise.all([
    checkDatabase(),
    checkStorage(),
    checkSecrets(),
    checkAiConfiguration(),
  ]);

  const envResult = checkSystemEnvironment();
  const checks = [dbResult, storageResult, secretsResult, aiResult, envResult];

  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
  if (checks.some((c) => c.status === "fail")) {
    overallStatus = "unhealthy";
  } else if (checks.some((c) => c.status === "warn")) {
    overallStatus = "degraded";
  }

  return {
    overallStatus,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - start,
    checks,
  };
}
