# Swarm Resume Tailoring Report

**Agent:** Resume skim / tailoring  
**Date:** 2026-06-18  
**Coordination:** Merged additively with ATS agent work (`ats-rules.ts`, `screening-score.ts`, `screeningPromptBlock`)

---

## Summary

Implemented recruiter **6-second skim** optimization as a post-processing layer on tailored resume JSON, HTML highlight rendering, and a **Recruiter skim** preview tab in the resume workspace. Prompt criteria for F500 screening were already landed by the ATS agent via `screeningPromptBlock()` — this swarm wired layout + UI on top without duplicating prompt text.

---

## Changes

### 1. `lib/resume/skim-layout.ts` (new)

- **`applySkimLayout()`** — deterministic post-process after LLM generation:
  - Reorders bullets within each role (metric-heavy first via `extractMetrics` scoring)
  - Reorders skill groups when `keywordsMatched` is present (JD-aligned groups first)
  - Preserves reverse-chronological role order (does not reorder experience entries)
  - Caps bullets at `ATS.maxBulletsPerRole`
- **`computeSkimZone()`** — maps top-third skim content: header, summary, first role + top 2 bullets, first 2 skill groups
- **`findStrongestMetric()`** — identifies best quantified bullet for diagnostics

### 2. `lib/resume/tailor.ts`

- Calls `applySkimLayout()` after `chatJson`, before provenance + `scoreScreening`
- `TailorResult` now includes `skim: SkimLayoutResult`
- System prompt uses existing `screeningPromptBlock(seniority, jobTitle)` from ATS rules (no duplicate prompt block)

### 3. `lib/resume/render.ts`

- `RenderResumeOptions.highlightSkim?: SkimZone`
- Adds `.skim-zone` CSS highlight + legend when rendering skim preview
- Highlights: header, summary, first role line, top-fold bullets, matched skill groups
- Print CSS strips highlights so exported PDF stays clean

### 4. `app/actions/resume.ts`

- `TailorActionResult` extended: `skimHtml`, `screening`
- Returns both normal HTML and skim-highlighted HTML

### 5. `app/(app)/resume/page.tsx`

- Re-applies `applySkimLayout` + `scoreScreening` when loading stored resume versions
- Passes `skimHtml` + `screening` to workspace

### 6. `components/resume/resume-workspace.tsx`

- New **Recruiter skim** tab with highlighted iframe
- ATS % and skim score badges on Resume tab
- Red-flag list on skim tab from `screening.redFlags`
- Deep-link support: `?company=&title=` opens skim tab by default

### 7. Tests

- **`scripts/test-resume-skim.ts`** — 12 assertions (bullet reorder, zone map, provenance preserved, HTML highlight, screening lift)
- **`npm run test:resume-skim`** added to `package.json`
- Existing **`test:provenance`** (11) and **`test:screening`** (20) still pass

---

## HR skim principles → implementation map

| Principle | Implementation |
|-----------|----------------|
| Top third: role title, value prop, strongest metric | `screeningPromptBlock` (LLM) + `applySkimLayout` (metric-first bullets) + `computeSkimZone` (UI highlight) |
| Scannable: bold roles, consistent dates | `render.ts` role-line styling; `struct-mm-yyyy` rule in screening |
| JD keywords without stuffing | `keywordsMatched` skill reorder; `ATS.maxKeywordRepeat` in prompt + `findKeywordStuffing` |
| One page default &lt;10 years | `ATS.pageTargetBySeniority` + word budget in screening |
| Lead with outcomes | Bullet frameworks (TEAL/XYZ prefer metrics); filler deprioritized in skim sort |

---

## ATS integration (existing, not duplicated)

| Module | Role |
|--------|------|
| `lib/resume/ats-rules.ts` | `ATS` constants, `screeningPromptBlock`, `hasMetricSignal`, `ATS_RULES` catalog |
| `lib/resume/screening-score.ts` | Post-tailor keyword + skim composite score |
| `lib/scoring/ats-keywords.ts` | Lexical JD match % |

---

## Test results

```
npm run test:resume-skim  → 12 passed
npm run test:provenance   → 11 passed
npm run test:screening    → 20 passed
```

Resume module files typecheck clean. Full-project `npm run typecheck` may fail on unrelated parallel-agent edits (apply driver, track page) outside this swarm's scope.

---

## Files touched

| File | Action |
|------|--------|
| `lib/resume/skim-layout.ts` | Created |
| `lib/resume/tailor.ts` | Integrated skim post-process |
| `lib/resume/render.ts` | Skim highlight rendering |
| `app/actions/resume.ts` | `skimHtml` + `screening` in action result |
| `app/(app)/resume/page.tsx` | Skim HTML on page load |
| `components/resume/resume-workspace.tsx` | Recruiter skim tab + badges |
| `scripts/test-resume-skim.ts` | Created |
| `package.json` | `test:resume-skim` script |
| `scripts/test-e2e-journey.ts` | TailorResult shape fix (additive) |

---

## Follow-ups (out of scope)

- Persist `screening` score on `ResumeVersion` row for historical comparison
- Surface skim score on job cards / ATS match panel
- Auto-open skim tab when `exportRecommended === false` with actionable fixes
