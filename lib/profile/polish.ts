/**
 * Profile bullet polish - rewrites EXPERIENCE/PROJECT bullets into one of the
 * 10 resume frameworks (extractive, metric-grounded). Persists polish metadata
 * in ProfileEntry.data JSON; rawBullets preserved for audit.
 */
import { z } from "zod";
import { ProfileEntryKind, type ProfileEntry } from "@prisma/client";
import { chatJson } from "@/lib/ai/openrouter";
import {
  bulletFrameworkPromptBlock,
  type BulletFrameworkId,
} from "@/lib/resume/bullet-frameworks";
import {
  extractMetrics,
  groundingHaystack,
  isMetricGrounded,
} from "@/lib/util/metrics";
import type { AppScope } from "@/lib/profiles/types";
import {
  listEntriesNeedingPolish,
  updateEntry,
} from "@/lib/profile/service";

export const BULLET_POLISH_VERSION = 1;
export const MAX_POLISH_PER_RUN = 10;

export function maxPolishPerRun(): number {
  const n = parseInt(process.env.CAREER_AGENT_MAX_POLISH ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : MAX_POLISH_PER_RUN;
}

interface EntryData {
  bullets?: string[];
  rawBullets?: string[];
  bulletPolish?: {
    version: number;
    polishedAt: string;
    frameworks: BulletFrameworkId[];
  };
  title?: string;
  company?: string;
  name?: string;
  location?: string;
  start?: string;
  end?: string;
  description?: string;
}

const frameworkEnum = z.enum([
  "xyz",
  "teal",
  "apr",
  "star",
  "car",
  "par",
  "bar",
  "soar",
  "lps",
  "elite",
]);

const polishOutputSchema = z.object({
  bullets: z.array(z.string().min(1)),
  frameworks: z.array(frameworkEnum),
});

export interface PolishResult {
  ok: boolean;
  data?: EntryData;
  frameworks?: BulletFrameworkId[];
  reason?: string;
}

function getEntryData(entry: ProfileEntry): EntryData {
  if (typeof entry.data === "object" && entry.data !== null) {
    return entry.data as EntryData;
  }
  return {};
}

function getBullets(data: EntryData): string[] {
  if (!Array.isArray(data.bullets)) return [];
  return data.bullets.filter(
    (b): b is string => typeof b === "string" && b.trim().length > 0,
  );
}

export function needsPolish(entry: ProfileEntry): boolean {
  if (entry.sensitive) return false;
  if (
    entry.kind !== ProfileEntryKind.EXPERIENCE &&
    entry.kind !== ProfileEntryKind.PROJECT
  ) {
    return false;
  }
  const data = getEntryData(entry);
  if (getBullets(data).length === 0) return false;
  const polish = data.bulletPolish;
  return !polish || polish.version !== BULLET_POLISH_VERSION;
}

export function validatePolishedBullets(
  rawBullets: string[],
  polishedBullets: string[],
): { ok: boolean; reason?: string } {
  const haystack = groundingHaystack(rawBullets);
  const polishedText = polishedBullets.join("  ");
  for (const m of extractMetrics(polishedText)) {
    if (!isMetricGrounded(m.core, haystack)) {
      return {
        ok: false,
        reason: `Ungrounded metric "${m.raw}" not found in source bullets`,
      };
    }
  }
  return { ok: true };
}

function alignFrameworks(
  bullets: string[],
  frameworks: BulletFrameworkId[],
): BulletFrameworkId[] | null {
  if (frameworks.length === bullets.length) return frameworks;
  if (frameworks.length === 0) return null;
  const out: BulletFrameworkId[] = [];
  for (let i = 0; i < bullets.length; i++) {
    out.push(frameworks[i] ?? frameworks[frameworks.length - 1]!);
  }
  return out;
}

function buildPolishSystemPrompt(): string {
  return `You are an expert resume writer who is FORBIDDEN from inventing anything.

Hard rules:
- EXTRACTIVE ONLY. You may only use facts present in the provided bullets. Never invent or infer an employer, title, date, metric, skill, or achievement that is not in those bullets.
- Every NUMBER/METRIC you write (%, $, counts, multipliers) must appear verbatim in the source bullets. If a quantity is not in the sources, do not state it.
- Rewrite each bullet into polished resume prose using exactly one bullet framework.
- Preserve every fact and metric verbatim; never add content.

${bulletFrameworkPromptBlock()}

Return ONLY a JSON object matching the required schema with "bullets" and "frameworks" arrays of equal length.`;
}

function buildUserPrompt(entry: ProfileEntry, bullets: string[]): string {
  const data = getEntryData(entry);
  const meta: Record<string, unknown> = { kind: entry.kind };
  if (entry.kind === ProfileEntryKind.EXPERIENCE) {
    if (data.title) meta.title = data.title;
    if (data.company) meta.company = data.company;
    if (data.location) meta.location = data.location;
    if (data.start) meta.start = data.start;
    if (data.end) meta.end = data.end;
  } else {
    if (data.name) meta.name = data.name;
    if (data.description) meta.description = data.description;
  }
  return `Entry metadata:
${JSON.stringify(meta, null, 2)}

Current bullets (rewrite each into framework form - extractive only):
${JSON.stringify(bullets, null, 2)}`;
}

export async function polishEntry(entry: ProfileEntry): Promise<PolishResult> {
  const data = getEntryData(entry);
  const bullets = getBullets(data);
  if (bullets.length === 0) {
    return { ok: false, reason: "no bullets" };
  }

  const rawBullets =
    Array.isArray(data.rawBullets) && data.rawBullets.length > 0
      ? data.rawBullets.filter((b): b is string => typeof b === "string")
      : [...bullets];

  const { value } = await chatJson(polishOutputSchema, {
    task: "polishProfileBullets",
    temperature: 0.2,
    messages: [
      { role: "system", content: buildPolishSystemPrompt() },
      { role: "user", content: buildUserPrompt(entry, rawBullets) },
    ],
  });

  if (value.bullets.length !== rawBullets.length) {
    return {
      ok: false,
      reason: `bullet count mismatch: expected ${rawBullets.length}, got ${value.bullets.length}`,
    };
  }

  const frameworks = alignFrameworks(value.bullets, value.frameworks);
  if (!frameworks) {
    return { ok: false, reason: "missing frameworks" };
  }

  const validation = validatePolishedBullets(rawBullets, value.bullets);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason };
  }

  const updated: EntryData = {
    ...data,
    rawBullets,
    bullets: value.bullets,
    bulletPolish: {
      version: BULLET_POLISH_VERSION,
      polishedAt: new Date().toISOString(),
      frameworks,
    },
  };

  return { ok: true, data: updated, frameworks };
}

export async function polishProfileBullets(
  scope: AppScope,
): Promise<{ polished: number; skipped: number }> {
  const entries = await listEntriesNeedingPolish(scope);
  const cap = maxPolishPerRun();
  let polished = 0;
  let skipped = 0;

  for (const entry of entries.slice(0, cap)) {
    try {
      const result = await polishEntry(entry);
      if (result.ok && result.data) {
        await updateEntry(scope, entry.id, result.data);
        polished++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.error(`[career-agent] polish failed for entry ${entry.id}:`, err);
      skipped++;
    }
  }

  skipped += Math.max(0, entries.length - cap);
  return { polished, skipped };
}
