# Craftsmanship Pass Plan

**Date:** 2026-06-18
**Owner:** craftsmanship pass (full-stack)
**Baseline (verified before any edit):** `npm run typecheck` = 0 errors. Stack: Next 16.2.9, React 19.2.7, TS 5.9.3, Prisma 7.8.0, Tailwind v4. Dev = `next dev --webpack`.

## Goal

Professional polish across the whole app without changing behavior or breaking the running app. Primary confirmed scope: rewrite user-facing copy to plain, human language. Secondary: front-end consistency, back-end tidiness.

## Hard rules honored

- No behavior/contract changes in back end without flagging.
- No em dashes in copy or comments. (Functional regex character classes that intentionally match em dashes, e.g. `lib/resume/ats-rules.ts` and `lib/coverletter/standards.ts`, are left intact: those match user-pasted em dashes and are not copy or comments.)
- No filler words (Elevate, Seamless, Unleash, etc.). Current scan: none present.
- Local-first, no new dependencies, no version bumps.
- Keep `lib/db.ts`, `getAppContextSafe()`, `next dev --webpack` intact.

## What falls short and the fix per area

### (a) Code consistency
- Em dashes scattered through comments and section-divider art (`{/* --- Section --- */}`). Normalize to ASCII.
- `package.json` is missing `test:apply-state` though CI and the file both reference it. Add the script (file already exists) so CI and local `test:*` match. Low risk, fixes a real CI break.

### (b) UI / UX
- Reuse existing tokens/components (PageHeader, cards, badges, PipelineProgress). No structural IA change in this pass (legacy-vs-pipeline nav consolidation is a tracked, larger UX effort; out of scope to avoid regressions).
- Tighten only clearly-awkward copy spacing and labels. Verify light + dark unaffected (token-only).

### (c) Copy (primary)
- Rewrite headings, descriptions, empty states, button labels, and error messages across `app/(app)/*` pages, `components/**`, and user-facing `lib` labels/blurbs (`lib/modules.ts`) to plain, specific language.
- Replace jargon ("north-star", "highest-yield lever", "ROI", "extractively") with plain words where it improves clarity, keeping meaning identical.
- Remove em dashes; prefer commas, periods, or restructured sentences in prominent copy; ASCII hyphen acceptable in low-traffic strings/comments.

### (d) Data layer / back end
- No schema or contract changes. Confirm AppScope/profile scoping intact (already verified by prior reviews).
- Comment hygiene only (em dash removal). No logic edits unless a clear, safe dead-code removal with tests still green.

## Execution order (serialize shared files; verify after each batch)

1. Guarded codemod: strip em dashes + box-drawing rules from comments/strings across `app`, `components`, `lib`, `scripts` (skips regex char-class lines). Typecheck + build immediately.
2. Hand-rewrite user-facing copy: dashboard, page headers/descriptions, empty states, buttons, errors, `lib/modules.ts` blurbs.
3. Sync any test that asserts on copy strings (only `scripts/test-track-ui.ts`, not npm-wired; keep consistent anyway).
4. Add `test:apply-state` to `package.json`.
5. Conservative FE token/label polish where obviously beneficial.

## Verification (real run, required before done)

- `npm run typecheck` -> 0
- `npm run build` -> exit 0
- Full `test:*` suite (CI matrix) -> pass; document env-only skips
- `next dev --webpack` on 3000, `curl -i /` -> 200 with real dashboard; spot-check 2-3 routes
