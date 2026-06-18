"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  PIPELINE_STAGES,
  stageFromPathname,
  stageIndex,
  type PipelineStageId,
} from "@/lib/pipeline/stages";

export function PipelineRail({
  homeStage,
  className,
  onNavigate,
}: {
  /** When pathname is `/`, highlight this stage (from setup status). */
  homeStage?: PipelineStageId;
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const fromPath = stageFromPathname(pathname);
  const activeId: PipelineStageId =
    pathname === "/" && homeStage ? homeStage : (fromPath ?? homeStage ?? "setup");
  const activeIndex = stageIndex(activeId);

  return (
    <nav
      aria-label="Job search pipeline"
      className={cn("px-1", className)}
    >
      <ol className="flex flex-col gap-0.5">
        {PIPELINE_STAGES.map((stage, i) => {
          const isActive = stage.id === activeId;
          const isPast = i < activeIndex;
          const isFuture = i > activeIndex;

          return (
            <li key={stage.id}>
              <Link
                href={stage.href}
                onClick={onNavigate}
                className={cn(
                  "group relative flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "border-l-2 border-accent bg-muted pl-[calc(0.5rem-2px)] font-medium text-foreground shadow-sm"
                    : "border-l-2 border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "relative flex h-2.5 w-2.5 shrink-0 rounded-full transition-all duration-200",
                    isActive && "scale-110 bg-accent ring-4 ring-accent/25",
                    isPast && !isActive && "bg-foreground/45",
                    isFuture && "border border-border bg-background",
                  )}
                  aria-hidden
                />
                <span className="truncate">{stage.label}</span>
                {isActive && (
                  <span
                    className="ml-auto hidden h-1.5 w-1.5 shrink-0 rounded-full bg-accent lg:block"
                    aria-hidden
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
