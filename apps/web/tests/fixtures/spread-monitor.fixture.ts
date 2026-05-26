import { normalizeSymbol } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/algorithms/mt5-control-center.algorithms";
import type { SpreadAssetClass, SpreadAlert, SpreadLogEntry, SpreadSnapshot, SpreadThreshold, SpreadTrendPoint, SpreadWorkflowNode } from "@/modules/mt5-infrastructure-and-broker-connectivity/spread-monitor/types/spread-monitor.types";
import { calculateSpreadPips } from "@/modules/mt5-infrastructure-and-broker-connectivity/spread-monitor/algorithms/spread-monitor.algorithms";

function isoNow(offsetSeconds = 0) {
  return new Date(Date.now() + offsetSeconds * 1000).toISOString();
}

function id(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

function stable(n: number) {
  const x = Math.sin(n * 999) * 10_000;
  return x - Math.floor(x);
}

export const symbolMeta: Record<string, { digits: number; pipSize: number; pointValue: number; contractSize: number }> = {
  EURUSD: { digits: 5, pipSize: 0.0001, pointValue: 10, contractSize: 100_000 },
  GBPUSD: { digits: 5, pipSize: 0.0001, pointValue: 10, contractSize: 100_000 },
  USDJPY: { digits: 3, pipSize: 0.01, pointValue: 10, contractSize: 100_000 },
  XAUUSD: { digits: 2, pipSize: 0.1, pointValue: 1, contractSize: 100 },
  NAS100: { digits: 1, pipSize: 1, pointValue: 1, contractSize: 1 },
  SPX500: { digits: 1, pipSize: 1, pointValue: 1, contractSize: 1 },
  US30: { digits: 1, pipSize: 1, pointValue: 1, contractSize: 1 }
};

function mapAssetClass(raw: string): SpreadAssetClass {
  if (raw === "Forex") return "Forex";
  if (raw === "Metals") return "Metals";
  if (raw === "Indices") return "Indices";
  if (raw === "Crypto") return "Crypto";
  return "Unknown";
}

export function createMockThresholds(): SpreadThreshold[] {
  const now = Date.now();
  const base: SpreadThreshold[] = [];
  const add = (partial: Omit<SpreadThreshold, "id" | "createdAt" | "updatedAt">, n: number) => {
    base.push({ id: id("thr", n), createdAt: new Date(now - n * 3600_000).toISOString(), updatedAt: isoNow(-(n * 31)), ...partial });
  };

  const symbolDefaults = [
    { normalizedSymbol: "EURUSD", assetClass: "Forex" as const, normal: 0.8, warn: 1.5, crit: 2.6, block: 3.2, scalp: 1.0 },
    { normalizedSymbol: "GBPUSD", assetClass: "Forex" as const, normal: 1.1, warn: 2.0, crit: 3.4, block: 4.1, scalp: 1.4 },
    { normalizedSymbol: "USDJPY", assetClass: "Forex" as const, normal: 0.9, warn: 1.8, crit: 3.0, block: 3.8, scalp: 1.2 },
    { normalizedSymbol: "XAUUSD", assetClass: "Metals" as const, normal: 2.0, warn: 4.5, crit: 7.5, block: 9.5, scalp: 2.8 },
    { normalizedSymbol: "NAS100", assetClass: "Indices" as const, normal: 1.5, warn: 3.0, crit: 6.0, block: 7.5, scalp: 2.0 },
    { normalizedSymbol: "SPX500", assetClass: "Indices" as const, normal: 1.2, warn: 2.7, crit: 5.5, block: 6.8, scalp: 1.8 },
    { normalizedSymbol: "US30", assetClass: "Indices" as const, normal: 2.0, warn: 4.0, crit: 8.0, block: 10.0, scalp: 3.0 }
  ];

  let n = 1;
  for (const s of symbolDefaults) {
    add(
      {
        symbol: null,
        normalizedSymbol: s.normalizedSymbol,
        assetClass: s.assetClass,
        brokerId: null,
        broker: null,
        accountType: "All",
        tradingSession: "All",
        strategyType: "All",
        newsImpactLevel: "High",
        volatilityRegime: "Normal",
        normalLimitPips: s.normal,
        warningLimitPips: s.warn,
        criticalLimitPips: s.crit,
        executionBlockLimitPips: s.block,
        scalpingMaxSpreadPips: s.scalp,
        newsMultiplier: 1.65,
        autoDisableEnabled: true
      },
      n
    );
    n += 1;
  }

  add(
    {
      symbol: null,
      normalizedSymbol: "XAUUSD",
      assetClass: "Metals",
      brokerId: "broker-ftmo",
      broker: "FTMO",
      accountType: "Challenge",
      tradingSession: "NY",
      strategyType: "Scalping",
      newsImpactLevel: "High",
      volatilityRegime: "Volatile",
      normalLimitPips: 2.4,
      warningLimitPips: 5.2,
      criticalLimitPips: 8.8,
      executionBlockLimitPips: 11.2,
      scalpingMaxSpreadPips: 3.2,
      newsMultiplier: 1.85,
      autoDisableEnabled: true
    },
    n
  );

  return base;
}

function pickThreshold(thresholds: SpreadThreshold[], normalizedSymbol: string, brokerId: string) {
  const specific = thresholds.find((t) => t.normalizedSymbol === normalizedSymbol && t.brokerId === brokerId);
  return specific ?? thresholds.find((t) => t.normalizedSymbol === normalizedSymbol && t.brokerId == null) ?? thresholds[0]!;
}

export function createMockSpreads(thresholds: SpreadThreshold[]): SpreadSnapshot[] {
  const brokers = [
    { brokerId: "broker-icm", broker: "IC Markets", accountId: "acct-icm-raw", account: "ICM Live - Raw" },
    { brokerId: "broker-ftmo", broker: "FTMO", accountId: "acct-ftmo-ch", account: "FTMO Challenge - Demo" },
    { brokerId: "broker-pep", broker: "Pepperstone", accountId: "acct-pep-demo", account: "Pepper Demo" }
  ];
  const symbols = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "NAS100", "SPX500", "US30"];

  const rows: SpreadSnapshot[] = [];
  let idx = 1;
  for (const broker of brokers) {
    for (const symbol of symbols) {
      const n = normalizeSymbol(symbol);
      const meta = symbolMeta[n.normalizedSymbol] ?? { digits: 5, pipSize: 0.0001, pointValue: 10, contractSize: 100_000 };
      const baseMid =
        n.normalizedSymbol === "EURUSD"
          ? 1.085
          : n.normalizedSymbol === "GBPUSD"
            ? 1.265
            : n.normalizedSymbol === "USDJPY"
              ? 156.3
              : n.normalizedSymbol === "XAUUSD"
                ? 2345.2
                : n.normalizedSymbol === "NAS100"
                  ? 18650
                  : n.normalizedSymbol === "SPX500"
                    ? 5280
                    : 39250;

      const brokerBias = broker.brokerId === "broker-ftmo" ? 1.22 : broker.brokerId === "broker-pep" ? 1.08 : 1.0;
      const seed = stable(idx + symbol.length);
      const tickNoise = (seed - 0.5) * (n.normalizedSymbol === "USDJPY" ? 0.03 : n.normalizedSymbol === "XAUUSD" ? 0.8 : n.normalizedSymbol.startsWith("US") ? 8 : 0.0012);
      const mid = baseMid + tickNoise;

      const threshold = pickThreshold(thresholds, n.normalizedSymbol, broker.brokerId);
      const normalSpread = threshold.normalLimitPips * brokerBias;
      const spreadPips = Number((normalSpread + (seed > 0.85 ? threshold.criticalLimitPips * 0.85 : seed > 0.7 ? threshold.warningLimitPips * 0.65 : 0)).toFixed(2));

      const ask = Number((mid + (spreadPips * meta.pipSize) / 2).toFixed(meta.digits));
      const bid = Number((mid - (spreadPips * meta.pipSize) / 2).toFixed(meta.digits));

      const average = Number((normalSpread + (seed - 0.5) * 0.3).toFixed(2));
      const min = Number(Math.max(0.05, average * 0.6).toFixed(2));
      const max = Number((average * (1.25 + seed * 0.6)).toFixed(2));
      const deviationPercent = average > 0 ? Number((((spreadPips - average) / average) * 100).toFixed(1)) : 0;

      const current = calculateSpreadPips(bid, ask, meta.pipSize);
      const stability = clamp(100 - Math.abs(deviationPercent) * 0.35 - (broker.brokerId === "broker-ftmo" ? 8 : 0) - (seed > 0.85 ? 12 : 0), 18, 98);
      const spreadStatus = current > threshold.criticalLimitPips ? "Critical" : current > threshold.warningLimitPips ? "Wide" : "Normal";
      const executionAllowed = !(threshold.autoDisableEnabled && (current >= threshold.executionBlockLimitPips || spreadStatus === "Critical"));
      const ratio = threshold.criticalLimitPips > 0 ? current / threshold.criticalLimitPips : 0;
      const riskLevel =
        ratio >= 1.25 ? "Critical" : ratio >= 1.0 ? "High" : ratio >= 0.75 ? "Elevated" : ratio >= 0.55 ? "Moderate" : "Low";

      rows.push({
        id: `spr-${idx}`,
        symbol,
        normalizedSymbol: n.normalizedSymbol,
        broker: broker.broker,
        brokerId: broker.brokerId,
        account: broker.account,
        accountId: broker.accountId,
        assetClass: mapAssetClass(n.assetClass),
        bid,
        ask,
        digits: meta.digits,
        pointValue: meta.pointValue,
        contractSize: meta.contractSize,
        currentSpreadPips: current,
        averageSpreadPips: average,
        minimumSpreadPips: min,
        maximumSpreadPips: max,
        spreadDeviationPercent: deviationPercent,
        spreadStabilityScore: Number(stability.toFixed(1)),
        thresholdId: threshold.id,
        threshold,
        spreadStatus,
        executionAllowed,
        lastTickTime: isoNow(-(5 + Math.round(seed * 14))),
        riskLevel
      });
      idx += 1;
    }
  }
  return rows;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function createMockTrends(spreads: SpreadSnapshot[]): SpreadTrendPoint[] {
  const points: SpreadTrendPoint[] = [];
  const symbolKeys = [...new Set(spreads.map((s) => `${s.normalizedSymbol}::${s.brokerId}`))];
  for (const key of symbolKeys) {
    const [normalizedSymbol, brokerId] = key.split("::");
    const row = spreads.find((s) => s.normalizedSymbol === normalizedSymbol && s.brokerId === brokerId)!;
    for (let t = 0; t < 30; t += 1) {
      const seed = stable(t + row.id.length + normalizedSymbol.length);
      const spread = Math.max(0.05, row.averageSpreadPips + (seed - 0.5) * (row.assetClass === "Forex" ? 0.8 : row.assetClass === "Metals" ? 2.8 : 3.5) + (t > 24 && seed > 0.8 ? 2.5 : 0));
      const rolling = Math.max(0.05, row.averageSpreadPips + (seed - 0.5) * 0.35);
      points.push({
        measuredAt: isoNow(-(t * 20)),
        normalizedSymbol,
        brokerId,
        broker: row.broker,
        spreadPips: Number(spread.toFixed(2)),
        rollingAveragePips: Number(rolling.toFixed(2))
      });
    }
  }
  return points;
}

export function createMockAlerts(spreads: SpreadSnapshot[]): SpreadAlert[] {
  const base: SpreadAlert[] = [];
  const rows = spreads.filter((s) => s.brokerId === "broker-ftmo" || s.normalizedSymbol === "XAUUSD").slice(0, 8);
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    base.push({
      id: `alert-${i + 1}`,
      timestamp: isoNow(-(420 + i * 38)),
      symbol: row.symbol,
      normalizedSymbol: row.normalizedSymbol,
      brokerId: row.brokerId,
      broker: row.broker,
      accountId: row.accountId,
      account: row.account,
      currentSpreadPips: Number((row.currentSpreadPips + i * 0.2).toFixed(2)),
      thresholdValuePips: row.threshold.warningLimitPips,
      alertType: i % 3 === 0 ? "Broker Spike" : i % 2 === 0 ? "News Spike" : "Warning",
      severity: i % 4 === 0 ? "Critical" : "Warning",
      executionBlocked: i % 4 === 0,
      rootCause: i % 3 === 0 ? "Broker-specific widening relative to peers." : "News window liquidity expansion.",
      aiExplanation: "Widening spread increases execution cost and can invalidate strategy assumptions.",
      resolutionStatus: i % 5 === 0 ? "Resolved" : "Unresolved",
      resolvedAt: i % 5 === 0 ? isoNow(-(120 + i * 7)) : null
    });
  }
  return base;
}

export function createMockLogs(spreads: SpreadSnapshot[]): SpreadLogEntry[] {
  const logs: SpreadLogEntry[] = [];
  for (let i = 0; i < 24; i += 1) {
    const row = spreads[i % spreads.length]!;
    logs.push({
      id: `log-${i + 1}`,
      timestamp: isoNow(-(200 + i * 18)),
      eventType: i % 6 === 0 ? "Execution Block" : i % 3 === 0 ? "Threshold Check" : "Tick Update",
      severity: i % 6 === 0 ? "Critical" : i % 4 === 0 ? "Warning" : "Info",
      symbol: row.symbol,
      normalizedSymbol: row.normalizedSymbol,
      brokerId: row.brokerId,
      accountId: row.accountId,
      message: i % 6 === 0 ? "Execution blocked due to spread limits." : "Spread computed and evaluated.",
      statusBefore: i % 6 === 0 ? "Allowed" : "Normal",
      statusAfter: i % 6 === 0 ? "Blocked" : "Normal",
      currentSpreadPips: row.currentSpreadPips,
      executionAllowed: i % 6 !== 0,
      actionTaken: i % 6 === 0 ? "Block" : "Monitor"
    });
  }
  return logs;
}

export function createMockWorkflow(spreads: SpreadSnapshot[], alerts: SpreadAlert[]): SpreadWorkflowNode[] {
  const totalSymbols = new Set(spreads.map((s) => s.normalizedSymbol)).size;
  const critical = alerts.filter((a) => a.severity === "Critical" && a.resolutionStatus !== "Resolved").length;
  const nodes: SpreadWorkflowNode[] = [
    { title: "Tick Received", status: "Healthy", symbolCount: totalSymbols, failedCount: 0, averageDelayMs: 32, latestAlert: "ΓÇö", aiRecommendation: "Continue monitoring tick freshness." },
    { title: "Spread Calculated", status: "Healthy", symbolCount: totalSymbols, failedCount: 0, averageDelayMs: 18, latestAlert: "ΓÇö", aiRecommendation: "Track outliers by asset class." },
    { title: "Rolling Average Compared", status: "Watch", symbolCount: totalSymbols, failedCount: 2, averageDelayMs: 44, latestAlert: "Deviation on XAUUSD", aiRecommendation: "Increase sensitivity during volatile regimes." },
    { title: "Threshold Checked", status: critical > 0 ? "Degraded" : "Watch", symbolCount: totalSymbols, failedCount: Math.min(6, critical + 2), averageDelayMs: 61, latestAlert: "Warning thresholds exceeded", aiRecommendation: "Auto-block when execution cost deteriorates." },
    { title: "News Window Checked", status: "Watch", symbolCount: totalSymbols, failedCount: 1, averageDelayMs: 39, latestAlert: "High-impact news window", aiRecommendation: "Apply news multiplier and tighten scalping controls." },
    { title: "Peer Broker Compared", status: "Healthy", symbolCount: totalSymbols, failedCount: 0, averageDelayMs: 72, latestAlert: "ΓÇö", aiRecommendation: "Route to lowest-spread broker when divergence is material." },
    { title: "Execution Risk Scored", status: critical > 0 ? "Degraded" : "Watch", symbolCount: totalSymbols, failedCount: critical, averageDelayMs: 55, latestAlert: "Critical risk score present", aiRecommendation: "Escalate to risk manager when blocks persist." },
    { title: "Unsafe Trades Blocked", status: critical > 0 ? "Critical" : "Healthy", symbolCount: totalSymbols, failedCount: critical, averageDelayMs: 26, latestAlert: critical ? "Execution blocked on 1+ symbols" : "ΓÇö", aiRecommendation: "Keep blocked until spreads normalize below warning." },
    { title: "Alert Logged", status: "Healthy", symbolCount: totalSymbols, failedCount: 0, averageDelayMs: 12, latestAlert: alerts[0]?.alertType ?? "ΓÇö", aiRecommendation: "Ensure audit trail covers threshold + block actions." }
  ];
  return nodes;
}

export function createSpreadMonitorSeed() {
  const thresholds = createMockThresholds();
  const spreads = createMockSpreads(thresholds);
  const trends = createMockTrends(spreads);
  const alerts = createMockAlerts(spreads);
  const logs = createMockLogs(spreads);
  const workflow = createMockWorkflow(spreads, alerts);
  return { thresholds, spreads, trends, alerts, logs, workflow };
}
