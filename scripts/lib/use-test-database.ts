/**
 * Import FIRST in any test that writes to Postgres. Points the process at a
 * separate "<db>_test" database so test fixtures never land in real data,
 * creating and migrating it on first use. Synchronous on purpose: it must run
 * before any other module opens a connection.
 */
import { config } from "dotenv";
import { execFileSync } from "node:child_process";

config({ quiet: true });

const realUrl = process.env.DATABASE_URL;
if (!realUrl) throw new Error("DATABASE_URL is not set.");

const url = new URL(realUrl);
const realDb = url.pathname.slice(1);
if (!realDb.endsWith("_test")) {
  const testDb = `${realDb}_test`;
  url.pathname = `/${testDb}`;
  const createIfMissing = `
    const { Client } = require("pg");
    (async () => {
      const c = new Client({ connectionString: process.argv[1] });
      await c.connect();
      const r = await c.query("SELECT 1 FROM pg_database WHERE datname = $1", [process.argv[2]]);
      if (r.rowCount === 0) await c.query('CREATE DATABASE "' + process.argv[2] + '"');
      await c.end();
    })().catch((e) => { console.error(e.message); process.exit(1); });`;
  execFileSync(process.execPath, ["-e", createIfMissing, realUrl, testDb], { stdio: "inherit" });
  process.env.DATABASE_URL = url.toString();
  execFileSync("npx", ["prisma", "migrate", "deploy"], { stdio: "ignore", env: process.env });
}
