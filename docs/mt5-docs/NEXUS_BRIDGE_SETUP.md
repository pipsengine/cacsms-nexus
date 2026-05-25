# MT5 EA Bridge Setup

## Connection Model

Cacsms Nexus connects to an MT5 terminal through `NexusBridgeEA.mq5`, installed in each terminal instance. MT5 does not expose a general broker-account REST connection for this application; the authenticated terminal logs into its broker account and the EA publishes approved terminal data to Nexus.

The implemented first connection path is:

1. MT5 terminal signs into the broker account using the broker server and credentials managed inside MT5.
2. `NexusBridgeEA` sends a signed heartbeat and account snapshot over HTTPS to the Nexus EA Bridge API.
3. Nexus verifies the bearer credential, HMAC signature, timestamp window, nonce uniqueness, and EA-to-account binding.
4. Accepted account snapshots are handed to Account Sync reconciliation; material differences disable the unsafe account trading state.
5. An EA may submit a signed command poll and receive only risk-approved pending commands for its own instance.
6. Execution feedback has a signed acknowledgement endpoint, but the supplied EA deliberately does not execute orders.

## Configure Nexus

Create `apps/web/.env.local` for local operation and use secret management in deployed environments:

```dotenv
MT5_EA_INGESTION_TOKEN=replace-with-long-random-ingestion-token
MT5_EA_SIGNING_SECRET=replace-with-long-random-fallback-signing-secret
MT5_EA_SIGNING_SECRET_EA_LD4_01=replace-with-unique-secret-for-this-ea-instance
```

Use a distinct `MT5_EA_SIGNING_SECRET_<INSTANCE_ID>` per EA instance in production. Instance IDs are normalized to uppercase with non-alphanumeric characters replaced by underscores; `ea-ld4-01` becomes `MT5_EA_SIGNING_SECRET_EA_LD4_01`.

For a new connection, open **MT5 Control Center > Terminal Onboarding** as a Super Admin or Infrastructure Admin. This controlled operation registers the terminal against an existing broker server, creates a trade-blocked account binding, creates its Terminal Status monitor, and displays a one-time EA pairing receipt.

The equivalent API is `POST /api/mt5/onboarding/terminals`, submitted by an authorized infrastructure role with `"confirmed": true`.

A verified signed heartbeat activates terminal monitoring. The first signed account snapshot establishes the initial reconciliation baseline for a new account binding, but does not enable trading.

## Install In MT5

1. Open MetaEditor from the target terminal.
2. Place [NexusBridgeEA.mq5](../../mt5/expert-advisors/NexusBridgeEA.mq5) under the terminal's `MQL5/Experts` directory and compile it.
3. In MT5, open `Tools > Options > Expert Advisors`.
4. Enable algorithmic trading for the EA as appropriate for telemetry, and add the Nexus origin under `Allow WebRequest for listed URL`, for example `http://localhost:3000` for local development or the production HTTPS origin.
5. Attach the EA to a chart in the terminal that is logged into the intended broker account.
6. Set EA inputs from the one-time onboarding receipt:

```text
NexusBaseUrl = https://your-nexus-origin.example
EaInstanceId = ea-ld4-01
IngestionToken = one-time receipt token
SigningSecret = one-time receipt signing secret
PollApprovedCommands = false
EnableCommandExecution = false
```

Keep `EnableCommandExecution=false`. The provided connector is for telemetry and controlled command delivery validation; it contains no live order-placement implementation.

## Implemented Terminal Endpoints

All terminal requests require `Authorization: Bearer <MT5_EA_INGESTION_TOKEN>` and an HMAC-SHA256 signed JSON envelope.

| Purpose | Endpoint |
| --- | --- |
| Heartbeat | `POST /api/mt5/ea-bridge/ingest/heartbeat` |
| Account snapshot and reconciliation | `POST /api/mt5/ea-bridge/ingest/account-snapshot` |
| Position update intake | `POST /api/mt5/ea-bridge/ingest/positions` |
| Pending order update intake | `POST /api/mt5/ea-bridge/ingest/orders` |
| Signed command polling | `POST /api/mt5/ea-bridge/instances/:id/pending-commands` |
| Execution acknowledgement | `POST /api/mt5/ea-bridge/instances/:id/command-ack` |
| Alternate execution feedback route | `POST /api/mt5/ea-bridge/ingest/execution-feedback` |

Envelope shape:

```json
{
  "instanceId": "ea-ld4-01",
  "messageType": "Heartbeat",
  "timestamp": "2026-05-25T12:00:00Z",
  "nonce": "ea-ld4-01-1779700800-101",
  "payloadJson": "{\"accountLogin\":\"73018421\"}",
  "signature": "<lowercase hex hmac-sha256>"
}
```

The signature input is the exact UTF-8 text below, including line breaks and the unchanged `payloadJson` string:

```text
instanceId
messageType
timestamp
nonce
payloadJson
```

Nexus rejects a reused nonce, an envelope more than 60 seconds outside server time, a modified payload, an incorrect instance signing secret, and an account login not bound to the EA instance.

## Production Work Remaining

The API contract, security boundary, terminal telemetry source, account snapshot handoff, and command delivery/feedback endpoints are implemented. Current page state stores are in memory and start from development seed data. Before live broker operation:

1. Replace in-memory EA Bridge and Account Sync stores with database repositories and durable audit storage.
2. Replace temporary one-time onboarding credential issuance with managed secret vault storage and credential rotation policy.
3. Add position and pending-order record reconciliation from terminal payloads, not only message intake.
4. Implement and certify the guarded MT5 order execution module, including risk approval, idempotency, maximum volume/slippage controls, acknowledgement, and emergency disable enforcement.
5. Deploy behind HTTPS, move secrets to managed storage, and stream live updates through durable WebSocket or SSE infrastructure.
