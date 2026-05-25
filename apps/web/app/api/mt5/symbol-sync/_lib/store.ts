import type { AuditRecord, Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import { calculateSymbolHealth, classifyFeed, detectSymbolIssues, normalizeBrokerSymbol, remediationWorkflow } from "@/modules/mt5-infrastructure-and-broker-connectivity/symbol-sync/algorithms/symbol-sync.algorithms";
import { createSymbolSyncSeed } from "@/modules/mt5-infrastructure-and-broker-connectivity/symbol-sync/data/symbol-sync.mock";
import type { SyncedSymbol, SymbolSyncResponse } from "@/modules/mt5-infrastructure-and-broker-connectivity/symbol-sync/types/symbol-sync.types";
import { resolveMt5Role } from "../../_lib/access";

const seed = createSymbolSyncSeed();
const state = { ...seed, audits: [] as AuditRecord[], lastSyncAt: new Date().toISOString() };
const permissions: Record<string, Mt5Role[]> = {
  sync: ["Super Admin", "Infrastructure Admin"],
  validate: ["Super Admin", "Infrastructure Admin"],
  remap: ["Super Admin", "Infrastructure Admin"],
  diagnostics: ["Super Admin", "Infrastructure Admin", "Risk Manager"],
  autoRemediate: ["Super Admin", "Infrastructure Admin"]
};

export function symbolRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}
function authorize(role: Mt5Role, action: keyof typeof permissions) {
  if (!permissions[action].includes(role)) throw new Error(`Role "${role}" is not authorized to perform symbol sync ${action}.`);
}
function confirm(confirmed?: boolean) {
  if (!confirmed) throw new Error("Confirmation is required for this restricted symbol sync action.");
}
function audit(role: Mt5Role, action: string, entityId: string, oldValue: unknown, newValue: unknown, request?: Request) {
  state.audits.unshift({ id: `symbol-audit-${Date.now()}-${state.audits.length}`, userId: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"), action, module: "Symbol Sync", entityId, oldValue, newValue, ipAddress: request?.headers.get("x-forwarded-for") ?? "system", userAgent: request?.headers.get("user-agent") ?? "autonomous-symbol-validation", timestamp: new Date().toISOString() });
}
function symbolById(id: string) {
  const symbol = state.symbols.find((item) => item.id === id);
  if (!symbol) throw new Error("MT5 synchronized symbol not found.");
  return symbol;
}
function refreshSymbol(symbol: SyncedSymbol) {
  symbol.tickDelaySeconds = Math.max(0, Math.round((Date.now() - new Date(symbol.lastTickAt).getTime()) / 1000));
  symbol.feedStatus = classifyFeed(symbol);
  const normalized = normalizeBrokerSymbol(symbol.brokerSymbol);
  if (!normalized.known || normalized.normalizedSymbol !== symbol.normalizedSymbol) symbol.mappingStatus = "Critical";
  symbol.riskLevel = symbol.mappingStatus === "Critical" || symbol.feedStatus === "Offline" ? "Critical" : symbol.feedStatus === "Degraded" || symbol.spread > symbol.rollingSpread * 2 ? "Degraded" : "Healthy";
  return symbol;
}

export function symbols() { return state.symbols.map(refreshSymbol); }
export function symbol(id: string) { return refreshSymbol(symbolById(id)); }
export function issues() { return detectSymbolIssues(symbols()); }
export function diagnostics() { return state.diagnostics; }
export function audits() { return state.audits; }

export function syncAllSymbols(role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "sync"); confirm(confirmed);
  const oldIssues = issues();
  state.symbols.forEach((item) => {
    const normalized = normalizeBrokerSymbol(item.brokerSymbol);
    if (normalized.known) {
      item.normalizedSymbol = normalized.normalizedSymbol;
      item.assetClass = normalized.assetClass;
    }
    item.lastSyncAt = new Date().toISOString();
    item.mappingStatus = normalized.known && item.dataFeedActive ? "Healthy" : "Critical";
  });
  state.lastSyncAt = new Date().toISOString();
  audit(role, "All symbols synchronized", "all-symbols", { issues: oldIssues.length }, { issues: issues().length, count: state.symbols.length }, request);
  return symbols();
}
export function validateMapping(id: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "validate"); confirm(confirmed);
  const item = symbol(id);
  const normalized = normalizeBrokerSymbol(item.brokerSymbol);
  const valid = normalized.known && normalized.normalizedSymbol === item.normalizedSymbol;
  const old = item.mappingStatus;
  item.mappingStatus = valid && item.dataFeedActive ? "Healthy" : "Critical";
  item.mismatchReason = valid ? undefined : `Expected mapping ${normalized.normalizedSymbol}; stored mapping is ${item.normalizedSymbol}.`;
  audit(role, "Symbol mapping validated", id, old, { valid, mappingStatus: item.mappingStatus }, request);
  return { symbol: item, valid, normalized };
}
export function remapSymbol(id: string, normalizedSymbol: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "remap"); confirm(confirmed);
  const item = symbol(id);
  const normalized = normalizeBrokerSymbol(item.brokerSymbol);
  if (!normalized.known || normalized.normalizedSymbol !== normalizedSymbol.toUpperCase()) throw new Error(`Mapping rejected: broker symbol resolves to ${normalized.normalizedSymbol}.`);
  const old = { normalizedSymbol: item.normalizedSymbol, mappingStatus: item.mappingStatus };
  item.normalizedSymbol = normalized.normalizedSymbol;
  item.assetClass = normalized.assetClass;
  item.mappingStatus = item.dataFeedActive ? "Healthy" : "Critical";
  item.mismatchReason = undefined;
  item.lastSyncAt = new Date().toISOString();
  audit(role, "Symbol mapping corrected", id, old, { normalizedSymbol: item.normalizedSymbol, mappingStatus: item.mappingStatus }, request);
  return item;
}
export function runSymbolDiagnostics(role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "diagnostics"); confirm(confirmed);
  const detected = issues();
  audit(role, "Symbol diagnostics run", "all-symbols", null, { detectedIssues: detected.length }, request);
  return { completedAt: new Date().toISOString(), issues: detected, diagnostics: state.diagnostics };
}
export function autoRemediateSymbol(diagnosticId: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "autoRemediate"); confirm(confirmed);
  const diagnostic = state.diagnostics.find((item) => item.id === diagnosticId);
  if (!diagnostic) throw new Error("Symbol diagnostic not found.");
  if (!diagnostic.autoFixEligible) throw new Error("Auto-remediation is unavailable for this symbol issue.");
  const item = symbol(diagnostic.symbolId);
  const old = { mappingStatus: item.mappingStatus, tradingAllowed: item.tradingAllowed };
  const normalized = normalizeBrokerSymbol(item.brokerSymbol);
  if (normalized.known) {
    item.normalizedSymbol = normalized.normalizedSymbol;
    item.assetClass = normalized.assetClass;
  }
  item.tradingAllowed = false;
  item.mappingStatus = normalized.known && item.dataFeedActive ? "Healthy" : "Critical";
  item.lastSyncAt = new Date().toISOString();
  diagnostic.autoFixStatus = "Running";
  audit(role, "Symbol auto-remediation triggered", diagnosticId, old, { normalizedSymbol: item.normalizedSymbol, mappingStatus: item.mappingStatus, tradingAllowed: false }, request);
  return { symbol: item, diagnostic, workflow: remediationWorkflow(item) };
}
export function normalizeRequestedSymbols(raw: string[]) {
  return raw.map((brokerSymbol) => ({ brokerSymbol, ...normalizeBrokerSymbol(brokerSymbol) }));
}

export function buildSymbolSyncResponse(role: Mt5Role = "Infrastructure Admin"): SymbolSyncResponse {
  const items = symbols();
  const currentIssues = issues();
  const health = calculateSymbolHealth(items);
  const now = new Date().toISOString();
  const critical = currentIssues.filter((issue) => issue.severity === "Critical").length;
  const workflowTitles = ["Broker Instruments Pulled", "Suffix / Prefix Parsed", "Asset Class Detected", "Registry Match", "Contract Specs Verified", "Spread Validated", "Tick Feed Active", "Trading Permission Verified", "Risk Engine Updated", "Audit Logged"];
  return {
    meta: { timestamp: now, currentRole: role, streamEndpoint: "/api/mt5/symbol-sync/events-stream", monitoringMode: "Autonomous Symbol Validation" },
    kpis: [
      { label: "Total Symbols", value: String(items.length), status: "Healthy", detail: "Broker instruments tracked", updatedAt: now },
      { label: "Mapped Symbols", value: String(items.filter((item) => item.mappingStatus === "Healthy").length), status: "Healthy", detail: "Validated registry matches", updatedAt: now },
      { label: "Mapping Mismatches", value: String(currentIssues.filter((item) => item.issueType === "Mapping Mismatch").length), status: critical ? "Critical" : "Healthy", detail: "Unsafe identity bindings", updatedAt: now },
      { label: "Data Feeds Active", value: `${items.filter((item) => item.dataFeedActive).length}/${items.length}`, status: items.some((item) => !item.dataFeedActive) ? "Degraded" : "Healthy", detail: "Live tick streams", updatedAt: now },
      { label: "Trading Enabled", value: String(items.filter((item) => item.tradingAllowed).length), status: "Healthy", detail: "Execution-ready symbols", updatedAt: now },
      { label: "Missing Ticks", value: String(currentIssues.filter((item) => item.issueType === "Missing Tick").length), status: currentIssues.some((item) => item.issueType === "Missing Tick") ? "Critical" : "Healthy", detail: "Market-open outages", updatedAt: now },
      { label: "Spread Anomalies", value: String(currentIssues.filter((item) => item.issueType === "Spread Anomaly").length), status: "Degraded", detail: "Above rolling threshold", updatedAt: now },
      { label: "Duplicate Mappings", value: String(currentIssues.filter((item) => item.issueType === "Duplicate Mapping").length), status: "Watch", detail: "Contract review queue", updatedAt: now },
      { label: "Delayed Feeds", value: String(currentIssues.filter((item) => item.issueType === "Delayed Tick").length), status: "Degraded", detail: "Freshness threshold exceeded", updatedAt: now },
      { label: "Last Symbol Sync", value: new Date(state.lastSyncAt).toLocaleTimeString(), status: "Healthy", detail: "Registry snapshot", updatedAt: now },
      { label: "Highest Risk Symbol", value: items.find((item) => item.riskLevel === "Critical")?.brokerSymbol ?? "None", status: critical ? "Critical" : "Healthy", detail: "Priority validation", updatedAt: now },
      { label: "Symbol Health Score", value: `${health.score}/100`, status: health.score >= 75 ? "Healthy" : health.score >= 60 ? "Degraded" : "Critical", detail: health.rating, updatedAt: now }
    ],
    health,
    workflow: workflowTitles.map((title, index) => ({ title, status: index >= 3 && critical ? "Critical" : index >= 5 && currentIssues.length ? "Degraded" : "Healthy", symbolCount: items.length - (index >= 3 ? critical : 0), failureCount: index >= 3 ? critical : 0, averageDelayMs: Math.round(items.reduce((sum, item) => sum + item.tickDelaySeconds * 1000, 0) / items.length), lastCheckedAt: now, aiRecommendation: title === "Registry Match" && critical ? "Correct unresolved symbol identity before execution." : title === "Tick Feed Active" && critical ? "Recover offline feed and retain the trading block." : undefined })),
    symbols: items,
    issues: currentIssues,
    feedMetrics: items.map((item) => ({ id: item.id, brokerName: item.brokerName, normalizedSymbol: item.normalizedSymbol, tickDelaySeconds: item.tickDelaySeconds, spread: item.spread, rollingSpread: item.rollingSpread, gapCount: item.gapCount, feedStatus: item.feedStatus, lastTickAt: item.lastTickAt })),
    diagnostics: state.diagnostics,
    audits: state.audits,
    permissions: { role, canSync: permissions.sync.includes(role), canValidate: permissions.validate.includes(role), canRemap: permissions.remap.includes(role), canDiagnostics: permissions.diagnostics.includes(role), canAutoRemediate: permissions.autoRemediate.includes(role) }
  };
}
