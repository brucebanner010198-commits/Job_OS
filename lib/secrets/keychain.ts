/**
 * OS-keychain secret store (Phase 12, plan §D). Moves the highest-value secrets
 * (OpenRouter key, Gmail tokens, ElevenLabs/Cartesia keys, the backup key) out of
 * a plaintext .env and into the macOS Keychain when the app runs as the packaged
 * desktop build. It plugs into the existing SecretStore seam via setSecretStore()
 * - no call-site changes anywhere else.
 *
 * The keychain backend is INJECTABLE so the store logic is unit-testable with no
 * native module: the default backend dynamically loads `keytar` (an optional
 * dependency) and degrades gracefully - if keytar isn't installed (plain web/dev),
 * installDesktopSecretStore() leaves the env store in place rather than throwing.
 */
import { type SecretStore } from "@/lib/secrets";

/** The subset of keytar's API the store needs. Injectable for tests. */
export interface KeychainBackend {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
}

/** Keychain "service" namespace - all Job OS secrets live under one service. */
export const KEYCHAIN_SERVICE = process.env.KEYCHAIN_SERVICE ?? "com.jobos.app";

/** Wrap a keychain backend as a SecretStore (account = the secret key). */
export function keychainSecretStore(
  backend: KeychainBackend,
  service: string = KEYCHAIN_SERVICE,
): SecretStore {
  return {
    async get(key: string): Promise<string | undefined> {
      const v = await backend.getPassword(service, key);
      return v ?? undefined;
    },
    async set(key: string, value: string): Promise<void> {
      await backend.setPassword(service, key, value);
    },
    async delete(key: string): Promise<void> {
      await backend.deletePassword(service, key);
    },
  };
}

/**
 * Lazily load the `keytar` backend. Returns null when the native module isn't
 * available (so the caller can keep the env store). The specifier is held in a
 * variable so the bundler/tsc don't hard-require an optional dependency.
 */
export async function keytarBackend(): Promise<KeychainBackend | null> {
  try {
    const spec = "keytar";
    const keytar = (await import(spec)) as unknown as KeychainBackend;
    return {
      getPassword: (s, a) => keytar.getPassword(s, a),
      setPassword: (s, a, p) => keytar.setPassword(s, a, p),
      deletePassword: (s, a) => keytar.deletePassword(s, a),
    };
  } catch {
    return null;
  }
}
