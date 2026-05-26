import fs from "node:fs";
import path from "node:path";
import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";

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

process.env.MT5_LOCAL_OPERATOR_MODE = "true";

const instanceId = "ea-cacsms-mt5-0001";
const ingestionToken = process.env.MT5_EA_INGESTION_TOKEN;
const signingSecret = process.env.MT5_EA_SIGNING_SECRET;
const messageType = "Heartbeat";
const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const nonce = `${instanceId}-${Date.now()}-test`;
const payload = {
  terminalName: "Office Terminal",
  accountLogin: "52877052",
  brokerConnected: true,
  marketDataActive: true,
  tradingEnabled: false,
  latencyMs: 42
};
const payloadJson = JSON.stringify(payload);
const canonical = [instanceId, messageType, timestamp, nonce, payloadJson].join("\n");
const signature = createHmac("sha256", signingSecret).update(canonical).digest("hex");
const body = JSON.stringify({ instanceId, messageType, timestamp, nonce, payloadJson, signature });

await fetch("http://127.0.0.1:3000/api/mt5/ea-bridge", {
  headers: { "x-mt5-role": "Infrastructure Admin" }
});

const response = await fetch("http://127.0.0.1:3000/api/mt5/ea-bridge/ingest/heartbeat", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${ingestionToken}`
  },
  body
});

console.log("status", response.status);
console.log(await response.text());
