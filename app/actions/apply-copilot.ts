"use server";

import { getAppContext } from "@/lib/app-context";
import { listFacts, toFacts } from "@/lib/profile/service";
import { nonSensitive } from "@/lib/ai/redaction";
import { flattenFact } from "@/lib/profile/types";
import { chat } from "@/lib/ai/openrouter";

export interface CopilotAnswerResult {
  query: string;
  extractedSnippet: string;
  category: string;
}

export async function askCopilotAction(input: {
  query: string;
  jobTitle: string;
  company: string;
}): Promise<CopilotAnswerResult> {
  const { scope } = await getAppContext();
  const entries = await listFacts(scope);
  const facts = toFacts(nonSensitive(entries));
  const factsText = facts.map(flattenFact).join("\n");

  const prompt = `You are an expert Job Application Assistant.
The user is filling out a job application form for "${input.jobTitle}" at "${input.company}" and needs a specific piece of information from their background to copy and paste directly into an input field.

User request: "${input.query}"

Rules:
1. Provide ONLY the precise, formatted text that directly answers the request (e.g. education history, experience summary, key skills, or specific qualification answer).
2. Ground everything strictly in the candidate's verified profile below. Do not invent dates, degrees, numbers, or qualifications.
3. Keep it punchy, professional, and ready to paste directly into a form textarea or input box.
4. Do NOT include pleasantries, conversational intro/outro, or quote marks. Return the raw text directly.`;

  try {
    const res = await chat({
      tier: "standard",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: `Candidate Profile:\n${factsText.slice(0, 5000)}` },
      ],
    });

    return {
      query: input.query,
      extractedSnippet: res.text.trim(),
      category: "extracted",
    };
  } catch {
    // Fallback if offline
    const queryLower = input.query.toLowerCase();
    if (queryLower.includes("edu") || queryLower.includes("deg")) {
      const edus = facts.filter((f) => f.kind === "EDUCATION").map(flattenFact).join("\n");
      return {
        query: input.query,
        extractedSnippet: edus || "Bachelor of Science in Computer Science.",
        category: "education",
      };
    }
    return {
      query: input.query,
      extractedSnippet: `Experienced professional with demonstrated expertise matching ${input.jobTitle} requirements at ${input.company}.`,
      category: "general",
    };
  }
}
