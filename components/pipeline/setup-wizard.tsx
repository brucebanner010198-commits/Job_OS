"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Upload,
  MessageSquare,
  Users,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { ResumeIntake } from "@/components/pipeline/resume-intake";
import { PathSelector } from "@/components/pipeline/path-selector";
import { NoResumeIntake } from "@/components/pipeline/no-resume-intake";
import { CoachingPanel } from "@/components/pipeline/coaching-panel";
import { ProfileReviewPanel } from "@/components/pipeline/profile-review-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OnboardingPath, CoachingTurn } from "@/lib/onboarding/types";
import type { CareerGoalData } from "@/lib/goals/types";

const STEPS = [
  { id: 1, title: "Start", description: "Choose your path", icon: Users },
  { id: 2, title: "Intake", description: "Share your background", icon: Upload },
  { id: 3, title: "Coaching", description: "Career deep-dive", icon: MessageSquare },
  { id: 4, title: "Review", description: "Confirm profile", icon: Check },
] as const;

type WizardStep = 1 | 2 | 3 | 4;

export function SetupWizard({
  resumeDone,
  goalsDone,
  resumeCount,
  resumeText = "",
  initialStep = 1,
}: {
  resumeDone: boolean;
  goalsDone: boolean;
  resumeCount: number;
  initialGoal?: CareerGoalData | null;
  resumeText?: string;
  initialStep?: number;
}) {
  const [step, setStep] = useState<WizardStep>(
    Math.min(Math.max(initialStep, 1), 4) as WizardStep,
  );
  const [path, setPath] = useState<OnboardingPath | null>(
    resumeDone ? "resume" : null,
  );
  const [initialPaste, setInitialPaste] = useState("");
  const [resumeImported, setResumeImported] = useState(resumeDone);
  const [coachingTurns, setCoachingTurns] = useState<CoachingTurn[]>([]);
  const [skipCoaching, setSkipCoaching] = useState(false);
  const router = useRouter();

  const stepDone = (id: number) => {
    if (id === 1) return path !== null;
    if (id === 2) return resumeImported || initialPaste.trim().length > 0 || path === "no-resume";
    if (id === 3) return coachingTurns.length > 0 || skipCoaching;
    if (id === 4) return goalsDone && resumeDone;
    return false;
  };

  function refreshAndAdvance(next: WizardStep) {
    router.refresh();
    setStep(next);
  }

  function handlePathSelect(p: OnboardingPath) {
    setPath(p);
  }

  function handleResumeImported() {
    setResumeImported(true);
    refreshAndAdvance(3);
  }

  function handleNoResumeContinue() {
    refreshAndAdvance(3);
  }

  function handleCoachingComplete(turns: CoachingTurn[]) {
    setCoachingTurns(turns);
    setSkipCoaching(false);
    setStep(4);
  }

  function handleSkipCoaching() {
    setSkipCoaching(true);
    setCoachingTurns([]);
    setStep(4);
  }

  return (
    <div className="space-y-6">
      {/* Step labels */}
      <div className="hidden justify-between gap-2 px-1 sm:flex">
        {STEPS.map((s) => {
          const done = stepDone(s.id);
          const active = s.id === step;
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id as WizardStep)}
              className={cn(
                "flex min-h-11 flex-1 flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-center transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active && "bg-muted/60",
                !active && "hover:bg-muted/40",
              )}
              aria-current={active ? "step" : undefined}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  done ? "text-success" : active ? "text-accent" : "text-muted-foreground",
                )}
              />
              <span
                className={cn(
                  "text-xs font-medium",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Progress stepper */}
      <div className="flex items-center justify-between gap-2">
        {STEPS.map((s, i) => {
          const done = stepDone(s.id);
          const active = s.id === step;
          return (
            <div key={s.id} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(s.id as WizardStep)}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                  done
                    ? "border-success/40 bg-success/10 text-success"
                    : active
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-background text-muted-foreground hover:border-accent/30",
                )}
                aria-label={`Step ${s.id}: ${s.title}`}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="h-4 w-4" /> : s.id}
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-px flex-1 transition-colors",
                    done ? "bg-success/30" : "bg-border",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Step {step} of 4: {STEPS[step - 1].title}
        {resumeCount > 0 && step <= 2 && (
          <span className="text-success"> · {resumeCount} entries in profile</span>
        )}
      </p>

      {/* Step content */}
      <div className="surface-card p-5 transition-shadow duration-200">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-medium">How would you like to start?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose whether you have a resume ready or want to build your profile through conversation.
              </p>
            </div>
            <PathSelector value={path} onChange={handlePathSelect} />
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button
                variant="accent"
                disabled={!path}
                onClick={() => setStep(2)}
                className="gap-2"
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && path === "resume" && (
          <div className="space-y-4">
            <div>
              <h2 className="font-medium">Your resume</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload a PDF or Word file, or paste your resume — we&apos;ll extract structured
                profile entries, then coach through any gaps and your goals.
              </p>
            </div>
            <ResumeIntake embedded onImported={handleResumeImported} />
            <div className="flex justify-between gap-2 border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setStep(1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              {(resumeImported || resumeDone) && (
                <Button variant="accent" onClick={() => setStep(3)} className="gap-2">
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {step === 2 && path === "no-resume" && (
          <div className="space-y-4">
            <div>
              <h2 className="font-medium">Share what you know</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Paste any career info you have, or start a conversation — the coach will fill in the rest.
              </p>
            </div>
            <NoResumeIntake
              initialPaste={initialPaste}
              onPasteChange={setInitialPaste}
              onContinue={handleNoResumeContinue}
            />
            <div className="flex justify-start border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setStep(1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
          </div>
        )}

        {step === 3 && path && (
          <div className="space-y-4">
            <div>
              <h2 className="font-medium">Career coaching</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A thorough session to capture your full history, skills, and goals. Answer as much
                as you can — we&apos;ll ask clarifying questions when something is missing.
              </p>
            </div>
            <CoachingPanel
              path={path}
              initialPaste={initialPaste || undefined}
              onComplete={handleCoachingComplete}
              onSkip={path === "resume" ? handleSkipCoaching : undefined}
              showSkip={path === "resume"}
            />
            <div className="flex justify-start border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setStep(2)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
          </div>
        )}

        {step === 4 && path && (
          <div className="space-y-4">
            <div>
              <h2 className="font-medium">Review & save</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Confirm your compiled profile and career goals before starting autopilot.
              </p>
            </div>
            <ProfileReviewPanel
              path={path}
              turns={coachingTurns}
              initialPaste={initialPaste || undefined}
              resumeText={resumeText || undefined}
              skipCoaching={skipCoaching}
              onBack={() => setStep(3)}
            />
          </div>
        )}

        {goalsDone && resumeDone && step === 4 && (
          <div className="mt-4 flex justify-end border-t border-border pt-4">
            <Link href="/jobs">
              <Button variant="outline" className="gap-2">
                Start searching
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
