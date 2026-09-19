import { chat } from "@/lib/ai/openrouter";
import type { WorkLogEntry } from "@prisma/client";

export interface CompiledBulletItem {
  workLogEntryId: string;
  bulletText: string;
  impactClaim: string;
  suggestedKind: "EXPERIENCE" | "PROJECT" | "ACHIEVEMENT" | "SKILL";
}

/**
 * Synthesizes a list of WorkLogEntry records into verified, high-impact
 * candidate resume bullets with action verbs and quantifiable results.
 */
export async function compileWorkLogsToBullets(
  logs: WorkLogEntry[],
): Promise<CompiledBulletItem[]> {
  if (logs.length === 0) return [];

  const logSummaries = logs.map((log) => ({
    id: log.id,
    date: log.date.toISOString().slice(0, 10),
    title: log.title,
    project: log.project ?? "General",
    tasksDone: log.tasksDone,
    pointOfView: log.pointOfView ?? "",
    category: log.category,
    metrics: log.metrics,
  }));

  const systemPrompt = `You are an expert executive resume writer and career compiler.
Your task is to convert raw daily work logs, technical decisions, and personal point-of-view reflections into Fortune 500 calibre resume bullets.

Follow these strict rules:
1. Use the Google XYZ formula: "Accomplished [X], as measured by [Y], by doing [Z]".
2. Begin with a strong active past-tense verb (e.g. Architected, Engineered, Optimized, Delivered, Spearheaded).
3. Ground every single claim strictly in the supplied log details. Do NOT invent numbers or facts not in the log.
4. Integrate the user's point-of-view / architectural rationale where relevant to show seniority.
5. Return a strict JSON array of objects with the exact schema:
[
  {
    "workLogEntryId": "id-from-input",
    "bulletText": "Architected...",
    "impactClaim": "Short summary of business or technical impact",
    "suggestedKind": "EXPERIENCE" | "PROJECT" | "ACHIEVEMENT" | "SKILL"
  }
]`;

  try {
    const res = await chat({
      tier: "standard",
      json: true,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Here are the daily work logs to compile into resume bullets:\n${JSON.stringify(logSummaries, null, 2)}`,
        },
      ],
    });

    const parsed = JSON.parse(res.text);
    const items = Array.isArray(parsed) ? parsed : parsed.bullets || parsed.items || [];

    interface AiBulletOutput {
      workLogEntryId?: string;
      bulletText?: string;
      impactClaim?: string;
      suggestedKind?: "EXPERIENCE" | "PROJECT" | "ACHIEVEMENT" | "SKILL";
    }

    if (Array.isArray(items) && items.length > 0) {
      return (items as AiBulletOutput[]).map((item, idx) => ({
        workLogEntryId: item.workLogEntryId || logs[idx]?.id || logs[0].id,
        bulletText: String(item.bulletText || "").trim(),
        impactClaim: String(item.impactClaim || "").trim(),
        suggestedKind: item.suggestedKind && ["EXPERIENCE", "PROJECT", "ACHIEVEMENT", "SKILL"].includes(item.suggestedKind)
          ? item.suggestedKind
          : "EXPERIENCE",
      })).filter((b) => b.bulletText.length > 0);
    }
  } catch (err) {
    console.warn("AI compilation failed or offline, using deterministic fallback:", err);
  }

  // Deterministic fallback if offline
  interface MetricEntry {
    label?: string;
    delta?: string;
  }

  return logs.map((log) => {
    const rawMetrics = Array.isArray(log.metrics) ? (log.metrics as unknown as MetricEntry[]) : [];
    const metricsStr = rawMetrics.map((m) => `${m.label || ""}: ${m.delta || ""}`).join(", ");
    const povStr = log.pointOfView ? ` with approach focused on ${log.pointOfView}` : "";
    const bulletText = `${log.title}: ${log.tasksDone}${povStr}${metricsStr ? ` (${metricsStr})` : ""}.`;

    return {
      workLogEntryId: log.id,
      bulletText,
      impactClaim: log.title,
      suggestedKind: log.category === "LEARNING" ? "SKILL" : "EXPERIENCE",
    };
  });
}
