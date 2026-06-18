import Link from "next/link";
import { Check, Upload, Mic, Target } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    id: 1,
    title: "Resume",
    description: "Upload or paste your master resume",
    href: "/import",
    altHref: "/master-resume",
    icon: Upload,
  },
  {
    id: 2,
    title: "Update",
    description: "Voice or type career updates",
    href: "/master-resume",
    icon: Mic,
  },
  {
    id: 3,
    title: "Goals",
    description: "Set your long-term goal and milestones",
    href: "/goals",
    icon: Target,
  },
] as const;

export function SetupStepper({
  resumeDone,
  goalsDone,
  activeStep = 1,
}: {
  resumeDone: boolean;
  goalsDone: boolean;
  activeStep?: number;
}) {
  const stepDone = (id: number) => {
    if (id === 1) return resumeDone;
    if (id === 2) return resumeDone;
    if (id === 3) return goalsDone;
    return false;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        {STEPS.map((step, i) => {
          const done = stepDone(step.id);
          const active = step.id === activeStep;
          return (
            <div key={step.id} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors",
                  done
                    ? "border-success/40 bg-success/10 text-success"
                    : active
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-background text-muted-foreground",
                )}
              >
                {done ? <Check className="h-4 w-4" /> : step.id}
              </div>
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

      <div className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const done = stepDone(step.id);
          return (
            <Link
              key={step.id}
              href={step.href}
              className={cn(
                "group rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-200",
                "hover:border-accent/40 hover:shadow-md",
                done && "border-success/30",
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-accent/10">
                  <Icon className="h-4 w-4" />
                </div>
                {done && (
                  <span className="text-xs font-medium text-success">Done</span>
                )}
              </div>
              <h3 className="font-medium">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {step.description}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
