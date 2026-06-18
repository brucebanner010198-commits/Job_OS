/**
 * ATS-safe resume renderer - PURE, server-safe, no React.
 *
 * Emits a single-column, table-free, image-free HTML document with selectable
 * text and print rules tuned so the browser's "Save as PDF" yields a clean
 * 1–2 page resume. Real PDF generation (headless Chromium via Playwright) is
 * wired in Phase 5; for now this HTML is print-to-PDF ready.
 *
 * Every text fragment is run through sanitizeForAts() (smart quotes, em-dashes,
 * decorative bullets, emoji → ASCII-safe) and then HTML-escaped.
 */

import { ATS, sanitizeForAts } from "@/lib/resume/ats-rules";
import { type TailoredResume } from "@/lib/resume/schema";
import { type SkimZone } from "@/lib/resume/skim-layout";

export interface RenderResumeOptions {
  /** When set, highlights recruiter top-third skim zone in the HTML preview. */
  highlightSkim?: SkimZone;
}

/** Escape the five HTML-significant characters. Input is already ATS-sanitized. */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** ATS-sanitize then HTML-escape a single piece of text content. */
function safe(input: string): string {
  return escapeHtml(sanitizeForAts(input));
}

/** Join present, non-empty values with a separator (after trimming). */
function joinPresent(values: (string | undefined | null)[], sep: string): string {
  return values
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim())
    .join(sep);
}

/** Format a role's date/location right-hand line: "location · start–end". */
function metaLine(
  location: string | undefined,
  start: string,
  end: string,
): string {
  const range = joinPresent([start, end], "-");
  return joinPresent([location, range], " · ");
}

/** True when this experience bullet is in the recruiter skim zone. */
function isSkimBullet(
  zone: SkimZone | undefined,
  roleIndex: number,
  bulletIndex: number,
): boolean {
  if (!zone) return false;
  return zone.experienceBullets.some(
    (b) => b.roleIndex === roleIndex && b.bulletIndex === bulletIndex,
  );
}

export function renderResumeHtml(
  resume: TailoredResume,
  options?: RenderResumeOptions,
): string {
  const zone = options?.highlightSkim;
  const skimClass = (on: boolean) => (on ? " skim-zone" : "");
  const parts: string[] = [];

  // ---- Header --------------------------------------------------------------
  parts.push(`<header class="hdr${skimClass(true)}">`);
  parts.push(`<h1 class="name">${safe(resume.name)}</h1>`);
  if (resume.headline.trim().length > 0) {
    parts.push(`<p class="headline">${safe(resume.headline)}</p>`);
  }
  const contactLine = joinPresent(
    [
      resume.contact.email,
      resume.contact.phone,
      resume.contact.location,
      ...(resume.contact.links || []),
    ],
    " • ",
  );
  if (contactLine.length > 0) {
    // joinPresent uses a literal bullet as the visual separator; sanitizeForAts
    // would convert it to "-", so split, sanitize each piece, and rejoin.
    const contactSafe = contactLine
      .split(" • ")
      .map((p) => safe(p))
      .join(" &bull; ");
    parts.push(`<p class="contact">${contactSafe}</p>`);
  }
  parts.push(`</header>`);

  // ---- Summary -------------------------------------------------------------
  if (resume.summary && resume.summary.text.trim().length > 0) {
    parts.push(`<section class="sec${skimClass(Boolean(zone?.includesSummary))}">`);
    parts.push(`<h2 class="sec-h">${safe(ATS.sectionHeaders.summary)}</h2>`);
    parts.push(`<p class="summary">${safe(resume.summary.text)}</p>`);
    parts.push(`</section>`);
  }

  // ---- Experience ----------------------------------------------------------
  if (resume.experience.length > 0) {
    parts.push(`<section class="sec">`);
    parts.push(`<h2 class="sec-h">${safe(ATS.sectionHeaders.experience)}</h2>`);
    resume.experience.forEach((role, roleIndex) => {
      const left = joinPresent([role.title, role.company], " - ");
      const right = metaLine(role.location, role.start, role.end);
      const roleInSkim = roleIndex === 0;
      parts.push(`<div class="role${skimClass(roleInSkim)}">`);
      parts.push(`<div class="role-line">`);
      parts.push(`<span class="role-left">${safe(left)}</span>`);
      if (right.length > 0) {
        parts.push(`<span class="role-right">${safe(right)}</span>`);
      }
      parts.push(`</div>`);
      const bullets = role.bullets.slice(0, ATS.maxBulletsPerRole);
      if (bullets.length > 0) {
        parts.push(`<ul class="bullets">`);
        bullets.forEach((b, bulletIndex) => {
          if (b.text.trim().length === 0) return;
          const inSkim = isSkimBullet(zone, roleIndex, bulletIndex);
          parts.push(`<li class="${inSkim ? "skim-zone" : ""}">${safe(b.text)}</li>`);
        });
        parts.push(`</ul>`);
      }
      parts.push(`</div>`);
    });
    parts.push(`</section>`);
  }

  // ---- Education -----------------------------------------------------------
  if (resume.education.length > 0) {
    parts.push(`<section class="sec">`);
    parts.push(`<h2 class="sec-h">${safe(ATS.sectionHeaders.education)}</h2>`);
    for (const ed of resume.education) {
      const head = joinPresent([ed.degree, ed.institution], ", ");
      parts.push(`<div class="edu">`);
      parts.push(`<div class="edu-head">${safe(head)}</div>`);
      const meta = joinPresent([ed.location, ed.end], " · ");
      if (meta.length > 0) {
        parts.push(`<div class="edu-meta">${safe(meta)}</div>`);
      }
      if (ed.detail && ed.detail.trim().length > 0) {
        parts.push(`<div class="edu-detail">${safe(ed.detail)}</div>`);
      }
      parts.push(`</div>`);
    }
    parts.push(`</section>`);
  }

  // ---- Skills --------------------------------------------------------------
  if (resume.skills.length > 0) {
    parts.push(`<section class="sec">`);
    parts.push(`<h2 class="sec-h">${safe(ATS.sectionHeaders.skills)}</h2>`);
    resume.skills.forEach((grp, groupIndex) => {
      const list = joinPresent(grp.skills, ", ");
      if (list.length === 0) return;
      const inSkim = zone?.skillGroupIndices.includes(groupIndex) ?? false;
      parts.push(
        `<p class="skill-grp${skimClass(inSkim)}"><span class="skill-name">${safe(
          grp.name,
        )}:</span> ${safe(list)}</p>`,
      );
    });
    parts.push(`</section>`);
  }

  const body = parts.join("\n");
  const docTitle = safe(
    joinPresent([resume.name, "Resume"], " - ") || "Resume",
  );

  // Style: single column, letter page, 0.5in margins, ATS font sizes, print rules.
  const css = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: ${ATS.fontStack};
  font-size: ${ATS.bodyFontPt}pt;
  line-height: 1.35;
  color: #111;
  background: #fff;
}
.page {
  max-width: 7.5in;
  margin: 0 auto;
  padding: 0.5in;
}
.hdr { margin-bottom: 10pt; }
.name {
  font-size: ${ATS.nameFontPt}pt;
  font-weight: 700;
  margin: 0 0 2pt 0;
  letter-spacing: 0.2pt;
}
.headline {
  font-size: ${ATS.bodyFontPt}pt;
  font-weight: 600;
  margin: 0 0 3pt 0;
}
.contact {
  font-size: ${ATS.minFontPt}pt;
  margin: 0;
  color: #222;
}
.sec { margin-top: 12pt; }
.sec-h {
  font-size: ${ATS.headingFontPt}pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5pt;
  margin: 0 0 4pt 0;
  padding-bottom: 2pt;
  border-bottom: 1px solid #333;
}
.summary { margin: 0; }
.role { margin-bottom: 8pt; }
.role-line {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12pt;
}
.role-left { font-weight: 700; }
.role-right {
  font-size: ${ATS.minFontPt}pt;
  color: #333;
  white-space: nowrap;
}
.bullets {
  margin: 3pt 0 0 0;
  padding-left: 16pt;
}
.bullets li { margin: 0 0 2pt 0; }
.edu { margin-bottom: 6pt; }
.edu-head { font-weight: 700; }
.edu-meta, .edu-detail {
  font-size: ${ATS.minFontPt}pt;
  color: #333;
}
.skill-grp { margin: 0 0 3pt 0; }
.skill-name { font-weight: 700; }
.skim-zone {
  background: rgba(34, 139, 87, 0.1);
  border-radius: 2pt;
  box-shadow: inset 0 0 0 1px rgba(34, 139, 87, 0.35);
}
li.skim-zone { padding: 1pt 2pt; margin-left: -2pt; }
.skim-legend {
  font-size: ${ATS.minFontPt}pt;
  color: #1a5c3a;
  background: rgba(34, 139, 87, 0.08);
  border: 1px solid rgba(34, 139, 87, 0.3);
  border-radius: 3pt;
  padding: 4pt 8pt;
  margin-bottom: 8pt;
}
.sec, .role, .edu { break-inside: avoid; page-break-inside: avoid; }
.sec-h { break-after: avoid; page-break-after: avoid; }
@page { size: letter; margin: 0.5in; }
@media print {
  html, body { background: #fff; }
  .page { max-width: none; margin: 0; padding: 0; }
  body { font-size: ${ATS.bodyFontPt}pt; }
  a { color: inherit; text-decoration: none; }
  .skim-zone, .skim-legend { background: transparent; box-shadow: none; border-color: transparent; }
}
`.trim();

  const legend = zone
    ? `<p class="skim-legend"><strong>Recruiter skim preview</strong> - highlighted area ≈ top third / ~6s first pass (name, headline, summary, strongest bullets).</p>`
    : "";

  return [
    `<!DOCTYPE html>`,
    `<html lang="en">`,
    `<head>`,
    `<meta charset="utf-8" />`,
    `<meta name="viewport" content="width=device-width, initial-scale=1" />`,
    `<title>${docTitle}</title>`,
    `<style>${css}</style>`,
    `</head>`,
    `<body>`,
    `<main class="page">`,
    legend,
    body,
    `</main>`,
    `</body>`,
    `</html>`,
  ].join("\n");
}

export function renderResumePlainText(resume: TailoredResume): string {
  const lines: string[] = [];
  const clean = (s: string): string => sanitizeForAts(s);

  // ---- Header --------------------------------------------------------------
  lines.push(clean(resume.name));
  if (resume.headline.trim().length > 0) {
    lines.push(clean(resume.headline));
  }
  const contact = joinPresent(
    [
      resume.contact.email,
      resume.contact.phone,
      resume.contact.location,
      ...(resume.contact.links || []),
    ],
    " | ",
  );
  if (contact.length > 0) {
    // each segment sanitized individually so the separator is preserved
    lines.push(
      contact
        .split(" | ")
        .map((p) => clean(p))
        .join(" | "),
    );
  }

  const section = (header: string): void => {
    lines.push("");
    lines.push(clean(header).toUpperCase());
  };

  // ---- Summary -------------------------------------------------------------
  if (resume.summary && resume.summary.text.trim().length > 0) {
    section(ATS.sectionHeaders.summary);
    lines.push(clean(resume.summary.text));
  }

  // ---- Experience ----------------------------------------------------------
  if (resume.experience.length > 0) {
    section(ATS.sectionHeaders.experience);
    for (const role of resume.experience) {
      const left = joinPresent([role.title, role.company], " - ");
      const right = metaLine(role.location, role.start, role.end);
      lines.push(clean(joinPresent([left, right], "  |  ")));
      const bullets = role.bullets.slice(0, ATS.maxBulletsPerRole);
      for (const b of bullets) {
        if (b.text.trim().length === 0) continue;
        lines.push(`- ${clean(b.text)}`);
      }
    }
  }

  // ---- Education -----------------------------------------------------------
  if (resume.education.length > 0) {
    section(ATS.sectionHeaders.education);
    for (const ed of resume.education) {
      lines.push(clean(joinPresent([ed.degree, ed.institution], ", ")));
      const meta = joinPresent([ed.location, ed.end], " · ");
      if (meta.length > 0) lines.push(clean(meta));
      if (ed.detail && ed.detail.trim().length > 0) lines.push(clean(ed.detail));
    }
  }

  // ---- Skills --------------------------------------------------------------
  if (resume.skills.length > 0) {
    section(ATS.sectionHeaders.skills);
    for (const grp of resume.skills) {
      const list = joinPresent(grp.skills, ", ");
      if (list.length === 0) continue;
      lines.push(`${clean(grp.name)}: ${clean(list)}`);
    }
  }

  return lines.join("\n");
}
