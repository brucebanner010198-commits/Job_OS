"use client";

import { useMemo, useState, useTransition } from "react";
import { Building2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  mergeDreamCompanySuggestions,
  suggestDreamCompanies,
  type DreamCompany,
} from "@/lib/goals/dream-companies";
import type { CareerGoalData } from "@/lib/goals/types";
import { saveDreamCompaniesAction } from "@/app/actions/dream-companies";
import Link from "next/link";

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

export function DreamCompanyBoard({
  initialCompanies,
  goal,
}: {
  initialCompanies: DreamCompany[];
  goal: CareerGoalData | null;
}) {
  const [companies, setCompanies] = useState<DreamCompany[]>(initialCompanies);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const suggestions = useMemo(
    () => (goal ? suggestDreamCompanies(goal) : []),
    [goal],
  );

  const unsuggested = suggestions.filter(
    (s) => !companies.some((c) => c.name.toLowerCase() === s.toLowerCase()),
  );

  function addCompany(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (companies.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return;
    setCompanies((prev) => [
      ...prev,
      { name: trimmed, priority: prev.length + 1 },
    ]);
    setNewName("");
    setSaved(false);
  }

  function removeCompany(name: string) {
    setCompanies((prev) =>
      prev
        .filter((c) => c.name !== name)
        .map((c, i) => ({ ...c, priority: i + 1 })),
    );
    setSaved(false);
  }

  function applySuggestions() {
    setCompanies((prev) => mergeDreamCompanySuggestions(prev, suggestions));
    setSaved(false);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await saveDreamCompaniesAction(companies);
        setSaved(true);
      } catch (e) {
        setError(msg(e));
      }
    });
  }

  return (
    <Card className="mt-8">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" />
          Dream company board
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Target employers tied to your goals → brief → gap analysis → tailor → apply.
          HR outreach stays draft-only via{" "}
          <Link href="/warm-path" className="underline underline-offset-2">
            warm-path
          </Link>
          .
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {companies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No dream companies yet.</p>
          ) : (
            companies.map((c) => (
              <Badge key={c.name} variant="muted" className="gap-1 pr-1">
                <span>
                  {c.priority}. {c.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeCompany(c.name)}
                  className="rounded p-0.5 hover:bg-background/60"
                  aria-label={`Remove ${c.name}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Add company (e.g. Stripe)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCompany(newName)}
            className="max-w-xs"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => addCompany(newName)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add
          </Button>
          {unsuggested.length > 0 && goal && (
            <Button type="button" variant="outline" size="sm" onClick={applySuggestions}>
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              Suggest from goals ({unsuggested.length})
            </Button>
          )}
          <Button type="button" variant="accent" size="sm" onClick={save} disabled={pending}>
            <Save className="mr-1 h-3.5 w-3.5" />
            {pending ? "Saving…" : saved ? "Saved" : "Save board"}
          </Button>
        </div>

        {companies.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Next: run a{" "}
            <Link href="/companies" className="underline underline-offset-2">
              company brief
            </Link>{" "}
            for each target, then check gap analysis in{" "}
            <Link href="/training" className="underline underline-offset-2">
              Training
            </Link>
            .
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
