"use client";

import { Mail, ShieldCheck, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function DedicatedEmailNotice() {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium text-xs text-foreground uppercase tracking-wider">
          <Mail className="h-4 w-4 text-primary" />
          <span>Dedicated Job Search Email Recommendation</span>
        </div>
        <Badge variant="outline" className="text-[10px] gap-1">
          <ShieldCheck className="h-3 w-3 text-emerald-500" /> Privacy First
        </Badge>
      </div>

      <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
        <p>
          We strongly recommend connecting an email address used <strong>exclusively for your job applications</strong> (e.g.{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-foreground font-mono text-[11px]">yourname.career@gmail.com</code>).
        </p>
        <p>
          This ensures that the automated email synchronization checks only job-related correspondence (such as interview
          invites, recruiter responses, and rejection notices) and completely separates your personal messages.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-background/60 p-2.5 text-[11px] text-muted-foreground border border-border/50">
        <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
        <span>
          <strong>Data Usage Disclosure:</strong> The system will use your specified candidate name, email address, and
          master profile credentials solely to search for matching positions, prepare tailored applications, and track your
          recruiter correspondence on your behalf.
        </span>
      </div>
    </div>
  );
}
