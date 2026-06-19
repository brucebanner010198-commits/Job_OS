import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SetupStatus } from "@/lib/pipeline/setup-status";

export function SetupCompletePanel({ setup }: { setup: SetupStatus }) {
  return (
    <div className="surface-card p-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
        <Check className="h-6 w-6 text-success" />
      </div>

      <h2 className="mt-4 text-lg font-medium">Profile ready</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Your resume and career goals are saved. Autopilot is discovering roles and
        preparing applications — review anything that needs your approval in Applying.
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <Badge variant="success">Ready for autopilot</Badge>
        {setup.setupPartial && (
          <Badge variant="warning">Partial setup</Badge>
        )}
      </div>

      <ul className="mx-auto mt-6 max-w-xs space-y-2 text-left text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0 text-success" />
          Resume ({setup.resumeCount} entries)
        </li>
        <li className="flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0 text-success" />
          Career goals saved
        </li>
      </ul>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/jobs">
          <Button variant="accent" className="gap-2">
            <Sparkles className="h-4 w-4" />
            View job queue
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        <Link href="/apply">
          <Button variant="outline">Review applications</Button>
        </Link>
      </div>
    </div>
  );
}
