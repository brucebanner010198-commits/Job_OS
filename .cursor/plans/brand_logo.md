# Job OS — Brand Logo

## Concept: Pipeline Ascent

The Job OS mark is a **minimal geometric pipeline** — four ascending stages connected by a precise diagonal path, culminating in a **success-green destination node** with a subtle upward indicator.

| Element | Meaning |
|---------|---------|
| Four stepped blocks (increasing opacity) | Resume → goals → discover → apply → interview pipeline stages |
| Diagonal connectors | Forward momentum, intentional path (not spray-and-pray chaos) |
| Top-right green block | "Go / ready" — hire-ready outcome, aligned with `--success` token |
| Corner L-brackets (low opacity) | OS / system chrome — local-first operating system, not a job board |
| Wordmark: **Job** + muted **OS** | Product name with subtle emphasis on "operating system" |

**Avoided:** briefcases, magnifying glasses, generic HR clip art, emojis.

## Palette

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| Charcoal | `#111113` | `#f4f4f5` | Mark body, wordmark (via `currentColor` / theme) |
| Off-white | `#fafafa` | `#0a0a0b` | Backgrounds, accent arrow on green node |
| Success accent | `#16a34a` | `#22c55e` | Destination pipeline stage (`--success`) |

Static SVG files in `public/brand/` use fixed hex values. The in-app `JobOsLogo` component uses `currentColor` + Tailwind `fill-success` for automatic theme sync.

## Files

| File | Purpose |
|------|---------|
| `public/brand/logo.svg` | Primary lockup (mark + wordmark) for light backgrounds |
| `public/brand/logo-dark.svg` | Lockup for dark backgrounds / exports |
| `public/brand/logo-icon.svg` | Icon-only, transparent, `currentColor`-ready |
| `app/icon.svg` | Favicon (rounded charcoal tile + mark) |
| `components/brand/job-os-logo.tsx` | Theme-aware React component for shell header |

All SVGs are &lt;2 KB.

---

# Logo Usage Guidelines (consolidated)

> Single source of truth for placement, sizing, clear space, color, and contextual usage.
> The mark **design is frozen** — these rules govern *how it is used*, not how it looks.

## Component API (authoritative)

```tsx
import { JobOsLogo } from "@/components/brand/job-os-logo";

<JobOsLogo />                 // full lockup (mark + wordmark), theme-aware
<JobOsLogo variant="icon" />  // icon-only mark, theme-aware (inline SVG)
<JobOsLogo className="h-8" /> // override height; width stays auto for the lockup
```

- Props: `variant?: "full" | "icon"` (default `"full"`), `className?: string`.
- There is **no** `showWordmark` prop. Use `variant="icon"` for mark-only.
- **In-app, always use this component** — never hand-roll `<img>` to the SVGs, and never substitute a Lucide icon (e.g. Compass) or text-only "Job OS".

## Variant selection

| Context | Variant | Why |
|---------|---------|-----|
| Header / sidebar / any space ≥ ~120px wide | `full` | Wordmark reads at a glance |
| Tight chrome, square slots, < ~120px wide, favicons | `icon` | Wordmark would be illegible |
| Browser tab / OS chrome | `app/icon.svg` (tiled) | Needs an opaque tile for 16px legibility |

## Sizing

| Surface | Height | Notes |
|---------|--------|-------|
| Sidebar / mobile header (full lockup) | `h-7` (28px) | Current, consistent across both. Width auto (~147px at h-7). |
| Icon variant default | `h-8 w-8` (32px) | Square; scale via `className`. |
| Minimum legible — full lockup | ~110px wide (≈ h-5/20px) | Below this, switch to `variant="icon"`. |
| Minimum legible — icon | 16px | Floor for the mark; below 16px detail collapses. |
| Maximum | No hard cap | Vector; on hero/marketing surfaces keep ≤ ~200px wide to stay restrained. |

Keep one logo height per surface. Do not mix `h-7` and `h-8` lockups in the same view.

## Clear space

- **Full lockup:** keep clear space ≥ **the height of one pipeline block** (≈ the mark's `5` unit, ~1/6 of mark height) on all sides — practically, ≥ **half the lockup height** of padding before any adjacent text/control.
- **Icon variant:** keep ≥ **25% of the icon's width** (≥8px at 32px) of clear space on all sides; the icon already carries internal padding (mark inset within its 32×32 box).
- Never let UI controls, borders, or text crowd inside the clear-space band.

## Color & variants

| Variant | Mark | Wordmark | Node (success) | Background |
|---------|------|----------|----------------|------------|
| Light static (`logo.svg`) | `#111113` | `#111113` (OS @ 72%) | `#16a34a` | light only |
| Dark static (`logo-dark.svg`) | `#f4f4f5` | `#f4f4f5` (OS @ 72%) | `#22c55e` | dark only |
| Component `full` | auto (light/dark file swap) | auto | auto | any (theme-aware) |
| Component `icon` | `currentColor` (= `text-foreground`) | — | `#16a34a` → `dark:#22c55e` | any (theme-aware) |
| Favicon (`app/icon.svg`) | `#fafafa` on `#111113` tile | — | `#22c55e` | opaque tile |

- **Mono usage:** acceptable to render the icon in a single foreground color (set the text color; the node will still switch green unless you also override it). For a fully-mono context, override the node to `currentColor`.
- The success-green is the **only** accent; do not recolor the mark or wordmark to other hues.

## Backgrounds & contrast

- Place on solid `--background` / `--card` surfaces. The icon variant adapts via `currentColor`.
- For **static** files, match the file to the surface: `logo.svg` on light, `logo-dark.svg` on dark. **Never** CSS-invert or `filter` a static lockup.
- Favicon must sit on the opaque charcoal tile (`app/icon.svg`) — do **not** use the transparent `logo-icon.svg` as a favicon (its `currentColor` mark falls back to black and disappears on dark browser chrome).
- The mark/wordmark meet contrast in both themes; the green node is a graphical element (not text) and is exempt from the 4.5:1 text rule.

## Accessibility

- **Full lockup** carries `alt="Job OS"` → gives wrapping links/buttons an accessible name.
- **Icon variant** is `role="img"` + `aria-label="Job OS"`. If you place it next to a visible "Job OS" text label, add `aria-hidden` on the icon to avoid double announcement.
- When the logo is the *only* content of a link/button, that name is what screen readers announce — keep it as a logo, not decorative.

## Don'ts

1. Don't stretch non-uniformly, rotate, skew, or add drop shadows/glows/gradients.
2. Don't place on busy photography or low-contrast fills.
3. Don't recolor (other than the defined light/dark/mono behavior); the node stays success-green.
4. Don't separate the wordmark from the mark, or re-typeset "Job OS".
5. Don't programmatically invert a static lockup — use the correct light/dark file or the component.
6. Don't reference the SVGs via raw `<img>` for the icon mark — `currentColor` won't apply; use `<JobOsLogo variant="icon" />`.

## Light / dark behavior (implementation)

- **Component `full`:** ships pre-rendered `logo.svg` (`dark:hidden`) and `logo-dark.svg` (`hidden dark:block`); the browser swaps on theme — no `currentColor`.
- **Component `icon`:** inline SVG; mark uses `currentColor` (theme foreground), node uses `#16a34a` with `dark:fill-[#22c55e]`.
- **Static lockups:** pre-rendered; choose the file to match the surface.
- **Favicon `app/icon.svg`:** charcoal tile + light mark + green node — legible at 16px on light or dark chrome.

## Integration points (current)

- `components/app-shell.tsx:41` — mobile header home link (`<JobOsLogo />`)
- `components/app-shell.tsx:85` — desktop sidebar home link (`<JobOsLogo />`)
- `app/icon.svg` — Next.js file-based favicon (preferred favicon source)
- `app/layout.tsx:10` — `metadata.icons` currently also points to `/brand/logo-icon.svg` (**redundant/incorrect** — to be removed; see deployment checklist)

No `globals.css` changes are required; sizing uses existing Tailwind height utilities.
