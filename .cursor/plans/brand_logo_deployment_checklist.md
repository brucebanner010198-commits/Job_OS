# Brand Logo — Deployment Checklist

**Date:** 2026-06-18 · **Owner:** Logo-consistency agent  
**Status key:** ✅ done · 🟡 ready-to-apply (deferred for serialization) · ⬜ to create (needs binary tooling) · ⏸ optional

> Local-first desktop app (Tauri + Next.js). No public web deployment exists, so social-profile / marketing-site placements are intentionally **not** invented. Surfaces below are only the ones that actually apply.

---

## Priority 1 — Live app UI (in-product)

| # | Placement | Variant | Size | Clear space | Status | Notes |
|---|-----------|---------|------|-------------|--------|-------|
| 1.1 | Desktop sidebar home link | `full` | `h-7` | ≥ ½ lockup height | ✅ | `app-shell.tsx:85` — correct, consistent |
| 1.2 | Mobile header home link | `full` | `h-7` | ≥ ½ lockup height | ✅ | `app-shell.tsx:41` — correct, matches desktop |
| 1.3 | Icon variant rendering correctness | `icon` | `h-8 w-8` | ≥25% width | ✅ | Fixed: inline SVG, `currentColor` now applies, node theme-aware (owned file) |

**No code change required to `app-shell.tsx`.** Sizing/clear space already consistent. Do **not** edit (held by `9399791d`).

---

## Priority 2 — Favicon / browser & OS chrome

| # | Asset | Status | Action |
|---|-------|--------|--------|
| 2.1 | `app/icon.svg` (file-based favicon) | ✅ | Correct opaque tile; keep as the canonical favicon |
| 2.2 | Remove redundant favicon in `app/layout.tsx` | ✅ **applied** 2026-06-18 | Edit A applied; head now emits a single `<link rel="icon" href="/icon.svg">` |
| 2.3 | `app/apple-icon.png` (180×180) | ✅ **applied** 2026-06-18 | Rendered from `app/icon.svg` via `sharp`; Next auto-links `apple-touch-icon` (verified 200) |

### Ready-to-apply edit A — `app/layout.tsx` (serialize after `9399791d`)
The transparent `logo-icon.svg` favicon is illegible on dark chrome and duplicates the file-based `app/icon.svg`. Remove the explicit `icon` entry (let `app/icon.svg` drive it); optionally add apple-icon once 2.3 exists.

```ts
// BEFORE
export const metadata: Metadata = {
  title: "Job OS",
  description: "Your AI job-search operating system.",
  icons: {
    icon: [{ url: "/brand/logo-icon.svg", type: "image/svg+xml" }],
  },
};

// AFTER  (app/icon.svg is auto-detected; apple-icon.png auto-detected once created)
export const metadata: Metadata = {
  title: "Job OS",
  description: "Your AI job-search operating system.",
  // Favicon comes from file-based app/icon.svg; apple-touch from app/apple-icon.png.
};
```
**Verify after apply:** `npm run typecheck` → 0 errors; `npm run build`; check `<head>` emits a single icon link to `/icon.svg`.
**Applied 2026-06-18:** typecheck 0 errors; `npm run build` exit 0; live `<head>` emits exactly `<link rel="icon" href="/icon.svg" ...>` + `<link rel="apple-touch-icon" href="/apple-icon.png" sizes="180x180">`; no stale `/brand/logo-icon.svg` favicon ref.

---

## Priority 3 — Desktop app icon (Tauri packaging) — HIGHEST real gap

The installable app currently has **no branded icon** (dock, Finder, dmg, window all fall back to Tauri default).

| # | Item | Status | Action |
|---|------|--------|--------|
| 3.1 | Source raster `icon-source.png` (1024×1024) | ✅ **applied** 2026-06-18 | `tauri icon` rasterizes `app/icon.svg` internally (vector source), so no separate raster file was needed |
| 3.2 | Generate platform icons | ✅ **applied** 2026-06-18 | Ran `node_modules/.bin/tauri icon app/icon.svg --output src-tauri/icons` → wrote `src-tauri/icons/*` (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.png`, `icon.icns`, `icon.ico` + iOS/Android sets) |
| 3.3 | Wire icons into config | ✅ **applied** 2026-06-18 | Added `bundle.icon` array (edit B); all 5 referenced files verified present with correct dimensions; JSON validated |

### Ready-to-apply edit B — `src-tauri/tauri.conf.json` (after icons exist)
```jsonc
"bundle": {
  "active": true,
  "targets": ["app", "dmg"],
  "category": "Productivity",
  "shortDescription": "Your AI job-search operating system",
  "icon": [
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.icns",
    "icons/icon.ico"
  ],
  "macOS": { "minimumSystemVersion": "12.0" },
  "resources": { "standalone": "../.next/standalone" }
}
```
**Rationale:** A packaged product with a default icon reads as unfinished; the dock/dmg icon is the single most visible brand surface for a desktop install. Use the **tiled** icon (`app/icon.svg`), not the transparent mark — desktop icons need an opaque shape.  
**Verify:** `npm run tauri build` produces a dmg whose app shows the Job OS mark.  
**Applied 2026-06-18:** Icons generated from the opaque `app/icon.svg` tile and `bundle.icon` wired. `tauri build` itself was not run here (it compiles the Rust shell + downloads crates, out of scope for this code-only pass), but all icon paths resolve on disk so the bundle config is no longer broken/default. Run `npm run tauri build` to produce the branded dmg.

---

## Priority 4 — Documentation

| # | Placement | Status | Action |
|---|-----------|--------|--------|
| 4.1 | `README.md` header logo | ⏸ optional | Add `<img src="public/brand/logo.svg" alt="Job OS" width="160">` above the H1 for repo presence |
| 4.2 | Brand docs alignment | ✅ | `brand_logo.md` rewritten to match real component API |

---

## Priority 5 — In-app brand-presence (optional polish)

| # | Surface | Status | Suggestion |
|---|---------|--------|------------|
| 5.1 | Onboarding "Welcome to Job OS" header (`onboarding/page.tsx`) | ⏸ optional | Place `<JobOsLogo variant="icon" className="h-6 w-6" />` before the H1 |
| 5.2 | `not-found.tsx` / `(app)/error.tsx` | ⏸ optional | Small `variant="icon"` above the 404/error text |
| 5.3 | `global-error.tsx` | 🟡 partial: charcoal fixed 2026-06-18 | Off-brand text color `#0b0b0c`->`#111113` applied (L2). Inlining the mark on the crash screen still optional/deferred |
| 5.4 | `(app)/loading.tsx` | ⏸ optional | Keep spinner; logo not needed |

These are page files (not in the `9399791d` shared-lock set) but are **left for a follow-up** to keep this pass scoped to brand consistency + the high-value gaps above.

---

## Priority 6 — Social / OG (NOT applicable as required)

| Asset | Status | Decision |
|-------|--------|----------|
| `app/opengraph-image.*` | ⏸ optional | **Low value** — no public web deployment to unfurl links. Create only if a marketing/landing site is ever added. |
| Web manifest (`app/manifest.ts`) | ⏸ optional | Nice-to-have for browser "install"; not needed for the Tauri package. |
| Twitter/X, LinkedIn, profile avatars | — | **Not applicable** — no such profiles in this repo; not invented. |

---

## Asset create/update summary

| Asset | Type | Status |
|-------|------|--------|
| `public/brand/logo.svg` | exists | ✅ no change |
| `public/brand/logo-dark.svg` | exists | ✅ no change |
| `public/brand/logo-icon.svg` | exists | ✅ comment byte fix applied |
| `app/icon.svg` | exists | ✅ keep as canonical favicon |
| `components/brand/job-os-logo.tsx` | exists | ✅ icon variant fixed (owned) |
| `app/apple-icon.png` (180²) | created | ✅ 2026-06-18 from `app/icon.svg` via `sharp` |
| `src-tauri/icons/*` | created | ✅ 2026-06-18 via `tauri icon app/icon.svg` |
| `bundle.icon` in `tauri.conf.json` | edit | ✅ 2026-06-18 (edit B applied) |
| `app/layout.tsx` favicon metadata | edit | ✅ 2026-06-18 (edit A applied) |
| `README.md` logo | create | ⏸ optional |

---

## Apply order (serialization)
1. ✅ Wait for `9399791d` to release `app/layout.tsx` → apply **edit A**, `typecheck` + `build`. (done 2026-06-18)
2. ✅ Generate `src-tauri/icons/*` (3.1→3.2) → apply **edit B**. (done 2026-06-18; run `npm run tauri build` for the dmg smoke test when packaging)
3. ✅ Create `app/apple-icon.png`; re-verify `<head>`. (done 2026-06-18)
4. Optional (still deferred): README logo, onboarding/error brand presence (P5), inline mark on `global-error.tsx`.

---

## Applied summary (2026-06-18)
**Applied (code + assets, in this pass):**
- Edit A: `app/layout.tsx` favicon metadata cleanup (removed transparent `logo-icon.svg` icon entry).
- `app/apple-icon.png` (180x180) generated from `app/icon.svg`.
- `src-tauri/icons/*` full platform set generated via `tauri icon app/icon.svg`.
- Edit B: `bundle.icon` array added to `src-tauri/tauri.conf.json`.
- L2: `global-error.tsx` charcoal `#0b0b0c`->`#111113`.

**Verification:** `npm run typecheck` → 0 errors · `npm run build` → exit 0 (`.next-build`) · `curl -i http://localhost:3000/` → 200 (server not restarted) · `/icon.svg` and `/apple-icon.png` → 200 · single `<link rel="icon">` to `/icon.svg` + apple-touch-icon emitted · no stale `/brand/logo-icon.svg` ref.

**Still deferred (optional / out of scope):** P4.1 README logo, P5.1/5.2 onboarding & error brand presence, P5.3 inline mark on crash screen, P6 OG/social/manifest. None require new binary tooling — all are optional polish.

**No manual asset generation required by the user.** Icons were produced in-environment (`@tauri-apps/cli` + `sharp`). To actually package the desktop app with the new icon, run `npm run tauri build` (compiles the Rust shell; not run here as it is outside this code-only pass).
