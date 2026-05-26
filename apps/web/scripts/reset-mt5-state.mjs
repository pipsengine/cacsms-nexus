/**
 * Wipe persisted MT5 module state so the app starts from empty seeds.
 * Usage: node scripts/reset-mt5-state.mjs
 * Requires DATABASE_URL (reads apps/web/.env.local via dotenv if present).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envLocal = path.join(root, ".env.local");

if (fs.existsSync(envLocal)) {
  for (const line of fs.readFileSync(envLocal, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Add it to apps/web/.env.local first.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });
const result = await pool.query("delete from mt5_module_states");
console.log(`Deleted ${result.rowCount ?? 0} MT5 module state row(s).`);
console.log("Restart npm run dev:all so all MT5 pages reload from empty seeds.");
await pool.end();
