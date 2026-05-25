import type {
  AiConnectionDiagnostic,
  AiDiagnosticsResponse,
  ComponentType,
  ConnectionComponent,
  ConnectionIncident,
  ConnectionLogEntry,
  ConnectionStatus,
  DependencyEdge,
  DependencyMapResponse,
  DependencyNode,
  DependencyNodeTone,
  HeartbeatMonitorRow,
  LatencyPoint,
  PacketLossPoint,
  RiskLevel
} from "../types/connection-health.types";

function isoNow(offsetSeconds = 0) {
  return new Date(Date.now() + offsetSeconds * 1000).toISOString();
}

function id(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

function toneFromStatus(status: ConnectionStatus): DependencyNodeTone {
  if (status === "Healthy") return "Healthy";
  if (status === "Syncing") return "Syncing";
  if (status === "Degraded") return "Degraded";
  if (status === "Critical") return "Critical";
  if (status === "Offline") return "Critical";
  return "Unknown";
}

export function createMockComponents(): ConnectionComponent[] {
  const now = Date.now();
  const base: ConnectionComponent[] = [];

  const push = (partial: Omit<ConnectionComponent, "id" | "createdAt" | "updatedAt">, n: number) => {
    const createdAt = new Date(now - n * 3600_000).toISOString();
    const updatedAt = isoNow(-(n * 22));
    base.push({ id: `cmp-${n}`, createdAt, updatedAt, ...partial });
  };

  push(
    {
      componentId: "host-ld4-01",
      componentType: "Host Machine",
      componentName: "LD4 Host 01",
      broker: null,
      account: null,
      terminal: null,
      eaInstance: null,
      hostMachine: "LD4-HOST-01",
      serverRegion: "LD4",
      environment: "Development",
      connectionStatus: "Healthy",
      heartbeatStatus: "Healthy",
      lastHeartbeat: isoNow(-6),
      expectedHeartbeatIntervalSeconds: 10,
      latencyMs: 12,
      packetLossPercent: 0.0,
      uptimePercent: 99.92,
      errorCount: 1,
      retryCount: 0,
      lastIncident: null,
      healthScore: 96,
      riskLevel: "Low",
      tradingPathActive: true
    },
    1
  );

  push(
    {
      componentId: "term-01",
      componentType: "MT5 Terminal",
      componentName: "MT5-Terminal-1",
      broker: "MockBroker",
      account: "FTMO Challenge - Demo",
      terminal: "MT5-Terminal-1",
      eaInstance: "EA-Instance-A",
      hostMachine: "LD4-HOST-01",
      serverRegion: "LD4",
      environment: "Development",
      connectionStatus: "Healthy",
      heartbeatStatus: "Healthy",
      lastHeartbeat: isoNow(-9),
      expectedHeartbeatIntervalSeconds: 15,
      latencyMs: 44,
      packetLossPercent: 0.1,
      uptimePercent: 99.2,
      errorCount: 2,
      retryCount: 0,
      lastIncident: isoNow(-3600),
      healthScore: 92,
      riskLevel: "Low",
      tradingPathActive: true
    },
    2
  );

  push(
    {
      componentId: "bridge-01",
      componentType: "EA Bridge",
      componentName: "EA Bridge Session A",
      broker: "MockBroker",
      account: "FTMO Challenge - Demo",
      terminal: "MT5-Terminal-1",
      eaInstance: "EA-Instance-A",
      hostMachine: "LD4-HOST-01",
      serverRegion: "LD4",
      environment: "Development",
      connectionStatus: "Degraded",
      heartbeatStatus: "Watch",
      lastHeartbeat: isoNow(-44),
      expectedHeartbeatIntervalSeconds: 15,
      latencyMs: 185,
      packetLossPercent: 1.6,
      uptimePercent: 97.4,
      errorCount: 18,
      retryCount: 4,
      lastIncident: isoNow(-600),
      healthScore: 63,
      riskLevel: "Moderate",
      tradingPathActive: true
    },
    3
  );

  push(
    {
      componentId: "broker-01",
      componentType: "Broker Server",
      componentName: "MockBroker Server",
      broker: "MockBroker",
      account: null,
      terminal: null,
      eaInstance: null,
      hostMachine: "LD4-HOST-01",
      serverRegion: "LD4",
      environment: "Development",
      connectionStatus: "Degraded",
      heartbeatStatus: "Watch",
      lastHeartbeat: isoNow(-32),
      expectedHeartbeatIntervalSeconds: 20,
      latencyMs: 210,
      packetLossPercent: 0.8,
      uptimePercent: 98.1,
      errorCount: 9,
      retryCount: 3,
      lastIncident: isoNow(-880),
      healthScore: 66,
      riskLevel: "Moderate",
      tradingPathActive: true
    },
    4
  );

  push(
    {
      componentId: "acct-01",
      componentType: "Trading Account",
      componentName: "FTMO Challenge - Demo",
      broker: "MockBroker",
      account: "FTMO Challenge - Demo",
      terminal: "MT5-Terminal-1",
      eaInstance: "EA-Instance-A",
      hostMachine: "LD4-HOST-01",
      serverRegion: "LD4",
      environment: "Development",
      connectionStatus: "Healthy",
      heartbeatStatus: "Healthy",
      lastHeartbeat: isoNow(-14),
      expectedHeartbeatIntervalSeconds: 30,
      latencyMs: 58,
      packetLossPercent: 0.1,
      uptimePercent: 99.1,
      errorCount: 2,
      retryCount: 0,
      lastIncident: null,
      healthScore: 89,
      riskLevel: "Low",
      tradingPathActive: true
    },
    5
  );

  push(
    {
      componentId: "feed-01",
      componentType: "Market Data Feed",
      componentName: "MT5 Tick Feed",
      broker: "MockBroker",
      account: null,
      terminal: "MT5-Terminal-1",
      eaInstance: null,
      hostMachine: "LD4-HOST-01",
      serverRegion: "LD4",
      environment: "Development",
      connectionStatus: "Healthy",
      heartbeatStatus: "Healthy",
      lastHeartbeat: isoNow(-11),
      expectedHeartbeatIntervalSeconds: 10,
      latencyMs: 36,
      packetLossPercent: 0.0,
      uptimePercent: 99.4,
      errorCount: 0,
      retryCount: 0,
      lastIncident: null,
      healthScore: 93,
      riskLevel: "Low",
      tradingPathActive: true
    },
    6
  );

  push(
    {
      componentId: "router-01",
      componentType: "Order Router",
      componentName: "Order Router",
      broker: null,
      account: null,
      terminal: null,
      eaInstance: null,
      hostMachine: "LD4-HOST-01",
      serverRegion: "LD4",
      environment: "Development",
      connectionStatus: "Healthy",
      heartbeatStatus: "Healthy",
      lastHeartbeat: isoNow(-9),
      expectedHeartbeatIntervalSeconds: 15,
      latencyMs: 52,
      packetLossPercent: 0.0,
      uptimePercent: 99.0,
      errorCount: 1,
      retryCount: 0,
      lastIncident: null,
      healthScore: 90,
      riskLevel: "Low",
      tradingPathActive: true
    },
    7
  );

  push(
    {
      componentId: "queue-01",
      componentType: "Execution Queue",
      componentName: "Execution Queue",
      broker: null,
      account: null,
      terminal: null,
      eaInstance: null,
      hostMachine: "LD4-HOST-01",
      serverRegion: "LD4",
      environment: "Development",
      connectionStatus: "Healthy",
      heartbeatStatus: "Healthy",
      lastHeartbeat: isoNow(-13),
      expectedHeartbeatIntervalSeconds: 20,
      latencyMs: 64,
      packetLossPercent: 0.0,
      uptimePercent: 99.3,
      errorCount: 1,
      retryCount: 0,
      lastIncident: null,
      healthScore: 88,
      riskLevel: "Low",
      tradingPathActive: true
    },
    8
  );

  push(
    {
      componentId: "mt5-feedback-01",
      componentType: "MT5 Feedback",
      componentName: "MT5 Execution Feedback",
      broker: "MockBroker",
      account: null,
      terminal: "MT5-Terminal-1",
      eaInstance: "EA-Instance-A",
      hostMachine: "LD4-HOST-01",
      serverRegion: "LD4",
      environment: "Development",
      connectionStatus: "Degraded",
      heartbeatStatus: "Degraded",
      lastHeartbeat: isoNow(-130),
      expectedHeartbeatIntervalSeconds: 15,
      latencyMs: 310,
      packetLossPercent: 2.2,
      uptimePercent: 96.8,
      errorCount: 22,
      retryCount: 8,
      lastIncident: isoNow(-420),
      healthScore: 52,
      riskLevel: "High",
      tradingPathActive: true
    },
    9
  );

  push(
    {
      componentId: "audit-01",
      componentType: "Audit Service",
      componentName: "Audit Logger",
      broker: null,
      account: null,
      terminal: null,
      eaInstance: null,
      hostMachine: "LD4-HOST-01",
      serverRegion: "LD4",
      environment: "Development",
      connectionStatus: "Healthy",
      heartbeatStatus: "Healthy",
      lastHeartbeat: isoNow(-7),
      expectedHeartbeatIntervalSeconds: 15,
      latencyMs: 18,
      packetLossPercent: 0.0,
      uptimePercent: 99.8,
      errorCount: 0,
      retryCount: 0,
      lastIncident: null,
      healthScore: 95,
      riskLevel: "Low",
      tradingPathActive: true
    },
    10
  );

  for (let i = 11; i <= 34; i += 1) {
    const degraded = i % 7 === 0;
    const offline = i % 17 === 0;
    const status: ConnectionStatus = offline ? "Offline" : degraded ? "Degraded" : "Healthy";
    const risk: RiskLevel = offline ? "Critical" : degraded ? "High" : i % 3 === 0 ? "Moderate" : "Low";
    const componentType: ComponentType = i % 3 === 0 ? "MT5 Terminal" : i % 4 === 0 ? "EA Bridge" : i % 5 === 0 ? "Market Data Feed" : "Broker Server";
    push(
      {
        componentId: id("cmp", i),
        componentType,
        componentName: `${componentType} ${i}`,
        broker: i % 4 === 0 ? "IC Markets" : "MockBroker",
        account: i % 2 === 0 ? "FTMO Challenge - Demo" : null,
        terminal: componentType === "MT5 Terminal" ? `MT5-Terminal-${i % 3 === 0 ? 2 : 1}` : null,
        eaInstance: componentType === "EA Bridge" ? `EA-Instance-${i % 2 === 0 ? "B" : "A"}` : null,
        hostMachine: i % 2 === 0 ? "LD4-HOST-02" : "LD4-HOST-01",
        serverRegion: "LD4",
        environment: "Development",
        connectionStatus: status,
        heartbeatStatus: offline ? "Offline" : degraded ? "Degraded" : "Healthy",
        lastHeartbeat: offline ? isoNow(-(600 + i)) : isoNow(-(15 + i)),
        expectedHeartbeatIntervalSeconds: 15,
        latencyMs: offline ? 0 : degraded ? 420 + i * 2 : 55 + i,
        packetLossPercent: offline ? 0 : degraded ? 3.5 : 0.2,
        uptimePercent: offline ? 0 : degraded ? 95.4 : 99.1,
        errorCount: offline ? 38 : degraded ? 15 : 2,
        retryCount: offline ? 12 : degraded ? 5 : 0,
        lastIncident: degraded || offline ? isoNow(-(900 + i * 4)) : null,
        healthScore: offline ? 0 : degraded ? 48 : 87,
        riskLevel: risk,
        tradingPathActive: !offline
      },
      i
    );
  }

  return base;
}

export function createMockDependencyMap(components: ConnectionComponent[]): DependencyMapResponse {
  const chain: ComponentType[] = [
    "Host Machine",
    "MT5 Terminal",
    "EA Bridge",
    "Broker Server",
    "Trading Account",
    "Market Data Feed",
    "Order Router",
    "Execution Queue",
    "MT5 Feedback",
    "Audit Service"
  ];

  const pick = (type: ComponentType) => components.find((c) => c.componentType === type) ?? components[0];

  const nodes: DependencyNode[] = chain.map((t) => {
    const c = pick(t);
    return { id: c.componentId, label: c.componentName, componentType: c.componentType, tone: toneFromStatus(c.connectionStatus), healthScore: c.healthScore };
  });

  const edges: DependencyEdge[] = nodes.slice(0, -1).map((n, idx) => {
    const next = nodes[idx + 1]!;
    const status: ConnectionStatus = idx === 2 ? "Degraded" : "Healthy";
    return {
      id: `edge-${idx + 1}`,
      from: n.id,
      to: next.id,
      dependencyType: "Required",
      status,
      failureImpact: status === "Healthy" ? "None" : "Downstream latency and execution risk",
      lastCheckedAt: isoNow(-9)
    };
  });

  const firstFailed = edges.find((e) => e.status !== "Healthy") ?? null;
  const firstFailedComponentId = firstFailed ? firstFailed.to : null;
  const downstreamImpactedComponentIds = firstFailed ? nodes.slice(nodes.findIndex((n) => n.id === firstFailed.to) + 1).map((n) => n.id) : [];

  return {
    meta: { timestamp: isoNow() },
    nodes,
    edges,
    firstFailedComponentId,
    downstreamImpactedComponentIds,
    tradingImpact: firstFailed ? "Execution path risk elevated; recommend restricting trading until dependencies recover." : "Dependency chain intact.",
    recommendedRecoverySequence: firstFailed
      ? ["Reconnect failed service", "Restart unhealthy channel if safe", "Re-sync connection status", "Validate trading path safety", "Re-enable trading if approved"]
      : ["Monitor heartbeats", "Track latency anomalies", "Keep audits enabled"]
  };
}

export function createMockWorkflow(components: ConnectionComponent[]) {
  const steps: Array<{ title: string; type: ComponentType }> = [
    { title: "Terminal Heartbeat", type: "MT5 Terminal" },
    { title: "EA Bridge Session", type: "EA Bridge" },
    { title: "Broker Server Connection", type: "Broker Server" },
    { title: "Account Authentication", type: "Trading Account" },
    { title: "Symbol Availability", type: "Market Data Feed" },
    { title: "Market Data Feed", type: "Market Data Feed" },
    { title: "Order Router Channel", type: "Order Router" },
    { title: "Execution Queue", type: "Execution Queue" },
    { title: "MT5 Execution Feedback", type: "MT5 Feedback" },
    { title: "Audit Confirmation", type: "Audit Service" }
  ];

  const nodes = steps.map((s, idx) => {
    const set = components.filter((c) => c.componentType === s.type);
    const failed = set.filter((c) => c.connectionStatus === "Degraded" || c.connectionStatus === "Critical" || c.connectionStatus === "Offline").length;
    const avgLatency = Math.round(set.reduce((sum, c) => sum + c.latencyMs, 0) / Math.max(1, set.length));
    const status: ConnectionStatus = failed === 0 ? "Healthy" : failed / Math.max(1, set.length) >= 0.35 ? "Degraded" : "Syncing";
    return {
      title: s.title,
      status,
      componentCount: set.length || 1,
      failedCount: failed,
      averageLatencyMs: avgLatency,
      lastSuccessfulEvent: isoNow(-(14 + idx * 7)),
      bottleneckWarning: failed ? `${failed} component(s) degraded/offline` : "No bottleneck detected",
      aiRecommendation: failed ? "Re-route around unhealthy dependencies; run full diagnostics and block unsafe trading paths." : "Maintain heartbeats and monitor latency variance."
    };
  });

  return nodes;
}

export function createMockLatencyAndPacketLoss(): { latency: LatencyPoint[]; packetLoss: PacketLossPoint[] } {
  const types: ComponentType[] = ["MT5 Terminal", "EA Bridge", "Broker Server", "Market Data Feed", "Order Router", "Execution Queue", "MT5 Feedback", "Audit Service"];
  const brokers = [null, "MockBroker", "IC Markets"];
  const latency: LatencyPoint[] = [];
  const packetLoss: PacketLossPoint[] = [];

  for (let t = 20; t >= 0; t -= 1) {
    for (const type of types) {
      const broker = brokers[(t + type.length) % brokers.length]!;
      const baseline = type === "MT5 Feedback" ? 220 : type === "Broker Server" ? 150 : type === "EA Bridge" ? 120 : 55;
      const drift = type === "MT5 Feedback" ? 65 : type === "EA Bridge" ? 40 : 25;
      latency.push({ measuredAt: isoNow(-(t * 30)), componentType: type, broker, latencyMs: Math.max(8, Math.round(baseline + Math.sin(t / 2) * drift + (broker ? 8 : 0))) });

      const plBase = type === "EA Bridge" ? 1.2 : type === "MT5 Feedback" ? 1.8 : 0.2;
      packetLoss.push({ measuredAt: isoNow(-(t * 30)), componentType: type, broker, packetLossPercent: Math.max(0, Number((plBase + Math.max(0, Math.cos(t / 3)) * 1.1).toFixed(2))) });
    }
  }

  return { latency, packetLoss };
}

export function createMockHeartbeats(components: ConnectionComponent[]): HeartbeatMonitorRow[] {
  return components.slice(0, 40).map((c, idx) => {
    const last = c.lastHeartbeat ? new Date(c.lastHeartbeat).getTime() : 0;
    const delaySeconds = last ? Math.max(0, Math.round((Date.now() - last) / 1000)) : 999;
    const status: HeartbeatMonitorRow["status"] =
      delaySeconds <= 30 ? "Healthy" : delaySeconds <= 60 ? "Watch" : delaySeconds <= 120 ? "Degraded" : delaySeconds <= 300 ? "Critical" : "Offline";
    const missed = status === "Healthy" ? 0 : status === "Watch" ? 1 : status === "Degraded" ? 2 : status === "Critical" ? 4 : 12;
    const availability = Math.max(0, Math.min(100, 100 - missed * 2 - c.packetLossPercent * 3));
    return {
      componentId: c.componentId,
      componentType: c.componentType,
      expectedHeartbeatIntervalSeconds: c.expectedHeartbeatIntervalSeconds,
      lastHeartbeat: c.lastHeartbeat,
      heartbeatDelaySeconds: delaySeconds,
      missedHeartbeatCount: missed + (idx % 3),
      availabilityPercent: Number(availability.toFixed(2)),
      status,
      recoveryAction: status === "Offline" ? "Reconnect and restart dependency chain" : status === "Critical" ? "Restart channel if safe" : status === "Degraded" ? "Run diagnostics" : "Monitor",
      nextCheckTime: isoNow(30)
    };
  });
}

export function createMockIncidents(): ConnectionIncident[] {
  return [
    {
      id: "inc-001",
      timestamp: isoNow(-520),
      componentId: "mt5-feedback-01",
      componentType: "MT5 Feedback",
      broker: "MockBroker",
      account: null,
      incidentType: "Latency anomaly",
      severity: "Warning",
      errorCode: "LAT-ANOM",
      errorMessage: "Feedback channel latency exceeded rolling threshold.",
      rootCause: "Terminal network jitter and message queue backlog.",
      actionTaken: "Throttle feedback consumers and increase buffer.",
      resolutionStatus: "Unresolved",
      aiExplanation: "High feedback latency increases duplicate retry risk and delays reconciliation events."
    },
    {
      id: "inc-002",
      timestamp: isoNow(-920),
      componentId: "bridge-01",
      componentType: "EA Bridge",
      broker: "MockBroker",
      account: "FTMO Challenge - Demo",
      incidentType: "Packet loss spike",
      severity: "Critical",
      errorCode: "PL-SPIKE",
      errorMessage: "Packet loss burst detected for EA bridge session.",
      rootCause: "Host machine NIC congestion.",
      actionTaken: "Reconnect and failover to standby host if repeated.",
      resolutionStatus: "Unresolved",
      aiExplanation: "Packet loss at EA bridge can drop MT5 commands and create unsafe partial execution state."
    },
    {
      id: "inc-003",
      timestamp: isoNow(-2200),
      componentId: "term-01",
      componentType: "MT5 Terminal",
      broker: "MockBroker",
      account: "FTMO Challenge - Demo",
      incidentType: "Heartbeat delay",
      severity: "Info",
      errorCode: "HB-WATCH",
      errorMessage: "Heartbeat delay briefly exceeded watch threshold.",
      rootCause: "Snapshot polling cadence.",
      actionTaken: "No action required.",
      resolutionStatus: "Resolved",
      aiExplanation: "Delay is consistent with snapshot mode; enable realtime heartbeats to reduce drift."
    }
  ];
}

export function createMockLogs(): ConnectionLogEntry[] {
  return [
    {
      id: "log-001",
      timestamp: isoNow(-210),
      componentId: "bridge-01",
      componentType: "EA Bridge",
      eventType: "Reconnect",
      severity: "Warning",
      statusBefore: "Degraded",
      statusAfter: "Degraded",
      latencyMs: 182,
      packetLossPercent: 1.6,
      heartbeatDelaySeconds: 44,
      message: "Reconnect attempted after packet loss spike.",
      rootCause: "Host machine NIC congestion.",
      actionTaken: "Reconnect",
      resolved: false,
      resolvedAt: null
    },
    {
      id: "log-002",
      timestamp: isoNow(-740),
      componentId: "mt5-feedback-01",
      componentType: "MT5 Feedback",
      eventType: "Diagnostics",
      severity: "Critical",
      statusBefore: "Degraded",
      statusAfter: "Degraded",
      latencyMs: 320,
      packetLossPercent: 2.2,
      heartbeatDelaySeconds: 130,
      message: "Latency anomaly flagged; feedback consumer backlog detected.",
      rootCause: "Feedback ingestion throughput below baseline.",
      actionTaken: "Scale consumer",
      resolved: false,
      resolvedAt: null
    },
    {
      id: "log-003",
      timestamp: isoNow(-1400),
      componentId: "ALL",
      componentType: "ALL",
      eventType: "Sync Connection Status",
      severity: "Info",
      statusBefore: "—",
      statusAfter: "—",
      latencyMs: 0,
      packetLossPercent: 0,
      heartbeatDelaySeconds: 0,
      message: "Connection snapshot synchronized.",
      rootCause: "Manual refresh",
      actionTaken: "Sync",
      resolved: true,
      resolvedAt: isoNow(-1390)
    }
  ];
}

export function createMockDiagnostics(): AiDiagnosticsResponse {
  const diagnostics: AiConnectionDiagnostic[] = [
    {
      id: "diag-001",
      issue: "Broken dependency chain",
      affectedComponentId: "mt5-feedback-01",
      dependencyImpact: "Downstream audit confirmation delayed; retry risk elevated.",
      severity: "Critical",
      rootCause: "Feedback channel heartbeat delay and elevated packet loss.",
      tradingImpact: "Unsafe trading path due to delayed feedback; consider disabling execution until recovered.",
      recommendedAction: "Restart feedback listener, validate terminal network stability, then re-enable.",
      autoFixEligible: true,
      confidenceScore: 86
    },
    {
      id: "diag-002",
      issue: "EA bridge instability",
      affectedComponentId: "bridge-01",
      dependencyImpact: "Order routing and execution delivery may drop commands.",
      severity: "Warning",
      rootCause: "Packet loss burst and reconnect loop risk.",
      tradingImpact: "Commands may fail delivery or duplicate retries.",
      recommendedAction: "Reconnect bridge; failover to standby host if packet loss persists.",
      autoFixEligible: true,
      confidenceScore: 74
    },
    {
      id: "diag-003",
      issue: "Latency anomaly",
      affectedComponentId: "broker-01",
      dependencyImpact: "Execution feedback delay; elevated slippage risk.",
      severity: "Warning",
      rootCause: "Broker-only latency drift above rolling average.",
      tradingImpact: "Execution quality degradation and delayed confirmations.",
      recommendedAction: "Re-route to healthiest broker/terminal combination; monitor latency trend.",
      autoFixEligible: false,
      confidenceScore: 68
    }
  ];

  return { meta: { timestamp: isoNow() }, diagnostics };
}

