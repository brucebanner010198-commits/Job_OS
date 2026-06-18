"use client";

import { CheckCircle2, AlertTriangle, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RouteBadge } from "@/components/pipeline/route-badge";
import {
  evaluateApplyReadiness,
  type ApplyReadinessInput,
} from "@/lib/candidate/apply-readiness";
import { cn } from "@/lib/utils";
import type { ApplyRoute } from "@/lib/apply/types";

export interface ApplyReadinessBadgeProps extends ApplyReadinessInput {
  className?: string;
  showDetail?: boolean;
}

const STATUS_ICON = {
  ready: CheckCircle2,
  fix_first: AlertTriangle,
  blocked: Ban,
};

const STATUS_VARIANT = {
  ready: "success",
  fix_first: "warning",
  blocked: "danger",
} as const;

export function ApplyReadinessBadge({
  className,
  showDetail = true,
  ...input
}: ApplyReadinessBadgeProps) {
  const readiness = evaluateApplyReadiness(input);
  const Icon = STATUS_ICON[readiness.status];
  const variant = STATUS_VARIANT[readiness.status];

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={variant} className="gap-1">
          <Icon className="h-3 w-3" />
          {readiness.label}
        </Badge>
        <RouteBadge route={readiness.route as ApplyRoute} size="sm" />
        {showDetail && (
          <>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              Job {readiness.jobScorePercent}%
            </span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              Screen {readiness.screeningPercent}%
            </span>
          </>
        )}
      </div>
      {showDetail && readiness.blockers.length > 0 && (
        <p className="text-[10px] leading-snug text-muted-foreground">
          {readiness.blockers[0]}
        </p>
      )}
    </div>
  );
}
