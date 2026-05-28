import "server-only";

import { PORTFOLIO_MODULE_KEYS, type PortfolioModuleKey } from "./module-keys";

async function runQuery<T extends import("pg").QueryResultRow>(text: string, values?: unknown[]) {
  const { query } = await import("@/lib/postgres");
  return query<T>(text, values);
}

const moduleImporters: Record<PortfolioModuleKey, () => Promise<unknown>> = {
  "account-center": () => import("../account-center/_lib/store")
};

type ModuleEntry = {
  state: object;
  hydrated: boolean;
};

const moduleRegistry = new Map<PortfolioModuleKey, ModuleEntry>();
const persistTimers = new Map<PortfolioModuleKey, ReturnType<typeof setTimeout>>();
const hydratePromises = new Map<PortfolioModuleKey, Promise<void>>();
let schemaReady: Promise<void> | null = null;

declare global {
  var __cacsmsPortfolioDevStates: Partial<Record<PortfolioModuleKey, object>> | undefined;
}

function resolveModuleSeed<T extends object>(moduleKey: PortfolioModuleKey, createSeed: () => T): T {
  if (shouldUseDatabase() || process.env.NODE_ENV === "production") {
    return createSeed();
  }

  if (!globalThis.__cacsmsPortfolioDevStates) {
    globalThis.__cacsmsPortfolioDevStates = {};
  }

  const cached = globalThis.__cacsmsPortfolioDevStates[moduleKey] as T | undefined;
  if (cached) {
    return cached;
  }

  const seeded = createSeed();
  globalThis.__cacsmsPortfolioDevStates[moduleKey] = seeded;
  return seeded;
}

const MUTATING_ARRAY_METHODS = new Set(["copyWithin", "fill", "pop", "push", "reverse", "shift", "sort", "splice", "unshift"]);

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
  return JSON.stringify(state);
}

function reviveValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => reviveValue(item)) as T;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const [key, nested] of Object.entries(record)) {
      record[key] = reviveValue(nested);
    }
  }

  return value;
}

async function loadModuleState(moduleKey: PortfolioModuleKey) {
  await ensureSchema();
  const result = await runQuery<{ state: object }>("select state from mt5_module_states where module_key = $1", [`portfolio:${moduleKey}`]);
  const row = result.rows[0]?.state;
  return row ? (reviveValue(row) as object) : null;
}

async function writeModuleState(moduleKey: PortfolioModuleKey, state: object) {
  await ensureSchema();
  await runQuery(
    `
      insert into mt5_module_states (module_key, state, updated_at)
      values ($1, $2::jsonb, now())
      on conflict (module_key)
      do update set state = excluded.state, updated_at = now()
    `,
    [`portfolio:${moduleKey}`, serializeState(state)]
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
      targetValue &&
      typeof targetValue === "object" &&
      !Array.isArray(targetValue)
    ) {
      applyHydratedState(targetValue as Record<string, unknown>, sourceValue as Record<string, unknown>);
      continue;
    }

    target[key] = reviveValue(sourceValue);
  }
}

function schedulePersist(moduleKey: PortfolioModuleKey, state: object) {
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
        console.error(`Failed to persist portfolio module state for "${moduleKey}".`, error);
      });
    }, 150)
  );
}

function trackValue(moduleKey: PortfolioModuleKey, rootState: object, value: unknown, seen: WeakSet<object>): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return value;
  }
  seen.add(value);

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

function registerModuleState(moduleKey: PortfolioModuleKey, state: object) {
  if (!shouldUseDatabase()) {
    return state;
  }

  const tracked = trackValue(moduleKey, state, state, new WeakSet()) as object;
  moduleRegistry.set(moduleKey, { state: tracked, hydrated: false });
  return tracked;
}

export function bindPersistedPortfolioState<T extends object>(moduleKey: PortfolioModuleKey, createSeed: () => T): T {
  const state = resolveModuleSeed(moduleKey, createSeed);
  return registerModuleState(moduleKey, state) as T;
}

export async function ensurePortfolioModuleHydrated(moduleKey: PortfolioModuleKey) {
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

export async function ensurePortfolioModulesHydrated(moduleKeys: readonly PortfolioModuleKey[] = PORTFOLIO_MODULE_KEYS) {
  await Promise.all([...new Set(moduleKeys)].map((moduleKey) => ensurePortfolioModuleHydrated(moduleKey)));
}
