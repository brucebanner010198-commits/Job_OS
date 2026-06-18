# Swarm: ATS & Screening — Research + Implementation Report

**Date:** 2026-06-18  
**Scope:** Resume screening rules, scoring, tailor prompt wiring, tests.

---

## Research Summary

### What triggers ATS flags and rejections

| Issue | Impact | Source |
|-------|--------|--------|
| Tables, multi-column layouts, text boxes | 31–52% parsing failure; scrambled field order | [Haired 10k-CV study (2025)](https://www.haired.app/blog/10000-cvs-ats-errors-study) |
| Graphics, icons, skill bars | Invisible to text parsers | [Indeed ATS guide](https://www.indeed.com/career-advice/resumes-cover-letters/ats-resume-template), [RecruitBPM (2026)](https://recruitbpm.com/blog/ats-optimized-resume-tips-and-tricks) |
| Contact info in headers/footers | ~31% contact parse failures | Haired study; RecruitBPM |
| Non-standard section headings | ~44% of CVs; breaks field mapping | Haired study |
| Keyword match &lt;40% vs JD | ~58% of resumes; 6× lower pass rate vs 70%+ | Haired study |
| Keyword stuffing | Fraud/manipulation flags on modern ATS | RecruitBPM, LockedIn |
| Wrong file type (image PDF, etc.) | Blank or partial parse | [LockedIn](https://www.lockedinai.com/blog/how-ats-systems-reject-resumes-key-errors) |
| Inconsistent dates / job titles | Ranking and tenure miscalculation | Indeed, RecruitBPM |

**Fortune 500 ATS landscape:** Workday, Oracle Taleo, iCIMS, and SAP SuccessFactors dominate; Google, Amazon, Apple use proprietary in-house systems ([JobHire Fortune 500 ATS report, 2026](https://jobhire.ai/blog/fortune-500-use-ats)). Parsing rules still favor clean single-column text.

### Human 6-second skim (recruiter first pass)

Based on TheLadders eye-tracking (2012, replicated 2018) and subsequent recruiter writing:

1. **~6–7 seconds** initial scan — binary advance/reject ([Careerflow](https://www.careerflow.ai/blog/6-second-rule-resume), [Resumefast](https://www.resumefast.io/blog/recruiter-6-second-secret))
2. **~80% of attention** on six data points: name, current title, current employer, current dates, previous title, education
3. **F-pattern scan:** top horizontal sweep → second line → left margin down ([Curriculo](https://curriculo.me/ai-resume-builder/blogs/6-second-resume-test/))
4. **After shape check:** recruiters hunt **digits** in top bullets (%, $, #, x) — unquantified verbs read as empty ([JobLabs](https://joblabs.ai/resume/8-second-cv-scan/))
5. **Headline under name** should match the **target role**, not only current title
6. Resumes with quantified achievements get **~3.2×** more callbacks ([Careerkit citing Resume Research Institute](https://www.careerkit.me/blog/how-to-quantify-resume-bullet-points-for-maximum-impact))

### Google / Amazon norms (public guidance)

| Company | Screening model | Resume expectations |
|---------|-----------------|---------------------|
| **Google** | Proprietary careers profile; human recruiters (no public keyword auto-reject evidence) | Clear formatting, measurable impact, role depth; avoid creative layout and keyword stuffing ([ResumeAdapter Google guide](https://www.resumeadapter.com/companies/google); Laszlo Bock cited on quality-over-keywords) |
| **Amazon** | Proprietary ATS + Bar Raiser loop | STAR bullets with **LP-adjacent verbs + numerals**; at least 2 behavioral artifacts with metrics; single-column text ([ResumeAdapter Amazon guide](https://www.resumeadapter.com/companies/amazon), [Exponent LP interview guide](https://www.tryexponent.com/blog/how-to-nail-amazons-behavioral-interview-questions)) |

### Why tailored resumes beat generic ones in ATS

- Generic resumes often score **&lt;40%** lexical match; tailored resumes reaching **70–80%+** pass filters far more often (Haired: **6×** improvement).
- Keywords should appear in **summary, skills, and experience** — not a footer block (cvtailor, Indeed).
- Include **acronym + full term** on first use (e.g., "Search Engine Optimization (SEO)") ([cvtailor ATS guide](https://www.cvtailor.ai/blog/optimize-resume-for-ats)).
- **15–20 top JD keywords** is the practical target range for 80%+ scores (cvtailor).

---

## What Was Implemented

### 1. `lib/resume/ats-rules.ts` (extended)

- **`ATS_RULES`**: 18 documented rules across `format`, `keywords`, `structure`, `dates`, `file`, `human-skim` with stable ids and severities.
- **`screeningPromptBlock(seniority, jobTitle)`**: Injected into tailor system prompt — 6-second skim structure, headline, top-fold metrics, density, keyword caps.
- **Helpers**: `hasMetricSignal`, `wordCount`, `findKeywordStuffing`, `getAtsRule`.
- **Thresholds**: `keywordMatchPassPercent: 70`, `topFoldMetricBullets: 4`, `maxWordsPerBullet: 35`, page word budgets.

### 2. `lib/resume/screening-score.ts` (new)

- **`scoreScreening({ resume, jobDescription, seniority })`** → composite 0–100 score.
- **Keyword axis (40%)**: reuses `computeAtsMatch` from `lib/scoring/ats-keywords.ts`.
- **Skim clarity (40%)**: headline alignment, metrics in top 4 bullets, date validity, bullet length, word budget.
- **Red-flag penalty (20%)**: block/warn flags from rule ids (`skim-headline-match`, `kw-no-stuffing`, `struct-mm-yyyy`, etc.).
- **Gates**: `passesAts`, `passesSkim`, `exportRecommended`.

### 3. `lib/resume/tailor.ts` (wired)

- System prompt now includes `screeningPromptBlock` with target job title.
- `TailorResult` includes `screening: ScreeningScore` computed post-generation.
- Changed recruiter pass reference from ~10s to **~6-second** skim aligned with research.

### 4. `scripts/test-screening.ts` + `npm run test:screening`

- Tests rule helpers, strong/weak resumes, date validation, stuffing detection, tailored vs generic keyword gap.

### 5. Unchanged but integrated

- **`lib/scoring/ats-keywords.ts`**: lexical JD keyword extraction (used by screening score and `components/jobs/ats-match-panel.tsx`).
- **`lib/resume/bullet-frameworks.ts`**: X-Y-Z, TEAL, STAR, etc. — still mandatory in tailor prompt; screening score rewards metric bullets in top fold.

---

## Scoring Formula (reference)

```
overall = keywordMatch% × 0.4 + skimScore × 0.4 + (20 - redFlagPenalty)

passesAts     = keywordMatch ≥ 70% AND no block-severity red flags
passesSkim    = skimScore ≥ 60 AND headline aligned with forJobTitle
exportRecommended = passesAts AND passesSkim (plus provenance.ok for actual export)
```

---

## Verification

```bash
npm run typecheck
npm run test:screening
npm run test:provenance
```

---

## Follow-ups (not in scope)

- Surface `screening` on resume export UI alongside provenance panel.
- Company-specific LP keyword packs for Amazon targets.
- PDF export validator hooking `ATS_RULES` format ids against rendered HTML.
