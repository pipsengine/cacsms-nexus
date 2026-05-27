import { failure, ok } from "../../_lib/http";
import { flushMt5ModulePersistence, purgeMt5ModuleStatesFromDatabase } from "../../_lib/persistence";
import { MT5_MODULE_KEYS, type Mt5ModuleKey } from "../../_lib/module-keys";
import { getRole } from "../../_lib/store";

type PurgeRequest = {
  confirmed?: boolean;
  moduleKeys?: Mt5ModuleKey[];
};

function shouldUseDatabase() {
  if (process.env.MT5_USE_DATABASE === "false") {
    return false;
  }
  if (process.env.NODE_ENV === "test" && process.env.MT5_USE_DATABASE !== "true") {
    return false;
  }
  return Boolean(process.env.DATABASE_URL);
}

async function resetInMemory(moduleKey: Mt5ModuleKey) {
  switch (moduleKey) {
    case "mt5-control-center": {
      const { resetMt5ControlCenterState } = await import("../../_lib/store");
      resetMt5ControlCenterState();
      return;
    }
    case "account-sync": {
      const { resetAccountSyncState } = await import("../../account-sync/_lib/store");
      resetAccountSyncState();
      return;
    }
    case "broker-connections": {
      const { resetBrokerConnectionsState } = await import("../../broker-connections/_lib/store");
      resetBrokerConnectionsState();
      return;
    }
    case "chart-control": {
      const { resetChartControlState } = await import("../../chart-control/_lib/store");
      resetChartControlState();
      return;
    }
    case "chart-templates": {
      const { resetChartTemplatesState } = await import("../../chart-templates/_lib/store");
      resetChartTemplatesState();
      return;
    }
    case "connection-health": {
      const { resetConnectionHealthState } = await import("../../connection-health/_lib/store");
      resetConnectionHealthState();
      return;
    }
    case "ea-bridge": {
      const { resetEaBridgeState } = await import("../../ea-bridge/_lib/store");
      resetEaBridgeState();
      return;
    }
    case "ea-terminal-hub": {
      const { resetEaTerminalHubState } = await import("../../ea-terminal-hub/_lib/store");
      resetEaTerminalHubState();
      return;
    }
    case "ea-monitoring": {
      const { resetEaMonitoringState } = await import("../../ea-monitoring/_lib/store");
      resetEaMonitoringState();
      return;
    }
    case "error-logs": {
      const { resetErrorLogsState } = await import("../../error-logs/_lib/store");
      resetErrorLogsState();
      return;
    }
    case "execution-logs": {
      const { resetExecutionLogsState } = await import("../../execution-logs/_lib/store");
      resetExecutionLogsState();
      return;
    }
    case "execution-queue": {
      const { resetExecutionQueueState } = await import("../../execution-queue/_lib/store");
      resetExecutionQueueState();
      return;
    }
    case "latency-monitor": {
      const { resetLatencyMonitorState } = await import("../../latency-monitor/_lib/store");
      resetLatencyMonitorState();
      return;
    }
    case "market-watch": {
      const { resetMarketWatchState } = await import("../../market-watch/_lib/store");
      resetMarketWatchState();
      return;
    }
    case "order-router": {
      const { resetOrderRouterState } = await import("../../order-router/_lib/store");
      resetOrderRouterState();
      return;
    }
    case "slippage-monitor": {
      const { resetSlippageMonitorState } = await import("../../slippage-monitor/_lib/store");
      resetSlippageMonitorState();
      return;
    }
    case "spread-monitor": {
      const { resetSpreadMonitorState } = await import("../../spread-monitor/_lib/store");
      resetSpreadMonitorState();
      return;
    }
    case "symbol-sync": {
      const { resetSymbolSyncState } = await import("../../symbol-sync/_lib/store");
      resetSymbolSyncState();
      return;
    }
    case "terminal-status": {
      const { resetTerminalStatusState } = await import("../../terminal-status/_lib/store");
      resetTerminalStatusState();
      return;
    }
    case "trade-synchronization": {
      const { resetTradeSyncState } = await import("../../trade-synchronization/store");
      resetTradeSyncState();
      return;
    }
  }
}

export async function GET(request: Request) {
  const dbUsed = shouldUseDatabase();
  if (!dbUsed) {
    return ok({ dbUsed: false, moduleKeys: MT5_MODULE_KEYS, rows: [] as Array<{ module_key: string; updated_at: string }> });
  }
  const { query } = await import("@/lib/postgres");
  await query(`
    create table if not exists mt5_module_states (
      module_key text primary key,
      state jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )
  `);

  const url = new URL(request.url);
  const moduleKey = url.searchParams.get("moduleKey") as Mt5ModuleKey | null;
  if (moduleKey) {
    if (!MT5_MODULE_KEYS.includes(moduleKey)) {
      return ok({ dbUsed: true, moduleKey, found: false });
    }
    const result = await query<{ module_key: string; updated_at: string; state: unknown }>(
      "select module_key, updated_at, state from mt5_module_states where module_key = $1",
      [moduleKey]
    );
    const row = result.rows[0];
    if (!row) {
      return ok({ dbUsed: true, moduleKey, found: false });
    }
    const state = (row.state ?? {}) as Record<string, unknown>;
    const keys = Object.keys(state).sort();
    const counts = Object.fromEntries(
      Object.entries(state).map(([key, value]) => {
        if (Array.isArray(value)) return [key, { kind: "array", count: value.length }] as const;
        if (value && typeof value === "object") {
          const record = value as Record<string, unknown>;
          if (record.__cacsmsSet === true && Array.isArray(record.values)) {
            return [key, { kind: "set", count: record.values.length }] as const;
          }
          return [key, { kind: "object", count: Object.keys(record).length }] as const;
        }
        if (typeof value === "string") return [key, { kind: "string", count: value.length }] as const;
        if (typeof value === "number") return [key, { kind: "number", count: value }] as const;
        if (typeof value === "boolean") return [key, { kind: "boolean", count: value ? 1 : 0 }] as const;
        return [key, { kind: "unknown", count: 0 }] as const;
      })
    );
    return ok({
      dbUsed: true,
      moduleKey,
      found: true,
      updatedAt: row.updated_at,
      summary: {
        keys,
        counts
      }
    });
  }

  const result = await query<{ module_key: string; updated_at: string }>(
    "select module_key, updated_at from mt5_module_states order by updated_at desc limit 200"
  );
  return ok({ dbUsed: true, moduleKeys: MT5_MODULE_KEYS, rows: result.rows });
}

export async function POST(request: Request) {
  try {
    const role = getRole(request);
    if (!["Super Admin", "Infrastructure Admin"].includes(role)) {
      throw new Error(`Role "${role}" is not authorized to purge MT5 persisted state.`);
    }

    const body = (await request.json().catch(() => ({}))) as PurgeRequest;
    if (!body.confirmed) {
      throw new Error("Confirmation is required to purge MT5 persisted state.");
    }

    const requestedKeys = Array.isArray(body.moduleKeys) && body.moduleKeys.length ? body.moduleKeys : MT5_MODULE_KEYS;
    const moduleKeys = [...new Set(requestedKeys)];

    const result = await purgeMt5ModuleStatesFromDatabase(moduleKeys);
    await Promise.all(moduleKeys.map((moduleKey) => resetInMemory(moduleKey)));
    await flushMt5ModulePersistence();

    return ok({
      ok: true,
      dbUsed: shouldUseDatabase(),
      clearedDatabaseRows: result.cleared,
      clearedModuleKeys: moduleKeys
    });
  } catch (error) {
    return failure(error);
  }
}
