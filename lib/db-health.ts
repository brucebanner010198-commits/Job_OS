import { getDbPool } from "@/lib/db";

type ReachabilityCache = { ok: boolean; at: number };

const CACHE_MS = 5_000;
let cache: ReachabilityCache | null = null;

function setCache(ok: boolean): boolean {
  cache = { ok, at: Date.now() };
  return ok;
}

/** Ping Postgres via the pg pool — no Prisma logging on failure. */
export async function isDatabaseReachable(): Promise<boolean> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.ok;
  if (!process.env.DATABASE_URL) return setCache(false);

  try {
    const client = await getDbPool().connect();
    try {
      await client.query("SELECT 1");
      return setCache(true);
    } finally {
      client.release();
    }
  } catch {
    return setCache(false);
  }
}

export type DbHealth =
  | { ok: true; latencyMs: number }
  | { ok: false; error: string };

/** Health snapshot for /api/health — updates the reachability cache. */
export async function pingDatabase(): Promise<DbHealth> {
  const start = Date.now();
  if (!process.env.DATABASE_URL) {
    setCache(false);
    return { ok: false, error: "DATABASE_URL is not set" };
  }

  try {
    const client = await getDbPool().connect();
    try {
      await client.query("SELECT 1");
      setCache(true);
      return { ok: true, latencyMs: Date.now() - start };
    } finally {
      client.release();
    }
  } catch (err) {
    setCache(false);
    const message = err instanceof Error ? err.message : "database unreachable";
    return { ok: false, error: message };
  }
}
