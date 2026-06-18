# Frontend Polish Changelog (v1 visual pass)

**Date:** 2026-06-18  
**Scope:** ux-pipeline-shell, ux-dashboard-redirect, ux-settings-drawer, ux-route-badges (partial)

## Before

- Dashboard was a 16-card module catalog with KPI strip and principles grid — felt like a feature index, not a journey in progress.
- No pipeline stage indicator in the shell; flat 16-item nav only.
- Job cards had no apply-route preview (Autonomous / Assisted / Manual).
- Page headers varied in padding and copy density across `/jobs`, `/apply`, `/master-resume`.
- No dedicated `/setup` wizard; onboarding was a 4-card link hub.

## After

- **Pipeline rail** in sidebar (6 stages) with active-stage highlight from route or setup status.
- **Dashboard** simplified: hero + primary CTA, 3-metric strip, setup checklist, collapsible “All tools”.
- **`/setup`** page with 3-step visual stepper (upload → voice → goals) linking to existing flows.
- **Settings & tools** collapsible panel in shell (integrations, backups, power modules).
- **Route badges** on job queue cards via `lib/pipeline/route-preview.ts`.
- **Unified `PageHeader`** and consistent card styling (`border-border/60`, `shadow-sm`).

## Files changed

See git diff. Key additions: `components/pipeline/*`, `lib/pipeline/*`, `components/page-header.tsx`, `components/settings-tools-panel.tsx`, `app/(app)/setup/page.tsx`.

## Build

- `npm run typecheck` — **0 errors** ✅
- `npm run build` — **success** ✅

## Remaining for v1.1

- Replace flat 16-item nav with pipeline-only primary nav + full settings drawer.
- `/pipeline/*` stage routes composing existing workspaces.
- Applying split view (Needs you / Running / Queued).
- Interview readiness checklist + progressive voice gate.
- Rejection learning feed on Outcome stage.
- `onSetupComplete` autopilot trigger wiring.
