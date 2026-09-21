import { getDbPool } from "@/lib/db";

type ReachabilityCache = { ok: boolean; at: number };

const CACHE_MS = 5_000;
let cache: ReachabilityCache | null = null;

function setCache(ok: boolean): boolean {
  cache = { ok, at: Date.now() };
  return ok;
}

async function pingWithTimeout(ms = 3000): Promise<number> {
  const start = Date.now();
  const pool = getDbPool();
  let timer: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Database ping timed out after ${ms}ms`)), ms);
  });

  const queryPromise = (async () => {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      return Date.now() - start;
    } finally {
      client.release();
    }
  })();

  try {
    return await Promise.race([queryPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Ping Postgres via the pg pool with a 3s timeout. */
export async function isDatabaseReachable(): Promise<boolean> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.ok;
  if (!process.env.DATABASE_URL) return setCache(false);

  try {
    await pingWithTimeout(3000);
    return setCache(true);
  } catch {
    return setCache(false);
  }
}

export type DbHealth =
  | { ok: true; latencyMs: number }
  | { ok: false; error: string };

/** Health snapshot for /api/health: updates the reachability cache with 3s timeout. */
export async function pingDatabase(): Promise<DbHealth> {
  if (!process.env.DATABASE_URL) {
    setCache(false);
    return { ok: false, error: "DATABASE_URL is not set" };
  }

  try {
    const latencyMs = await pingWithTimeout(3000);
    setCache(true);
    return { ok: true, latencyMs };
  } catch (err) {
    setCache(false);
    const message = err instanceof Error ? err.message : "database unreachable";
    return { ok: false, error: message };
  }
}
