"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Download,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  createTargetAction,
  tailorResumeAction,
  generateCoverLetterAction,
  type TailorActionResult,
  type CoverLetterActionResult,
} from "@/app/actions/resume";
import type { ScreeningScore } from "@/lib/resume/screening-score";
import type { RecruiterSummary } from "@/lib/resume/recruiter-summary";
import { RecruiterSkimView } from "@/components/resume/recruiter-skim-view";
import {
  validateCoverLetterStandards,
  type CoverLetterStandardsReport,
} from "@/lib/coverletter/standards";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";

export interface TargetItem {
  id: string;
  title: string;
  company: string;
}

export interface TargetWithVersions extends TargetItem {
  latestResume?: {
    createdAt: string;
    provenanceOk: boolean;
    html: string;
    skimHtml: string;
    screening: ScreeningScore;
    recruiterSummary?: RecruiterSummary;
    violations: TailorActionResult["violations"];
  };
  latestCover?: {
    createdAt: string;
    provenanceOk: boolean;
    body: string;
    wordCount: number;
  };
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - Date.parse(iso);
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

function resumeFromTarget(
  t: TargetWithVersions | undefined,
): TailorActionResult | null {
  if (!t?.latestResume?.html) return null;
  return {
    resumeVersionId: "",
    html: t.latestResume.html,
    skimHtml: t.latestResume.skimHtml || t.latestResume.html,
    exportable: t.latestResume.provenanceOk,
    violations: t.latestResume.violations,
    screening: t.latestResume.screening,
    recruiterSummary:
      t.latestResume.recruiterSummary ??
      ({
        fitLine: `${t.title} @ ${t.company}`,
        proofLine: "Tailor resume to generate proof line.",
        signalLine: "Pending tailor",
        threeLines: "",
        interviewLikelihood: "weak",
      } satisfies RecruiterSummary),
  };
}

function coverFromTarget(
  t: TargetWithVersions | undefined,
): CoverLetterActionResult | null {
  if (!t?.latestCover) return null;
  const standards = validateCoverLetterStandards({
    body: t.latestCover.body,
    company: t.company,
    jobTitle: t.title,
    wordCount: t.latestCover.wordCount,
    provenanceOk: t.latestCover.provenanceOk,
  });
  return {
    coverLetterId: "",
    body: t.latestCover.body,
    wordCount: t.latestCover.wordCount,
    provenanceOk: t.latestCover.provenanceOk,
    violations: [],
    genericnessFlag: standards.checks.some(
      (c) => c.id === "not_generic" && !c.passed,
    ),
    standards,
  };
}

function StandardsChecklist({ report }: { report: CoverLetterStandardsReport }) {
  return (
    <div className="mb-3 rounded-lg border border-border bg-muted/30 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Standards checklist
      </p>
      <ul className="space-y-1.5">
        {report.checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-sm">
            {c.passed ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
            ) : c.severity === "fail" ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span>
              <span className={c.passed ? "text-foreground" : "text-muted-foreground"}>
                {c.label}
              </span>
              {!c.passed && c.hint && (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {c.hint}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

export function ResumeWorkspace({
  targets,
  initialCompany,
  initialTitle,
}: {
  targets: TargetWithVersions[];
  initialCompany?: string;
  initialTitle?: string;
}) {
  const router = useRouter();

  const matchFromParams = useMemo(() => {
    if (!initialCompany && !initialTitle) return targets[0]?.id ?? null;
    const norm = (s: string) => s.toLowerCase().trim();
    const match = targets.find(
      (t) =>
        (!initialCompany || norm(t.company) === norm(initialCompany)) &&
        (!initialTitle || norm(t.title) === norm(initialTitle)),
    );
    return match?.id ?? targets[0]?.id ?? null;
  }, [targets, initialCompany, initialTitle]);

  const [selectedId, setSelectedId] = useState<string | null>(matchFromParams);
  const [showForm, setShowForm] = useState(targets.length === 0);
  const [manualOverride, setManualOverride] = useState(false);

  const selected = useMemo(
    () => targets.find((t) => t.id === selectedId),
    [targets, selectedId],
  );

  const [title, setTitle] = useState(initialTitle ?? "");
  const [company, setCompany] = useState(initialCompany ?? "");
  const [jd, setJd] = useState("");
  const [url, setUrl] = useState("");
  const [creating, startCreate] = useTransition();

  useEffect(() => {
    if (!initialCompany && !initialTitle) return;
    const norm = (s: string) => s.toLowerCase().trim();
    const hasMatch = targets.some(
      (t) =>
        (!initialCompany || norm(t.company) === norm(initialCompany)) &&
        (!initialTitle || norm(t.title) === norm(initialTitle)),
    );
    if (!hasMatch) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync form from URL/deep-link props
      setShowForm(true);
      if (initialTitle) setTitle(initialTitle);
      if (initialCompany) setCompany(initialCompany);
    }
  }, [initialCompany, initialTitle, targets]);

  const [tailor, setTailor] = useState<TailorActionResult | null>(() =>
    resumeFromTarget(targets[0]),
  );
  const [recruiterSummary, setRecruiterSummary] = useState<
    RecruiterSummary | undefined
  >(targets[0]?.latestResume?.recruiterSummary);
  const [cover, setCover] = useState<CoverLetterActionResult | null>(() =>
    coverFromTarget(targets[0]),
  );
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (manualOverride) return;
    const r = resumeFromTarget(selected);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derive tailor state when selection changes
    setTailor(r);
    setRecruiterSummary(r?.recruiterSummary ?? selected?.latestResume?.recruiterSummary);
    setCover(coverFromTarget(selected));
  }, [selected, manualOverride]);

  function create() {
    setError(null);
    startCreate(async () => {
      try {
        const id = await createTargetAction({
          title,
          company,
          jobDescription: jd,
          sourceUrl: url || undefined,
        });
        setTitle("");
        setCompany("");
        setJd("");
        setUrl("");
        setShowForm(false);
        setSelectedId(id);
        setManualOverride(false);
        setTailor(null);
        setCover(null);
        router.refresh();
      } catch (e) {
        setError(msg(e));
      }
    });
  }

  function runTailor() {
    if (!selectedId) return;
    setError(null);
    setManualOverride(true);
    startBusy(async () => {
      try {
        const result = await tailorResumeAction(selectedId);
        setTailor(result);
        setRecruiterSummary(result.recruiterSummary);
      } catch (e) {
        setError(msg(e));
      }
    });
  }

  function runCover() {
    if (!selectedId) return;
    setError(null);
    setManualOverride(true);
    startBusy(async () => {
      try {
        setCover(await generateCoverLetterAction(selectedId));
      } catch (e) {
        setError(msg(e));
      }
    });
  }

  function download() {
    if (!tailor) return;
    const blob = new Blob([tailor.html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "resume.html";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const canCreate =
    title.trim() && company.trim() && jd.trim().length > 30 && !creating;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      {/* Targets column */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Target roles
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowForm((s) => !s)}
          >
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {showForm && (
          <div className="mb-3 space-y-2 rounded-lg border border-border bg-card p-3">
            <div>
              <Label htmlFor="t-title">Job title</Label>
              <Input
                id="t-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Senior Backend Engineer"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="t-company">Company</Label>
              <Input
                id="t-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Inc"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="t-jd">Job description</Label>
              <Textarea
                id="t-jd"
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                rows={6}
                placeholder="Paste the job description…"
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="t-url">Source URL (optional)</Label>
              <Input
                id="t-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className="mt-1"
              />
            </div>
            <Button onClick={create} disabled={!canCreate} className="w-full">
              {creating ? <Loader2 className="animate-spin" /> : "Create target"}
            </Button>
          </div>
        )}

        <div className="space-y-1.5">
          {targets.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setSelectedId(t.id);
                setManualOverride(false);
                setError(null);
              }}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                selectedId === t.id
                  ? "border-accent/40 bg-muted"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              <div className="font-medium">{t.title}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" />
                {t.company}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Workspace column */}
      <div>
        {!selectedId ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
            Add a target role to tailor a truthful, one-page resume and cover
            letter for it.
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <Button onClick={runTailor} disabled={busy} variant="accent">
                {busy ? <Loader2 className="animate-spin" /> : null}
                Tailor resume
              </Button>
              <Button onClick={runCover} disabled={busy} variant="outline">
                Generate cover letter
              </Button>
            </div>

            {error && (
              <p className="mb-4 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
                {error}
              </p>
            )}

            {(tailor || cover) && (
              <Tabs
                defaultValue={
                  tailor
                    ? initialCompany || initialTitle
                      ? "skim"
                      : "preview"
                    : "cover"
                }
              >
                <TabsList>
                  {tailor && <TabsTrigger value="preview">Resume</TabsTrigger>}
                  {tailor && (
                    <TabsTrigger value="skim">Recruiter skim</TabsTrigger>
                  )}
                  {tailor && (
                    <TabsTrigger value="provenance">
                      Provenance
                    </TabsTrigger>
                  )}
                  {cover && <TabsTrigger value="cover">Cover letter</TabsTrigger>}
                </TabsList>

                {tailor && (
                  <TabsContent value="preview">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {tailor.exportable ? (
                          <Badge variant="success">
                            <ShieldCheck className="mr-1 h-3 w-3" /> Every claim
                            verified
                          </Badge>
                        ) : (
                          <Badge variant="warning">
                            <ShieldAlert className="mr-1 h-3 w-3" /> Export blocked -
                            see Provenance
                          </Badge>
                        )}
                        <Badge variant="muted">
                          ATS {tailor.screening.keywordMatchPercent}%
                        </Badge>
                        <Badge
                          variant={
                            tailor.screening.passesSkim ? "success" : "warning"
                          }
                        >
                          Skim {tailor.screening.skim.score}/100
                        </Badge>
                        {!manualOverride && selected?.latestResume && (
                          <span className="text-xs text-muted-foreground">
                            Auto-generated ·{" "}
                            {formatRelative(selected.latestResume.createdAt)}
                          </span>
                        )}
                      </div>
                      <Button size="sm" variant="outline" onClick={download}>
                        <Download className="h-4 w-4" /> Download HTML
                      </Button>
                    </div>
                    <iframe
                      title="Resume preview"
                      srcDoc={tailor.html}
                      className="h-[840px] w-full rounded-lg border border-border bg-card"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Print this page to PDF (⌘/Ctrl-P → Save as PDF) for a clean,
                      ATS-safe file. Native PDF export arrives with the apply
                      engine.
                    </p>
                  </TabsContent>
                )}

                {tailor && recruiterSummary && (
                  <TabsContent value="skim">
                    <RecruiterSkimView
                      skimHtml={tailor.skimHtml}
                      screening={tailor.screening}
                      summary={recruiterSummary}
                    />
                  </TabsContent>
                )}

                {tailor && (
                  <TabsContent value="provenance">
                    {tailor.exportable ? (
                      <div className="rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/10 p-4 text-sm">
                        <p className="flex items-center gap-2 font-medium">
                          <ShieldCheck className="h-4 w-4 text-[var(--success)]" />
                          Every claim traces to your master profile.
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          No invented employers, skills, or metrics. Safe to send.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Export is blocked until these are resolved - the
                          generator referenced something not in your profile:
                        </p>
                        {tailor.violations.map((v, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                          >
                            <Badge
                              variant={
                                v.severity === "block" ? "warning" : "muted"
                              }
                            >
                              {v.severity}
                            </Badge>
                            <span className="ml-2 font-mono text-xs text-muted-foreground">
                              {v.location}
                            </span>
                            <p className="mt-1">{v.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                )}

                {cover && (
                  <TabsContent value="cover">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="muted">{cover.wordCount} words</Badge>
                      {cover.provenanceOk ? (
                        <Badge variant="success">
                          <ShieldCheck className="mr-1 h-3 w-3" /> Grounded
                        </Badge>
                      ) : (
                        <Badge variant="warning">
                          <ShieldAlert className="mr-1 h-3 w-3" /> Unverified
                          claims
                        </Badge>
                      )}
                      {cover.standards.allCriticalPass ? (
                        <Badge variant="success">Meets standards</Badge>
                      ) : (
                        <Badge variant="warning">Standards gaps</Badge>
                      )}
                      {cover.genericnessFlag && (
                        <Badge variant="warning">Reads generic</Badge>
                      )}
                      <Badge variant="outline">Human edit required</Badge>
                      {!manualOverride && selected?.latestCover && (
                        <span className="text-xs text-muted-foreground">
                          Auto-generated ·{" "}
                          {formatRelative(selected.latestCover.createdAt)}
                        </span>
                      )}
                    </div>
                    <StandardsChecklist report={cover.standards} />
                    <div className="whitespace-pre-wrap rounded-lg border border-border bg-card p-4 text-sm leading-relaxed">
                      {cover.body}
                    </div>
                    {cover.violations.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {cover.violations.map((v, i) => (
                          <li key={i}>• {v}</li>
                        ))}
                      </ul>
                    )}
                  </TabsContent>
                )}
              </Tabs>
            )}
          </>
        )}
      </div>
    </div>
  );
}
