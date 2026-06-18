# Brand Logo — Consistency Report

**Date:** 2026-06-18  
**Auditor:** Logo-consistency agent (brand assets)  
**Scope:** Every logo usage + asset across the app. Read-only analysis; design **not** altered. Code edits limited to exclusively-owned logo files (see "Fixes applied").

---

## 1. Inventory

### Assets (5)
| File | viewBox | Colors | Notes |
|------|---------|--------|-------|
| `public/brand/logo.svg` | `0 0 168 32` | mark/wordmark `#111113`, node `#16a34a`, arrow `#fafafa` | Light lockup (mark + "Job OS") |
| `public/brand/logo-dark.svg` | `0 0 168 32` | mark/wordmark `#f4f4f5`, node `#22c55e`, arrow `#0a0a0b` | Dark lockup |
| `public/brand/logo-icon.svg` | `0 0 32 32` | mark `currentColor`, node `#16a34a`, arrow `#fafafa` | Icon-only, transparent |
| `app/icon.svg` | `0 0 32 32` | tile `#111113`, mark `#fafafa`, node `#22c55e` | File-based favicon (charcoal tile) |
| `components/brand/job-os-logo.tsx` | — | — | React component, `variant: "full" \| "icon"` |

### Call sites (where the logo actually renders)
| Surface | Location | Variant | Rendered size |
|---------|----------|---------|---------------|
| Mobile header (home link) | `components/app-shell.tsx:41` | `full` | `h-7` (~28px tall, ~147px wide) |
| Desktop sidebar (home link) | `components/app-shell.tsx:85` | `full` | `h-7` |
| Browser favicon (file-based) | `app/icon.svg` | tiled icon | 16–32px |
| Browser favicon (metadata) | `app/layout.tsx:10` → `/brand/logo-icon.svg` | icon-only | 16–32px |

---

## 2. Inconsistencies & defects found

### HIGH

**H1 — Icon variant `currentColor` is a no-op (theme/contrast bug).**  
`logo-icon.svg` paints the mark with `fill="currentColor"`, but the component loaded it via `<img src="/brand/logo-icon.svg" className="text-foreground">`. An **external SVG referenced through `<img>` cannot inherit the parent's CSS `currentColor`** — it resolves to the SVG document's own default (black). So `text-foreground` did nothing, and in dark mode the icon variant rendered a near-black mark on a dark surface (effectively invisible). The full variant was unaffected (it uses pre-rendered light/dark files).  
→ **Fixed** (see §4). Currently the icon variant had **no call sites**, so user impact was latent, not live.

**H2 — Duplicate / conflicting favicon declarations.**  
Two favicons are declared at once: Next.js file-based `app/icon.svg` (charcoal tile — correct, legible on any chrome) **and** `app/layout.tsx` `metadata.icons.icon → /brand/logo-icon.svg` (transparent, `currentColor` mark → resolves to black, invisible on dark browser chrome). The explicit metadata entry is redundant and lower-quality than the file-based icon.  
→ **Deferred** (edit lands in `app/layout.tsx`, a shared file held by `9399791d`). Documented in deployment checklist.

**H3 — Desktop app icon is missing (Tauri).**  
This is a packaged desktop app (`src-tauri/tauri.conf.json`, `productName "Job OS"`, `dmg`/`app` targets) but `bundle` has **no `icon` array** and there is **no `src-tauri/icons/` directory**. The dock/Finder/dmg/window icon will fall back to a Tauri default — the most visible branding gap for an installable app, and `tauri build` warns/fails without icons.  
→ **Deferred** (requires generating binary PNG/ICNS, which can't be produced here). Top item in deployment checklist.

### MEDIUM

**M1 — `brand_logo.md` documents behavior the component never had (doc drift).**
- Claims the component "uses `currentColor` + Tailwind `fill-success` for automatic theme sync." The **full** variant actually uses two static `<img>` files toggled by `dark:hidden` / `hidden dark:block` — no `currentColor`, no `fill-success`.
- References `<JobOsLogo showWordmark={false} />` — **that prop does not exist**; the API is `variant="full" | "icon"`.
- Says clear space is "≥4px around the mark at sidebar scale (32×32)", but the sidebar renders the **full lockup at `h-7` (28px)**, not the 32×32 icon.  
→ **Fixed** by rewriting `brand_logo.md` guidelines to match reality.

**M2 — Node (success-green) value not theme-matched in static icon.**  
Guidelines define light success `#16a34a` and dark `#22c55e`. `logo-icon.svg` hard-codes `#16a34a` only, so when used in dark contexts the node is the light-mode green. The new inlined icon variant in the component now switches (`#16a34a` → `dark:#22c55e`); the static file remains single-value (acceptable for a static asset, documented as expected).

### LOW

**L1 — Corrupted comment bytes in `logo-icon.svg`.** A comment read `resume � goals � discover � hired` (mojibake). Cosmetic only (comment, not rendered). → **Fixed** (now ASCII `->`).

**L2 — `global-error.tsx` uses off-brand charcoal.** Hardcodes text `#0b0b0c`; brand charcoal is `#111113`. No logo present on the crash screen (acceptable; optional branding opportunity). → Documented, low priority.

**L3 — No logo on welcome/empty surfaces.** `onboarding`, `setup`, `not-found`, `loading`, and `README.md` carry no mark. Not defects, but missed brand-presence opportunities, especially the onboarding "Welcome to Job OS" header. → Documented as optional placements.

**L4 — No social/OG or apple-touch assets.** No `opengraph-image`, `apple-icon`, or web manifest. For a **local-first desktop app with no public web deployment**, OG/social is low value (no link-unfurl surface) — flagged optional, not required. `apple-icon` + manifest are nice-to-have for browser/PWA installs.

---

## 3. Accessibility & contrast notes

- **Full variant** has `alt="Job OS"` on both light & dark `<img>` (the inactive one is `display:none`, so AT reads it once). As the sole child of the home `<Link>`, it gives the link a valid accessible name. ✅
- **Icon variant** was `alt="" aria-hidden`; now inlined as `role="img" aria-label="Job OS"` with a `<title>`. If ever used as the only content of a link/button it now carries a name. ✅
- **Contrast:** mark on `--background` uses `currentColor`/foreground → meets contrast in both themes. Node `#16a34a` on white ≈ 3.2:1 (fine for a graphical mark, below 4.5:1 text threshold — acceptable as it is non-text). Arrow `#fafafa` sits only on the green node → legible in both themes. ✅
- **Favicon legibility:** `app/icon.svg` (charcoal tile + light mark + green node) is legible at 16px on light/dark chrome. The transparent `logo-icon.svg` favicon (H2) is **not** legible on dark chrome → remove from metadata.

---

## 4. Fixes applied (this pass — owned files only)

| File | Change | Risk | Verify |
|------|--------|------|--------|
| `components/brand/job-os-logo.tsx` | Icon variant re-implemented as **inline SVG** so `currentColor` (theme foreground) applies; node made theme-aware (`#16a34a` / `dark:#22c55e`); added `role="img"`/`aria-label`/`<title>`. Geometry & colors identical to source asset — **no design change**. | Low (owned, unused variant) | `npm run typecheck` → **0 errors** ✅ |
| `public/brand/logo-icon.svg` | Repaired corrupted comment bytes (`->`). No geometry/color change. | None | Visual identical |

## 5. Fixes deferred (shared/at-risk files — see deployment checklist)

| Target | Why deferred |
|--------|--------------|
| `app/layout.tsx` (favicon metadata cleanup, apple-icon, manifest link) | Shared file held by craftsmanship agent `9399791d`. |
| `components/app-shell.tsx` (sizing/clear-space normalization, if any) | Shared file held by `9399791d`. No change strictly required — current `h-7` is consistent. |
| `src-tauri/tauri.conf.json` (`bundle.icon`) | Needs generated binary icons first; adding paths to missing files would break `tauri build`. |
| `opengraph-image` / `apple-icon` / `manifest` | Require binary raster generation; documented with specs. |
