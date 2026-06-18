# UI Enhancement Pass — 2026-06-18

**Scope:** Polish pass on working pipeline UI (no rebuild, no layout/safeGetAppContext regressions).

## Verification

| Check | Result |
|-------|--------|
| `npm run typecheck` | **PASS** (0 errors) |
| `npm run build` | **PARTIAL** — Turbopack compile succeeds; Next.js build worker TS phase hits `Maximum call stack size exceeded` (pre-existing infra issue, same class as standalone trace failures in `review_frontend_report.md`) |
| `curl http://localhost:3001/` | **PASS** — renders `hero-surface`, `Three steps`, `Pipeline progress` |

---

## Enhancements applied

### 1. Dashboard hero (`ux-dashboard-redirect`)
- Wrapped content in `hero-surface` with subtle accent gradient (light + dark).
- Added linked **`PipelineProgress`** strip (6 stages, active stage from setup status).
- **Setup checklist** when incomplete (resume + goals with checkmarks).
- **3-metric strip** when setup complete (pipeline / applied / interviews per 10 apps).
- Uses shared `page-container` spacing.

### 2. Pipeline feel
- **`PipelineRail`**: left accent border on active stage, larger dot with ring, trailing accent marker on desktop.
- **`PipelineProgress`**: new horizontal progress component for dashboard (reusable).

### 3. Applying stage — light split (`ux-applying-split` lite)
- New **`ApplyQueueHints`**: Needs you / Running / Queued summary pills with counts.
- Friendly empty copy when queue is empty.
- **`QueuedJobsPanel`**: improved empty state + `surface-card` styling; `Link` instead of `<a>`.

### 4. Setup wizard polish
- Step icon labels (sm+) above stepper for quicker scanning.
- `surface-card` on step content panel.
- **`/setup`**: `page-container`, ready-check card uses `surface-card`.

### 5. Brand logo integration
- **`JobOsLogo`** component (`components/brand/job-os-logo.tsx`) — theme-aware `logo.svg` / `logo-dark.svg`.
- Integrated in **`AppShell`** (mobile + desktop), focus rings on logo links.

### 6. Page-level spacing
- **`page-container`** / **`page-container-wide`** utilities in `globals.css` (responsive px).
- **`/jobs`**, **`/apply`**, **`/setup`**, **`/track`**, **`/interview`** aligned to shared containers.
- **`PageHeader`** on `/track` and `/interview` (was ad-hoc headers); margin bumped to `mb-8`.

### 7. Global polish utilities (`globals.css`)
- `.surface-card`, `.surface-card-interactive`, `.hero-surface` for consistent cards and dark-mode-safe gradients.

### 8. Mobile + accessibility
- Mobile menu button: `min-h-11 min-w-11`, `aria-expanded`, focus ring.
- Drawer: `max-h` scroll, `shadow-lg`.
- Pipeline rail links + setup wizard step buttons: `focus-visible:ring-2`.

### 9. Build fix (collateral)
- Replaced removed lucide `Linkedin` icon with `Network` in `settings-tools-panel.tsx` and `linkedin-optimizer.tsx` (build blocker unrelated to polish).

---

## Before / after notes

| Area | Before | After |
|------|--------|-------|
| Dashboard `/` | Centered text + CTA only | Hero card, pipeline progress, setup checklist or metric strip |
| Pipeline rail | Muted bg on active | Accent left border + ring dot + clearer past/future dots |
| Apply `/apply` | Flat list of panels | Needs you / Running / Queued summary at top |
| Setup `/setup` | Basic stepper | Icon labels, surface cards, consistent page padding |
| Shell | Compass placeholder icon | Brand SVG logo (light/dark) |
| Track / Interview | Custom headers, mixed padding | `PageHeader` + `page-container` |
| Empty states | Minimal one-liners | Friendly copy with pipeline stage names + links |

---

## Deferred (not in this pass)

| ID | Item | Reason |
|----|------|--------|
| `ux-applying-split` (full) | Three-column split view with filtered application lists | Lite hints only — full split deferred to avoid large `apply-workspace` refactor |
| `ux-pipeline-shell` | Collapse legacy 16-item nav | Explicitly out of scope — working pipeline-only shell already landed |
| `ux-autopilot-trigger` | Slim autopilot banner on Searching/Applying/Applied | Backend + copy coordination |
| `ux-interview-checklist` | Voice prerequisite gate | Separate backlog item |
| `ux-rejection-learning` | Outcome stage feed | Backend not ready |
| `onSetupComplete` autopilot trigger | Wire orchestrator on setup complete | Full-stack item |
| Standalone / build TS worker | `Maximum call stack size exceeded` in `next build` | Infra — `tsc --noEmit` passes |
| Logo icon variant | `logo-icon.svg` uses `currentColor` — not used as `<img>` | Full wordmark used everywhere |

---

## Files touched

- `app/globals.css`
- `app/(app)/page.tsx`
- `app/(app)/setup/page.tsx`
- `app/(app)/jobs/page.tsx`
- `app/(app)/apply/page.tsx`
- `app/(app)/track/page.tsx`
- `app/(app)/interview/page.tsx`
- `components/app-shell.tsx`
- `components/page-header.tsx`
- `components/brand/job-os-logo.tsx` (new)
- `components/pipeline/pipeline-rail.tsx`
- `components/pipeline/pipeline-progress.tsx` (new)
- `components/pipeline/setup-wizard.tsx`
- `components/apply/apply-queue-hints.tsx` (new)
- `components/apply/apply-workspace.tsx`
- `components/settings-tools-panel.tsx` (icon fix)
- `components/linkedin/linkedin-optimizer.tsx` (icon fix)
