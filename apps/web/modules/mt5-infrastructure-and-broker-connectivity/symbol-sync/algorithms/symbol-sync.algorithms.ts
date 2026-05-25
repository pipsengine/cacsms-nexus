import type { SyncedSymbol, SymbolHealthScore, SymbolIssue, SymbolTone } from "../types/symbol-sync.types";

const registry: Record<string, string> = {
  EURUSD: "Forex Major", GBPUSD: "Forex Major", USDJPY: "Forex Major", AUDUSD: "Forex Major", USDCAD: "Forex Major",
  EURGBP: "Forex Cross", EURJPY: "Forex Cross", GBPJPY: "Forex Cross", XAUUSD: "Metal", NAS100: "Index",
  SPX500: "Index", US30: "Index"
};
const aliases: Record<string, string> = { GOLD: "XAUUSD", NASDAQ: "NAS100", NASDAQ100: "NAS100", US500: "SPX500" };
const rating = (score: number): SymbolHealthScore["rating"] => score >= 90 ? "Excellent" : score >= 75 ? "Healthy" : score >= 60 ? "Degraded" : score >= 40 ? "High Risk" : "Critical";
const clamp = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

export function normalizeBrokerSymbol(raw: string) {
  const cleaned = raw.trim().toUpperCase()
    .replace(/^(FX_|CASH_|MT5_)/, "")
    .replace(/(\.RAW|\.PRO|\.ECN|_RAW|_PRO|_ECN|-RAW|-PRO|-ECN|#)$/i, "");
  const withoutMicro = registry[cleaned] || aliases[cleaned] ? cleaned : cleaned.endsWith("M") ? cleaned.slice(0, -1) : cleaned;
  const normalizedSymbol = aliases[withoutMicro] ?? withoutMicro;
  return { normalizedSymbol, assetClass: registry[normalizedSymbol] ?? "Unknown", known: Boolean(registry[normalizedSymbol]) };
}

export function detectSymbolIssues(symbols: SyncedSymbol[], now = Date.now()) {
  const issues: SymbolIssue[] = [];
  const duplicateMap = new Map<string, SyncedSymbol[]>();
  const push = (symbol: SyncedSymbol, issueType: SymbolIssue["issueType"], severity: SymbolIssue["severity"], detail: string, recommendedAction: string) => {
    issues.push({ id: `${symbol.id}-${issueType.replace(/\s+/g, "-").toLowerCase()}`, symbolId: symbol.id, brokerName: symbol.brokerName, brokerSymbol: symbol.brokerSymbol, normalizedSymbol: symbol.normalizedSymbol, issueType, severity, detectedAt: new Date(now).toISOString(), detail, recommendedAction, resolved: false });
  };
  symbols.forEach((symbol) => {
    const normalized = normalizeBrokerSymbol(symbol.brokerSymbol);
    const key = `${symbol.brokerId}:${symbol.normalizedSymbol}`;
    duplicateMap.set(key, [...(duplicateMap.get(key) ?? []), symbol]);
    if (!normalized.known) push(symbol, "Unknown Symbol", "Critical", "Instrument is not present in the internal registry.", "Review broker contract and create a validated registry mapping.");
    if (normalized.known && normalized.normalizedSymbol !== symbol.normalizedSymbol) push(symbol, "Mapping Mismatch", "Critical", `Expected ${normalized.normalizedSymbol}; stored mapping is ${symbol.normalizedSymbol}.`, "Correct mapping and hold execution pending validation.");
    if (symbol.spread > symbol.rollingSpread * 2) push(symbol, "Spread Anomaly", symbol.spread > symbol.rollingSpread * 3 ? "Critical" : "Warning", "Current spread exceeds twice the rolling baseline.", "Review broker feed before routing new orders.");
    if (symbol.marketOpen && !symbol.dataFeedActive) push(symbol, "Missing Tick", "Critical", "Market is open but no active data stream is available.", "Restore feed and require fresh ticks before execution.");
    if (symbol.marketOpen && symbol.dataFeedActive && now - new Date(symbol.lastTickAt).getTime() > 15_000) push(symbol, "Delayed Tick", "Warning", "Latest tick exceeds the allowed freshness threshold.", "Validate network/feed latency and monitor for freeze.");
    if (!symbol.tradingAllowed) push(symbol, "Trading Disabled", "Warning", "Instrument routing is blocked while validation or broker recovery is incomplete.", "Keep blocked until mapping and feed checks pass.");
  });
  duplicateMap.forEach((mapped) => {
    if (mapped.length > 1) mapped.forEach((symbol) => push(symbol, "Duplicate Mapping", "Warning", `Multiple active broker symbols map to ${symbol.normalizedSymbol}.`, "Validate contract variants and retain only intentional mappings."));
  });
  return issues;
}

export function classifyFeed(symbol: SyncedSymbol, now = Date.now()): SymbolTone {
  if (!symbol.marketOpen) return "Inactive";
  if (!symbol.dataFeedActive) return "Offline";
  const age = (now - new Date(symbol.lastTickAt).getTime()) / 1000;
  if (age > 60) return "Critical";
  if (age > 15 || symbol.spread > symbol.rollingSpread * 2) return "Degraded";
  return "Healthy";
}

export function calculateSymbolHealth(symbols: SyncedSymbol[], now = Date.now()): SymbolHealthScore {
  const total = symbols.length || 1;
  const issues = detectSymbolIssues(symbols, now);
  const factors = {
    mapping: (symbols.filter((symbol) => symbol.mappingStatus === "Healthy").length / total) * 25,
    feed: (symbols.filter((symbol) => classifyFeed(symbol, now) === "Healthy").length / total) * 25,
    trading: (symbols.filter((symbol) => symbol.tradingAllowed).length / total) * 15,
    freshness: (symbols.filter((symbol) => !symbol.marketOpen || now - new Date(symbol.lastTickAt).getTime() <= 15_000).length / total) * 20,
    spread: (symbols.filter((symbol) => symbol.spread <= symbol.rollingSpread * 2).length / total) * 15,
    incidentPenalty: -issues.filter((issue) => issue.severity === "Critical").length * 6
  };
  const score = clamp(Object.values(factors).reduce((sum, value) => sum + value, 0));
  return { score, rating: rating(score), factors };
}

export function remediationWorkflow(symbol: SyncedSymbol) {
  return ["Validate broker symbol identity", "Refresh broker contract specification", "Re-sync normalized registry", "Require fresh market ticks", symbol.tradingAllowed ? "Revalidate execution readiness" : "Retain trading block pending validation"];
}
