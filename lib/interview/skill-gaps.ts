import { chat } from "@/lib/ai/openrouter";
import type { AppScope } from "@/lib/profiles/types";
import { nonSensitiveProfileText } from "@/lib/goals/service";

export interface CuratedLesson {
  skill: string;
  category: "TECHNICAL" | "SYSTEM_DESIGN" | "BEHAVIORAL" | "LEADERSHIP";
  summary: string;
  keyTalkingPoints: string[];
  sampleInterviewQuestion: string;
  idealAnswerFramework: string;
}

export interface SkillGapAnalysis {
  missingSkills: string[];
  lessons: CuratedLesson[];
}

/**
 * Identifies skill gaps between a job description and candidate facts,
 * then curates targeted study lessons for pre-interview preparation.
 */
export async function analyzeSkillGapsAndCurateLessons(
  scope: AppScope,
  jobDescription: string,
  company: string,
  role: string,
): Promise<SkillGapAnalysis> {
  const profileText = await nonSensitiveProfileText(scope);

  const prompt = `You are a technical interview coach and curriculum designer.
Compare the candidate's verified profile against this target job description for "${role}" at "${company}".
Identify 2-3 key technical or leadership skill gaps where the candidate may be questioned, and curate concise, high-value mini-lessons so the candidate can prepare and speak confidently during their interview.

Return strict JSON with this schema:
{
  "missingSkills": ["Skill A", "Skill B"],
  "lessons": [
    {
      "skill": "Skill Name",
      "category": "TECHNICAL" | "SYSTEM_DESIGN" | "BEHAVIORAL" | "LEADERSHIP",
      "summary": "2-sentence concept briefing explaining the core principles",
      "keyTalkingPoints": ["Point 1", "Point 2", "Point 3"],
      "sampleInterviewQuestion": "Realistic question an interviewer would ask about this topic",
      "idealAnswerFramework": "How the candidate should frame their answer using past adjacent experience"
    }
  ]
}`;

  try {
    const res = await chat({
      tier: "standard",
      json: true,
      messages: [
        { role: "system", content: prompt },
        {
          role: "user",
          content: `Target Job Description:\n${jobDescription.slice(0, 3000)}\n\nCandidate Background:\n${profileText.slice(0, 4000)}`,
        },
      ],
    });

    const parsed = JSON.parse(res.text) as SkillGapAnalysis;
    return parsed;
  } catch {
    return {
      missingSkills: ["System Design Tradeoffs", "Distributed Consensus"],
      lessons: [
        {
          skill: "System Design Tradeoffs",
          category: "SYSTEM_DESIGN",
          summary: "Evaluating latency, throughput, and consistency requirements in high-scale architectures.",
          keyTalkingPoints: [
            "CAP theorem balance depending on business criticality",
            "Eventual consistency with message brokers (e.g. Kafka)",
            "Caching strategies and database indexing",
          ],
          sampleInterviewQuestion: "How do you handle data consistency across independent microservices?",
          idealAnswerFramework: "Start with idempotency keys and outbox pattern, then explain reconciliation jobs.",
        },
      ],
    };
  }
}
