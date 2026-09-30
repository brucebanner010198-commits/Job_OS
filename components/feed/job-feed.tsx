"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Sparkles,
  Bot,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Search,
  Layers,
  List,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessagesSquare,
  Building2,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { OneClickApplyModal, type EvaluatedJob } from "./one-click-apply-modal";
import { SkillGapHeatmap, type SkillGapItem } from "./skill-gap-heatmap";

export function JobFeed({
  initialJobs,
  initialSkillGaps = [],
}: {
  initialJobs: EvaluatedJob[];
  initialSkillGaps?: SkillGapItem[];
}) {
  const [jobs, setJobs] = useState<EvaluatedJob[]>(initialJobs);
  const [viewMode, setViewMode] = useState<"TINDER" | "STREAM">("STREAM");
  const [currentDeckIndex, setCurrentDeckIndex] = useState(0);
  const [activeJobForModal, setActiveJobForModal] = useState<EvaluatedJob | null>(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);

  // New URL evaluation state
  const [urlInput, setUrlInput] = useState("");
  const [isEvaluating, startEvaluating] = useTransition();
  const [evalError, setEvalError] = useState<string | null>(null);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState("");
  const [scoreFilter, setScoreFilter] = useState<"ALL" | "TOP" | "SOLID" | "STRETCH">("ALL");

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      !searchQuery ||
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.pros.some((p) => p.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesScore =
      scoreFilter === "ALL"
        ? true
        : scoreFilter === "TOP"
          ? job.fitScore >= 80
          : scoreFilter === "SOLID"
            ? job.fitScore >= 60 && job.fitScore < 80
            : job.fitScore < 60;

    return matchesSearch && matchesScore;
  });

  const handleEvaluateUrl = () => {
    if (!urlInput.trim()) return;
    setEvalError(null);

    startEvaluating(async () => {
      try {
        const res = await fetch("/api/pipeline/evaluate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: urlInput.trim() }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "Evaluation failed");
        }

        const newJob: EvaluatedJob = {
          id: data.posting.id,
          url: data.posting.url,
          title: data.posting.title,
          company: data.posting.company,
          location: data.posting.location,
          description: data.posting.description,
          fitScore: data.evaluation.fitScore,
          pros: data.evaluation.pros || [],
          cons: data.evaluation.cons || [],
          missingKeywords: data.evaluation.missingKeywords || [],
        };

        // Insert sorted by fitScore descending
        setJobs((prev) => [newJob, ...prev].sort((a, b) => b.fitScore - a.fitScore));
        setUrlInput("");
        setCurrentDeckIndex(0);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to evaluate job URL";
        setEvalError(message);
      }
    });
  };

  const handleOpenApply = (job: EvaluatedJob) => {
    setActiveJobForModal(job);
    setIsApplyModalOpen(true);
  };

  const currentCard = filteredJobs[currentDeckIndex];

  return (
    <div className="space-y-8">
      {/* Top Banner: Evaluate URL Input */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-accent/5 via-card to-card p-6 shadow-sm">
        <div className="max-w-2xl space-y-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-foreground text-xs font-bold">
              JEV
            </span>
            <h2 className="text-base font-semibold text-foreground">
              Autonomous Job Fit Evaluator & Scraper
            </h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Paste any job posting URL (Greenhouse, Lever, LinkedIn, Ashby). JEV extracts the job description, audits against your master profile, calculates an honest fit score, and generates your pros, cons, and missing ATS keywords.
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://boards.greenhouse.io/company/jobs/12345"
              className="h-10 text-xs font-mono"
              onKeyDown={(e) => e.key === "Enter" && handleEvaluateUrl()}
            />
            <Button
              onClick={handleEvaluateUrl}
              disabled={isEvaluating || !urlInput.trim()}
              className="h-10 shrink-0 gap-2 text-xs"
            >
              {isEvaluating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Evaluating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Evaluate with JEV</span>
                </>
              )}
            </Button>
          </div>

          {evalError && (
            <p className="text-xs font-medium text-rose-500 mt-2">{evalError}</p>
          )}
        </div>
      </div>

      {/* Control Bar: Mode Toggle + Filter Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search company, title, skill..."
              className="h-9 pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border p-1 bg-muted/20">
            {(["ALL", "TOP", "SOLID", "STRETCH"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setScoreFilter(filter)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  scoreFilter === filter
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {filter === "ALL"
                  ? "All"
                  : filter === "TOP"
                    ? "Top (80%+)"
                    : filter === "SOLID"
                      ? "Solid (60-79%)"
                      : "Stretch (<60%)"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border p-1 bg-muted/20">
          <button
            type="button"
            onClick={() => setViewMode("STREAM")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "STREAM"
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            <span>Ranked Stream</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("TINDER")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "TINDER"
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Card Deck</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: TINDER-STYLE CARD DECK */}
      {viewMode === "TINDER" && (
        <div className="mx-auto max-w-xl">
          {filteredJobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center text-xs text-muted-foreground">
              No evaluated jobs found matching your filters.
            </div>
          ) : currentCard ? (
            <div className="space-y-4">
              <div className="relative rounded-2xl border border-border bg-card p-6 shadow-xl transition-all">
                {/* Score Header */}
                <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{currentCard.title}</h3>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Building2 className="h-3.5 w-3.5" /> {currentCard.company}
                      </span>
                      {currentCard.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {currentCard.location}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-black shadow-sm ${
                        currentCard.fitScore >= 80
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : currentCard.fitScore >= 60
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {currentCard.fitScore}
                    </div>
                    <span className="mt-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                      Fit Score
                    </span>
                  </div>
                </div>

                {/* Pros and Cons at a Glance */}
                <div className="mt-5 space-y-4">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Why This Fits Your Master Profile ({currentCard.pros.length})</span>
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {currentCard.pros.map((pro, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span>{pro}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Identified Gaps ({currentCard.cons.length})</span>
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {currentCard.cons.map((con, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                          <span>{con}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {currentCard.missingKeywords.length > 0 && (
                    <div className="border-t border-border pt-4">
                      <div className="text-[11px] font-medium text-muted-foreground mb-1.5">
                        Required ATS Keywords:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {currentCard.missingKeywords.map((kw, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentDeckIndex((idx) => Math.max(0, idx - 1))}
                      disabled={currentDeckIndex === 0}
                      className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {currentDeckIndex + 1} of {filteredJobs.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentDeckIndex((idx) => Math.min(filteredJobs.length - 1, idx + 1))}
                      disabled={currentDeckIndex === filteredJobs.length - 1}
                      className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/interview`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      <MessagesSquare className="h-3.5 w-3.5" />
                      <span>Prep Hub</span>
                    </Link>

                    <Button
                      size="sm"
                      onClick={() => handleOpenApply(currentCard)}
                      className="gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Bot className="h-3.5 w-3.5" />
                      <span>One-Click Apply</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* VIEW 2: RANKED FEED STREAM */}
      {viewMode === "STREAM" && (
        <div className="space-y-4">
          {filteredJobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center text-xs text-muted-foreground">
              No jobs found. Paste a job URL above to have JEV scrape and evaluate it!
            </div>
          ) : (
            filteredJobs.map((job) => (
              <div
                key={job.id}
                className="group relative rounded-xl border border-border bg-card p-5 transition-all hover:border-accent/40 hover:shadow-md"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* Left: Info */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-base font-semibold text-foreground group-hover:text-accent transition-colors">
                          {job.title}
                        </h3>
                        <Badge
                          variant="outline"
                          className={`text-xs font-bold ${
                            job.fitScore >= 80
                              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5"
                              : job.fitScore >= 60
                                ? "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/5"
                                : "border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-500/5"
                          }`}
                        >
                          {job.fitScore}/100 Fit
                        </Badge>
                      </div>

                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{job.company}</span>
                        {job.location && <span>• {job.location}</span>}
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:underline"
                        >
                          Source <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    </div>

                    {/* Pros and Cons Chips */}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                        <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mb-1">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Pros</span>
                        </div>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {job.pros.slice(0, 2).map((p, i) => (
                            <li key={i} className="line-clamp-1">
                              + {p}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-2.5">
                        <div className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1 mb-1">
                          <AlertTriangle className="h-3 w-3" />
                          <span>Gaps</span>
                        </div>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {job.cons.slice(0, 2).map((c, i) => (
                            <li key={i} className="line-clamp-1">
                              - {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                    <Button
                      size="sm"
                      onClick={() => handleOpenApply(job)}
                      className="gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
                    >
                      <Bot className="h-3.5 w-3.5" />
                      <span>One-Click Apply</span>
                    </Button>

                    <Link
                      href={`/interview`}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground w-full sm:w-auto"
                    >
                      <MessagesSquare className="h-3 w-3" />
                      <span>Prep Hub</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Bottom Section: Continuous Upskilling & Skill Gap Heatmap */}
      <div className="pt-6">
        <SkillGapHeatmap initialGaps={initialSkillGaps} />
      </div>

      {/* Multi-Agent One-Click Apply Modal */}
      <OneClickApplyModal
        job={activeJobForModal}
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
      />
    </div>
  );
}
