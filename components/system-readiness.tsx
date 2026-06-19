"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type HealthResponse = {
  status: "ok" | "degraded";
  db: { ok: boolean; latencyMs?: number; error?: string };
  integrations: {
    total: number;
    configured: number;
    enabled: number;
  };
  version: string;
};

type VerifyResponse = {
  openrouter: "ok" | "invalid" | "missing";
};

const OPENROUTER_LABEL: Record<VerifyResponse["openrouter"], string> = {
  ok: "Connected",
  invalid: "Invalid key",
  missing: "Not configured",
};

export function SystemReadiness({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [verify, setVerify] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  const fetchHealth = useCallback(async () => {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (!res.ok && res.status !== 503) {
      throw new Error(`Health check failed (${res.status})`);
    }
    return (await res.json()) as HealthResponse;
  }, []);

  const loadHealth = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      setHealth(await fetchHealth());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach health endpoint.");
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, [fetchHealth]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchHealth();
        if (!cancelled) setHealth(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not reach health endpoint.");
          setHealth(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchHealth]);

  function runVerify() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/integrations/verify", { method: "POST" });
        if (!res.ok) throw new Error(`Verify failed (${res.status})`);
        setVerify((await res.json()) as VerifyResponse);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Verify request failed.");
      }
    });
  }

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">System readiness</h3>
          </div>
          {!compact && (
            <p className="mt-1 text-xs text-muted-foreground">
              Database and integration status for local ops. Optional keys can stay blank.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void loadHealth()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
          <Button
            type="button"
            size="sm"
            variant="accent"
            onClick={runVerify}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Verify integrations
          </Button>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs text-[var(--danger)]">{error}</p>
      )}

      {health && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant={health.status === "ok" ? "success" : "warning"}>
            {health.status === "ok" ? "System ok" : "Degraded"}
          </Badge>
          <Badge variant={health.db.ok ? "success" : "danger"}>
            DB {health.db.ok ? "online" : "offline"}
          </Badge>
          <Badge variant="muted">
            {health.integrations.configured}/{health.integrations.total} configured
          </Badge>
          {!compact && (
            <Badge variant="muted" className="text-[10px]">
              v{health.version}
            </Badge>
          )}
        </div>
      )}

      {verify && (
        <p className="mt-2 text-xs text-muted-foreground">
          OpenRouter probe:{" "}
          <span
            className={
              verify.openrouter === "ok"
                ? "text-[var(--success)]"
                : verify.openrouter === "missing"
                  ? "text-muted-foreground"
                  : "text-[var(--warning)]"
            }
          >
            {OPENROUTER_LABEL[verify.openrouter]}
          </span>
        </p>
      )}
    </div>
  );
}
