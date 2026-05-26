import type { Mt5ModuleKey } from "./module-keys";
import { ensureMt5ModuleHydrated, flushMt5ModulePersistence } from "./persistence";

export async function ensureMt5Ready(moduleKey: Mt5ModuleKey) {
  await ensureMt5ModuleHydrated(moduleKey);
}

export async function withMt5Module<T>(moduleKey: Mt5ModuleKey, handler: () => Promise<T> | T): Promise<T> {
  await ensureMt5ModuleHydrated(moduleKey);
  try {
    return await handler();
  } finally {
    await flushMt5ModulePersistence();
  }
}
