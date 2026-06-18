/**
 * Pure staleness helpers for the career content agent. Compares profile
 * content freshness against last-generated resume/cover letter timestamps.
 */
import type { CoverLetter, ResumeVersion } from "@prisma/client";

export function isContentStale(
  profileWatermark: Date | null,
  lastGeneratedAt: Date | null,
): boolean {
  if (profileWatermark === null) return false;
  if (lastGeneratedAt === null) return true;
  return profileWatermark > lastGeneratedAt;
}

export function isTargetResumeStale(
  profileWatermark: Date | null,
  latestResume: ResumeVersion | null,
): boolean {
  return isContentStale(profileWatermark, latestResume?.createdAt ?? null);
}

export function isTargetCoverStale(
  profileWatermark: Date | null,
  latestCover: CoverLetter | null,
): boolean {
  return isContentStale(profileWatermark, latestCover?.createdAt ?? null);
}
