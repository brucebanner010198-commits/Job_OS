"use client";

import { useState, useTransition } from "react";
import { Plus, ArrowRight, SkipForward, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { addWorkLogAction } from "@/app/actions/journal";
import type { WorkCategory } from "@/lib/journal/types";

export function WeeklyCatchupStep({
  onContinue,
  onSkip,
}: {
  onContinue: () => void;
  onSkip: () => void;
}) {
  const [title, setTitle] = useState("");
  const [project, setProject] = useState("");
  const [tasksDone, setTasksDone] = useState("");
  const [pointOfView, setPointOfView] = useState("");
  const [category, setCategory] = useState<WorkCategory>("FEATURE");
  const [savedCount, setSavedCount] = useState(0);
  const [isPending, startTransition] = useTransition();

  function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !tasksDone.trim()) return;

    startTransition(async () => {
      await addWorkLogAction({
        title: title.trim(),
        project: project.trim() || undefined,
        tasksDone: tasksDone.trim(),
        pointOfView: pointOfView.trim() || undefined,
        category,
      });

      setSavedCount((prev) => prev + 1);
      setTitle("");
      setProject("");
      setTasksDone("");
      setPointOfView("");
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Step 3: Catch-up logger & recent updates</h2>
          <Badge variant="outline" className="text-[10px]">
            Optional / Skippable
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Did you ship something this week or omit recent technical achievements from your uploaded CV? Log it here.
          The system will compile it into high-impact bullets before tailoring job applications.
        </p>
      </div>

      {savedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400">
          <Check className="h-4 w-4 shrink-0" />
          <span>{savedCount} recent achievement{savedCount > 1 ? "s" : ""} logged and queued for your master resume.</span>
        </div>
      )}

      <form onSubmit={handleAddEntry} className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Achievement or Task Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Migrated user auth to passkeys"
              className="text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Project / Company</label>
            <Input
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="e.g. Core Platform / Side Project"
              className="text-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            What was done & technical decisions
          </label>
          <Textarea
            value={tasksDone}
            onChange={(e) => setTasksDone(e.target.value)}
            placeholder="Describe the architectural choices, tools used, and measurable results (e.g. cut latency by 35% with zero regressions)."
            rows={3}
            className="text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Personal point of view or leadership context <span className="text-muted-foreground/60">(optional)</span>
          </label>
          <Input
            value={pointOfView}
            onChange={(e) => setPointOfView(e.target.value)}
            placeholder="e.g. Championed simple HMAC signatures over heavy session databases."
            className="text-xs"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">Category:</span>
            {(["FEATURE", "ARCHITECTURE", "LEADERSHIP", "BUGFIX"] as WorkCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`rounded px-2 py-0.5 text-[10px] uppercase transition-colors ${
                  category === cat
                    ? "bg-primary text-primary-foreground font-medium"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={isPending || !title.trim() || !tasksDone.trim()}
            className="gap-1.5 text-xs"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Save log entry
          </Button>
        </div>
      </form>

      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onSkip}
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <SkipForward className="h-3.5 w-3.5" />
          Skip this step
        </Button>

        <Button
          type="button"
          onClick={onContinue}
          className="gap-2 text-xs"
        >
          Proceed to Career Vision & Goals
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
