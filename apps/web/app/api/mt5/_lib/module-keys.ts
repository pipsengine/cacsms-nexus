export const MT5_MODULE_KEYS = [
  "mt5-control-center",
  "account-sync",
  "broker-connections",
  "chart-control",
  "chart-templates",
  "connection-health",
  "ea-bridge",
  "ea-terminal-hub",
  "ea-monitoring",
  "error-logs",
  "execution-logs",
  "execution-queue",
  "latency-monitor",
  "market-watch",
  "order-router",
  "slippage-monitor",
  "spread-monitor",
  "symbol-sync",
  "terminal-status",
  "trade-synchronization"
] as const;

export type Mt5ModuleKey = (typeof MT5_MODULE_KEYS)[number];

const legacyControlCenterSegments = new Set([
  "accounts",
  "audit",
  "brokers",
  "diagnostics",
  "events",
  "execution-quality",
  "latency",
  "market-data-gaps",
  "onboarding",
  "rejections",
  "slippage",
  "symbols",
  "terminals",
  "trading"
]);

const relatedModules: Partial<Record<Mt5ModuleKey, Mt5ModuleKey[]>> = {
  "ea-bridge": ["account-sync", "mt5-control-center", "terminal-status"]
};

export function isMt5ModuleKey(value: string): value is Mt5ModuleKey {
  return (MT5_MODULE_KEYS as readonly string[]).includes(value);
}

export function resolveMt5ModuleKeys(pathname: string): Mt5ModuleKey[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "api" || segments[1] !== "mt5") {
    return [];
  }

  const segment = segments[2];
  if (!segment) {
    return ["mt5-control-center"];
  }

  if (isMt5ModuleKey(segment)) {
    const related = relatedModules[segment] ?? [];
    return [segment, ...related];
  }

  if (legacyControlCenterSegments.has(segment)) {
    return ["mt5-control-center"];
  }

  return [];
}
