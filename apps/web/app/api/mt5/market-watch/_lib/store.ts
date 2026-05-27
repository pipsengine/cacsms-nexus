import type { AuditRecord, Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import { calculateMarketHealth, dailyMovePercent, detectMarketAlerts, quoteStatus, spreadPoints, topMarketMovers } from "@/modules/mt5-infrastructure-and-broker-connectivity/market-watch/algorithms/market-watch.algorithms";
import type { MarketInstrument, MarketWatchResponse } from "@/modules/mt5-infrastructure-and-broker-connectivity/market-watch/types/market-watch.types";
import { resolveMt5Role } from "../../_lib/access";
import { bindPersistedMt5State, ensureMt5ModuleHydrated } from "../../_lib/persistence";

const state = bindPersistedMt5State("market-watch", () => ({
  instruments: [] as MarketInstrument[],
  sessions: [] as any[],
  diagnostics: [] as any[],
  audits: [] as AuditRecord[],
  lastRefreshAt: new Date().toISOString()
}));

await ensureMt5ModuleHydrated("market-watch");

export function resetMarketWatchState(override?: Partial<typeof state>) {
  state.instruments = override?.instruments ?? [];
  state.sessions = (override as any)?.sessions ?? [];
  state.diagnostics = (override as any)?.diagnostics ?? [];
  state.audits = [];
  state.lastRefreshAt = new Date().toISOString();
}

const permissions: Record<string, Mt5Role[]> = {
  refresh: ["Super Admin", "Infrastructure Admin", "Trading Admin"],
  manageWatchlist: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager", "Analyst"],
  diagnostics: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager"],
  remediate: ["Super Admin", "Infrastructure Admin"]
};

export function marketRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}
function authorize(role: Mt5Role, action: keyof typeof permissions) {
  if (!permissions[action].includes(role)) throw new Error(`Role "${role}" is not authorized to perform market watch ${action}.`);
}
function confirm(confirmed?: boolean) {
  if (!confirmed) throw new Error("Confirmation is required for this market-watch action.");
}
function audit(role: Mt5Role, action: string, entityId: string, oldValue: unknown, newValue: unknown, request?: Request) {
  state.audits.unshift({ id: `market-audit-${Date.now()}-${state.audits.length}`, userId: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"), action, module: "Market Watch", entityId, oldValue, newValue, ipAddress: request?.headers.get("x-forwarded-for") ?? "system", userAgent: request?.headers.get("user-agent") ?? "quote-surveillance", timestamp: new Date().toISOString() });
}
function getInstrument(id: string) {
  const instrument = state.instruments.find((item) => item.id === id);
  if (!instrument) throw new Error("Market-watch instrument not found.");
  return instrument;
}
function withCurrentStatus(instrument: MarketInstrument) {
  return instrument;
}

export function instruments() { return state.instruments.map(withCurrentStatus); }
export function audits() { return state.audits; }

export function refreshQuotes(role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "refresh"); confirm(confirmed);
  const refreshed = state.instruments.filter((instrument) => instrument.feedActive);
  const now = new Date().toISOString();
  refreshed.forEach((instrument) => { instrument.lastTickAt = now; });
  state.lastRefreshAt = now;
  audit(role, "Market quotes refreshed", "all-instruments", null, { refreshed: refreshed.length }, request);
  return refreshed;
}

export function toggleWatchlist(id: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "manageWatchlist"); confirm(confirmed);
  const instrument = getInstrument(id);
  const old = instrument.watchlisted;
  instrument.watchlisted = !instrument.watchlisted;
  audit(role, "Watchlist membership changed", id, old, instrument.watchlisted, request);
  return instrument;
}

export function runMarketDiagnostics(role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "diagnostics"); confirm(confirmed);
  const alerts = detectMarketAlerts(instruments());
  audit(role, "Market diagnostics run", "all-instruments", null, { alerts: alerts.length }, request);
  return { completedAt: new Date().toISOString(), alerts, diagnostics: state.diagnostics };
}

export function buildMarketWatchResponse(role: Mt5Role = "Infrastructure Admin"): MarketWatchResponse {
  const items = instruments();
  const alerts = detectMarketAlerts(items);
  const health = calculateMarketHealth(items);
  const now = new Date().toISOString();
  const critical = alerts.filter((alert) => alert.severity === "Critical").length;
  const watchlist = items.filter((instrument) => instrument.watchlisted);
  const spreadExceptions = items.filter((instrument) => spreadPoints(instrument) > instrument.spreadBaselinePoints * 2);
  const freshestAge = Math.max(...items.filter((instrument) => instrument.feedActive).map((instrument) => Date.now() - new Date(instrument.lastTickAt).getTime()));
  return {
    meta: { timestamp: now, currentRole: role, streamEndpoint: "/api/mt5/market-watch/events-stream", monitoringMode: "Autonomous Quote Surveillance" },
    kpis: [
      { label: "Live Instruments", value: `${items.filter((item) => item.feedActive).length}/${items.length}`, status: critical ? "Degraded" : "Healthy", detail: "Streaming quote sources" },
      { label: "Watchlist", value: String(watchlist.length), status: "Healthy", detail: "Priority instruments" },
      { label: "Feed Alerts", value: String(alerts.filter((alert) => alert.alertType === "Feed Offline" || alert.alertType === "Stale Quote").length), status: critical ? "Critical" : "Healthy", detail: "Freshness surveillance" },
      { label: "Spread Exceptions", value: String(spreadExceptions.length), status: spreadExceptions.length ? "Degraded" : "Healthy", detail: "Above liquidity baseline" },
      { label: "Largest Move", value: `${topMarketMovers(items, 1)[0].symbol} ${dailyMovePercent(topMarketMovers(items, 1)[0])}%`, status: "Watch", detail: "Absolute daily change" },
      { label: "Quote Health", value: `${health.score}/100`, status: health.score >= 75 ? "Healthy" : "Degraded", detail: health.rating },
      { label: "Fastest Latency", value: `${Math.min(...items.map((item) => item.latencyMs))} ms`, status: "Healthy", detail: "Broker delivery path" },
      { label: "Last Active Tick", value: `${Math.round(freshestAge / 1000)} sec`, status: freshestAge > 15_000 ? "Degraded" : "Healthy", detail: "Oldest live-feed tick" }
    ],
    instruments: items,
    alerts,
    diagnostics: state.diagnostics,
    sessions: state.sessions,
    health,
    movers: topMarketMovers(items),
    audits: state.audits,
    permissions: {
      role,
      canRefresh: permissions.refresh.includes(role),
      canManageWatchlist: permissions.manageWatchlist.includes(role),
      canDiagnostics: permissions.diagnostics.includes(role),
      canRemediate: permissions.remediate.includes(role)
    }
  };
}

export { dailyMovePercent, quoteStatus, spreadPoints };
