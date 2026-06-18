# UI blank screen — single root cause

**Date:** 2026-06-18  
**Verdict:** One code change broke the visible UI. Fix is already applied in `components/theme-provider.tsx`.

---

## The one change

| | |
|---|---|
| **File** | `components/theme-provider.tsx` |
| **Introduced by** | Dark/light mode work (agent `67fc2ecd`) |
| **Breaking lines (before fix)** | `useState(() => getStoredTheme() ?? "system")` and `useState(() => { … getStoredTheme() / getSystemTheme() … })` |

### What it did wrong

The initial `ThemeProvider` read `localStorage` and `window.matchMedia` inside `useState` lazy initializers. That runs on the **client only** — the server always rendered `resolvedTheme: "light"` while the client’s first render could be `"dark"` (saved preference or OS theme).

`ThemeToggle` in `app-shell.tsx` renders different `aria-pressed` values and CSS classes based on `resolvedTheme`. Server HTML ≠ client HTML → **React hydration failure**.

Next.js injects `body{display:none}` until hydration completes. When hydration never succeeds, the body stays hidden → **completely blank white window** (matches user screenshot: no text, no shell, no error UI).

### Why this is the single root cause (not the supervisor’s other theories)

| Theory | Evidence |
|--------|----------|
| Layout `getAppContext()` throw | Real for HTTP **500** / DB-down, but supervisor curl during the incident returned **200** with full shell HTML (`Job OS`, pipeline rail, hero). Server was rendering; browser was not showing it. |
| Corrupted `.next` | Can cause blank via 500/chunk errors, but is an **ops** issue (`rm -rf .next`), not a lasting code regression. |
| Missing error boundaries | Symptom masker, not the regression that introduced the break. |

**Bisect:** Only the theme `useState` initializer produces **200 + full SSR HTML + blank client** — the exact failure mode observed.

---

## The fix (minimal — already in repo)

**Patch** (not a revert of dark mode — keep `ThemeScript` + provider):

```tsx
// components/theme-provider.tsx — lines 28-30, 44-62
const [theme, setThemeState] = useState<Theme>("system");
const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

useEffect(() => {
  const stored = getStoredTheme() ?? "system";
  setThemeState(stored);
  const resolved = resolveTheme(stored);
  setResolvedTheme(resolved);
  applyTheme(resolved);
  // … system preference listener …
}, []);
```

Supporting hardening (kept, not required for the core fix):

- `components/theme-toggle.tsx` — `suppressHydrationWarning` on the toggle group
- `components/theme-script.tsx` — applies `.dark` before paint (FOUC prevention, separate from hydration)

**Do not revert** to `getStoredTheme()` in `useState` initializers.

### What to keep vs. band-aids

| Change | Keep? | Reason |
|--------|-------|--------|
| `getAppContextSafe()` in layout | Yes | Separate DB-down path; prevents 500 blank screen. Not the screenshot regression. |
| `app/global-error.tsx`, `app/error.tsx` | Optional | Nice for future 500s; not needed to fix this regression. |
| `DbBanner` / offline profile | Yes | Correct degraded-mode UX when Postgres is down. |

---

## Before / after

| | Before fix (broken) | After fix (current) |
|---|---|---|
| Server `curl /` | 200, full HTML | 200, full HTML |
| Browser / Tauri | Blank white (hydration fails, `body` hidden) | Shell + dashboard visible |
| Theme preference | Read in `useState` initializer | Stable SSR state; synced in `useEffect` |
| After user picks dark mode + reload | Often blank | Works |

---

## Verification (2026-06-18)

```bash
lsof -ti:3000,3001 | xargs kill -9 2>/dev/null
rm -rf .next && npm run dev
# wait for Ready

curl -s http://localhost:3000/ | grep -oE 'Three steps|Job OS|Job search pipeline|Continue setup'
npm run typecheck
```

**Results:**

- `curl /` → HTTP 200, contains `Job OS`, `Three steps, then autopilot`, `Job search pipeline`, `Continue setup`
- `npm run typecheck` → pass (0 errors)

---

## Summary

**One regression:** dark-mode `ThemeProvider` initialized state from `localStorage` in `useState`, breaking hydration and leaving Next’s FOUC `display:none` on `body`.

**One minimal fix:** stable SSR initial state + `useEffect` sync (already applied). No further error boundaries or layout wrappers required for this specific break.
