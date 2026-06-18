/**
 * Backup fixtures (Phase 11) - a deterministic sample profile so the gate can
 * assert hashing/round-trip without a DB, and so the /backups page renders a
 * believable offline preview when Postgres is unreachable. Time is frozen.
 */
import type {
  BackupRecord,
  ExportedEntry,
  ExportedNote,
} from "@/lib/backup/types";
import type { RawProfile } from "@/lib/backup/snapshot";

export const FIXTURE_NOW = "2026-06-17T12:00:00.000Z";

const fixtureEntries: ExportedEntry[] = [
  {
    kind: "EXPERIENCE",
    data: {
      title: "Senior Software Engineer",
      company: "Acme Corp",
      start: "2021-03",
      end: "present",
      bullets: ["Led the payments rewrite", "Cut p95 latency 40%"],
    },
    sourceNote: "imported from resume",
    sensitive: false,
    createdAt: "2026-05-01T09:00:00.000Z",
  },
  {
    kind: "SKILL",
    data: { name: "TypeScript", level: "expert" },
    sensitive: false,
    createdAt: "2026-05-02T09:00:00.000Z",
  },
  {
    kind: "LIFE_FACT",
    data: { note: "Primary caregiver on Mondays" },
    sourceNote: "dictation",
    // Sensitive: filtered before any LLM, but it IS part of the backup.
    sensitive: true,
    createdAt: "2026-05-03T09:00:00.000Z",
  },
];

const fixtureNotes: ExportedNote[] = [
  {
    rawText: "shipped the new onboarding flow last week, big win",
    cleanedText: "Shipped the new onboarding flow last week.",
    source: "dictation",
    createdAt: "2026-05-04T09:00:00.000Z",
  },
];

export const fixtureProfile: RawProfile = {
  user: { name: "Bruce Banner", email: "brucebanner010198@gmail.com" },
  entries: fixtureEntries,
  notes: fixtureNotes,
};

export const EXPECTED = {
  entryCount: 3,
  noteCount: 1,
  sensitiveCount: 1,
} as const;

/** Two synthetic backup records for the offline /backups preview. */
export const fixtureRecords: BackupRecord[] = [
  {
    id: "bkp_preview_2",
    label: undefined,
    trigger: "scheduled",
    contentHash: "preview2hashpreview2hashpreview2hashpreview2hash01",
    entryCount: 3,
    noteCount: 1,
    sensitiveCount: 1,
    byteSize: 1840,
    fileName: "20260617-0600-preview2.json.enc",
    createdAt: "2026-06-17T06:00:00.000Z",
  },
  {
    id: "bkp_preview_1",
    label: "before resume import",
    trigger: "manual",
    contentHash: "preview1hashpreview1hashpreview1hashpreview1hash00",
    entryCount: 2,
    noteCount: 0,
    sensitiveCount: 0,
    byteSize: 920,
    fileName: "20260615-1030-preview1.json.enc",
    createdAt: "2026-06-15T10:30:00.000Z",
  },
];
