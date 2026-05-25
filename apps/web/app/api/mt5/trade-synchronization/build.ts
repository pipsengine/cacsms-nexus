import type {
  AiDiagnosticsResponse,
  AiTradeSyncDiagnostic,
  TradeReconciliationComparison,
  TradeReconciliationResponse,
  TradeSyncLogEntry,
  TradeSyncLogsResponse,
  TradeSyncSummaryResponse,
  TradeSyncTrade,
  TradeSyncTradesResponse,
  TradeSyncWorkflowStep
} from "@/modules/mt5-infrastructure-and-broker-connectivity/trade-synchronization/types/trade-synchronization.types";

import { getMockDiagnostics, getMockLogs } from "@/modules/mt5-infrastructure-and-broker-connectivity/trade-synchronization/data/trade-synchronization.mock";

import { calculateTradeSyncHealthScore } from "./algorithms/trade-sync-health-score.algorithm";
import { detectMissingCloseEvents } from "./algorithms/missing-close-event-detection.algorithm";
import { detectPartialFills } from "./algorithms/partial-fill-detection.algorithm";
import { matchTradeState } from "./algorithms/trade-state-matching.algorithm";
import { getTradeSyncState, listRuntimeLogs, listTrades } from "./store";

function nowIso() {
  return new Date().toISOString();
}

function buildWorkflow(trades: TradeSyncTrade[]): TradeSyncWorkflowStep[] {
  const missingTickets = trades.filter((t) => !t.mt5Ticket).length;
  const partialFills = detectPartialFills(trades).length;
  const missingClose = detectMissingCloseEvents(trades).length;
  const failedSync = trades.filter((t) => t.syncStatus === "Failed Sync").length;

  const step = (
    key: TradeSyncWorkflowStep["key"],
    label: string,
    status: TradeSyncWorkflowStep["status"],
    tradeCount: number,
    failedCount: number,
    averageDelaySeconds: number,
    aiRecommendation: string
  ): TradeSyncWorkflowStep => ({
    key,
    label,
    status,
    tradeCount,
    failedCount,
    averageDelaySeconds,
    lastEventTime: nowIso(),
    aiRecommendation
  });

  const avgDelay = Math.round(trades.reduce((s, t) => s + t.syncDelaySeconds, 0) / Math.max(1, trades.length));

  return [
    step("orderRouted", "Order Routed", "Operational", trades.length, 0, avgDelay, "Keep routing within audit boundaries."),
    step(
      "mt5TicketCreated",
      "MT5 Ticket Created",
      missingTickets > 0 ? "Blocked" : "Operational",
      trades.length - missingTickets,
      missingTickets,
      avgDelay,
      missingTickets > 0 ? "Freeze unsafe sync; ticket creation missing for routed orders." : "Ticket creation stable."
    ),
    step("executionFeedbackReceived", "Execution Feedback Received", "Monitoring", trades.length, 0, avgDelay, "Verify execution feedback latency in realtime mode."),
    step("positionSynced", "Position Synced", failedSync > 0 ? "Degraded" : "Operational", trades.length, failedSync, avgDelay, "Reconcile failed sync positions first."),
    step("slTpSynced", "SL/TP Synced", "Monitoring", trades.length, 0, avgDelay, "Validate SL/TP updates and broker-side overrides."),
    step("modificationSynced", "Modification Synced", "Monitoring", trades.length, 0, avgDelay, "Monitor modification integrity sequence and sources."),
    step(
      "partialFillChecked",
      "Partial Fill Checked",
      partialFills > 0 ? "Degraded" : "Operational",
      partialFills,
      0,
      avgDelay,
      partialFills > 0 ? "Update lifecycle with partial fill events and re-evaluate exposure." : "No partial fill drift detected."
    ),
    step(
      "closeEventSynced",
      "Close Event Synced",
      missingClose > 0 ? "Degraded" : "Operational",
      trades.filter((t) => t.tradeStatus === "Closed").length,
      missingClose,
      avgDelay,
      missingClose > 0 ? "Trigger missing close event detection and reconcile P/L." : "Close events consistent."
    ),
    step("plReconciled", "P/L Reconciled", "Monitoring", trades.length, 0, avgDelay, "Reconcile P/L after commission and swap."),
    step("auditLogged", "Audit Logged", "Operational", trades.length, 0, avgDelay, "All sync actions must be audit logged.")
  ];
}

export function buildSummary(): TradeSyncSummaryResponse {
  const state = getTradeSyncState();
  const trades = listTrades();

  const active = trades.filter((t) => t.tradeStatus === "Open" || t.tradeStatus === "Partially Filled").length;
  const synced = trades.filter((t) => t.syncStatus === "Synced").length;
  const pendingSync = trades.filter((t) => t.syncStatus === "Pending Sync").length;
  const failedSync = trades.filter((t) => t.syncStatus === "Failed Sync").length;
  const mismatches = trades.filter((t) => t.stateMatchStatus !== "Matched").length;
  const pendingOrders = trades.filter((t) => t.tradeStatus === "Pending").length;
  const closedToday = trades.filter((t) => t.tradeStatus === "Closed").length;
  const partialFills = trades.filter((t) => t.tradeStatus === "Partially Filled").length;
  const modificationEvents = 18;
  const averageSyncDelaySeconds = Math.round(trades.reduce((s, t) => s + t.syncDelaySeconds, 0) / Math.max(1, trades.length));

  const health = calculateTradeSyncHealthScore(trades);

  return {
    meta: { timestamp: nowIso(), environment: "Development", frozen: state.frozen },
    kpis: {
      totalActiveTrades: active,
      syncedTrades: synced,
      pendingSync,
      failedSync,
      tradeStateMismatches: mismatches,
      openPositions: active,
      pendingOrders,
      closedTradesToday: closedToday,
      partialFills,
      modificationEvents,
      averageSyncDelaySeconds,
      tradeSyncHealthScore: health
    },
    workflow: buildWorkflow(trades)
  };
}

export function buildTrades(params: { search?: string; status?: string; page?: number; pageSize?: number }): TradeSyncTradesResponse {
  const trades = listTrades();
  const search = params.search?.trim().toLowerCase() ?? "";
  const status = params.status ?? "all";

  const filtered = trades.filter((t) => {
    const matchesSearch =
      !search ||
      [t.tradeId, t.mt5Ticket ?? "", t.orderId ?? "", t.symbol, t.account, t.broker, t.terminal, t.syncStatus, t.tradeStatus, t.stateMatchStatus].some(
        (v) => v.toLowerCase().includes(search)
      );
    const matchesStatus = status === "all" ? true : t.syncStatus === status || t.tradeStatus === status || t.stateMatchStatus === status;
    return matchesSearch && matchesStatus;
  });

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;
  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return { meta: { timestamp: nowIso(), total: filtered.length, page, pageSize }, trades: paged };
}

export function buildLogs(filter?: string): TradeSyncLogsResponse {
  const logs = [...listRuntimeLogs(), ...getMockLogs()];
  const normalized = filter?.trim().toLowerCase() ?? "";
  const filtered = normalized
    ? logs.filter(
        (l) =>
          l.exceptionType.toLowerCase().includes(normalized) ||
          l.severity.toLowerCase().includes(normalized) ||
          l.rootCause.toLowerCase().includes(normalized) ||
          l.errorMessage.toLowerCase().includes(normalized)
      )
    : logs;

  return { meta: { timestamp: nowIso(), total: filtered.length }, logs: filtered };
}

export function buildExceptions(filter?: string): TradeSyncLogsResponse {
  const logs = buildLogs(filter).logs;
  const filtered = logs.filter((l) => l.resolutionStatus !== "Resolved");
  return { meta: { timestamp: nowIso(), total: filtered.length }, logs: filtered };
}

export function buildAiDiagnostics(): AiDiagnosticsResponse {
  const base = getMockDiagnostics();
  const trades = listTrades();

  const derived: AiTradeSyncDiagnostic[] = trades
    .map((t) => {
      const match = matchTradeState(t);
      if (match.status === "Matched") return null;
      return {
        id: `diag_${t.tradeId}`,
        issue: match.issues[0] ?? "State mismatch",
        affectedTradeId: t.tradeId,
        affectedTicket: t.mt5Ticket,
        severity: match.status === "Material Difference" ? "Critical" : "Warning",
        rootCause: match.issues.join(" "),
        tradingImpact: "State drift risk between Nexus and MT5 impacts reconciliation and risk controls.",
        recommendedAction: match.status === "Material Difference" ? "Freeze sync and reconcile immediately." : "Reconcile trade and refresh execution feedback.",
        autoFixEligible: match.status !== "Material Difference",
        confidenceScore: match.score
      } satisfies AiTradeSyncDiagnostic;
    })
    .filter(Boolean) as AiTradeSyncDiagnostic[];

  return {
    meta: { timestamp: nowIso() },
    diagnostics: [...base.diagnostics, ...derived].slice(0, 25)
  };
}

export function buildReconciliation(tradeId?: string): TradeReconciliationResponse {
  const trade = tradeId ? listTrades().find((t) => t.tradeId === tradeId) ?? null : null;
  const comparisons: TradeReconciliationComparison[] = [];

  if (!trade) {
    return { meta: { timestamp: nowIso() }, tradeId: tradeId ?? null, comparisons: [] };
  }

  const match = matchTradeState(trade);
  const status = match.status;

  comparisons.push({
    key: "state",
    label: "Trade state",
    nexusValue: trade.nexusState,
    mt5Value: trade.mt5State,
    difference: trade.nexusState === trade.mt5State ? "—" : `${trade.nexusState} vs ${trade.mt5State}`,
    status,
    requiredAction: trade.nexusState === trade.mt5State ? "None" : "Reconcile state and apply missing lifecycle events."
  });

  comparisons.push({
    key: "volume",
    label: "Volume",
    nexusValue: String(trade.volumeRequested),
    mt5Value: String(trade.volumeFilled),
    difference: `${trade.volumeFilled - trade.volumeRequested}`,
    status: trade.volumeFilled === trade.volumeRequested ? "Matched" : "Requires Review",
    requiredAction: trade.volumeFilled === trade.volumeRequested ? "None" : "Update partial fill lifecycle and exposure."
  });

  comparisons.push({
    key: "entryPrice",
    label: "Entry price",
    nexusValue: String(trade.entryPrice),
    mt5Value: String(trade.entryPrice),
    difference: "—",
    status: "Matched",
    requiredAction: "None"
  });

  comparisons.push({
    key: "stopLoss",
    label: "Stop loss",
    nexusValue: trade.stopLoss == null ? "—" : String(trade.stopLoss),
    mt5Value: trade.stopLoss == null ? "—" : String(trade.stopLoss),
    difference: "—",
    status: "Matched",
    requiredAction: "None"
  });

  comparisons.push({
    key: "takeProfit",
    label: "Take profit",
    nexusValue: trade.takeProfit == null ? "—" : String(trade.takeProfit),
    mt5Value: trade.takeProfit == null ? "—" : String(trade.takeProfit),
    difference: "—",
    status: "Matched",
    requiredAction: "None"
  });

  comparisons.push({
    key: "closePrice",
    label: "Close price",
    nexusValue: trade.closePrice == null ? "—" : String(trade.closePrice),
    mt5Value: trade.closePrice == null ? "—" : String(trade.closePrice),
    difference: "—",
    status: trade.mt5State === "CLOSED" && !trade.closeTime ? "Requires Review" : "Matched",
    requiredAction: trade.mt5State === "CLOSED" && !trade.closeTime ? "Capture missing close event and reconcile P/L." : "None"
  });

  comparisons.push({
    key: "profitLoss",
    label: "Profit/Loss",
    nexusValue: String(trade.netProfitLoss),
    mt5Value: String(trade.netProfitLoss),
    difference: "—",
    status: trade.tradeStatus === "Closed" ? "Matched" : "Requires Review",
    requiredAction: trade.tradeStatus === "Closed" ? "None" : "Reconcile after closure."
  });

  comparisons.push({
    key: "commissionSwap",
    label: "Commission + swap",
    nexusValue: String(trade.commission + trade.swap),
    mt5Value: String(trade.commission + trade.swap),
    difference: "—",
    status: "Matched",
    requiredAction: "None"
  });

  comparisons.push({
    key: "orderStatus",
    label: "Order status",
    nexusValue: trade.tradeStatus,
    mt5Value: trade.mt5State,
    difference: trade.tradeStatus === trade.mt5State ? "—" : `${trade.tradeStatus} vs ${trade.mt5State}`,
    status: status === "Matched" ? "Matched" : "Requires Review",
    requiredAction: status === "Matched" ? "None" : "Reconcile order status and ticket mapping."
  });

  return { meta: { timestamp: nowIso() }, tradeId: trade.tradeId, comparisons };
}
