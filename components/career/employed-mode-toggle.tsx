"use client";

import { useState } from "react";
import { Briefcase, TrendingUp, Award, Target, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function EmployedModeWidget({
  currentStatus = "HUNTING",
  currentCompany,
  currentRole,
}: {
  currentStatus?: "HUNTING" | "EMPLOYED";
  currentCompany?: string;
  currentRole?: string;
}) {
  const [status, setStatus] = useState<"HUNTING" | "EMPLOYED">(currentStatus);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          {status === "EMPLOYED" ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <Award className="h-4 w-4" />
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Briefcase className="h-4 w-4" />
            </div>
          )}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Career Mode: {status === "EMPLOYED" ? "Employed & Growing Internally" : "Active Job Search Engine"}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {status === "EMPLOYED"
                ? `Tracking promotion milestones and quarterly impact at ${currentCompany || "your company"}.`
                : "Autopilot is actively crawling, scoring, and preparing applications."}
            </p>
          </div>
        </div>

        <div className="flex rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setStatus("HUNTING")}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              status === "HUNTING"
                ? "bg-background text-foreground font-medium shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Job Hunting
          </button>
          <button
            type="button"
            onClick={() => setStatus("EMPLOYED")}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              status === "EMPLOYED"
                ? "bg-background text-foreground font-medium shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Employed / Growth
          </button>
        </div>
      </div>

      {status === "EMPLOYED" ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">Promotion &amp; Leadership Trajectory:</span>
              <Badge variant="success" className="text-[10px]">
                On Track for Next Level
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Use your daily work journal to log architectural designs, cross-team impact, and peer mentorship.
              These compile into ready-to-present promotion dossiers for your performance reviews.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 text-xs">
            <Link
              href="/journal"
              className="flex flex-col justify-between rounded-lg border border-border bg-muted/20 p-3 hover:bg-muted/40 transition-colors"
            >
              <div className="font-medium text-foreground">Log Daily Impact</div>
              <p className="text-[11px] text-muted-foreground mt-1">Capture technical wins and point of view.</p>
              <div className="flex items-center gap-1 text-[11px] text-primary mt-2 font-medium">
                Open work logger →
              </div>
            </Link>

            <Link
              href="/goals"
              className="flex flex-col justify-between rounded-lg border border-border bg-muted/20 p-3 hover:bg-muted/40 transition-colors"
            >
              <div className="font-medium text-foreground">Leadership Milestones</div>
              <p className="text-[11px] text-muted-foreground mt-1">Quarterly targets toward Staff/Executive.</p>
              <div className="flex items-center gap-1 text-[11px] text-primary mt-2 font-medium">
                View career goals →
              </div>
            </Link>

            <Link
              href="/master-resume"
              className="flex flex-col justify-between rounded-lg border border-border bg-muted/20 p-3 hover:bg-muted/40 transition-colors"
            >
              <div className="font-medium text-foreground">Continuous Master CV</div>
              <p className="text-[11px] text-muted-foreground mt-1">Keep credentials and certs fresh.</p>
              <div className="flex items-center gap-1 text-[11px] text-primary mt-2 font-medium">
                Manage master CV →
              </div>
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/20 p-3 rounded-lg">
          <span>Active target positions set. All compiled master CV updates will dynamically tailor future applications.</span>
          <Link href="/jobs" className="text-primary hover:underline font-medium shrink-0 ml-2">
            View Job Queue →
          </Link>
        </div>
      )}
    </div>
  );
}
