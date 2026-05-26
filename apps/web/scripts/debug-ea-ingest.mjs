import fs from "node:fs";
import path from "node:path";
import { createHash, createHmac } from "node:crypto";
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

const instanceId = "ea-cacsms-mt5-0001";
const baseUrl = "http://127.0.0.1:3000";
const roleHeader = { "x-mt5-role": "Infrastructure Admin", "content-type": "application/json" };

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const dbRow = await pool.query(
  "select state from mt5_module_states where module_key = $1",
  ["ea-bridge"]
);
const creds = dbRow.rows[0]?.state?.issuedCredentialSecrets?.[instanceId];
console.log("DB credential entry:", creds ? { hashPrefix: creds.ingestionTokenHash?.slice(0, 12), signingSecretLen: creds.signingSecret?.length } : null);

const reissueResponse = await fetch(`${baseUrl}/api/mt5/ea-bridge/instances/${instanceId}/reissue-pairing`, {
  method: "POST",
  headers: roleHeader,
  body: JSON.stringify({ confirmed: true })
});
const reissueText = await reissueResponse.text();
console.log("reissue status", reissueResponse.status);
if (!reissueResponse.ok) {
  console.log(reissueText);
  await pool.end();
  process.exit(1);
}

const receipt = JSON.parse(reissueText);
const ingestionToken = receipt.ingestionToken ?? receipt.data?.ingestionToken;
const signingSecret = receipt.signingSecret ?? receipt.data?.signingSecret;
console.log("reissued tokens:", { ingestionTokenLen: ingestionToken?.length, signingSecretLen: signingSecret?.length });

const expectedHash = createHash("sha256").update(ingestionToken).digest("hex");
console.log("token hash matches receipt", expectedHash === createHash("sha256").update(ingestionToken).digest("hex"));

await new Promise((resolve) => setTimeout(resolve, 300));

const dbAfter = await pool.query(
  "select state from mt5_module_states where module_key = $1",
  ["ea-bridge"]
);
const credsAfter = dbAfter.rows[0]?.state?.issuedCredentialSecrets?.[instanceId];
console.log("DB after reissue:", credsAfter ? { hashPrefix: credsAfter.ingestionTokenHash?.slice(0, 12), hashMatchesToken: credsAfter.ingestionTokenHash === expectedHash, signingSecretMatches: credsAfter.signingSecret === signingSecret } : null);

const messageType = "Heartbeat";
const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const nonce = `${instanceId}-debug-${Date.now()}`;
const payloadJson = JSON.stringify({
  terminalName: "Office Terminal",
  accountLogin: "52877052",
  brokerConnected: true,
  marketDataActive: true,
  tradingEnabled: false,
  latencyMs: 42
});
const canonical = [instanceId, messageType, timestamp, nonce, payloadJson].join("\n");
const signature = createHmac("sha256", signingSecret).update(canonical).digest("hex");
const body = JSON.stringify({ instanceId, messageType, timestamp, nonce, payloadJson, signature });

const heartbeatResponse = await fetch(`${baseUrl}/api/mt5/ea-bridge/ingest/heartbeat`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${ingestionToken}`
  },
  body
});
console.log("heartbeat status", heartbeatResponse.status);
console.log(await heartbeatResponse.text());

await pool.end();
