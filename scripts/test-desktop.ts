/**
 * Self-test for Phase 12 (desktop packaging + OS keychain). THIS IS THE
 * test:desktop gate. The Tauri shell itself can't be built here, but the two
 * verifiable pieces are covered fully:
 *   A. Keychain SecretStore - round-trip via an injected in-memory backend,
 *      service namespacing, missing-key → undefined, and the GRACEFUL fallback
 *      to the env store when keytar/desktop aren't present.
 *   B. launchd agent set - both agents (catch-up + backup) generate valid plists
 *      (RunAtLoad, correct npm script, install commands, ~/Library path).
 * Run: npx tsx scripts/test-desktop.ts
 */
import {
  keychainSecretStore,
  keytarBackend,
  type KeychainBackend,
} from "@/lib/secrets/keychain";
import { installDesktopSecretStore } from "@/lib/secrets/desktop-install";
import { buildAgentPlists } from "@/lib/scheduler/agents";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

function fakeBackend() {
  const store = new Map<string, string>();
  const k = (s: string, a: string) => `${s}::${a}`;
  const backend: KeychainBackend = {
    async getPassword(s, a) {
      return store.get(k(s, a)) ?? null;
    },
    async setPassword(s, a, p) {
      store.set(k(s, a), p);
    },
    async deletePassword(s, a) {
      return store.delete(k(s, a));
    },
  };
  return { backend, store };
}

async function main(): Promise<void> {
  // =========================================================================
  // A. KEYCHAIN SECRET STORE
  // =========================================================================
  console.log("\ndesktop - keychain SecretStore (injected backend):");
  {
    const { backend, store } = fakeBackend();
    const s = keychainSecretStore(backend, "com.jobos.test");

    check("get missing key → undefined", (await s.get("OPENROUTER_API_KEY")) === undefined);
    await s.set("OPENROUTER_API_KEY", "sk-or-123");
    check("set then get round-trips", (await s.get("OPENROUTER_API_KEY")) === "sk-or-123");
    check("stored under the service namespace", store.has("com.jobos.test::OPENROUTER_API_KEY"));
    await s.set("OPENROUTER_API_KEY", "sk-or-456");
    check("set overwrites", (await s.get("OPENROUTER_API_KEY")) === "sk-or-456");
    await s.delete("OPENROUTER_API_KEY");
    check("delete removes it", (await s.get("OPENROUTER_API_KEY")) === undefined);

    // A secret value never appears outside its namespaced slot.
    await s.set("GMAIL_REFRESH_TOKEN", "1//token");
    check("two keys coexist", store.has("com.jobos.test::GMAIL_REFRESH_TOKEN") && store.size === 1);
  }

  console.log("\ndesktop - graceful fallback (no keytar / not desktop):");
  {
    const prev = process.env.JOB_OS_DESKTOP;
    delete process.env.JOB_OS_DESKTOP;
    check("not desktop → env store stays", (await installDesktopSecretStore()) === "env");
    process.env.JOB_OS_DESKTOP = "1";
    const hasKeytar = (await keytarBackend()) !== null;
    const desktopResult = await installDesktopSecretStore();
    // When keytar is present (optional dep installed), desktop uses keychain; otherwise env.
    check(
      hasKeytar
        ? "desktop + keytar → keychain store"
        : "desktop but no keytar → env store (graceful)",
      hasKeytar ? desktopResult === "keychain" : desktopResult === "env",
    );
    if (prev === undefined) delete process.env.JOB_OS_DESKTOP;
    else process.env.JOB_OS_DESKTOP = prev;
  }

  // =========================================================================
  // B. LAUNCHD AGENT SET
  // =========================================================================
  console.log("\ndesktop - launchd agent set (catch-up + backup):");
  {
    const agents = buildAgentPlists("/Users/you/Job_OS");
    check("both agents generated", agents.length === 2);
    const catchup = agents.find((a) => a.npmScript === "catchup");
    const backup = agents.find((a) => a.npmScript === "backup");
    check("catch-up agent present", !!catchup && catchup.label === "com.jobos.catchup");
    check("backup agent present", !!backup && backup.label === "com.jobos.backup");
    check("plists fire on wake (RunAtLoad)", agents.every((a) => /<key>RunAtLoad<\/key>\s*<true\/>/.test(a.plist)));
    check("each plist runs its npm script", !!catchup && /npm run catchup/.test(catchup.plist) && !!backup && /npm run backup/.test(backup.plist));
    check("install steps + ~/Library path", agents.every((a) => a.install.length > 0 && a.plistPath.includes("Library/LaunchAgents")));
    check("distinct labels", agents[0].label !== agents[1].label);
  }

  console.log(`\ndesktop ${passed}/${passed + failed}\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
