# Onboarding Implementation Plan — Two-Scenario Resume + Coaching Flow

**Status:** executing  
**Repo:** `/Users/sj1136/Documents/06_Software_And_Code/Personal/Job_OS`  
**Aligns with:** `resume_onboarding_prompt_06d9fd40.plan.md`, `ux_flow_consolidation_plan.md`

---

## 1. Codebase research summary

### Reuse as-is

| Module | Path | Role in onboarding |
|--------|------|-------------------|
| Resume extract | `lib/profile/extract.ts` | `extractFromResume`, `extractFromDictation` |
| Cold import | `lib/import/import.ts` | Path A paste → entries + note |
| Goals elicit | `lib/goals/elicit.ts` | `suggestGoalQuestions`, `synthesizeGoals` |
| Profile persist | `lib/profile/service.ts` | `addEntries`, `saveNote`, `listFacts` |
| Profile actions | `app/actions/profile.ts` | `importResumeAction`, `saveDictationAction` |
| Goals actions | `app/actions/goals.ts` | `saveGoalsAction`, `synthesizeGoalsAction` |
| Setup gate | `lib/pipeline/setup-status.ts` | `hasResume` + `hasGoals` → complete |
| Career refresh | `lib/career/trigger.ts` | `scheduleCareerRefresh` after profile |
| Import UI | `components/import/import-form.tsx` | Path A paste (embedded) |
| Voice input | `components/dictation/voice-input.tsx` | Path B + coaching input |
| Setup host | `app/(app)/setup/page.tsx` | Extend, do not duplicate `/onboarding` |

### Gaps (build new)

| Gap | Solution |
|-----|----------|
| Two-path entry | `components/pipeline/path-selector.tsx` |
| No-resume intake | `components/pipeline/no-resume-intake.tsx` |
| Multi-turn coaching + stop logic | `lib/onboarding/coaching.ts` + `coaching-panel.tsx` |
| Profile compilation w/ provenance | `lib/onboarding/profile-compiler.ts` |
| Server boundary | `app/actions/onboarding.ts` |
| Wizard orchestration | Extend `setup-wizard.tsx` (4 phases) |

### Locked decisions preserved

- OpenRouter LLM via `lib/ai/openrouter.ts`
- Local-first; no invented facts; `inferred` flags on uncertain fields
- Extend `/setup` wizard — `/onboarding` link hub unchanged

---

## 2. UI flow (text wireframe)

```
/setup
  Step 1: Choose path
    [I have a resume]  [I don't have a resume]

  Step 2: Intake (path-specific)
    Path A: ImportForm (paste) → preview entry count/kinds
    Path B: [Paste what you know] | [Start conversation] → optional initial extract

  Step 3: Career coaching (shared)
    Multi-turn chat; clarifying questions; intelligent stop
    Phases: history → education/skills → goals → confirm done

  Step 4: Review & complete
    Profile preview (compiled entries + goals)
    [Save profile] → scheduleCareerRefresh → /jobs
```

Skip coaching (Path A only): warn → `setupPartial` note in coaching state; compile from resume only.

---

## 3. Data model

- **CoachingTurn** `{ role, content }` — client-held transcript, sent each server turn
- **OnboardingPath** `"resume" | "no-resume"`
- **CompiledEntry** extends extract schema with `provenance: "resume" | "paste" | "conversation"` and `inferred?: boolean` in `data`
- **ProfileNote.source** values: `import | dictation | onboarding-coaching | onboarding-paste`
- No new Prisma tables for v1

---

## 4. API / server actions (`app/actions/onboarding.ts`)

| Action | Input | Output |
|--------|-------|--------|
| `startCoachingAction` | path, optional initialPaste | opening assistant message + coverage |
| `coachingTurnAction` | path, turns[], userMessage | assistant reply + coverage + shouldStop |
| `compileOnboardingProfileAction` | path, turns[], initialPaste? | preview entries + goals |
| `completeOnboardingAction` | path, turns[], goals, skipCoaching? | persist + refresh |

---

## 5. File change list

| File | Change |
|------|--------|
| `lib/onboarding/types.ts` | **NEW** — shared types |
| `lib/onboarding/coaching.ts` | **NEW** — orchestrator + stop logic |
| `lib/onboarding/profile-compiler.ts` | **NEW** — merge + provenance |
| `app/actions/onboarding.ts` | **NEW** — server actions |
| `components/pipeline/path-selector.tsx` | **NEW** |
| `components/pipeline/no-resume-intake.tsx` | **NEW** |
| `components/pipeline/coaching-panel.tsx` | **NEW** |
| `components/pipeline/profile-review-panel.tsx` | **NEW** |
| `components/pipeline/setup-wizard.tsx` | **MODIFY** — 4-step two-path flow |
| `app/(app)/setup/page.tsx` | **MODIFY** — copy + initial step |
| `lib/ai/models.ts` | **MODIFY** — add `onboardingCoaching` task |
| `lib/pipeline/setup-status.ts` | **MODIFY** — optional `setupPartial` |

---

## 6. Parallel workstreams (completed sequentially by integrator)

1. **UI shell** — path selector, intake panels, wizard steps
2. **Coaching service** — `coaching.ts` + actions
3. **Profile compiler** — `profile-compiler.ts` + review panel
4. **Integration** — wire wizard, persistence, typecheck

Merge points: coaching stage entry (needs intake context), final compile step.

---

## 7. Stop-condition logic (coaching.ts)

- LLM returns JSON: `{ assistantMessage, coverage, shouldStop, finalGapCheck? }`
- **Do not stop** while critical gaps remain unless user declined twice on same topic
- **Stop** when: major sections confirmed + goals direction stated + user confirms OR `shouldStop` with `finalGapCheck` acknowledged
- User "that's everything" → one final gap summary question before stop

---

## 8. Verification

- Path A: paste resume → coaching → compile → `hasResume && hasGoals`
- Path B: paste/converse → coaching → compile → same complete state
- `npm run typecheck` passes
