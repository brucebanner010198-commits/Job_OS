"use client";

import { useState } from "react";
import {
  Flame,
  CheckCircle2,
  Clock,
  ExternalLink,
  Plus,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface SkillGapItem {
  id?: string;
  skill: string;
  category?: string | null;
  frequencyCount: number;
  priority: number;
  status: string; // PLANNED | IN_PROGRESS | COMPLETED
  curriculum?: Array<{ title: string; url: string; resourceType?: string }>;
}

export function SkillGapHeatmap({
  initialGaps,
}: {
  initialGaps: SkillGapItem[];
}) {
  const [gaps, setGaps] = useState<SkillGapItem[]>(initialGaps);
  const [filter, setFilter] = useState<"ALL" | "PLANNED" | "IN_PROGRESS" | "COMPLETED">("ALL");

  const filtered = gaps.filter((g) => (filter === "ALL" ? true : g.status === filter));

  const totalFlagged = gaps.reduce((acc, curr) => acc + curr.frequencyCount, 0);

  const toggleStatus = (skill: string) => {
    setGaps((prev) =>
      prev.map((item) => {
        if (item.skill !== skill) return item;
        const nextStatus =
          item.status === "PLANNED"
            ? "IN_PROGRESS"
            : item.status === "IN_PROGRESS"
              ? "COMPLETED"
              : "PLANNED";
        return { ...item, status: nextStatus };
      }),
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-amber-500" />
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Skill Gap Heatmap & Upskilling Roadmap
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Aggregated from JEV job evaluations. Identifies recurring missing skills and generates targeted learning curricula.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-md bg-muted px-2.5 py-1 font-medium text-foreground">
            {gaps.length} Unique Gaps
          </span>
          <span className="rounded-md bg-amber-500/10 px-2.5 py-1 font-medium text-amber-600 dark:text-amber-400">
            {totalFlagged} Total Demand Hits
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mt-4 flex items-center gap-2">
        {(["ALL", "PLANNED", "IN_PROGRESS", "COMPLETED"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === tab
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {tab.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Heatmap Grid */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
            No skill gaps found in this filter category. Evaluate more jobs to discover trends.
          </div>
        ) : (
          filtered.map((item) => {
            const heatIntensity =
              item.frequencyCount >= 4
                ? "border-rose-500/30 bg-rose-500/5"
                : item.frequencyCount >= 2
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-border bg-card";

            return (
              <div
                key={item.skill}
                className={`relative flex flex-col justify-between rounded-lg border p-3.5 transition-all hover:shadow-md ${heatIntensity}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold capitalize text-foreground">
                      {item.skill}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        item.frequencyCount >= 4
                          ? "border-rose-500 text-rose-600 dark:text-rose-400"
                          : "border-amber-500 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {item.frequencyCount} {item.frequencyCount === 1 ? "job" : "jobs"}
                    </Badge>
                  </div>

                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    <span>Priority {item.priority}</span>
                    <span>•</span>
                    <span className="capitalize">{item.status.toLowerCase().replace("_", " ")}</span>
                  </div>

                  {item.curriculum && item.curriculum.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <div className="text-[11px] font-medium text-foreground">Curated Roadmap:</div>
                      {item.curriculum.map((c, i) => (
                        <a
                          key={i}
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between rounded bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <span className="truncate">{c.title}</span>
                          <ExternalLink className="h-2.5 w-2.5 shrink-0 ml-1" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleStatus(item.skill)}
                    className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    {item.status === "COMPLETED" ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        <span>Mastered</span>
                      </>
                    ) : item.status === "IN_PROGRESS" ? (
                      <>
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        <span>Learning Now</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        <span>Start Learning</span>
                      </>
                    )}
                  </button>

                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(item.skill + " quickstart documentation")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-accent hover:underline flex items-center gap-0.5"
                  >
                    Docs <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
