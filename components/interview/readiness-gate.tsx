"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, Building2, CheckCircle2, Circle, Lock } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReadinessGateProps {
  company: string;
  hasStudyGuide: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Soft gate before voice interview modes - requires brief + study guide acknowledgment.
 * Counter to generic interview bots with no company context.
 */
export function ReadinessGate({
  company,
  hasStudyGuide,
  children,
  className,
}: ReadinessGateProps) {
  const [briefAck, setBriefAck] = useState(false);
  const [studyAck, setStudyAck] = useState(hasStudyGuide);

  const ready = briefAck && studyAck && hasStudyGuide;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-lg border border-border bg-background p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Interview readiness
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start justify-between gap-2">
            <span className="flex items-center gap-2">
              {briefAck ? (
                <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              Company brief reviewed
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/companies"
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                Open brief
              </Link>
              {!briefAck && (
                <Button size="sm" variant="ghost" onClick={() => setBriefAck(true)}>
                  Mark done
                </Button>
              )}
            </div>
          </li>
          <li className="flex items-start justify-between gap-2">
            <span className="flex items-center gap-2">
              {studyAck && hasStudyGuide ? (
                <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
              Study guide for {company}
            </span>
            {!hasStudyGuide ? (
              <span className="text-xs text-muted-foreground">Generate study tab first</span>
            ) : !studyAck ? (
              <Button size="sm" variant="ghost" onClick={() => setStudyAck(true)}>
                Mark reviewed
              </Button>
            ) : null}
          </li>
        </ul>
      </div>

      {ready ? (
        children
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <Lock className="h-4 w-4 shrink-0" />
          Voice practice unlocks when you&apos;ve reviewed the company brief and study
          guide - role-specific prep, not a generic bot.
        </div>
      )}
    </div>
  );
}
