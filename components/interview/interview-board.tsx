/**
 * Interview board (Phase 8, plan §5) - the client surface that lists prep targets
 * and owns the per-prep MODE PICKER. Each card composes the three modes:
 *   - STUDY  → <StudyGuide> (the always-free, fully-offline core) + a
 *              Generate/Regenerate action that re-grounds the guide from the
 *              user's real profile.
 *   - AI_SCREEN / REAL_HR → <MockSession> (the cost-capped live voice mock; runs a
 *              zero-cost scripted session until ElevenLabs is configured).
 *
 * Safety role: this is purely a composition shell. It NEVER starts a session
 * itself - the human picks a mode and clicks inside MockSession, which is
 * server-guarded. In sample-preview (readOnly) the write actions are disabled and
 * a note explains why. A prep auto-surfaced by a Gmail interview invite is badged
 * (fromInvite) and shows the parsed interview time - but it is still proposed, not
 * auto-started.
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CalendarClock,
  Mail,
  Radio,
  RefreshCw,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StudyGuide } from "@/components/interview/study-guide";
import { MockSession } from "@/components/interview/mock-session";
import { ReadinessGate } from "@/components/interview/readiness-gate";
import { generateStudyGuideAction } from "@/app/actions/interview";
import type {
  InterviewMode,
  InterviewPrepView,
  PrepAppStatus,
  SessionView,
  VoiceCaps,
  VoiceStatus,
} from "@/lib/interview/types";

type BadgeVariant =
  | "muted"
  | "default"
  | "outline"
  | "warning"
  | "success"
  | "danger"
  | "accent";

const STATUS_LABEL: Record<PrepAppStatus, string> = {
  TO_APPLY: "To apply",
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
};

const STATUS_VARIANT: Record<PrepAppStatus, BadgeVariant> = {
  TO_APPLY: "muted",
  APPLIED: "default",
  INTERVIEWING: "accent",
  OFFER: "success",
};

const MODE_TABS: { mode: InterviewMode; label: string; icon: typeof BookOpen }[] = [
  { mode: "STUDY", label: "Study", icon: BookOpen },
  { mode: "AI_SCREEN", label: "AI screen", icon: Radio },
  { mode: "REAL_HR", label: "Real-HR", icon: UserRound },
];

const MODE_LABEL: Record<InterviewMode, string> = {
  STUDY: "Study",
  AI_SCREEN: "AI screen",
  REAL_HR: "Real-HR",
};

/** Short, locale-stable date for an ISO instant. */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// --- Prior sessions ----------------------------------------------------------

function PriorSessions({ sessions }: { sessions: SessionView[] }) {
  if (sessions.length === 0) return null;
  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Past sessions
      </p>
      <ul className="space-y-1.5">
        {sessions.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-2 text-xs"
          >
            <span className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {MODE_LABEL[s.mode]}
              </Badge>
              <span className="text-muted-foreground">{fmtDate(s.createdAt)}</span>
            </span>
            {s.score ? (
              <span className="tabular-nums font-medium text-foreground">
                {s.score.overall}/100
              </span>
            ) : (
              <span className="text-muted-foreground">{s.state.toLowerCase()}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- One prep card -----------------------------------------------------------

function PrepCard({
  prep,
  caps,
  dailyRemainingSec,
  readOnly,
}: {
  prep: InterviewPrepView;
  caps: VoiceCaps;
  dailyRemainingSec: number;
  readOnly: boolean;
}) {
  const [mode, setMode] = useState<InterviewMode>("STUDY");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function regenerate() {
    if (readOnly) return;
    startTransition(async () => {
      await generateStudyGuideAction(prep.company, prep.applicationId ?? null);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {/* Header - company / role + status + invite. */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">
              {prep.company}
            </h3>
            <Badge variant={STATUS_VARIANT[prep.status]} className="text-[10px]">
              {STATUS_LABEL[prep.status]}
            </Badge>
            {prep.fromInvite && (
              <Badge variant="accent" className="text-[10px]">
                <Mail className="mr-1 h-3 w-3" />
                from invite
              </Badge>
            )}
          </div>
          {prep.role && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {prep.role}
            </p>
          )}
          {prep.interviewAt && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-accent">
              <CalendarClock className="h-3.5 w-3.5" />
              Interview {fmtDate(prep.interviewAt)}
            </p>
          )}
        </div>
      </div>

      {/* Mode picker. */}
      <div className="mt-4 inline-flex rounded-lg border border-border bg-background p-0.5">
        {MODE_TABS.map(({ mode: m, label, icon: Icon }) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              mode === m
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Body - the chosen mode. */}
      <div className="mt-4">
        {mode === "STUDY" ? (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={regenerate}
                disabled={readOnly || pending}
                title={
                  readOnly ? "connect a database to regenerate" : undefined
                }
              >
                {pending ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {prep.guide.questions.length > 0 ? "Regenerate" : "Generate"} guide
              </Button>
            </div>
            <StudyGuide guide={prep.guide} />
          </div>
        ) : mode === "REAL_HR" &&
          !prep.sessions.some((s) => s.mode === "AI_SCREEN" && s.score) ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            Complete an AI screen practice session first - then unlock the Real-HR
            mock for a harder follow-up.
          </div>
        ) : (
          <ReadinessGate
            company={prep.company}
            hasStudyGuide={prep.guide.questions.length > 0}
          >
            <MockSession
              key={mode}
              company={prep.company}
              role={prep.role}
              applicationId={prep.applicationId}
              mode={mode}
              readOnly={readOnly}
              caps={caps}
              dailyRemainingSec={dailyRemainingSec}
            />
          </ReadinessGate>
        )}
      </div>

      <PriorSessions sessions={prep.sessions} />
    </div>
  );
}

// --- The board ---------------------------------------------------------------

export function InterviewBoard({
  preps,
  voice: _voice,
  caps,
  dailyRemainingSec,
  readOnly,
}: {
  preps: InterviewPrepView[];
  voice: VoiceStatus;
  caps: VoiceCaps;
  dailyRemainingSec: number;
  readOnly: boolean;
}) {
  if (preps.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
        No prep yet. Apply to roles (or connect Gmail so interview invites surface
        here) and each one gets a study guide and live mocks.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {readOnly && (
        <p className="rounded-lg border border-dashed border-border bg-card/50 p-3 text-xs text-muted-foreground">
          Sample preview - study guides render in full; connect a database to run
          and save real, cost-capped sessions.
        </p>
      )}
      {preps.map((prep) => (
        <PrepCard
          key={prep.id}
          prep={prep}
          caps={caps}
          dailyRemainingSec={dailyRemainingSec}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}
