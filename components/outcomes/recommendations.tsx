/**
 * "Do this next" lead list (Phase 9, plan §9). Presentational only - it renders
 * the recommendations the pure compute brain derived from the numbers, as a
 * prominent ordered list the dashboard leads with. Items are rendered raw (some
 * begin with an emoji like 🎉). Empty list → render nothing. No DB, no service,
 * no fixtures, no clock - this never invents advice, it only displays it.
 */
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function Recommendations({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-accent" />
          Do this next
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/12 text-xs font-semibold tabular-nums text-accent">
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed text-foreground">
                {item}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
