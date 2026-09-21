"use client";

import { useState } from "react";
import {
  Sparkles,
  Bot,
  UserCheck,
  BookOpen,
  Trophy,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InterviewFeedbackModal } from "@/components/interview/interview-feedback-modal";
import type { CompanyInterviewIntel } from "@/lib/interview/company-research";
import type { CuratedLesson } from "@/lib/interview/skill-gaps";
import type { SimulationReport } from "@/lib/interview/simulation-rounds";

export function InterviewIntelligencePanel({
  company,
  role,
  intel,
  lessons,
  reports,
}: {
  company: string;
  role: string;
  intel?: CompanyInterviewIntel | null;
  lessons: CuratedLesson[];
  reports: SimulationReport[];
}) {
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [expandedLesson, setExpandedLesson] = useState<number | null>(0);

  const latestReport = reports[reports.length - 1];
  const roundCount = reports.length;

  return (
    <div className="space-y-6">
      {/* Interview Day Alert Banner */}
      <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-xs text-foreground uppercase tracking-wider">
              Upcoming Interview Ready Check: {role} at {company}
            </div>
            <p className="text-xs text-muted-foreground">
              Review company interview style, study missing skill lessons, and complete 3 to 4 mock rounds.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowFeedbackModal(true)}
          className="text-xs gap-1.5 shrink-0"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Log Real Interview Debrief
        </Button>
      </div>

      {/* Multi-Round Simulation Tracker (3-4 Rounds) */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Mock Simulation Loop (Target: 3 to 4 Practice Rounds)
              </h3>
              <p className="text-xs text-muted-foreground">
                Iterate through realistic mock sessions. Each round generates an actionable improvement scorecard.
              </p>
            </div>
          </div>
          <Badge variant={roundCount >= 3 ? "success" : "outline"} className="text-xs">
            {roundCount} of 4 Rounds Complete
          </Badge>
        </div>

        {/* Round Progress Tracker */}
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((roundNum) => {
            const report = reports.find((r) => r.roundNumber === roundNum);
            const isCurrent = roundCount + 1 === roundNum;
            return (
              <div
                key={roundNum}
                className={`rounded-xl border p-3 text-center transition-all ${
                  report
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : isCurrent
                      ? "border-primary bg-primary/5"
                      : "border-border/60 bg-muted/10 opacity-60"
                }`}
              >
                <div className="text-[11px] font-medium text-muted-foreground">Round {roundNum}</div>
                <div className="mt-1 text-base font-bold text-foreground">
                  {report ? `${report.overallScore}/100` : isCurrent ? "Next Up" : "Pending"}
                </div>
                {report?.scoreDelta !== undefined && (
                  <div className="text-[10px] text-emerald-500 font-semibold mt-0.5">
                    +{report.scoreDelta} pts improvement
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Latest Report Insights */}
        {latestReport && (
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>Latest Round {latestReport.roundNumber} Improvement Analysis:</span>
              <span className="text-muted-foreground">Score: {latestReport.overallScore}/100</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
              <div className="rounded bg-background p-2 border border-border">
                <div className="text-muted-foreground">Clarity</div>
                <div className="font-bold">{latestReport.categoryScores.clarity}/25</div>
              </div>
              <div className="rounded bg-background p-2 border border-border">
                <div className="text-muted-foreground">Tech Depth</div>
                <div className="font-bold">{latestReport.categoryScores.technicalDepth}/25</div>
              </div>
              <div className="rounded bg-background p-2 border border-border">
                <div className="text-muted-foreground">Brevity</div>
                <div className="font-bold">{latestReport.categoryScores.brevity}/25</div>
              </div>
              <div className="rounded bg-background p-2 border border-border">
                <div className="text-muted-foreground">Leadership</div>
                <div className="font-bold">{latestReport.categoryScores.leadership}/25</div>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="font-medium text-foreground">Key Actions for Next Practice Round:</div>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground text-[11px]">
                {latestReport.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Company Interview Research */}
      {intel && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Company Interview Intelligence: {intel.company}
              </h3>
              <p className="text-xs text-muted-foreground">
                Researched interview format patterns for AI screening and HR evaluation rounds.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                <Bot className="h-4 w-4 text-primary" />
                <span>AI Screening Stage (HireVue / Automated Filter)</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {intel.aiScreeningFormat}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                <UserCheck className="h-4 w-4 text-emerald-500" />
                <span>HR &amp; Hiring Manager Stage</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {intel.hrInterviewStyle}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Frequently Probed Question Themes:</div>
            <div className="flex flex-wrap gap-1.5">
              {intel.commonQuestionThemes.map((theme, i) => (
                <Badge key={i} variant="outline" className="text-[11px]">
                  {theme}
                </Badge>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-background p-3 text-xs text-muted-foreground border border-border">
            <strong>Preparation Strategy:</strong> {intel.preparationAdvice}
          </div>
        </div>
      )}

      {/* Curated Pre-Interview Lessons */}
      {lessons.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Curated Skill-Gap Lessons for this Interview
              </h3>
              <p className="text-xs text-muted-foreground">
                Identified gaps between your background and the target requirements. Study these talking points to speak with authority.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {lessons.map((lesson, idx) => {
              const isExpanded = expandedLesson === idx;
              return (
                <div key={idx} className="rounded-xl border border-border bg-muted/20 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedLesson(isExpanded ? null : idx)}
                    className="flex w-full items-center justify-between p-3.5 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {lesson.category}
                      </Badge>
                      <span className="text-xs font-semibold text-foreground">{lesson.skill}</span>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border bg-background p-4 space-y-3 text-xs">
                      <p className="text-muted-foreground leading-relaxed">{lesson.summary}</p>

                      <div className="space-y-1">
                        <div className="font-semibold text-foreground text-[11px]">Core Talking Points:</div>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px]">
                          {lesson.keyTalkingPoints.map((pt, i) => (
                            <li key={i}>{pt}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-lg bg-muted/30 p-2.5 text-[11px] space-y-1 border border-border/50">
                        <div className="font-semibold text-foreground">Sample Question &amp; Framing:</div>
                        <div className="italic text-muted-foreground">&quot;{lesson.sampleInterviewQuestion}&quot;</div>
                        <div className="text-primary pt-0.5">
                          <strong>Frame with:</strong> {lesson.idealAnswerFramework}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Post Interview Feedback Modal */}
      <InterviewFeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        company={company}
        role={role}
      />
    </div>
  );
}
