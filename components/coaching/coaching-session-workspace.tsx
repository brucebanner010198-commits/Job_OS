"use client";

import { useState, useTransition } from "react";
import {
  Sparkles,
  CheckCircle2,
  BookmarkPlus,
  ArrowRight,
  ListChecks,
  Lightbulb,
  Wrench,
  Award,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OfflineSessionRecorder } from "@/components/coaching/offline-session-recorder";
import { StarBalanceMeter } from "@/components/coaching/star-balance-meter";
import {
  processCoachingSessionAction,
  saveCoachingSessionAction,
} from "@/app/actions/coaching-session";
import type { CoachingSessionInsights } from "@/lib/coaching/session-processor";
import { cn } from "@/lib/utils";

export interface CoachingSessionWorkspaceProps {
  onSessionSaved?: (workLogId: string) => void;
  className?: string;
}

export function CoachingSessionWorkspace({
  onSessionSaved,
  className,
}: CoachingSessionWorkspaceProps) {
  const [transcript, setTranscript] = useState("");
  const [insights, setInsights] = useState<CoachingSessionInsights | null>(null);
  const [isProcessing, startProcessing] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleProcess = () => {
    if (!transcript.trim()) {
      setError("Please record or write your session transcript first.");
      return;
    }
    setError(null);
    setSavedSuccess(false);

    startProcessing(async () => {
      const res = await processCoachingSessionAction(transcript);
      if (res.ok && res.insights) {
        setInsights(res.insights);
      } else {
        setError(res.error || "Failed to process session.");
      }
    });
  };

  const handleSave = () => {
    if (!insights) return;
    setError(null);

    startSaving(async () => {
      const res = await saveCoachingSessionAction(insights, transcript, true);
      if (res.ok && res.workLogId) {
        setSavedSuccess(true);
        if (onSessionSaved) {
          onSessionSaved(res.workLogId);
        }
      } else {
        setError(res.error || "Failed to save session to journal.");
      }
    });
  };

  return (
    <div className={cn("space-y-6", className)}>
      <OfflineSessionRecorder
        onTranscriptChange={(text) => {
          setTranscript(text);
          if (savedSuccess) setSavedSuccess(false);
        }}
        initialTranscript={transcript}
      />

      <StarBalanceMeter transcript={transcript} />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Processing trigger button */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-muted-foreground">
          {transcript.trim().length > 0
            ? `${transcript.trim().split(/\s+/).length} words ready to analyze`
            : "Record or paste your update to generate structured insights."}
        </p>

        <Button
          onClick={handleProcess}
          disabled={isProcessing || !transcript.trim()}
          variant="accent"
          className="gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing Session...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Process Session with AI
            </>
          )}
        </Button>
      </div>

      {/* Structured Insights Display */}
      {insights && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono">
                  {insights.category}
                </Badge>
                <span className="text-xs text-muted-foreground">Daily Coaching Synthesis</span>
              </div>
              <h3 className="mt-1 text-base font-semibold tracking-tight">
                {insights.title}
              </h3>
            </div>

            <Button
              onClick={handleSave}
              disabled={isSaving || savedSuccess}
              variant={savedSuccess ? "outline" : "accent"}
              className="gap-2 shrink-0"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : savedSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Saved to Journal & Profile
                </>
              ) : (
                <>
                  <BookmarkPlus className="h-4 w-4" />
                  Save to Career Journal
                </>
              )}
            </Button>
          </div>

          <div className="space-y-1">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Overview
            </h4>
            <p className="text-sm text-foreground leading-relaxed">{insights.summary}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Quantified Achievements */}
            <div className="rounded-lg border border-border/70 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-accent" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Grounded Achievements
                </h4>
              </div>
              <ul className="space-y-2">
                {insights.achievements.map((a, i) => (
                  <li key={i} className="text-xs text-foreground/90 space-y-1">
                    <div className="flex items-start gap-1.5">
                      <span className="text-accent">•</span>
                      <span>{a.description}</span>
                    </div>
                    {a.metric && (
                      <Badge variant="success" className="ml-3 text-[10px]">
                        Metric: {a.metric}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Technical Decisions & Architecture */}
            <div className="rounded-lg border border-border/70 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-accent" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Technical Decisions & Point of View
                </h4>
              </div>
              <ul className="space-y-2">
                {insights.technicalDecisions.map((d, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/90">
                    <span className="text-accent">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Coach Observations */}
            <div className="rounded-lg border border-border/70 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-warning" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Coaching Takeaways
                </h4>
              </div>
              <ul className="space-y-2">
                {insights.coachingNotes.map((n, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <span>💡</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Next-Day Action Items */}
            <div className="rounded-lg border border-border/70 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-accent" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                  Next-Day Action Items
                </h4>
              </div>
              <ul className="space-y-2">
                {insights.actionItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/90">
                    <ArrowRight className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Practiced Skills Tags */}
          {insights.skills.length > 0 && (
            <div className="pt-2 border-t border-border flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Practiced skills:</span>
              {insights.skills.map((sk, i) => (
                <Badge key={i} variant="outline" className="text-[11px]">
                  {sk}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
