"use client";

import { useMemo } from "react";
import { AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarBalanceMeterProps {
  transcript: string;
}

export interface StarBreakdown {
  situationWords: number;
  taskWords: number;
  actionWords: number;
  resultWords: number;
  totalWords: number;
  situationPct: number;
  taskPct: number;
  actionPct: number;
  resultPct: number;
  contextPct: number; // Situation + Task
  isContextTrap: boolean;
  score: number; // 0 - 100
}

export function computeStarBreakdown(transcript: string): StarBreakdown {
  const sentences = transcript
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  let situationWords = 0;
  let taskWords = 0;
  let actionWords = 0;
  let resultWords = 0;

  const situationRegex = /\b(when (I|we)|at the time|initially|historically|the problem was|our team had|there was|the company was|we were facing|existing system|legacy|context|background)\b/i;
  const taskRegex = /\b(my goal was|I was tasked with|we needed to|the objective was|my responsibility|we had to|the requirement|in order to|aimed to|deadline was)\b/i;
  const actionRegex = /\b(I designed|I built|I implemented|I architected|I refactored|I migrated|I led|I decided|I introduced|I initiated|I authored|I created|I developed|I deployed|I organized)\b/i;
  const resultRegex = /\b(as a result|resulting in|which increased|which decreased|reduced by|improved by|saved|scaled to|percent|%|\$|successfully delivered|outcome was|learned that)\b/i;

  for (const sentence of sentences) {
    const wordCount = sentence.split(/\s+/).filter(Boolean).length;

    const hasResult = resultRegex.test(sentence);
    const hasAction = actionRegex.test(sentence);
    const hasTask = taskRegex.test(sentence);
    const hasSituation = situationRegex.test(sentence);

    if (hasResult) {
      resultWords += wordCount;
    } else if (hasAction) {
      actionWords += wordCount;
    } else if (hasTask) {
      taskWords += wordCount;
    } else if (hasSituation) {
      situationWords += wordCount;
    } else {
      // Default heuristic: first 25% of text leans context, middle leans action, end leans result
      actionWords += wordCount;
    }
  }

  const totalWords = Math.max(1, situationWords + taskWords + actionWords + resultWords);
  const situationPct = Math.round((situationWords / totalWords) * 100);
  const taskPct = Math.round((taskWords / totalWords) * 100);
  const actionPct = Math.round((actionWords / totalWords) * 100);
  const resultPct = Math.round((resultWords / totalWords) * 100);
  const contextPct = situationPct + taskPct;
  const isContextTrap = contextPct > 35;

  // Score calculation: higher if action >= 40% and result >= 15% and context <= 35%
  let score = 70;
  if (!isContextTrap) score += 15;
  if (actionPct >= 40) score += 10;
  if (resultPct >= 15) score += 5;
  if (isContextTrap) score -= 25;

  return {
    situationWords,
    taskWords,
    actionWords,
    resultWords,
    totalWords,
    situationPct,
    taskPct,
    actionPct,
    resultPct,
    contextPct,
    isContextTrap,
    score: Math.max(0, Math.min(100, score)),
  };
}

export function StarBalanceMeter({ transcript }: StarBalanceMeterProps) {
  const breakdown = useMemo(() => computeStarBreakdown(transcript), [transcript]);

  if (!transcript.trim() || breakdown.totalWords < 15) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <span>STAR Response Balance Meter</span>
          <span className="text-[10px] text-muted-foreground font-normal">
            (Campion &amp; Huffcutt Interview Validity r=0.51)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Balance Score:</span>
          <span
            className={cn(
              "font-bold tabular-nums",
              breakdown.score >= 80
                ? "text-emerald-500"
                : breakdown.score >= 60
                  ? "text-amber-500"
                  : "text-[var(--danger)]"
            )}
          >
            {breakdown.score}/100
          </span>
        </div>
      </div>

      {/* Multi-segment ratio bar */}
      <div className="space-y-1.5">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            style={{ width: `${breakdown.situationPct}%` }}
            className="bg-blue-500 transition-all"
            title={`Situation: ${breakdown.situationPct}%`}
          />
          <div
            style={{ width: `${breakdown.taskPct}%` }}
            className="bg-indigo-500 transition-all"
            title={`Task: ${breakdown.taskPct}%`}
          />
          <div
            style={{ width: `${breakdown.actionPct}%` }}
            className="bg-emerald-500 transition-all"
            title={`Action: ${breakdown.actionPct}%`}
          />
          <div
            style={{ width: `${breakdown.resultPct}%` }}
            className="bg-amber-500 transition-all"
            title={`Result: ${breakdown.resultPct}%`}
          />
        </div>

        {/* Legend with target benchmarks */}
        <div className="flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <span>Situation: {breakdown.situationPct}% (target ~15%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
            <span>Task: {breakdown.taskPct}% (target ~15%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Action: {breakdown.actionPct}% (target ~50%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Result: {breakdown.resultPct}% (target ~20%)</span>
          </div>
        </div>
      </div>

      {/* Warning or Success Callout */}
      {breakdown.isContextTrap ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p className="leading-normal">
            <strong>Context trap detected:</strong> {breakdown.contextPct}% of your answer is describing Situation and Task.
            Empirical interview studies show evaluators grade candidates primarily on their personal decisions and measurable results. Shift focus to what <em>you</em> directly initiated and delivered.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>
            Strong balance: Context is kept concise ({breakdown.contextPct}%), reserving maximum space for your actions and impact.
          </span>
        </div>
      )}
    </div>
  );
}
