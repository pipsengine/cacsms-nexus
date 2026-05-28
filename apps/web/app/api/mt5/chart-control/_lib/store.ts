import type { AuditRecord, Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import { analyzeChart, calculateWorkspaceHealth } from "@/modules/mt5-infrastructure-and-broker-connectivity/chart-control/algorithms/chart-control.algorithms";
import type {
  ChartControlResponse,
  ChartInstrument,
  ChartLayout,
  ChartSignal,
  ChartSnapshot,
  DrawingObject,
  Timeframe
} from "@/modules/mt5-infrastructure-and-broker-connectivity/chart-control/types/chart-control.types";
import { resolveMt5Role } from "../../_lib/access";
import { bindPersistedMt5State, ensureMt5ModuleHydrated } from "../../_lib/persistence";
import { normalizeBrokerSymbol } from "@/modules/mt5-infrastructure-and-broker-connectivity/symbol-sync/algorithms/symbol-sync.algorithms";
import { quoteSymbolKey } from "../../_lib/quote-ingest-shared";
import { ingestLiveQuoteFromHeartbeat } from "./ingest-quotes";
import type { LiveQuoteInput } from "../../_lib/quote-ingest-shared";

type ChartControlState = {
  instruments: ChartInstrument[];
  layouts: ChartLayout[];
  drawings: DrawingObject[];
  signals: ChartSignal[];
  snapshots: ChartSnapshot[];
  audits: AuditRecord[];
  lastRefreshAt: string;
};

const state = bindPersistedMt5State<ChartControlState>("chart-control", () => ({
  instruments: [],
  layouts: [],
  drawings: [],
  signals: [],
  snapshots: [],
  audits: [] as AuditRecord[],
  lastRefreshAt: new Date().toISOString()
}));

await ensureMt5ModuleHydrated("chart-control");

export function resetChartControlState(override?: Partial<ChartControlState>) {
  state.instruments = override?.instruments ?? [];
  state.layouts = override?.layouts ?? [];
  state.drawings = override?.drawings ?? [];
  state.signals = override?.signals ?? [];
  state.snapshots = override?.snapshots ?? [];
  state.audits = [];
  state.lastRefreshAt = new Date().toISOString();
}

const permissions: Record<string, Mt5Role[]> = {
  refresh: ["Super Admin", "Infrastructure Admin", "Trading Admin"],
  configure: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager", "Analyst"],
  snapshot: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager", "Analyst"],
  publish: ["Super Admin", "Trading Admin", "Risk Manager"]
};

export function chartRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}
function authorize(role: Mt5Role, action: keyof typeof permissions) {
  if (!permissions[action].includes(role)) throw new Error(`Role "${role}" is not authorized to perform chart control ${action}.`);
}
function confirm(confirmed?: boolean) {
  if (!confirmed) throw new Error("Confirmation is required for this chart-control action.");
}
function audit(role: Mt5Role, action: string, entityId: string, oldValue: unknown, newValue: unknown, request?: Request) {
  state.audits.unshift({ id: `chart-audit-${Date.now()}-${state.audits.length}`, userId: request?.headers.get("x-user-id") ?? role.toLowerCase().replace(/\s+/g, "-"), action, module: "Chart Control", entityId, oldValue, newValue, ipAddress: request?.headers.get("x-forwarded-for") ?? "system", userAgent: request?.headers.get("user-agent") ?? "chart-surveillance", timestamp: new Date().toISOString() });
}
function instrument(id: string) {
  const item = state.instruments.find((entry) => entry.id === id);
  if (!item) throw new Error("Chart instrument not found.");
  return item;
}

function digitsForSymbol(normalizedSymbol: string) {
  const upper = normalizedSymbol.toUpperCase();
  if (upper.startsWith("XAU")) return 2;
  if (upper.endsWith("JPY")) return 3;
  if (/^(NAS100|SPX500|US30|UK100|DE40)/.test(upper)) return 1;
  return 5;
}

function ensureInstrumentOnLayout(instrument: ChartInstrument, receivedAt: string) {
  let layout = state.layouts.find((entry) => entry.active);
  if (!layout) {
    state.layouts.unshift({
      id: "layout-live",
      name: "Live Workspace",
      slots: 4,
      instruments: [instrument.symbol],
      timeframes: [instrument.timeframe],
      indicators: ["EMA 9", "RSI 14"],
      active: true,
      updatedAt: receivedAt
    });
    return;
  }
  if (!layout.instruments.includes(instrument.symbol)) {
    layout.instruments = [...layout.instruments, instrument.symbol].slice(0, layout.slots);
    layout.timeframes = [...layout.timeframes, instrument.timeframe].slice(0, layout.slots);
    layout.updatedAt = receivedAt;
  }
}

export function ensureChartInstrument(input: {
  symbol: string;
  brokerName: string;
  brokerId: string;
  role: Mt5Role;
  confirmed?: boolean;
  request?: Request;
}) {
  authorize(input.role, "configure");
  confirm(input.confirmed);
  const normalized = normalizeBrokerSymbol(input.symbol);
  const existing = state.instruments.find(
    (item) => item.symbol === normalized.normalizedSymbol && item.brokerName === input.brokerName
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const digits = digitsForSymbol(normalized.normalizedSymbol);
  const close = 1;
  const instrument: ChartInstrument = {
    id: `chart-${quoteSymbolKey(input.brokerId, normalized.normalizedSymbol)}`.replace(/[^a-z0-9-]/g, "-"),
    symbol: normalized.normalizedSymbol,
    description: `${normalized.normalizedSymbol} automation chart`,
    assetClass: normalized.assetClass,
    brokerName: input.brokerName,
    digits,
    timeframe: "M15",
    availableTimeframes: ["M1", "M5", "M15", "H1", "H4", "D1"],
    bid: close,
    ask: close,
    spreadPoints: 1,
    lastTickAt: now,
    feedStatus: "Watch",
    tradeEnabled: true,
    candles: [{ timestamp: now, open: close, high: close, low: close, close, volume: 1, sma20: close, ema9: close, rsi: 50 }],
    visibleIndicators: ["EMA 9", "RSI 14"]
  };
  state.instruments.unshift(instrument);
  ensureInstrumentOnLayout(instrument, now);
  state.lastRefreshAt = now;
  audit(input.role, "Chart instrument provisioned for automation", instrument.id, null, { symbol: instrument.symbol, brokerName: input.brokerName }, input.request);
  return instrument;
}

export function audits() { return state.audits; }

export function refreshCharts(role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "refresh"); confirm(confirmed);
  const now = new Date().toISOString();
  state.instruments.filter((item) => item.feedStatus !== "Offline").forEach((item) => { item.lastTickAt = now; });
  state.lastRefreshAt = now;
  audit(role, "Chart feed refreshed", "workspace", null, { instruments: state.instruments.length }, request);
  return state.instruments;
}

export function ingestHeartbeatQuote(input: LiveQuoteInput) {
  return ingestLiveQuoteFromHeartbeat(state, input);
}

export function changeTimeframe(id: string, timeframe: Timeframe, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "configure"); confirm(confirmed);
  const item = instrument(id);
  if (!item.availableTimeframes.includes(timeframe)) throw new Error("Selected timeframe is unavailable for this instrument.");
  const previous = item.timeframe;
  item.timeframe = timeframe;
  audit(role, "Chart timeframe changed", id, previous, timeframe, request);
  return item;
}

export function toggleIndicator(id: string, indicator: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "configure"); confirm(confirmed);
  const item = instrument(id);
  const previous = [...item.visibleIndicators];
  item.visibleIndicators = item.visibleIndicators.includes(indicator) ? item.visibleIndicators.filter((value) => value !== indicator) : [...item.visibleIndicators, indicator];
  audit(role, "Indicator visibility changed", id, previous, item.visibleIndicators, request);
  return item;
}

export function applyLayout(id: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "configure"); confirm(confirmed);
  const layout = state.layouts.find((item) => item.id === id);
  if (!layout) throw new Error("Chart layout not found.");
  const previous = state.layouts.find((item) => item.active)?.id;
  state.layouts.forEach((item) => { item.active = item.id === id; });
  layout.updatedAt = new Date().toISOString();
  audit(role, "Chart layout applied", id, previous, id, request);
  return layout;
}

export function captureSnapshot(id: string, note: string, role: Mt5Role, confirmed: boolean, request?: Request) {
  authorize(role, "snapshot"); confirm(confirmed);
  const item = instrument(id);
  const layout = state.layouts.find((entry) => entry.active);
  if (!layout) throw new Error("No active chart layout is configured.");
  const snapshot = { id: `snapshot-${Date.now()}`, symbol: item.symbol, timeframe: item.timeframe, layoutName: layout.name, capturedBy: role, capturedAt: new Date().toISOString(), note: note || "Operator chart state captured." };
  state.snapshots.unshift(snapshot);
  audit(role, "Chart snapshot captured", id, null, snapshot, request);
  return snapshot;
}

export function buildChartControlResponse(role: Mt5Role = "Infrastructure Admin"): ChartControlResponse {
  const now = new Date().toISOString();
  const analysisByInstrument = Object.fromEntries(state.instruments.map((item) => [item.id, analyzeChart(item)]));
  const workspaceHealth = calculateWorkspaceHealth(state.instruments);
  const activeLayout = state.layouts.find((layout) => layout.active);
  const offline = state.instruments.filter((item) => item.feedStatus === "Offline").length;
  const bullish = Object.values(analysisByInstrument).filter((analysis) => analysis.trend === "Bullish").length;
  return {
    meta: { timestamp: now, currentRole: role, streamEndpoint: "/api/mt5/chart-control/events-stream", monitoringMode: "Autonomous Chart Surveillance" },
    kpis: [
      { label: "Active Layout", value: activeLayout?.name ?? "None", status: activeLayout ? "Healthy" : "Pending", detail: activeLayout ? `${activeLayout.slots} chart panels` : "Awaiting workspace layout" },
      { label: "Charts Online", value: state.instruments.length ? `${state.instruments.length - offline}/${state.instruments.length}` : "0/0", status: offline ? "Degraded" : state.instruments.length ? "Healthy" : "Pending", detail: state.instruments.length ? "Streaming chart feeds" : "Awaiting live chart feeds" },
      { label: "Visible Indicators", value: String(new Set(state.instruments.flatMap((item) => item.visibleIndicators)).size), status: "Healthy", detail: "Overlay library active" },
      { label: "Active Signals", value: String(state.signals.length), status: state.signals.some((signal) => signal.severity === "Critical") ? "Critical" : "Watch", detail: "AI chart events" },
      { label: "Bullish Trends", value: String(bullish), status: "Healthy", detail: "Selected workspaces" },
      { label: "Snapshots", value: String(state.snapshots.length), status: "Healthy", detail: "Auditable captures" },
      { label: "Feed Exceptions", value: String(offline), status: offline ? "Critical" : "Healthy", detail: "Stale or halted charts" },
      { label: "Workspace Health", value: `${workspaceHealth.score}/100`, status: workspaceHealth.status, detail: "Chart readiness" }
    ],
    instruments: state.instruments,
    layouts: state.layouts,
    drawings: state.drawings,
    signals: state.signals,
    snapshots: state.snapshots,
    analysisByInstrument,
    audits: state.audits,
    permissions: { role, canRefresh: permissions.refresh.includes(role), canConfigure: permissions.configure.includes(role), canSnapshot: permissions.snapshot.includes(role), canPublish: permissions.publish.includes(role) }
  };
}
