import type {
  AiLatencyDiagnostic,
  LatencyBrokerComparisonRow,
  LatencyComponentType,
  LatencyLogEntry,
  LatencyMetric,
  LatencyThreshold,
  LatencyTrendPoint
} from "../types/latency-monitor.types";
import { breachStatusFromThreshold, brokerLatencyRanking, deriveAlerts, deriveWorkflow, latencyRiskScore, percentile, riskLevelFromScore } from "../algorithms/latency-monitor.algorithms";

function isoNow(offsetSeconds = 0) {
  return new Date(Date.now() + offsetSeconds * 1000).toISOString();
}

function id(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

function stable(n: number) {
  const x = Math.sin(n * 991) * 10_000;
  return x - Math.floor(x);
}

export function createMockThresholds(): LatencyThreshold[] {
  const now = Date.now();
  const rows: LatencyThreshold[] = [];
  const add = (partial: Omit<LatencyThreshold, "id" | "createdAt" | "updatedAt">, n: number) => {
    rows.push({ id: id("thr", n), createdAt: new Date(now - n * 3600_000).toISOString(), updatedAt: isoNow(-(n * 19)), ...partial });
  };

  const base: Array<{ componentType: LatencyComponentType; normal: number; warn: number; crit: number; block: number; scalp: number }> = [
    { componentType: "Broker Server", normal: 55, warn: 120, crit: 240, block: 320, scalp: 140 },
    { componentType: "EA Bridge", normal: 35, warn: 85, crit: 180, block: 250, scalp: 110 },
    { componentType: "MT5 Terminal", normal: 45, warn: 100, crit: 210, block: 300, scalp: 130 },
    { componentType: "Market Data Feed", normal: 50, warn: 120, crit: 260, block: 340, scalp: 150 },
    { componentType: "Order Router", normal: 40, warn: 95, crit: 200, block: 280, scalp: 125 },
    { componentType: "Execution Queue", normal: 60, warn: 140, crit: 280, block: 360, scalp: 165 },
    { componentType: "MT5 Feedback", normal: 55, warn: 130, crit: 270, block: 350, scalp: 160 }
  ];

  let n = 1;
  for (const b of base) {
    add(
      {
        componentType: b.componentType,
        brokerId: null,
        accountType: "All",
        symbol: null,
        assetClass: "All",
        strategyType: "All",
        tradingSession: "All",
        volatilityRegime: "Normal",
        newsImpactLevel: "High",
        normalLatencyLimitMs: b.normal,
        warningLatencyLimitMs: b.warn,
        criticalLatencyLimitMs: b.crit,
        executionBlockLatencyMs: b.block,
        scalpingMaxLatencyMs: b.scalp,
        newsMultiplier: 1.5,
        autoDisableEnabled: true
      },
      n
    );
    n += 1;
  }

  add(
    {
      componentType: "Broker Server",
      brokerId: "broker-ftmo",
      accountType: "Challenge",
      symbol: null,
      assetClass: "All",
      strategyType: "Scalping",
      tradingSession: "NY",
      volatilityRegime: "Volatile",
      newsImpactLevel: "High",
      normalLatencyLimitMs: 60,
      warningLatencyLimitMs: 150,
      criticalLatencyLimitMs: 300,
      executionBlockLatencyMs: 380,
      scalpingMaxLatencyMs: 170,
      newsMultiplier: 1.8,
      autoDisableEnabled: true
    },
    n
  );

  return rows;
}

function pickThreshold(thresholds: LatencyThreshold[], componentType: LatencyComponentType, brokerId: string | null) {
  const scoped = thresholds.find((t) => t.componentType === componentType && t.brokerId === brokerId);
  return scoped ?? thresholds.find((t) => t.componentType === componentType && t.brokerId == null) ?? thresholds[0]!;
}

export function createMockMetrics(thresholds: LatencyThreshold[]): LatencyMetric[] {
  const brokers = [
    { brokerId: "broker-icm", broker: "IC Markets", region: "LD4" },
    { brokerId: "broker-ftmo", broker: "FTMO", region: "NY4" },
    { brokerId: "broker-pep", broker: "Pepperstone", region: "LD5" }
  ];
  const latencyTypes: Array<{ componentType: LatencyComponentType; latencyType: any; componentName: string }> = [
    { componentType: "Broker Server", latencyType: "Broker Ping", componentName: "Broker Ping Gateway" },
    { componentType: "EA Bridge", latencyType: "EA Bridge Round Trip", componentName: "EA Bridge Session" },
    { componentType: "MT5 Terminal", latencyType: "Terminal Heartbeat", componentName: "MT5 Terminal Heartbeat" },
    { componentType: "Market Data Feed", latencyType: "Market Data", componentName: "Market Data Feed" },
    { componentType: "Order Router", latencyType: "Order Routing", componentName: "Order Router Channel" },
    { componentType: "Execution Queue", latencyType: "Execution Queue", componentName: "Execution Queue" },
    { componentType: "MT5 Feedback", latencyType: "Execution Feedback", componentName: "MT5 Execution Feedback" }
  ];

  const rows: LatencyMetric[] = [];
  let n = 1;
  for (const broker of brokers) {
    for (const lt of latencyTypes) {
      const s = stable(n + lt.componentName.length);
      const threshold = pickThreshold(thresholds, lt.componentType, broker.brokerId);
      const news = s > 0.93;
      const baseline = threshold.normalLatencyLimitMs * (broker.brokerId === "broker-ftmo" ? 1.35 : broker.brokerId === "broker-pep" ? 1.12 : 1);
      const current = Math.round(baseline + (s - 0.5) * threshold.warningLatencyLimitMs * 0.9 + (s > 0.88 ? threshold.criticalLatencyLimitMs * 0.55 : 0));
      const history = Array.from({ length: 25 }, (_, i) => Math.max(1, Math.round(baseline + (stable(i + n) - 0.5) * threshold.warningLatencyLimitMs * 0.6)));
      const avg = Math.round(history.reduce((sum, v) => sum + v, 0) / history.length);
      const p50 = Math.round(percentile(history, 50));
      const p95 = Math.round(percentile(history, 95));
      const p99 = Math.round(percentile(history, 99));
      const jitter = Math.round(Math.abs((stable(n * 9) - 0.5) * 45));
      const timeouts = s > 0.9 ? Math.round(s * 3) : 0;
      const breach = breachStatusFromThreshold(current, threshold, news);
      const routeBlocked = threshold.autoDisableEnabled && (breach === "Blocked" || (breach === "Critical" && timeouts > 0));
      const riskScore = latencyRiskScore({
        thresholdBreachScore: breach === "Blocked" ? 30 : breach === "Critical" ? 22 : breach === "Warning" ? 10 : 0,
        p95LatencyScore: Math.min(18, p95 / 20),
        p99LatencyScore: Math.min(18, p99 / 22),
        jitterScore: Math.min(14, jitter / 3),
        timeoutScore: Math.min(12, timeouts * 6),
        tradingImpactScore: Math.min(8, routeBlocked ? 8 : breach !== "Normal" ? 4 : 0)
      });
      const riskLevel = riskLevelFromScore(riskScore.score);

      rows.push({
        id: `metric-${n}`,
        metricId: id("metric", n),
        componentType: lt.componentType,
        componentName: `${lt.componentName} · ${broker.region}`,
        brokerId: broker.brokerId,
        broker: broker.broker,
        accountId: broker.brokerId === "broker-ftmo" ? "acct-ftmo-ch" : "acct-live",
        account: broker.brokerId === "broker-ftmo" ? "FTMO Challenge" : "Live RAW",
        terminalId: "term-01",
        terminal: "MT5-Terminal-1",
        eaInstanceId: "ea-01",
        eaInstance: "EA-Instance-A",
        symbol: lt.componentType === "Market Data Feed" ? "XAUUSD" : null,
        latencyType: lt.latencyType,
        currentLatencyMs: current,
        averageLatencyMs: avg,
        minimumLatencyMs: Math.min(...history),
        maximumLatencyMs: Math.max(...history),
        p50LatencyMs: p50,
        p95LatencyMs: p95,
        p99LatencyMs: p99,
        jitterMs: jitter,
        timeoutCount: timeouts,
        thresholdId: threshold.id,
        thresholdValueMs: threshold.warningLatencyLimitMs,
        breachStatus: breach,
        trendDirection: current > avg ? "Up" : current < avg ? "Down" : "Flat",
        lastMeasuredAt: isoNow(-(6 + Math.round(s * 18))),
        riskLevel,
        routeBlocked
      });
      n += 1;
    }
  }
  return rows;
}

export function createMockTrends(metrics: LatencyMetric[]): LatencyTrendPoint[] {
  const points: LatencyTrendPoint[] = [];
  for (let i = 0; i < Math.min(240, metrics.length * 8); i += 1) {
    const m = metrics[i % metrics.length]!;
    const s = stable(i + m.metricId.length);
    const value = Math.max(1, Math.round(m.averageLatencyMs + (s - 0.5) * (m.p95LatencyMs * 0.8) + (i % 27 === 0 ? m.p99LatencyMs * 0.55 : 0)));
    points.push({
      measuredAt: isoNow(-(i * 25)),
      brokerId: m.brokerId,
      broker: m.broker,
      terminalId: m.terminalId,
      terminal: m.terminal,
      componentType: m.componentType,
      latencyType: m.latencyType,
      currentLatencyMs: value,
      p95LatencyMs: Math.max(value, m.p95LatencyMs),
      p99LatencyMs: Math.max(value, m.p99LatencyMs),
      jitterMs: Math.round(Math.abs((s - 0.5) * 40))
    });
  }
  return points;
}

export function createMockBrokerComparison(metrics: LatencyMetric[]) {
  const byBroker = new Map<string, LatencyMetric[]>();
  for (const m of metrics) {
    if (!m.brokerId) continue;
    byBroker.set(m.brokerId, [...(byBroker.get(m.brokerId) ?? []), m]);
  }
  const rows: LatencyBrokerComparisonRow[] = [];
  for (const [brokerId, list] of byBroker.entries()) {
    const broker = list[0]?.broker ?? "Unknown";
    const region = brokerId === "broker-ftmo" ? "NY4" : brokerId === "broker-pep" ? "LD5" : "LD4";
    const avg = list.reduce((s, m) => s + m.currentLatencyMs, 0) / Math.max(1, list.length);
    const p95 = list.reduce((s, m) => s + m.p95LatencyMs, 0) / Math.max(1, list.length);
    const p99 = list.reduce((s, m) => s + m.p99LatencyMs, 0) / Math.max(1, list.length);
    const jitter = list.reduce((s, m) => s + m.jitterMs, 0) / Math.max(1, list.length);
    const timeouts = list.reduce((s, m) => s + m.timeoutCount, 0);
    const packetLoss = Math.min(5, (brokerId === "broker-ftmo" ? 0.8 : brokerId === "broker-pep" ? 0.45 : 0.25) + (timeouts > 0 ? 0.9 : 0));
    const execResp = list.filter((m) => m.latencyType === "Execution Feedback").reduce((s, m) => s + m.currentLatencyMs, 0) / Math.max(1, list.filter((m) => m.latencyType === "Execution Feedback").length);
    const dataDelay = list.filter((m) => m.latencyType === "Market Data").reduce((s, m) => s + m.currentLatencyMs, 0) / Math.max(1, list.filter((m) => m.latencyType === "Market Data").length);
    const stability = Math.max(0, Math.min(100, 100 - jitter * 1.4 - packetLoss * 10 - timeouts * 8));
    rows.push({
      brokerId,
      broker,
      serverRegion: region,
      averageLatencyMs: Math.round(avg),
      p95LatencyMs: Math.round(p95),
      p99LatencyMs: Math.round(p99),
      packetLossPercent: Number(packetLoss.toFixed(2)),
      executionResponseTimeMs: Math.round(execResp || avg),
      marketDataDelayMs: Math.round(dataDelay || avg),
      stabilityScore: Math.round(stability),
      rank: 0,
      recommendedUse: "—"
    });
  }
  return brokerLatencyRanking(rows).map((r) => ({
    brokerId: r.brokerId,
    broker: r.broker,
    serverRegion: r.serverRegion,
    averageLatencyMs: r.averageLatencyMs,
    p95LatencyMs: r.p95LatencyMs,
    p99LatencyMs: r.p99LatencyMs,
    packetLossPercent: r.packetLossPercent,
    executionResponseTimeMs: r.executionResponseTimeMs,
    marketDataDelayMs: r.marketDataDelayMs,
    stabilityScore: r.stabilityScore,
    rank: r.rank,
    recommendedUse: r.recommendedUse
  }));
}

export function createMockLogs(metrics: LatencyMetric[]): LatencyLogEntry[] {
  const logs: LatencyLogEntry[] = [];
  const flagged = metrics.filter((m) => m.breachStatus !== "Normal" || m.routeBlocked).slice(0, 10);
  for (let i = 0; i < 22; i += 1) {
    const m = flagged[i % flagged.length] ?? metrics[i % metrics.length]!;
    logs.push({
      id: `log-${i + 1}`,
      timestamp: isoNow(-(240 + i * 17)),
      eventType: i % 7 === 0 ? "Route Block" : i % 3 === 0 ? "Threshold Check" : "Latency Sample",
      severity: i % 7 === 0 ? "Critical" : i % 4 === 0 ? "Warning" : "Info",
      metricId: m.metricId,
      message: i % 7 === 0 ? "Route blocked due to high latency." : "Latency measured and evaluated.",
      statusBefore: "—",
      statusAfter: m.routeBlocked ? "Blocked" : "Active",
      currentLatencyMs: m.currentLatencyMs,
      routeBlocked: m.routeBlocked,
      actionTaken: i % 7 === 0 ? "Block" : "Monitor"
    });
  }
  return logs;
}

export function createMockAiDiagnostics(metrics: LatencyMetric[]): AiLatencyDiagnostic[] {
  const top = metrics
    .filter((m) => m.breachStatus !== "Normal" || m.routeBlocked || m.jitterMs > 28 || m.timeoutCount > 0)
    .slice(0, 20);
  return top.map((m, idx) => ({
    id: `ai-${idx + 1}-${m.metricId}`,
    issue: m.routeBlocked ? "Unsafe execution route" : m.timeoutCount > 0 ? "Repeated timeout pattern" : m.jitterMs > 28 ? "Jitter instability" : "Latency spike detected",
    affectedComponent: `${m.componentType} · ${m.componentName}`,
    affectedContext: `${m.broker ?? "No broker"} · ${m.terminal ?? "No terminal"} · ${m.latencyType}`,
    severity: m.routeBlocked || m.breachStatus === "Critical" || m.breachStatus === "Blocked" ? "Critical" : "Warning",
    rootCause: m.timeoutCount > 0 ? "Timeout count increased within short window." : m.jitterMs > 28 ? "Jitter increased above acceptable range." : "Current latency exceeds threshold or rolling average.",
    tradingImpact: m.latencyType === "Market Data" ? "Market data freshness risk increases slippage risk." : "Execution timing degradation increases rejection and slippage.",
    recommendedAction: m.routeBlocked ? "Keep route disabled; test alternate broker/route and restore only after stabilizing." : "Run diagnostics and ping/round-trip tests; monitor p95/p99.",
    autoBlockRecommendation: m.breachStatus === "Blocked" || m.p99LatencyMs > m.thresholdValueMs * 2 || m.timeoutCount > 0,
    confidenceScore: Math.min(96, Math.max(55, Math.round(100 - m.riskLevel.length * 8 - m.jitterMs)))
  }));
}

export function createLatencyMonitorSeed() {
  const thresholds = createMockThresholds();
  const metrics = createMockMetrics(thresholds);
  const alerts = deriveAlerts(metrics);
  const trends = createMockTrends(metrics);
  const brokerComparison = createMockBrokerComparison(metrics);
  const workflow = deriveWorkflow(trends, alerts);
  const logs = createMockLogs(metrics);
  const aiDiagnostics = createMockAiDiagnostics(metrics);
  return { thresholds, metrics, alerts, trends, brokerComparison, workflow, logs, aiDiagnostics };
}

