---
name: Product Vision — Job Training Package & HR Connection
status: active
updated: 2026-06-18
repo: /Users/sj1136/Documents/06_Software_And_Code/Personal/Job_OS
related:
  - .cursor/plans/job_os_master_execution_plan.md (§18)
  - lib/track/rejection-learning.ts
  - lib/candidate/gap-analysis.ts
  - lib/brief/hr-contacts.ts
  - lib/goals/dream-companies.ts
---

# Job Training Package & HR Connection — Product Vision

## Dual value proposition

| For applicants | For HR reviewers |
|----------------|------------------|
| Transform materials to Fortune 500 skim standards | Faster, clearer signal in 6–7 second skim |
| Understand *why* rejected and what to fix | Less noise — tailored, ATS-parseable packets |
| Right role → right contact path (warm, ethical) | Consistent structure: headline, metrics, cited claims |

Job OS is not a spray-and-pray auto-applier. It is a **training operating system** that prepares the candidate, then proposes actions the human approves.

---

## Dream company targeting pipeline

```
Career goals → Dream company board → Company brief → Gap analysis → Tailor → Apply → Track → Coach notes
```

1. **Goals** (`/goals`) — north-star, industries, target titles drive discovery scoring.
2. **Dream company board** (`lib/goals/dream-companies.ts`) — explicit employer list tied to goals; suggestions from industries, user curates.
3. **Brief** (`/companies`) — web-research, entailment-checked claims; leadership/culture context.
4. **Gap analysis** (`lib/candidate/gap-analysis.ts`) — profile vs JD + brief → prioritized gaps (skill, experience, format, leadership).
5. **Tailor** (`/resume`) — ATS rules + cover letter F500 standards (`lib/coverletter/standards.ts`).
6. **Apply** (`/apply`) — route-aware; AUTONOMOUS-only auto-submit.
7. **Track** (`/track`) — Gmail propose-only; rejection → categorized explanation → coach note.

---

## HR contact model

**Roles surfaced (intelligence only):**

| Role | Typical owner | How Job OS surfaces |
|------|---------------|---------------------|
| Recruiter | Req owner, campus/tech recruiting | Careers page patterns; brief + JD footer hints |
| Hiring manager | Team lead for the role | Leadership claims from verified brief |
| Talent partner | Sourcing, pipeline | Manual LinkedIn search guidance (user-initiated) |
| HR generalist | Process, scheduling | Official careers contact |

Implementation: `lib/brief/hr-contacts.ts` — pure extraction from `CompanyBriefData` leadership claims + careers URL. **No LinkedIn scraping** (ToS-safe). Connection = ranked warm-path drafts + outreach tips, not automated send.

Ethical warm-path (`lib/warm/`):

- Draft intros are **extractive** (profile facts only).
- User edits and sends from their own account.
- At most one ask per company; NONE path → apply cold recommendation.

---

## Rejection transparency loop

```
Gmail inbox → status proposal (human confirms) → parseRejectionLearning + explainRejection
  → categories: fit | experience | timing | formatting | unknown
  → fixes by module (resume, training, goals, warm-path)
  → ProfileNote source=coach (Knowledge Notebook)
```

Industry-standard feedback mapping:

- **Fit** — "other candidates", "more closely match" → tighten goals, warm-path first.
- **Experience** — skills/years gaps → gap analysis, re-tailor.
- **Timing** — filled role, freeze → follow-up cadence, not skill verdict.
- **Formatting** — incomplete/missing → apply + resume standards.
- **Unknown** — generic pass → training hub review checklist.

Never auto-reapply or auto-edit profile.

---

## Training modules map

| App section | Teaches | Standards / lib |
|-------------|---------|-----------------|
| `/training` | Hub — full package overview | This doc |
| `/setup`, `/import` | Cold-start, master resume | Import provenance |
| `/master-resume` | Resume 101 | `lib/resume/ats-rules.ts`, skim layout |
| `/resume` | Tailor + cover letter | `lib/coverletter/standards.ts` |
| `/goals` | Direction + dream board | `lib/goals/dream-companies.ts` |
| `/companies` | Brief + HR hints | `lib/brief/hr-contacts.ts` |
| `/jobs` | Discovery, ATS match panel | `lib/scoring/ats-keywords.ts` |
| `/apply` | Route policy, human gate | `lib/pipeline/route-preview.ts` |
| `/track` | Rejection learning | `lib/track/rejection-learning.ts` |
| `/interview` | Readiness gate, voice prep | `lib/interview/` |
| `/warm-path` | Referral drafts | `lib/warm/draft.ts` |

Coach notes (`lib/coach/notes.ts`): rejection and gap fixes persist as `ProfileNote` with `source: "coach"` for RAG retrieval.

---

## Fortune 500 standards (shared filter)

Applicants and HR both benefit when materials pass the same skim gate:

- **Resume**: single column, 10–10.5pt serif/sans, quantified top-fold bullets, 70%+ keyword band (`ATS.keywordMatchPassPercent`).
- **Cover letter**: 250–400 words, 3–4 paragraphs, company + role named, no passion clichés.
- **Brief**: every claim cited and entailment-checked — no hallucinated company facts.
- **Apply**: knockout answers truthful; incomplete applications flagged as formatting rejection risk.

---

## Ethical bounds (locked)

| Allowed | Forbidden |
|---------|-----------|
| Gmail status **proposals** | Auto-confirm status changes |
| Warm-path / HR **drafts** | Auto-send email or LinkedIn messages |
| Web research for briefs | LinkedIn scraping or bulk InMail |
| Gap/rejection **coach notes** | Auto-modify master profile or re-submit |

---

## Implementation status (2026-06-18)

| Feature | Path | Status |
|---------|------|--------|
| Dream company board | `lib/goals/dream-companies.ts`, goals UI | shipped |
| Gap analysis | `lib/candidate/gap-analysis.ts` | shipped (pure) |
| Rejection explainer | `explainRejection()` in rejection-learning | shipped |
| HR contact hints | `lib/brief/hr-contacts.ts` | shipped (pure) |
| Training hub | `/training` | shipped |
| Coach notes | `lib/coach/notes.ts` | shipped |
| Brief UI: HR hints panel | companies workspace | deferred (`train-hr-ui`) |
| Gap analysis on job card | jobs queue expand | deferred (`train-gap-ui`) |
| Hire probability score | cross-signal model | deferred (hire-probability agent) |
| Outcome stage learnings feed | `/outcomes` | deferred (`ux-outcome-stage`) |
