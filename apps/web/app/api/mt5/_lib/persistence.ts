import "server-only";

import { MT5_MODULE_KEYS, type Mt5ModuleKey } from "./module-keys";

async function runQuery<T extends import("pg").QueryResultRow>(text: string, values?: unknown[]) {
  const { query } = await import("@/lib/postgres");
  return query<T>(text, values);
}

const moduleImporters: Record<Mt5ModuleKey, () => Promise<unknown>> = {
  "mt5-control-center": () => import("./store"),
  "account-sync": () => import("../account-sync/_lib/store"),
  "broker-connections": () => import("../broker-connections/_lib/store"),
  "chart-control": () => import("../chart-control/_lib/store"),
  "chart-templates": () => import("../chart-templates/_lib/store"),
  "connection-health": () => import("../connection-health/_lib/store"),
  "ea-bridge": () => import("../ea-bridge/_lib/store"),
  "ea-terminal-hub": () => import("../ea-terminal-hub/_lib/store"),
  "ea-monitoring": () => import("../ea-monitoring/_lib/store"),
  "error-logs": () => import("../error-logs/_lib/store"),
  "execution-logs": () => import("../execution-logs/_lib/store"),
  "execution-queue": () => import("../execution-queue/_lib/store"),
  "latency-monitor": () => import("../latency-monitor/_lib/store"),
  "market-watch": () => import("../market-watch/_lib/store"),
  "order-router": () => import("../order-router/_lib/store"),
  "slippage-monitor": () => import("../slippage-monitor/_lib/store"),
  "spread-monitor": () => import("../spread-monitor/_lib/store"),
  "symbol-sync": () => import("../symbol-sync/_lib/store"),
  "terminal-status": () => import("../terminal-status/_lib/store"),
  "trade-synchronization": () => import("../trade-synchronization/store")
};

type ModuleEntry = {
  state: object;
  hydrated: boolean;
};

const moduleRegistry = new Map<Mt5ModuleKey, ModuleEntry>();
const persistTimers = new Map<Mt5ModuleKey, ReturnType<typeof setTimeout>>();
const hydratePromises = new Map<Mt5ModuleKey, Promise<void>>();
let schemaReady: Promise<void> | null = null;

declare global {
  var __cacsmsMt5DevStates: Partial<Record<Mt5ModuleKey, object>> | undefined;
}

function resolveModuleSeed<T extends object>(moduleKey: Mt5ModuleKey, createSeed: () => T): T {
  if (shouldUseDatabase() || process.env.NODE_ENV === "production") {
    return createSeed();
  }

  if (!globalThis.__cacsmsMt5DevStates) {
    globalThis.__cacsmsMt5DevStates = {};
  }

  const cached = globalThis.__cacsmsMt5DevStates[moduleKey] as T | undefined;
  if (cached) {
    return cached;
  }

  const seeded = createSeed();
  globalThis.__cacsmsMt5DevStates[moduleKey] = seeded;
  return seeded;
}

const MUTATING_ARRAY_METHODS = new Set([
  "copyWithin",
  "fill",
  "pop",
  "push",
  "reverse",
  "shift",
  "sort",
  "splice",
  "unshift"
]);

function shouldUseDatabase() {
  if (process.env.MT5_USE_DATABASE === "false") {
    return false;
  }
  if (process.env.NODE_ENV === "test" && process.env.MT5_USE_DATABASE !== "true") {
    return false;
  }
  return Boolean(process.env.DATABASE_URL);
}

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = runQuery(`
      create table if not exists mt5_module_states (
        module_key text primary key,
        state jsonb not null default '{}'::jsonb,
        updated_at timestamptz not null default now()
      )
    `).then(() => undefined);
  }
  await schemaReady;
}

function serializeState(state: object) {
  return JSON.stringify(state, (_key, value) => {
    if (value instanceof Set) {
      return { __cacsmsSet: true, values: Array.from(value) };
    }
    if (value && typeof value === "object" && (value as Record<string, unknown>).__cacsmsSet === true) {
      return value;
    }
    return value;
  });
}

function reviveValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => reviveValue(item)) as T;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.__cacsmsSet === true && Array.isArray(record.values)) {
      return new Set(record.values) as T;
    }

    for (const [key, nested] of Object.entries(record)) {
      record[key] = reviveValue(nested);
    }
  }

  return value;
}

async function loadModuleState(moduleKey: Mt5ModuleKey) {
  await ensureSchema();
  const result = await runQuery<{ state: object }>(
    "select state from mt5_module_states where module_key = $1",
    [moduleKey]
  );
  const row = result.rows[0]?.state;
  return row ? (reviveValue(row) as object) : null;
}

async function writeModuleState(moduleKey: Mt5ModuleKey, state: object) {
  await ensureSchema();
  await runQuery(
    `
      insert into mt5_module_states (module_key, state, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (module_key)
      do update set state = excluded.state, updated_at = now()
    `,
    [moduleKey, serializeState(state)]
  );
}

function applyHydratedState(target: Record<string, unknown>, source: Record<string, unknown>) {
  for (const key of Object.keys(target)) {
    if (!(key in source)) {
      delete target[key];
    }
  }

  for (const [key, sourceValue] of Object.entries(source)) {
    const targetValue = target[key];

    if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
      targetValue.splice(0, targetValue.length, ...sourceValue.map((item) => reviveValue(item)));
      continue;
    }

    if (
      sourceValue &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue) &&
      !(sourceValue instanceof Set) &&
      !("__cacsmsSet" in (sourceValue as Record<string, unknown>)) &&
      targetValue &&
      typeof targetValue === "object" &&
      !Array.isArray(targetValue) &&
      !(targetValue instanceof Set)
    ) {
      applyHydratedState(targetValue as Record<string, unknown>, sourceValue as Record<string, unknown>);
      continue;
    }

    target[key] = reviveValue(sourceValue);
  }
}

function schedulePersist(moduleKey: Mt5ModuleKey, state: object) {
  if (!shouldUseDatabase()) {
    return;
  }

  const existing = persistTimers.get(moduleKey);
  if (existing) {
    clearTimeout(existing);
  }

  persistTimers.set(
    moduleKey,
    setTimeout(() => {
      persistTimers.delete(moduleKey);
      void writeModuleState(moduleKey, state).catch((error) => {
        console.error(`Failed to persist MT5 module state for "${moduleKey}".`, error);
      });
    }, 150)
  );
}

const TRACKED_SET = Symbol("cacsmsTrackedSet");

function trackSet<T>(moduleKey: Mt5ModuleKey, rootState: object, set: Set<T>): Set<T> {
  const marker = set as Set<T> & { [TRACKED_SET]?: boolean };
  if (marker[TRACKED_SET]) {
    return set;
  }
  marker[TRACKED_SET] = true;

  const wrap =
    <Args extends unknown[], Result>(method: (...args: Args) => Result) =>
    (...args: Args) => {
      const result = method(...args);
      schedulePersist(moduleKey, rootState);
      return result;
    };

  set.add = wrap(set.add.bind(set));
  set.delete = wrap(set.delete.bind(set));
  set.clear = wrap(set.clear.bind(set));
  return set;
}

function trackValue(moduleKey: Mt5ModuleKey, rootState: object, value: unknown, seen: WeakSet<object>): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return value;
  }
  seen.add(value);

  if (value instanceof Set) {
    return trackSet(moduleKey, rootState, value);
  }

  if (Array.isArray(value)) {
    return new Proxy(value, {
      get(target, property, receiver) {
        const current = Reflect.get(target, property, receiver);
        if (typeof current === "function" && MUTATING_ARRAY_METHODS.has(String(property))) {
          return (...args: unknown[]) => {
            const result = current.apply(target, args);
            schedulePersist(moduleKey, rootState);
            return result;
          };
        }
        if (typeof current === "object" && current !== null) {
          return trackValue(moduleKey, rootState, current, seen);
        }
        return current;
      },
      set(target, property, nextValue, receiver) {
        const tracked = trackValue(moduleKey, rootState, nextValue, seen);
        const result = Reflect.set(target, property, tracked, receiver);
        schedulePersist(moduleKey, rootState);
        return result;
      }
    });
  }

  return new Proxy(value as object, {
    get(target, property, receiver) {
      const current = Reflect.get(target, property, receiver);
      if (typeof current === "object" && current !== null) {
        return trackValue(moduleKey, rootState, current, seen);
      }
      return current;
    },
    set(target, property, nextValue, receiver) {
      const tracked = trackValue(moduleKey, rootState, nextValue, seen);
      const result = Reflect.set(target, property, tracked, receiver);
      schedulePersist(moduleKey, rootState);
      return result;
    }
  });
}

function registerModuleState(moduleKey: Mt5ModuleKey, state: object) {
  if (!shouldUseDatabase()) {
    return state;
  }

  const tracked = trackValue(moduleKey, state, state, new WeakSet()) as object;
  moduleRegistry.set(moduleKey, { state: tracked, hydrated: false });
  return tracked;
}

export function bindPersistedMt5State<T extends object>(moduleKey: Mt5ModuleKey, createSeed: () => T): T {
  const state = resolveModuleSeed(moduleKey, createSeed);
  return registerModuleState(moduleKey, state) as T;
}

export async function preloadMt5ModuleStates() {
  if (!shouldUseDatabase()) {
    return;
  }

  await Promise.all(MT5_MODULE_KEYS.map((moduleKey) => ensureMt5ModuleHydrated(moduleKey)));
}

export async function ensureMt5ModuleHydrated(moduleKey: Mt5ModuleKey) {
  if (!shouldUseDatabase()) {
    return;
  }

  const inflight = hydratePromises.get(moduleKey);
  if (inflight) {
    await inflight;
    return;
  }

  const hydrate = (async () => {
    if (!moduleRegistry.has(moduleKey)) {
      await moduleImporters[moduleKey]();
    }

    const entry = moduleRegistry.get(moduleKey);
    if (!entry || entry.hydrated) {
      return;
    }

    const loaded = await loadModuleState(moduleKey);
    if (loaded) {
      applyHydratedState(entry.state as Record<string, unknown>, loaded as Record<string, unknown>);
      trackValue(moduleKey, entry.state, entry.state, new WeakSet());
    } else {
      await writeModuleState(moduleKey, entry.state);
    }

    entry.hydrated = true;
  })();

  hydratePromises.set(moduleKey, hydrate);
  try {
    await hydrate;
  } finally {
    hydratePromises.delete(moduleKey);
  }
}

export async function ensureMt5ModulesHydrated(moduleKeys: readonly Mt5ModuleKey[]) {
  const uniqueKeys = [...new Set(moduleKeys)];
  await Promise.all(uniqueKeys.map((moduleKey) => ensureMt5ModuleHydrated(moduleKey)));
}

export async function refreshPersistedModuleSlice(moduleKey: Mt5ModuleKey, sliceKey: string) {
  if (!shouldUseDatabase()) {
    return;
  }

  if (!moduleRegistry.has(moduleKey)) {
    await moduleImporters[moduleKey]();
  }

  const entry = moduleRegistry.get(moduleKey);
  if (!entry) {
    return;
  }

  const loaded = await loadModuleState(moduleKey);
  if (!loaded) {
    return;
  }

  const slice = (loaded as Record<string, unknown>)[sliceKey];
  if (!slice || typeof slice !== "object" || Array.isArray(slice)) {
    return;
  }

  (entry.state as Record<string, unknown>)[sliceKey] = reviveValue(slice);
  trackValue(moduleKey, entry.state, (entry.state as Record<string, unknown>)[sliceKey], new WeakSet());
}

export async function flushMt5ModulePersistence(moduleKeys?: readonly Mt5ModuleKey[]) {
  if (!shouldUseDatabase()) {
    return;
  }

  for (const timer of persistTimers.values()) {
    clearTimeout(timer);
  }
  persistTimers.clear();

  const keys = moduleKeys ? new Set(moduleKeys) : null;
  await Promise.all(
    [...moduleRegistry.entries()]
      .filter(([moduleKey]) => !keys || keys.has(moduleKey))
      .map(async ([moduleKey, entry]) => {
        await writeModuleState(moduleKey, entry.state);
      })
  );
}

export async function resetMt5ModuleState(moduleKey: Mt5ModuleKey, createSeed: () => object) {
  const entry = moduleRegistry.get(moduleKey);
  if (!entry) {
    return;
  }

  const seeded = createSeed();
  for (const key of Object.keys(entry.state)) {
    delete (entry.state as Record<string, unknown>)[key];
  }
  Object.assign(entry.state, seeded);

  if (shouldUseDatabase()) {
    await writeModuleState(moduleKey, entry.state);
    entry.hydrated = true;
  }
}

export async function purgeMt5ModuleStatesFromDatabase(moduleKeys: readonly Mt5ModuleKey[] = MT5_MODULE_KEYS) {
  if (!shouldUseDatabase()) {
    return { cleared: 0 };
  }
  const uniqueKeys = [...new Set(moduleKeys)];
  if (!uniqueKeys.length) {
    return { cleared: 0 };
  }
  await ensureSchema();
  const result = await runQuery(
    `delete from mt5_module_states where module_key = any($1::text[])`,
    [uniqueKeys]
  );
  return { cleared: result.rowCount ?? 0 };
}
