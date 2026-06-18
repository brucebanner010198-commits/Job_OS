# Frontend Review Report

- **Timestamp:** 2026-06-18
- **Reviewer agent ID:** frontend-review

---

## Executive summary

Job OS has a **mature, shippable module UI** across 18 routes with consistent patterns: server pages + `safeDb` fallbacks, `DbBanner` for DB outages, preview fixtures when empty, and a solid theme/profile shell. **Typecheck passes** after a clean `.next` wipe.

**Partial UX consolidation is in flight:** `PipelineRail` (6 stages), `SettingsToolsPanel`, `/setup` wizard, and `RouteBadge` on job cards exist — but the **legacy 16-item flat nav remains**, producing **triple navigation** (pipeline rail + full module list + settings drawer). This is the top UX debt item.

**Build:** `next build` compiles and type-checks successfully, but **fails at the standalone trace step** (`output: "standalone"` in `next.config.ts`) with `ENOENT` copying client-reference manifests — a deployment/Tauri packaging issue, not a React compile error.

**Fixes applied this session (5):** track-board silent move failures, ActionFeedback theme tokens, master-resume client navigation, dashboard → onboarding link, unused import cleanup.

**What works well:** dark/light theme (FOUC-free `ThemeScript`), profile switcher with create/delete, Gmail propose-only copy on Track, apply review gate + route badges, interview offline STUDY mode, consistent page headers and card styling.

---

## Screen inventory table

| Route | Nav entry | Purpose | Key components | Backend / actions | Status | Issues |
|-------|-----------|---------|----------------|-------------------|--------|--------|
| `/` | Dashboard | Module catalog + KPI strip + autopilot badge | `DbBanner`, module cards from `lib/modules` | `getMetricsView`, `autopilotStatus`, `safeDb` | **Ready** | Reads as feature grid, not pipeline; KPI duplicates Outcomes |
| `/setup` | Pipeline rail only | 3-step setup wizard + ready check | `SetupStepper`, `PageHeader`, `DbBanner` | `getSetupStatus` (`lib/pipeline/setup-status`) | **Partial** | Not in flat NAV; stepper links out to legacy routes; `activeStep` highlights "Update" when complete |
| `/onboarding` | Settings panel only | 4-card link hub (resume, goals, apply answers, integrations) | Static cards | None (link-out) | **Orphaned** | Superseded by `/setup`; now reachable via Settings + dashboard CTA |
| `/import` | Nav + Settings | Paste resume → profile | `ImportForm` | `importResumeAction` | **Ready** | No `DbBanner`; paste-only; duplicated in Setup step 1 |
| `/master-resume` | Nav | Master profile + dictation | `DictationPanel`, entry list | `listFacts`, dictation actions | **Live** | No file upload; import link-out only |
| `/goals` | Nav | Career goals synthesize + edit | `GoalsWorkspace`, `VoiceInput` | `getGoal`, goals actions | **Live** | Not conversational voice agent (planned) |
| `/resume` | Nav + Settings | Per-job tailored resume + cover | `ResumeWorkspace` | `db.target`, tailor actions | **Live** | Requires targets in DB; no job-picker from queue |
| `/jobs` | Nav (Searching stage) | Discover → screen → score queue | `JobsQueue`, `RouteBadge` | `listQueue`, `discoverJobsAction` | **Partial** | Manual Discover primary; route badges wired |
| `/companies` | Nav + Settings | Cited company briefs | `CompanyBriefWorkspace` | `listBriefedCompanies`, brief actions | **Partial** | Manual company pick; not inline on apply |
| `/apply` | Nav (Applying) | Prepare → review → submit | `ApplyWorkspace` (local `RouteBadge`) | `getAnswers`, `listApplications`, apply actions | **Partial** | Duplicate RouteBadge vs shared component; handoff UI partial |
| `/track` | Nav (Applied) | Kanban + Gmail proposals | `InboxProposals`, `TrackBoard` | `getBoardView`, `listProposalViews`, track actions, Gmail OAuth | **Partial** | Kanban 6-col cramped on mobile; move errors now surfaced |
| `/warm-path` | Nav + Settings | Referral path drafts | `WarmList`, `RefreshConnections` | `getWarmBoard`, warm actions | **Fixture** | Sample data when empty |
| `/boosters` | Nav + Settings | Follow-ups + salary coach | `FollowUpList`, `SalaryCoach` | `getFollowUpViews`, `listOfferApplications` | **Live** | Follow-ups use ActionFeedback; salary is client-only |
| `/interview` | Nav (Interview) | Study + voice mocks | `InterviewBoard`, `MockSession`, `StudyGuide` | `getInterviewBoard`, interview actions | **Partial** | No prerequisite gate; tabs not sequential |
| `/linkedin` | Nav + Settings | Profile audit | `LinkedInOptimizer` | `listFacts` (seed text) | **Fixture** | Manual paste; fixture scoring |
| `/outcomes` | Nav + Settings (also Outcome stage) | KPI dashboard + scheduler | `HeadlineStats`, `FunnelBar`, `LaneTable`, `AutomationPanel` | `getMetricsView`, `getOpsView` | **Live** | Overlaps dashboard KPIs |
| `/integrations` | Nav + Settings | API keys portal | `IntegrationsWorkspace` | `listIntegrationsAction` | **Live** | Also in onboarding step 4 |
| `/backups` | Nav + Settings | Encrypted snapshots + export | `BackupPanel` | `getBackupView`, backup API routes | **Live** | — |

**Non-page shell:** `app/(app)/layout.tsx` → `AppShell` with `homeStage` from setup status; `loading.tsx` (spinner); `error.tsx` (reset button).

---

## Navigation / UX flow assessment

### Current IA (hybrid — migration in progress)

```
Sidebar (desktop) / drawer (mobile):
├── PipelineRail (6 stages)     ← NEW, maps to legacy routes
├── NAV (16 flat modules)       ← LEGACY, full list
├── SettingsToolsPanel          ← NEW, collapsible power tools + onboarding
├── ProfileSwitcher
└── ThemeToggle
```

**Pipeline stage → route mapping** (`lib/pipeline/stages.ts`):

| Stage | Primary href | Also maps |
|-------|--------------|-----------|
| Setup | `/setup` | `/onboarding`, `/import`, `/master-resume`, `/goals` |
| Searching | `/jobs` | — |
| Applying | `/apply` | `/companies`, `/resume` |
| Applied | `/track` | — |
| Interview | `/interview` | — |
| Outcome | `/outcomes` | — |

**Not in pipeline rail:** `/`, `/integrations`, `/backups`, `/linkedin`, `/warm-path`, `/boosters` (some duplicated in Settings panel).

### Flow friction (vs UX consolidation plan)

| User goal | Current path | Clicks / cognitive load |
|-----------|--------------|-------------------------|
| First-time setup | Dashboard → Settings → Onboarding **or** Pipeline Setup → link-outs | 3–6 pages, no embedded wizard |
| Find jobs to apply | Jobs → Discover → expand row → Apply nav | Route badge helps; still manual discover |
| See what needs human | Apply workspace only | ASSISTED queue not split on dashboard |
| Gmail → Interview | Track → confirm proposal → Interview nav | Correct safety; extra nav hop |
| Interview prep | Companies + Interview (all modes open) | No checklist gate |

### Mobile vs desktop

| Aspect | Desktop | Mobile |
|--------|---------|--------|
| Shell | Fixed 240px sidebar | Header + collapsible drawer |
| Profile switcher | Sidebar footer + sm+ header | Drawer + sm+ header |
| Pipeline rail | Visible above module nav | Visible in drawer |
| Track kanban | 6 columns (`lg:grid-cols-6`) | Single column stack — usable but long scroll |
| Theme toggle | Sidebar footer | Header |

**Mobile gap:** Drawer lists pipeline rail **plus** 16 modules — very long scroll; no backdrop tap-to-close (only hamburger toggle).

### Loading / error boundaries

| Mechanism | Coverage |
|-----------|----------|
| `app/(app)/loading.tsx` | Route-level suspense fallback (spinner) |
| `app/(app)/error.tsx` | Route error boundary with retry |
| `DbBanner` | Most data pages when `safeDb` fails |
| `ActionFeedback` + `useActionFeedback` | Track proposals, warm-path, follow-ups, **track-board moves (fixed)** |
| Ad-hoc `setError` state | Apply, resume, integrations, import, profile-switcher — inconsistent pattern |

---

## Component health table

| Component | Location | Health | Notes |
|-----------|----------|--------|-------|
| `AppShell` | `components/app-shell.tsx` | **Yellow** | Pipeline rail + legacy NAV = clutter; `homeStage` wired |
| `PipelineRail` | `components/pipeline/pipeline-rail.tsx` | **Green** | Clean 6-stage nav; pathname-aware |
| `SettingsToolsPanel` | `components/settings-tools-panel.tsx` | **Green** | Collapsible; includes onboarding link |
| `SetupStepper` | `components/pipeline/setup-stepper.tsx` | **Yellow** | Link-out cards, not embedded steps |
| `RouteBadge` | `components/pipeline/route-badge.tsx` | **Green** | Used in `JobsQueue`; duplicate in `apply-workspace` |
| `ProfileSwitcher` | `components/profile-switcher.tsx` | **Green** | Create/switch/delete; localStorage sync |
| `ThemeToggle` | `components/theme-toggle.tsx` | **Green** | Light/dark only (no system toggle in UI) |
| `ThemeProvider` + `ThemeScript` | `components/theme-*` | **Green** | No FOUC; tokens in `globals.css` |
| `ActionFeedback` | `components/action-feedback.tsx` | **Green** | Tokens fixed; hook pattern solid |
| `ApplyWorkspace` | `components/apply/apply-workspace.tsx` | **Yellow** | Large (~900 LOC); local RouteBadge; ad-hoc errors |
| `JobsQueue` | `components/jobs/jobs-queue.tsx` | **Green** | Route badges + explainable scores |
| `TrackBoard` | `components/track/track-board.tsx` | **Green** | ActionFeedback added for failed moves |
| `InboxProposals` | `components/track/inbox-proposals.tsx` | **Green** | Propose-only UX correct |
| `InterviewBoard` | `components/interview/interview-board.tsx` | **Yellow** | No progression lock |
| `IntegrationsWorkspace` | `components/integrations/integrations-workspace.tsx` | **Green** | Keys never re-shown |
| `DbBanner` | `components/db-banner.tsx` | **Green** | Consistent degraded mode |
| `PageHeader` | `components/page-header.tsx` | **Green** | Used on `/setup` |

---

## Issues

| ID | Severity | File | Description | Fix status |
|----|----------|------|-------------|------------|
| FE-001 | **High** | `components/app-shell.tsx` | Triple navigation: PipelineRail + 16-item NAV + SettingsToolsPanel with overlapping links (integrations, backups, linkedin, warm-path, boosters, outcomes appear twice) | **Deferred** — requires NAV collapse per `ux-pipeline-shell` |
| FE-002 | **High** | `app/(app)/setup/page.tsx` | Setup wizard links out to legacy pages; not a true 3-step embedded flow | **Deferred** — `ux-setup-wizard` |
| FE-003 | **Medium** | `app/(app)/onboarding/page.tsx` | Orphaned 4-step hub; overlaps `/setup` | **Partial** — linked from Settings panel + dashboard CTA |
| FE-004 | **Medium** | `components/apply/apply-workspace.tsx` | Duplicates `RouteBadge` instead of importing `components/pipeline/route-badge` | **Deferred** |
| FE-005 | **High** | `components/track/track-board.tsx` | Kanban moves failed silently (`moveApplicationAction` returns `{ok:false}`) | **Fixed** — `useActionFeedback` wired |
| FE-006 | **Medium** | `components/action-feedback.tsx` | Success variant used hardcoded `emerald-*` instead of `--success` token | **Fixed** |
| FE-007 | **Medium** | `app/(app)/master-resume/page.tsx` | Used `<a href>` causing full page reload | **Fixed** — `Link` |
| FE-008 | **Low** | `components/app-shell.tsx` | Unused `Settings` import (pre-consolidation) | **Fixed** |
| FE-009 | **Medium** | Multiple client components | Inconsistent error UX: ad-hoc `setError` vs `ActionFeedback` (apply, resume, integrations, import) | **Deferred** |
| FE-010 | **Medium** | `app/(app)/setup/page.tsx` | When setup complete, `activeStep` highlights step 2 (Update) not step 3 | **Deferred** |
| FE-011 | **Medium** | `next.config.ts` | `output: "standalone"` build fails at trace copy (`ENOENT` client-reference-manifest) | **Deferred** — infra/Tauri agent |
| FE-012 | **Medium** | — | No autopilot status banner on Searching/Applying/Applied stages | **Deferred** — `ux-autopilot-trigger` |
| FE-013 | **Low** | `app/(app)/import/page.tsx` | No `DbBanner` when DB down (import will fail anyway) | **Deferred** |
| FE-014 | **Medium** | `components/interview/interview-board.tsx` | No readiness checklist / voice prerequisite gate | **Deferred** — `ux-interview-checklist` |
| FE-015 | **Low** | Mobile drawer | No overlay/backdrop; 16+ nav items require long scroll | **Deferred** |

---

## Fixes applied this session

1. **`components/track/track-board.tsx`** — Added `ActionFeedback` + `useActionFeedback` for failed kanban moves; refresh only on `ok: true`.
2. **`components/action-feedback.tsx`** — Success variant now uses `var(--success)` tokens for dark/light consistency.
3. **`app/(app)/master-resume/page.tsx`** — Replaced `<a href="/import">` with Next.js `Link`.
4. **`app/(app)/page.tsx`** — Added "New here? Complete setup →" link to `/onboarding`.
5. **`components/app-shell.tsx`** — Removed unused `Settings` import (Settings icon lives in `SettingsToolsPanel`).

---

## Deferred items for orchestrator

| Priority | Backlog ID | Owner hint | Action |
|----------|------------|------------|--------|
| P0 | `ux-pipeline-shell` | Frontend | Collapse flat `NAV` to pipeline-only + settings drawer; remove duplicate links |
| P0 | `ux-setup-wizard` | Frontend | Embed import/dictation/goals in `/setup`; trigger autopilot on complete |
| P1 | `ux-route-badges` | Frontend | Deduplicate `RouteBadge` in apply-workspace; extend to applying split view |
| P1 | `ux-applying-split` | Frontend | "Needs you / Running / Queued" on apply stage |
| P1 | `ux-applied-stage` | Frontend | Compose inbox proposals + Applied column as single stage view |
| P1 | `ux-autopilot-trigger` | Full-stack | Slim autopilot banner on pipeline stages |
| P2 | `ux-interview-checklist` | Frontend | Soft gate before voice modes |
| P2 | ActionFeedback adoption | Frontend | Migrate apply/resume/integrations/import to shared pattern |
| P2 | Standalone build | Infra | Fix Next.js 15 standalone trace `ENOENT` for Tauri |
| P3 | Mobile drawer UX | Frontend | Backdrop, shorten nav when pipeline rail active |

---

## Alignment with UX consolidation plan

| Plan item | Expected | Current state |
|-----------|----------|---------------|
| 6-stage pipeline nav | Replace 16-item nav | **Partial** — `PipelineRail` added additively; legacy NAV retained |
| `/pipeline/*` routes | New route group | **Not started** — legacy URLs used; `/setup` is only new page |
| Setup 3-step wizard | Single `/pipeline/setup` host | **Partial** — `/setup` + `SetupStepper` link-outs |
| Route badges on job cards | `route-badge.tsx` on queue | **Done** — `JobsQueue` shows badges |
| Settings drawer | Integrations, backups, etc. | **Done** — `SettingsToolsPanel` |
| Onboarding in nav | Setup stage absorbs it | **Partial** — onboarding in settings + dashboard link |
| Dashboard demotion | Redirect to searching or setup-gated home | **Not started** — `/` still module grid |
| Autopilot banner | Searching/Applying/Applied | **Not started** |
| Interview checklist | Before voice | **Not started** |
| Rejection learning feed | Outcome stage | **Not started** (backend) |

**Verdict:** UX consolidation **~35% complete** — foundational pieces (`PipelineRail`, `SettingsToolsPanel`, `/setup`, `RouteBadge`, `setup-status`) exist, but the **shell still presents both old and new IA**, which is the primary blocker to the "3 inputs then autopilot" narrative.

---

## Build & typecheck results

| Command | Result | Notes |
|---------|--------|-------|
| `npm run typecheck` | **PASS** | No frontend TS errors (clean `.next` required if stale types from parallel agents) |
| `npm run build` | **PARTIAL FAIL** | Compile + lint + static generation succeed; fails copying standalone trace artifacts |

---

## What already works well

- **Theme system:** `ThemeScript` prevents flash; `globals.css` semantic tokens (`--accent`, `--success`, `--danger`) used consistently on badges and alerts.
- **Profile switcher:** Multi-profile create/switch/delete with confirm dialog; persists active ID to localStorage.
- **Safety copy:** Track page and InboxProposals correctly communicate Gmail propose-only policy.
- **Offline degradation:** Jobs, Track, Interview, Outcomes, Warm-path all render fixture previews without DB.
- **Apply review gate:** Route badges (AUTONOMOUS/ASSISTED/MANUAL), driver badge, field provenance in workspace.
- **Job scoring UX:** Expandable rows with explainable relevance/reachability bars.

---

*Report complete — frontend-review agent.*
