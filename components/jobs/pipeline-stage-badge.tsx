"use client";

import { cn } from "@/lib/utils";

const STAGES = ["Discover", "Screen", "Score", "Apply"] as const;

/** Minimal pipeline indicator - jobs in queue have completed through Score. */
export function PipelineStageBadge({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-1 text-[10px]", className)}
      title="Full pipeline: discover → screen → score → apply"
    >
      {STAGES.map((stage, i) => {
        const done = i < 3;
        const current = i === 2;
        return (
          <span key={stage} className="inline-flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground/40">→</span>}
            <span
              className={cn(
                "rounded px-1.5 py-0.5",
                done && "bg-muted text-muted-foreground",
                current && "bg-accent/15 font-medium text-accent",
                !done && !current && "text-muted-foreground/50",
              )}
            >
              {stage}
              {current ? " ✓" : ""}
            </span>
          </span>
        );
      })}
    </div>
  );
}
