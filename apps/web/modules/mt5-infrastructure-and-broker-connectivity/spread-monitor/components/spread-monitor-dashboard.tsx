"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Download,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  TriangleAlert,
  Wrench
} from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";

import type { Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useSpreadMonitor } from "../hooks/use-spread-monitor";
import { buildBrokerComparison } from "../algorithms/spread-monitor.algorithms";
import { useSpreadMonitorStore } from "../stores/spread-monitor.store";
import type { AiSpreadDiagnostic, SpreadAlert, SpreadSnapshot, SpreadThreshold, SpreadTrendPoint } from "../types/spread-monitor.types";
import { formatIso, formatNumber, formatPercent, formatPips } from "../utils/spread-monitor.mappers";

type SortKey =
  | "symbol"
  | "normalizedSymbol"
  | "broker"
  | "assetClass"
  | "currentSpreadPips"
  | "averageSpreadPips"
  | "spreadDeviationPercent"
  | "spreadStabilityScore"
  | "spreadStatus"
  | "executionAllowed"
  | "riskLevel"
  | "lastTickTime";
type SortDir = "asc" | "desc";
type DetailTab = "Symbol" | "Execution" | "Threshold" | "History" | "Alerts";

function variant(status: string) {
  const s = status.toLowerCase();
  if (s.includes("normal") || s.includes("healthy") || s.includes("low")) return "success" as const;
  if (s.includes("wide") || s.includes("watch") || s.includes("moderate") || s.includes("elevated")) return "warning" as const;
  if (s.includes("critical") || s.includes("blocked") || s.includes("high")) return "destructive" as const;
  return "secondary" as const;
}

function can(role: Mt5Role, action: "refresh" | "diagnostics" | "thresholds" | "block" | "export") {
  if (action === "export" || action === "refresh") return true;
  if (action === "diagnostics") return role === "Super Admin" || role === "Trading Admin" || role === "Risk Manager" || role === "Analyst";
  if (action === "thresholds") return role === "Super Admin" || role === "Trading Admin" || role === "Risk Manager";
  return role === "Super Admin" || role === "Trading Admin" || role === "Risk Manager";
}

function downloadText(filename: string, content: string, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((h) => escape((row as any)[h])).join(","))].join("\n");
}

function spreadKpis(spreads: SpreadSnapshot[], alerts: SpreadAlert[]) {
  const symbols = new Set(spreads.map((s) => s.normalizedSymbol)).size;
  const brokers = new Set(spreads.map((s) => s.brokerId)).size;
  const normal = spreads.filter((s) => s.spreadStatus === "Normal").length;
  const wide = spreads.filter((s) => s.spreadStatus === "Wide").length;
  const critical = spreads.filter((s) => s.spreadStatus === "Critical").length;
  const avgSpread = spreads.length ? spreads.reduce((sum, s) => sum + s.currentSpreadPips, 0) / spreads.length : 0;
  const highest = [...spreads].sort((a, b) => b.currentSpreadPips - a.currentSpreadPips)[0];
  const byBroker = new Map<string, { broker: string; avg: number; stability: number; count: number }>();
  for (const row of spreads) {
    const prev = byBroker.get(row.brokerId) ?? { broker: row.broker, avg: 0, stability: 0, count: 0 };
    byBroker.set(row.brokerId, { broker: row.broker, avg: prev.avg + row.currentSpreadPips, stability: prev.stability + row.spreadStabilityScore, count: prev.count + 1 });
  }
  const brokerStats = [...byBroker.values()].map((b) => ({ ...b, avg: b.count ? b.avg / b.count : 0, stability: b.count ? b.stability / b.count : 0 }));
  const mostStable = [...brokerStats].sort((a, b) => b.stability - a.stability)[0];
  const mostExpensive = [...brokerStats].sort((a, b) => b.avg - a.avg)[0];
  const spikeEvents = alerts.filter((a) => a.alertType.includes("Spike") && a.resolutionStatus !== "Resolved").length;
  const blocked = spreads.filter((s) => !s.executionAllowed).length;
  const criticalAlerts = alerts.filter((a) => a.severity === "Critical" && a.resolutionStatus !== "Resolved").length;

  return {
    symbols,
    brokers,
    normal,
    wide,
    critical,
    avgSpread,
    highest,
    mostStable,
    mostExpensive,
    spikeEvents,
    blocked,
    criticalAlerts
  };
}

function workflowNodes(spreads: SpreadSnapshot[], alerts: SpreadAlert[]) {
  const symbolCount = new Set(spreads.map((s) => s.normalizedSymbol)).size;
  const blocked = spreads.filter((s) => !s.executionAllowed).length;
  const wide = spreads.filter((s) => s.spreadStatus === "Wide").length;
  const critical = spreads.filter((s) => s.spreadStatus === "Critical").length;
  const latest = alerts[0];

  const step = (
    title: string,
    status: "Healthy" | "Watch" | "Degraded" | "Critical",
    failedCount: number,
    averageDelayMs: number,
    aiRecommendation: string
  ) => ({
    title,
    status,
    symbolCount,
    failedCount,
    averageDelayMs,
    latestAlert: latest ? `${latest.alertType} · ${latest.normalizedSymbol}` : "—",
    aiRecommendation
  });

  return [
    step("Tick Received", "Healthy", 0, 28, "Verify tick freshness; investigate delayed feeds per broker."),
    step("Spread Calculated", "Healthy", 0, 14, "Track bid/ask anomalies; normalize by symbol meta (digits/pip size)."),
    step("Rolling Average Compared", wide > 0 ? "Watch" : "Healthy", wide, 42, "Alert on 2× rolling average spikes and sustained widening."),
    step("Threshold Checked", critical > 0 ? "Degraded" : wide > 0 ? "Watch" : "Healthy", wide + critical, 55, "Apply per-symbol thresholds and strategy-specific caps (scalping/news)."),
    step("News Window Checked", "Watch", alerts.filter((a) => a.alertType === "News Spike" && a.resolutionStatus !== "Resolved").length, 36, "Apply news multiplier; disable execution if blackout remains unsafe."),
    step("Peer Broker Compared", "Healthy", alerts.filter((a) => a.alertType === "Broker Spike" && a.resolutionStatus !== "Resolved").length, 68, "Route to lowest-spread broker when divergence is material."),
    step("Execution Risk Scored", blocked > 0 ? "Degraded" : wide > 0 ? "Watch" : "Healthy", blocked, 48, "Increase risk severity when stability score deteriorates or peers disagree."),
    step("Unsafe Trades Blocked", blocked > 0 ? "Critical" : "Healthy", blocked, 22, "Keep blocked until spread normalizes below warning with stable ticks."),
    step("Alert Logged", "Healthy", 0, 10, "Ensure blocks + threshold changes are audit-logged and review resolution status.")
  ];
}

function TrendMiniChart({ points, normalizedSymbol }: { points: SpreadTrendPoint[]; normalizedSymbol: string }) {
  const data = points.filter((p) => p.normalizedSymbol === normalizedSymbol).slice(0, 24).reverse();
  if (!data.length) return <div className="text-xs font-semibold text-slate-500">No trend data.</div>;
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="measuredAt" hide />
          <YAxis width={40} tick={{ fontSize: 11 }} />
          <RechartsTooltip formatter={(value: any) => [`${Number(value).toFixed(2)} pips`, "Spread"]} labelFormatter={(label) => formatIso(String(label))} />
          <Line type="monotone" dataKey="spreadPips" stroke="#2563eb" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="rollingAveragePips" stroke="#0f766e" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ThresholdEditor({ threshold, onSave, disabled }: { threshold: SpreadThreshold; onSave: (patch: Partial<SpreadThreshold>) => void; disabled: boolean }) {
  const [draft, setDraft] = React.useState(() => ({
    normalLimitPips: threshold.normalLimitPips,
    warningLimitPips: threshold.warningLimitPips,
    criticalLimitPips: threshold.criticalLimitPips,
    executionBlockLimitPips: threshold.executionBlockLimitPips,
    scalpingMaxSpreadPips: threshold.scalpingMaxSpreadPips,
    newsMultiplier: threshold.newsMultiplier,
    autoDisableEnabled: threshold.autoDisableEnabled
  }));

  React.useEffect(() => {
    setDraft({
      normalLimitPips: threshold.normalLimitPips,
      warningLimitPips: threshold.warningLimitPips,
      criticalLimitPips: threshold.criticalLimitPips,
      executionBlockLimitPips: threshold.executionBlockLimitPips,
      scalpingMaxSpreadPips: threshold.scalpingMaxSpreadPips,
      newsMultiplier: threshold.newsMultiplier,
      autoDisableEnabled: threshold.autoDisableEnabled
    });
  }, [threshold.id]);

  const num = (value: string) => (value.trim() === "" ? 0 : Number(value));
  const field = (label: string, value: number, setValue: (v: number) => void) => (
    <div className="grid gap-1">
      <span className="text-xs font-semibold uppercase text-slate-500">{label}</span>
      <input
        value={String(value)}
        onChange={(e) => setValue(num(e.target.value))}
        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950"
      />
    </div>
  );

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        {field("Normal Limit (pips)", draft.normalLimitPips, (v) => setDraft((d) => ({ ...d, normalLimitPips: v })))}
        {field("Warning Limit (pips)", draft.warningLimitPips, (v) => setDraft((d) => ({ ...d, warningLimitPips: v })))}
        {field("Critical Limit (pips)", draft.criticalLimitPips, (v) => setDraft((d) => ({ ...d, criticalLimitPips: v })))}
        {field("Execution Block (pips)", draft.executionBlockLimitPips, (v) => setDraft((d) => ({ ...d, executionBlockLimitPips: v })))}
        {field("Scalping Max (pips)", draft.scalpingMaxSpreadPips, (v) => setDraft((d) => ({ ...d, scalpingMaxSpreadPips: v })))}
        {field("News Multiplier", draft.newsMultiplier, (v) => setDraft((d) => ({ ...d, newsMultiplier: v })))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <input
            type="checkbox"
            checked={draft.autoDisableEnabled}
            onChange={(e) => setDraft((d) => ({ ...d, autoDisableEnabled: e.target.checked }))}
          />
          Auto-disable enabled
        </label>

        <Button
          disabled={disabled}
          onClick={() =>
            onSave({
              normalLimitPips: draft.normalLimitPips,
              warningLimitPips: draft.warningLimitPips,
              criticalLimitPips: draft.criticalLimitPips,
              executionBlockLimitPips: draft.executionBlockLimitPips,
              scalpingMaxSpreadPips: draft.scalpingMaxSpreadPips,
              newsMultiplier: draft.newsMultiplier,
              autoDisableEnabled: draft.autoDisableEnabled
            })
          }
        >
          <SlidersHorizontal className="h-4 w-4" />
          Save Threshold
        </Button>
      </div>
    </div>
  );
}

function DiagnosticsTable({ rows }: { rows: AiSpreadDiagnostic[] }) {
  return (
    <div className="overflow-auto rounded-xl border border-slate-200">
      <table aria-label="AI spread diagnostics" className="min-w-[1100px] table-fixed border-collapse bg-white">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            <th className="w-[260px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Issue</th>
            <th className="w-[220px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Affected</th>
            <th className="w-[130px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Severity</th>
            <th className="w-[260px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Root Cause</th>
            <th className="w-[260px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Recommendation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-3 py-2 text-sm font-semibold text-slate-950">{d.issue}</td>
              <td className="px-3 py-2 text-sm font-semibold text-slate-950">{d.affected}</td>
              <td className="px-3 py-2 text-sm">
                <Badge variant={variant(d.severity)}>{d.severity}</Badge>
              </td>
              <td className="px-3 py-2 text-sm text-slate-700">{d.rootCause}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{d.recommendedAction}</td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-sm font-semibold text-slate-500">
                No diagnostics available.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export function SpreadMonitorDashboard() {
  const client = useQueryClient();
  const { streamConnected, summary, spreads, symbol, brokerComparison, trends, thresholds, alerts, logs, diagnostics, actions } = useSpreadMonitor();

  const role = useSpreadMonitorStore((s) => s.role);
  const setRole = useSpreadMonitorStore((s) => s.setRole);
  const searchTerm = useSpreadMonitorStore((s) => s.searchTerm);
  const setSearchTerm = useSpreadMonitorStore((s) => s.setSearchTerm);
  const assetFilter = useSpreadMonitorStore((s) => s.assetFilter);
  const setAssetFilter = useSpreadMonitorStore((s) => s.setAssetFilter);
  const statusFilter = useSpreadMonitorStore((s) => s.statusFilter);
  const setStatusFilter = useSpreadMonitorStore((s) => s.setStatusFilter);
  const brokerFilter = useSpreadMonitorStore((s) => s.brokerFilter);
  const setBrokerFilter = useSpreadMonitorStore((s) => s.setBrokerFilter);
  const selectedSymbol = useSpreadMonitorStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useSpreadMonitorStore((s) => s.setSelectedSymbol);
  const selectedThresholdId = useSpreadMonitorStore((s) => s.selectedThresholdId);
  const setSelectedThresholdId = useSpreadMonitorStore((s) => s.setSelectedThresholdId);
  const showDetailPanel = useSpreadMonitorStore((s) => s.showDetailPanel);
  const toggleDetailPanel = useSpreadMonitorStore((s) => s.toggleDetailPanel);
  const alertFilter = useSpreadMonitorStore((s) => s.alertFilter);
  const setAlertFilter = useSpreadMonitorStore((s) => s.setAlertFilter);

  const [sortKey, setSortKey] = React.useState<SortKey>("riskLevel");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [detailTab, setDetailTab] = React.useState<DetailTab>("Symbol");

  const spreadRows = spreads.data?.spreads ?? [];
  const alertRows = alerts.data?.alerts ?? [];
  const trendPoints = trends.data?.points ?? [];
  const thresholdRows = thresholds.data?.thresholds ?? [];

  const stats = spreadKpis(spreadRows, alertRows);

  const sortedRows = React.useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const get = (row: SpreadSnapshot) => (row as any)[sortKey];
    return [...spreadRows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
  }, [spreadRows, sortKey, sortDir]);

  const comparisons = React.useMemo(() => brokerComparison.data?.comparisons ?? buildBrokerComparison(spreadRows), [brokerComparison.data?.comparisons, spreadRows]);

  const brokers = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const row of spreadRows) map.set(row.brokerId, row.broker);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [spreadRows]);

  const selectedRow = React.useMemo(() => {
    if (!selectedSymbol) return null;
    return spreadRows.find((r) => r.normalizedSymbol === selectedSymbol || r.symbol === selectedSymbol) ?? null;
  }, [selectedSymbol, spreadRows]);

  const selectedThreshold = React.useMemo(() => {
    if (selectedThresholdId) return thresholdRows.find((t) => t.id === selectedThresholdId) ?? null;
    if (selectedRow) return thresholdRows.find((t) => t.id === selectedRow.thresholdId) ?? null;
    return null;
  }, [selectedThresholdId, thresholdRows, selectedRow]);

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["spread-monitor"] });
  };

  const exportReport = () => {
    const snapshot = {
      generatedAt: new Date().toISOString(),
      summary: summary.data,
      spreads: spreadRows,
      thresholds: thresholdRows,
      alerts: alertRows.slice(0, 80),
      diagnostics: diagnostics.data?.diagnostics ?? []
    };
    downloadText(`spread-monitor-${new Date().toISOString().slice(0, 19).replace(/[:]/g, "")}.json`, JSON.stringify(snapshot, null, 2));
  };

  const exportCsv = () => {
    const rows = spreadRows.map((s) => ({
      symbol: s.symbol,
      normalizedSymbol: s.normalizedSymbol,
      broker: s.broker,
      account: s.account,
      assetClass: s.assetClass,
      bid: s.bid,
      ask: s.ask,
      currentSpreadPips: s.currentSpreadPips,
      averageSpreadPips: s.averageSpreadPips,
      minimumSpreadPips: s.minimumSpreadPips,
      maximumSpreadPips: s.maximumSpreadPips,
      spreadDeviationPercent: s.spreadDeviationPercent,
      spreadStabilityScore: s.spreadStabilityScore,
      threshold: s.thresholdId,
      spreadStatus: s.spreadStatus,
      executionAllowed: s.executionAllowed,
      riskLevel: s.riskLevel,
      lastTickTime: s.lastTickTime
    }));
    downloadText(`spread-monitor-${new Date().toISOString().slice(0, 19).replace(/[:]/g, "")}.csv`, toCsv(rows), "text/csv");
  };

  const disableUnsafe = async () => {
    const unsafe = [...new Set(spreadRows.filter((r) => r.spreadStatus === "Critical" || r.riskLevel === "Critical" || r.riskLevel === "High").map((r) => r.normalizedSymbol))].slice(0, 12);
    for (const s of unsafe) {
      await actions.disableSymbolExecution.mutateAsync(s);
    }
  };

  const titleBadge = summary.data?.spreadRiskScore?.score != null ? (
    <Badge variant={variant(stats.critical > 0 ? "Critical" : stats.wide > 0 ? "Wide" : "Normal")}>
      <Activity className="h-3.5 w-3.5" />
      Overall {summary.data?.spreadRiskScore.score}/100
    </Badge>
  ) : null;

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="h-1.5 w-full rounded-t-2xl bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500" />
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">Spread Monitor</h1>
                {titleBadge}
                <Badge variant={streamConnected ? "success" : "secondary"}>
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {streamConnected ? "Live" : "Polling"}
                </Badge>
              </div>
              <p className="mt-2 max-w-5xl text-sm font-semibold text-slate-700 sm:text-base">
                Real-time broker spread intelligence, widening detection, execution safety, and spread-based trading risk control.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase text-slate-500">Role</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Mt5Role)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900"
                >
                  {(["Super Admin", "Risk Manager", "Trading Admin", "Analyst", "Read-Only Viewer"] as Mt5Role[]).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-semibold uppercase text-slate-500">Mode</span>
                <Badge variant="secondary">Autonomous</Badge>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 lg:w-auto">
              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                <Button onClick={refresh} disabled={!can(role, "refresh")}>
                  <RefreshCw className="h-4 w-4" />
                  Refresh Spreads
                </Button>
                <Button variant="secondary" onClick={refresh} disabled={!can(role, "refresh")}>
                  <RefreshCw className="h-4 w-4" />
                  Sync Spread Data
                </Button>
                <Button onClick={() => actions.runDiagnostics.mutate()} disabled={!can(role, "diagnostics")}>
                  <Wrench className="h-4 w-4" />
                  Run Spread Diagnostics
                </Button>
                <Button variant="secondary" onClick={() => toggleDetailPanel()} disabled={!can(role, "refresh")}>
                  <SlidersHorizontal className="h-4 w-4" />
                  Toggle Panel
                </Button>
              </div>
              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                <Button onClick={disableUnsafe} disabled={!can(role, "block")}>
                  <ShieldAlert className="h-4 w-4" />
                  Disable Unsafe Symbols
                </Button>
                <Button onClick={exportReport} disabled={!can(role, "export")}>
                  <Download className="h-4 w-4" />
                  Export Spread Report
                </Button>
                <Button variant="secondary" onClick={exportCsv} disabled={!can(role, "export")}>
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Symbols Monitored", value: String(stats.symbols), tone: "Healthy", detail: "Normalized symbols under watch" },
          { label: "Brokers Monitored", value: String(stats.brokers), tone: "Healthy", detail: "Unique broker routes reporting spreads" },
          { label: "Normal Spread Symbols", value: String(stats.normal), tone: stats.wide > 0 ? "Watch" : "Healthy", detail: "Rows at/below warning limit" },
          { label: "Wide Spread Symbols", value: String(stats.wide), tone: stats.wide > 0 ? "Degraded" : "Healthy", detail: "Rows above warning but below critical" },
          { label: "Critical Spread Alerts", value: String(stats.criticalAlerts), tone: stats.criticalAlerts > 0 ? "Critical" : "Healthy", detail: "Active critical alerts (unresolved)" },
          { label: "Average Spread", value: formatPips(stats.avgSpread), tone: stats.avgSpread > 4 ? "Degraded" : "Healthy", detail: "Average current spread across rows" },
          { label: "Highest Spread Symbol", value: stats.highest ? stats.highest.normalizedSymbol : "—", tone: stats.highest && stats.highest.currentSpreadPips > 6 ? "Critical" : "Watch", detail: stats.highest ? formatPips(stats.highest.currentSpreadPips) : "—" },
          { label: "Most Stable Broker", value: stats.mostStable?.broker ?? "—", tone: "Healthy", detail: stats.mostStable ? `${formatNumber(stats.mostStable.stability, 1)}/100` : "—" },
          { label: "Most Expensive Broker", value: stats.mostExpensive?.broker ?? "—", tone: stats.mostExpensive && stats.mostExpensive.avg > 4 ? "Degraded" : "Watch", detail: stats.mostExpensive ? formatPips(stats.mostExpensive.avg) : "—" },
          { label: "Spread Spike Events", value: String(stats.spikeEvents), tone: stats.spikeEvents > 0 ? "Degraded" : "Healthy", detail: "Spike alerts currently active" },
          { label: "Blocked Executions", value: String(stats.blocked), tone: stats.blocked > 0 ? "Critical" : "Healthy", detail: "Rows blocked by spread safety" },
          { label: "Spread Risk Score", value: `${summary.data?.spreadRiskScore.score ?? "—"}/100`, tone: stats.blocked > 0 ? "Critical" : stats.wide > 0 ? "Degraded" : "Healthy", detail: summary.data?.spreadRiskScore.rating ?? "—" }
        ].map((kpi) => (
          <Card key={kpi.label} className="border-slate-200 bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">{kpi.label}</p>
                  <CardTitle className="mt-2 text-2xl">{kpi.value}</CardTitle>
                  <CardDescription className="mt-1 text-sm font-semibold text-slate-600">{kpi.detail}</CardDescription>
                </div>
                <Badge variant={variant(kpi.tone)}>{kpi.tone}</Badge>
              </div>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Spread Monitoring Workflow</p>
                <CardTitle className="mt-1 text-2xl">Tick-to-block workflow status</CardTitle>
                <CardDescription className="mt-2 max-w-4xl">Tick received → spread calculated → rolling average compared → thresholds/news/peers → execution risk scored → unsafe trades blocked.</CardDescription>
              </div>
              <Badge variant="secondary">{summary.data?.meta.timestamp ? formatIso(summary.data.meta.timestamp) : "—"}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {workflowNodes(spreadRows, alertRows).map((node) => (
                <div key={node.title} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">{node.title}</p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">
                        {node.symbolCount} symbols · {node.failedCount} flagged
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-600">Avg delay {formatNumber(node.averageDelayMs, 0)}ms</p>
                    </div>
                    <Badge variant={variant(node.status)}>{node.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-600">Latest: {node.latestAlert}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-700">AI: {node.aiRecommendation}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs font-semibold text-slate-500">
              Workflow nodes are derived from live spreads, alerts, peer comparisons, and threshold posture to keep execution safety decisions consistent.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase text-blue-600">Spread Trend Charts</p>
              <CardTitle className="mt-1 text-2xl">Selected symbol trend</CardTitle>
              <CardDescription className="mt-2">Current spread and rolling average over the last snapshots.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>{selectedRow ? <TrendMiniChart points={trendPoints} normalizedSymbol={selectedRow.normalizedSymbol} /> : <div className="text-sm font-semibold text-slate-600">Select a symbol row.</div>}</CardContent>
        </Card>
      </section>

      <div className={cn("grid gap-4", showDetailPanel ? "xl:grid-cols-[1.35fr_0.65fr]" : "")}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Spread Monitor Table</p>
                <CardTitle className="mt-1 text-2xl">Symbol spreads, thresholds, and execution safety</CardTitle>
                <CardDescription className="mt-2">Search, filter, and action symbols and broker spreads across Forex, Gold, NASDAQ, SPX500, and US30.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="spread-search">
                  Search spreads
                </label>
                <input
                  id="spread-search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search symbol, broker, account, status…"
                  className="h-10 w-72 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400"
                />
                <select value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900">
                  <option value="all">All assets</option>
                  {["Forex", "Metals", "Indices"].map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <select value={brokerFilter} onChange={(e) => setBrokerFilter(e.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900">
                  <option value="all">All brokers</option>
                  {brokers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900">
                  <option value="all">All statuses</option>
                  {["Normal", "Wide", "Critical"].map((s) => (
                    <option key={s} value={s}>
                      Spread: {s}
                    </option>
                  ))}
                  {["Low", "Moderate", "Elevated", "High", "Critical"].map((s) => (
                    <option key={s} value={s}>
                      Risk: {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-xl border border-slate-200">
              <table aria-label="Spread monitor table" className="min-w-[2100px] table-fixed border-collapse bg-white">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr className="border-b border-slate-200">
                    {[
                      { key: "symbol", label: "Symbol", w: "w-[140px]" },
                      { key: "normalizedSymbol", label: "Normalized", w: "w-[160px]" },
                      { key: "broker", label: "Broker", w: "w-[170px]" },
                      { key: "account", label: "Account", w: "w-[220px]" },
                      { key: "assetClass", label: "Asset", w: "w-[120px]" },
                      { key: "bid", label: "Bid", w: "w-[120px]" },
                      { key: "ask", label: "Ask", w: "w-[120px]" },
                      { key: "currentSpreadPips", label: "Current", w: "w-[140px]" },
                      { key: "averageSpreadPips", label: "Avg", w: "w-[120px]" },
                      { key: "minimumSpreadPips", label: "Min", w: "w-[120px]" },
                      { key: "maximumSpreadPips", label: "Max", w: "w-[120px]" },
                      { key: "spreadDeviationPercent", label: "Deviation", w: "w-[130px]" },
                      { key: "spreadStabilityScore", label: "Stability", w: "w-[130px]" },
                      { key: "spreadStatus", label: "Spread", w: "w-[130px]" },
                      { key: "executionAllowed", label: "Execution", w: "w-[140px]" },
                      { key: "riskLevel", label: "Risk", w: "w-[120px]" },
                      { key: "lastTickTime", label: "Last Tick", w: "w-[190px]" },
                      { key: "actions", label: "Actions", w: "w-[320px]" }
                    ].map((c) => (
                      <th key={c.key} className={`${c.w} px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600`}>
                        <button
                          type="button"
                          onClick={() => {
                            if (c.key === "actions") return;
                            const key = c.key as SortKey;
                            if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                            setSortKey(key);
                          }}
                          className="inline-flex items-center gap-2 text-left hover:underline"
                        >
                          {c.label}
                          {sortKey === c.key ? <span className="text-[10px] font-bold">{sortDir.toUpperCase()}</span> : null}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <tr key={row.id} className={cn("border-b border-slate-100 hover:bg-slate-50", selectedSymbol === row.normalizedSymbol ? "bg-blue-50/40" : "")}>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => {
                            setSelectedSymbol(row.normalizedSymbol);
                            setSelectedThresholdId(row.thresholdId);
                            setDetailTab("Symbol");
                          }}
                        >
                          {row.symbol}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{row.normalizedSymbol}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{row.broker}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{row.account}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{row.assetClass}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatNumber(row.bid, row.digits)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatNumber(row.ask, row.digits)}</td>
                      <td className="px-3 py-2 text-sm">
                        <Badge variant={variant(row.spreadStatus)}>{formatPips(row.currentSpreadPips)}</Badge>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatPips(row.averageSpreadPips)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatPips(row.minimumSpreadPips)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatPips(row.maximumSpreadPips)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatPercent(row.spreadDeviationPercent)}</td>
                      <td className="px-3 py-2 text-sm">
                        <Badge variant={row.spreadStabilityScore >= 80 ? "success" : row.spreadStabilityScore >= 65 ? "warning" : "destructive"}>
                          {formatNumber(row.spreadStabilityScore, 1)}/100
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <Badge variant={variant(row.spreadStatus)}>{row.spreadStatus}</Badge>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <Badge variant={row.executionAllowed ? "success" : "destructive"}>{row.executionAllowed ? "Allowed" : "Blocked"}</Badge>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <Badge variant={variant(row.riskLevel)}>{row.riskLevel}</Badge>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatIso(row.lastTickTime)}</td>
                      <td className="px-3 py-2 text-sm">
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedSymbol(row.normalizedSymbol);
                              setDetailTab("Symbol");
                            }}
                          >
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedSymbol(row.normalizedSymbol);
                              setDetailTab("History");
                            }}
                          >
                            History
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedSymbol(row.normalizedSymbol);
                              setDetailTab("Alerts");
                            }}
                          >
                            Alerts
                          </Button>
                          <Button size="sm" onClick={() => actions.disableSymbolExecution.mutate(row.normalizedSymbol)} disabled={!can(role, "block")}>
                            Disable
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => actions.enableSymbolExecution.mutate(row.normalizedSymbol)} disabled={!can(role, "block")}>
                            Enable
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!sortedRows.length ? (
                    <tr>
                      <td colSpan={18} className="px-3 py-10 text-center text-sm font-semibold text-slate-500">
                        No spread rows match the current filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {showDetailPanel ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-blue-600">Symbol Spread Detail Panel</p>
                  <CardTitle className="mt-1 text-2xl">{selectedRow ? selectedRow.normalizedSymbol : "Select a symbol"}</CardTitle>
                  <CardDescription className="mt-2">Identity, live state, execution safety, thresholds, history, and alerts.</CardDescription>
                </div>
                {selectedRow ? (
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={variant(selectedRow.spreadStatus)}>{selectedRow.spreadStatus}</Badge>
                    <Badge variant={selectedRow.executionAllowed ? "success" : "destructive"}>{selectedRow.executionAllowed ? "Execution Allowed" : "Execution Blocked"}</Badge>
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(["Symbol", "Execution", "Threshold", "History", "Alerts"] as DetailTab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDetailTab(t)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold",
                      detailTab === t ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <Separator className="my-4" />

              {!selectedRow ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">Select a symbol from the table to view details.</div>
              ) : detailTab === "Symbol" ? (
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Broker</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">{selectedRow.broker}</p>
                      <p className="mt-2 text-xs font-semibold uppercase text-slate-500">Account</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">{selectedRow.account}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Bid / Ask</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">
                        {formatNumber(selectedRow.bid, selectedRow.digits)} / {formatNumber(selectedRow.ask, selectedRow.digits)}
                      </p>
                      <p className="mt-2 text-xs font-semibold uppercase text-slate-500">Last Tick</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">{formatIso(selectedRow.lastTickTime)}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">Current Spread</p>
                        <p className="mt-1 text-xl font-semibold text-slate-950">{formatPips(selectedRow.currentSpreadPips)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">Avg {formatPips(selectedRow.averageSpreadPips)}</Badge>
                        <Badge variant="secondary">Dev {formatPercent(selectedRow.spreadDeviationPercent)}</Badge>
                        <Badge variant={selectedRow.spreadStabilityScore >= 80 ? "success" : selectedRow.spreadStabilityScore >= 65 ? "warning" : "destructive"}>
                          Stability {formatNumber(selectedRow.spreadStabilityScore, 1)}/100
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ) : detailTab === "Execution" ? (
                <div className="grid gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">Execution Safety</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant={selectedRow.executionAllowed ? "success" : "destructive"}>{selectedRow.executionAllowed ? "Execution Allowed" : "Execution Blocked"}</Badge>
                      <Badge variant={variant(selectedRow.riskLevel)}>{selectedRow.riskLevel}</Badge>
                      <Badge variant={variant(selectedRow.spreadStatus)}>{selectedRow.spreadStatus}</Badge>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-700">
                      Safety recommendation is derived from thresholds, news windows, rolling averages, broker peer deltas, and stability score.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => actions.disableSymbolExecution.mutate(selectedRow.normalizedSymbol)} disabled={!can(role, "block")}>
                      <ShieldAlert className="h-4 w-4" />
                      Disable Execution
                    </Button>
                    <Button variant="secondary" onClick={() => actions.enableSymbolExecution.mutate(selectedRow.normalizedSymbol)} disabled={!can(role, "block")}>
                      <BadgeCheck className="h-4 w-4" />
                      Enable Execution
                    </Button>
                    <Button variant="secondary" onClick={() => actions.autoFix.mutate()} disabled={!can(role, "block")}>
                      <Wrench className="h-4 w-4" />
                      Auto-Remediate
                    </Button>
                  </div>
                </div>
              ) : detailTab === "Threshold" ? (
                selectedThreshold ? (
                  <div className="grid gap-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Threshold Context</p>
                      <div className="mt-2 grid gap-2 text-sm text-slate-700">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">Normalized symbol</span>
                          <span className="font-semibold text-slate-950">{selectedThreshold.normalizedSymbol}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">Asset class</span>
                          <span className="font-semibold text-slate-950">{selectedThreshold.assetClass}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">Broker scope</span>
                          <span className="font-semibold text-slate-950">{selectedThreshold.broker ?? "All"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">Strategy</span>
                          <span className="font-semibold text-slate-950">{selectedThreshold.strategyType}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">Updated</span>
                          <span className="font-semibold text-slate-950">{formatIso(selectedThreshold.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                    <ThresholdEditor
                      threshold={selectedThreshold}
                      disabled={!can(role, "thresholds")}
                      onSave={(patch) => actions.updateThreshold.mutate({ thresholdId: selectedThreshold.id, patch })}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">No threshold selected.</div>
                )
              ) : detailTab === "History" ? (
                <div className="grid gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">Spread History</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">Shows spread and rolling average for {selectedRow.normalizedSymbol} across brokers.</p>
                  </div>
                  <TrendMiniChart points={trendPoints} normalizedSymbol={selectedRow.normalizedSymbol} />
                </div>
              ) : (
                <div className="grid gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">Latest Alerts</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">Recent spread alerts and execution blocks for the selected symbol.</p>
                  </div>
                  <div className="overflow-auto rounded-xl border border-slate-200">
                    <table aria-label="Symbol alerts" className="min-w-[900px] table-fixed border-collapse bg-white">
                      <thead className="bg-slate-50">
                        <tr className="border-b border-slate-200">
                          <th className="w-[180px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Time</th>
                          <th className="w-[160px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Type</th>
                          <th className="w-[140px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Severity</th>
                          <th className="w-[160px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Spread</th>
                          <th className="w-[200px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Root Cause</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(symbol.data?.latestAlerts ?? []).map((a) => (
                          <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="px-3 py-2 text-sm text-slate-700">{formatIso(a.timestamp)}</td>
                            <td className="px-3 py-2 text-sm font-semibold text-slate-950">{a.alertType}</td>
                            <td className="px-3 py-2 text-sm">
                              <Badge variant={variant(a.severity)}>{a.severity}</Badge>
                            </td>
                            <td className="px-3 py-2 text-sm font-semibold text-slate-950">{formatPips(a.currentSpreadPips)}</td>
                            <td className="px-3 py-2 text-sm text-slate-700">{a.rootCause}</td>
                          </tr>
                        ))}
                        {!symbol.data?.latestAlerts?.length ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-6 text-center text-sm font-semibold text-slate-500">
                              No alerts for this symbol.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <section className="grid gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Broker Spread Comparison</p>
                <CardTitle className="mt-1 text-2xl">Peer broker divergence and execution recommendation</CardTitle>
                <CardDescription className="mt-2">
                  Compare the same normalized symbol across brokers to detect broker-specific spikes and route to the best execution candidate.
                </CardDescription>
              </div>
              <Badge variant="secondary">
                <AlertTriangle className="h-3.5 w-3.5" />
                {comparisons.length} symbols
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-xl border border-slate-200">
              <table aria-label="Broker spread comparison" className="min-w-[1200px] table-fixed border-collapse bg-white">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="w-[160px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Symbol</th>
                    <th className="w-[180px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Lowest</th>
                    <th className="w-[180px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Highest</th>
                    <th className="w-[160px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Delta</th>
                    <th className="w-[520px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.slice(0, 14).map((c) => (
                    <tr key={c.normalizedSymbol} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{c.normalizedSymbol}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{c.lowestSpreadBroker}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{c.highestSpreadBroker}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{formatPips(c.spreadDifferencePips)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{c.recommendation}</td>
                    </tr>
                  ))}
                  {!comparisons.length ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-sm font-semibold text-slate-500">
                        No comparison data.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Spread Threshold Management</p>
                <CardTitle className="mt-1 text-2xl">Threshold registry</CardTitle>
                <CardDescription className="mt-2">Configure spread limits by symbol/asset/broker/session/strategy and keep changes auditable.</CardDescription>
              </div>
              <Badge variant="secondary">{thresholdRows.length} thresholds</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[360px] rounded-xl border border-slate-200 bg-white">
              <div className="p-3">
                <div className="grid gap-2">
                  {thresholdRows.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedThresholdId(t.id);
                        setDetailTab("Threshold");
                      }}
                      className={cn(
                        "flex flex-col gap-1 rounded-xl border px-3 py-2 text-left",
                        selectedThreshold?.id === t.id ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-950">{t.normalizedSymbol}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{t.broker ?? "All brokers"}</Badge>
                          <Badge variant="secondary">{t.strategyType}</Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                        <span>Normal {formatNumber(t.normalLimitPips, 2)}</span>
                        <span>Warn {formatNumber(t.warningLimitPips, 2)}</span>
                        <span>Crit {formatNumber(t.criticalLimitPips, 2)}</span>
                        <span>Block {formatNumber(t.executionBlockLimitPips, 2)}</span>
                      </div>
                    </button>
                  ))}
                  {!thresholdRows.length ? <div className="py-12 text-center text-sm font-semibold text-slate-500">No thresholds.</div> : null}
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Spread Alerts & Logs</p>
                <CardTitle className="mt-1 text-2xl">Alerts and audit surface</CardTitle>
                <CardDescription className="mt-2">Track spikes, blocks, root causes, and resolution status.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase text-slate-500">Filter</span>
                <select value={alertFilter} onChange={(e) => setAlertFilter(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900">
                  {["All", "Warning", "Critical", "News Spike", "Broker Spike", "Symbol Spike", "Execution Blocked", "Resolved", "Unresolved"].map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-xl border border-slate-200">
              <table aria-label="Spread alerts" className="min-w-[1200px] table-fixed border-collapse bg-white">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="w-[180px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Timestamp</th>
                    <th className="w-[140px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Symbol</th>
                    <th className="w-[160px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Broker</th>
                    <th className="w-[160px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Spread</th>
                    <th className="w-[160px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Alert Type</th>
                    <th className="w-[140px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Severity</th>
                    <th className="w-[160px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Execution</th>
                    <th className="w-[260px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Root Cause</th>
                  </tr>
                </thead>
                <tbody>
                  {alertRows.slice(0, 60).map((a) => (
                    <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-sm text-slate-700">{formatIso(a.timestamp)}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{a.normalizedSymbol}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{a.broker}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{formatPips(a.currentSpreadPips)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{a.alertType}</td>
                      <td className="px-3 py-2 text-sm">
                        <Badge variant={variant(a.severity)}>{a.severity}</Badge>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <Badge variant={a.executionBlocked ? "destructive" : "success"}>{a.executionBlocked ? "Blocked" : "Allowed"}</Badge>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">{a.rootCause}</td>
                    </tr>
                  ))}
                  {!alertRows.length ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-10 text-center text-sm font-semibold text-slate-500">
                        No alerts.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <Separator className="my-4" />

            <div className="overflow-auto rounded-xl border border-slate-200">
              <table aria-label="Spread logs" className="min-w-[1100px] table-fixed border-collapse bg-white">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="w-[180px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Timestamp</th>
                    <th className="w-[160px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Event</th>
                    <th className="w-[140px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Severity</th>
                    <th className="w-[140px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Symbol</th>
                    <th className="w-[260px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Message</th>
                    <th className="w-[140px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(logs.data?.logs ?? []).slice(0, 22).map((l) => (
                    <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-sm text-slate-700">{formatIso(l.timestamp)}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{l.eventType}</td>
                      <td className="px-3 py-2 text-sm">
                        <Badge variant={variant(l.severity)}>{l.severity}</Badge>
                      </td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{l.normalizedSymbol}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{l.message}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{l.actionTaken}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">AI Spread Diagnostics</p>
                <CardTitle className="mt-1 text-2xl">Anomaly detection, manipulation suspicion, and auto-block posture</CardTitle>
                <CardDescription className="mt-2">Abnormal widening, broker spikes, news expansion, liquidity shocks, and repeated instability.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={diagnostics.data?.diagnostics?.some((d) => d.severity === "Critical") ? "destructive" : "secondary"}>
                  <TriangleAlert className="h-3.5 w-3.5" />
                  {diagnostics.data?.diagnostics?.length ?? 0} findings
                </Badge>
                <Button variant="secondary" onClick={() => actions.autoFix.mutate()} disabled={!can(role, "block")}>
                  <Wrench className="h-4 w-4" />
                  Auto-Remediate
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DiagnosticsTable rows={diagnostics.data?.diagnostics ?? []} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
