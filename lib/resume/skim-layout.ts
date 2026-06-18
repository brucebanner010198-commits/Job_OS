/**
 * Post-process tailored resume JSON for recruiter ~6-second skim order.
 * Reorders bullets and skill groups without inventing or editing claim text.
 */

import { ATS } from "./ats-rules";
import { type TailoredResume, type Bullet } from "./schema";
import { extractMetrics } from "@/lib/util/metrics";

/** Which resume fragments land in the recruiter's first-pass skim zone. */
export interface SkimZone {
  includesSummary: boolean;
  /** experience[roleIndex].bullets[bulletIndex] */
  experienceBullets: Array<{ roleIndex: number; bulletIndex: number }>;
  /** skills[groupIndex] - only groups likely visible above the fold */
  skillGroupIndices: number[];
}

export interface SkimLayoutResult {
  resume: TailoredResume;
  zone: SkimZone;
  strongestMetric?: { text: string; roleIndex: number; bulletIndex: number };
}

const FILLER_RE =
  /\b(responsible for|helped with|worked on|various|assisted with|duties included)\b/i;

/** Higher = more impressive for skim ordering. */
function bulletSkimScore(text: string): number {
  let score = 0;
  const metrics = extractMetrics(text);
  for (const m of metrics) {
    const raw = m.raw.toLowerCase();
    if (raw.includes("%")) score += 30;
    if (raw.includes("$")) score += 25;
    if (/\bx\b/.test(raw)) score += 20;
    const n = parseFloat(m.core);
    if (n >= 1_000_000) score += 35;
    else if (n >= 100_000) score += 28;
    else if (n >= 10_000) score += 22;
    else if (n >= 100) score += 12;
    else score += 8;
  }
  if (!FILLER_RE.test(text)) score += 5;
  if (text.length <= 120) score += 3;
  return score;
}

function sortBulletsBySkim(bullets: Bullet[]): Bullet[] {
  return [...bullets].sort(
    (a, b) => bulletSkimScore(b.text) - bulletSkimScore(a.text),
  );
}

function sortSkillGroups(
  resume: TailoredResume,
): TailoredResume["skills"] {
  const keywords = new Set(
    (resume.keywordsMatched ?? []).map((k) => k.toLowerCase()),
  );
  if (keywords.size === 0) return resume.skills;

  return [...resume.skills].sort((a, b) => {
    const hit = (name: string, skills: string[]) => {
      const blob = `${name} ${skills.join(" ")}`.toLowerCase();
      let n = 0;
      for (const kw of keywords) {
        if (blob.includes(kw)) n++;
      }
      return n;
    };
    return hit(b.name, b.skills) - hit(a.name, a.skills);
  });
}

function findStrongestMetric(
  resume: TailoredResume,
): SkimLayoutResult["strongestMetric"] {
  let best: { text: string; roleIndex: number; bulletIndex: number; score: number } | undefined;

  resume.experience.forEach((role, roleIndex) => {
    role.bullets.forEach((bullet, bulletIndex) => {
      const score = bulletSkimScore(bullet.text);
      if (extractMetrics(bullet.text).length === 0) return;
      if (!best || score > best.score) {
        best = { text: bullet.text, roleIndex, bulletIndex, score };
      }
    });
  });

  return best
    ? { text: best.text, roleIndex: best.roleIndex, bulletIndex: best.bulletIndex }
    : undefined;
}

/** Build the skim zone - content a recruiter sees in ~6 seconds (top third). */
export function computeSkimZone(resume: TailoredResume): SkimZone {
  const experienceBullets: SkimZone["experienceBullets"] = [];
  const firstRole = resume.experience[0];
  if (firstRole) {
    const cap = Math.min(2, firstRole.bullets.length, ATS.maxBulletsPerRole);
    for (let i = 0; i < cap; i++) {
      experienceBullets.push({ roleIndex: 0, bulletIndex: i });
    }
  }

  const skillCap = Math.min(2, resume.skills.length);
  const skillGroupIndices = Array.from({ length: skillCap }, (_, i) => i);

  return {
    includesSummary: Boolean(resume.summary?.text.trim()),
    experienceBullets,
    skillGroupIndices,
  };
}

/**
 * Reorder resume content for recruiter skim without changing claim text.
 * Call after LLM generation and before provenance audit.
 */
export function applySkimLayout(resume: TailoredResume): SkimLayoutResult {
  const experience = resume.experience.map((role) => ({
    ...role,
    bullets: sortBulletsBySkim(role.bullets).slice(0, ATS.maxBulletsPerRole),
  }));

  const next: TailoredResume = {
    ...resume,
    experience,
    skills: sortSkillGroups({ ...resume, experience }),
  };

  return {
    resume: next,
    zone: computeSkimZone(next),
    strongestMetric: findStrongestMetric(next),
  };
}
