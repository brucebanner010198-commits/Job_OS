/**
 * Run a DB-backed read and degrade gracefully if Postgres isn't reachable yet
 * (e.g. before `npm run db:up`). Keeps the app renderable without a database.
 */
export async function safeDb<T>(
  fn: () => Promise<T>,
  fallback: T,
): Promise<{ data: T; dbError: boolean }> {
  try {
    return { data: await fn(), dbError: false };
  } catch {
    return { data: fallback, dbError: true };
  }
}
