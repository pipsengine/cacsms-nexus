# Cacsms EA (System Experts Directory)

Canonical Expert Advisor source tree for Cacsms Nexus MT5 bridge connectivity.

Default path: `C:\Next-Generation\cacsms-nexus\services\cacsms-ea`

Override with `CACSMS_EA_ROOT` in `apps/web/.env.local`.

## Layout

```
services/cacsms-ea/
  Experts/
    NexusBridgeEA/
      NexusBridgeEA.mq5
      Cacsms/
        NexusConfig.mqh
        NexusJson.mqh
        NexusCrypto.mqh
        NexusTime.mqh
        NexusHttp.mqh
        NexusEnvelope.mqh
        NexusTelemetry.mqh
        NexusCommands.mqh
```

The EA folder is **self-contained** — no separate `MQL5/Include` copy is required to compile.

Deploy **Experts/NexusBridgeEA/** via **EA & Terminal Hub** (or manual copy). The hub syncs the full folder tree including all `.mqh` modules.

## Capabilities (v2.1)

| Feature | Description |
| --- | --- |
| Signed telemetry | Heartbeat, account snapshot, position update, pending order update |
| Account binding | Payloads validated against onboarded EA instance + account login |
| HTTP resilience | Configurable timeout, retry count, and backoff |
| Symbol scope | Optional comma-separated filter (empty = all symbols) |
| Command poll | Signed poll of risk-approved pending commands |
| Guarded execution | Optional `EnableCommandExecution` with max volume, trade permission, and symbol checks |
| Execution feedback | Signed ack to `/instances/:id/command-ack` |
| Trade hooks | `OnTradeTransaction` pushes full telemetry after deals/orders/positions change |

## MT5 Setup

1. Copy or link this folder via **EA & Terminal Hub**, or manually copy into `MQL5/Experts` and `MQL5/Include`.
2. Open MetaEditor and compile `Experts/NexusBridgeEA/NexusBridgeEA.mq5`.
3. In MT5: **Tools → Options → Expert Advisors** — allow WebRequest for your Nexus origin (e.g. `http://localhost:3000`).
4. Attach the EA to any chart on the target logged-in account.
5. Paste onboarding receipt values into EA inputs.

## Recommended Inputs

```text
NexusBaseUrl              = https://your-nexus-origin
EaInstanceId              = ea-cacsms-mt5-0001
IngestionToken            = (one-time receipt)
SigningSecret             = (one-time receipt)
HeartbeatIntervalSeconds  = 10
SnapshotIntervalSeconds   = 15
PositionIntervalSeconds   = 20
OrderIntervalSeconds      = 20
CommandPollIntervalSeconds= 5
HttpTimeoutMs             = 8000
HttpRetryCount            = 2
MaxCommandVolume          = 1.0
SymbolScope               = EURUSD,XAUUSD
PollApprovedCommands      = false
EnableCommandExecution    = false
```

Keep `EnableCommandExecution=false` until Nexus trading channel and risk policies are verified. When enabled, only **Market** and **Limit** command types are supported in this release.

## Nexus API Endpoints

See [NEXUS_BRIDGE_SETUP.md](../../docs/mt5-docs/NEXUS_BRIDGE_SETUP.md) for envelope signing, security rules, and onboarding flow.

## Legacy Copy

`mt5/expert-advisors/NexusBridgeEA.mq5` is kept for backward compatibility. Prefer this canonical tree for new deployments.
