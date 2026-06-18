/**
 * Outcome funnel (Phase 9, plan §9). Presentational only - it renders the
 * FunnelCounts the pure compute brain produced: Pipeline → Applied → Interviewing
 * → Offer as labeled horizontal bars, with Rejected shown as a muted aside. Bar
 * widths are proportional to the largest progression stage; "Applied" is quietly
 * noted as the denominator for the headline KPI. No DB, no service, no fixtures,
 * no clock - bars are built from plain divs (there is no Progress primitive).
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FunnelCounts } from "@/lib/metrics/types";

// The four progression stages, in funnel order, each with its accent fill. The
// fill deepens toward Offer to read as forward progress. (Classes are literal so
// Tailwind's scanner keeps them.)
const STAGES = [
  { key: "pipeline", label: "Pipeline", hint: undefined, fill: "bg-accent/40" },
  { key: "applied", label: "Applied", hint: undefined, fill: "bg-accent/70" },
  { key: "interviewing", label: "Interviewing", hint: undefined, fill: "bg-accent/85" },
  { key: "offer", label: "Offer", hint: undefined, fill: "bg-accent" },
] as const;

/** One labeled horizontal bar with the integer count sitting on the track. */
function StageBar({
  label,
  hint,
  count,
  pct,
  fill,
  muted = false,
}: {
  label: string;
  hint?: string;
  count: number;
  pct: number;
  fill: string;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span
          className={cn(
            "font-medium",
            muted ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {label}
        </span>
        {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="relative h-7 w-full overflow-hidden rounded-lg bg-muted">
        <div
          className={cn("h-full rounded-lg transition-all", fill)}
          style={{ width: `${pct}%` }}
        />
        <span
          className={cn(
            "absolute inset-y-0 right-2 flex items-center text-xs font-semibold tabular-nums",
            muted ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {count}
        </span>
      </div>
    </div>
  );
}

export function FunnelBar({ funnel }: { funnel: FunnelCounts }) {
  // Scale every bar to the largest progression stage. Guard divide-by-zero.
  const max = Math.max(
    funnel.pipeline,
    funnel.applied,
    funnel.interviewing,
    funnel.offer,
  );
  const pct = (n: number) => (max > 0 ? Math.round((n / max) * 100) : 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Outcome funnel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {max === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
            No applications yet. Stages fill in as you submit and interview.
          </p>
        ) : (
          <>
            {STAGES.map((s) => (
              <StageBar
                key={s.key}
                label={s.label}
                hint={s.hint}
                count={funnel[s.key]}
                pct={pct(funnel[s.key])}
                fill={s.fill}
              />
            ))}

            {/* Rejected - a muted aside, not part of the progression. */}
            <div className="border-t border-border pt-3">
              <StageBar
                label="Rejected"
                hint="Closed"
                count={funnel.rejected}
                pct={pct(funnel.rejected)}
                fill="bg-muted-foreground/25"
                muted
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
