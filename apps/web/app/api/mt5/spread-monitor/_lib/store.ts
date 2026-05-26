import type { AuditRecord, Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import {
  buildBrokerComparison,
  classifyPeerComparison,
  createSpreadAlert,
  spreadRiskScore,
  spreadStatusFromThreshold,
  shouldBlockExecution
} from "@/modules/mt5-infrastructure-and-broker-connectivity/spread-monitor/algorithms/spread-monitor.algorithms";
import { createSpreadMonitorSeed } from "@/modules/mt5-infrastructure-and-broker-connectivity/spread-monitor/data/spread-monitor.mock";
import type {
  ActionResponse,
  AiSpreadDiagnostic,
  AiDiagnosticsResponse,
  AlertsResponse,
  BrokerComparisonResponse,
  LogsResponse,
  SpreadAlert,
  SpreadLogEntry,
  SpreadMonitorSummaryResponse,
  SpreadSnapshot,
  SpreadThreshold,
  SpreadsResponse,
  SymbolSpreadResponse,
  ThresholdCreateRequest,
  ThresholdUpdateRequest,
  ThresholdsResponse,
  TrendsResponse
} from "@/modules/mt5-infrastructure-and-broker-connectivity/spread-monitor/types/spread-monitor.types";
import { resolveMt5Role } from "../../_lib/access";
import { bindPersistedMt5State } from "../../_lib/persistence";

const seed = () => {
  const s = createSpreadMonitorSeed();
  return { ...s, audits: [] as AuditRecord[] };
};

const state = bindPersistedMt5State("spread-monitor", () => ({
  ...seed(),
  disabledSymbols: new Set<string>()
}));

export function resetSpreadMonitorState() {
  const next = seed();
  state.thresholds = next.thresholds;
  state.spreads = next.spreads;
  state.trends = next.trends;
  state.alerts = next.alerts;
  state.logs = next.logs;
  state.workflow = next.workflow;
  state.audits = [];
  state.disabledSymbols = new Set<string>();
}

export function spreadMonitorRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}

const permissions: Record<"diagnostics" | "thresholdCreate" | "thresholdUpdate" | "executionToggle" | "autoRemediate", Mt5Role[]> = {
  diagnostics: ["Super Admin", "Risk Manager", "Trading Admin", "Analyst"],
  thresholdCreate: ["Super Admin", "Risk Manager", "Trading Admin"],
  thresholdUpdate: ["Super Admin", "Risk Manager", "Trading Admin"],
  executionToggle: ["Super Admin", "Risk Manager", "Trading Admin"],
  autoRemediate: ["Super Admin", "Risk Manager"]
};

function authorize(role: Mt5Role, action: keyof typeof permissions) {
  if (!permissions[action].includes(role)) throw new Error(`Role "${role}" is not authorized to perform spread monitor ${action}.`);
}

function audit(role: Mt5Role, action: string, entityId: string, oldValue: unknown, newValue: unknown, request?: Request) {
  state.audits.unshift({
    id: `spr-audit-${Date.now()}-${state.audits.length}`,
    userId: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"),
    action,
    module: "Spread Monitor",
    entityId,
    oldValue,
    newValue,
    ipAddress: request?.headers.get("x-forwarded-for") ?? "system",
    userAgent: request?.headers.get("user-agent") ?? "autonomous-spread-monitor",
    timestamp: new Date().toISOString()
  });
}

function action(ok: boolean, message: string, affected?: string[]): ActionResponse {
  return { meta: { timestamp: new Date().toISOString() }, ok, message, affected };
}

function addLog(entry: Omit<SpreadLogEntry, "id">) {
  const next: SpreadLogEntry = { id: `spr-log-${Date.now()}-${state.logs.length}`, ...entry };
  state.logs.unshift(next);
  state.logs = state.logs.slice(0, 250);
  return next;
}

function newsBlackoutActive(now = new Date()) {
  const minute = now.getUTCMinutes();
  return minute % 30 === 0 || minute % 30 === 1;
}

function pickThreshold(normalizedSymbol: string, brokerId: string) {
  const scoped = state.thresholds.find((t) => t.normalizedSymbol === normalizedSymbol && t.brokerId === brokerId);
  return scoped ?? state.thresholds.find((t) => t.normalizedSymbol === normalizedSymbol && t.brokerId == null) ?? state.thresholds[0]!;
}

function upsertAlert(alert: SpreadAlert) {
  const existing = state.alerts.find(
    (a) =>
      a.normalizedSymbol === alert.normalizedSymbol &&
      a.brokerId === alert.brokerId &&
      a.alertType === alert.alertType &&
      a.resolutionStatus !== "Resolved"
  );
  if (existing) return existing;
  state.alerts.unshift(alert);
  state.alerts = state.alerts.slice(0, 150);
  return alert;
}

function recomputeDerived(now = new Date()) {
  const blackout = newsBlackoutActive(now);
  const comparisons = buildBrokerComparison(state.spreads);

  state.spreads = state.spreads.map((row) => {
    const threshold = pickThreshold(row.normalizedSymbol, row.brokerId);
    const status = spreadStatusFromThreshold(row.currentSpreadPips, threshold, blackout);
    const peer = classifyPeerComparison({ currentBrokerId: row.brokerId, normalizedSymbol: row.normalizedSymbol, comparisons });
    const blockDecision = shouldBlockExecution({
      currentSpreadPips: row.currentSpreadPips,
      rollingAveragePips: row.averageSpreadPips,
      deviationPercent: Math.abs(row.spreadDeviationPercent),
      stabilityScore: row.spreadStabilityScore,
      threshold,
      newsBlackoutActive: blackout,
      brokerIsMateriallyWorseThanPeers: peer.materiallyWorse,
      scalpingStrategy: threshold.strategyType.toLowerCase().includes("scalp")
    });

    const forcedDisabled = state.disabledSymbols.has(row.normalizedSymbol);
    const executionAllowed = !forcedDisabled && !blockDecision.shouldBlock;
    const next: SpreadSnapshot = {
      ...row,
      thresholdId: threshold.id,
      threshold,
      spreadStatus: status,
      executionAllowed,
      riskLevel: !executionAllowed ? "Critical" : status === "Critical" ? "High" : status === "Wide" ? "Elevated" : "Low"
    };

    if (status === "Critical" || blockDecision.shouldBlock) {
      const type =
        blockDecision.shouldBlock ? "Execution Blocked" : peer.classification === "Broker Spike" ? "Broker Spike" : blackout ? "News Spike" : status === "Critical" ? "Critical" : "Warning";
      const severity = blockDecision.shouldBlock || status === "Critical" ? "Critical" : "Warning";
      const thresholdValue = blockDecision.shouldBlock ? threshold.executionBlockLimitPips : status === "Critical" ? threshold.criticalLimitPips : threshold.warningLimitPips;
      const rootCause =
        blackout ? "News blackout liquidity expansion." : peer.classification === "Broker Spike" ? "Broker-specific spread divergence." : "Spread widening beyond configured limits.";
      const aiExplanation = blockDecision.shouldBlock
        ? `Execution blocked: ${blockDecision.reasons.slice(0, 3).join("; ")}.`
        : "Spread widening increases execution cost and invalidates tight-spread assumptions.";

      upsertAlert(
        createSpreadAlert({
          row: next,
          type,
          severity,
          thresholdValuePips: thresholdValue,
          executionBlocked: blockDecision.shouldBlock,
          rootCause,
          aiExplanation
        })
      );

      addLog({
        timestamp: new Date().toISOString(),
        eventType: blockDecision.shouldBlock ? "Execution Block" : "Spread Alert",
        severity,
        symbol: next.symbol,
        normalizedSymbol: next.normalizedSymbol,
        brokerId: next.brokerId,
        accountId: next.accountId,
        message: blockDecision.shouldBlock ? "Execution blocked due to unsafe spread posture." : "Spread threshold exceeded.",
        statusBefore: row.executionAllowed ? "Allowed" : "Blocked",
        statusAfter: executionAllowed ? "Allowed" : "Blocked",
        currentSpreadPips: next.currentSpreadPips,
        executionAllowed,
        actionTaken: blockDecision.shouldBlock ? "Block" : "Alert"
      });
    }

    return next;
  });
}

export function summary(role: Mt5Role): SpreadMonitorSummaryResponse {
  recomputeDerived(new Date());
  const blackout = newsBlackoutActive(new Date());
  const symbols = new Set(state.spreads.map((s) => s.normalizedSymbol)).size;
  const brokers = new Set(state.spreads.map((s) => s.brokerId)).size;
  const normal = state.spreads.filter((s) => s.spreadStatus === "Normal").length;
  const wide = state.spreads.filter((s) => s.spreadStatus === "Wide").length;
  const critical = state.spreads.filter((s) => s.spreadStatus === "Critical").length;
  const criticalAlerts = state.alerts.filter((a) => a.severity === "Critical" && a.resolutionStatus !== "Resolved").length;
  const avgSpread = state.spreads.length ? state.spreads.reduce((sum, s) => sum + s.currentSpreadPips, 0) / state.spreads.length : 0;
  const highest = [...state.spreads].sort((a, b) => b.currentSpreadPips - a.currentSpreadPips)[0];
  const spikeEvents = state.alerts.filter((a) => a.alertType.includes("Spike") && a.resolutionStatus !== "Resolved").length;
  const blocked = state.spreads.filter((s) => !s.executionAllowed).length;

  const byBroker = new Map<string, { broker: string; avg: number; stability: number; count: number }>();
  for (const row of state.spreads) {
    const prev = byBroker.get(row.brokerId) ?? { broker: row.broker, avg: 0, stability: 0, count: 0 };
    byBroker.set(row.brokerId, { broker: row.broker, avg: prev.avg + row.currentSpreadPips, stability: prev.stability + row.spreadStabilityScore, count: prev.count + 1 });
  }
  const brokerStats = [...byBroker.values()].map((b) => ({ ...b, avg: b.count ? b.avg / b.count : 0, stability: b.count ? b.stability / b.count : 0 }));
  const mostStable = [...brokerStats].sort((a, b) => b.stability - a.stability)[0];
  const mostExpensive = [...brokerStats].sort((a, b) => b.avg - a.avg)[0];

  const safety = spreadRiskScore({
    thresholdRatio: critical > 0 ? 1.2 : wide > 0 ? 0.85 : 0.4,
    deviationPercent: Math.min(150, Math.max(0, avgSpread > 0 ? (state.spreads.reduce((sum, s) => sum + Math.abs(s.spreadDeviationPercent), 0) / state.spreads.length) : 0)),
    brokerDeltaPips: mostExpensive && mostStable ? Math.max(0, mostExpensive.avg - (mostStable.avg ?? 0)) : 0,
    newsPenalty: blackout ? 8 : 0,
    volatilityPenalty: Math.min(14, spikeEvents * 3 + critical * 2),
    stabilityScore: Math.max(0, Math.min(100, brokerStats.length ? brokerStats.reduce((sum, b) => sum + b.stability, 0) / brokerStats.length : 70))
  });

  const kpis: SpreadMonitorSummaryResponse["kpis"] = [
    { label: "Symbols Monitored", value: String(symbols), status: "Healthy", detail: "Normalized symbols under watch", updatedAt: new Date().toISOString() },
    { label: "Brokers Monitored", value: String(brokers), status: "Healthy", detail: "Broker routes reporting spreads", updatedAt: new Date().toISOString() },
    { label: "Normal Spread Symbols", value: String(normal), status: wide > 0 ? "Watch" : "Healthy", detail: "Rows at/below warning limit", updatedAt: new Date().toISOString() },
    { label: "Wide Spread Symbols", value: String(wide), status: wide > 0 ? "Degraded" : "Healthy", detail: "Rows above warning but below critical", updatedAt: new Date().toISOString() },
    { label: "Critical Spread Alerts", value: String(criticalAlerts), status: criticalAlerts > 0 ? "Critical" : "Healthy", detail: "Active critical alerts (unresolved)", updatedAt: new Date().toISOString() },
    { label: "Average Spread", value: `${avgSpread.toFixed(2)} pips`, status: avgSpread > 4 ? "Degraded" : "Healthy", detail: blackout ? "News multiplier active" : "Average current spread across rows", updatedAt: new Date().toISOString() },
    { label: "Highest Spread Symbol", value: highest?.normalizedSymbol ?? "—", status: highest && highest.currentSpreadPips > 6 ? "Critical" : "Watch", detail: highest ? `${highest.currentSpreadPips.toFixed(2)} pips` : "—", updatedAt: new Date().toISOString() },
    { label: "Most Stable Broker", value: mostStable?.broker ?? "—", status: "Healthy", detail: mostStable ? `${mostStable.stability.toFixed(1)}/100` : "—", updatedAt: new Date().toISOString() },
    { label: "Most Expensive Broker", value: mostExpensive?.broker ?? "—", status: mostExpensive && mostExpensive.avg > 4 ? "Degraded" : "Watch", detail: mostExpensive ? `${mostExpensive.avg.toFixed(2)} pips` : "—", updatedAt: new Date().toISOString() },
    { label: "Spread Spike Events", value: String(spikeEvents), status: spikeEvents > 0 ? "Degraded" : "Healthy", detail: "Spike alerts currently active", updatedAt: new Date().toISOString() },
    { label: "Blocked Executions", value: String(blocked), status: blocked > 0 ? "Critical" : "Healthy", detail: "Rows blocked by spread safety", updatedAt: new Date().toISOString() },
    { label: "Spread Risk Score", value: `${safety.score}/100`, status: safety.score >= 75 ? "Healthy" : safety.score >= 60 ? "Degraded" : "Critical", detail: safety.rating, updatedAt: new Date().toISOString() }
  ];

  return { meta: { timestamp: new Date().toISOString(), currentRole: role, streamEndpoint: "/api/mt5/spread-monitor/events-stream" }, kpis, spreadRiskScore: safety };
}

export function spreads(params: { search?: string; assetClass?: string; status?: string; brokerId?: string; page?: number; pageSize?: number }): SpreadsResponse {
  recomputeDerived(new Date());
  const search = params.search?.trim().toLowerCase() ?? "";
  const asset = params.assetClass ?? "all";
  const status = params.status ?? "all";
  const brokerId = params.brokerId ?? "all";

  const filtered = state.spreads.filter((r) => {
    const matchesSearch = !search || [r.symbol, r.normalizedSymbol, r.broker, r.account, r.assetClass].join(" ").toLowerCase().includes(search);
    const matchesAsset = asset === "all" ? true : r.assetClass === asset;
    const matchesBroker = brokerId === "all" ? true : r.brokerId === brokerId;
    const matchesStatus = status === "all" ? true : r.spreadStatus === status || r.riskLevel === status;
    return matchesSearch && matchesAsset && matchesBroker && matchesStatus;
  });

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 75;
  const start = (page - 1) * pageSize;
  return { meta: { timestamp: new Date().toISOString(), total: filtered.length, page, pageSize }, spreads: filtered.slice(start, start + pageSize) };
}

export function symbolDetail(symbol: string): SymbolSpreadResponse {
  recomputeDerived(new Date());
  const decoded = decodeURIComponent(symbol);
  const rows = state.spreads.filter((r) => r.normalizedSymbol === decoded || r.symbol === decoded);
  const normalizedSymbol = rows[0]?.normalizedSymbol ?? decoded;
  const trend = state.trends.filter((p) => p.normalizedSymbol === normalizedSymbol);
  const latestAlerts = state.alerts.filter((a) => a.normalizedSymbol === normalizedSymbol).slice(0, 25);
  return { meta: { timestamp: new Date().toISOString() }, symbol: decoded, normalizedSymbol, rows, trend, latestAlerts };
}

export function brokerComparison(): BrokerComparisonResponse {
  recomputeDerived(new Date());
  const comparisons = buildBrokerComparison(state.spreads);
  return { meta: { timestamp: new Date().toISOString(), total: comparisons.length }, comparisons };
}

export function trends(): TrendsResponse {
  return { meta: { timestamp: new Date().toISOString(), total: state.trends.length }, points: state.trends };
}

export function thresholds(): ThresholdsResponse {
  return { meta: { timestamp: new Date().toISOString(), total: state.thresholds.length }, thresholds: state.thresholds };
}

function isCriticalThresholdUpdate(patch: ThresholdUpdateRequest) {
  return patch.criticalLimitPips != null || patch.executionBlockLimitPips != null;
}

export function createThreshold(payload: ThresholdCreateRequest, role: Mt5Role, request?: Request) {
  authorize(role, "thresholdCreate");
  if (role === "Trading Admin" && (payload.criticalLimitPips != null || payload.executionBlockLimitPips != null)) {
    throw new Error(`Role "${role}" is not authorized to change critical threshold values without risk approval.`);
  }

  const next: SpreadThreshold = {
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
    symbol: payload.symbol ?? payload.normalizedSymbol,
    normalizedSymbol: payload.normalizedSymbol,
    brokerId: payload.brokerId ?? "ALL",
    accountId: "ALL",
    message: "Spread threshold created.",
    statusBefore: "—",
    statusAfter: "Created",
    currentSpreadPips: 0,
    executionAllowed: true,
    actionTaken: "Create"
  });
  return action(true, "Threshold created.", [next.id]);
}

export function updateThreshold(thresholdId: string, patch: ThresholdUpdateRequest, role: Mt5Role, request?: Request) {
  authorize(role, "thresholdUpdate");
  const idx = state.thresholds.findIndex((t) => t.id === thresholdId);
  if (idx < 0) throw new Error("Threshold not found.");
  const old = state.thresholds[idx]!;

  if (role === "Trading Admin" && isCriticalThresholdUpdate(patch)) {
    throw new Error(`Role "${role}" is not authorized to change critical threshold values without risk approval.`);
  }

  const next = { ...old, ...patch, updatedAt: new Date().toISOString() } satisfies SpreadThreshold;
  state.thresholds[idx] = next;
  audit(role, "Threshold updated", thresholdId, old, next, request);
  addLog({
    timestamp: new Date().toISOString(),
    eventType: "Threshold Update",
    severity: isCriticalThresholdUpdate(patch) ? "Warning" : "Info",
    symbol: next.symbol ?? next.normalizedSymbol,
    normalizedSymbol: next.normalizedSymbol,
    brokerId: next.brokerId ?? "ALL",
    accountId: "ALL",
    message: "Spread threshold updated.",
    statusBefore: old.updatedAt,
    statusAfter: next.updatedAt,
    currentSpreadPips: 0,
    executionAllowed: true,
    actionTaken: "Update"
  });
  return action(true, "Threshold updated.", [thresholdId]);
}

export function disableExecution(symbol: string, role: Mt5Role, request?: Request) {
  authorize(role, "executionToggle");
  const decoded = decodeURIComponent(symbol);
  state.disabledSymbols.add(decoded);
  audit(role, "Disable execution", decoded, null, true, request);
  addLog({
    timestamp: new Date().toISOString(),
    eventType: "Execution Override",
    severity: "Critical",
    symbol: decoded,
    normalizedSymbol: decoded,
    brokerId: "ALL",
    accountId: "ALL",
    message: "Execution disabled by operator.",
    statusBefore: "Allowed",
    statusAfter: "Blocked",
    currentSpreadPips: 0,
    executionAllowed: false,
    actionTaken: "Disable"
  });
  recomputeDerived(new Date());
  return action(true, "Execution disabled for symbol.", [decoded]);
}

export function enableExecution(symbol: string, role: Mt5Role, request?: Request) {
  authorize(role, "executionToggle");
  const decoded = decodeURIComponent(symbol);
  state.disabledSymbols.delete(decoded);
  audit(role, "Enable execution", decoded, null, false, request);
  addLog({
    timestamp: new Date().toISOString(),
    eventType: "Execution Override",
    severity: "Info",
    symbol: decoded,
    normalizedSymbol: decoded,
    brokerId: "ALL",
    accountId: "ALL",
    message: "Execution enabled by operator.",
    statusBefore: "Blocked",
    statusAfter: "Allowed",
    currentSpreadPips: 0,
    executionAllowed: true,
    actionTaken: "Enable"
  });
  recomputeDerived(new Date());
  return action(true, "Execution enabled for symbol.", [decoded]);
}

export function diagnostics(role: Mt5Role, request?: Request) {
  authorize(role, "diagnostics");
  addLog({
    timestamp: new Date().toISOString(),
    eventType: "Diagnostics",
    severity: "Info",
    symbol: "ALL",
    normalizedSymbol: "ALL",
    brokerId: "ALL",
    accountId: "ALL",
    message: "Spread diagnostics executed across brokers and symbols.",
    statusBefore: "—",
    statusAfter: "—",
    currentSpreadPips: 0,
    executionAllowed: true,
    actionTaken: "Diagnostics"
  });
  audit(role, "Run spread diagnostics", "spread-monitor", null, { rows: state.spreads.length }, request);
  return action(true, "Diagnostics completed.");
}

export function alerts(filter?: string): AlertsResponse {
  recomputeDerived(new Date());
  const normalized = filter?.trim().toLowerCase() ?? "";
  const filtered = normalized
    ? state.alerts.filter((a) => [a.alertType, a.severity, a.resolutionStatus, a.symbol, a.broker].join(" ").toLowerCase().includes(normalized))
    : state.alerts;
  return { meta: { timestamp: new Date().toISOString(), total: filtered.length }, alerts: filtered };
}

export function logs(filter?: string): LogsResponse {
  const normalized = filter?.trim().toLowerCase() ?? "";
  const filtered = normalized ? state.logs.filter((l) => [l.eventType, l.severity, l.symbol, l.message].join(" ").toLowerCase().includes(normalized)) : state.logs;
  return { meta: { timestamp: new Date().toISOString(), total: filtered.length }, logs: filtered };
}

export function aiDiagnostics(): AiDiagnosticsResponse {
  recomputeDerived(new Date());
  const diagnostics = state.spreads
    .filter((r) => r.spreadStatus !== "Normal" || !r.executionAllowed || Math.abs(r.spreadDeviationPercent) > 85)
    .slice(0, 22)
    .map(
      (r, idx): AiSpreadDiagnostic => ({
      id: `ai-${idx + 1}-${r.id}`,
      issue: !r.executionAllowed ? "Execution blocked due to unsafe spread posture" : r.spreadStatus === "Critical" ? "Abnormal spread widening" : "Spread instability detected",
      affected: `${r.normalizedSymbol} · ${r.broker}`,
      severity: !r.executionAllowed || r.spreadStatus === "Critical" ? "Critical" : "Warning",
      rootCause: Math.abs(r.spreadDeviationPercent) > 120 ? "Spread widened abruptly vs rolling average." : "Liquidity conditions deteriorated or broker spread widened.",
      tradingImpact: !r.executionAllowed ? "Unsafe execution path blocked." : "Execution cost deterioration increases slippage and invalidates strategy edges.",
      recommendedAction: !r.executionAllowed ? "Keep blocked and monitor until spreads normalize below warning." : "Compare peer brokers and reduce exposure.",
      autoBlockRecommendation: r.spreadStatus === "Critical" || Math.abs(r.spreadDeviationPercent) > 120,
      confidenceScore: Math.min(96, Math.max(55, Math.round(100 - r.spreadStabilityScore)))
      })
    );
  return { meta: { timestamp: new Date().toISOString(), total: diagnostics.length }, diagnostics };
}

export function autoRemediate(role: Mt5Role, request?: Request) {
  authorize(role, "autoRemediate");
  recomputeDerived(new Date());

  const affected: string[] = [];
  const candidates = state.spreads.filter((r) => !r.executionAllowed && r.spreadStatus === "Normal").slice(0, 10);
  for (const row of candidates) {
    if (state.disabledSymbols.has(row.normalizedSymbol)) continue;
    affected.push(row.normalizedSymbol);
  }

  addLog({
    timestamp: new Date().toISOString(),
    eventType: "Auto-Remediate",
    severity: affected.length ? "Warning" : "Info",
    symbol: "ALL",
    normalizedSymbol: "ALL",
    brokerId: "ALL",
    accountId: "ALL",
    message: affected.length ? "Auto-remediation suggested: consider re-enabling normalized symbols when stable." : "No remediation required.",
    statusBefore: "—",
    statusAfter: "—",
    currentSpreadPips: 0,
    executionAllowed: true,
    actionTaken: "Recommend"
  });

  audit(role, "Auto-remediate executed", "spread-monitor", null, { affected }, request);
  return action(true, affected.length ? "Auto-remediation suggestions generated." : "No remediation required.", affected);
}
