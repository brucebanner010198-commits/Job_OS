import type { ProfileFact } from "@/lib/profile/types";

export interface JsonResumeBasics {
  name?: string;
  label?: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
  profiles?: Array<{
    network: string;
    username?: string;
    url: string;
  }>;
}

export interface JsonResumeWork {
  name: string;
  position: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
}

export interface JsonResumeEducation {
  institution: string;
  url?: string;
  area?: string;
  studyType?: string;
  startDate?: string;
  endDate?: string;
  courses?: string[];
}

export interface JsonResumeSkill {
  name: string;
  level?: string;
  keywords?: string[];
}

export interface JsonResumeProject {
  name: string;
  description?: string;
  highlights?: string[];
  keywords?: string[];
  url?: string;
}

export interface JsonResumeSchema {
  $schema?: string;
  basics: JsonResumeBasics;
  work?: JsonResumeWork[];
  education?: JsonResumeEducation[];
  skills?: JsonResumeSkill[];
  projects?: JsonResumeProject[];
}

/**
 * Converts Job OS ProfileFact items into an official JSON Resume (v1.0.0) standard document.
 */
export function exportToJsonResume(facts: ProfileFact[], candidateName = "Candidate"): JsonResumeSchema {
  const basics: JsonResumeBasics = {
    name: candidateName,
    summary: "",
    profiles: [],
  };

  const work: JsonResumeWork[] = [];
  const education: JsonResumeEducation[] = [];
  const skills: JsonResumeSkill[] = [];
  const projects: JsonResumeProject[] = [];

interface FactPayload {
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  text?: string;
  headline?: string;
  company?: string;
  employer?: string;
  title?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  summary?: string;
  bullets?: string[];
  institution?: string;
  school?: string;
  field?: string;
  major?: string;
  degree?: string;
  name?: string;
  skill?: string;
  keywords?: string[];
  description?: string;
  url?: string;
}

  for (const f of facts) {
    const d = f.data as FactPayload | undefined;
    if (!d) continue;

    switch (f.kind) {
      case "CONTACT":
        if (d.email) basics.email = d.email;
        if (d.phone) basics.phone = d.phone;
        if (d.linkedin) basics.profiles?.push({ network: "LinkedIn", url: d.linkedin });
        if (d.github) basics.profiles?.push({ network: "GitHub", url: d.github });
        if (d.portfolio) basics.url = d.portfolio;
        break;

      case "SUMMARY":
        basics.summary = d.text || basics.summary;
        if (d.headline) basics.label = d.headline;
        break;

      case "EXPERIENCE":
        work.push({
          name: d.company || d.employer || "Company",
          position: d.title || d.role || "Role",
          startDate: d.startDate,
          endDate: d.endDate || (d.current ? "Present" : undefined),
          summary: d.summary,
          highlights: Array.isArray(d.bullets) ? d.bullets : d.text ? [d.text] : [],
        });
        break;

      case "EDUCATION":
        education.push({
          institution: d.institution || d.school || "University",
          area: d.field || d.major,
          studyType: d.degree,
          startDate: d.startDate,
          endDate: d.endDate,
        });
        break;

      case "SKILL":
        skills.push({
          name: d.name || d.skill || d.title || "Skill",
          keywords: Array.isArray(d.keywords) ? d.keywords : [],
        });
        break;

      case "PROJECT":
        projects.push({
          name: d.name || d.title || "Project",
          description: d.description || d.text,
          highlights: Array.isArray(d.bullets) ? d.bullets : [],
          url: d.url,
        });
        break;
    }
  }

  return {
    $schema: "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
    basics,
    work,
    education,
    skills,
    projects,
  };
}
