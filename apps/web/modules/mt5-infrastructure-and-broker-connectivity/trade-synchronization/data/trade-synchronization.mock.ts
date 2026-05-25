import type {
  AiDiagnosticsResponse,
  AiTradeSyncDiagnostic,
  TradeLifecycleEvent,
  TradeModification,
  TradeSyncLogEntry,
  TradeSyncTrade
} from "../types/trade-synchronization.types";

function isoNow(offsetSeconds = 0) {
  return new Date(Date.now() + offsetSeconds * 1000).toISOString();
}

function makeId(prefix: string, n: number) {
  return `${prefix}_${String(n).padStart(4, "0")}`;
}

export function getMockTrades(): TradeSyncTrade[] {
  const now = Date.now();
  const base: TradeSyncTrade[] = [
    {
      tradeId: "trd_001",
      mt5Ticket: "45811234",
      orderId: "ord_901",
      signalId: "sig_2201",
      strategyId: "strat_inst_momentum",
      account: "FTMO Challenge - Demo",
      broker: "MockBroker",
      terminal: "MT5-Terminal-1",
      eaInstance: "EA-Instance-A",
      symbol: "XAUUSD",
      normalizedSymbol: "XAUUSD",
      direction: "Buy",
      orderType: "Market",
      volumeRequested: 1.0,
      volumeFilled: 1.0,
      entryPrice: 2321.45,
      currentPrice: 2324.12,
      stopLoss: 2312.0,
      takeProfit: 2338.0,
      closePrice: null,
      tradeStatus: "Open",
      nexusState: "OPEN",
      mt5State: "OPEN",
      syncStatus: "Synced",
      stateMatchStatus: "Matched",
      floatingProfitLoss: 267.0,
      realizedProfitLoss: 0,
      swap: -0.4,
      commission: -2.5,
      netProfitLoss: 264.1,
      marginUsed: 1200,
      openTime: new Date(now - 45 * 60 * 1000).toISOString(),
      closeTime: null,
      lastMt5UpdateAt: isoNow(-12),
      lastNexusUpdateAt: isoNow(-18),
      lastSyncAt: isoNow(-10),
      syncDelaySeconds: 8,
      riskLevel: "Moderate"
    },
    {
      tradeId: "trd_002",
      mt5Ticket: "45811555",
      orderId: "ord_902",
      signalId: "sig_2202",
      strategyId: "strat_mean_reversion",
      account: "FTMO Challenge - Demo",
      broker: "MockBroker",
      terminal: "MT5-Terminal-1",
      eaInstance: "EA-Instance-A",
      symbol: "EURUSD",
      normalizedSymbol: "EURUSD",
      direction: "Sell",
      orderType: "Limit",
      volumeRequested: 0.5,
      volumeFilled: 0.2,
      entryPrice: 1.0844,
      currentPrice: 1.0841,
      stopLoss: 1.088,
      takeProfit: 1.078,
      closePrice: null,
      tradeStatus: "Partially Filled",
      nexusState: "PARTIAL",
      mt5State: "PARTIAL",
      syncStatus: "Pending Sync",
      stateMatchStatus: "Minor Difference",
      floatingProfitLoss: 18.0,
      realizedProfitLoss: 0,
      swap: 0,
      commission: -0.8,
      netProfitLoss: 17.2,
      marginUsed: 240,
      openTime: new Date(now - 22 * 60 * 1000).toISOString(),
      closeTime: null,
      lastMt5UpdateAt: isoNow(-33),
      lastNexusUpdateAt: isoNow(-65),
      lastSyncAt: isoNow(-92),
      syncDelaySeconds: 59,
      riskLevel: "High"
    },
    {
      tradeId: "trd_003",
      mt5Ticket: null,
      orderId: "ord_903",
      signalId: "sig_2203",
      strategyId: "strat_breakout",
      account: "FTMO Challenge - Demo",
      broker: "MockBroker",
      terminal: "MT5-Terminal-1",
      eaInstance: "EA-Instance-A",
      symbol: "NAS100",
      normalizedSymbol: "NAS100",
      direction: "Buy",
      orderType: "Stop",
      volumeRequested: 1.0,
      volumeFilled: 0.0,
      entryPrice: 0,
      currentPrice: 18452.2,
      stopLoss: null,
      takeProfit: null,
      closePrice: null,
      tradeStatus: "Pending",
      nexusState: "ROUTED",
      mt5State: "MISSING_TICKET",
      syncStatus: "Failed Sync",
      stateMatchStatus: "Missing in MT5",
      floatingProfitLoss: 0,
      realizedProfitLoss: 0,
      swap: 0,
      commission: 0,
      netProfitLoss: 0,
      marginUsed: 0,
      openTime: new Date(now - 8 * 60 * 1000).toISOString(),
      closeTime: null,
      lastMt5UpdateAt: isoNow(-999),
      lastNexusUpdateAt: isoNow(-44),
      lastSyncAt: isoNow(-360),
      syncDelaySeconds: 316,
      riskLevel: "Critical"
    }
  ];

  for (let i = 4; i <= 18; i += 1) {
    const active = i % 3 !== 0;
    const mismatch = i % 5 === 0;
    const pending = i % 4 === 0;
    base.push({
      tradeId: makeId("trd", i),
      mt5Ticket: active ? String(45812000 + i) : String(45811000 + i),
      orderId: makeId("ord", 900 + i),
      signalId: makeId("sig", 2200 + i),
      strategyId: i % 2 === 0 ? "strat_institutional_bias" : "strat_scalp",
      account: "FTMO Challenge - Demo",
      broker: "MockBroker",
      terminal: "MT5-Terminal-1",
      eaInstance: "EA-Instance-B",
      symbol: i % 2 === 0 ? "GBPUSD" : "USDJPY",
      normalizedSymbol: i % 2 === 0 ? "GBPUSD" : "USDJPY",
      direction: i % 2 === 0 ? "Buy" : "Sell",
      orderType: i % 3 === 0 ? "Limit" : "Market",
      volumeRequested: i % 2 === 0 ? 0.3 : 0.2,
      volumeFilled: i % 6 === 0 ? 0.1 : i % 2 === 0 ? 0.3 : 0.2,
      entryPrice: i % 2 === 0 ? 1.271 + i / 10000 : 155.2 + i / 100,
      currentPrice: i % 2 === 0 ? 1.272 + i / 10000 : 155.1 + i / 100,
      stopLoss: i % 2 === 0 ? 1.265 : 156.0,
      takeProfit: i % 2 === 0 ? 1.284 : 154.2,
      closePrice: active ? null : i % 2 === 0 ? 1.279 : 154.7,
      tradeStatus: active ? (pending ? "Pending" : "Open") : "Closed",
      nexusState: mismatch ? "OPEN" : active ? "OPEN" : "CLOSED",
      mt5State: mismatch ? "CLOSED" : active ? "OPEN" : "CLOSED",
      syncStatus: pending ? "Pending Sync" : mismatch ? "Failed Sync" : "Synced",
      stateMatchStatus: mismatch ? "Material Difference" : "Matched",
      floatingProfitLoss: active ? (i % 2 === 0 ? 22 : -18) : 0,
      realizedProfitLoss: active ? 0 : i % 2 === 0 ? 88 : -55,
      swap: -0.2,
      commission: -0.5,
      netProfitLoss: active ? (i % 2 === 0 ? 21.3 : -18.7) : i % 2 === 0 ? 87.3 : -55.7,
      marginUsed: active ? 180 : 0,
      openTime: new Date(now - (i * 7) * 60 * 1000).toISOString(),
      closeTime: active ? null : new Date(now - (i * 3) * 60 * 1000).toISOString(),
      lastMt5UpdateAt: isoNow(-(10 + i)),
      lastNexusUpdateAt: isoNow(-(12 + i * 2)),
      lastSyncAt: isoNow(-(15 + i * 3)),
      syncDelaySeconds: 10 + i * 2,
      riskLevel: mismatch ? "High" : active ? "Moderate" : "Low"
    });
  }

  return base;
}

export function getMockLifecycle(tradeId: string, mt5Ticket: string | null): TradeLifecycleEvent[] {
  const base = [
    "Signal generated",
    "Order approved",
    "Order routed",
    "MT5 command delivered",
    "MT5 ticket created",
    "Partial fill received",
    "Full fill confirmed",
    "SL/TP set",
    "Modification received",
    "Trade closed",
    "Profit/loss reconciled",
    "Audit completed"
  ] as const;

  return base.map((label, idx) => ({
    id: makeId("evt", idx + 1),
    tradeId,
    mt5Ticket,
    eventType: label,
    source: idx % 2 === 0 ? "Nexus" : "MT5",
    statusBefore: idx === 0 ? "INIT" : base[idx - 1],
    statusAfter: label,
    message: label === "Partial fill received" ? "Partial fill reported by MT5 (volume delta)." : `${label} recorded.`,
    latencyMs: 30 + idx * 12,
    result: label === "Trade closed" && mt5Ticket == null ? "Fail" : idx % 5 === 0 ? "Warn" : "Ok",
    timestamp: isoNow(-(900 - idx * 55))
  }));
}

export function getMockModifications(tradeId: string, mt5Ticket: string | null): TradeModification[] {
  return [
    {
      id: makeId("mod", 1),
      modificationId: makeId("modification", 811),
      tradeId,
      mt5Ticket,
      modificationType: "SL update",
      oldValue: "2315.0",
      newValue: "2312.0",
      source: "Nexus",
      status: "Applied",
      appliedAt: isoNow(-820),
      syncedAt: isoNow(-810),
      syncResult: "Ok"
    },
    {
      id: makeId("mod", 2),
      modificationId: makeId("modification", 812),
      tradeId,
      mt5Ticket,
      modificationType: "Trailing stop adjustment",
      oldValue: "2312.0",
      newValue: "2314.5",
      source: "MT5",
      status: "Pending",
      appliedAt: isoNow(-220),
      syncedAt: null,
      syncResult: "Warn"
    }
  ];
}

export function getMockLogs(): TradeSyncLogEntry[] {
  return [
    {
      id: "log_001",
      timestamp: isoNow(-420),
      tradeId: "trd_003",
      mt5Ticket: null,
      account: "FTMO Challenge - Demo",
      broker: "MockBroker",
      exceptionType: "Missing Ticket",
      severity: "Critical",
      errorMessage: "MT5 ticket not created after order routed.",
      rootCause: "EA bridge disabled / no terminal command delivery.",
      retryCount: 2,
      resolutionStatus: "Unresolved",
      aiExplanation: "Order is routed in Nexus but no MT5 ticket exists; keep sync frozen until MT5 bridge is operational."
    },
    {
      id: "log_002",
      timestamp: isoNow(-190),
      tradeId: "trd_002",
      mt5Ticket: "45811555",
      account: "FTMO Challenge - Demo",
      broker: "MockBroker",
      exceptionType: "Partial Fill Not Synced",
      severity: "Warning",
      errorMessage: "Filled volume delta detected without Nexus lifecycle update.",
      rootCause: "Execution feedback delay on MT5 side.",
      retryCount: 1,
      resolutionStatus: "Unresolved",
      aiExplanation: "Lifecycle needs partial fill event; reconcile volume and update exposure before next risk step."
    },
    {
      id: "log_003",
      timestamp: isoNow(-980),
      tradeId: "trd_001",
      mt5Ticket: "45811234",
      account: "FTMO Challenge - Demo",
      broker: "MockBroker",
      exceptionType: "Sync Delay",
      severity: "Info",
      errorMessage: "Sync delay above baseline.",
      rootCause: "Snapshot mode polling interval.",
      retryCount: 0,
      resolutionStatus: "Resolved",
      aiExplanation: "Delay is expected in snapshot polling mode; enable realtime channel to reduce drift."
    }
  ];
}

export function getMockDiagnostics(): AiDiagnosticsResponse {
  const diagnostics: AiTradeSyncDiagnostic[] = [
    {
      id: "diag_001",
      issue: "Trade missing in MT5",
      affectedTradeId: "trd_003",
      affectedTicket: null,
      severity: "Critical",
      rootCause: "EA bridge / MT5 command delivery disabled.",
      tradingImpact: "Trade cannot execute; Nexus state may drift from broker reality.",
      recommendedAction: "Freeze sync and rerun diagnostics after MT5 bridge is enabled.",
      autoFixEligible: false,
      confidenceScore: 92
    },
    {
      id: "diag_002",
      issue: "Partial fill not synced",
      affectedTradeId: "trd_002",
      affectedTicket: "45811555",
      severity: "Warning",
      rootCause: "Execution feedback delay and missing lifecycle update.",
      tradingImpact: "Risk and exposure may be understated.",
      recommendedAction: "Run trade reconciliation; update lifecycle and exposure.",
      autoFixEligible: true,
      confidenceScore: 74
    },
    {
      id: "diag_003",
      issue: "State mismatch",
      affectedTradeId: "trd_0012",
      affectedTicket: "45812012",
      severity: "Warning",
      rootCause: "MT5 close event arrived but Nexus still marks open.",
      tradingImpact: "P/L reconciliation incomplete and state drift risk.",
      recommendedAction: "Trigger missing close event detection and reconcile.",
      autoFixEligible: true,
      confidenceScore: 67
    }
  ];

  return { meta: { timestamp: isoNow() }, diagnostics };
}

