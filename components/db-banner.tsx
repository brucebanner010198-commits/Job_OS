import { Database } from "lucide-react";

/** Shown when a page couldn't reach Postgres. */
export function DbBanner() {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-4 text-sm">
      <Database className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
      <div>
        <p className="font-medium text-foreground">Database not connected</p>
        <p className="mt-0.5 text-muted-foreground">
          Start Postgres with <code className="rounded bg-muted px-1">npm run db:up</code>{" "}
          then apply the schema with{" "}
          <code className="rounded bg-muted px-1">npm run db:migrate</code>. Saved
          data will appear here once it&apos;s running.
        </p>
      </div>
    </div>
  );
}
