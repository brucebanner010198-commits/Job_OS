"use client";

import { useState, useTransition } from "react";
import {
  Sparkles,
  CheckCircle2,
  Calendar,
  Layers,
  Plus,
  Trash2,
  TrendingUp,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { WorkLogEntry, CandidateBullet } from "@prisma/client";
import type { WorkCategory } from "@/lib/journal/types";
import {
  addWorkLogAction,
  deleteWorkLogAction,
  compileWeeklyJournalAction,
  approveCandidateBulletAction,
} from "@/app/actions/journal";

export type CandidateBulletWithSource = CandidateBullet & {
  workLogEntry?: WorkLogEntry | null;
};

export function JournalWorkspace({
  initialLogs,
  initialBullets,
}: {
  initialLogs: WorkLogEntry[];
  initialBullets: CandidateBulletWithSource[];
}) {
  const [logs, setLogs] = useState(initialLogs);
  const [bullets, setBullets] = useState(initialBullets);
  const [isPending, startTransition] = useTransition();
  const [isCompiling, startCompiling] = useTransition();

  // Form states
  const [title, setTitle] = useState("");
  const [project, setProject] = useState("");
  const [tasksDone, setTasksDone] = useState("");
  const [pointOfView, setPointOfView] = useState("");
  const [category, setCategory] = useState("FEATURE");
  const [metricsStr, setMetricsStr] = useState("");

  const uncompiledLogs = logs.filter((l) => !l.compiled);

  const handleAddLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !tasksDone.trim()) return;

    const metrics = metricsStr
      ? metricsStr.split(",").map((m) => {
          const [label, delta] = m.split(":").map((s) => s.trim());
          return { label: label || "Impact", delta: delta || label };
        })
      : [];

    startTransition(async () => {
      const newEntry = await addWorkLogAction({
        title,
        project,
        tasksDone,
        pointOfView,
        category: category as WorkCategory,
        metrics,
      });
      setLogs([newEntry, ...logs]);
      setTitle("");
      setProject("");
      setTasksDone("");
      setPointOfView("");
      setMetricsStr("");
    });
  };

  const handleCompile = () => {
    startCompiling(async () => {
      const res = await compileWeeklyJournalAction();
      if (res.bullets) {
        setBullets([...res.bullets, ...bullets]);
        setLogs(logs.map((l) => ({ ...l, compiled: true })));
      }
    });
  };

  const handleApproveBullet = (bulletId: string) => {
    startTransition(async () => {
      await approveCandidateBulletAction(bulletId);
      setBullets(
        bullets.map((b) => (b.id === bulletId ? { ...b, approved: true } : b)),
      );
    });
  };

  const handleDeleteLog = (id: string) => {
    startTransition(async () => {
      await deleteWorkLogAction(id);
      setLogs(logs.filter((l) => l.id !== id));
    });
  };

  return (
    <div className="space-y-8">
      {/* Weekly compilation callout */}
      <Card className="border-accent/30 bg-accent/5">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              Weekly master CV compilation
            </CardTitle>
            <CardDescription>
              {uncompiledLogs.length > 0
                ? `${uncompiledLogs.length} work logs waiting to be compiled into master CV bullets.`
                : "All work logs are compiled. Keep logging your daily wins."}
            </CardDescription>
          </div>
          <Button
            onClick={handleCompile}
            disabled={uncompiledLogs.length === 0 || isCompiling}
            className="gap-2"
          >
            {isCompiling ? (
              "Compiling..."
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Compile to master CV
              </>
            )}
          </Button>
        </CardHeader>
      </Card>

      {/* Candidate bullets review queue */}
      {bullets.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-accent" />
            Master CV candidate bullets ({bullets.filter((b) => !b.approved).length} pending approval)
          </h2>
          <div className="grid gap-3">
            {bullets.map((bullet) => (
              <Card
                key={bullet.id}
                className={bullet.approved ? "opacity-60 bg-muted/20" : "border-border"}
              >
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-mono">
                        {bullet.suggestedKind}
                      </Badge>
                      {bullet.impactClaim && (
                        <span className="text-xs text-muted-foreground font-medium">
                          {bullet.impactClaim}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium leading-relaxed">
                      {bullet.bulletText}
                    </p>
                    {bullet.workLogEntry && (
                      <p className="text-xs text-muted-foreground">
                        Source: {bullet.workLogEntry.title} ({new Date(bullet.workLogEntry.date).toLocaleDateString()})
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {bullet.approved ? (
                      <Badge variant="muted" className="gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        In master CV
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleApproveBullet(bullet.id)}
                        disabled={isPending}
                        className="gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Approve & add to CV
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Dual column: Log entry form & Log history */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left pane: New entry */}
        <div className="lg:col-span-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-accent" />
                Log daily work
              </CardTitle>
              <CardDescription>
                Document what you built, technical decisions, and your personal point of view.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddLog} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Title / Milestone</label>
                  <Input
                    placeholder="e.g. Migrated user auth service to JWT + refresh tokens"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Project (optional)</label>
                    <Input
                      placeholder="e.g. Payments Engine"
                      value={project}
                      onChange={(e) => setProject(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Category</label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="FEATURE">Feature development</option>
                      <option value="ARCHITECTURE">Architecture & design</option>
                      <option value="BUGFIX">Bugfix / reliability</option>
                      <option value="LEADERSHIP">Leadership & mentoring</option>
                      <option value="PROCESS">Process / CI/CD</option>
                      <option value="LEARNING">New skill / training</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    What did you accomplish today?
                  </label>
                  <Textarea
                    placeholder="Implemented token rotation, added distributed redis blacklist for instant revocation, and updated integration tests."
                    rows={3}
                    value={tasksDone}
                    onChange={(e) => setTasksDone(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Point of view & rationale (Why this way? What did you learn?)
                  </label>
                  <Textarea
                    placeholder="Chose Redis bloom filter over direct SQL queries to keep token lookup under 2ms without degrading primary DB."
                    rows={2}
                    value={pointOfView}
                    onChange={(e) => setPointOfView(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Quantified metrics or proof (comma-separated, e.g. Latency: -35ms, PR: #89)
                  </label>
                  <Input
                    placeholder="Latency: -35ms, Coverage: +12%"
                    value={metricsStr}
                    onChange={(e) => setMetricsStr(e.target.value)}
                  />
                </div>

                <Button type="submit" disabled={isPending} className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Save work log
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right pane: Log timeline */}
        <div className="lg:col-span-6 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Recent work logs ({logs.length})
          </h3>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {logs.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                No work logs yet. Record today&apos;s tasks on the left to start building your up-to-date career history.
              </div>
            ) : (
              logs.map((log) => (
                <Card key={log.id} className="text-sm">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{log.title}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {log.category}
                          </Badge>
                        </div>
                        {log.project && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Layers className="h-3 w-3" />
                            {log.project}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.date).toLocaleDateString()}
                        </span>
                        <button
                          onClick={() => handleDeleteLog(log.id)}
                          className="text-muted-foreground hover:text-destructive p-1 rounded"
                          title="Delete entry"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-foreground/90 leading-relaxed">
                      {log.tasksDone}
                    </p>

                    {log.pointOfView && (
                      <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border border-border/50 italic">
                        &ldquo;{log.pointOfView}&rdquo;
                      </p>
                    )}

                    {Array.isArray(log.metrics) && log.metrics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {(log.metrics as unknown as { label?: string; delta?: string }[]).map((m, idx: number) => (
                          <Badge key={idx} variant="muted" className="text-[10px] gap-1">
                            <TrendingUp className="h-2.5 w-2.5" />
                            {m.label}: {m.delta}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
