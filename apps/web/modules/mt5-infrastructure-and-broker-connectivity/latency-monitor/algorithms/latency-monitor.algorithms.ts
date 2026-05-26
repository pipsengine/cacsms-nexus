import type { ScoreResult } from "../../mt5-control-center/types/mt5-control-center.types";
import type {
  LatencyAlert,
  LatencyBreachStatus,
  LatencyBrokerComparisonRow,
  LatencyMetric,
  LatencyRiskLevel,
  LatencyThreshold,
  LatencyTrendPoint
} from "../types/latency-monitor.types";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function rating(score: number): ScoreResult["rating"] {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Healthy";
  if (score >= 60) return "Degraded";
  if (score >= 40) return "High Risk";
  return "Critical";
}

export function breachStatusFromThreshold(currentMs: number, threshold: LatencyThreshold, newsActive: boolean): LatencyBreachStatus {
  const multiplier = newsActive ? threshold.newsMultiplier : 1;
  const warning = threshold.warningLatencyLimitMs * multiplier;
  const critical = threshold.criticalLatencyLimitMs * multiplier;
  const block = threshold.executionBlockLatencyMs * multiplier;
  if (currentMs >= block) return "Blocked";
  if (currentMs >= critical) return "Critical";
  if (currentMs >= warning) return "Warning";
  return "Normal";
}

export function latencyRiskScore(input: {
  thresholdBreachScore: number;
  p95LatencyScore: number;
  p99LatencyScore: number;
  jitterScore: number;
  timeoutScore: number;
  tradingImpactScore: number;
}) {
  const risk = clamp(
    Math.round(input.thresholdBreachScore + input.p95LatencyScore + input.p99LatencyScore + input.jitterScore + input.timeoutScore + input.tradingImpactScore),
    0,
    100
  );
  const score = clamp(100 - risk, 0, 100);
  return { score, rating: rating(score), factors: { risk } } satisfies ScoreResult;
}

export function riskLevelFromScore(score: number): LatencyRiskLevel {
  if (score < 40) return "Critical";
  if (score < 55) return "High";
  if (score < 70) return "Elevated";
  if (score < 82) return "Moderate";
  return "Low";
}

export function percentile(values: number[], p: 50 | 95 | 99) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[clamp(idx, 0, sorted.length - 1)];
}

export function brokerLatencyRanking(rows: LatencyBrokerComparisonRow[]) {
  const scored = rows.map((r) => {
    const penalty =
      r.averageLatencyMs * 0.25 +
      r.p95LatencyMs * 0.22 +
      r.p99LatencyMs * 0.18 +
      r.packetLossPercent * 2.5 +
      r.executionResponseTimeMs * 0.15 +
      r.marketDataDelayMs * 0.12 +
      (100 - r.stabilityScore) * 0.25;
    const score = clamp(Math.round(100 - penalty), 0, 100);
    return { ...r, stabilityScore: clamp(r.stabilityScore, 0, 100), rankScore: score };
  });
  const sorted = scored.sort((a, b) => b.rankScore - a.rankScore);
  return sorted.map((r, idx) => ({
    ...r,
    rank: idx + 1,
    recommendedUse:
      r.rankScore >= 82 ? "Best for execution" : r.rankScore >= 70 ? "Best for data feed" : r.rankScore >= 58 ? "Watch during news" : r.rankScore >= 45 ? "Avoid for scalping" : "Temporarily unsafe"
  }));
}

export function deriveAlerts(metrics: LatencyMetric[]) {
  const alerts: LatencyAlert[] = [];
  for (const m of metrics) {
    if (m.breachStatus === "Normal" && !m.routeBlocked) continue;
    const severity: LatencyAlert["severity"] = m.routeBlocked || m.breachStatus === "Critical" || m.breachStatus === "Blocked" ? "Critical" : "Warning";
    const alertType: LatencyAlert["alertType"] =
      m.routeBlocked || m.breachStatus === "Blocked"
        ? "Route Blocked"
        : m.latencyType === "Broker Ping"
          ? "Broker Latency"
          : m.latencyType === "EA Bridge Round Trip"
            ? "EA Bridge Delay"
            : m.latencyType === "Terminal Heartbeat"
              ? "Terminal Delay"
              : m.latencyType === "Market Data"
                ? "Market Data Delay"
                : m.latencyType === "Order Routing"
                  ? "Order Router Delay"
                  : m.latencyType === "Execution Queue"
                    ? "Execution Queue Delay"
                    : m.latencyType === "Execution Feedback"
                      ? "Execution Feedback Delay"
                      : "Warning";
    alerts.push({
      id: `lat-alert-${m.metricId}`,
      timestamp: new Date().toISOString(),
      metricId: m.metricId,
      componentType: m.componentType,
      componentName: m.componentName,
      brokerId: m.brokerId,
      broker: m.broker,
      accountId: m.accountId,
      account: m.account,
      latencyType: m.latencyType,
      currentLatencyMs: m.currentLatencyMs,
      thresholdValueMs: m.thresholdValueMs,
      alertType,
      severity,
      routeBlocked: m.routeBlocked,
      rootCause: m.jitterMs > 25 ? "Jitter instability elevated." : m.timeoutCount > 0 ? "Timeout pattern detected." : "Latency breached threshold limits.",
      aiExplanation: m.routeBlocked ? "Route blocked to protect execution timing." : "Latency spike increases execution and market-data timing risk.",
      resolutionStatus: "Unresolved",
      resolvedAt: null
    });
  }
  return alerts.slice(0, 120);
}

export function deriveWorkflow(points: LatencyTrendPoint[], alerts: LatencyAlert[]) {
  const avg = (predicate: (p: LatencyTrendPoint) => boolean) => {
    const sample = points.filter(predicate).slice(0, 60);
    return sample.length ? sample.reduce((s, p) => s + p.currentLatencyMs, 0) / sample.length : 0;
  };
  const latest = alerts[0];
  const latestBreach = latest ? `${latest.alertType} · ${latest.componentName}` : "—";

  const step = (title: string, latency: number, failed: number, bottleneckStage: string, status: "Healthy" | "Watch" | "Degraded" | "Critical", ai: string) => ({
    title,
    status,
    averageLatencyMs: Math.round(latency),
    failedCount: failed,
    bottleneckStage,
    latestBreach,
    aiRecommendation: ai
  });

  const criticalCount = alerts.filter((a) => a.severity === "Critical" && a.resolutionStatus !== "Resolved").length;
  const warningCount = alerts.filter((a) => a.severity === "Warning" && a.resolutionStatus !== "Resolved").length;

  return [
    step("Ping Sent", avg((p) => p.latencyType === "Broker Ping"), warningCount, "Broker Response", criticalCount > 0 ? "Degraded" : warningCount > 0 ? "Watch" : "Healthy", "Run ping tests against highest latency brokers; compare regions."),
    step("Broker Response", avg((p) => p.latencyType === "Broker Ping"), warningCount, "EA Bridge Round Trip", criticalCount > 0 ? "Degraded" : "Healthy", "Route execution to stable brokers; monitor packet loss and jitter."),
    step("EA Bridge Round Trip", avg((p) => p.latencyType === "EA Bridge Round Trip"), warningCount, "Market Tick Received", criticalCount > 0 ? "Degraded" : "Watch", "Run round-trip test; investigate bridge/host saturation."),
    step("Market Tick Received", avg((p) => p.latencyType === "Market Data"), warningCount, "Order Routed", criticalCount > 0 ? "Degraded" : "Watch", "Validate feed freshness; increase sampling during news."),
    step("Order Routed", avg((p) => p.latencyType === "Order Routing"), warningCount, "Queue Processed", criticalCount > 0 ? "Degraded" : "Healthy", "Detect router bottlenecks; shift routes away from congested channels."),
    step("Queue Processed", avg((p) => p.latencyType === "Execution Queue"), warningCount, "MT5 Executed", criticalCount > 0 ? "Degraded" : "Watch", "Throttle or prioritize queue; clear backlog when risk escalates."),
    step("MT5 Executed", avg((p) => p.latencyType === "Execution Feedback"), warningCount, "Feedback Returned", criticalCount > 0 ? "Degraded" : "Watch", "Monitor execution response times and MT5 feedback delays."),
    step("Feedback Returned", avg((p) => p.latencyType === "Execution Feedback"), warningCount, "Latency Scored", criticalCount > 0 ? "Degraded" : "Healthy", "Correlate delays with slippage risk; block unsafe routes."),
    step("Latency Scored", 0, warningCount + criticalCount, "Risk Logged", criticalCount > 0 ? "Degraded" : "Healthy", "Adjust thresholds by strategy sensitivity and session."),
    step("Risk Logged", 0, 0, "—", "Healthy", "Ensure route-block and threshold changes are audit-logged.")
  ];
}

