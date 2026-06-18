/**
 * Composite secret store - read precedence across multiple backends;
 * writes go to a single writable backend (file or keychain).
 */
import type { SecretStore } from "@/lib/secrets";

export interface CompositeOptions {
  /** Tried in order; first non-empty value wins. */
  read: SecretStore[];
  /** Receives all set/delete operations. */
  write: SecretStore;
}

export function compositeSecretStore(opts: CompositeOptions): SecretStore {
  return {
    async get(key: string): Promise<string | undefined> {
      for (const store of opts.read) {
        const v = await store.get(key);
        if (v !== undefined && v !== "") return v;
      }
      return undefined;
    },
    async set(key: string, value: string): Promise<void> {
      await opts.write.set(key, value);
    },
    async delete(key: string): Promise<void> {
      await opts.write.delete(key);
    },
  };
}
