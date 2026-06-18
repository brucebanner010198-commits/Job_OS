"use client";

import { useState, useTransition } from "react";
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Loader2,
  Quote,
  Info,
  Globe,
  BookOpen,
  Newspaper,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CitedSourcesBadge } from "@/components/brief/cited-sources-badge";
import { HrContactsPanel } from "@/components/brief/hr-contacts-panel";
import {
  generateBriefAction,
  type SerializedBriefData,
  type SerializedClaim,
} from "@/app/actions/brief";
import type { ClaimStatus, FactCategory, SourceKind } from "@/lib/brief/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BriefedCompany {
  name: string;
  domain: string | null;
  generatedAt: string;
}

interface Props {
  briefedCompanies: BriefedCompany[];
  fixtureSuggestions: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  ClaimStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  verified: {
    label: "Verified",
    icon: <CheckCircle2 className="h-3 w-3" />,
    className:
      "border-transparent bg-[var(--success)]/12 text-[var(--success)] flex items-center gap-1",
  },
  corroborated: {
    label: "Corroborated",
    icon: <AlertTriangle className="h-3 w-3" />,
    className:
      "border-transparent bg-[var(--warning)]/12 text-[var(--warning)] flex items-center gap-1",
  },
  stale: {
    label: "Out of date",
    icon: <Clock className="h-3 w-3" />,
    className:
      "border-transparent bg-[var(--danger,#ef4444)]/12 text-[var(--danger,#ef4444)] flex items-center gap-1",
  },
};

function StatusBadge({ status }: { status: ClaimStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        cfg.className,
      )}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Category badge
// ---------------------------------------------------------------------------

const CATEGORY_LABEL: Record<FactCategory, string> = {
  overview: "Overview",
  product: "Product",
  funding: "Funding",
  headcount: "Headcount",
  leadership: "Leadership",
  culture: "Culture",
  news: "News",
  other: "Other",
};

function CategoryBadge({ category }: { category: FactCategory }) {
  return <Badge variant="muted">{CATEGORY_LABEL[category]}</Badge>;
}

// ---------------------------------------------------------------------------
// Source kind badge + icon
// ---------------------------------------------------------------------------

const KIND_CONFIG: Record<
  SourceKind,
  { label: string; icon: React.ReactNode; note?: string }
> = {
  official: {
    label: "Official",
    icon: <Globe className="h-3 w-3" />,
  },
  news: {
    label: "News",
    icon: <Newspaper className="h-3 w-3" />,
  },
  crunchbase: {
    label: "Crunchbase",
    icon: <Building2 className="h-3 w-3" />,
  },
  wiki: {
    label: "Wiki",
    icon: <BookOpen className="h-3 w-3" />,
    note: "corroboration only",
  },
  other: {
    label: "Other",
    icon: <Info className="h-3 w-3" />,
    note: "corroboration only",
  },
};

function SourceKindBadge({ kind }: { kind: SourceKind }) {
  const cfg = KIND_CONFIG[kind];
  return (
    <Badge
      variant={kind === "wiki" || kind === "other" ? "outline" : "muted"}
      className="flex items-center gap-1"
    >
      {cfg.icon}
      {cfg.label}
      {cfg.note && (
        <span className="ml-0.5 text-muted-foreground">- {cfg.note}</span>
      )}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Single claim card
// ---------------------------------------------------------------------------

function ClaimCard({ claim }: { claim: SerializedClaim }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      {/* Header row */}
      <div className="mb-2 flex flex-wrap items-start gap-2">
        <StatusBadge status={claim.status} />
        <CategoryBadge category={claim.category} />
        {claim.secondSourceRequired && claim.status !== "verified" && (
          <Badge
            variant="outline"
            className="flex items-center gap-1 border-[var(--warning)]/40 text-[var(--warning)]"
          >
            <ShieldAlert className="h-3 w-3" />
            Needs 2nd source
          </Badge>
        )}
      </div>

      {/* Claim text */}
      <p className="mb-3 text-sm leading-relaxed">{claim.text}</p>

      {/* Sources */}
      <div className="space-y-2">
        {claim.sources.map((src, i) => (
          <div
            key={i}
            className="rounded-md border border-border bg-card p-3 text-xs"
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <SourceKindBadge kind={src.kind} />
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[24rem]">{src.title}</span>
              </a>
            </div>
            {/* Entailing snippet - the exact passage that supports the claim */}
            <blockquote className="flex gap-2 border-l-2 border-border pl-2.5 text-muted-foreground italic">
              <Quote className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/50" />
              <span>{src.snippet}</span>
            </blockquote>
          </div>
        ))}
      </div>

      {/* Retrieved at */}
      <p className="mt-2 text-right text-xs text-muted-foreground">
        Retrieved {formatDate(claim.retrievedAt)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Brief results view
// ---------------------------------------------------------------------------

function BriefResults({
  brief,
  company,
  careersPageUrl,
}: {
  brief: SerializedBriefData;
  company: string;
  careersPageUrl?: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <CitedSourcesBadge claims={brief.claims} />
      </div>

      <HrContactsPanel
        company={company}
        brief={brief}
        careersPageUrl={careersPageUrl}
      />
      {/* Summary */}
      {brief.summary && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Summary
          </h3>
          <p className="text-sm leading-relaxed">{brief.summary}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Generated {formatDate(brief.generatedAt)}
          </p>
        </div>
      )}

      {/* Claims */}
      {brief.claims.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Attributed claims ({brief.claims.length})
          </h3>
          <div className="space-y-3">
            {brief.claims.map((claim, i) => (
              <ClaimCard key={i} claim={claim} />
            ))}
          </div>
        </div>
      )}

      {brief.claims.length === 0 && brief.refused.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No sources were found for this company. Try a company with available
          data.
        </p>
      )}

      {/* Refused claims - transparency section */}
      {brief.refused.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <h3 className="text-sm font-semibold">
                Not shown - couldn&apos;t attribute
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                We only state what a source verifies. These couldn&apos;t be
                attributed, so we don&apos;t present them as fact.
              </p>
            </div>
          </div>
          <ul className="space-y-2">
            {brief.refused.map((r, i) => (
              <li
                key={i}
                className="rounded-md border border-border bg-background p-3 text-xs"
              >
                <p className="font-medium text-muted-foreground line-through">
                  {r.text}
                </p>
                <p className="mt-1 text-muted-foreground/70">{r.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main workspace
// ---------------------------------------------------------------------------

export function CompanyBriefWorkspace({
  briefedCompanies,
  fixtureSuggestions,
}: Props) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [brief, setBrief] = useState<SerializedBriefData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, startGenerate] = useTransition();

  function generate() {
    if (!name.trim()) return;
    setError(null);
    startGenerate(async () => {
      try {
        const result = await generateBriefAction(name.trim(), domain.trim() || undefined);
        setBrief(result);
      } catch (e) {
        setError(msg(e));
      }
    });
  }

  function pickSuggestion(companyName: string) {
    setName(companyName);
    setDomain("");
    setError(null);
    setBrief(null);
  }

  return (
    <div className="space-y-6">
      {/* Input panel */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-1 font-medium">Generate a company brief</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Enter a company name to create a brief where every claim is cited and checked against its source.
          Every claim is backed by a source that actually supports it.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div className="space-y-1">
            <Label htmlFor="company-name">Company name</Label>
            <Input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme AI"
              onKeyDown={(e) => {
                if (e.key === "Enter") generate();
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="company-domain">Domain (optional)</Label>
            <Input
              id="company-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="acmeai.com"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={generate}
              disabled={generating || !name.trim()}
              className="w-full sm:w-auto"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4" />
                  Generate brief
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Quick-pick chips - seeded from offline briefFixtures */}
        {fixtureSuggestions.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-muted-foreground">
              Try an example (works offline):
            </p>
            <div className="flex flex-wrap gap-2">
              {fixtureSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => pickSuggestion(suggestion)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    name === suggestion
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:border-accent/50 hover:text-foreground",
                  )}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-[var(--danger,#ef4444)]">{error}</p>
        )}
      </div>

      {/* Generated brief */}
      {brief && (
        <BriefResults
          brief={brief}
          company={name.trim() || brief.company}
          careersPageUrl={
            domain.trim()
              ? `https://${domain.trim().replace(/^https?:\/\//, "")}/careers`
              : undefined
          }
        />
      )}

      {/* Previously briefed companies */}
      {briefedCompanies.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 font-medium">Previously briefed</h2>
          <ul className="space-y-2">
            {briefedCompanies.map((co) => (
              <li
                key={co.name}
                className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium">{co.name}</span>
                  {co.domain && (
                    <span className="text-xs text-muted-foreground">
                      {co.domain}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(co.generatedAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => pickSuggestion(co.name)}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Re-generate
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
