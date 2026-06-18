"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Sparkles,
  Lightbulb,
  Save,
  Check,
  ArrowUp,
  ArrowDown,
  Minus,
  Target,
  TrendingUp,
} from "lucide-react";
import { VoiceInput } from "@/components/dictation/voice-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  HORIZONS,
  HORIZON_LABEL,
  goalText,
  normalizeMilestones,
  type CareerGoalData,
  type Milestone,
} from "@/lib/goals/types";
import { goalAwareRelevance, axisSimilarity } from "@/lib/scoring/relevance";
import { SAMPLE_ROLES } from "@/lib/scoring/sample-roles";
import {
  suggestQuestionsAction,
  synthesizeGoalsAction,
  saveGoalsAction,
} from "@/app/actions/goals";

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

function parseList(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

const EMPTY_MILESTONES = (): Milestone[] =>
  HORIZONS.map((h) => ({ horizon: h, text: "" }));

export function GoalsWorkspace({
  initialGoal,
  resumeText,
  compact = false,
}: {
  initialGoal: CareerGoalData | null;
  resumeText: string;
  compact?: boolean;
}) {
  const router = useRouter();

  const [note, setNote] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [loadingQ, setLoadingQ] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(Boolean(initialGoal));
  const [showImpact, setShowImpact] = useState(false);

  // Editable fields (working copy).
  const [northStar, setNorthStar] = useState(initialGoal?.northStar ?? "");
  const [summary, setSummary] = useState(initialGoal?.summary ?? "");
  const [titlesText, setTitlesText] = useState(
    initialGoal?.targetTitles.join(", ") ?? "",
  );
  const [industriesText, setIndustriesText] = useState(
    initialGoal?.targetIndustries.join(", ") ?? "",
  );
  const [milestones, setMilestones] = useState<Milestone[]>(
    initialGoal ? normalizeMilestones(initialGoal.milestones) : EMPTY_MILESTONES(),
  );

  const [saving, startSave] = useTransition();

  const currentGoal: CareerGoalData = useMemo(
    () => ({
      northStar: northStar.trim(),
      summary: summary.trim(),
      targetTitles: parseList(titlesText),
      targetIndustries: parseList(industriesText),
      milestones,
    }),
    [northStar, summary, titlesText, industriesText, milestones],
  );

  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify(initialGoal ? currentGoalSnapshot(initialGoal) : null),
  );
  const dirty =
    JSON.stringify(currentGoalSnapshot(currentGoal)) !== savedSnapshot;

  const hasContent =
    currentGoal.northStar !== "" ||
    currentGoal.targetTitles.length > 0 ||
    currentGoal.milestones.some((m) => m.text.trim());

  function setMilestone(i: number, patch: Partial<Milestone>) {
    setMilestones((prev) =>
      prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)),
    );
  }

  function suggest() {
    setError(null);
    setLoadingQ(true);
    suggestQuestionsAction()
      .then(setQuestions)
      .catch((e) => setError(msg(e)))
      .finally(() => setLoadingQ(false));
  }

  function organize() {
    setError(null);
    setSynthesizing(true);
    synthesizeGoalsAction(note)
      .then((g) => {
        setNorthStar(g.northStar);
        setSummary(g.summary);
        setTitlesText(g.targetTitles.join(", "));
        setIndustriesText(g.targetIndustries.join(", "));
        setMilestones(normalizeMilestones(g.milestones));
        setShowEditor(true);
        setShowImpact(true);
      })
      .catch((e) => setError(msg(e)))
      .finally(() => setSynthesizing(false));
  }

  function save() {
    setError(null);
    startSave(async () => {
      try {
        await saveGoalsAction(currentGoal, note);
        setSavedSnapshot(JSON.stringify(currentGoalSnapshot(currentGoal)));
        router.refresh();
      } catch (e) {
        setError(msg(e));
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Capture panel */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-medium">Where do you want your career to go?</h2>
        <p className="mb-3 mt-0.5 text-sm text-muted-foreground">
          Speak or type freely - the title you&apos;re aiming for, the kind of
          work that energizes you, where you want to be in 5–10 years. The AI
          organizes it into a long-term goal and milestones. Nothing is invented.
        </p>

        <VoiceInput
          value={note}
          onChange={setNote}
          rows={5}
          placeholder="e.g. In 10 years I want to be a VP of Engineering at a climate-tech company. Near term I want to move from senior IC into managing a small backend team, then lead a platform org…"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            onClick={organize}
            disabled={synthesizing || note.trim().length < 12}
            variant="accent"
          >
            {synthesizing ? (
              <>
                <Loader2 className="animate-spin" /> Organizing…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Organize into goals
              </>
            )}
          </Button>
          <Button onClick={suggest} disabled={loadingQ} variant="ghost" size="sm">
            {loadingQ ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lightbulb className="h-4 w-4" />
            )}
            Not sure? Ask me questions
          </Button>
          {!showEditor && (
            <button
              type="button"
              onClick={() => setShowEditor(true)}
              className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              or fill them in manually
            </button>
          )}
        </div>

        {questions.length > 0 && (
          <ul className="mt-4 space-y-1.5 rounded-lg border border-border bg-background p-3 text-sm">
            {questions.map((q, i) => (
              <li key={i} className="flex gap-2 text-muted-foreground">
                <span className="text-accent">•</span>
                {q}
              </li>
            ))}
          </ul>
        )}

        {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
      </div>

      {/* Editor */}
      {showEditor && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium">Your plan</h2>
            <div className="flex items-center gap-2">
              {dirty ? (
                <span className="text-xs text-muted-foreground">
                  Unsaved changes
                </span>
              ) : initialGoal || !hasContent ? null : (
                <span className="flex items-center gap-1 text-xs text-[var(--success)]">
                  <Check className="h-3 w-3" /> Saved
                </span>
              )}
              <Button onClick={save} disabled={saving || !hasContent || !dirty}>
                {saving ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />}
                Save goals
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="northStar" className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-accent" /> Long-term goal (the fixed end goal)
              </Label>
              <Input
                id="northStar"
                value={northStar}
                onChange={(e) => setNorthStar(e.target.value)}
                placeholder="e.g. VP of Engineering at a mission-driven climate company"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="summary">Direction (one paragraph)</Label>
              <textarea
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
                placeholder="The overall arc of where you're headed and why."
                className="mt-1 w-full resize-y rounded-lg border border-border bg-card p-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="titles">Target roles</Label>
                <Input
                  id="titles"
                  value={titlesText}
                  onChange={(e) => setTitlesText(e.target.value)}
                  placeholder="Engineering Manager, Staff Engineer"
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Comma-separated. These steer your job matches the most.
                </p>
              </div>
              <div>
                <Label htmlFor="industries">Target industries</Label>
                <Input
                  id="industries"
                  value={industriesText}
                  onChange={(e) => setIndustriesText(e.target.value)}
                  placeholder="climate, fintech, developer tools"
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Comma-separated domains or sectors.
                </p>
              </div>
            </div>

            <div>
              <Label>Milestones (6 months → 10 years)</Label>
              <div className="mt-1.5 space-y-2">
                {milestones.map((m, i) => (
                  <div
                    key={m.horizon}
                    className="grid grid-cols-[5.5rem_1fr] items-start gap-3 rounded-lg border border-border bg-background p-2.5"
                  >
                    <div className="pt-2 text-xs font-medium text-muted-foreground">
                      {HORIZON_LABEL[m.horizon]}
                      {m.inferred && (
                        <Badge variant="muted" className="mt-1 block w-fit">
                          suggested
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Input
                        value={m.text}
                        onChange={(e) =>
                          setMilestone(i, { text: e.target.value, inferred: false })
                        }
                        placeholder={`What does "done" look like at ${HORIZON_LABEL[m.horizon]}?`}
                      />
                      <Input
                        value={m.metric ?? ""}
                        onChange={(e) => setMilestone(i, { metric: e.target.value })}
                        placeholder="Measurable marker (optional) - e.g. lead a team of 5"
                        className="text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live impact preview - proves goals re-rank matches */}
      {!compact && hasContent && (
        <div className="rounded-xl border border-border bg-card p-5">
          <button
            type="button"
            onClick={() => setShowImpact((s) => !s)}
            className="flex w-full items-center justify-between text-left"
          >
            <h2 className="flex items-center gap-2 font-medium">
              <TrendingUp className="h-4 w-4 text-accent" /> How your goals change
              your matches
            </h2>
            <span className="text-xs text-muted-foreground">
              {showImpact ? "Hide" : "Show"}
            </span>
          </button>

          {showImpact && (
            <ImpactPreview goal={currentGoal} resumeText={resumeText} />
          )}
        </div>
      )}
    </div>
  );
}

/** Only the fields that affect persistence/scoring - for dirty-checking. */
function currentGoalSnapshot(g: CareerGoalData) {
  return {
    northStar: g.northStar,
    summary: g.summary,
    targetTitles: g.targetTitles,
    targetIndustries: g.targetIndustries,
    milestones: g.milestones
      .filter((m) => m.text.trim())
      .map((m) => ({ horizon: m.horizon, text: m.text.trim(), metric: m.metric ?? "" })),
  };
}

const DRIVER_LABEL: Record<string, string> = {
  resume: "via your history",
  goals: "via your goals",
  both: "both",
};

function ImpactPreview({
  goal,
  resumeText,
}: {
  goal: CareerGoalData;
  resumeText: string;
}) {
  const rows = useMemo(() => {
    const axis = goalText(goal);
    const scored = SAMPLE_ROLES.map((role) => {
      const resumeOnly = axisSimilarity(role.text, resumeText);
      const ga = goalAwareRelevance(role.text, {
        resumeText,
        goalText: axis,
      });
      return { role, resumeOnly, ...ga };
    });
    const byResume = [...scored].sort((a, b) => b.resumeOnly - a.resumeOnly);
    const byGoal = [...scored].sort((a, b) => b.relevance - a.relevance);
    const resumeRank = new Map(byResume.map((r, i) => [r.role.title, i]));
    return byGoal.map((r, i) => ({
      ...r,
      delta: (resumeRank.get(r.role.title) ?? i) - i, // + = moved up with goals
    }));
  }, [goal, resumeText]);

  return (
    <div className="mt-4">
      <p className="mb-3 text-xs text-muted-foreground">
        Illustrative roles, ranked with your goals applied. Movement is versus a
        history-only ranking - proof your goals re-order what surfaces. The real
        engine scores live postings in Phase 3.
        {!resumeText && (
          <>
            {" "}
            Add to your master resume to sharpen the history axis.
          </>
        )}
      </p>
      <ol className="space-y-1.5">
        {rows.map((r) => (
          <li
            key={r.role.title}
            className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2"
          >
            <Movement delta={r.delta} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{r.role.title}</div>
              <div className="truncate text-xs text-muted-foreground">
                {r.role.company}
              </div>
            </div>
            <Badge
              variant={r.drivenBy === "goals" ? "success" : "muted"}
              className="shrink-0"
            >
              {DRIVER_LABEL[r.drivenBy]}
            </Badge>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {Math.round(r.relevance * 100)}%
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Movement({ delta }: { delta: number }) {
  if (delta > 0)
    return (
      <span
        className="flex items-center gap-0.5 text-xs text-[var(--success)]"
        title={`Up ${delta} with your goals`}
      >
        <ArrowUp className="h-3.5 w-3.5" />
        {delta}
      </span>
    );
  if (delta < 0)
    return (
      <span
        className="flex items-center gap-0.5 text-xs text-muted-foreground"
        title={`Down ${-delta} with your goals`}
      >
        <ArrowDown className="h-3.5 w-3.5" />
        {-delta}
      </span>
    );
  return (
    <span className="text-muted-foreground/50" title="No change">
      <Minus className="h-3.5 w-3.5" />
    </span>
  );
}
