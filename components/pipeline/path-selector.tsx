"use client";

import { FileText, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OnboardingPath } from "@/lib/onboarding/types";

export function PathSelector({
  value,
  onChange,
}: {
  value: OnboardingPath | null;
  onChange: (path: OnboardingPath) => void;
}) {
  const options: {
    path: OnboardingPath;
    icon: typeof FileText;
    title: string;
    description: string;
  }[] = [
    {
      path: "resume",
      icon: FileText,
      title: "I have a resume",
      description: "Paste your resume and we'll extract your profile, then fill any gaps together.",
    },
    {
      path: "no-resume",
      icon: MessageSquare,
      title: "I don't have a resume",
      description: "Paste what you know or talk through your career — we'll build your profile from scratch.",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((opt) => {
        const Icon = opt.icon;
        const selected = value === opt.path;
        return (
          <button
            key={opt.path}
            type="button"
            onClick={() => onChange(opt.path)}
            className={cn(
              "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "border-accent bg-accent/5 ring-1 ring-accent/30"
                : "border-border bg-background hover:border-accent/40 hover:bg-muted/30",
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5",
                selected ? "text-accent" : "text-muted-foreground",
              )}
            />
            <span className="font-medium">{opt.title}</span>
            <span className="text-sm text-muted-foreground">{opt.description}</span>
          </button>
        );
      })}
    </div>
  );
}
