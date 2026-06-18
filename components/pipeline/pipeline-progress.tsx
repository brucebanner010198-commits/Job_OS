import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  PIPELINE_STAGES,
  stageIndex,
  type PipelineStageId,
} from "@/lib/pipeline/stages";

export function PipelineProgress({
  activeId,
  className,
  linked = false,
}: {
  activeId: PipelineStageId;
  className?: string;
  /** When true, each stage links to its route. */
  linked?: boolean;
}) {
  const activeIndex = stageIndex(activeId);
  const progressPct =
    PIPELINE_STAGES.length > 1
      ? (activeIndex / (PIPELINE_STAGES.length - 1)) * 100
      : 0;

  return (
    <div className={cn("w-full", className)} aria-label="Pipeline progress">
      <div className="relative px-1">
        <div
          className="absolute left-4 right-4 top-1 h-px bg-border"
          aria-hidden
        />
        <div
          className="absolute left-4 top-1 h-px bg-accent/50 transition-all duration-500"
          style={{ width: `calc((100% - 2rem) * ${progressPct / 100})` }}
          aria-hidden
        />
        <div className="relative flex justify-between gap-1">
          {PIPELINE_STAGES.map((stage, i) => {
            const isActive = stage.id === activeId;
            const isPast = i < activeIndex;
            const isFuture = i > activeIndex;

            const inner = (
              <>
                <span
                  className={cn(
                    "relative z-10 block h-2.5 w-2.5 shrink-0 rounded-full transition-all duration-300",
                    isActive && "scale-125 bg-accent ring-4 ring-accent/25",
                    isPast && !isActive && "bg-foreground/50",
                    isFuture && "border border-border bg-background",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "mt-2 block max-w-[3.5rem] truncate text-center text-[10px] font-medium leading-tight sm:max-w-none sm:text-xs",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {stage.shortLabel}
                </span>
              </>
            );

            const itemClass = cn(
              "flex flex-col items-center rounded-lg px-1 py-1.5 transition-colors",
              isActive && "bg-muted/50",
            );

            return linked ? (
              <Link
                key={stage.id}
                href={stage.href}
                className={cn(
                  itemClass,
                  "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
                aria-current={isActive ? "step" : undefined}
              >
                {inner}
              </Link>
            ) : (
              <div
                key={stage.id}
                className={itemClass}
                aria-current={isActive ? "step" : undefined}
              >
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
