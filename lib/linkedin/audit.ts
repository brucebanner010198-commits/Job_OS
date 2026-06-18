/**
 * LinkedIn Presence Optimizer - pure rules engine.
 *
 * PURE: no LLM, no network, no DB, no Math.random, no Date.now.
 * 100-point weighted scoring against LinkedIn's All-Star criteria.
 *
 * Score → Tier:
 *   0–39   Beginner
 *  40–64   Intermediate
 *  65–84   Advanced
 *  85–100  All-Star
 *
 * Weight allocation (total 100):
 *   Headline (present, ≥40 chars, keyword-rich)  15
 *   About / summary (≥200 chars)                 15
 *   Profile photo                                10
 *   Custom / vanity URL                          10
 *   Skills (≥5 listed)                           10
 *   Connections (≥50 → 5 pts; ≥500 → 10 pts)    10
 *   Experience entries (≥1 → 5 pts; ≥2 → 10 pts) 10
 *   Featured section (≥1 item)                   10
 *   Recommendations received (≥1)                10
 */

import type {
  AuditFinding,
  AuditResult,
  AuditTier,
  LinkedInProfileInput,
  Severity,
} from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function finding(
  area: string,
  severity: Severity,
  issue: string,
  suggestion: string,
): AuditFinding {
  return { area, severity, issue, suggestion };
}

/** Regex that matches the "<Title> at <Company>" job-title-only pattern. */
const JOB_TITLE_ONLY_RE =
  /^[A-Za-z\s&,.()\-\/|]+\s+at\s+[A-Za-z0-9\s&,.()\-\/]+\.?\s*$/i;

// ---------------------------------------------------------------------------
// Per-criterion scorers
// ---------------------------------------------------------------------------

function scoreHeadline(
  input: LinkedInProfileInput,
  findings: AuditFinding[],
  strengths: string[],
): number {
  const h = input.headline.trim();

  if (h.length === 0) {
    findings.push(
      finding(
        "Headline",
        "high",
        "No headline set - your profile shows nothing below your name.",
        "Write a headline that leads with keywords recruiters search: role, specialisms, and 1–2 differentiators (e.g. \"Senior Backend Engineer | Distributed Systems | TypeScript, Rust | Ex-Stripe\").",
      ),
    );
    return 0;
  }

  if (h.length < 40) {
    findings.push(
      finding(
        "Headline",
        "high",
        `Headline is too short (${h.length} chars). LinkedIn shows ~220 chars; short headlines rank lower.`,
        "Expand your headline to at least 40–80 characters. Include your primary role, 2–3 key skills or technologies, and a differentiator or value statement.",
      ),
    );
    return 5;
  }

  if (JOB_TITLE_ONLY_RE.test(h)) {
    findings.push(
      finding(
        "Headline",
        "medium",
        "Headline reads as a plain job title only (\"<Role> at <Company>\").",
        "Add keyword-rich context after the job title: technologies, achievements, or a brief value prop. Example: \"Software Engineer at Acme | Python & Go | Building real-time data pipelines\".",
      ),
    );
    return 12;
  }

  // ≥40 chars and keyword-rich
  strengths.push("Headline is keyword-rich and at least 40 characters - strong search signal.");
  return 15;
}

function scoreAbout(
  input: LinkedInProfileInput,
  findings: AuditFinding[],
  strengths: string[],
): number {
  const a = input.about.trim();

  if (a.length === 0) {
    findings.push(
      finding(
        "About",
        "high",
        "About / Summary section is empty - LinkedIn's algorithm penalises missing summaries.",
        "Write at least 200–300 words covering: who you are, what you do, your top 3 accomplishments, technologies you use, and a call-to-action (e.g. \"Open to senior IC or EM roles in climate-tech; reach out at …\").",
      ),
    );
    return 0;
  }

  if (a.length < 100) {
    findings.push(
      finding(
        "About",
        "high",
        `About section is very short (${a.length} chars). Recruiters skip sparse summaries.`,
        "Expand to at least 200 characters. Add context about your background, specialisms, and what you are looking for.",
      ),
    );
    return 5;
  }

  if (a.length < 200) {
    findings.push(
      finding(
        "About",
        "medium",
        `About section is present but brief (${a.length} chars; target ≥200).`,
        "Add more detail: a specific achievement with numbers, the problems you solve, and your preferred work environment or goals.",
      ),
    );
    return 10;
  }

  strengths.push(`About section is ${a.length} characters - gives recruiters and the algorithm strong signal.`);
  return 15;
}

function scorePhoto(
  input: LinkedInProfileInput,
  findings: AuditFinding[],
  strengths: string[],
): number {
  if (!input.hasPhoto) {
    findings.push(
      finding(
        "Photo",
        "medium",
        "No profile photo detected. Profiles without a photo get far fewer views.",
        "Upload a high-resolution, professional headshot (minimum 400×400 px). Plain or blurred background, good lighting, friendly expression.",
      ),
    );
    return 0;
  }
  strengths.push("Profile photo is set - key trust signal for recruiters.");
  return 10;
}

function scoreCustomUrl(
  input: LinkedInProfileInput,
  findings: AuditFinding[],
  strengths: string[],
): number {
  if (!input.hasCustomUrl) {
    findings.push(
      finding(
        "Vanity URL",
        "low",
        "Profile URL is still the auto-generated ID (e.g. linkedin.com/in/12345678).",
        "Customise your URL in Settings → Edit public profile & URL. Use firstname-lastname or a personal brand slug - it looks professional and is easier to share on a CV.",
      ),
    );
    return 0;
  }
  strengths.push("Custom vanity URL set - professional and shareable.");
  return 10;
}

function scoreSkills(
  input: LinkedInProfileInput,
  findings: AuditFinding[],
  strengths: string[],
): number {
  if (input.skillsCount === 0) {
    findings.push(
      finding(
        "Skills",
        "high",
        "No skills listed. LinkedIn uses skills to match profiles to job postings.",
        "Add at least 5 skills - ideally up to the 50-skill max. Lead with the core technical or domain skills recruiters filter on, then layer in methodologies and soft skills.",
      ),
    );
    return 0;
  }

  if (input.skillsCount < 5) {
    findings.push(
      finding(
        "Skills",
        "high",
        `Only ${input.skillsCount} skill${input.skillsCount === 1 ? "" : "s"} listed. LinkedIn recommends at least 5 to reach All-Star status.`,
        "Add more skills until you have at least 5. LinkedIn allows up to 50; the more relevant skills you list, the more often your profile surfaces in recruiter searches.",
      ),
    );
    return 5;
  }

  if (input.skillsCount < 20) {
    findings.push(
      finding(
        "Skills",
        "low",
        `${input.skillsCount} skills listed - consider adding more (LinkedIn allows up to 50).`,
        "Expand to 20–50 skills. Include niche tools and frameworks; recruiters often filter on very specific technology names.",
      ),
    );
  }

  strengths.push(`${input.skillsCount} skills listed - helps the LinkedIn algorithm match you to relevant postings.`);
  return 10;
}

function scoreConnections(
  input: LinkedInProfileInput,
  findings: AuditFinding[],
  strengths: string[],
): number {
  if (input.connections < 50) {
    findings.push(
      finding(
        "Connections",
        "medium",
        `Only ${input.connections} connections. Profiles below 50 connections are ranked lower in search and appear less credible.`,
        "Actively connect with colleagues, classmates, and recruiters. Reaching 50+ connections unlocks better search ranking; 500+ signals an active professional.",
      ),
    );
    return 0;
  }

  if (input.connections < 500) {
    findings.push(
      finding(
        "Connections",
        "low",
        `${input.connections} connections. Profiles with 500+ connections show a broader network reach.`,
        "Aim for 500+ connections by connecting with former colleagues, conference contacts, and relevant people in your target industry.",
      ),
    );
    strengths.push(`${input.connections}+ connections - past the 50-connection credibility threshold.`);
    return 5;
  }

  strengths.push("500+ connections - strong network signal and maximum search-reach benefit.");
  return 10;
}

function scoreExperience(
  input: LinkedInProfileInput,
  findings: AuditFinding[],
  strengths: string[],
): number {
  if (input.experienceCount === 0) {
    findings.push(
      finding(
        "Experience",
        "high",
        "No experience entries found. An empty Experience section is a hard stop for most recruiters.",
        "Add at least your current or most recent role. Include a description of 3–5 bullet points covering scope, technologies used, and quantified achievements.",
      ),
    );
    return 0;
  }

  if (input.experienceCount === 1) {
    findings.push(
      finding(
        "Experience",
        "medium",
        "Only one experience entry. Profiles with ≥2 detailed entries are significantly stronger.",
        "Add previous roles with descriptions, even if brief. Quantify impact where possible (e.g. \"reduced API latency by 40%\"). Descriptions are what recruiters scan.",
      ),
    );
    strengths.push("At least one experience entry is present.");
    return 5;
  }

  strengths.push(`${input.experienceCount} experience entries - gives recruiters a career narrative to evaluate.`);
  return 10;
}

function scoreFeatured(
  input: LinkedInProfileInput,
  findings: AuditFinding[],
  strengths: string[],
): number {
  const count = input.featuredCount ?? 0;

  if (count === 0) {
    findings.push(
      finding(
        "Featured",
        "low",
        "Featured section is empty or absent. Featured is prime real-estate above the fold.",
        "Add 1–3 featured items: a link to a portfolio or project, a published article, a conference talk, a GitHub repo, or a compelling media post. It differentiates you visually.",
      ),
    );
    return 0;
  }

  strengths.push(`${count} featured item${count === 1 ? "" : "s"} - visible social proof above the fold.`);
  return 10;
}

function scoreRecommendations(
  input: LinkedInProfileInput,
  findings: AuditFinding[],
  strengths: string[],
): number {
  const count = input.recommendationsCount ?? 0;

  if (count === 0) {
    findings.push(
      finding(
        "Recommendations",
        "low",
        "No recommendations received. Third-party endorsements are the strongest trust signal on LinkedIn.",
        "Ask 2–3 former managers, colleagues, or clients to write a short recommendation. Give them a prompt: what project you worked on together and what outcome you delivered. Offer to reciprocate.",
      ),
    );
    return 0;
  }

  strengths.push(`${count} recommendation${count === 1 ? "" : "s"} - strong third-party social proof.`);
  return 10;
}

// ---------------------------------------------------------------------------
// Main audit function
// ---------------------------------------------------------------------------

export function auditProfile(input: LinkedInProfileInput): AuditResult {
  const findings: AuditFinding[] = [];
  const strengths: string[] = [];

  const headlineScore = scoreHeadline(input, findings, strengths);
  const aboutScore = scoreAbout(input, findings, strengths);
  const photoScore = scorePhoto(input, findings, strengths);
  const customUrlScore = scoreCustomUrl(input, findings, strengths);
  const skillsScore = scoreSkills(input, findings, strengths);
  const connectionsScore = scoreConnections(input, findings, strengths);
  const experienceScore = scoreExperience(input, findings, strengths);
  const featuredScore = scoreFeatured(input, findings, strengths);
  const recommendationsScore = scoreRecommendations(input, findings, strengths);

  const score =
    headlineScore +
    aboutScore +
    photoScore +
    customUrlScore +
    skillsScore +
    connectionsScore +
    experienceScore +
    featuredScore +
    recommendationsScore;

  // Bonus note on #OpenToWork - not scored, just surfaced
  if (input.hasOpenToWork) {
    strengths.push(
      "#OpenToWork frame is active - surfaces your profile in Open-to-Work recruiter filters.",
    );
  }

  const tier: AuditTier =
    score >= 85
      ? "All-Star"
      : score >= 65
        ? "Advanced"
        : score >= 40
          ? "Intermediate"
          : "Beginner";

  // Sort findings: high → medium → low
  const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return { score, tier, findings, strengths };
}

// ---------------------------------------------------------------------------
// Heuristic text parser
// ---------------------------------------------------------------------------

/**
 * Best-effort parse of a pasted LinkedIn profile blob.
 *
 * Conservative defaults: when a field is ambiguous we default to the less
 * favourable value so the audit surfaces real gaps rather than hiding them.
 *
 * Recognised section headers (case-insensitive): About, Summary, Experience,
 * Education, Skills, Featured, Recommendations, Languages, Certifications,
 * Projects, Volunteer, Accomplishments, Interests.
 */
export function profileFromText(text: string): LinkedInProfileInput {
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  // --- Headline ---
  // Heuristic: the LinkedIn "copy all" format puts Name on line 0, headline on
  // line 1 (or shortly after). We skip lines that look like pure names
  // (≤4 capitalised words, no special chars) and URL lines.
  let headline = "";
  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const line = lines[i];
    if (!line) continue;
    if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}$/.test(line)) continue; // looks like a name
    if (/linkedin\.com|^https?:\/\//i.test(line)) continue;           // URL
    if (/^\d+[+]?\s*connections?/i.test(line)) continue;              // connection count
    if (/^(open to work|#opentowork)/i.test(line)) continue;          // OTW badge
    headline = line;
    break;
  }

  // --- Section index map ---
  const SECTION_RE =
    /^(about|summary|experience|education|skills?|featured|recommendations?|languages?|certifications?|projects?|volunteer|accomplishments?|interests?|contact info|activity|following|groups?)$/i;

  interface Section { start: number; end: number }
  const sections: Record<string, Section> = {};
  const sectionOrder: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (SECTION_RE.test(lines[i])) {
      const key = lines[i].toLowerCase().replace(/s$/, ""); // normalise plural
      if (!(key in sections)) {
        sections[key] = { start: i + 1, end: lines.length };
        sectionOrder.push(key);
      }
    }
  }
  // Set section ends
  for (let i = 0; i < sectionOrder.length - 1; i++) {
    sections[sectionOrder[i]].end = sections[sectionOrder[i + 1]].start - 1;
  }

  // Helper: get lines in a section
  function sectionLines(key: string): string[] {
    const s = sections[key];
    if (!s) return [];
    return lines.slice(s.start, s.end).filter((l) => l.length > 0);
  }

  // --- About ---
  const aboutKey = "about" in sections ? "about" : "summary" in sections ? "summary" : null;
  const about = aboutKey ? sectionLines(aboutKey).join(" ") : "";

  // --- Custom URL ---
  const urlMatch = text.match(/linkedin\.com\/in\/([a-zA-Z0-9][a-zA-Z0-9\-]{2,30})/i);
  // Custom if present AND not a numeric auto-generated ID
  const hasCustomUrl =
    urlMatch !== null && !/^\d+$/.test(urlMatch[1]) && !/^[a-f0-9]{8,}$/i.test(urlMatch[1]);

  // --- Connections ---
  let connections = 0;
  if (/500\s*\+\s*connections?/i.test(text)) {
    connections = 500;
  } else {
    const connMatch = text.match(/(\d[\d,]*)\s*connections?/i);
    if (connMatch) connections = parseInt(connMatch[1].replace(/,/g, ""), 10);
  }

  // --- Skills ---
  let skillsCount = 0;
  const skillLines = sectionLines("skill");
  if (skillLines.length > 0) {
    // Each skill is typically 1–5 words on its own line
    skillsCount = skillLines.filter((l) => l.length > 0 && l.length < 60).length;
  }
  // Fallback: "Show all X skills"
  if (skillsCount === 0) {
    const showAllMatch = text.match(/show\s+all\s+(\d+)\s+skills?/i);
    if (showAllMatch) skillsCount = parseInt(showAllMatch[1], 10);
  }

  // --- Experience ---
  let experienceCount = 0;
  const expLines = sectionLines("experience");
  if (expLines.length > 0) {
    // Employment type cues: "Full-time", "Part-time", "Contract", "Freelance", "Internship"
    const empTypeMatches = expLines.filter((l) =>
      /\bfull-time\b|\bpart-time\b|\bcontract\b|\bfreelance\b|\binternship\b/i.test(l),
    ).length;
    if (empTypeMatches > 0) {
      experienceCount = empTypeMatches;
    } else {
      // Rough estimate: count "·" lines (company · employment type) or date ranges
      const dateRangeLines = expLines.filter((l) =>
        /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b.+(\d{4}|present)/i.test(l) ||
        /\d{4}\s*[–-]\s*(\d{4}|present)/i.test(l),
      ).length;
      experienceCount = dateRangeLines > 0 ? dateRangeLines : expLines.length > 0 ? 1 : 0;
    }
  }

  // --- #OpenToWork ---
  const hasOpenToWork =
    /#?open\s*to\s*work/i.test(text) || /#opentowork/i.test(text);

  // --- Featured ---
  let featuredCount = 0;
  const featLines = sectionLines("featured");
  if (featLines.length > 0) {
    // Each featured item typically has a title line; cap at 10
    featuredCount = Math.min(featLines.length, 10);
  }

  // --- Recommendations ---
  let recommendationsCount = 0;
  const recMatch =
    text.match(/recommendations?\s*[\(:]\s*(\d+)/i) ??
    text.match(/(\d+)\s*recommendations?\s*received/i) ??
    text.match(/received\s+(\d+)\s*recommendations?/i);
  if (recMatch) recommendationsCount = parseInt(recMatch[1], 10);

  // --- hasPhoto ---
  // Cannot reliably detect from pasted text; only set true on explicit cues.
  const hasPhoto = /profile\s+(?:photo|picture|image)\s+(?:is\s+)?(?:set|uploaded|added)/i.test(
    text,
  );

  return {
    headline,
    about,
    hasPhoto,
    hasCustomUrl,
    skillsCount,
    connections,
    experienceCount,
    hasOpenToWork: hasOpenToWork || undefined,
    featuredCount: featuredCount > 0 ? featuredCount : undefined,
    recommendationsCount: recommendationsCount > 0 ? recommendationsCount : undefined,
  };
}
