/**
 * Integrations portal + composite secret store validation gate.
 * Run: npm run test:integrations
 */
import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import {
  getSecret,
  setSecret,
  deleteSecret,
  setSecretStore,
} from "@/lib/secrets";
import { compositeSecretStore } from "@/lib/secrets/composite";
import { fileSecretStore } from "@/lib/secrets/file-store";
import {
  allIntegrationStatuses,
  integrationConfigured,
  integrationById,
} from "@/lib/integrations/registry";
import { getSecretSync, invalidateSecretSyncCache } from "@/lib/secrets/sync";
import { liveVoiceConfigured } from "@/lib/interview/voice-live";
import { jsearchSource } from "@/lib/jobs/sources/jsearch";

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

async function withIsolatedFileStore(
  fn: (dir: string) => Promise<void>,
): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "jobos-secrets-"));
  const prevCwd = process.cwd();
  process.chdir(dir);
  try {
    const file = fileSecretStore();
    const env = {
      async get(key: string) {
        const v = process.env[key];
        return v?.trim() || undefined;
      },
      async set() {
        throw new Error("read-only");
      },
      async delete() {
        throw new Error("read-only");
      },
    };
    setSecretStore(compositeSecretStore({ read: [file, env], write: file }));
    await fn(dir);
  } finally {
    process.chdir(prevCwd);
    await rm(dir, { recursive: true, force: true });
    invalidateSecretSyncCache();
  }
}

async function main(): Promise<void> {
  console.log("\nintegrations - composite store:");

  await withIsolatedFileStore(async () => {
    await setSecret("OPENROUTER_API_KEY", "sk-test-openrouter");
    invalidateSecretSyncCache();
    const v = await getSecret("OPENROUTER_API_KEY");
    check("setSecret → getSecret resolves", v === "sk-test-openrouter");
    check("getSecretSync sees portal key", getSecretSync("OPENROUTER_API_KEY") === "sk-test-openrouter");

    await setSecret("ELEVENLABS_API_KEY", "el-test");
    await setSecret("ELEVENLABS_AGENT_AI_SCREEN", "agent-screen-1");
    invalidateSecretSyncCache();
    check("liveVoiceConfigured with portal keys", liveVoiceConfigured() === true);

    await setSecret("JSEARCH_API_KEY", "js-test");
    invalidateSecretSyncCache();
    check("jsearch enabled with portal key", jsearchSource.enabled() === true);
  });

  console.log("\nintegrations - registry:");
  const openrouter = integrationById("openrouter");
  check("openrouter integration exists", Boolean(openrouter));
  if (openrouter) {
    await withIsolatedFileStore(async () => {
      delete process.env.OPENROUTER_API_KEY;
      await deleteSecret("OPENROUTER_API_KEY");
      invalidateSecretSyncCache();
      check(
        "openrouter not configured when empty",
        (await integrationConfigured(openrouter)) === false,
      );
      await setSecret("OPENROUTER_API_KEY", "k");
      invalidateSecretSyncCache();
      check("openrouter configured after save", (await integrationConfigured(openrouter)) === true);
    });
  }

  const statuses = await allIntegrationStatuses();
  check("allIntegrationStatuses returns entries", statuses.length >= 5);
  check(
    "status objects have no value fields",
    statuses.every((s) => !("value" in s) && !("secret" in s)),
  );

  console.log(`\nintegrations ${passed}/${passed + failed}\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
