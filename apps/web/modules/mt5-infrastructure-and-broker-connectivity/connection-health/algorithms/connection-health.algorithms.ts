import type { ScoreResult } from "../../mt5-control-center/types/mt5-control-center.types";
import type {
  ComponentType,
  ConnectionComponent,
  ConnectionIncident,
  ConnectionStatus,
  DependencyEdge,
  DependencyMapResponse,
  HeartbeatMonitorRow,
  HeartbeatStatus,
  RiskLevel
} from "../types/connection-health.types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rating(score: number): ScoreResult["rating"] {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Healthy";
  if (score >= 60) return "Degraded";
  if (score >= 40) return "High Risk";
  return "Critical";
}

export function heartbeatClassification(delaySeconds: number): HeartbeatStatus {
  if (delaySeconds <= 30) return "Healthy";
  if (delaySeconds <= 60) return "Watch";
  if (delaySeconds <= 120) return "Degraded";
  if (delaySeconds <= 300) return "Critical";
  return "Offline";
}

export function latencyAnomalyClass(latencyMs: number, rollingAverageMs: number) {
  const ratio = rollingAverageMs > 0 ? latencyMs / rollingAverageMs : 1;
  if (ratio <= 1.25) return "Normal";
  if (ratio <= 1.6) return "Watch";
  if (ratio <= 2.2) return "Degraded";
  return "Critical";
}

export function packetLossClass(packetLossPercent: number) {
  if (packetLossPercent <= 0.5) return "Normal";
  if (packetLossPercent <= 1.5) return "Watch";
  if (packetLossPercent <= 3) return "Degraded";
  return "Critical";
}

export function tradingPathSafety(componentByType: Partial<Record<ComponentType, ConnectionComponent>>, emergencyStopInactive: boolean) {
  const required: Array<{ type: ComponentType; check: (c: ConnectionComponent | undefined) => boolean; message: string }> = [
    { type: "MT5 Terminal", check: (c) => Boolean(c && c.connectionStatus !== "Offline"), message: "Terminal is offline" },
    { type: "EA Bridge", check: (c) => Boolean(c && c.connectionStatus === "Healthy"), message: "EA bridge not connected" },
    { type: "Broker Server", check: (c) => Boolean(c && c.connectionStatus !== "Offline"), message: "Broker server unreachable" },
    { type: "Trading Account", check: (c) => Boolean(c && c.connectionStatus !== "Offline"), message: "Account not authenticated" },
    { type: "Market Data Feed", check: (c) => Boolean(c && c.connectionStatus === "Healthy"), message: "Market data feed inactive" },
    { type: "Order Router", check: (c) => Boolean(c && c.connectionStatus !== "Offline"), message: "Order router inactive" },
    { type: "Execution Queue", check: (c) => Boolean(c && c.connectionStatus !== "Offline"), message: "Execution queue not processing" },
    { type: "MT5 Feedback", check: (c) => Boolean(c && c.connectionStatus === "Healthy"), message: "Feedback channel inactive" },
    { type: "Audit Service", check: (c) => Boolean(c && c.connectionStatus === "Healthy"), message: "Audit service unavailable" }
  ];

  const failures: string[] = [];
  for (const r of required) {
    if (!r.check(componentByType[r.type])) failures.push(r.message);
  }
  if (!emergencyStopInactive) failures.push("Emergency stop active");
  return { safe: failures.length === 0, failures };
}

export function overallConnectionHealthScore(components: ConnectionComponent[], dependencyFailurePenalty: number) {
  const byType = (type: ComponentType) => components.filter((c) => c.componentType === type);
  const avgScore = (type: ComponentType) => {
    const set = byType(type);
    return set.length ? Math.round(set.reduce((sum, c) => sum + c.healthScore, 0) / set.length) : 70;
  };
  const avgLatency = Math.round(components.reduce((sum, c) => sum + c.latencyMs, 0) / Math.max(1, components.length));
  const avgPacketLoss = components.reduce((sum, c) => sum + c.packetLossPercent, 0) / Math.max(1, components.length);

  const terminalHealthScore = avgScore("MT5 Terminal") * 0.14;
  const eaBridgeHealthScore = avgScore("EA Bridge") * 0.12;
  const brokerHealthScore = avgScore("Broker Server") * 0.12;
  const accountSessionScore = avgScore("Trading Account") * 0.1;
  const marketDataScore = avgScore("Market Data Feed") * 0.13;
  const routerChannelScore = avgScore("Order Router") * 0.11;
  const executionQueueScore = avgScore("Execution Queue") * 0.1;
  const auditFeedbackScore = Math.round((avgScore("MT5 Feedback") * 0.1 + avgScore("Audit Service") * 0.08) * 1);

  const latencyPenalty = clamp((avgLatency - 80) / 8, 0, 18);
  const packetLossPenalty = clamp(avgPacketLoss * 6, 0, 18);

  const score = clamp(
    Math.round(
      terminalHealthScore +
        eaBridgeHealthScore +
        brokerHealthScore +
        accountSessionScore +
        marketDataScore +
        routerChannelScore +
        executionQueueScore +
        auditFeedbackScore -
        dependencyFailurePenalty -
        latencyPenalty -
        packetLossPenalty
    ),
    0,
    100
  );

  const factors = {
    terminalHealthScore: Math.round(terminalHealthScore),
    eaBridgeHealthScore: Math.round(eaBridgeHealthScore),
    brokerHealthScore: Math.round(brokerHealthScore),
    accountSessionScore: Math.round(accountSessionScore),
    marketDataScore: Math.round(marketDataScore),
    routerChannelScore: Math.round(routerChannelScore),
    executionQueueScore: Math.round(executionQueueScore),
    auditFeedbackScore: Math.round(auditFeedbackScore),
    dependencyFailurePenalty,
    latencyPenalty: Math.round(latencyPenalty),
    packetLossPenalty: Math.round(packetLossPenalty)
  };

  return { score, rating: rating(score), factors } satisfies ScoreResult;
}

export function dependencyChainFailureDetection(nodes: Array<{ id: string; componentType: ComponentType; status: ConnectionStatus }>, edges: DependencyEdge[]) {
  const firstBrokenEdge = edges.find((e) => e.status !== "Healthy") ?? null;
  if (!firstBrokenEdge) {
    return {
      firstFailedComponentId: null,
      downstreamImpactedComponentIds: [],
      tradingImpact: "Dependency chain intact.",
      recommendedRecoverySequence: ["Monitor heartbeats", "Track latency anomalies", "Keep audits enabled"]
    };
  }
  const firstFailedComponentId = firstBrokenEdge.to;
  const startIndex = nodes.findIndex((n) => n.id === firstFailedComponentId);
  const downstream = startIndex >= 0 ? nodes.slice(startIndex + 1).map((n) => n.id) : [];
  return {
    firstFailedComponentId,
    downstreamImpactedComponentIds: downstream,
    tradingImpact: "Dependency failure increases execution risk and can cause delayed feedback/audit drift.",
    recommendedRecoverySequence: ["Reconnect failed service", "Restart unhealthy channel if safe", "Re-check dependency chain", "Disable unsafe trading until stable", "Audit recovery"]
  };
}

export function infraRiskLevel(components: ConnectionComponent[], overallScore: number): RiskLevel {
  const offline = components.filter((c) => c.connectionStatus === "Offline").length;
  const critical = components.filter((c) => c.connectionStatus === "Critical").length;
  const degraded = components.filter((c) => c.connectionStatus === "Degraded").length;
  if (offline > 0 || critical > 0 || overallScore < 45) return "Critical";
  if (degraded > 2 || overallScore < 60) return "High";
  if (degraded > 0 || overallScore < 75) return "Moderate";
  return "Low";
}

export function deriveHeartbeatRows(components: ConnectionComponent[]): HeartbeatMonitorRow[] {
  return components.map((c) => {
    const last = c.lastHeartbeat ? new Date(c.lastHeartbeat).getTime() : 0;
    const delaySeconds = last ? Math.max(0, Math.round((Date.now() - last) / 1000)) : 999;
    const status = heartbeatClassification(delaySeconds);
    const missed = status === "Healthy" ? 0 : status === "Watch" ? 1 : status === "Degraded" ? 2 : status === "Critical" ? 4 : 12;
    const availability = Math.max(0, Math.min(100, 100 - missed * 2 - c.packetLossPercent * 3));
    return {
      componentId: c.componentId,
      componentType: c.componentType,
      expectedHeartbeatIntervalSeconds: c.expectedHeartbeatIntervalSeconds,
      lastHeartbeat: c.lastHeartbeat,
      heartbeatDelaySeconds: delaySeconds,
      missedHeartbeatCount: missed + (c.retryCount > 0 ? 1 : 0),
      availabilityPercent: Number(availability.toFixed(2)),
      status,
      recoveryAction: status === "Offline" ? "Reconnect and restart dependency chain" : status === "Critical" ? "Restart channel if safe" : status === "Degraded" ? "Run diagnostics" : "Monitor",
      nextCheckTime: new Date(Date.now() + 30_000).toISOString()
    } satisfies HeartbeatMonitorRow;
  });
}

export function createPacketLossIncident(component: ConnectionComponent, packetLossPercent: number): ConnectionIncident {
  return {
    id: `inc-pl-${Date.now()}`,
    timestamp: new Date().toISOString(),
    componentId: component.componentId,
    componentType: component.componentType,
    broker: component.broker,
    account: component.account,
    incidentType: "Packet Loss",
    severity: packetLossPercent >= 3 ? "Critical" : "Warning",
    errorCode: "PKTLOSS",
    errorMessage: `Packet loss ${packetLossPercent.toFixed(2)}% exceeds threshold.`,
    rootCause: "Network instability or message drops.",
    actionTaken: "Reconnect component and validate dependency chain.",
    resolutionStatus: "Unresolved",
    aiExplanation: "Packet loss can drop heartbeats and MT5 feedback, causing unsafe trading path drift."
  };
}

