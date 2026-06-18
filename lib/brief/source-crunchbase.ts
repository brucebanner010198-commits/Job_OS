/**
 * Crunchbase brief enrichment (Phase 15, plan §6 "+ optional Crunchbase"). An
 * optional source that contributes funding / headcount / overview facts behind
 * the SAME entailment + 2-source citation guard as every other source - it never
 * gets special treatment, and a single Crunchbase source for a volatile fact is
 * only ever "corroborated", never "verified".
 *
 * Key-gated like JSearch: with no CRUNCHBASE_API_KEY it returns [] and makes no
 * network call, so the brief is unchanged. The pure mapper (crunchbaseToSources)
 * is gate-tested; the fetch is server-only and never throws.
 */
import { type FetchedSource } from "@/lib/brief/types";

/** Minimal subset of a Crunchbase v4 organization we map into sources. */
export interface CrunchbaseOrg {
  name: string;
  permalink?: string;
  shortDescription?: string;
  /** Total funding in USD. */
  fundingTotalUsd?: number;
  /** e.g. "series_b", "seed". */
  lastFundingType?: string;
  /** e.g. "51-100", "1001-5000". */
  numEmployeesRange?: string;
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  return `$${n.toLocaleString("en-US")}`;
}

function humanizeRound(t: string): string {
  return t
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bSeries ([a-z])/i, (_, l) => `Series ${l.toUpperCase()}`);
}

/**
 * Map a Crunchbase org into attributable FetchedSource passages (kind
 * "crunchbase"). Each passage is phrased so it ENTAILS exactly the fact it
 * carries, with the crunchbase.com org page as the citation URL. PURE.
 */
export function crunchbaseToSources(
  org: CrunchbaseOrg,
  retrievedAt: Date,
): FetchedSource[] {
  const url = `https://www.crunchbase.com/organization/${org.permalink ?? slug(org.name)}`;
  const out: FetchedSource[] = [];

  if (org.shortDescription) {
    out.push({
      url,
      title: `${org.name} - Crunchbase`,
      kind: "crunchbase",
      text: `According to Crunchbase, ${org.name} is ${org.shortDescription}`,
      retrievedAt,
    });
  }
  if (typeof org.fundingTotalUsd === "number") {
    const round = org.lastFundingType
      ? `, most recently a ${humanizeRound(org.lastFundingType)} round`
      : "";
    out.push({
      url,
      title: `${org.name} funding - Crunchbase`,
      kind: "crunchbase",
      text: `According to Crunchbase, ${org.name} has raised a total of ${fmtUsd(org.fundingTotalUsd)} in funding${round}.`,
      retrievedAt,
    });
  }
  if (org.numEmployeesRange) {
    out.push({
      url,
      title: `${org.name} headcount - Crunchbase`,
      kind: "crunchbase",
      text: `Crunchbase lists ${org.name} as having an estimated ${org.numEmployeesRange} employees.`,
      retrievedAt,
    });
  }
  return out;
}

const CRUNCHBASE_ENTITY_ENDPOINT =
  "https://api.crunchbase.com/api/v4/entities/organizations";

/**
 * Fetch + map a company's Crunchbase org. Server-only. Disabled (→ []) when
 * CRUNCHBASE_API_KEY is absent; never throws into the brief pipeline.
 */
export async function fetchCrunchbaseSources(company: {
  name: string;
  domain?: string;
}): Promise<FetchedSource[]> {
  const key = process.env.CRUNCHBASE_API_KEY?.trim();
  if (!key) return [];
  const permalink = slug(company.name);
  try {
    const res = await fetch(
      `${CRUNCHBASE_ENTITY_ENDPOINT}/${encodeURIComponent(permalink)}` +
        `?user_key=${encodeURIComponent(key)}` +
        `&field_ids=identifier,short_description,funding_total,last_funding_type,num_employees_enum`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { properties?: Record<string, unknown> };
    const p = data.properties ?? {};
    const org: CrunchbaseOrg = {
      name: company.name,
      permalink,
      shortDescription:
        typeof p.short_description === "string" ? p.short_description : undefined,
      fundingTotalUsd:
        typeof p.funding_total === "object" &&
        p.funding_total !== null &&
        typeof (p.funding_total as { value_usd?: unknown }).value_usd === "number"
          ? ((p.funding_total as { value_usd: number }).value_usd)
          : undefined,
      lastFundingType:
        typeof p.last_funding_type === "string" ? p.last_funding_type : undefined,
      numEmployeesRange:
        typeof p.num_employees_enum === "string"
          ? p.num_employees_enum.replace(/^c_/, "").replace(/_/g, "-")
          : undefined,
    };
    return crunchbaseToSources(org, new Date());
  } catch {
    return [];
  }
}
