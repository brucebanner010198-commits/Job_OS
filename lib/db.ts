import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
};

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and run npm run db:up",
    );
  }
  return connectionString;
}

/** Shared pg pool: use for reachability checks and Prisma adapter. */
export function getDbPool(): Pool {
  if (!globalForPrisma.pool) {
    const pool = new Pool({
      connectionString: getConnectionString(),
      max: parseInt(process.env.DB_POOL_MAX || "20", 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pool.on("error", (err) => {
      console.error("Unexpected error on idle pg client:", err);
    });
    globalForPrisma.pool = pool;
  }
  return globalForPrisma.pool;
}

/** Gracefully disconnect Prisma and pg pool on process termination. */
export async function disconnectDatabase(): Promise<void> {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
  }
  if (globalForPrisma.pool) {
    await globalForPrisma.pool.end().catch(() => {});
    globalForPrisma.pool = undefined;
  }
}

function createPrismaClient(): PrismaClient {
  const pool = getDbPool();

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/** Lazily create the client so importing this module never throws at load time. */
function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/** Proxy defers adapter/pool setup until first query - layout can render offline. */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
