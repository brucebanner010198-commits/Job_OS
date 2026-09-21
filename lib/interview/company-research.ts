import { fetchWebResearchSources } from "@/lib/brief/source-web-research";
import { chat } from "@/lib/ai/openrouter";

export interface CompanyInterviewIntel {
  company: string;
  aiScreeningFormat: string;
  hrInterviewStyle: string;
  commonQuestionThemes: string[];
  keyCultureValues: string[];
  preparationAdvice: string;
}

/**
 * Researches how interviews are conducted at a specific company (AI screening vs HR rounds).
 */
export async function getCompanyInterviewIntel(
  company: string,
  role?: string,
): Promise<CompanyInterviewIntel> {
  // Fetch publicly available web sources on the company
  const sources = await fetchWebResearchSources({ name: company });
  const context = sources.map((s) => s.text).join("\n\n").slice(0, 4000);

  const prompt = `You are a corporate hiring intelligence researcher.
Analyze how interview processes, AI screenings (e.g. HireVue, Karat, automated video filters), and HR rounds are conducted at "${company}" for roles like "${role || 'software engineering'}".

Return strict JSON with this schema:
{
  "company": "${company}",
  "aiScreeningFormat": "Description of early AI/automated filters used (e.g. 3-5 competency questions, 2-minute recording limits, coding puzzle platform)",
  "hrInterviewStyle": "Description of HR / hiring manager stage (e.g. behavioral STAR method, culture alignment, depth probing)",
  "commonQuestionThemes": ["Theme 1", "Theme 2", "Theme 3"],
  "keyCultureValues": ["Value 1", "Value 2"],
  "preparationAdvice": "Concise 2-sentence actionable advice for acing both the AI screening and the HR interview."
}`;

  try {
    const res = await chat({
      tier: "standard",
      json: true,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: `Public Company Intel:\n${context || "No direct public site available."}` },
      ],
    });

    const parsed = JSON.parse(res.text) as CompanyInterviewIntel;
    return parsed;
  } catch {
    return {
      company,
      aiScreeningFormat: `Automated competency video screen focusing on role readiness, problem-solving, and communication clarity.`,
      hrInterviewStyle: `Warm but rigorous behavioral conversation assessing collaboration, ownership, and technical leadership.`,
      commonQuestionThemes: [
        "Overcoming complex technical hurdles under tight timelines",
        "Cross-functional communication and resolving conflict",
        "Scalability and system design tradeoffs",
      ],
      keyCultureValues: ["Customer Obsession", "Ownership", "Technical Excellence"],
      preparationAdvice: `Structure answers using the STAR method with specific metrics. Speak clearly during the AI filter without filler words, and highlight business impact with HR.`,
    };
  }
}
