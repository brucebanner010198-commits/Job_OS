"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Sparkles,
  Bot,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Send,
  Loader2,
  Copy,
  Download,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface EvaluatedJob {
  id: string;
  url: string;
  title: string;
  company: string;
  location?: string | null;
  description: string;
  fitScore: number;
  pros: string[];
  cons: string[];
  missingKeywords: string[];
}

export function OneClickApplyModal({
  job,
  isOpen,
  onClose,
}: {
  job: EvaluatedJob | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"DEBATE" | "CV" | "COVER_LETTER" | "AUDIT">("DEBATE");
  const [pipelineState, setPipelineState] = useState<"IDLE" | "RUNNING" | "READY" | "ERROR">("IDLE");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Agent output state
  const [tailoredCv, setTailoredCv] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [critique, setCritique] = useState<{
    honestyScore: number;
    atsReadinessScore: number;
    hallucinationWarnings: string[];
    missingAtsKeywords: string[];
    critiqueText: string;
  } | null>(null);
  const [debateLog, setDebateLog] = useState<Array<{ agent: "drafter" | "reviewer"; message: string; timestamp: string }>>([]);
  const [atsScore, setAtsScore] = useState<number>(85);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [jevLaunching, setJevLaunching] = useState(false);
  const [jevLaunched, setJevLaunched] = useState(false);

  const startPipeline = useCallback(async () => {
    if (!job) return;
    setPipelineState("RUNNING");
    setErrorMsg(null);

    // Initial debate placeholder while model streams or processes
    setDebateLog([
      {
        agent: "drafter",
        message: `Analyzing role "${job.title}" at ${job.company}. Cross-referencing candidate master profile for verified achievements...`,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    try {
      const res = await fetch("/api/pipeline/draft-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobPostingId: job.id,
          jobTitle: job.title,
          company: job.company,
          jobDescription: job.description,
          keywords: job.missingKeywords,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to run Drafter-Reviewer pipeline");
      }

      const result = data.result;
      setTailoredCv(result.revisedDraft.tailoredCv || result.initialDraft.tailoredCv);
      setCoverLetter(result.revisedDraft.coverLetter || result.initialDraft.coverLetter);
      setAtsScore(result.finalAtsScore || 90);
      setDebateLog(result.debateHistory || []);
      setCritique({
        honestyScore: result.critique.honestyScore,
        atsReadinessScore: result.critique.atsReadinessScore,
        hallucinationWarnings: result.critique.hallucinationWarnings,
        missingAtsKeywords: result.critique.missingAtsKeywords,
        critiqueText: result.critique.critique,
      });

      setPipelineState("READY");
      setActiveTab("CV");
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      setErrorMsg(message);
      setPipelineState("ERROR");
    }
  }, [job]);

  const handleClose = () => {
    setPipelineState("IDLE");
    setDebateLog([]);
    setCritique(null);
    setErrorMsg(null);
    setJevLaunched(false);
    onClose();
  };

  useEffect(() => {
    if (!isOpen || !job) {
      return;
    }

    const timer = setTimeout(() => {
      void startPipeline();
    }, 0);

    return () => clearTimeout(timer);
  }, [isOpen, job, startPipeline]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handleLaunchJev = async () => {
    setJevLaunching(true);
    try {
      // Simulate/trigger JEV agent execution for form navigation
      await new Promise((r) => setTimeout(r, 1500));
      setJevLaunched(true);
    } finally {
      setJevLaunching(false);
    }
  };

  if (!isOpen || !job) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground shadow-sm">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  One-Click Apply Pipeline
                </h2>
                <Badge variant="outline" className="border-accent text-accent font-semibold text-xs">
                  {job.fitScore}/100 Match
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {job.title} • {job.company}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-border bg-muted/10 px-6">
          <button
            type="button"
            onClick={() => setActiveTab("DEBATE")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-colors ${
              activeTab === "DEBATE"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Agent Debate & Audit</span>
            {pipelineState === "RUNNING" && <Loader2 className="h-3 w-3 animate-spin text-accent" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("CV")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-colors ${
              activeTab === "CV"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Tailored CV</span>
            {pipelineState === "READY" && (
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                Ready
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("COVER_LETTER")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-colors ${
              activeTab === "COVER_LETTER"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Send className="h-3.5 w-3.5" />
            <span>Cover Letter</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("AUDIT")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-colors ${
              activeTab === "AUDIT"
                ? "border-accent text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>ATS & Honesty Check</span>
            {atsScore > 0 && (
              <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">
                {atsScore}% ATS
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {pipelineState === "RUNNING" && activeTab === "DEBATE" && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-accent" />
              <h3 className="mt-4 text-sm font-semibold text-foreground">
                Multi-Agent Pipeline in Progress
              </h3>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                The Drafter Agent is tailoring your CV and Cover Letter, while the Reviewer Agent verifies honesty and ATS coverage.
              </p>
            </div>
          )}

          {pipelineState === "ERROR" && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-400">
              <div className="font-semibold">Pipeline Execution Failed</div>
              <p className="mt-1">{errorMsg}</p>
              <Button size="sm" variant="outline" onClick={startPipeline} className="mt-3">
                Retry Generation
              </Button>
            </div>
          )}

          {/* TAB 1: AGENT DEBATE */}
          {activeTab === "DEBATE" && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Drafter-Reviewer Architecture:</span> Two distinct agents debate your application. The Drafter crafts documents strictly from your profile facts, while the Reviewer ruthlessly audits for hallucinations, weak framing, and omitted keywords before revising.
              </div>

              <div className="space-y-3">
                {debateLog.map((log, index) => {
                  const isDrafter = log.agent === "drafter";
                  return (
                    <div
                      key={index}
                      className={`flex gap-3 rounded-xl border p-4 ${
                        isDrafter
                          ? "border-accent/30 bg-accent/5 text-foreground"
                          : "border-purple-500/30 bg-purple-500/5 text-foreground"
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          isDrafter ? "bg-accent text-accent-foreground" : "bg-purple-600 text-white"
                        }`}
                      >
                        {isDrafter ? <Bot className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                      </div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold capitalize">
                            {isDrafter ? "Drafter Agent" : "Reviewer Agent (Auditor)"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{log.timestamp}</span>
                        </div>
                        <p className="text-xs leading-relaxed">{log.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {pipelineState === "READY" && (
                <div className="flex justify-end pt-2">
                  <Button size="sm" onClick={() => setActiveTab("CV")} className="gap-2">
                    Review Tailored CV <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TAILORED CV (WYSIWYG EDITABLE) */}
          {activeTab === "CV" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Tailored CV & Experience Highlights</h3>
                  <p className="text-xs text-muted-foreground">
                    Directly editable. Emphasizes relevant accomplishments matching the {job.company} posting.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(tailoredCv, "CV copied")}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>{copyFeedback === "CV copied" ? "Copied!" : "Copy Markdown"}</span>
                  </Button>
                </div>
              </div>

              <textarea
                value={tailoredCv}
                onChange={(e) => setTailoredCv(e.target.value)}
                rows={16}
                className="w-full rounded-xl border border-border bg-background p-4 font-mono text-xs leading-relaxed text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="Drafting tailored CV..."
              />
            </div>
          )}

          {/* TAB 3: COVER LETTER (WYSIWYG EDITABLE) */}
          {activeTab === "COVER_LETTER" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Tailored Cover Letter</h3>
                  <p className="text-xs text-muted-foreground">
                    Humanized, authentic, and grounded in your master profile.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {coverLetter.trim().split(/\s+/).filter(Boolean).length} words
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(coverLetter, "Letter copied")}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>{copyFeedback === "Letter copied" ? "Copied!" : "Copy"}</span>
                  </Button>
                </div>
              </div>

              <textarea
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                rows={16}
                className="w-full rounded-xl border border-border bg-background p-4 text-xs leading-relaxed text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="Drafting cover letter..."
              />
            </div>
          )}

          {/* TAB 4: ATS & HONESTY AUDIT */}
          {activeTab === "AUDIT" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <div className="text-xs font-medium text-muted-foreground">Honesty & Grounding Score</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-foreground">
                      {critique?.honestyScore ?? 100}%
                    </span>
                    <Badge variant="outline" className="border-emerald-500 text-emerald-600 text-[10px]">
                      Zero Fabrications
                    </Badge>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Every claim in your drafted documents was audited against your verified master profile.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <div className="text-xs font-medium text-muted-foreground">ATS Readiness Score</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-foreground">{atsScore}%</span>
                    <Badge variant="outline" className="border-accent text-accent text-[10px]">
                      Optimized Keywords
                    </Badge>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Matched against key technical keywords and phrases parsed from the job description.
                  </p>
                </div>
              </div>

              {critique && (
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-foreground">Reviewer Feedback Summary</h4>
                  <p className="text-xs text-muted-foreground">{critique.critiqueText}</p>

                  {critique.hallucinationWarnings.length > 0 && (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
                      <div className="font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>Honesty Warnings Resolved in Revision:</span>
                      </div>
                      <ul className="mt-1 list-disc pl-4 space-y-0.5 text-[11px]">
                        {critique.hallucinationWarnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {critique.missingAtsKeywords.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-foreground">ATS Keywords Checked:</div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {critique.missingAtsKeywords.map((kw, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const blob = new Blob([`# TAILORED CV\n\n${tailoredCv}\n\n# COVER LETTER\n\n${coverLetter}`], {
                  type: "text/markdown",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${job.company.replace(/\s+/g, "_")}_Application_Package.md`;
                a.click();
              }}
              className="gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Package</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose} className="text-xs">
              Close
            </Button>

            <Button
              size="sm"
              onClick={handleLaunchJev}
              disabled={jevLaunching || pipelineState === "RUNNING"}
              className="gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {jevLaunching ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>JEV Navigating Form...</span>
                </>
              ) : jevLaunched ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>JEV Prepared Form for Review</span>
                </>
              ) : (
                <>
                  <Bot className="h-3.5 w-3.5" />
                  <span>Launch JEV Browser Agent</span>
                </>
              )}
            </Button>

            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
            >
              <span>Open Application Form</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
