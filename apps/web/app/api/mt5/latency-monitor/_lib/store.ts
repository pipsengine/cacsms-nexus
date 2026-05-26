import type { AuditRecord, Mt5Role, ScoreResult } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import { latencyRiskScore, riskLevelFromScore } from "@/modules/mt5-infrastructure-and-broker-connectivity/latency-monitor/algorithms/latency-monitor.algorithms";
import { createLatencyMonitorSeed } from "@/modules/mt5-infrastructure-and-broker-connectivity/latency-monitor/data/latency-monitor.mock";
import type {
  ActionResponse,
  AiDiagnosticsResponse,
  AiLatencyDiagnostic,
  AlertsResponse,
  BrokerComparisonResponse,
  LatencyAlert,
  LatencyBrokerComparisonRow,
  LatencyLogEntry,
  LatencyMetric,
  LatencyMonitorSummaryResponse,
  LogsResponse,
  LatencyTestResult,
  LatencyThreshold,
  MetricResponse,
  MetricsResponse,
  TestResponse,
  ThresholdCreateRequest,
  ThresholdUpdateRequest,
  ThresholdsResponse,
  TrendsResponse,
  WorkflowResponse
} from "@/modules/mt5-infrastructure-and-broker-connectivity/latency-monitor/types/latency-monitor.types";
import { resolveMt5Role } from "../../_lib/access";

function seed() {
  const s = createLatencyMonitorSeed();
  return { ...s, audits: [] as AuditRecord[], tests: [] as LatencyTestResult[] };
}

const state = {
  ...seed(),
  blockedMetricIds: new Set<string>(),
  testCounter: 1
};

export function resetLatencyMonitorState() {
  const next = seed();
  state.thresholds = next.thresholds;
  state.metrics = next.metrics;
  state.alerts = next.alerts;
  state.trends = next.trends;
  state.brokerComparison = next.brokerComparison;
  state.workflow = next.workflow;
  state.logs = next.logs;
  state.aiDiagnostics = next.aiDiagnostics;
  state.audits = [];
  state.tests = [];
  state.blockedMetricIds = new Set<string>();
  state.testCounter = 1;
}

export function latencyMonitorRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}

const permissions: Record<"diagnostics" | "tests" | "thresholdCreate" | "thresholdUpdate" | "disableRoute" | "enableRoute" | "autoRemediate", Mt5Role[]> = {
  diagnostics: ["Super Admin", "Infrastructure Admin", "Risk Manager"],
  tests: ["Super Admin", "Infrastructure Admin", "Risk Manager"],
  thresholdCreate: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager"],
  thresholdUpdate: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager"],
  disableRoute: ["Super Admin", "Trading Admin", "Risk Manager"],
  enableRoute: ["Super Admin", "Risk Manager"],
  autoRemediate: ["Super Admin", "Infrastructure Admin", "Risk Manager"]
};

function authorize(role: Mt5Role, action: keyof typeof permissions) {
  if (!permissions[action].includes(role)) throw new Error(`Role "${role}" is not authorized to perform latency monitor ${action}.`);
}

function isCriticalThresholdUpdate(patch: ThresholdUpdateRequest) {
  return patch.criticalLatencyLimitMs != null || patch.executionBlockLatencyMs != null;
}

function audit(role: Mt5Role, action: string, entityId: string, oldValue: unknown, newValue: unknown, request?: Request) {
  state.audits.unshift({
    id: `lat-audit-${Date.now()}-${state.audits.length}`,
    userId: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"),
    action,
    module: "Latency Monitor",
    entityId,
    oldValue,
    newValue,
    ipAddress: request?.headers.get("x-forwarded-for") ?? "system",
    userAgent: request?.headers.get("user-agent") ?? "autonomous-latency-monitor",
    timestamp: new Date().toISOString()
  });
}

function action(ok: boolean, message: string, affected?: string[]): ActionResponse {
  return { meta: { timestamp: new Date().toISOString() }, ok, message, affected };
}

function addLog(entry: Omit<LatencyLogEntry, "id">) {
  const next: LatencyLogEntry = { id: `lat-log-${Date.now()}-${state.logs.length}`, ...entry };
  state.logs.unshift(next);
  state.logs = state.logs.slice(0, 320);
  return next;
}

function recomputeDerived() {
  state.metrics = state.metrics.map((m) => ({
    ...m,
    routeBlocked: m.routeBlocked || state.blockedMetricIds.has(m.metricId)
  }));

  state.alerts = state.metrics
    .filter((m) => m.breachStatus !== "Normal" || m.routeBlocked)
    .slice(0, 120)
    .map(
      (m): LatencyAlert => ({
        id: `lat-alert-${m.metricId}-${m.breachStatus}`,
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
        alertType: m.routeBlocked ? "Route Blocked" : m.breachStatus === "Critical" || m.breachStatus === "Blocked" ? "Critical" : "Warning",
        severity: m.routeBlocked || m.breachStatus === "Critical" || m.breachStatus === "Blocked" ? "Critical" : "Warning",
        routeBlocked: m.routeBlocked,
        rootCause: m.timeoutCount > 0 ? "Timeout pattern detected." : m.jitterMs > 25 ? "Jitter instability elevated." : "Latency breached threshold limits.",
        aiExplanation: m.routeBlocked ? "Route blocked to protect execution timing." : "Latency spike increases execution timing and market-data freshness risk.",
        resolutionStatus: "Unresolved",
        resolvedAt: null
      })
    );

  state.aiDiagnostics = state.metrics
    .filter((m) => m.breachStatus !== "Normal" || m.routeBlocked || m.jitterMs > 28 || m.timeoutCount > 0 || m.p99LatencyMs > m.thresholdValueMs * 2)
    .slice(0, 22)
    .map(
      (m, idx): AiLatencyDiagnostic => ({
        id: `ai-${idx + 1}-${m.metricId}`,
        issue: m.routeBlocked ? "Unsafe execution route" : m.timeoutCount > 0 ? "Repeated timeout pattern" : m.jitterMs > 28 ? "Jitter instability" : "Latency spike",
        affectedComponent: `${m.componentType} · ${m.componentName}`,
        affectedContext: `${m.broker ?? "No broker"} · ${m.terminal ?? "No terminal"} · ${m.latencyType}`,
        severity: m.routeBlocked || m.breachStatus === "Critical" || m.breachStatus === "Blocked" ? "Critical" : "Warning",
        rootCause: m.timeoutCount > 0 ? "Timeout count increased within short window." : m.jitterMs > 28 ? "Jitter increased above acceptable range." : "Current latency exceeds threshold or rolling average.",
        tradingImpact: m.latencyType === "Market Data" ? "Market data freshness risk increases slippage risk." : "Execution timing degradation increases rejection and slippage.",
        recommendedAction: m.routeBlocked ? "Keep route disabled; run ping/round-trip and compare alternatives." : "Run diagnostics and monitor p95/p99 and jitter.",
        autoBlockRecommendation: m.breachStatus === "Blocked" || m.p99LatencyMs > m.thresholdValueMs * 2 || m.timeoutCount > 0,
        confidenceScore: Math.min(96, Math.max(55, Math.round(100 - m.jitterMs - m.timeoutCount * 6)))
      })
    );
}

export function summary(role: Mt5Role): LatencyMonitorSummaryResponse {
  recomputeDerived();
  const metrics = state.metrics;
  const avg = metrics.length ? metrics.reduce((s, m) => s + m.currentLatencyMs, 0) / metrics.length : 0;
  const brokerAvg = state.brokerComparison.length ? state.brokerComparison.reduce((s, b) => s + b.averageLatencyMs, 0) / state.brokerComparison.length : 0;
  const bridge = metrics.filter((m) => m.latencyType === "EA Bridge Round Trip");
  const bridgeAvg = bridge.length ? bridge.reduce((s, m) => s + m.currentLatencyMs, 0) / bridge.length : 0;
  const hb = metrics.filter((m) => m.latencyType === "Terminal Heartbeat");
  const hbAvg = hb.length ? hb.reduce((s, m) => s + m.currentLatencyMs, 0) / hb.length : 0;
  const market = metrics.filter((m) => m.latencyType === "Market Data");
  const marketAvg = market.length ? market.reduce((s, m) => s + m.currentLatencyMs, 0) / market.length : 0;
  const routing = metrics.filter((m) => m.latencyType === "Order Routing");
  const routingAvg = routing.length ? routing.reduce((s, m) => s + m.currentLatencyMs, 0) / routing.length : 0;
  const queue = metrics.filter((m) => m.latencyType === "Execution Queue");
  const queueAvg = queue.length ? queue.reduce((s, m) => s + m.currentLatencyMs, 0) / queue.length : 0;
  const feedback = metrics.filter((m) => m.latencyType === "Execution Feedback");
  const feedbackAvg = feedback.length ? feedback.reduce((s, m) => s + m.currentLatencyMs, 0) / feedback.length : 0;
  const breaches = metrics.filter((m) => m.breachStatus !== "Normal" || m.routeBlocked).length;

  const riskScore = latencyRiskScore({
    thresholdBreachScore: Math.min(35, breaches * 3),
    p95LatencyScore: Math.min(20, metrics.reduce((s, m) => s + m.p95LatencyMs, 0) / Math.max(1, metrics.length) / 25),
    p99LatencyScore: Math.min(20, metrics.reduce((s, m) => s + m.p99LatencyMs, 0) / Math.max(1, metrics.length) / 28),
    jitterScore: Math.min(12, metrics.reduce((s, m) => s + m.jitterMs, 0) / Math.max(1, metrics.length) / 3),
    timeoutScore: Math.min(10, metrics.reduce((s, m) => s + m.timeoutCount, 0) * 3),
    tradingImpactScore: Math.min(10, metrics.filter((m) => m.routeBlocked).length * 2)
  });

  const highestBroker = [...state.brokerComparison].sort((a, b) => b.averageLatencyMs - a.averageLatencyMs)[0];
  const highestTerminal = [...metrics].sort((a, b) => b.currentLatencyMs - a.currentLatencyMs).find((m) => m.terminal != null);

  const kpis: LatencyMonitorSummaryResponse["kpis"] = [
    { label: "Overall Average Latency", value: `${Math.round(avg)}ms`, status: avg > 220 ? "Critical" : avg > 140 ? "Degraded" : "Healthy", detail: "Average current latency across metrics", updatedAt: new Date().toISOString() },
    { label: "Broker Average Latency", value: `${Math.round(brokerAvg)}ms`, status: brokerAvg > 220 ? "Critical" : brokerAvg > 140 ? "Degraded" : "Healthy", detail: "Across broker comparison table", updatedAt: new Date().toISOString() },
    { label: "EA Bridge Round Trip Latency", value: `${Math.round(bridgeAvg)}ms`, status: bridgeAvg > 190 ? "Degraded" : "Healthy", detail: "Round trip latency proxy", updatedAt: new Date().toISOString() },
    { label: "Terminal Heartbeat Delay", value: `${Math.round(hbAvg)}ms`, status: hbAvg > 160 ? "Degraded" : "Healthy", detail: "Heartbeat delay proxy", updatedAt: new Date().toISOString() },
    { label: "Market Data Delay", value: `${Math.round(marketAvg)}ms`, status: marketAvg > 200 ? "Degraded" : "Healthy", detail: "Feed delay proxy", updatedAt: new Date().toISOString() },
    { label: "Order Routing Delay", value: `${Math.round(routingAvg)}ms`, status: routingAvg > 180 ? "Degraded" : "Healthy", detail: "Routing delay proxy", updatedAt: new Date().toISOString() },
    { label: "Execution Queue Delay", value: `${Math.round(queueAvg)}ms`, status: queueAvg > 240 ? "Degraded" : "Healthy", detail: "Queue delay proxy", updatedAt: new Date().toISOString() },
    { label: "MT5 Execution Response Time", value: `${Math.round(feedbackAvg)}ms`, status: feedbackAvg > 240 ? "Degraded" : "Healthy", detail: "Execution feedback delay proxy", updatedAt: new Date().toISOString() },
    { label: "Highest Latency Broker", value: highestBroker?.broker ?? "—", status: highestBroker && highestBroker.p99LatencyMs > 350 ? "Critical" : "Watch", detail: highestBroker ? `P99 ${highestBroker.p99LatencyMs}ms` : "—", updatedAt: new Date().toISOString() },
    { label: "Highest Latency Terminal", value: highestTerminal?.terminal ?? "—", status: highestTerminal && highestTerminal.currentLatencyMs > 320 ? "Critical" : "Watch", detail: highestTerminal ? `${highestTerminal.componentType}` : "—", updatedAt: new Date().toISOString() },
    { label: "Latency Breach Count", value: String(breaches), status: breaches > 0 ? "Degraded" : "Healthy", detail: "Warning/Critical/Blocked or route blocked", updatedAt: new Date().toISOString() },
    { label: "Latency Risk Score", value: `${riskScore.score}/100`, status: riskScore.score >= 75 ? "Healthy" : riskScore.score >= 60 ? "Degraded" : "Critical", detail: riskScore.rating, updatedAt: new Date().toISOString() }
  ];

  return { meta: { timestamp: new Date().toISOString(), currentRole: role, streamEndpoint: "/api/mt5/latency-monitor/events-stream" }, kpis, latencyRiskScore: riskScore };
}

export function workflow(): WorkflowResponse {
  return { meta: { timestamp: new Date().toISOString() }, workflow: state.workflow };
}

export function metrics(params: { search?: string; componentType?: string; breach?: string; brokerId?: string; page?: number; pageSize?: number }): MetricsResponse {
  recomputeDerived();
  const search = params.search?.trim().toLowerCase() ?? "";
  const componentType = params.componentType ?? "all";
  const breach = params.breach ?? "all";
  const brokerId = params.brokerId ?? "all";

  const filtered = state.metrics.filter((m) => {
    const matchesSearch =
      !search ||
      [m.metricId, m.componentType, m.componentName, m.broker ?? "", m.account ?? "", m.terminal ?? "", m.eaInstance ?? "", m.symbol ?? "", m.latencyType, m.breachStatus, m.riskLevel]
        .join(" ")
        .toLowerCase()
        .includes(search);
    const matchesComponent = componentType === "all" ? true : m.componentType === componentType;
    const matchesBreach = breach === "all" ? true : m.breachStatus === breach || m.riskLevel === breach;
    const matchesBroker = brokerId === "all" ? true : m.brokerId === brokerId;
    return matchesSearch && matchesComponent && matchesBreach && matchesBroker;
  });

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 75;
  const start = (page - 1) * pageSize;
  return { meta: { timestamp: new Date().toISOString(), total: filtered.length, page, pageSize }, metrics: filtered.slice(start, start + pageSize) };
}

export function metricDetail(metricId: string): MetricResponse {
  recomputeDerived();
  const decoded = decodeURIComponent(metricId);
  const found = state.metrics.find((m) => m.metricId === decoded || m.id === decoded);
  if (!found) throw new Error("Metric not found.");
  return { meta: { timestamp: new Date().toISOString() }, metric: found };
}

export function brokerComparison(): BrokerComparisonResponse {
  recomputeDerived();
  return { meta: { timestamp: new Date().toISOString(), total: state.brokerComparison.length }, comparisons: state.brokerComparison };
}

export function trends(): TrendsResponse {
  return { meta: { timestamp: new Date().toISOString(), total: state.trends.length }, points: state.trends };
}

export function thresholds(): ThresholdsResponse {
  return { meta: { timestamp: new Date().toISOString(), total: state.thresholds.length }, thresholds: state.thresholds };
}

export function createThreshold(payload: ThresholdCreateRequest, role: Mt5Role, request?: Request) {
  authorize(role, "thresholdCreate");
  if (role === "Trading Admin" && (payload.criticalLatencyLimitMs != null || payload.executionBlockLatencyMs != null)) {
    throw new Error(`Role "${role}" is not authorized to change critical threshold values without risk approval.`);
  }
  const next: LatencyThreshold = {
    ...payload,
    id: `thr-${Date.now()}-${state.thresholds.length}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.thresholds.unshift(next);
  audit(role, "Threshold created", next.id, null, next, request);
  addLog({
    timestamp: new Date().toISOString(),
    eventType: "Threshold Create",
    severity: "Info",
    metricId: "ALL",
    message: "Latency threshold created.",
    statusBefore: "—",
    statusAfter: "Created",
    currentLatencyMs: 0,
    routeBlocked: false,
    actionTaken: "Create"
  });
  return action(true, "Threshold created.", [next.id]);
}

export function updateThreshold(thresholdId: string, patch: ThresholdUpdateRequest, role: Mt5Role, request?: Request) {
  authorize(role, "thresholdUpdate");
  const idx = state.thresholds.findIndex((t) => t.id === thresholdId);
  if (idx < 0) throw new Error("Threshold not found.");
  const old = state.thresholds[idx]!;
  if (role === "Trading Admin" && isCriticalThresholdUpdate(patch)) throw new Error(`Role "${role}" is not authorized to change critical threshold values without risk approval.`);
  const next = { ...old, ...patch, updatedAt: new Date().toISOString() } satisfies LatencyThreshold;
  state.thresholds[idx] = next;
  audit(role, "Threshold updated", thresholdId, old, next, request);
  addLog({
    timestamp: new Date().toISOString(),
    eventType: "Threshold Update",
    severity: isCriticalThresholdUpdate(patch) ? "Warning" : "Info",
    metricId: "ALL",
    message: "Latency threshold updated.",
    statusBefore: old.updatedAt,
    statusAfter: next.updatedAt,
    currentLatencyMs: 0,
    routeBlocked: false,
    actionTaken: "Update"
  });
  return action(true, "Threshold updated.", [thresholdId]);
}

function createTest(testType: "Ping" | "Round Trip", role: Mt5Role, metricId?: string | null) {
  authorize(role, "tests");
  recomputeDerived();
  const base = metricId ? state.metrics.find((m) => m.metricId === metricId) : state.metrics[0];
  const startedAt = new Date().toISOString();
  const counter = state.testCounter++;
  const synthetic = 40 + (counter * 17) % 260 + (base?.currentLatencyMs ?? 0) * 0.25;
  const packetLoss = Math.min(6, (counter % 5) * 0.25 + ((base?.timeoutCount ?? 0) > 0 ? 0.8 : 0));
  const timeoutOccurred = packetLoss > 3.8 || (counter % 17 === 0);
  const latencyMs = Math.round(timeoutOccurred ? synthetic * 1.8 : synthetic);
  const roundTripMs = testType === "Round Trip" ? Math.round(latencyMs * 1.65) : null;
  const completedAt = new Date(Date.now() + Math.min(1200, latencyMs)).toISOString();
  const result: LatencyTestResult = {
    id: `test-${counter}`,
    testId: `test-${String(counter).padStart(4, "0")}`,
    testType,
    componentType: base?.componentType ?? "Unknown",
    brokerId: base?.brokerId ?? null,
    accountId: base?.accountId ?? null,
    terminalId: base?.terminalId ?? null,
    eaInstanceId: base?.eaInstanceId ?? null,
    startedAt,
    completedAt,
    latencyMs,
    roundTripMs,
    packetLossPercent: Number(packetLoss.toFixed(2)),
    timeoutOccurred,
    testStatus: timeoutOccurred ? "Failed" : "Success",
    failureReason: timeoutOccurred ? "Timeout occurred during synthetic test." : null
  };
  state.tests.unshift(result);
  state.tests = state.tests.slice(0, 80);
  addLog({
    timestamp: new Date().toISOString(),
    eventType: testType === "Ping" ? "Ping Test" : "Round Trip Test",
    severity: timeoutOccurred ? "Warning" : "Info",
    metricId: base?.metricId ?? "ALL",
    message: timeoutOccurred ? "Latency test failed (timeout)." : "Latency test completed successfully.",
    statusBefore: "—",
    statusAfter: result.testStatus,
    currentLatencyMs: latencyMs,
    routeBlocked: false,
    actionTaken: "Test"
  });
  return result;
}

export function testPing(role: Mt5Role, metricId?: string | null): TestResponse {
  const result = createTest("Ping", role, metricId);
  audit(role, "Test broker ping", metricId ?? "auto", null, result, undefined);
  return { meta: { timestamp: new Date().toISOString() }, result };
}

export function testRoundTrip(role: Mt5Role, metricId?: string | null): TestResponse {
  const result = createTest("Round Trip", role, metricId);
  audit(role, "Test EA bridge round trip", metricId ?? "auto", null, result, undefined);
  return { meta: { timestamp: new Date().toISOString() }, result };
}

export function disableRoute(role: Mt5Role, metricId: string, request?: Request) {
  authorize(role, "disableRoute");
  state.blockedMetricIds.add(metricId);
  audit(role, "Disable route", metricId, null, true, request);
  addLog({
    timestamp: new Date().toISOString(),
    eventType: "Route Disable",
    severity: "Critical",
    metricId,
    message: "Execution route disabled due to high latency posture.",
    statusBefore: "Active",
    statusAfter: "Blocked",
    currentLatencyMs: state.metrics.find((m) => m.metricId === metricId)?.currentLatencyMs ?? 0,
    routeBlocked: true,
    actionTaken: "Disable"
  });
  recomputeDerived();
  return action(true, "Route disabled.", [metricId]);
}

export function enableRoute(role: Mt5Role, metricId: string, request?: Request) {
  authorize(role, "enableRoute");
  state.blockedMetricIds.delete(metricId);
  audit(role, "Enable route", metricId, null, false, request);
  addLog({
    timestamp: new Date().toISOString(),
    eventType: "Route Enable",
    severity: "Warning",
    metricId,
    message: "Execution route enabled after risk approval.",
    statusBefore: "Blocked",
    statusAfter: "Active",
    currentLatencyMs: state.metrics.find((m) => m.metricId === metricId)?.currentLatencyMs ?? 0,
    routeBlocked: false,
    actionTaken: "Enable"
  });
  recomputeDerived();
  return action(true, "Route enabled.", [metricId]);
}

export function diagnostics(role: Mt5Role, request?: Request) {
  authorize(role, "diagnostics");
  addLog({
    timestamp: new Date().toISOString(),
    eventType: "Diagnostics",
    severity: "Info",
    metricId: "ALL",
    message: "Latency diagnostics executed across components.",
    statusBefore: "—",
    statusAfter: "—",
    currentLatencyMs: 0,
    routeBlocked: false,
    actionTaken: "Diagnostics"
  });
  audit(role, "Run latency diagnostics", "latency-monitor", null, { rows: state.metrics.length }, request);
  return action(true, "Diagnostics completed.");
}

export function alerts(filter?: string): AlertsResponse {
  recomputeDerived();
  const normalized = filter?.trim().toLowerCase() ?? "";
  const filtered = normalized ? state.alerts.filter((a) => [a.alertType, a.severity, a.resolutionStatus, a.componentName].join(" ").toLowerCase().includes(normalized)) : state.alerts;
  return { meta: { timestamp: new Date().toISOString(), total: filtered.length }, alerts: filtered };
}

export function logs(filter?: string): LogsResponse {
  const normalized = filter?.trim().toLowerCase() ?? "";
  const filtered = normalized ? state.logs.filter((l) => [l.eventType, l.severity, l.metricId, l.message].join(" ").toLowerCase().includes(normalized)) : state.logs;
  return { meta: { timestamp: new Date().toISOString(), total: filtered.length }, logs: filtered };
}

export function aiDiagnostics(): AiDiagnosticsResponse {
  recomputeDerived();
  return { meta: { timestamp: new Date().toISOString(), total: state.aiDiagnostics.length }, diagnostics: state.aiDiagnostics };
}

export function autoRemediate(role: Mt5Role, request?: Request) {
  authorize(role, "autoRemediate");
  recomputeDerived();
  const affected = state.metrics
    .filter((m) => m.breachStatus === "Critical" || m.breachStatus === "Blocked" || m.routeBlocked)
    .map((m) => m.metricId)
    .slice(0, 12);
  addLog({
    timestamp: new Date().toISOString(),
    eventType: "Auto-Remediate",
    severity: affected.length ? "Warning" : "Info",
    metricId: "ALL",
    message: affected.length ? "Auto-remediation suggested: test alternatives and disable unsafe routes." : "No remediation required.",
    statusBefore: "—",
    statusAfter: "—",
    currentLatencyMs: 0,
    routeBlocked: false,
    actionTaken: "Recommend"
  });
  audit(role, "Auto-remediate executed", "latency-monitor", null, { affected }, request);
  return action(true, affected.length ? "Auto-remediation suggestions generated." : "No remediation required.", affected);
}
