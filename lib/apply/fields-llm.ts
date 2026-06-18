/**
 * LLM essay field generation - grounded via Knowledge Notebook (extractive).
 */
import { chat } from "@/lib/ai/openrouter";
import { retrieveKnowledge } from "@/lib/knowledge/retrieve";
import type { PreparedField } from "@/lib/apply/types";
import type { AppScope } from "@/lib/profiles/types";

export interface EssayFieldRequest {
  scope: AppScope;
  fieldLabel: string;
  company: string;
  jobTitle: string;
  jobDescription: string;
}

export interface EssayFieldResult {
  value: string;
  provenanceOk: boolean;
  sources: string[];
}

/**
 * Generate a free-text essay answer using only retrieved knowledge chunks.
 * Sets provenanceOk=false when the model invents facts outside context.
 */
export async function generateEssayField(
  req: EssayFieldRequest,
): Promise<EssayFieldResult> {
  const chunks = await retrieveKnowledge(req.scope, {
    query: req.fieldLabel,
    companyName: req.company,
    jobDescription: req.jobDescription,
    topK: 6,
  });

  const context = chunks.map((c) => c.text).join("\n---\n");
  const sources = chunks.map((c) => c.sourceType);

  if (!context.trim()) {
    return { value: "", provenanceOk: false, sources: [] };
  }

  const result = await chat({
    tier: "standard",
    messages: [
      {
        role: "system",
        content:
          "Write a concise job application answer using ONLY the provided profile facts. " +
          "Do not invent employers, dates, or metrics. If facts are insufficient, say so briefly.",
      },
      {
        role: "user",
        content:
          `Question: ${req.fieldLabel}\n` +
          `Role: ${req.jobTitle} at ${req.company}\n\n` +
          `Profile facts:\n${context}`,
      },
    ],
    maxTokens: 400,
    temperature: 0.3,
  });

  const invented =
    /\b(fictional|made up|don't have|do not have|insufficient)/i.test(result.text);
  const provenanceOk = !invented && result.text.length > 20;

  return {
    value: result.text.trim(),
    provenanceOk,
    sources: [...new Set(sources)],
  };
}

/** Merge essay fields into a prepared field list. */
export function essayToPreparedField(
  key: string,
  label: string,
  result: EssayFieldResult,
): PreparedField {
  return {
    key,
    label,
    value: result.value,
    source: result.provenanceOk ? "profile" : "unknown",
    confidence: result.provenanceOk ? 0.85 : 0.2,
    critical: false,
    freeText: true,
  };
}
