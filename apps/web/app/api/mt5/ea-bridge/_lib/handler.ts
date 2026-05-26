import { withMt5Modules } from "../../_lib/ensure-ready";
import { refreshPersistedModuleSlice } from "../../_lib/persistence";

const EA_BRIDGE_MODULE_KEYS = [
  "mt5-control-center",
  "account-sync",
  "terminal-status",
  "ea-bridge"
] as const;

export async function withEaBridgeStore<T>(handler: () => Promise<T> | T): Promise<T> {
  return withMt5Modules(EA_BRIDGE_MODULE_KEYS, async () => {
    await refreshPersistedModuleSlice("ea-bridge", "issuedCredentialSecrets");
    return handler();
  });
}
