import type { AuditRecord, Mt5Role, ScoreResult } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import { normalizeSymbol } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/algorithms/mt5-control-center.algorithms";
import {
  breachStatusFromThreshold,
  buildBrokerComparison,
  calculateSlippagePoints,
  classifySlippage,
  createSlippageAlert,
  pointsToPips,
  riskLevelFromScore,
  slippageRiskScore,
  shouldBlockExecution
} from "@/modules/mt5-infrastructure-and-broker-connectivity/slippage-monitor/algorithms/slippage-monitor.algorithms";
import type {
  ActionResponse,
  AiDiagnosticsResponse,
  AiSlippageDiagnostic,
  AlertsResponse,
  BrokerComparisonResponse,
  BrokerSlippageComparisonRow,
  ExecutionResponse,
  ExecutionsResponse,
  LogsResponse,
  SlippageAlert,
  SlippageExecution,
  SlippageLogEntry,
  SlippageMonitorSummaryResponse,
  SlippageAssetClass,
  SlippageThreshold,
  SlippageWorkflowNode,
  ThresholdCreateRequest,
  ThresholdUpdateRequest,
  ThresholdsResponse,
  TrendsResponse,
  WorkflowResponse
} from "@/modules/mt5-infrastructure-and-broker-connectivity/slippage-monitor/types/slippage-monitor.types";
import { resolveMt5Role } from "../../_lib/access";
import { bindPersistedMt5State, ensureMt5ModuleHydrated } from "../../_lib/persistence";

const state = bindPersistedMt5State("slippage-monitor", () => ({
  thresholds: [] as SlippageThreshold[],
  executions: [] as SlippageExecution[],
  trends: [] as any[],
  alerts: [] as SlippageAlert[],
  logs: [] as SlippageLogEntry[],
  workflow: [] as any[],
  brokerComparison: [] as BrokerSlippageComparisonRow[],
  aiDiagnostics: [] as AiSlippageDiagnostic[],
  audits: [] as AuditRecord[],
  unsafeExecutionDisabled: false
}));

await ensureMt5ModuleHydrated("slippage-monitor");

export function resetSlippageMonitorState(override?: Partial<typeof state>) {
  state.thresholds = override?.thresholds ?? [];
  state.executions = override?.executions ?? [];
  state.trends = (override as any)?.trends ?? [];
  state.alerts = override?.alerts ?? [];
  state.logs = override?.logs ?? [];
  state.workflow = (override as any)?.workflow ?? [];
  state.brokerComparison = override?.brokerComparison ?? [];
  state.aiDiagnostics = override?.aiDiagnostics ?? [];
  state.audits = [];
  state.unsafeExecutionDisabled = false;
}

export function slippageMonitorRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}

const permissions: Record<"diagnostics" | "thresholdCreate" | "thresholdUpdate" | "disableUnsafe" | "autoRemediate", Mt5Role[]> = {
  diagnostics: ["Super Admin", "Risk Manager", "Trading Admin", "Analyst"],
  thresholdCreate: ["Super Admin", "Risk Manager", "Trading Admin"],
  thresholdUpdate: ["Super Admin", "Risk Manager", "Trading Admin"],
  disableUnsafe: ["Super Admin", "Risk Manager"],
  autoRemediate: ["Super Admin", "Risk Manager"]
};

function authorize(role: Mt5Role, action: keyof typeof permissions) {
  if (!permissions[action].includes(role)) throw new Error(`Role "${role}" is not authorized to perform slippage monitor ${action}.`);
}

function audit(role: Mt5Role, action: string, entityId: string, oldValue: unknown, newValue: unknown, request?: Request) {
  state.audits.unshift({
    id: `slip-audit-${Date.now()}-${state.audits.length}`,
    userId: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"),
    action,
    module: "Slippage Monitor",
    entityId,
    oldValue,
    newValue,
    ipAddress: request?.headers.get("x-forwarded-for") ?? "system",
    userAgent: request?.headers.get("user-agent") ?? "autonomous-slippage-monitor",
    timestamp: new Date().toISOString()
  });
}

function action(ok: boolean, message: string, affected?: string[]): ActionResponse {
  return { meta: { timestamp: new Date().toISOString() }, ok, message, affected };
}

function addLog(entry: Omit<SlippageLogEntry, "id">) {
  const next: SlippageLogEntry = { id: `slip-log-${Date.now()}-${state.logs.length}`, ...entry };
  state.logs.unshift(next);
  state.logs = state.logs.slice(0, 300);
  return next;
}

function newsWindowActive(now = new Date()) {
  const minute = now.getUTCMinutes();
  return minute % 30 === 0 || minute % 30 === 1;
}

const symbolMeta: Record<string, { digits: number; pointSize: number; pointsPerPip: number; pipValue: number }> = {
  EURUSD: { digits: 5, pointSize: 0.00001, pointsPerPip: 10, pipValue: 10 },
  GBPUSD: { digits: 5, pointSize: 0.00001, pointsPerPip: 10, pipValue: 10 },
  USDJPY: { digits: 3, pointSize: 0.001, pointsPerPip: 10, pipValue: 10 },
  XAUUSD: { digits: 2, pointSize: 0.01, pointsPerPip: 10, pipValue: 1 },
  NAS100: { digits: 1, pointSize: 0.1, pointsPerPip: 10, pipValue: 1 },
  SPX500: { digits: 1, pointSize: 0.1, pointsPerPip: 10, pipValue: 1 },
  US30: { digits: 1, pointSize: 0.1, pointsPerPip: 10, pipValue: 1 }
};

function mapAssetClass(raw: string): SlippageAssetClass {
  if (raw === "Forex") return "Forex";
  if (raw === "Metals") return "Metals";
  if (raw === "Indices") return "Indices";
  if (raw === "Crypto") return "Crypto";
  return "Unknown";
}

function tradingSession(now = new Date()) {
  const hour = now.getUTCHours();
  if (hour < 8) return "Asia";
  if (hour < 16) return "London";
  return "NY";
}

function ensureLiveThreshold(normalizedSymbol: string, brokerId: string, brokerName?: string): SlippageThreshold {
  const existing = state.thresholds.find((t) => t.normalizedSymbol === normalizedSymbol && (t.brokerId === brokerId || t.brokerId == null));
  if (existing) return existing;

  const norm = normalizeSymbol(normalizedSymbol);
  const assetClass = mapAssetClass(norm.assetClass);
  const limits =
    assetClass === "Metals"
      ? { normal: 0.35, warn: 0.9, crit: 1.8, block: 2.4, retry: 1.7 }
      : assetClass === "Indices"
        ? { normal: 0.4, warn: 1.0, crit: 2.0, block: 2.7, retry: 2.0 }
        : { normal: 0.2, warn: 0.5, crit: 1.0, block: 1.3, retry: 0.9 };

  const threshold: SlippageThreshold = {
    id: `thr-live-${normalizedSymbol}-${brokerId}`,
    symbol: null,
    normalizedSymbol,
    assetClass,
    brokerId,
    broker: brokerName ?? null,
    accountType: "All",
    strategyType: "All",
    tradingSession: "All",
    newsImpactLevel: "High",
    volatilityRegime: "Normal",
    normalLimitPips: limits.normal,
    warningLimitPips: limits.warn,
    criticalLimitPips: limits.crit,
    executionBlockLimitPips: limits.block,
    maxRetrySlippagePips: limits.retry,
    newsMultiplier: 1.6,
    autoDisableEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.thresholds.push(threshold);
  return threshold;
}

function pickThreshold(normalizedSymbol: string, brokerId: string, brokerName?: string) {
  const scoped = state.thresholds.find((t) => t.normalizedSymbol === normalizedSymbol && t.brokerId === brokerId);
  const fallback = state.thresholds.find((t) => t.normalizedSymbol === normalizedSymbol && t.brokerId == null);
  return scoped ?? fallback ?? state.thresholds[0] ?? ensureLiveThreshold(normalizedSymbol, brokerId, brokerName);
}

function buildWorkflowNodes(executions: SlippageExecution[], alerts: SlippageAlert[]): SlippageWorkflowNode[] {
  const total = executions.length;
  const breaches = alerts.filter((a) => a.severity !== "Info" && a.resolutionStatus !== "Resolved").length;
  const blocked = executions.filter((e) => !e.executionAllowed).length;
  const latest = alerts[0];
  const latestBreach = latest ? `${latest.alertType} · ${latest.normalizedSymbol}` : "—";
  const step = (title: string, status: SlippageWorkflowNode["status"], failedCount: number, delay: number, ai: string): SlippageWorkflowNode => ({
    title,
    status,
    orderCount: total,
    failedCount,
    averageDelayMs: delay,
    latestBreach,
    aiRecommendation: ai
  });

  return [
    step("Order Requested", "Healthy", 0, 22, "Ensure order request timestamps are accurate for latency correlation."),
    step("Price Captured", "Healthy", 0, 18, "Validate requested price capture and spread at request time."),
    step("MT5 Execution", blocked > 0 ? "Degraded" : total ? "Healthy" : "Watch", blocked, total ? 210 : 0, "Monitor MT5 execution feedback for latency spikes."),
    step("Executed Price Returned", total ? "Healthy" : "Watch", 0, total ? 165 : 0, "Compare across brokers when executed price drift appears."),
    step("Slippage Calculated", breaches > 0 ? "Watch" : total ? "Healthy" : "Watch", breaches, total ? 35 : 0, "Classify positive/negative slippage by direction."),
    step("Threshold Checked", breaches > 0 ? "Degraded" : total ? "Healthy" : "Watch", breaches, total ? 44 : 0, "Apply news multiplier and per-strategy limits."),
    step("Broker Compared", total ? "Healthy" : "Watch", 0, total ? 70 : 0, "Prefer brokers with better execution quality rank."),
    step("Risk Scored", breaches > 0 ? "Watch" : total ? "Healthy" : "Watch", breaches, total ? 55 : 0, "Escalate when negative slippage clusters on broker or session."),
    step("Unsafe Execution Blocked", blocked > 0 ? "Critical" : "Healthy", blocked, 20, "Keep blocked until quality normalizes below warning thresholds."),
    step("Audit Logged", "Healthy", 0, 10, "Ensure blocks and threshold changes are audit logged.")
  ];
}

export function ingestExecutionFromOrderRouter(input: {
  routeId: string;
  orderId: string;
  accountId: string;
  accountLogin: string;
  brokerId: string;
  brokerName: string;
  terminalId: string;
  terminalName: string;
  eaInstanceId: string;
  eaInstanceName: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  normalizedSymbol: string;
  direction: "Buy" | "Sell";
  orderType: "Market" | "Limit" | "Stop";
  requestedPrice: number;
  executedPrice?: number;
  executionTimeMs: number;
  executedAt: string;
  mt5Ticket?: string;
}) {
  const dedupeKey = `${input.orderId}:${input.mt5Ticket ?? input.executedAt}`;
  if (state.executions.some((e) => `${e.orderId}:${e.mt5Ticket ?? e.createdAt}` === dedupeKey)) {
    return state.executions.find((e) => `${e.orderId}:${e.mt5Ticket ?? e.createdAt}` === dedupeKey)!;
  }

  const norm = normalizeSymbol(input.normalizedSymbol || input.symbol);
  const meta = symbolMeta[norm.normalizedSymbol] ?? { digits: 5, pointSize: 0.00001, pointsPerPip: 10, pipValue: 10 };
  const threshold = ensureLiveThreshold(norm.normalizedSymbol, input.brokerId, input.brokerName);
  const executedAt = new Date(input.executedAt);
  const news = newsWindowActive(executedAt);
  const requestedPrice = Number(input.requestedPrice.toFixed(meta.digits));
  const executedPrice = Number((input.executedPrice ?? input.requestedPrice).toFixed(meta.digits));
  const slippagePoints = calculateSlippagePoints({
    direction: input.direction,
    requestedPrice,
    executedPrice,
    pointSize: meta.pointSize
  });
  const slippagePips = pointsToPips(slippagePoints, meta.pointsPerPip);
  const absPips = Math.abs(slippagePips);
  const breachStatus = breachStatusFromThreshold(absPips, threshold, news);
  const executionTimeMs = Math.max(0, input.executionTimeMs);
  const spreadAtExecution = norm.assetClass === "Indices" ? 1.2 : norm.normalizedSymbol === "XAUUSD" ? 1.5 : 0.8;
  const marketVolatilityScore = Math.min(100, Math.round(40 + executionTimeMs / 12 + absPips * 8));
  const qualityScore = Math.max(0, Math.min(100, Math.round(100 - absPips * 22 - executionTimeMs / 18 - spreadAtExecution * 4)));
  const executionQuality = qualityScore >= 86 ? "Excellent" : qualityScore >= 72 ? "Good" : qualityScore >= 55 ? "Degraded" : "Poor";
  const riskScore = Math.max(0, Math.min(100, 100 - qualityScore + (breachStatus === "Blocked" ? 25 : breachStatus === "Critical" ? 18 : breachStatus === "Warning" ? 9 : 0)));
  const riskLevel = riskLevelFromScore(riskScore);
  const blockDecision = shouldBlockExecution({
    breachStatus,
    newsWindowActive: news,
    volatilityScore: marketVolatilityScore,
    executionTimeMs,
    spreadAtExecution,
    peerBrokerMateriallyBetter: false,
    threshold
  });
  const executionAllowed = !state.unsafeExecutionDisabled && !(blockDecision.shouldBlock && threshold.autoDisableEnabled);
  const slippageValue = Number((slippagePips * meta.pipValue).toFixed(2));
  const directionAdjustedSlippage = classifySlippage(slippagePips) === "Negative" ? -Math.abs(slippagePips) : Math.abs(slippagePips);
  const executionId = `execution-${input.routeId}-${state.executions.length + 1}`;

  const execution: SlippageExecution = {
    id: `exec-${Date.now()}-${state.executions.length}`,
    executionId,
    orderId: input.orderId,
    tradeId: input.mt5Ticket ? `trade-${input.mt5Ticket}` : null,
    mt5Ticket: input.mt5Ticket ?? null,
    accountId: input.accountId,
    account: input.accountLogin,
    brokerId: input.brokerId,
    broker: input.brokerName,
    terminalId: input.terminalId,
    terminal: input.terminalName,
    eaInstanceId: input.eaInstanceId,
    eaInstance: input.eaInstanceName,
    strategyId: input.strategyId,
    strategy: input.strategyName,
    symbol: input.symbol,
    normalizedSymbol: norm.normalizedSymbol,
    assetClass: mapAssetClass(norm.assetClass),
    direction: input.direction,
    orderType: input.orderType,
    requestedPrice,
    executedPrice,
    slippagePoints,
    slippagePips,
    slippageValue,
    directionAdjustedSlippage,
    executionTimeMs,
    spreadAtExecution,
    marketVolatilityScore,
    tradingSession: tradingSession(executedAt),
    newsWindowActive: news,
    thresholdId: threshold.id,
    thresholdValue: threshold.warningLimitPips,
    breachStatus,
    executionQualityScore: qualityScore,
    executionQuality,
    riskLevel,
    executionAllowed,
    createdAt: input.executedAt
  };

  state.executions.unshift(execution);
  state.executions = state.executions.slice(0, 500);
  state.trends.unshift({
    measuredAt: input.executedAt,
    brokerId: input.brokerId,
    broker: input.brokerName,
    normalizedSymbol: norm.normalizedSymbol,
    strategy: input.strategyName,
    tradingSession: tradingSession(executedAt),
    slippagePips,
    executionTimeMs,
    spreadAtExecution
  });
  state.trends = state.trends.slice(0, 300);
  addLog({
    timestamp: new Date().toISOString(),
    eventType: "Execution Feedback",
    severity: breachStatus === "Critical" || breachStatus === "Blocked" ? "Critical" : breachStatus === "Warning" ? "Warning" : "Info",
    executionId,
    orderId: input.orderId,
    brokerId: input.brokerId,
    symbol: norm.normalizedSymbol,
    message: "Execution ingested from order-router feedback.",
    statusBefore: "Pending",
    statusAfter: executionAllowed ? "Allowed" : "Blocked",
    slippagePips,
    executionAllowed,
    actionTaken: executionAllowed ? "Monitor" : "Block"
  });
  recomputeDerived(executedAt);
  return execution;
}

function upsertAlert(alert: SlippageAlert) {
  const existing = state.alerts.find(
    (a) =>
      a.executionId === alert.executionId &&
      a.alertType === alert.alertType &&
      a.resolutionStatus !== "Resolved"
  );
  if (existing) return existing;
  state.alerts.unshift(alert);
  state.alerts = state.alerts.slice(0, 200);
  return alert;
}

function recomputeDerived(now = new Date()) {
  const globalNews = newsWindowActive(now);
  const comparisons = buildBrokerComparison(state.executions);
  state.brokerComparison = comparisons;

  const bestBySymbol = new Map<string, BrokerSlippageComparisonRow>();
  for (const row of comparisons) {
    const key = row.normalizedSymbol;
    const prev = bestBySymbol.get(key);
    if (!prev || row.executionQualityRank > prev.executionQualityRank) bestBySymbol.set(key, row);
  }

  state.executions = state.executions.map((e) => {
    const threshold = pickThreshold(e.normalizedSymbol, e.brokerId, e.broker);
    const news = e.newsWindowActive || globalNews;
    const absPips = Math.abs(e.slippagePips);
    const breachStatus = breachStatusFromThreshold(absPips, threshold, news);

    const best = bestBySymbol.get(e.normalizedSymbol);
    const peerBetter = Boolean(best && best.brokerId !== e.brokerId && best.executionQualityRank - e.executionQualityScore >= 18);

    const blockDecision = shouldBlockExecution({
      breachStatus,
      newsWindowActive: news,
      volatilityScore: e.marketVolatilityScore,
      executionTimeMs: e.executionTimeMs,
      spreadAtExecution: e.spreadAtExecution,
      peerBrokerMateriallyBetter: peerBetter,
      threshold
    });

    const executionAllowed = !state.unsafeExecutionDisabled && !(blockDecision.shouldBlock && threshold.autoDisableEnabled);
    const qualityScore = e.executionQualityScore;
    const risk = Math.min(100, Math.round((breachStatus === "Blocked" ? 28 : breachStatus === "Critical" ? 18 : breachStatus === "Warning" ? 9 : 0) + Math.max(0, 70 - qualityScore) + e.executionTimeMs / 45 + e.spreadAtExecution * 3));
    const riskScore = Math.max(0, Math.min(100, 100 - risk));
    const riskLevel = riskLevelFromScore(riskScore);

    const next: SlippageExecution = {
      ...e,
      thresholdId: threshold.id,
      thresholdValue: threshold.warningLimitPips,
      breachStatus: state.unsafeExecutionDisabled ? "Blocked" : breachStatus,
      executionAllowed,
      riskLevel
    };

    if (next.breachStatus === "Warning" || next.breachStatus === "Critical" || next.breachStatus === "Blocked" || !executionAllowed) {
      const type: SlippageAlert["alertType"] =
        !executionAllowed || next.breachStatus === "Blocked"
          ? "Execution Blocked"
          : news
            ? "News Driven"
            : e.marketVolatilityScore > 85
              ? "Volatility Driven"
              : peerBetter
                ? "Broker Issue"
                : next.breachStatus === "Critical"
                  ? "Critical"
                  : "Warning";
      const severity: SlippageAlert["severity"] = type === "Execution Blocked" || next.breachStatus === "Critical" ? "Critical" : "Warning";
      const thresholdValue = type === "Execution Blocked" ? threshold.executionBlockLimitPips : next.breachStatus === "Critical" ? threshold.criticalLimitPips : threshold.warningLimitPips;
      const rootCause =
        type === "News Driven"
          ? "News-driven liquidity expansion."
          : type === "Volatility Driven"
            ? "Volatility-driven execution cost drift."
            : type === "Broker Issue"
              ? "Broker-specific slippage deterioration vs peers."
              : "Slippage breached configured limits.";
      const aiExplanation = executionAllowed ? "Monitor and compare peer brokers; reduce exposure if persistent." : `Execution blocked: ${blockDecision.reasons.slice(0, 3).join("; ")}.`;

      upsertAlert(
        createSlippageAlert({
          execution: next,
          type,
          severity,
          thresholdValuePips: thresholdValue,
          executionBlocked: !executionAllowed,
          rootCause,
          aiExplanation
        })
      );

      addLog({
        timestamp: new Date().toISOString(),
        eventType: !executionAllowed ? "Execution Block" : "Slippage Alert",
        severity,
        executionId: next.executionId,
        orderId: next.orderId,
        brokerId: next.brokerId,
        symbol: next.normalizedSymbol,
        message: !executionAllowed ? "Execution blocked due to slippage safety controls." : "Slippage breach detected.",
        statusBefore: e.executionAllowed ? "Allowed" : "Blocked",
        statusAfter: executionAllowed ? "Allowed" : "Blocked",
        slippagePips: next.slippagePips,
        executionAllowed,
        actionTaken: !executionAllowed ? "Block" : "Alert"
      });
    }

    return next;
  });

  const diagnostics: AiSlippageDiagnostic[] = state.executions
    .filter((e) => e.breachStatus !== "Normal" || !e.executionAllowed || e.executionQualityScore < 60 || e.slippagePips < -0.05)
    .slice(0, 25)
    .map((e, idx): AiSlippageDiagnostic => ({
      id: `ai-${idx + 1}-${e.executionId}`,
      issue: !e.executionAllowed ? "Unsafe execution blocked" : e.slippagePips < -0.05 ? "Abnormal negative slippage" : "Execution quality deterioration",
      affected: `${e.executionId} · ${e.normalizedSymbol} · ${e.broker}`,
      severity: !e.executionAllowed || e.breachStatus === "Critical" || e.breachStatus === "Blocked" ? "Critical" : "Warning",
      rootCause: e.newsWindowActive ? "News-driven slippage expansion." : e.executionTimeMs > 850 ? "Latency-driven slippage." : "Broker execution drift.",
      tradingImpact: "Slippage increases execution cost and can flip expected trade expectancy.",
      recommendedAction: !e.executionAllowed ? "Keep blocked and route to alternate broker if available." : "Compare peers and reduce exposure.",
      autoBlockRecommendation: e.breachStatus === "Critical" || e.breachStatus === "Blocked" || e.executionQualityScore < 55,
      confidenceScore: Math.min(96, Math.max(55, Math.round(100 - e.executionQualityScore)))
    }));
  state.aiDiagnostics = diagnostics;
}

export function summary(role: Mt5Role): SlippageMonitorSummaryResponse {
  recomputeDerived(new Date());
  const executions = state.executions;
  const total = executions.length;
  const positive = executions.filter((e) => e.slippagePips > 0.05).length;
  const negative = executions.filter((e) => e.slippagePips < -0.05).length;
  const avgSlip = total ? executions.reduce((s, e) => s + e.slippagePips, 0) / total : 0;
  const worst = [...executions].sort((a, b) => Math.abs(b.slippagePips) - Math.abs(a.slippagePips))[0];
  const breaches = executions.filter((e) => e.breachStatus === "Warning" || e.breachStatus === "Critical" || e.breachStatus === "Blocked").length;
  const blocked = executions.filter((e) => !e.executionAllowed).length;
  const avgExec = total ? executions.reduce((s, e) => s + e.executionTimeMs, 0) / total : 0;
  const execQuality = total ? executions.reduce((s, e) => s + e.executionQualityScore, 0) / total : 0;

  const risk = Math.min(100, Math.round(blocked * 12 + breaches * 2 + Math.max(0, 70 - execQuality) + avgExec / 40));
  const slippageScore = slippageRiskScore({
    thresholdBreachScore: Math.min(30, breaches * 0.5 + blocked * 2.5),
    negativeSlippageScore: Math.min(18, (negative / Math.max(1, total)) * 30),
    brokerComparisonScore: Math.min(15, state.brokerComparison.length ? (100 - state.brokerComparison[0]!.executionQualityRank) / 5 : 8),
    latencyImpactScore: Math.min(15, avgExec / 80),
    spreadImpactScore: Math.min(12, executions.reduce((s, e) => s + e.spreadAtExecution, 0) / Math.max(1, total)),
    volatilityImpactScore: Math.min(10, executions.reduce((s, e) => s + e.marketVolatilityScore, 0) / Math.max(1, total) / 10)
  });
  const qualityScore: ScoreResult = {
    score: Math.round(execQuality),
    rating: execQuality >= 90 ? "Excellent" : execQuality >= 75 ? "Healthy" : execQuality >= 60 ? "Degraded" : execQuality >= 40 ? "High Risk" : "Critical",
    factors: { risk }
  };

  const kpis: SlippageMonitorSummaryResponse["kpis"] = [
    { label: "Total Executed Orders", value: String(total), status: "Healthy", detail: "Executions sampled in the current window", updatedAt: new Date().toISOString() },
    { label: "Orders With Positive Slippage", value: String(positive), status: "Healthy", detail: "Executed better than requested", updatedAt: new Date().toISOString() },
    { label: "Orders With Negative Slippage", value: String(negative), status: negative > 0 ? "Watch" : "Healthy", detail: "Executed worse than requested", updatedAt: new Date().toISOString() },
    { label: "Average Slippage", value: `${avgSlip.toFixed(2)} pips`, status: Math.abs(avgSlip) > 0.9 ? "Degraded" : "Healthy", detail: "Mean signed slippage (pips)", updatedAt: new Date().toISOString() },
    { label: "Worst Slippage Symbol", value: worst?.normalizedSymbol ?? "—", status: worst && Math.abs(worst.slippagePips) > 1.8 ? "Critical" : "Watch", detail: worst ? `${worst.slippagePips.toFixed(2)} pips` : "—", updatedAt: new Date().toISOString() },
    { label: "Worst Slippage Broker", value: state.brokerComparison.slice(-1)[0]?.broker ?? "—", status: "Watch", detail: "Derived from broker quality ranks", updatedAt: new Date().toISOString() },
    { label: "Best Execution Broker", value: state.brokerComparison[0]?.broker ?? "—", status: "Healthy", detail: state.brokerComparison[0] ? `${state.brokerComparison[0]!.executionQualityRank}/100` : "—", updatedAt: new Date().toISOString() },
    { label: "Slippage Breach Count", value: String(breaches), status: breaches > 0 ? "Degraded" : "Healthy", detail: "Warning/Critical/Blocked", updatedAt: new Date().toISOString() },
    { label: "Blocked Executions", value: String(blocked), status: blocked > 0 ? "Critical" : "Healthy", detail: "Blocked by slippage safety controls", updatedAt: new Date().toISOString() },
    { label: "Average Execution Time", value: `${Math.round(avgExec)}ms`, status: avgExec > 800 ? "Degraded" : avgExec > 450 ? "Watch" : "Healthy", detail: "Latency across executions", updatedAt: new Date().toISOString() },
    { label: "Execution Quality Score", value: `${Math.round(execQuality)}/100`, status: execQuality >= 75 ? "Healthy" : execQuality >= 60 ? "Degraded" : "Critical", detail: qualityScore.rating, updatedAt: new Date().toISOString() },
    { label: "Slippage Risk Score", value: `${slippageScore.score}/100`, status: slippageScore.score >= 75 ? "Healthy" : slippageScore.score >= 60 ? "Degraded" : "Critical", detail: slippageScore.rating, updatedAt: new Date().toISOString() }
  ];

  return { meta: { timestamp: new Date().toISOString(), currentRole: role, streamEndpoint: "/api/mt5/slippage-monitor/events-stream" }, kpis, slippageRiskScore: slippageScore, executionQualityScore: qualityScore };
}

export function workflow(): WorkflowResponse {
  recomputeDerived(new Date());
  const nodes = state.workflow.length ? state.workflow : buildWorkflowNodes(state.executions, state.alerts);
  return { meta: { timestamp: new Date().toISOString() }, workflow: nodes };
}

export function executions(params: { search?: string; assetClass?: string; breach?: string; brokerId?: string; page?: number; pageSize?: number }): ExecutionsResponse {
  recomputeDerived(new Date());
  const search = params.search?.trim().toLowerCase() ?? "";
  const asset = params.assetClass ?? "all";
  const breach = params.breach ?? "all";
  const brokerId = params.brokerId ?? "all";

  const filtered = state.executions.filter((e) => {
    const matchesSearch =
      !search ||
      [e.executionId, e.orderId, e.mt5Ticket ?? "", e.account, e.broker, e.terminal, e.eaInstance, e.symbol, e.normalizedSymbol, e.strategy, e.breachStatus, e.riskLevel]
        .join(" ")
        .toLowerCase()
        .includes(search);
    const matchesAsset = asset === "all" ? true : e.assetClass === asset;
    const matchesBreach = breach === "all" ? true : e.breachStatus === breach || e.riskLevel === breach;
    const matchesBroker = brokerId === "all" ? true : e.brokerId === brokerId;
    return matchesSearch && matchesAsset && matchesBreach && matchesBroker;
  });

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 75;
  const start = (page - 1) * pageSize;
  return { meta: { timestamp: new Date().toISOString(), total: filtered.length, page, pageSize }, executions: filtered.slice(start, start + pageSize) };
}

export function executionDetail(executionId: string): ExecutionResponse {
  recomputeDerived(new Date());
  const decoded = decodeURIComponent(executionId);
  const found = state.executions.find((e) => e.executionId === decoded || e.id === decoded);
  if (!found) throw new Error("Execution not found.");
  return { meta: { timestamp: new Date().toISOString() }, execution: found };
}

export function brokerComparison(): BrokerComparisonResponse {
  recomputeDerived(new Date());
  return { meta: { timestamp: new Date().toISOString(), total: state.brokerComparison.length }, comparisons: state.brokerComparison };
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

  const next: SlippageThreshold = {
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
    executionId: "ALL",
    orderId: "ALL",
    brokerId: next.brokerId ?? "ALL",
    symbol: next.normalizedSymbol,
    message: "Slippage threshold created.",
    statusBefore: "—",
    statusAfter: "Created",
    slippagePips: 0,
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

  const next = { ...old, ...patch, updatedAt: new Date().toISOString() } satisfies SlippageThreshold;
  state.thresholds[idx] = next;
  audit(role, "Threshold updated", thresholdId, old, next, request);
  addLog({
    timestamp: new Date().toISOString(),
    eventType: "Threshold Update",
    severity: isCriticalThresholdUpdate(patch) ? "Warning" : "Info",
    executionId: "ALL",
    orderId: "ALL",
    brokerId: next.brokerId ?? "ALL",
    symbol: next.normalizedSymbol,
    message: "Slippage threshold updated.",
    statusBefore: old.updatedAt,
    statusAfter: next.updatedAt,
    slippagePips: 0,
    executionAllowed: true,
    actionTaken: "Update"
  });
  return action(true, "Threshold updated.", [thresholdId]);
}

export function diagnostics(role: Mt5Role, request?: Request) {
  authorize(role, "diagnostics");
  addLog({
    timestamp: new Date().toISOString(),
    eventType: "Diagnostics",
    severity: "Info",
    executionId: "ALL",
    orderId: "ALL",
    brokerId: "ALL",
    symbol: "ALL",
    message: "Slippage diagnostics executed across brokers and symbols.",
    statusBefore: "—",
    statusAfter: "—",
    slippagePips: 0,
    executionAllowed: true,
    actionTaken: "Diagnostics"
  });
  audit(role, "Run slippage diagnostics", "slippage-monitor", null, { rows: state.executions.length }, request);
  return action(true, "Diagnostics completed.");
}

export function disableUnsafeExecution(role: Mt5Role, request?: Request) {
  authorize(role, "disableUnsafe");
  const old = state.unsafeExecutionDisabled;
  state.unsafeExecutionDisabled = true;
  audit(role, "Disable unsafe execution", "slippage-monitor", old, true, request);
  addLog({
    timestamp: new Date().toISOString(),
    eventType: "Unsafe Execution Disable",
    severity: "Critical",
    executionId: "ALL",
    orderId: "ALL",
    brokerId: "ALL",
    symbol: "ALL",
    message: "Unsafe execution disabled by operator.",
    statusBefore: old ? "Disabled" : "Enabled",
    statusAfter: "Disabled",
    slippagePips: 0,
    executionAllowed: false,
    actionTaken: "Disable"
  });
  recomputeDerived(new Date());
  return action(true, "Unsafe execution disabled.");
}

export function alerts(filter?: string): AlertsResponse {
  recomputeDerived(new Date());
  const normalized = filter?.trim().toLowerCase() ?? "";
  const filtered = normalized
    ? state.alerts.filter((a) => [a.alertType, a.severity, a.resolutionStatus, a.broker, a.normalizedSymbol].join(" ").toLowerCase().includes(normalized))
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
  return { meta: { timestamp: new Date().toISOString(), total: state.aiDiagnostics.length }, diagnostics: state.aiDiagnostics };
}

export function autoRemediate(role: Mt5Role, request?: Request) {
  authorize(role, "autoRemediate");
  recomputeDerived(new Date());
  const affected = [...new Set(state.executions.filter((e) => e.breachStatus === "Critical" || e.breachStatus === "Blocked").map((e) => `${e.normalizedSymbol}:${e.broker}`))].slice(0, 12);
  addLog({
    timestamp: new Date().toISOString(),
    eventType: "Auto-Remediate",
    severity: affected.length ? "Warning" : "Info",
    executionId: "ALL",
    orderId: "ALL",
    brokerId: "ALL",
    symbol: "ALL",
    message: affected.length ? "Auto-remediation suggested: route away from poor execution brokers/symbols and keep blocks until normal." : "No remediation required.",
    statusBefore: "—",
    statusAfter: "—",
    slippagePips: 0,
    executionAllowed: true,
    actionTaken: "Recommend"
  });
  audit(role, "Auto-remediate executed", "slippage-monitor", null, { affected }, request);
  return action(true, affected.length ? "Auto-remediation suggestions generated." : "No remediation required.", affected);
}
