---
name: Competitor Fault Fixes Report
status: complete
repo: /Users/sj1136/Documents/06_Software_And_Code/Personal/Job_OS
updated: 2026-06-18
sources: competitive_landscape_research.md, job_os_competitive_enhancement_plan.md, ux_flow_consolidation_plan.md
---

# Competitor Fault → Job OS Fix Report

## Summary

Implemented **9 shippable features** from the competitor fault matrix. **3 items deferred** (questionnaire gate, outcome learnings feed, Knowledge Notebook ATS wire). Nav collapse landed via polish agent dashboard refactor (`All tools` collapsible).

---

## Per-competitor catalog

### LazyApply / LoopCV — spray-and-pray, no review, account bans

| Field | Detail |
|-------|--------|
| **Fault** | Volume auto-apply without human review; Trustpilot ~2.3–2.4★; LinkedIn ban risk |
| **Evidence** | competitive_landscape_research.md §3.2 LazyApply, LoopCV; judgment plan §6 risks |
| **Job OS fix** | Visible AUTONOMOUS/ASSISTED/MANUAL tags on job cards; apply ethics policy callout |
| **Implementation** | `lib/pipeline/route-preview.ts`, `JobView.routePreview`, `components/pipeline/route-badge.tsx`, `components/apply/autopilot-policy-callout.tsx` |
| **Status** | **done** |

### Teal / Huntr — cloud lock-in, data export pain

| Field | Detail |
|-------|--------|
| **Fault** | Cloud-only CRM; resume trapped in vendor; limited export |
| **Evidence** | competitive_landscape_research.md §3.2 Teal/Huntr; SWOT weaknesses |
| **Job OS fix** | Local-first badge + prominent export/backup CTA on dashboard |
| **Implementation** | `components/local-first-badge.tsx`, wired on `app/(app)/page.tsx` with link to `/backups` |
| **Status** | **done** |

### Simplify — extension-only, no full pipeline

| Field | Detail |
|-------|--------|
| **Fault** | Autofill + manual submit only; no discover → brief → track → interview |
| **Evidence** | competitive_enhancement_plan.md corrected facts (manual submit); landscape §3.2 |
| **Job OS fix** | Minimal pipeline stage indicator on job cards |
| **Implementation** | `components/jobs/pipeline-stage-badge.tsx` on `JobsQueue` rows |
| **Status** | **done** |

### Jobscan — keyword stuffing, no provenance

| Field | Detail |
|-------|--------|
| **Fault** | Expensive ATS scanner; encourages keyword stuffing without source grounding |
| **Evidence** | landscape §3.2 Jobscan; enhancement plan p7-ats-score |
| **Job OS fix** | Lexical ATS match % + gap list on job expand (MVP, no new API deps) |
| **Implementation** | `lib/scoring/ats-keywords.ts`, `components/jobs/ats-match-panel.tsx` |
| **Status** | **done** (full Knowledge Notebook wire → **deferred** as `cmp-knowledge-ats-wire`) |

### Crunchbase briefs — paywalled, uncited

| Field | Detail |
|-------|--------|
| **Fault** | Shallow free tier; aggregator blurbs without primary citations |
| **Evidence** | landscape §3.6; master plan Crunchbase removal |
| **Job OS fix** | Cited source count badge on company brief view |
| **Implementation** | `components/brief/cited-sources-badge.tsx` in `BriefResults` |
| **Status** | **done** |

### Career Ops — CLI-only, no Gmail/interview

| Field | Detail |
|-------|--------|
| **Fault** | No web app, no Gmail sync, no voice interview in santifer CLI |
| **Evidence** | landscape §3.1 Career Ops weaknesses |
| **Job OS fix** | Surface "full OS" differentiator on home vs CLI peers |
| **Implementation** | Three comparison cards on dashboard (`app/(app)/page.tsx`) |
| **Status** | **done** |

### Mass apply tools — no rejection learning

| Field | Detail |
|-------|--------|
| **Fault** | Rejections logged but not turned into actionable improvements |
| **Evidence** | ux_flow_consolidation_plan.md §10 rejection intelligence |
| **Job OS fix** | `lib/track/rejection-learning.ts`; store `ProfileNote` on REJECTED confirm |
| **Implementation** | Hook in `lib/track/service.ts` `confirmProposal` |
| **Status** | **done** (Outcome stage feed → **deferred** as `cmp-outcome-learnings-feed`) |

### Interview bots (Yoodli, generic AI) — no company context

| Field | Detail |
|-------|--------|
| **Fault** | Delivery coaching without role/company grounding |
| **Evidence** | landscape §3.5; ux plan §11 questionnaire gate |
| **Job OS fix** | Soft readiness gate: brief + study guide before voice unlock |
| **Implementation** | `components/interview/readiness-gate.tsx` in `interview-board.tsx` |
| **Status** | **done** (hard questionnaire → **deferred** as `cmp-questionnaire-gate`) |

### SaaS clutter — 20 nav items

| Field | Detail |
|-------|--------|
| **Fault** | Flat 16-item nav overwhelms new users |
| **Evidence** | ux_flow_consolidation_plan.md §1.1 |
| **Job OS fix** | Collapse secondary modules under "Tools" |
| **Implementation** | Polish agent: dashboard `All tools` `<details>` + pipeline stages in `lib/pipeline/stages.ts` |
| **Status** | **done** (by polish agent `780f9df4`; not re-edited `app-shell.tsx`) |

---

## Tests

| Script | Coverage |
|--------|----------|
| `npm run test:competitor-fixes` | Route preview, ATS keywords, rejection learning parser |

---

## Verification (2026-06-18)

| Command | Result |
|---------|--------|
| `npm run test:competitor-fixes` | **11/11 passed** |
| `npm run build` | **exit 0** |
| `npm run typecheck` | **4 errors** — pre-existing from parallel polish agent (`app-shell.tsx`, `resume-workspace.tsx`, `lib/resume/tailor.ts`); none in `cmp-*` files |

---

## Deferred items

| ID | Reason |
|----|--------|
| `cmp-questionnaire-gate` | Requires `lib/interview/questionnaire.ts` + storage — Phase 8 scope |
| `cmp-outcome-learnings-feed` | Needs `/pipeline/outcome` stage (ux-outcome-stage pending) |
| `cmp-knowledge-ats-wire` | Depends on `p3-ats-keywords` Knowledge Notebook integration |

---

*Report complete — see master plan §16 for `cmp-*` task IDs.*
