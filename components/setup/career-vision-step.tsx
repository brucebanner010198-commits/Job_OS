"use client";

import { useState, useEffect, useTransition } from "react";
import { Sparkles, Target, Building2, Sliders, Check, ArrowRight, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  getRoleRecommendationsAction,
  saveVisionAndGoalsAction,
  type RoleRecommendation,
} from "@/app/actions/setup-goals";

export function CareerVisionStep({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [recommendations, setRecommendations] = useState<RoleRecommendation[]>([]);
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [customTitle, setCustomTitle] = useState("");
  const [northStarVision, setNorthStarVision] = useState("");
  const [ambitionLevel, setAmbitionLevel] = useState("lead");
  const [targetCompanies, setTargetCompanies] = useState<string[]>(["Google", "Stripe", "Apple"]);
  const [customCompany, setCustomCompany] = useState("");
  const [maxDailyApplications, setMaxDailyApplications] = useState(5);
  const [searchCadenceDays, setSearchCadenceDays] = useState(1);
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getRoleRecommendationsAction()
      .then((res) => {
        setRecommendations(res.recommendations);
        if (res.recommendations.length > 0) {
          setSelectedTitles([res.recommendations[0].title]);
        }
      })
      .finally(() => setLoadingRecs(false));
  }, []);

  function toggleTitle(title: string) {
    if (selectedTitles.includes(title)) {
      setSelectedTitles(selectedTitles.filter((t) => t !== title));
    } else {
      setSelectedTitles([...selectedTitles, title]);
    }
  }

  function handleAddCustomTitle(e: React.FormEvent) {
    e.preventDefault();
    if (!customTitle.trim()) return;
    if (!selectedTitles.includes(customTitle.trim())) {
      setSelectedTitles([...selectedTitles, customTitle.trim()]);
    }
    setCustomTitle("");
  }

  function handleAddCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!customCompany.trim()) return;
    if (!targetCompanies.includes(customCompany.trim())) {
      setTargetCompanies([...targetCompanies, customCompany.trim()]);
    }
    setCustomCompany("");
  }

  function handleRemoveCompany(comp: string) {
    setTargetCompanies(targetCompanies.filter((c) => c !== comp));
  }

  function handleSubmit() {
    if (selectedTitles.length === 0) return;

    startTransition(async () => {
      await saveVisionAndGoalsAction({
        targetTitles: selectedTitles,
        northStarVision: northStarVision.trim() || `Reach ${ambitionLevel.toUpperCase()} leadership`,
        ambitionLevel,
        targetCompanies,
        maxDailyApplications,
        searchCadenceDays,
      });
      onComplete();
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Step 4: Career vision & target roles</h2>
        <p className="text-xs text-muted-foreground">
          Based on your up-to-date resume analysis, here are role recommendations. You can override or customize them,
          and define your long-term career ambition.
        </p>
      </div>

      {/* Recommended Roles */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>AI Role Recommendations (Override enabled)</span>
          </div>
          {loadingRecs && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Analyzing resume...
            </span>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {recommendations.map((rec) => {
            const active = selectedTitles.includes(rec.title);
            return (
              <button
                key={rec.title}
                type="button"
                onClick={() => toggleTitle(rec.title)}
                className={`flex flex-col items-start rounded-lg border p-3 text-left transition-all ${
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/20"
                }`}
              >
                <div className="flex w-full items-center justify-between font-medium text-xs">
                  <span>{rec.title}</span>
                  <Badge variant={active ? "success" : "outline"} className="text-[10px]">
                    {rec.matchScore}% fit
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                  {rec.rationale}
                </p>
              </button>
            );
          })}
        </div>

        {/* Custom Role Override */}
        <form onSubmit={handleAddCustomTitle} className="flex gap-2 pt-2">
          <Input
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="Add custom target role override (e.g. Security Team Lead)"
            className="text-xs"
          />
          <Button type="submit" size="sm" variant="outline" className="gap-1 text-xs shrink-0">
            <Plus className="h-3.5 w-3.5" /> Add role
          </Button>
        </form>

        {selectedTitles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-xs text-muted-foreground self-center mr-1">Active targets:</span>
            {selectedTitles.map((title) => (
              <Badge key={title} variant="default" className="text-xs gap-1 py-1">
                {title}
                <X className="h-3 w-3 cursor-pointer hover:opacity-75" onClick={() => toggleTitle(title)} />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Long-term Career Vision & Ambition */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Target className="h-4 w-4 text-primary" />
          <span>Long-Term Ambition & Leadership Goal</span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { id: "lead", label: "Team Lead / Staff" },
            { id: "architect", label: "Principal Architect" },
            { id: "coo", label: "VP / COO" },
            { id: "ceo", label: "Founder / CEO" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setAmbitionLevel(item.id)}
              className={`rounded-lg border p-2.5 text-center text-xs transition-all ${
                ambitionLevel === item.id
                  ? "border-primary bg-primary text-primary-foreground font-medium"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Personal Career Vision Statement
          </label>
          <Textarea
            value={northStarVision}
            onChange={(e) => setNorthStarVision(e.target.value)}
            placeholder="e.g. Lead high-impact distributed AI platforms, scale engineering culture, and drive architectural strategy across globally distributed teams."
            rows={2}
            className="text-xs"
          />
        </div>

        {/* Target Companies */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Target Companies / Dream Workplaces
          </label>
          <div className="flex flex-wrap gap-1.5">
            {targetCompanies.map((comp) => (
              <Badge key={comp} variant="outline" className="gap-1 text-xs">
                <Building2 className="h-3 w-3 text-muted-foreground" />
                {comp}
                <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => handleRemoveCompany(comp)} />
              </Badge>
            ))}
          </div>
          <form onSubmit={handleAddCompany} className="flex gap-2">
            <Input
              value={customCompany}
              onChange={(e) => setCustomCompany(e.target.value)}
              placeholder="Add specific target company (e.g. Anthropic, Datadog)"
              className="text-xs"
            />
            <Button type="submit" size="sm" variant="outline" className="text-xs shrink-0">
              Add company
            </Button>
          </form>
        </div>
      </div>

      {/* Cadence & Application Quotas */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Sliders className="h-4 w-4 text-primary" />
          <span>Automation Cadence & Limits</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 text-xs">
          <div className="space-y-1.5">
            <label className="font-medium text-muted-foreground">Max Applications Per Day</label>
            <Input
              type="number"
              min={1}
              max={25}
              value={maxDailyApplications}
              onChange={(e) => setMaxDailyApplications(parseInt(e.target.value, 10) || 5)}
              className="text-xs"
            />
            <p className="text-[11px] text-muted-foreground">Maintains high quality tailoring without triggering recruiter spam filters.</p>
          </div>

          <div className="space-y-1.5">
            <label className="font-medium text-muted-foreground">Job Discovery Frequency</label>
            <select
              value={searchCadenceDays}
              onChange={(e) => setSearchCadenceDays(parseInt(e.target.value, 10) || 1)}
              className="w-full rounded-md border border-border bg-background p-2 text-xs focus:outline-none"
            >
              <option value={1}>Daily catch-up (Every 24 hours)</option>
              <option value={2}>Every 2 days</option>
              <option value={7}>Weekly pulse (Every 7 days)</option>
            </select>
            <p className="text-[11px] text-muted-foreground">How frequently autopilot crawls and scores fresh job postings.</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSubmit}
          disabled={isPending || selectedTitles.length === 0}
          className="gap-2"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Finalizing Setup & Launching Career OS...
            </>
          ) : (
            <>
              Complete Setup & Start Career Engine
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
