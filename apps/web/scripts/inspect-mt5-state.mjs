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

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const keys = ["ea-bridge", "mt5-control-center", "terminal-status", "account-sync"];
for (const moduleKey of keys) {
  const result = await pool.query(
    "select state, updated_at from mt5_module_states where module_key = $1",
    [moduleKey]
  );
  const row = result.rows[0];
  console.log(`\n=== ${moduleKey} (${row?.updated_at ?? "missing"}) ===`);
  if (!row?.state) {
    console.log("(empty)");
    continue;
  }
  const state = row.state;
  if (state.instances) {
    console.log("instances:", JSON.stringify(state.instances.map((i) => ({ id: i.id, account: i.accountLogin, terminal: i.terminalName })), null, 2));
    console.log("credential keys:", Object.keys(state.issuedCredentialSecrets ?? {}));
  }
  if (state.terminals) {
    console.log("terminals:", JSON.stringify(state.terminals.map((t) => ({ id: t.id, uuid: t.terminalUuid, name: t.terminalName, account: t.accountLogin })), null, 2));
  }
  if (state.accounts) {
    console.log("accounts:", JSON.stringify(state.accounts.map((a) => ({ id: a.id, login: a.accountLogin })), null, 2));
  }
}
await pool.end();
