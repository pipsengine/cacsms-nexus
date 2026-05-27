import fs from "node:fs";
import path from "node:path";
import { createHmac } from "node:crypto";
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
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const reissueResponse = await fetch(`${baseUrl}/api/mt5/ea-bridge/instances/${instanceId}/reissue-pairing`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-mt5-role": "Infrastructure Admin" },
  body: JSON.stringify({ confirmed: true })
});
if (!reissueResponse.ok) {
  console.error("reissue failed", reissueResponse.status, await reissueResponse.text());
  process.exit(1);
}
const receipt = JSON.parse(await reissueResponse.text());
const ingestionToken = receipt.ingestionToken ?? receipt.data?.ingestionToken;
const signingSecret = receipt.signingSecret ?? receipt.data?.signingSecret;

const messageType = "Heartbeat";
const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const nonce = `${instanceId}-gbpusd-${Date.now()}`;
const payload = {
  terminalName: "Office Terminal",
  accountLogin: "52877052",
  brokerConnected: true,
  marketDataActive: true,
  tradingEnabled: true,
  latencyMs: 38,
  quoteSymbol: "GBPUSD",
  bid: 1.27491,
  ask: 1.27495
};
const payloadJson = JSON.stringify(payload);
const signature = createHmac("sha256", signingSecret)
  .update([instanceId, messageType, timestamp, nonce, payloadJson].join("\n"))
  .digest("hex");
const body = JSON.stringify({ instanceId, messageType, timestamp, nonce, payloadJson, signature });

const response = await fetch("http://127.0.0.1:3000/api/mt5/ea-bridge/ingest/heartbeat", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${ingestionToken}`
  },
  body
});

console.log("heartbeat", response.status, await response.text());
await new Promise((resolve) => setTimeout(resolve, 500));

for (const endpoint of ["symbol-sync", "market-watch", "chart-control", "spread-monitor"]) {
  const moduleResponse = await fetch(`http://127.0.0.1:3000/api/mt5/${endpoint}`);
  const json = await moduleResponse.json();
  const items = json.symbols ?? json.instruments ?? json.spreads ?? [];
  const first = items[0];
  console.log(
    endpoint,
    "count=",
    items.length,
    first?.brokerSymbol ?? first?.symbol,
    first?.normalizedSymbol ?? first?.bid,
    first?.lastTickAt ?? first?.lastTickTime
  );
}

await pool.end();
