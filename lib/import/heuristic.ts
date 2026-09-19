import type { Extracted, ExtractedEntry } from "@/lib/profile/extract";

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

const SECTION_HEADERS = [
  { kind: "SUMMARY", pattern: /^(?:professional\s+)?(?:summary|profile|about(?:\s+me)?|objective)\b/i },
  { kind: "SKILL", pattern: /^(?:technical\s+|core\s+)?(?:skills|competencies|technologies|tools)\b/i },
  { kind: "EXPERIENCE", pattern: /^(?:work\s+|professional\s+)?(?:experience|employment|history)\b/i },
  { kind: "EDUCATION", pattern: /^(?:education|academic(?:\s+background)?|degrees)\b/i },
  { kind: "PROJECT", pattern: /^(?:projects|personal\s+projects|open\s+source)\b/i },
  { kind: "CERTIFICATION", pattern: /^(?:certifications?|licenses?)\b/i },
] as const;

export function extractFromResumeHeuristic(text: string): Extracted {
  const entries: ExtractedEntry[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { entries: [] };
  }

  // 1. Contact info
  const email = text.match(EMAIL_REGEX)?.[0];
  const phone = text.match(PHONE_REGEX)?.[0];
  let name = lines[0];
  // If the first line looks like a heading or email, avoid using it as name
  if (name.includes("@") || name.length > 50 || SECTION_HEADERS.some((h) => h.pattern.test(name))) {
    name = "";
  }

  if (name || email || phone) {
    entries.push({
      kind: "CONTACT",
      title: name || "Contact Info",
      data: {
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
      },
      sensitive: false,
    });
  }

  // 2. Partition into sections
  type SectionKind = (typeof SECTION_HEADERS)[number]["kind"];
  const sections: { kind: SectionKind; lines: string[] }[] = [];
  let currentKind: SectionKind | null = null;
  let currentLines: string[] = [];

  for (let i = (name ? 1 : 0); i < lines.length; i++) {
    const line = lines[i];
    // Check if this line is a section header
    const matchedHeader = SECTION_HEADERS.find((h) => h.pattern.test(line));
    if (matchedHeader) {
      if (currentLines.length > 0) {
        if (currentKind) {
          sections.push({ kind: currentKind, lines: currentLines });
        } else {
          // Check if pre-section text looks like experience (has dates or company)
          const isExp = currentLines.some((l) => /\b20\d\d\b|built|managed|led|engineer|developer/i.test(l));
          sections.push({ kind: isExp ? "EXPERIENCE" : "SUMMARY", lines: currentLines });
        }
      }
      currentKind = matchedHeader.kind;
      currentLines = [];
      const remainder = line.replace(matchedHeader.pattern, "").replace(/^[:\-–—\s]+/, "").trim();
      if (remainder.length > 0) {
        currentLines.push(remainder);
      }
    } else if (currentKind) {
      currentLines.push(line);
    } else {
      // Check if this unheaded line itself looks like an experience entry (e.g., Acme Corp (2020-Present): ...)
      if (/\b(?:19|20)\d\d\b|present/i.test(line) && line.includes(":")) {
        if (currentLines.length > 0) {
          sections.push({ kind: "SUMMARY", lines: currentLines });
          currentLines = [];
        }
        currentKind = "EXPERIENCE";
        currentLines.push(line);
      } else {
        currentLines.push(line);
      }
    }
  }
  if (currentLines.length > 0) {
    if (currentKind) {
      sections.push({ kind: currentKind, lines: currentLines });
    } else {
      const isExp = currentLines.some((l) => /\b20\d\d\b|built|managed|led|engineer|developer/i.test(l));
      sections.push({ kind: isExp ? "EXPERIENCE" : "SUMMARY", lines: currentLines });
    }
  }

  // 3. Convert sections into structured entries
  for (const s of sections) {
    switch (s.kind) {
      case "SUMMARY": {
        const summaryText = s.lines.join(" ");
        if (summaryText.length > 10) {
          entries.push({
            kind: "SUMMARY",
            title: "Professional Summary",
            data: { text: summaryText },
            sensitive: false,
          });
        }
        break;
      }

      case "SKILL": {
        const skillTokens = s.lines
          .flatMap((l) => l.split(/[,•|·;]/))
          .map((t) => t.replace(/^[-*•]\s*/, "").trim())
          .filter((t) => t.length > 1 && t.length < 40);
        if (skillTokens.length > 0) {
          entries.push({
            kind: "SKILL",
            title: "Skills",
            data: { name: "Skills", skills: Array.from(new Set(skillTokens)) },
            sensitive: false,
          });
        }
        break;
      }

      case "EXPERIENCE": {
        // Group lines by role/company header vs bullet points
        const bullets: string[] = [];
        let roleTitle = "";
        let company = "";

        for (const line of s.lines) {
          const isBullet = /^[-*•·]/.test(line);
          if (isBullet) {
            bullets.push(line.replace(/^[-*•·]\s*/, "").trim());
          } else if (line.includes(":") && /\b(?:19|20)\d\d\b|present/i.test(line)) {
            const colonIdx = line.indexOf(":");
            company = line.slice(0, colonIdx).trim();
            const afterColon = line.slice(colonIdx + 1).trim();
            if (afterColon) {
              bullets.push(afterColon);
            }
          } else if (!roleTitle) {
            roleTitle = line;
          } else if (!company) {
            company = line;
          } else {
            bullets.push(line);
          }
        }

        entries.push({
          kind: "EXPERIENCE",
          title: roleTitle || company || "Experience",
          data: {
            title: roleTitle || "Role",
            company: company || "Company",
            bullets: bullets.length > 0 ? bullets : [s.lines.join(" ")],
          },
          sensitive: false,
        });
        break;
      }

      case "EDUCATION": {
        const eduText = s.lines.join(" ");
        entries.push({
          kind: "EDUCATION",
          title: s.lines[0] || "Education",
          data: {
            degree: s.lines[0] || "Degree",
            institution: s.lines[1] || eduText,
            detail: eduText,
          },
          sensitive: false,
        });
        break;
      }

      case "PROJECT": {
        entries.push({
          kind: "PROJECT",
          title: s.lines[0] || "Project",
          data: {
            name: s.lines[0] || "Project",
            description: s.lines.slice(1).join(" "),
            bullets: s.lines.slice(1),
          },
          sensitive: false,
        });
        break;
      }

      case "CERTIFICATION": {
        entries.push({
          kind: "CERTIFICATION",
          title: s.lines[0] || "Certification",
          data: {
            name: s.lines.join(", "),
          },
          sensitive: false,
        });
        break;
      }
    }
  }

  // If nothing could be extracted, at least save the summary of text so it is not lost
  if (entries.length === 0 && lines.length > 0) {
    entries.push({
      kind: "SUMMARY",
      title: "Imported Resume",
      data: { text: lines.join("\n") },
      sensitive: false,
    });
  }

  return { entries };
}
