"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { stageFromPathname } from "@/lib/pipeline/stages";
import type { AutopilotBannerData } from "@/lib/autopilot/banner";
import { cn } from "@/lib/utils";

const ACTIVE_STAGES = new Set(["searching", "applying", "applied", "interview"]);

export function AutopilotBanner({
  data,
  className,
}: {
  data: AutopilotBannerData | null;
  className?: string;
}) {
  const pathname = usePathname();
  const stage = stageFromPathname(pathname);

  if (!data || !stage || !ACTIVE_STAGES.has(stage)) return null;

  return (
    <div
      className={cn(
        "border-b border-border/60 bg-muted/30 px-4 py-2",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="page-container flex flex-wrap items-center justify-between gap-2 py-0">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          {data.running ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" aria-hidden />
          ) : (
            <Zap
              className={cn(
                "h-3.5 w-3.5 shrink-0",
                data.enabled ? "text-accent" : "opacity-50",
              )}
              aria-hidden
            />
          )}
          <span className="truncate">{data.line}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={data.enabled ? "accent" : "muted"} className="text-[10px]">
            {data.enabled ? "Autopilot on" : "Autopilot off"}
          </Badge>
          {!data.enabled && (
            <Link
              href="/integrations"
              className="text-[10px] text-accent hover:underline"
            >
              Configure
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
