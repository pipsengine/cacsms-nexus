import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
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

const instanceId = process.argv[2] ?? "ea-cacsms-mt5-0001";
const token = process.argv[3] ?? process.env.MT5_EA_INGESTION_TOKEN;

if (!token) {
  console.error("Usage: node scripts/verify-ea-token.mjs [instanceId] [ingestionToken]");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const result = await pool.query(
  "select state from mt5_module_states where module_key = $1",
  ["ea-bridge"]
);
const creds = result.rows[0]?.state?.issuedCredentialSecrets?.[instanceId];
await pool.end();

if (!creds?.ingestionTokenHash) {
  console.log(`No pairing credentials stored for ${instanceId}. Reissue EA Pairing first.`);
  process.exit(2);
}

const hash = createHash("sha256").update(token.trim()).digest("hex");
const matches = hash === creds.ingestionTokenHash;
console.log(JSON.stringify({
  instanceId,
  tokenLength: token.trim().length,
  matchesServer: matches,
  serverHashPrefix: creds.ingestionTokenHash.slice(0, 12),
  tokenHashPrefix: hash.slice(0, 12)
}, null, 2));
process.exit(matches ? 0 : 3);
