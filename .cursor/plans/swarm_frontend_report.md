# Swarm Frontend Report — UX Flow Consolidation v1

- **Timestamp:** 2026-06-18
- **Agent:** swarm-frontend-flow

---

## Summary

Implemented the six priority UX items from the consolidation plan. Navigation is now **pipeline-only + settings drawer** (16-item flat nav removed). `/setup` hosts an **embedded 3-step wizard**. Route badges appear on job queue cards in Searching and Applying. Dashboard is a **minimal hero + stage CTA**. Interview voice modes use a **readiness checklist** (brief + study) with Real-HR gated after AI screen. **Recruiter skim** deep-links from job detail and apply cards to `/resume?company=&title=` with skim tab default.

---

## Deliverables

| Priority | Backlog ID | Status | Notes |
|----------|------------|--------|-------|
| 1 | `ux-pipeline-shell` | **Done** | Removed `NAV` from `app-shell.tsx`; `PipelineRail` + `SettingsToolsPanel` only; mobile backdrop |
| 2 | `ux-setup-wizard` | **Done** | New `SetupWizard` embeds ImportForm, DictationPanel, GoalsWorkspace on `/setup` |
| 3 | `ux-route-badges` | **Done** | Jobs queue + apply queue cards; shared `RouteBadge` |
| 4 | `ux-dashboard-redirect` | **Partial** | Minimal hero + stage CTA on `/`; no redirect yet |
| 5 | `ux-interview-checklist` | **Done** | `ReadinessGate` + Real-HR requires AI screen score |
| 6 | Recruiter skim link | **Done** | `lib/pipeline/recruiter-skim.ts`; jobs + apply expanded/detail |

---

## Files changed

### New
- `components/pipeline/setup-wizard.tsx` — 3-step embedded wizard with progress
- `lib/pipeline/recruiter-skim.ts` — deep link helper

### Modified
- `components/app-shell.tsx` — pipeline-only nav, logo → home, mobile backdrop
- `components/settings-tools-panel.tsx` — dashboard + module links in drawer
- `components/pipeline/pipeline-rail.tsx` — `onNavigate` for mobile close
- `app/(app)/setup/page.tsx` — wizard host + goals data fetch
- `app/(app)/page.tsx` — minimal hero, single CTA, inline KPI line
- `components/import/import-form.tsx` — `embedded` + `onImported` props
- `components/goals/goals-workspace.tsx` — `compact` prop for wizard step 3
- `components/jobs/jobs-queue.tsx` — recruiter skim link in expanded row
- `components/apply/apply-workspace.tsx` — route badges on queue; recruiter skim on apps
- `components/interview/interview-board.tsx` — Real-HR sequential gate
- `app/(app)/resume/page.tsx` — searchParams for recruiter skim
- `components/resume/resume-workspace.tsx` — auto-select target; default skim tab

### Build fixes (parallel-agent conflicts)
- `lib/brief/service.ts` — dedupe `ensureBrief`
- `app/(app)/track/page.tsx` — scope typing for `gmailStatus`
- `lib/apply/driver-playwright.ts` — syntax fix on `fill()`
- `scripts/test-e2e-journey.ts`, `scripts/test-apply-driver.ts` — TailorResult / BrowserPage mocks

---

## Build & typecheck

| Command | Result |
|---------|--------|
| `npm run typecheck` | **PASS** |
| `npm run build` (compile + lint + types + static gen) | **PASS** |
| `next build` standalone trace | **FAIL** (known `output: "standalone"` ENOENT — infra/Tauri, not React) |

---

## UX before / after

**Before:** Pipeline rail + 16 flat nav items + settings drawer (triple nav, duplicate links).

**After:**
```
Sidebar: [6 pipeline stages] → [Settings & tools drawer]
         Profile + theme
```

**Setup flow:** Single `/setup` page with stepper → paste resume → voice update (skippable) → goals → ready check → Start searching.

**Dashboard:** Centered hero, autopilot badge, one primary CTA to current stage or setup.

---

## Deferred (not in scope)

- `ux-applying-split` — Needs you / Running / Queued
- `ux-applied-stage` — Inbox + Applied compose
- `ux-autopilot-trigger` — Slim banner on pipeline stages
- `ux-dashboard-redirect` — `/` → `/jobs` when setup complete
- Standalone build packaging fix

---

## Manual test checklist

1. Open app — sidebar shows 6 stages only; expand Settings & tools for modules
2. Visit `/setup` — step through import → update → goals without leaving page
3. `/jobs` — route badges on cards; expand row → Recruiter skim link
4. `/` — minimal hero; CTA points to setup or current stage
5. `/interview` — voice tabs blocked until brief + study checklist; Real-HR after AI screen
6. Apply workspace — queue cards show route badges; expanded app has recruiter skim link

---

*Report complete — swarm-frontend-flow agent.*
