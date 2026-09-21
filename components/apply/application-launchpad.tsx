"use client";

import { useState, useTransition } from "react";
import {
  X,
  ExternalLink,
  Copy,
  Check,
  FileText,
  UserCheck,
  Building2,
  Sparkles,
  ClipboardList,
  CheckSquare,
  Square,
  Bot,
  Send,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { askCopilotAction, type CopilotAnswerResult } from "@/app/actions/apply-copilot";

export interface ApplicationLaunchpadProps {
  isOpen: boolean;
  onClose: () => void;
  jobTitle: string;
  company: string;
  jobUrl?: string | null;
  matchScore?: number;
  fresh?: boolean;
  coverLetterText?: string;
  resumeSummary?: string;
  topSkills?: string[];
  referralContact?: string | null;
  onMarkSubmitted?: () => void;
}

export function ApplicationLaunchpad({
  isOpen,
  onClose,
  jobTitle,
  company,
  jobUrl,
  matchScore,
  fresh,
  coverLetterText,
  resumeSummary,
  topSkills = [],
  referralContact,
  onMarkSubmitted,
}: ApplicationLaunchpadProps) {
  const [copiedCover, setCopiedCover] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copilotQuery, setCopilotQuery] = useState("");
  const [copilotSnippet, setCopilotSnippet] = useState<string | null>(null);
  const [copiedCopilot, setCopiedCopilot] = useState(false);
  const [isCopilotPending, startCopilotTransition] = useTransition();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [checklist, setChecklist] = useState({
    referralChecked: false,
    resumeTailored: false,
    coverLetterPasted: false,
    submitted: false,
  });

  if (!isOpen) return null;

  async function copyCover() {
    if (!coverLetterText) return;
    await navigator.clipboard.writeText(coverLetterText);
    setCopiedCover(true);
    setTimeout(() => setCopiedCover(false), 2000);
  }

  async function copySummary() {
    if (!resumeSummary) return;
    await navigator.clipboard.writeText(resumeSummary);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  }

  async function copyCopilotSnippet() {
    if (!copilotSnippet) return;
    await navigator.clipboard.writeText(copilotSnippet);
    setCopiedCopilot(true);
    setTimeout(() => setCopiedCopilot(false), 2000);
  }

  function handleQuickChip(promptText: string) {
    setCopilotQuery(promptText);
    runCopilotQuery(promptText);
  }

  function runCopilotQuery(queryText: string) {
    if (!queryText.trim()) return;
    startCopilotTransition(async () => {
      const res = await askCopilotAction({
        query: queryText,
        jobTitle,
        company,
      });
      setCopilotSnippet(res.extractedSnippet);
    });
  }

  function toggleCheck(key: keyof typeof checklist) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleMarkSubmitted() {
    setIsSubmitted(true);
    onMarkSubmitted?.();
  }

  const defaultCover =
    coverLetterText ||
    `Dear Hiring Team at ${company},\n\nI am writing to express my strong interest in the ${jobTitle} role. With a proven background in delivering scalable systems and technical leadership, I am excited about the opportunity to contribute to your team's mission.\n\nThank you for your consideration.\n\nSincerely,\nCandidate`;

  const defaultPitch =
    resumeSummary ||
    `Experienced engineer targeting ${jobTitle} at ${company}. Proven track record delivering resilient architecture, optimizing performance, and mentoring engineering teams.`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border p-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                🚀
              </span>
              <h2 className="text-lg font-semibold text-foreground">Application Copilot & Launchpad</h2>
              {fresh && (
                <Badge variant="success" className="text-[10px]">
                  &lt;72h Early Advantage
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-foreground">{jobTitle}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span>{company}</span>
              {matchScore !== undefined && (
                <>
                  <span>•</span>
                  <span>Match: {Math.round(matchScore * 100)}%</span>
                </>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close application launchpad"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5 text-sm">
          {/* Submission Completion Alert */}
          {isSubmitted && (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-xs uppercase tracking-wider">Application Complete!</div>
                <p className="text-xs">
                  Your application for {jobTitle} at {company} is now recorded as applied. The email integration will
                  automatically monitor for interview invitations, assessments, and status updates.
                </p>
              </div>
            </div>
          )}

          {/* Interactive Form Assistant Copilot */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-xs text-foreground uppercase tracking-wider">
                <Bot className="h-4 w-4 text-primary" />
                <span>Form Copilot (Ask & Fast Copy)</span>
              </div>
              <Badge variant="outline" className="text-[10px]">
                Master Resume Extractor
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Filling out an external portal? Ask for any information (e.g. education, specific experience, leadership highlights) and copy it with one click.
            </p>

            {/* Quick Chips */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Education qualification", q: "I need education qualification information" },
                { label: "Experience summary", q: "Summary of job experience" },
                { label: "Top technical skills", q: "List of top technical skills and tools" },
                { label: "Why this company", q: "Why I am interested in this role" },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => handleQuickChip(chip.q)}
                  className="rounded-md border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Custom Query Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runCopilotQuery(copilotQuery);
              }}
              className="flex gap-2"
            >
              <Input
                value={copilotQuery}
                onChange={(e) => setCopilotQuery(e.target.value)}
                placeholder="Ask e.g. 'I need education qualification'..."
                className="text-xs h-8"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isCopilotPending || !copilotQuery.trim()}
                className="h-8 gap-1 text-xs shrink-0"
              >
                {isCopilotPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Extract
              </Button>
            </form>

            {/* Copilot Snippet Result */}
            {copilotSnippet && (
              <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground">Extracted from Master Profile:</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={copyCopilotSnippet}
                    className="h-6 gap-1 text-[11px]"
                  >
                    {copiedCopilot ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copiedCopilot ? "Copied to clipboard" : "Copy to clipboard"}
                  </Button>
                </div>
                <p className="text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed bg-muted/20 p-2 rounded">
                  {copilotSnippet}
                </p>
              </div>
            )}
          </div>

          {/* Warm Path Referral Check */}
          <div className="rounded-xl border border-border bg-background/50 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 font-medium">
                <UserCheck className="h-4 w-4 text-emerald-500" />
                <span>Referral Check (10x Callback Multiplier)</span>
              </div>
              <Badge variant="outline" className="text-[10px]">
                Labor Econ Benchmark
              </Badge>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
              Internal referrals achieve <strong>25%–60% interview rates</strong> versus <strong>2%–5% for cold applications</strong>.
            </p>
            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-muted/40 p-2.5 text-xs">
              <span>{referralContact ? `Contact available at ${company}: ${referralContact}` : `Search your network for 1st/2nd-degree connections at ${company}.`}</span>
              <Link href="/warm-path">
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  Check Warm Path →
                </Button>
              </Link>
            </div>
          </div>

          {/* 1-Click Pitch / Note to Recruiter */}
          <div className="rounded-xl border border-border bg-background/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Recruiter 30-Second Pitch</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={copySummary}
                className="h-7 gap-1 text-xs"
              >
                {copiedSummary ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                {copiedSummary ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="rounded-lg bg-muted/30 p-2.5 text-xs leading-relaxed text-muted-foreground font-mono">
              {defaultPitch}
            </p>
          </div>

          {/* 1-Click Copy Cover Letter */}
          <div className="rounded-xl border border-border bg-background/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <FileText className="h-4 w-4 text-primary" />
                <span>Tailored Cover Letter</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={copyCover}
                className="h-7 gap-1 text-xs"
              >
                {copiedCover ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                {copiedCover ? "Copied full letter" : "Copy letter"}
              </Button>
            </div>
            <textarea
              readOnly
              value={defaultCover}
              rows={6}
              className="w-full rounded-lg border border-border bg-muted/20 p-2.5 text-xs font-mono text-muted-foreground resize-none focus:outline-none"
            />
          </div>

          {/* Skills quick-pills */}
          {topSkills.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Key Match Skills:</span>
              <div className="flex flex-wrap gap-1.5">
                {topSkills.map((sk, idx) => (
                  <Badge key={idx} variant="muted" className="text-[11px]">
                    {sk}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Application Pre-flight Checklist */}
          <div className="rounded-xl border border-border bg-background/50 p-4 space-y-2">
            <div className="flex items-center gap-2 font-medium text-xs text-muted-foreground uppercase tracking-wider">
              <ClipboardList className="h-4 w-4" />
              <span>Pre-Flight Checklist</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <button
                type="button"
                onClick={() => toggleCheck("referralChecked")}
                className="flex items-center gap-2 text-left hover:text-foreground text-muted-foreground"
              >
                {checklist.referralChecked ? (
                  <CheckSquare className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <Square className="h-4 w-4 shrink-0" />
                )}
                <span>Checked for warm employee referral connections</span>
              </button>
              <button
                type="button"
                onClick={() => toggleCheck("resumeTailored")}
                className="flex items-center gap-2 text-left hover:text-foreground text-muted-foreground"
              >
                {checklist.resumeTailored ? (
                  <CheckSquare className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <Square className="h-4 w-4 shrink-0" />
                )}
                <span>Tailored resume matches core job requirements</span>
              </button>
              <button
                type="button"
                onClick={() => toggleCheck("coverLetterPasted")}
                className="flex items-center gap-2 text-left hover:text-foreground text-muted-foreground"
              >
                {checklist.coverLetterPasted ? (
                  <CheckSquare className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <Square className="h-4 w-4 shrink-0" />
                )}
                <span>Pasted specific hook and proof line in cover field</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer with Apply Link and Completion Trigger */}
        <div className="border-t border-border bg-card p-5 flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>

          <div className="flex items-center gap-2">
            {!isSubmitted ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkSubmitted}
                className="gap-1.5 text-xs"
              >
                <Check className="h-3.5 w-3.5" />
                Mark as Applied
              </Button>
            ) : (
              <Badge variant="success" className="text-xs gap-1 py-1">
                <Check className="h-3.5 w-3.5" />
                Applied & Tracked
              </Badge>
            )}

            {jobUrl && (
              <a
                href={jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90"
              >
                Open Application Portal
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
