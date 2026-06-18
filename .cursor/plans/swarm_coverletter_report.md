# Swarm Cover Letter Report

**Agent:** Cover Letter Swarm  
**Date:** 2026-06-18  
**Scope:** Upgrade `lib/coverletter/` to Fortune 500 / big-tech standards

---

## Research Summary

Public hiring guidance from Microsoft, Google, Amazon, and Fortune 500 recruiter playbooks converges on:

| Dimension | Industry standard |
|-----------|-------------------|
| **Length** | 250–400 words, one page, skimmable in 30–60 seconds |
| **Structure** | Hook → fit → proof → close (3–4 short paragraphs) |
| **Hook** | Lead with a concrete result; never "I am writing to apply" or "I saw your posting" |
| **Fit** | One paragraph tying a **specific JD need** to profile facts |
| **Proof** | Metrics and outcomes from real experience — show, don't tell |
| **Close** | Clear next step / availability; avoid empty "earliest convenience" filler |
| **Specificity** | Name company and role; mirror genuine JD themes (not keyword stuffing) |
| **Avoid** | Generic passion ("passion for…"), flattery ("leader in innovation"), empty soft skills |
| **Resume alignment** | Same employers, titles, dates, metrics — no contradictions |
| **ATS** | Plain text paragraphs; no markdown, HTML, tabs, or special bullet glyphs |

**Sources consulted:** Microsoft recruiting guides (LiftMyCV, YourNextResume), FAANG cover-letter analysis (Mirrai, SkillHub), ATS-focused templates (QuickCV).

---

## Implementation

### 1. Generation prompt (`lib/coverletter/generate.ts`)

- Added explicit **F500 structure template** (hook → fit → proof → close).
- Reinforced extractive-only rules and **resume alignment** (no contradictions).
- Banned passion clichés and boilerplate openers in system prompt.
- ATS plain-text requirements (no markdown/HTML/bullets).

### 2. Standards module (`lib/coverletter/standards.ts`)

Constants:

- `COVER_LETTER_WORD_COUNT_MIN` / `MAX` (250–400)
- `COVER_LETTER_PARAGRAPH_MIN` / `MAX` (3–4)
- `GENERIC_OPENERS`, `PASSION_CLICHES`, `ATS_UNFRIENDLY_PATTERNS`

Validation via `validateCoverLetterStandards()`:

| Check ID | Severity when fail |
|----------|-------------------|
| `word_count` | warn |
| `structure` | warn |
| `company_name` | **fail** |
| `role_title` | **fail** |
| `strong_hook` | **fail** |
| `jd_specificity` | warn |
| `no_passion_cliches` | warn |
| `ats_plain_text` | warn |
| `provenance` | **fail** |
| `not_generic` | warn |

### 3. Provenance module (`lib/coverletter/provenance.ts`)

- `auditCoverLetterProvenance()` mirrors `lib/resume/provenance.ts` patterns.
- Validates cited fact IDs against allowed profile facts.
- Boundary-aware metric grounding via shared `lib/util/metrics.ts`.
- `provenanceViolationsToStrings()` preserves legacy violation format.

### 4. UI (`components/resume/resume-workspace.tsx`)

- Cover letter tab shows **Standards checklist** with pass/fail icons and hints.
- Badge: "Meets standards" vs "Standards gaps" from `allCriticalPass`.
- Persisted letters re-validate on load using target company/title.

### 5. Tests

- `scripts/test-coverletter-standards.ts` — standards + provenance unit tests (no LLM/DB).
- npm script: `test:coverletter-standards`

---

## Files Changed

| File | Change |
|------|--------|
| `lib/coverletter/standards.ts` | **New** — constants + validation |
| `lib/coverletter/provenance.ts` | **New** — provenance audit |
| `lib/coverletter/generate.ts` | F500 prompt + standards/provenance integration |
| `app/actions/resume.ts` | Return `standards` in action result |
| `components/resume/resume-workspace.tsx` | Standards checklist UI |
| `scripts/test-coverletter-standards.ts` | **New** test script |
| `package.json` | `test:coverletter-standards` script |

---

## Verification

```bash
npm run typecheck
npm run test:coverletter-standards
npm run test:provenance
```

All should pass.

---

## Follow-ups (out of scope)

- Persist `violations` / `standards` JSON on `CoverLetter` model for historical audit.
- Cross-check cover letter metrics against latest tailored resume in one pass.
- Regenerate-on-fail loop when standards critical checks fail.
