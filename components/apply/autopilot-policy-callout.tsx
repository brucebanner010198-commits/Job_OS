import { ShieldCheck, Zap, Eye, HandMetal } from "lucide-react";

/** Explains AUTONOMOUS-only auto-submit vs spray-and-pray competitors. */
export function AutopilotPolicyCallout() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-sm">
      <div className="mb-2 flex items-center gap-2 font-medium">
        <ShieldCheck className="h-4 w-4 text-accent" />
        How applications are handled
      </div>
      <p className="mb-3 text-muted-foreground">
        Unlike high-volume auto-apply tools (LazyApply, LoopCV), Job OS never
        blasts out applications. Each one is routed and reviewed based on how
        risky the application page is:
      </p>
      <ul className="space-y-2 text-xs">
        <li className="flex items-start gap-2">
          <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          <span>
            <strong className="text-foreground">AUTONOMOUS</strong>: rare.
            Auto-submits only on simple pages with no essay or critical fields
            and a clean safety scan.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" />
          <span>
            <strong className="text-foreground">ASSISTED</strong>: the default.
            The app fills the form and you approve every field before it submits.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <HandMetal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--warning)]" />
          <span>
            <strong className="text-foreground">MANUAL</strong>: LinkedIn,
            Workday, and screening questions. Opens in your browser; nothing is
            auto-submitted.
          </span>
        </li>
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Gmail status changes and warm-path outreach are always suggestions. You
        confirm every move.
      </p>
    </div>
  );
}
