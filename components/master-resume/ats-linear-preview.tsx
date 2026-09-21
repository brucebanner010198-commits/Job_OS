"use client";

import { useState, useMemo } from "react";
import type { ProfileEntry, ProfileEntryKind } from "@prisma/client";
import { CheckCircle2, AlertTriangle, Copy, Check, FileText, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AtsLinearPreviewProps {
  facts: ProfileEntry[];
}

interface LinterResult {
  hasContact: boolean;
  hasExperience: boolean;
  hasEducation: boolean;
  hasSkills: boolean;
  metricDensity: number;
  totalBullets: number;
  metricBullets: number;
  wordCount: number;
  characterCount: number;
}

export function AtsLinearPreview({ facts }: AtsLinearPreviewProps) {
  const [copied, setCopied] = useState(false);

  // Generate linear ATS text stream
  const { linearText, lint } = useMemo(() => {
    const lines: string[] = [];
    const nonSensitiveFacts = facts.filter((f) => !f.sensitive);

    // Group by kind
    const byKind = new Map<ProfileEntryKind, ProfileEntry[]>();
    for (const f of nonSensitiveFacts) {
      const arr = byKind.get(f.kind) ?? [];
      arr.push(f);
      byKind.set(f.kind, arr);
    }

    // 1. Contact Info
    const contactFacts = byKind.get("CONTACT") ?? [];
    if (contactFacts.length > 0) {
      const contactBits: string[] = [];
      for (const cf of contactFacts) {
        const d = (cf.data as Record<string, unknown>) || {};
        if (d.name) contactBits.push(String(d.name));
        if (d.email) contactBits.push(String(d.email));
        if (d.phone) contactBits.push(String(d.phone));
        if (d.location) contactBits.push(String(d.location));
        if (d.linkedin) contactBits.push(String(d.linkedin));
      }
      if (contactBits.length > 0) {
        lines.push(contactBits.join(" | "));
        lines.push("");
      }
    }

    // 2. Professional Summary
    const summaryFacts = byKind.get("SUMMARY") ?? [];
    if (summaryFacts.length > 0) {
      lines.push("PROFESSIONAL SUMMARY");
      for (const sf of summaryFacts) {
        const d = (sf.data as Record<string, unknown>) || {};
        const text = d.summary || d.text || sf.sourceNote;
        if (text) lines.push(String(text).trim());
      }
      lines.push("");
    }

    // 3. Work Experience
    const expFacts = byKind.get("EXPERIENCE") ?? [];
    let totalBullets = 0;
    let metricBullets = 0;
    const metricRegex = /\d+(\.\d+)?%|\$\d+|\b\d+\b/i;

    if (expFacts.length > 0) {
      lines.push("WORK EXPERIENCE");
      for (const ef of expFacts) {
        const d = (ef.data as Record<string, unknown>) || {};
        const title = d.title || d.role || ef.sourceNote || "Role";
        const company = d.company || d.employer || "";
        const dates = [d.startDate, d.endDate || "Present"].filter(Boolean).join(" - ");
        const location = d.location ? String(d.location) : "";

        lines.push([title, company].filter(Boolean).join(" - "));
        if (dates || location) {
          lines.push([dates, location].filter(Boolean).join(" | "));
        }

        if (Array.isArray(d.bullets)) {
          for (const b of d.bullets) {
            if (typeof b === "string" && b.trim()) {
              totalBullets++;
              if (metricRegex.test(b)) metricBullets++;
              lines.push(`• ${b.trim()}`);
            }
          }
        }
        lines.push("");
      }
    }

    // 4. Skills
    const skillFacts = byKind.get("SKILL") ?? [];
    if (skillFacts.length > 0) {
      lines.push("CORE SKILLS & TECHNOLOGIES");
      const skillList: string[] = [];
      for (const sk of skillFacts) {
        const d = (sk.data as Record<string, unknown>) || {};
        if (d.name) skillList.push(String(d.name));
        else if (sk.sourceNote) skillList.push(sk.sourceNote);
      }
      if (skillList.length > 0) {
        lines.push(skillList.join(", "));
        lines.push("");
      }
    }

    // 5. Projects
    const projectFacts = byKind.get("PROJECT") ?? [];
    if (projectFacts.length > 0) {
      lines.push("TECHNICAL PROJECTS");
      for (const pf of projectFacts) {
        const d = (pf.data as Record<string, unknown>) || {};
        const name = d.name || d.title || pf.sourceNote || "Project";
        lines.push(String(name));
        if (Array.isArray(d.bullets)) {
          for (const b of d.bullets) {
            if (typeof b === "string" && b.trim()) {
              totalBullets++;
              if (metricRegex.test(b)) metricBullets++;
              lines.push(`• ${b.trim()}`);
            }
          }
        }
        lines.push("");
      }
    }

    // 6. Education
    const eduFacts = byKind.get("EDUCATION") ?? [];
    if (eduFacts.length > 0) {
      lines.push("EDUCATION");
      for (const ed of eduFacts) {
        const d = (ed.data as Record<string, unknown>) || {};
        const degree = d.degree || d.title || ed.sourceNote || "Degree";
        const school = d.school || d.institution || "";
        const dates = [d.startDate, d.endDate || d.year].filter(Boolean).join(" - ");
        lines.push([degree, school].filter(Boolean).join(" - "));
        if (dates) lines.push(String(dates));
        lines.push("");
      }
    }

    // 7. Certifications
    const certFacts = byKind.get("CERTIFICATION") ?? [];
    if (certFacts.length > 0) {
      lines.push("CERTIFICATIONS");
      for (const cf of certFacts) {
        const d = (cf.data as Record<string, unknown>) || {};
        const name = d.name || d.title || cf.sourceNote;
        if (name) lines.push(`• ${String(name)}`);
      }
      lines.push("");
    }

    const fullText = lines.join("\n").trim();
    const wordCount = fullText.split(/\s+/).filter(Boolean).length;
    const characterCount = fullText.length;
    const metricDensity = totalBullets > 0 ? Math.round((metricBullets / totalBullets) * 100) : 0;

    const lintResults: LinterResult = {
      hasContact: contactFacts.length > 0,
      hasExperience: expFacts.length > 0,
      hasEducation: eduFacts.length > 0,
      hasSkills: skillFacts.length > 0,
      metricDensity,
      totalBullets,
      metricBullets,
      wordCount,
      characterCount,
    };

    return { linearText: fullText, lint: lintResults };
  }, [facts]);

  async function handleCopy() {
    await navigator.clipboard.writeText(linearText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      {/* Header and statistics */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent" />
            <h3 className="font-medium text-foreground">ATS Linear Parsing Simulation</h3>
            <Badge variant="outline" className="text-xs">Single-column stream</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Simulates the exact sequential text stream parsed by applicant tracking systems (Greenhouse, Lever, Workday).
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="gap-1.5 text-xs"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied linear stream" : "Copy ATS text"}
        </Button>
      </div>

      {/* Linter Checks */}
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/50 p-2.5">
          {lint.hasExperience ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          )}
          <div>
            <div className="font-medium">Experience Section</div>
            <div className="text-muted-foreground">{lint.hasExperience ? "Detected" : "Missing header"}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/50 p-2.5">
          {lint.hasSkills ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          )}
          <div>
            <div className="font-medium">Skills Section</div>
            <div className="text-muted-foreground">{lint.hasSkills ? "Detected" : "Missing header"}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/50 p-2.5">
          {lint.hasEducation ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          )}
          <div>
            <div className="font-medium">Education Section</div>
            <div className="text-muted-foreground">{lint.hasEducation ? "Detected" : "Missing header"}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/50 p-2.5">
          <BarChart3 className="h-4 w-4 text-accent shrink-0" />
          <div>
            <div className="font-medium">Metric Density</div>
            <div className="text-muted-foreground">
              {lint.metricDensity}% ({lint.metricBullets}/{lint.totalBullets} bullets)
            </div>
          </div>
        </div>
      </div>

      {lint.metricDensity < 40 && lint.totalBullets > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
          <strong>Metric density notice:</strong> Only {lint.metricDensity}% of your bullet points contain numbers, percentages, or dollar amounts.
          Research by The Ladders (2018 eye-tracking study) indicates that bullets following the Google XYZ formula (&ldquo;Accomplished [X] as measured by [Y] by doing [Z]&rdquo;) receive 2x higher recruiter dwell time.
        </div>
      )}

      {/* Raw linear output */}
      <div className="relative rounded-lg border border-border bg-muted/20 p-4">
        <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
          {linearText || "No profile entries available for ATS parsing simulation."}
        </pre>
      </div>

      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>Word count: {lint.wordCount} words</span>
        <span>Character count: {lint.characterCount} characters</span>
      </div>
    </div>
  );
}
