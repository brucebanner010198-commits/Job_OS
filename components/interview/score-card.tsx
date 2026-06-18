/**
 * Session score card (Phase 8, plan §5). Presentational only - it renders a
 * deterministic SessionScore from the pure scorer (lib/interview/score.ts): the
 * four 0..100 sub-scores as labeled bars, the weighted overall number shown
 * prominently, the flags as chips, the honest notes, and the per-answer STAR
 * fixes as an actionable list.
 *
 * Safety role: this component never computes or invents a score and never touches
 * a fact or a transcript directly - it only displays the templated, sensitive-safe
 * strings the scorer already produced. No DB, no network, no clock.
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SessionScore } from "@/lib/interview/types";

/** The four sub-scores, in a fixed display order. */
const SUBS = [
  { key: "clarity", label: "Clarity" },
  { key: "structure", label: "Structure" },
  { key: "specificity", label: "Specificity" },
  { key: "fit", label: "Fit" },
] as const;

/** A 0..100 score → a calm traffic-light colour token. */
function band(n: number): string {
  if (n >= 75) return "var(--success)";
  if (n >= 50) return "var(--warning)";
  return "var(--danger)";
}

/** One labeled progress bar for a sub-score. */
function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: band(value) }}
        />
      </div>
    </div>
  );
}

export function ScoreCard({ score }: { score: SessionScore }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Session score</CardTitle>
          <div className="text-right">
            <div
              className="text-3xl font-bold tabular-nums"
              style={{ color: band(score.overall) }}
            >
              {score.overall}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              overall
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Four sub-scores as labeled bars. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SUBS.map((s) => (
            <Bar key={s.key} label={s.label} value={score[s.key]} />
          ))}
        </div>

        {/* Flags as short chips. */}
        {score.flags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {score.flags.map((f) => (
              <Badge key={f} variant="outline" className="text-[10px]">
                {f}
              </Badge>
            ))}
          </div>
        )}

        {/* Honest notes. */}
        {score.notes.length > 0 && (
          <ul className="space-y-1.5">
            {score.notes.map((n, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-sm text-muted-foreground"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Actionable per-answer STAR fixes. */}
        {score.starFixes.length > 0 && (
          <div className="rounded-lg border border-border bg-background p-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              STAR fixes
            </h4>
            <ol className="space-y-2">
              {score.starFixes.map((f, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="text-foreground">{f}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
