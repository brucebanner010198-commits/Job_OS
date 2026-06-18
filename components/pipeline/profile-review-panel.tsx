"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Check, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  compileOnboardingPreviewAction,
  completeOnboardingAction,
} from "@/app/actions/onboarding";
import type {
  CoachingTurn,
  CompiledProfile,
  OnboardingPath,
} from "@/lib/onboarding/types";
import type { CareerGoalData } from "@/lib/goals/types";

export function ProfileReviewPanel({
  path,
  turns,
  initialPaste,
  resumeText,
  skipCoaching,
  onBack,
}: {
  path: OnboardingPath;
  turns: CoachingTurn[];
  initialPaste?: string;
  resumeText?: string;
  skipCoaching?: boolean;
  onBack: () => void;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<CompiledProfile | null>(null);
  const [goals, setGoals] = useState<CareerGoalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const preview = await compileOnboardingPreviewAction({
          path,
          turns,
          initialPaste,
          resumeText,
        });
        if (!cancelled) {
          setProfile(preview.profile);
          setGoals(preview.goals);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to compile profile.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path, turns, initialPaste, resumeText]);

  function save() {
    setError(null);
    setSaving(true);
    startTransition(async () => {
      try {
        await completeOnboardingAction({
          path,
          turns,
          initialPaste,
          resumeText,
          skipCoaching,
        });
        setDone(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save profile.");
      } finally {
        setSaving(false);
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Compiling your profile…
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
          <Check className="h-6 w-6 text-success" />
        </div>
        <h2 className="text-lg font-medium">Profile saved</h2>
        <p className="text-sm text-muted-foreground">
          Your master profile and career goals are ready. Autopilot can start searching for roles.
        </p>
        {skipCoaching && (
          <p className="flex items-center justify-center gap-1 text-sm text-[var(--warning)]">
            <AlertCircle className="h-4 w-4" />
            Coaching was skipped — some goals may be incomplete.
          </p>
        )}
        <Link href="/jobs">
          <Button variant="accent" className="gap-2">
            Start searching
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {skipCoaching && (
        <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/5 p-3 text-sm">
          <p className="font-medium">Partial setup</p>
          <p className="mt-1 text-muted-foreground">
            Coaching was skipped. Goals and gaps may be incomplete — you can refine them later.
          </p>
        </div>
      )}

      {profile && (
        <div>
          <h3 className="text-sm font-medium">
            Profile entries ({profile.entries.length})
          </h3>
          {profile.unconfirmedCount > 0 && (
            <p className="mt-1 text-xs text-[var(--warning)]">
              {profile.unconfirmedCount} field(s) flagged as unconfirmed — review in Master Resume.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile.entries.slice(0, 20).map((e, i) => (
              <Badge key={i} variant="muted" className="text-xs">
                {e.title}
                {e.data.inferred && " *"}
                <span className="ml-1 opacity-50">({e.provenance})</span>
              </Badge>
            ))}
            {profile.entries.length > 20 && (
              <Badge variant="muted" className="text-xs">
                +{profile.entries.length - 20} more
              </Badge>
            )}
          </div>
        </div>
      )}

      {goals && (
        <div>
          <h3 className="text-sm font-medium">Career goals</h3>
          <p className="mt-1 text-sm text-muted-foreground">{goals.northStar}</p>
          {goals.targetTitles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {goals.targetTitles.map((t, i) => (
                <Badge key={i} variant="muted">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
        <Button variant="ghost" onClick={onBack}>
          Back to coaching
        </Button>
        <Button variant="accent" onClick={save} disabled={saving} className="gap-2">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              Save profile
              <Check className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
