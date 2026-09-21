"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cpu, Upload, Calendar, Target, Check, ArrowRight, ArrowLeft } from "lucide-react";
import { LlmSelectorStep } from "@/components/setup/llm-selector-step";
import { ResumeIntake } from "@/components/pipeline/resume-intake";
import { WeeklyCatchupStep } from "@/components/setup/weekly-catchup-step";
import { CareerVisionStep } from "@/components/setup/career-vision-step";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CareerGoalData } from "@/lib/goals/types";

const STEPS = [
  { id: 1, title: "AI Brain", description: "Select LLM architecture", icon: Cpu },
  { id: 2, title: "Master CV", description: "Upload up-to-date resume", icon: Upload },
  { id: 3, title: "Catch-up Log", description: "Recent accomplishments (skippable)", icon: Calendar },
  { id: 4, title: "Career Vision", description: "Goals & recommendations", icon: Target },
] as const;

type WizardStep = 1 | 2 | 3 | 4;

export function SetupWizard({
  resumeDone,
  goalsDone,
  resumeCount,
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
  const [resumeImported, setResumeImported] = useState(resumeDone);
  const router = useRouter();

  const stepDone = (id: number) => {
    if (id === 1) return true; // Can always proceed after choice
    if (id === 2) return resumeImported || resumeDone;
    if (id === 3) return true; // Skippable step
    if (id === 4) return goalsDone;
    return false;
  };

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
                  done && "text-emerald-500",
                  active && !done && "text-primary",
                  !active && !done && "text-muted-foreground/60",
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
              <span className="hidden text-[10px] text-muted-foreground/75 md:inline">
                {s.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* Mobile Step indicator */}
      <div className="flex items-center justify-between sm:hidden">
        {STEPS.map((s, i) => {
          const done = stepDone(s.id);
          const active = s.id === step;
          return (
            <div key={s.id} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => setStep(s.id as WizardStep)}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  done
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                    : active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground",
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
                    done ? "bg-emerald-500/30" : "bg-border",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Step {step} of 4: {STEPS[step - 1].title}
        {resumeCount > 0 && step === 2 && (
          <span className="text-emerald-500"> · {resumeCount} entries in profile</span>
        )}
      </p>

      {/* Step Content */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        {step === 1 && (
          <LlmSelectorStep onContinue={() => setStep(2)} />
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Step 2: Upload your master CV / resume</h2>
              <p className="text-xs text-muted-foreground">
                Upload your most up-to-date master CV (PDF or Word). The original file will be safely stored
                locally, and facts extracted into your single source of truth.
              </p>
            </div>
            <ResumeIntake
              embedded
              onImported={() => {
                setResumeImported(true);
                router.refresh();
                setStep(3);
              }}
            />
            <div className="flex justify-between border-t border-border pt-4">
              <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="gap-1.5 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to AI Model
              </Button>
              {(resumeImported || resumeDone) && (
                <Button size="sm" onClick={() => setStep(3)} className="gap-1.5 text-xs">
                  Next: Recent catch-up
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <WeeklyCatchupStep
              onContinue={() => setStep(4)}
              onSkip={() => setStep(4)}
            />
            <div className="flex justify-start border-t border-border pt-4">
              <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="gap-1.5 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Resume Upload
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <CareerVisionStep onComplete={() => router.push("/")} />
            <div className="flex justify-start border-t border-border pt-4">
              <Button variant="ghost" size="sm" onClick={() => setStep(3)} className="gap-1.5 text-xs">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Catch-up Log
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
