/**
 * Headline outcome stats (Phase 9, plan §9 + operating principle #4: "Measure
 * outcomes, not activity"). Presentational only - it renders the KpiHeadline and
 * SpeedMetrics the pure compute brain already produced. The HERO figure is
 * interviews-per-10-applications, the product's north-star KPI; the rest are calm,
 * scannable secondary stats. No DB, no service, no fixtures, no clock - the median
 * speed is read straight off the snapshot, never recomputed here.
 */
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SPEED_VERDICT_LABEL } from "@/lib/metrics/types";
import type { KpiHeadline, SpeedMetrics, SpeedVerdict } from "@/lib/metrics/types";

type BadgeVariant =
  | "muted"
  | "default"
  | "outline"
  | "warning"
  | "success"
  | "danger"
  | "accent";

// Speed verdict → chip colour: fast is good, on-pace is neutral-accent, too-slow
// is a caution. "insufficient-data" never reaches the chip (we show "-" instead).
const SPEED_VARIANT: Record<SpeedVerdict, BadgeVariant> = {
  fast: "success",
  ok: "accent",
  slow: "warning",
  "insufficient-data": "muted",
};

/** One stat cell. The hero cell gets a larger, accent-tinted treatment. */
function StatCell({
  value,
  caption,
  hero = false,
  chip,
}: {
  value: ReactNode;
  caption: string;
  hero?: boolean;
  chip?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        hero && "border-accent/30 bg-accent/5",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={cn(
            "font-bold leading-none tabular-nums",
            hero ? "text-4xl text-accent" : "text-2xl text-foreground",
          )}
        >
          {value}
        </span>
        {chip}
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{caption}</div>
    </div>
  );
}

export function HeadlineStats({
  headline,
  speed,
}: {
  headline: KpiHeadline;
  speed: SpeedMetrics;
}) {
  // Speed-to-apply: show a real median + verdict chip only when we have both a
  // number and a confident verdict; otherwise a calm "-".
  const median = speed.medianHours;
  let speedValue = "-";
  let speedCaption = "not enough data";
  let speedChipVariant: BadgeVariant | null = null;
  if (median !== undefined && speed.verdict !== "insufficient-data") {
    speedValue = `${Math.round(median)}h`;
    speedCaption = "median time to apply";
    speedChipVariant = SPEED_VARIANT[speed.verdict];
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {/* HERO - the north-star KPI. */}
      <StatCell
        hero
        value={headline.interviewsPer10Apps.toFixed(1)}
        caption="interviews per 10 applications"
        chip={
          <Badge variant="accent" className="text-[10px]">
            key metric
          </Badge>
        }
      />

      <StatCell value={headline.totalApplications} caption="total applications" />

      <StatCell
        value={`${Math.round(headline.offerRate * 100)}%`}
        caption="offer rate"
      />

      <StatCell
        value={speedValue}
        caption={speedCaption}
        chip={
          speedChipVariant ? (
            <Badge variant={speedChipVariant} className="text-[10px]">
              {SPEED_VERDICT_LABEL[speed.verdict]}
            </Badge>
          ) : undefined
        }
      />
    </div>
  );
}
