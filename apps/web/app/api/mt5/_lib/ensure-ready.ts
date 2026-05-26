import type { Mt5ModuleKey } from "./module-keys";
import { ensureMt5ModuleHydrated, ensureMt5ModulesHydrated, flushMt5ModulePersistence } from "./persistence";
import { reconcileInfrastructureFromControlCenter } from "./onboarding-cleanup";

const RECONCILE_MODULE_KEYS = new Set<Mt5ModuleKey>([
  "ea-bridge",
  "terminal-status",
  "account-sync",
  "ea-terminal-hub",
  "mt5-control-center"
]);

export const INFRASTRUCTURE_REGISTRATION_MODULE_KEYS = [
  "mt5-control-center",
  "broker-connections",
  "account-sync",
  "terminal-status",
  "ea-bridge",
  "ea-terminal-hub"
] as const satisfies readonly Mt5ModuleKey[];

export async function ensureMt5Ready(moduleKey: Mt5ModuleKey) {
  await ensureMt5ModuleHydrated(moduleKey);
}

export async function withMt5Module<T>(moduleKey: Mt5ModuleKey, handler: () => Promise<T> | T): Promise<T> {
  await ensureMt5ModuleHydrated(moduleKey);
  if (RECONCILE_MODULE_KEYS.has(moduleKey)) {
    await ensureMt5ModuleHydrated("mt5-control-center");
    reconcileInfrastructureFromControlCenter();
  }
  try {
    return await handler();
  } finally {
    await flushMt5ModulePersistence();
  }
}

export async function withMt5Modules<T>(moduleKeys: readonly Mt5ModuleKey[], handler: () => Promise<T> | T): Promise<T> {
  await ensureMt5ModulesHydrated(moduleKeys);
  if (moduleKeys.some((moduleKey) => RECONCILE_MODULE_KEYS.has(moduleKey))) {
    await ensureMt5ModuleHydrated("mt5-control-center");
    reconcileInfrastructureFromControlCenter();
  }
  try {
    return await handler();
  } finally {
    await flushMt5ModulePersistence();
  }
}
