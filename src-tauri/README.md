# Job OS — desktop shell (Tauri v2)

This wraps the Next.js app in a native macOS window. It's the proper home for the
three things that must stay local (plan §D): the **OS keychain** (secrets), the
**launchd agents** (catch-up + backup), and the **Playwright browser automation**
(it needs your real logged-in Chrome).

> **Status: scaffold.** The TypeScript side of Phase 12 (the keychain `SecretStore`
> and the launchd installer) is built and tested. This Rust shell can't be compiled
> in CI — build it on your Mac with the steps below.

## One-time setup

```bash
# 1. Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. Tauri CLI (already declared in package.json devDependencies)
npm install

# 3. Add app icons under src-tauri/icons/ (icon.icns, icon.png, etc.)
#    Generate them from a 1024×1024 PNG:  npm run tauri icon ./icon.png
```

## Develop / build

```bash
npm run tauri dev      # opens the window against the live Next.js dev server
npm run tauri build    # produces Job OS.app + a .dmg under src-tauri/target/release/bundle
```

## How it runs the Next.js server

The window loads `http://localhost:3000`. In **dev**, `beforeDevCommand` starts
`npm run dev`. For a **shippable** build, run the Next.js production server as a
Tauri **sidecar** so users don't need a terminal:

1. `npm run build` (already wired as `beforeBuildCommand`).
2. Bundle a Node runtime + the `.next/standalone` server as a sidecar binary and
   list it under `bundle.externalBin`, then spawn it from `main.rs` on startup and
   wait for `:3000` before showing the window.

The keychain + launchd pieces already work today via `JOB_OS_DESKTOP=1`:

```bash
JOB_OS_DESKTOP=1 npm run start     # secrets now resolve from the macOS Keychain
npm run install:agents -- --load   # install + load the catch-up & backup agents
```
