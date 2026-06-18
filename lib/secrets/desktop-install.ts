/**
 * Desktop-only secret bootstrap - isolated from keychain.ts so the web build
 * never traces fs/path through instrumentation.
 */
import { setSecretStore, type SecretStore } from "@/lib/secrets";
import { compositeSecretStore } from "@/lib/secrets/composite";
import {
  keychainSecretStore,
  keytarBackend,
} from "@/lib/secrets/keychain";

/** Activate keychain → file → env composite when desktop + keytar are available. */
export async function installDesktopSecretStore(): Promise<"keychain" | "env"> {
  if (process.env.JOB_OS_DESKTOP !== "1") return "env";
  const backend = await keytarBackend();
  if (!backend) return "env";
  const keychain = keychainSecretStore(backend);
  const { fileSecretStore } = await import("@/lib/secrets/file-store");
  const file = fileSecretStore();
  const env: SecretStore = {
    async get(key) {
      const v = process.env[key];
      return v !== undefined && v !== "" ? v : undefined;
    },
    async set() {
      throw new Error("Env store is read-only");
    },
    async delete() {
      throw new Error("Env store is read-only");
    },
  };
  setSecretStore(
    compositeSecretStore({
      read: [keychain, file, env],
      write: keychain,
    }),
  );
  return "keychain";
}
