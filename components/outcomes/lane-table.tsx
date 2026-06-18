/**
 * Lane barbell (Phase 9, plan §9). Presentational only - one card per lane (the
 * thin cold-apply lane vs. the warm/referral lane) rendering the LaneMetrics the
 * pure compute brain produced. This is THE feature of the dashboard: a lane that
 * isn't converting must visibly stand out from one that is, so the user can shift
 * effort toward what actually lands interviews. Colour comes entirely from the
 * verdict the brain already decided. No DB, no service, no fixtures, no clock.
 */
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LANE_LABEL, VERDICT_LABEL } from "@/lib/metrics/types";
import type { LaneMetrics, Verdict } from "@/lib/metrics/types";

type BadgeVariant =
  | "muted"
  | "default"
  | "outline"
  | "warning"
  | "success"
  | "danger"
  | "accent";

// Verdict → chip colour. Underperforming is the strong signal (danger).
const VERDICT_VARIANT: Record<Verdict, BadgeVariant> = {
  converting: "success",
  underperforming: "danger",
  "insufficient-data": "muted",
};

// A coloured left edge so a weak lane reads instantly against a converting one.
const VERDICT_EDGE: Record<Verdict, string> = {
  converting: "border-l-4 border-l-[var(--success)]",
  underperforming: "border-l-4 border-l-[var(--danger)]",
  "insufficient-data": "border-l-4 border-l-border",
};

/** One small labeled count cell. */
function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background p-2 text-center">
      <div className="text-sm font-semibold tabular-nums text-foreground">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function LaneCard({ lane }: { lane: LaneMetrics }) {
  const underperforming = lane.verdict === "underperforming";
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        VERDICT_EDGE[lane.verdict],
      )}
    >
      {/* Title + verdict. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          {LANE_LABEL[lane.lane]}
        </h3>
        <Badge variant={VERDICT_VARIANT[lane.verdict]} className="text-[10px]">
          {VERDICT_LABEL[lane.verdict]}
        </Badge>
      </div>

      {/* The lane headline KPI. */}
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tabular-nums text-foreground">
          {lane.interviewsPer10Apps.toFixed(1)}
        </span>
        <span className="text-sm font-medium text-muted-foreground">
          / 10 interviews
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        interviews per 10 submitted applications
      </p>

      {/* Small supporting stats. */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniStat label="Applied" value={lane.applications} />
        <MiniStat label="Interviews" value={lane.interviews} />
        <MiniStat label="Offers" value={lane.offers} />
      </div>

      {/* Recommendation - danger-tinted for an underperforming lane. */}
      {lane.recommendation && (
        <p
          className={cn(
            "mt-3 rounded-lg border p-3 text-xs leading-relaxed",
            underperforming
              ? "border-[var(--danger)]/30 bg-[var(--danger)]/12 text-[var(--danger)]"
              : "border-dashed border-border bg-card/50 text-muted-foreground",
          )}
        >
          {lane.recommendation}
        </p>
      )}
    </div>
  );
}

export function LaneTable({ lanes }: { lanes: LaneMetrics[] }) {
  if (lanes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
        No lane data yet. Apply via both cold and warm paths to compare them here.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {lanes.map((lane) => (
        <LaneCard key={lane.lane} lane={lane} />
      ))}
    </div>
  );
}
