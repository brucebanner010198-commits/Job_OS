import type { RawJob, JobSource } from "@/lib/jobs/types";
import { stripHtml } from "@/lib/brief/fetch-utils";

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name: string };
  updated_at?: string;
  content?: string;
}

interface AshbyJob {
  id: string;
  title: string;
  jobUrl: string;
  location?: string;
  department?: string;
  isRemote?: boolean;
  publishedAt?: string;
  descriptionPlain?: string;
}

interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  createdAt?: number;
  categories?: {
    location?: string;
    team?: string;
    commitment?: string;
  };
  workplaceType?: string;
  descriptionPlain?: string;
}

export type AtsKind = "greenhouse" | "ashby" | "lever";

export interface AtsBoard {
  ats: AtsKind;
  /** The company's board slug on that ATS, e.g. "stripe". */
  slug: string;
}

// Each slug was checked against the live board API on 2026-09-23.
const DEFAULT_BOARDS: AtsBoard[] = [
  ...["anthropic", "figma", "stripe", "gitlab", "datadog", "dropbox", "brex"].map(
    (slug) => ({ ats: "greenhouse" as const, slug }),
  ),
  ...["openai", "cursor", "ramp", "replit", "perplexity", "linear"].map(
    (slug) => ({ ats: "ashby" as const, slug }),
  ),
  { ats: "lever", slug: "spotify" },
];

/** Cap per run: every kept job is embedded and scored, which is slow on a laptop. */
const MAX_JOBS = 200;

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * Parse JOBS_ATS_COMPANIES ("greenhouse:stripe,ashby:ramp,lever:spotify").
 * Invalid entries are dropped. Returns null when unset so the defaults apply.
 */
export function parseAtsBoards(raw: string | undefined): AtsBoard[] | null {
  if (!raw || !raw.trim()) return null;
  const boards: AtsBoard[] = [];
  for (const entry of raw.split(",")) {
    const [ats, slug] = entry.trim().toLowerCase().split(":");
    if ((ats === "greenhouse" || ats === "ashby" || ats === "lever") && slug && SLUG_RE.test(slug)) {
      boards.push({ ats, slug });
    }
  }
  return boards;
}

/**
 * Split a query into alternatives ("A OR B", "A, B"), each a list of
 * lowercased words. An empty query gives no alternatives, which matches all.
 */
export function queryTokens(query: string): string[][] {
  return query
    .split(/\s+OR\s+|,/)
    .map((alt) =>
      alt
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .map((t) => t.replace(/^\.+|\.+$/g, ""))
        .filter((t) => t.length > 1),
    )
    .filter((alt) => alt.length > 0);
}

/**
 * True when every word of any one alternative appears in the title or
 * location. Team and description are left out on purpose: a manager role in
 * "Software Engineering", or any posting that mentions "engineer", would match.
 */
export function matchesQuery(alternatives: string[][], haystack: string): boolean {
  if (alternatives.length === 0) return true;
  const hay = haystack.toLowerCase();
  return alternatives.some((alt) => alt.every((t) => hay.includes(t)));
}

/** Greenhouse returns `content` as entity-escaped HTML: decode, then strip tags. */
export function greenhouseContentToText(content: string): string {
  return stripHtml(stripHtml(content));
}

function titleCase(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchGreenhouse(slug: string, tokens: string[][]): Promise<RawJob[]> {
  const data = (await getJson(
    `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
  )) as { jobs?: GreenhouseJob[] } | null;
  const list = Array.isArray(data?.jobs) ? data.jobs : [];
  return list
    .filter((j) =>
      matchesQuery(
        tokens,
        `${j.title} ${j.location?.name ?? ""}`,
      ),
    )
    .map((j) => ({
      source: "greenhouse-direct",
      sourceId: String(j.id),
      url: j.absolute_url,
      company: titleCase(slug),
      title: j.title,
      location: j.location?.name ?? "Remote",
      remote: (j.location?.name ?? "").toLowerCase().includes("remote"),
      description: j.content ? greenhouseContentToText(j.content) : j.title,
      atsType: "greenhouse",
      postedAt: j.updated_at ? new Date(j.updated_at) : undefined,
    }));
}

async function fetchAshby(slug: string, tokens: string[][]): Promise<RawJob[]> {
  const data = (await getJson(
    `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
  )) as { jobs?: AshbyJob[] } | null;
  const list = Array.isArray(data?.jobs) ? data.jobs : [];
  return list
    .filter((j) =>
      matchesQuery(tokens, `${j.title} ${j.location ?? ""} ${j.isRemote ? "remote" : ""}`),
    )
    .map((j) => ({
      source: "ashby-direct",
      sourceId: j.id,
      url: j.jobUrl,
      company: titleCase(slug),
      title: j.title,
      location: j.location ?? (j.isRemote ? "Remote" : undefined),
      remote: j.isRemote ?? false,
      description: j.descriptionPlain?.trim() || j.title,
      atsType: "ashby",
      postedAt: j.publishedAt ? new Date(j.publishedAt) : undefined,
    }));
}

async function fetchLever(slug: string, tokens: string[][]): Promise<RawJob[]> {
  // Lever answers an unknown slug with an error object, not an array.
  const data = await getJson(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  const list = Array.isArray(data) ? (data as LeverJob[]) : [];
  return list
    .filter((j) =>
      matchesQuery(
        tokens,
        `${j.text} ${j.categories?.location ?? ""} ${j.workplaceType ?? ""}`,
      ),
    )
    .map((j) => ({
      source: "lever-direct",
      sourceId: j.id,
      url: j.hostedUrl,
      company: titleCase(slug),
      title: j.text,
      location: j.categories?.location ?? "Remote",
      remote:
        j.workplaceType === "remote" ||
        (j.categories?.location ?? "").toLowerCase().includes("remote"),
      description: j.descriptionPlain?.trim() || j.text,
      atsType: "lever",
      postedAt: j.createdAt ? new Date(j.createdAt) : undefined,
    }));
}

const FETCHERS: Record<AtsKind, (slug: string, tokens: string[][]) => Promise<RawJob[]>> = {
  greenhouse: fetchGreenhouse,
  ashby: fetchAshby,
  lever: fetchLever,
};

/**
 * Direct ATS portal scanner: reads the public job-board APIs of Greenhouse,
 * Ashby and Lever for a list of companies. No keys, no middlemen. Jobs found
 * here carry the real application URL, which the Greenhouse form filler needs.
 * Set JOBS_ATS_COMPANIES to replace the default company list.
 */
export const atsPortalsSource: JobSource = {
  name: "ats-portals",
  enabled: () => process.env.JOBS_FREE_SOURCES !== "0",

  async fetch(query: string): Promise<RawJob[]> {
    const tokens = queryTokens(query);
    const boards = parseAtsBoards(process.env.JOBS_ATS_COMPANIES) ?? DEFAULT_BOARDS;
    const results = await Promise.allSettled(
      boards.map((b) => FETCHERS[b.ats](b.slug, tokens)),
    );
    // Share the cap across companies so one big board can't crowd out the rest.
    const perBoard = Math.max(1, Math.ceil(MAX_JOBS / Math.max(1, boards.length)));
    const jobs: RawJob[] = [];
    for (const r of results) {
      // One company failing never blocks the others.
      if (r.status === "fulfilled") jobs.push(...r.value.slice(0, perBoard));
    }
    return jobs;
  },
};
