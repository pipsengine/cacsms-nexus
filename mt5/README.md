# MT5

`expert-advisors/NexusBridgeEA.mq5` is the terminal-side connector for Cacsms Nexus. It sends HMAC-signed heartbeat and account snapshot messages into the EA Bridge API and can poll the signed command channel.

The baseline connector intentionally does not execute trades. Approved-command parsing, order risk validation, broker submission, and signed execution acknowledgements must be installed and validated before any live trading channel is enabled.

New terminals are paired through **MT5 Control Center > Terminal Onboarding**, which returns one-time EA credentials after creating disabled terminal and account monitoring records.

Setup and API contract: [NEXUS_BRIDGE_SETUP.md](../docs/mt5-docs/NEXUS_BRIDGE_SETUP.md)
