"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Network,
  Loader2,
  Search,
  Star,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  auditProfileTextAction,
  auditProfileAction,
} from "@/app/actions/linkedin";
import type { AuditResult, AuditFinding, LinkedInProfileInput } from "@/lib/linkedin/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

function tierColor(tier: string): string {
  switch (tier) {
    case "All-Star":   return "text-[var(--success)]";
    case "Advanced":   return "text-accent";
    case "Intermediate": return "text-[var(--warning)]";
    default:           return "text-[var(--danger)]";
  }
}

function scoreBarColor(score: number): string {
  if (score >= 85) return "bg-[var(--success)]";
  if (score >= 65) return "bg-accent";
  if (score >= 40) return "bg-[var(--warning)]";
  return "bg-[var(--danger)]";
}

function severityIcon(severity: AuditFinding["severity"]) {
  switch (severity) {
    case "high":
      return <AlertCircle className="h-4 w-4 shrink-0 text-[var(--danger)]" />;
    case "medium":
      return <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--warning)]" />;
    case "low":
      return <Info className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
}

function severityBadgeVariant(severity: AuditFinding["severity"]): "danger" | "warning" | "muted" {
  switch (severity) {
    case "high":   return "danger";
    case "medium": return "warning";
    case "low":    return "muted";
  }
}

// ---------------------------------------------------------------------------
// Structured form defaults
// ---------------------------------------------------------------------------

const EMPTY_INPUT: LinkedInProfileInput = {
  headline: "",
  about: "",
  hasPhoto: false,
  hasCustomUrl: false,
  skillsCount: 0,
  connections: 0,
  experienceCount: 0,
  hasOpenToWork: false,
  featuredCount: 0,
  recommendationsCount: 0,
};

// ---------------------------------------------------------------------------
// Audit result display
// ---------------------------------------------------------------------------

function FindingCard({ finding }: { finding: AuditFinding }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-start gap-3 text-left"
      >
        {severityIcon(finding.severity)}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{finding.area}</span>
            <Badge variant={severityBadgeVariant(finding.severity)} className="text-[10px]">
              {finding.severity}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{finding.issue}</p>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="mt-3 ml-7 rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Fix
          </p>
          <p className="mt-1 text-sm leading-relaxed">{finding.suggestion}</p>
        </div>
      )}
    </div>
  );
}

function AuditResultPanel({ result }: { result: AuditResult }) {
  const highFindings   = result.findings.filter((f) => f.severity === "high");
  const medFindings    = result.findings.filter((f) => f.severity === "medium");
  const lowFindings    = result.findings.filter((f) => f.severity === "low");

  return (
    <div className="space-y-6">
      {/* Score card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className={cn("text-4xl font-bold tabular-nums", tierColor(result.tier))}>
                {result.score}
              </span>
              <span className="text-2xl text-muted-foreground">/100</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              {result.tier === "All-Star" ? (
                <Trophy className="h-4 w-4 text-[var(--success)]" />
              ) : (
                <Star className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={cn("text-sm font-semibold", tierColor(result.tier))}>
                {result.tier}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
            <span>{result.findings.length} gaps found</span>
            <span>{result.strengths.length} criteria met</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all duration-500", scoreBarColor(result.score))}
            style={{ width: `${result.score}%` }}
          />
        </div>

        {/* Tier legend */}
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>Beginner (&lt;40)</span>
          <span>Intermediate (40–64)</span>
          <span>Advanced (65–84)</span>
          <span>All-Star (85+)</span>
        </div>
      </div>

      {/* Findings */}
      {result.findings.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-medium">Gaps to fix</h2>

          {highFindings.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--danger)]">
                High priority - fix these first
              </p>
              {highFindings.map((f, i) => (
                <FindingCard key={i} finding={f} />
              ))}
            </div>
          )}

          {medFindings.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--warning)]">
                Medium priority
              </p>
              {medFindings.map((f, i) => (
                <FindingCard key={i} finding={f} />
              ))}
            </div>
          )}

          {lowFindings.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Nice to have
              </p>
              {lowFindings.map((f, i) => (
                <FindingCard key={i} finding={f} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Strengths */}
      {result.strengths.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 font-medium">What&apos;s already strong</h2>
          <ul className="space-y-2">
            {result.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
                <span className="text-muted-foreground">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.findings.length === 0 && (
        <div className="rounded-xl border border-[var(--success)]/30 bg-[var(--success)]/10 p-5 text-center">
          <Trophy className="mx-auto h-8 w-8 text-[var(--success)]" />
          <p className="mt-2 font-semibold text-[var(--success)]">All-Star profile!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your profile meets every All-Star criterion. Keep it up to date as your
            career evolves and keep collecting recommendations.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LinkedInOptimizer({ seedText }: { seedText: string }) {
  // Paste-tab state
  const [pasteText, setPasteText] = useState(seedText);

  // Structured-form state
  const [form, setForm] = useState<LinkedInProfileInput>({ ...EMPTY_INPUT });

  // Shared result
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setField<K extends keyof LinkedInProfileInput>(
    key: K,
    value: LinkedInProfileInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function runPasteAudit() {
    setError(null);
    startTransition(async () => {
      try {
        setResult(await auditProfileTextAction(pasteText));
      } catch (e) {
        setError(msg(e));
      }
    });
  }

  function runFormAudit() {
    setError(null);
    startTransition(async () => {
      try {
        setResult(await auditProfileAction(form));
      } catch (e) {
        setError(msg(e));
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Input panel */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Network className="h-5 w-5 text-[#0A66C2]" />
          <h2 className="font-medium">Audit your profile</h2>
        </div>

        <Tabs defaultValue="paste">
          <TabsList className="mb-4">
            <TabsTrigger value="paste">Paste profile text</TabsTrigger>
            <TabsTrigger value="form">Fill in fields</TabsTrigger>
          </TabsList>

          {/* ---- Paste tab ---- */}
          <TabsContent value="paste">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Open your LinkedIn profile, select all the text (Ctrl+A / ⌘+A),
                copy, and paste it here. The parser extracts what it can; you can
                switch to the <strong>Fill in fields</strong> tab to correct any
                misreads.
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={10}
                placeholder="Paste your LinkedIn profile text here…"
                className="w-full resize-y rounded-lg border border-border bg-background p-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                onClick={runPasteAudit}
                disabled={pending || pasteText.trim().length < 20}
                variant="accent"
              >
                {pending ? (
                  <>
                    <Loader2 className="animate-spin" /> Auditing…
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" /> Audit my profile
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* ---- Structured form tab ---- */}
          <TabsContent value="form">
            <div className="space-y-4">
              <div>
                <Label htmlFor="f-headline">Headline</Label>
                <Input
                  id="f-headline"
                  value={form.headline}
                  onChange={(e) => setField("headline", e.target.value)}
                  placeholder="e.g. Senior Backend Engineer | TypeScript, Go | Ex-Stripe | Open to EM roles"
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Paste your current headline exactly (LinkedIn shows ~220 chars).
                </p>
              </div>

              <div>
                <Label htmlFor="f-about">About / Summary</Label>
                <textarea
                  id="f-about"
                  value={form.about}
                  onChange={(e) => setField("about", e.target.value)}
                  rows={4}
                  placeholder="Paste your About section text…"
                  className="mt-1 w-full resize-y rounded-lg border border-border bg-card p-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="f-skills">Skills count</Label>
                  <Input
                    id="f-skills"
                    type="number"
                    min={0}
                    max={50}
                    value={form.skillsCount}
                    onChange={(e) =>
                      setField("skillsCount", Math.max(0, parseInt(e.target.value, 10) || 0))
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="f-connections">Connections</Label>
                  <Input
                    id="f-connections"
                    type="number"
                    min={0}
                    placeholder="e.g. 500"
                    value={form.connections || ""}
                    onChange={(e) =>
                      setField("connections", Math.max(0, parseInt(e.target.value, 10) || 0))
                    }
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Enter 500 for 500+</p>
                </div>
                <div>
                  <Label htmlFor="f-exp">Experience entries</Label>
                  <Input
                    id="f-exp"
                    type="number"
                    min={0}
                    value={form.experienceCount}
                    onChange={(e) =>
                      setField("experienceCount", Math.max(0, parseInt(e.target.value, 10) || 0))
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="f-featured">Featured items</Label>
                  <Input
                    id="f-featured"
                    type="number"
                    min={0}
                    value={form.featuredCount ?? 0}
                    onChange={(e) =>
                      setField("featuredCount", Math.max(0, parseInt(e.target.value, 10) || 0))
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="f-recs">Recommendations</Label>
                  <Input
                    id="f-recs"
                    type="number"
                    min={0}
                    value={form.recommendationsCount ?? 0}
                    onChange={(e) =>
                      setField("recommendationsCount", Math.max(0, parseInt(e.target.value, 10) || 0))
                    }
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.hasPhoto}
                    onChange={(e) => setField("hasPhoto", e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-accent"
                  />
                  Profile photo set
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.hasCustomUrl}
                    onChange={(e) => setField("hasCustomUrl", e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-accent"
                  />
                  Custom vanity URL
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.hasOpenToWork ?? false}
                    onChange={(e) => setField("hasOpenToWork", e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-accent"
                  />
                  #OpenToWork active
                </label>
              </div>

              <Button
                onClick={runFormAudit}
                variant="accent"
                disabled={pending}
              >
                {pending ? (
                  <>
                    <Loader2 className="animate-spin" /> Auditing…
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" /> Audit my profile
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
        )}
      </div>

      {/* Results */}
      {result && <AuditResultPanel result={result} />}
    </div>
  );
}
