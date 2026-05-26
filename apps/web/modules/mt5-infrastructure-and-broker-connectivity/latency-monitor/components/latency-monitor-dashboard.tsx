"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, BadgeCheck, Download, RefreshCw, ShieldAlert, SlidersHorizontal, TriangleAlert, Wrench } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";

import type { Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useLatencyMonitor } from "../hooks/use-latency-monitor";
import { useLatencyMonitorStore } from "../stores/latency-monitor.store";
import type { AiLatencyDiagnostic, LatencyBrokerComparisonRow, LatencyMetric, LatencyThreshold, LatencyTrendPoint, LatencyWorkflowNode } from "../types/latency-monitor.types";
import { formatIso, formatMs, formatNumber } from "../utils/latency-monitor.mappers";

type SortKey =
  | "metricId"
  | "componentType"
  | "componentName"
  | "broker"
  | "account"
  | "terminal"
  | "eaInstance"
  | "symbol"
  | "latencyType"
  | "currentLatencyMs"
  | "averageLatencyMs"
  | "minimumLatencyMs"
  | "maximumLatencyMs"
  | "p95LatencyMs"
  | "p99LatencyMs"
  | "breachStatus"
  | "trendDirection"
  | "lastMeasuredAt"
  | "riskLevel"
  | "routeBlocked";
type SortDir = "asc" | "desc";
type DetailTab = "Identity" | "Metrics" | "Impact" | "Threshold" | "History";

function variant(value: string) {
  const s = value.toLowerCase();
  if (s.includes("healthy") || s.includes("normal") || s.includes("low") || s.includes("down")) return "success" as const;
  if (s.includes("watch") || s.includes("moderate") || s.includes("warning") || s.includes("elevated") || s.includes("flat")) return "warning" as const;
  if (s.includes("degraded") || s.includes("high") || s.includes("up")) return "warning" as const;
  if (s.includes("critical") || s.includes("blocked")) return "destructive" as const;
  return "secondary" as const;
}

function can(role: Mt5Role, action: "refresh" | "diagnostics" | "tests" | "thresholds" | "block" | "export") {
  if (action === "export" || action === "refresh") return true;
  if (action === "diagnostics" || action === "tests") return role === "Super Admin" || role === "Infrastructure Admin" || role === "Risk Manager";
  if (action === "thresholds") return role === "Super Admin" || role === "Infrastructure Admin" || role === "Trading Admin" || role === "Risk Manager";
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

function kpis(metrics: LatencyMetric[], brokerRows: LatencyBrokerComparisonRow[]) {
  const avg = metrics.length ? metrics.reduce((s, m) => s + m.currentLatencyMs, 0) / metrics.length : 0;
  const brokerAvg = brokerRows.length ? brokerRows.reduce((s, b) => s + b.averageLatencyMs, 0) / brokerRows.length : 0;
  const bridge = metrics.filter((m) => m.latencyType === "EA Bridge Round Trip");
  const bridgeAvg = bridge.length ? bridge.reduce((s, m) => s + m.currentLatencyMs, 0) / bridge.length : 0;
  const heartbeat = metrics.filter((m) => m.latencyType === "Terminal Heartbeat");
  const heartbeatAvg = heartbeat.length ? heartbeat.reduce((s, m) => s + m.currentLatencyMs, 0) / heartbeat.length : 0;
  const market = metrics.filter((m) => m.latencyType === "Market Data");
  const marketAvg = market.length ? market.reduce((s, m) => s + m.currentLatencyMs, 0) / market.length : 0;
  const routing = metrics.filter((m) => m.latencyType === "Order Routing");
  const routingAvg = routing.length ? routing.reduce((s, m) => s + m.currentLatencyMs, 0) / routing.length : 0;
  const queue = metrics.filter((m) => m.latencyType === "Execution Queue");
  const queueAvg = queue.length ? queue.reduce((s, m) => s + m.currentLatencyMs, 0) / queue.length : 0;
  const feedback = metrics.filter((m) => m.latencyType === "Execution Feedback");
  const feedbackAvg = feedback.length ? feedback.reduce((s, m) => s + m.currentLatencyMs, 0) / feedback.length : 0;
  const highestBroker = [...brokerRows].sort((a, b) => b.averageLatencyMs - a.averageLatencyMs)[0];
  const highestTerminal = [...metrics].sort((a, b) => b.currentLatencyMs - a.currentLatencyMs).find((m) => m.terminal != null);
  const breaches = metrics.filter((m) => m.breachStatus !== "Normal" || m.routeBlocked).length;
  const risk = Math.min(100, Math.round(breaches * 8 + avg / 18 + (highestBroker?.p99LatencyMs ?? 0) / 30));
  const riskScore = Math.max(0, 100 - risk);
  return {
    avg,
    brokerAvg,
    bridgeAvg,
    heartbeatAvg,
    marketAvg,
    routingAvg,
    queueAvg,
    feedbackAvg,
    highestBroker,
    highestTerminal,
    breaches,
    riskScore
  };
}

function WorkflowGrid({ nodes }: { nodes: LatencyWorkflowNode[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {nodes.map((n) => (
        <div key={n.title} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">{n.title}</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{formatMs(n.averageLatencyMs)}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">{n.failedCount} flagged · bottleneck: {n.bottleneckStage}</p>
            </div>
            <Badge variant={variant(n.status)}>{n.status}</Badge>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-600">Latest: {n.latestBreach}</p>
          <p className="mt-2 text-xs font-semibold text-slate-700">AI: {n.aiRecommendation}</p>
        </div>
      ))}
    </div>
  );
}

function TrendMiniChart({ points, brokerId, latencyType }: { points: LatencyTrendPoint[]; brokerId: string | null; latencyType: string }) {
  const data = points.filter((p) => p.brokerId === brokerId && p.latencyType === latencyType).slice(0, 28).reverse();
  if (!data.length) return <div className="text-xs font-semibold text-slate-500">No trend data.</div>;
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="measuredAt" hide />
          <YAxis width={44} tick={{ fontSize: 11 }} />
          <RechartsTooltip formatter={(value: any) => [`${Math.round(Number(value))}ms`, "Latency"]} labelFormatter={(label) => formatIso(String(label))} />
          <Line type="monotone" dataKey="currentLatencyMs" stroke="#2563eb" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="p95LatencyMs" stroke="#0f766e" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="p99LatencyMs" stroke="#b45309" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ThresholdEditor({ threshold, onSave, disabled }: { threshold: LatencyThreshold; onSave: (patch: Partial<LatencyThreshold>) => void; disabled: boolean }) {
  const [draft, setDraft] = React.useState(() => ({
    normalLatencyLimitMs: threshold.normalLatencyLimitMs,
    warningLatencyLimitMs: threshold.warningLatencyLimitMs,
    criticalLatencyLimitMs: threshold.criticalLatencyLimitMs,
    executionBlockLatencyMs: threshold.executionBlockLatencyMs,
    scalpingMaxLatencyMs: threshold.scalpingMaxLatencyMs,
    newsMultiplier: threshold.newsMultiplier,
    autoDisableEnabled: threshold.autoDisableEnabled
  }));

  React.useEffect(() => {
    setDraft({
      normalLatencyLimitMs: threshold.normalLatencyLimitMs,
      warningLatencyLimitMs: threshold.warningLatencyLimitMs,
      criticalLatencyLimitMs: threshold.criticalLatencyLimitMs,
      executionBlockLatencyMs: threshold.executionBlockLatencyMs,
      scalpingMaxLatencyMs: threshold.scalpingMaxLatencyMs,
      newsMultiplier: threshold.newsMultiplier,
      autoDisableEnabled: threshold.autoDisableEnabled
    });
  }, [threshold.id]);

  const num = (value: string) => (value.trim() === "" ? 0 : Number(value));
  const field = (label: string, value: number, setValue: (v: number) => void) => (
    <div className="grid gap-1">
      <span className="text-xs font-semibold uppercase text-slate-500">{label}</span>
      <input value={String(value)} onChange={(e) => setValue(num(e.target.value))} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950" />
    </div>
  );

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        {field("Normal Limit (ms)", draft.normalLatencyLimitMs, (v) => setDraft((d) => ({ ...d, normalLatencyLimitMs: v })))}
        {field("Warning Limit (ms)", draft.warningLatencyLimitMs, (v) => setDraft((d) => ({ ...d, warningLatencyLimitMs: v })))}
        {field("Critical Limit (ms)", draft.criticalLatencyLimitMs, (v) => setDraft((d) => ({ ...d, criticalLatencyLimitMs: v })))}
        {field("Execution Block (ms)", draft.executionBlockLatencyMs, (v) => setDraft((d) => ({ ...d, executionBlockLatencyMs: v })))}
        {field("Scalping Max (ms)", draft.scalpingMaxLatencyMs, (v) => setDraft((d) => ({ ...d, scalpingMaxLatencyMs: v })))}
        {field("News Multiplier", draft.newsMultiplier, (v) => setDraft((d) => ({ ...d, newsMultiplier: v })))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <input type="checkbox" checked={draft.autoDisableEnabled} onChange={(e) => setDraft((d) => ({ ...d, autoDisableEnabled: e.target.checked }))} />
          Auto-disable enabled
        </label>

        <Button
          disabled={disabled}
          onClick={() =>
            onSave({
              normalLatencyLimitMs: draft.normalLatencyLimitMs,
              warningLatencyLimitMs: draft.warningLatencyLimitMs,
              criticalLatencyLimitMs: draft.criticalLatencyLimitMs,
              executionBlockLatencyMs: draft.executionBlockLatencyMs,
              scalpingMaxLatencyMs: draft.scalpingMaxLatencyMs,
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

function DiagnosticsTable({ rows }: { rows: AiLatencyDiagnostic[] }) {
  return (
    <div className="overflow-auto rounded-xl border border-slate-200">
      <table aria-label="AI latency diagnostics" className="min-w-[1200px] table-fixed border-collapse bg-white">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            <th className="w-[240px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Issue</th>
            <th className="w-[300px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Affected Component</th>
            <th className="w-[220px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Context</th>
            <th className="w-[120px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Severity</th>
            <th className="w-[320px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Recommendation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-3 py-2 text-sm font-semibold text-slate-950">{d.issue}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{d.affectedComponent}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{d.affectedContext}</td>
              <td className="px-3 py-2 text-sm">
                <Badge variant={variant(d.severity)}>{d.severity}</Badge>
              </td>
              <td className="px-3 py-2 text-sm text-slate-700">{d.recommendedAction}</td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-sm font-semibold text-slate-500">
                No diagnostics available.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export function LatencyMonitorDashboard() {
  const client = useQueryClient();
  const { streamConnected, summary, workflow, metrics, metric, brokerComparison, trends, thresholds, alerts, logs, diagnostics, actions } = useLatencyMonitor();

  const role = useLatencyMonitorStore((s) => s.role);
  const setRole = useLatencyMonitorStore((s) => s.setRole);
  const searchTerm = useLatencyMonitorStore((s) => s.searchTerm);
  const setSearchTerm = useLatencyMonitorStore((s) => s.setSearchTerm);
  const componentFilter = useLatencyMonitorStore((s) => s.componentFilter);
  const setComponentFilter = useLatencyMonitorStore((s) => s.setComponentFilter);
  const breachFilter = useLatencyMonitorStore((s) => s.breachFilter);
  const setBreachFilter = useLatencyMonitorStore((s) => s.setBreachFilter);
  const brokerFilter = useLatencyMonitorStore((s) => s.brokerFilter);
  const setBrokerFilter = useLatencyMonitorStore((s) => s.setBrokerFilter);
  const selectedMetricId = useLatencyMonitorStore((s) => s.selectedMetricId);
  const setSelectedMetricId = useLatencyMonitorStore((s) => s.setSelectedMetricId);
  const selectedThresholdId = useLatencyMonitorStore((s) => s.selectedThresholdId);
  const setSelectedThresholdId = useLatencyMonitorStore((s) => s.setSelectedThresholdId);
  const showDetailPanel = useLatencyMonitorStore((s) => s.showDetailPanel);
  const toggleDetailPanel = useLatencyMonitorStore((s) => s.toggleDetailPanel);
  const alertFilter = useLatencyMonitorStore((s) => s.alertFilter);
  const setAlertFilter = useLatencyMonitorStore((s) => s.setAlertFilter);

  const rows = metrics.data?.metrics ?? [];
  const brokerRows = brokerComparison.data?.comparisons ?? [];
  const trendPoints = trends.data?.points ?? [];
  const thresholdRows = thresholds.data?.thresholds ?? [];
  const alertRows = alerts.data?.alerts ?? [];

  const stats = kpis(rows, brokerRows);

  const brokers = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const m of rows) if (m.brokerId) map.set(m.brokerId, m.broker ?? m.brokerId);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const components = React.useMemo(() => {
    const set = new Set(rows.map((m) => m.componentType));
    return [...set.values()].sort();
  }, [rows]);

  const selected = metric.data?.metric ?? (selectedMetricId ? rows.find((m) => m.metricId === selectedMetricId) ?? null : null);
  const selectedThreshold = React.useMemo(() => {
    if (selectedThresholdId) return thresholdRows.find((t) => t.id === selectedThresholdId) ?? null;
    if (selected) return thresholdRows.find((t) => t.id === selected.thresholdId) ?? null;
    return null;
  }, [selected, selectedThresholdId, thresholdRows]);

  const [sortKey, setSortKey] = React.useState<SortKey>("riskLevel");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [detailTab, setDetailTab] = React.useState<DetailTab>("Identity");

  const sortedRows = React.useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const get = (r: LatencyMetric) => (r as any)[sortKey];
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
  }, [rows, sortKey, sortDir]);

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["latency-monitor"] });
  };

  const exportReport = () => {
    const snapshot = {
      generatedAt: new Date().toISOString(),
      summary: summary.data,
      workflow: workflow.data,
      metrics: rows,
      thresholds: thresholdRows,
      brokerComparison: brokerRows,
      alerts: alertRows.slice(0, 100),
      diagnostics: diagnostics.data?.diagnostics ?? []
    };
    downloadText(`latency-monitor-${new Date().toISOString().slice(0, 19).replace(/[:]/g, "")}.json`, JSON.stringify(snapshot, null, 2));
  };

  const exportCsv = () => {
    const csvRows = rows.map((m) => ({
      metricId: m.metricId,
      componentType: m.componentType,
      componentName: m.componentName,
      broker: m.broker ?? "",
      latencyType: m.latencyType,
      currentLatencyMs: m.currentLatencyMs,
      averageLatencyMs: m.averageLatencyMs,
      p95LatencyMs: m.p95LatencyMs,
      p99LatencyMs: m.p99LatencyMs,
      jitterMs: m.jitterMs,
      timeoutCount: m.timeoutCount,
      breachStatus: m.breachStatus,
      riskLevel: m.riskLevel,
      routeBlocked: m.routeBlocked,
      lastMeasuredAt: m.lastMeasuredAt
    }));
    downloadText(`latency-monitor-${new Date().toISOString().slice(0, 19).replace(/[:]/g, "")}.csv`, toCsv(csvRows), "text/csv");
  };

  const disableHighLatencyRoutes = async () => {
    const targets = rows.filter((m) => m.breachStatus === "Blocked" || m.breachStatus === "Critical" || m.routeBlocked).slice(0, 10);
    for (const t of targets) {
      await actions.blockRoute.mutateAsync(t.metricId);
    }
  };

  const titleBadge = summary.data?.latencyRiskScore?.score != null ? (
    <Badge variant={variant(summary.data.latencyRiskScore.rating)}>
      <Activity className="h-3.5 w-3.5" />
      Overall {summary.data.latencyRiskScore.score}/100
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
                <h1 className="text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">Latency Monitor</h1>
                {titleBadge}
                <Badge variant={streamConnected ? "success" : "secondary"}>
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {streamConnected ? "Live" : "Polling"}
                </Badge>
              </div>
              <p className="mt-2 max-w-5xl text-sm font-semibold text-slate-700 sm:text-base">
                Real-time latency intelligence across terminals, brokers, EA bridges, market feeds, routing channels, queues, and execution feedback.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase text-slate-500">Role</span>
                <select value={role} onChange={(e) => setRole(e.target.value as Mt5Role)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900">
                  {(["Super Admin", "Infrastructure Admin", "Risk Manager", "Trading Admin", "Analyst", "Read-Only Viewer"] as Mt5Role[]).map((r) => (
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
                  Refresh Latency
                </Button>
                <Button variant="secondary" onClick={refresh} disabled={!can(role, "refresh")}>
                  <RefreshCw className="h-4 w-4" />
                  Sync Latency Metrics
                </Button>
                <Button onClick={() => actions.runLatencyDiagnostics.mutate()} disabled={!can(role, "diagnostics")}>
                  <Wrench className="h-4 w-4" />
                  Run Latency Diagnostics
                </Button>
                <Button variant="secondary" onClick={() => actions.runPingTest.mutate(selected?.metricId)} disabled={!can(role, "tests")}>
                  <Wrench className="h-4 w-4" />
                  Test Broker Ping
                </Button>
                <Button variant="secondary" onClick={() => actions.runRoundTripTest.mutate(selected?.metricId)} disabled={!can(role, "tests")}>
                  <Wrench className="h-4 w-4" />
                  Test EA Bridge Round Trip
                </Button>
              </div>
              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                <Button onClick={disableHighLatencyRoutes} disabled={!can(role, "block")}>
                  <ShieldAlert className="h-4 w-4" />
                  Disable High-Latency Routes
                </Button>
                <Button variant="secondary" onClick={() => toggleDetailPanel()} disabled={!can(role, "refresh")}>
                  <SlidersHorizontal className="h-4 w-4" />
                  Toggle Panel
                </Button>
                <Button onClick={exportReport} disabled={!can(role, "export")}>
                  <Download className="h-4 w-4" />
                  Export Latency Report
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
          { label: "Overall Average Latency", value: formatMs(stats.avg), tone: stats.avg > 220 ? "Critical" : stats.avg > 140 ? "Degraded" : "Healthy", detail: "Average current latency across metrics" },
          { label: "Broker Average Latency", value: formatMs(stats.brokerAvg), tone: stats.brokerAvg > 220 ? "Critical" : stats.brokerAvg > 140 ? "Degraded" : "Healthy", detail: "Across broker comparison table" },
          { label: "EA Bridge Round Trip Latency", value: formatMs(stats.bridgeAvg), tone: stats.bridgeAvg > 190 ? "Degraded" : "Healthy", detail: "Round trip latency proxy" },
          { label: "Terminal Heartbeat Delay", value: formatMs(stats.heartbeatAvg), tone: stats.heartbeatAvg > 160 ? "Degraded" : "Healthy", detail: "Heartbeat delay proxy" },
          { label: "Market Data Delay", value: formatMs(stats.marketAvg), tone: stats.marketAvg > 200 ? "Degraded" : "Healthy", detail: "Feed delay proxy" },
          { label: "Order Routing Delay", value: formatMs(stats.routingAvg), tone: stats.routingAvg > 180 ? "Degraded" : "Healthy", detail: "Routing delay proxy" },
          { label: "Execution Queue Delay", value: formatMs(stats.queueAvg), tone: stats.queueAvg > 240 ? "Degraded" : "Healthy", detail: "Queue delay proxy" },
          { label: "MT5 Execution Response Time", value: formatMs(stats.feedbackAvg), tone: stats.feedbackAvg > 240 ? "Degraded" : "Healthy", detail: "Execution feedback delay proxy" },
          { label: "Highest Latency Broker", value: stats.highestBroker?.broker ?? "—", tone: stats.highestBroker && stats.highestBroker.p99LatencyMs > 350 ? "Critical" : "Watch", detail: stats.highestBroker ? `P99 ${formatMs(stats.highestBroker.p99LatencyMs)}` : "—" },
          { label: "Highest Latency Terminal", value: stats.highestTerminal?.terminal ?? "—", tone: stats.highestTerminal && stats.highestTerminal.currentLatencyMs > 320 ? "Critical" : "Watch", detail: stats.highestTerminal ? `${stats.highestTerminal.componentType}` : "—" },
          { label: "Latency Breach Count", value: String(stats.breaches), tone: stats.breaches > 0 ? "Degraded" : "Healthy", detail: "Warning/Critical/Blocked or route blocked" },
          { label: "Latency Risk Score", value: `${stats.riskScore}/100`, tone: stats.riskScore >= 75 ? "Healthy" : stats.riskScore >= 60 ? "Degraded" : "Critical", detail: summary.data?.latencyRiskScore.rating ?? "—" }
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
                <p className="text-xs font-semibold uppercase text-blue-600">Latency Workflow</p>
                <CardTitle className="mt-1 text-2xl">Ping-to-risk workflow intelligence</CardTitle>
                <CardDescription className="mt-2 max-w-4xl">
                  Ping sent → broker response → EA bridge round trip → market tick received → order routed → queue processed → MT5 executed → feedback returned → latency scored → risk logged.
                </CardDescription>
              </div>
              <Badge variant="secondary">{workflow.data?.meta.timestamp ? formatIso(workflow.data.meta.timestamp) : "—"}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <WorkflowGrid nodes={(workflow.data?.workflow ?? []) as LatencyWorkflowNode[]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase text-blue-600">Latency Charts</p>
              <CardTitle className="mt-1 text-2xl">Selected broker trend</CardTitle>
              <CardDescription className="mt-2">Current latency and p95/p99 for the selected broker + latency type.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {selected ? <TrendMiniChart points={trendPoints} brokerId={selected.brokerId} latencyType={selected.latencyType} /> : <div className="text-sm font-semibold text-slate-600">Select a metric row.</div>}
          </CardContent>
        </Card>
      </section>

      <div className={cn("grid gap-4", showDetailPanel ? "xl:grid-cols-[1.35fr_0.65fr]" : "")}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Latency Monitor Table</p>
                <CardTitle className="mt-1 text-2xl">Real-time latency metrics and route safety</CardTitle>
                <CardDescription className="mt-2">Search, sort, filter, run tests, and block unsafe routes.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="latency-search">
                  Search metrics
                </label>
                <input
                  id="latency-search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search component, broker, type, status…"
                  className="h-10 w-72 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400"
                />
                <select value={componentFilter} onChange={(e) => setComponentFilter(e.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900">
                  <option value="all">All components</option>
                  {components.map((c) => (
                    <option key={c} value={c}>
                      {c}
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
                <select value={breachFilter} onChange={(e) => setBreachFilter(e.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900">
                  <option value="all">All status</option>
                  {["Normal", "Warning", "Critical", "Blocked"].map((s) => (
                    <option key={s} value={s}>
                      Breach: {s}
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
              <table aria-label="Latency metrics" className="min-w-[2400px] table-fixed border-collapse bg-white">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr className="border-b border-slate-200">
                    {[
                      { key: "metricId", label: "Metric ID", w: "w-[150px]" },
                      { key: "componentType", label: "Component Type", w: "w-[170px]" },
                      { key: "componentName", label: "Component Name", w: "w-[240px]" },
                      { key: "broker", label: "Broker", w: "w-[160px]" },
                      { key: "account", label: "Account", w: "w-[180px]" },
                      { key: "terminal", label: "Terminal", w: "w-[170px]" },
                      { key: "eaInstance", label: "EA Instance", w: "w-[150px]" },
                      { key: "symbol", label: "Symbol", w: "w-[110px]" },
                      { key: "latencyType", label: "Latency Type", w: "w-[170px]" },
                      { key: "currentLatencyMs", label: "Current", w: "w-[120px]" },
                      { key: "averageLatencyMs", label: "Average", w: "w-[120px]" },
                      { key: "minimumLatencyMs", label: "Min", w: "w-[120px]" },
                      { key: "maximumLatencyMs", label: "Max", w: "w-[120px]" },
                      { key: "p95LatencyMs", label: "P95", w: "w-[110px]" },
                      { key: "p99LatencyMs", label: "P99", w: "w-[110px]" },
                      { key: "breachStatus", label: "Breach", w: "w-[130px]" },
                      { key: "trendDirection", label: "Trend", w: "w-[110px]" },
                      { key: "lastMeasuredAt", label: "Last Measured", w: "w-[190px]" },
                      { key: "riskLevel", label: "Risk", w: "w-[120px]" },
                      { key: "routeBlocked", label: "Route", w: "w-[120px]" },
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
                  {sortedRows.map((m) => (
                    <tr key={m.id} className={cn("border-b border-slate-100 hover:bg-slate-50", selectedMetricId === m.metricId ? "bg-blue-50/40" : "")}>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => {
                            setSelectedMetricId(m.metricId);
                            setSelectedThresholdId(m.thresholdId);
                            setDetailTab("Identity");
                          }}
                        >
                          {m.metricId}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">{m.componentType}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{m.componentName}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{m.broker ?? "—"}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{m.account ?? "—"}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{m.terminal ?? "—"}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{m.eaInstance ?? "—"}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{m.symbol ?? "—"}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{m.latencyType}</td>
                      <td className="px-3 py-2 text-sm">
                        <Badge variant={variant(m.breachStatus)}>{formatMs(m.currentLatencyMs)}</Badge>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatMs(m.averageLatencyMs)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatMs(m.minimumLatencyMs)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatMs(m.maximumLatencyMs)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatMs(m.p95LatencyMs)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatMs(m.p99LatencyMs)}</td>
                      <td className="px-3 py-2 text-sm">
                        <Badge variant={variant(m.breachStatus)}>{m.breachStatus}</Badge>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <Badge variant={variant(m.trendDirection)}>{m.trendDirection}</Badge>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatIso(m.lastMeasuredAt)}</td>
                      <td className="px-3 py-2 text-sm">
                        <Badge variant={variant(m.riskLevel)}>{m.riskLevel}</Badge>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <Badge variant={m.routeBlocked ? "destructive" : "success"}>{m.routeBlocked ? "Blocked" : "Active"}</Badge>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="flex flex-wrap gap-1.5">
                          <Button size="sm" variant="secondary" onClick={() => actions.runPingTest.mutate(m.metricId)} disabled={!can(role, "tests")}>
                            Ping
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => actions.runRoundTripTest.mutate(m.metricId)} disabled={!can(role, "tests")}>
                            Round Trip
                          </Button>
                          <Button size="sm" onClick={() => actions.blockRoute.mutate(m.metricId)} disabled={!can(role, "block")}>
                            Disable Route
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => actions.unblockRoute.mutate(m.metricId)} disabled={!can(role, "block")}>
                            Enable Route
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!sortedRows.length ? (
                    <tr>
                      <td colSpan={21} className="px-3 py-10 text-center text-sm font-semibold text-slate-500">
                        No metrics match the current filters.
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
                  <p className="text-xs font-semibold uppercase text-blue-600">Latency Detail Panel</p>
                  <CardTitle className="mt-1 text-2xl">{selected ? selected.metricId : "Select a metric"}</CardTitle>
                  <CardDescription className="mt-2">Identity, metrics, trading impact, threshold, and history.</CardDescription>
                </div>
                {selected ? (
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={variant(selected.breachStatus)}>{selected.breachStatus}</Badge>
                    <Badge variant={selected.routeBlocked ? "destructive" : "success"}>{selected.routeBlocked ? "Route Blocked" : "Route Active"}</Badge>
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(["Identity", "Metrics", "Impact", "Threshold", "History"] as DetailTab[]).map((t) => (
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

              {!selected ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">Select a metric row to view details.</div>
              ) : detailTab === "Identity" ? (
                <div className="grid gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">Component</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{selected.componentType}</p>
                    <p className="mt-1 text-sm text-slate-700">{selected.componentName}</p>
                    <Separator className="my-3" />
                    <div className="grid gap-2 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">Broker</span>
                        <span className="font-semibold text-slate-950">{selected.broker ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">Terminal</span>
                        <span className="font-semibold text-slate-950">{selected.terminal ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">EA Instance</span>
                        <span className="font-semibold text-slate-950">{selected.eaInstance ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : detailTab === "Metrics" ? (
                <div className="grid gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-500">Current latency</p>
                        <p className="mt-1 text-xl font-semibold text-slate-950">{formatMs(selected.currentLatencyMs)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">Avg {formatMs(selected.averageLatencyMs)}</Badge>
                        <Badge variant="secondary">P95 {formatMs(selected.p95LatencyMs)}</Badge>
                        <Badge variant="secondary">P99 {formatMs(selected.p99LatencyMs)}</Badge>
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-700">
                      Jitter {formatMs(selected.jitterMs)} · timeouts {selected.timeoutCount} · trend {selected.trendDirection}
                    </p>
                  </div>
                </div>
              ) : detailTab === "Impact" ? (
                <div className="grid gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">Trading impact</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">
                      Order routing impact: {selected.latencyType === "Order Routing" ? "High" : "Moderate"} · Execution timing impact:{" "}
                      {selected.latencyType === "Execution Feedback" || selected.latencyType === "Execution Queue" ? "High" : "Moderate"} · Market data freshness impact:{" "}
                      {selected.latencyType === "Market Data" ? "High" : "Moderate"}.
                    </p>
                    <p className="mt-3 text-sm font-semibold text-slate-700">Scalping suitability: {selected.currentLatencyMs <= 140 ? "Suitable" : "Unsuitable"} · News trading suitability: {selected.currentLatencyMs <= 180 ? "Watch" : "Avoid"}.</p>
                  </div>
                </div>
              ) : detailTab === "Threshold" ? (
                selectedThreshold ? (
                  <ThresholdEditor threshold={selectedThreshold} disabled={!can(role, "thresholds")} onSave={(patch) => actions.updateThreshold.mutate({ thresholdId: selectedThreshold.id, patch })} />
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">No threshold selected.</div>
                )
              ) : (
                <div className="grid gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">History</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">Latency trend history for broker + latency type.</p>
                  </div>
                  <TrendMiniChart points={trendPoints} brokerId={selected.brokerId} latencyType={selected.latencyType} />
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Broker Latency Comparison</p>
                <CardTitle className="mt-1 text-2xl">Broker ranking and recommended use</CardTitle>
                <CardDescription className="mt-2">Average, p95/p99, packet loss, stability score, and recommended posture.</CardDescription>
              </div>
              <Badge variant="secondary">
                <AlertTriangle className="h-3.5 w-3.5" />
                {brokerRows.length} brokers
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-xl border border-slate-200">
              <table aria-label="Broker latency comparison" className="min-w-[1300px] table-fixed border-collapse bg-white">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="w-[60px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Rank</th>
                    <th className="w-[180px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Broker</th>
                    <th className="w-[100px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Region</th>
                    <th className="w-[140px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Avg</th>
                    <th className="w-[140px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">P95</th>
                    <th className="w-[140px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">P99</th>
                    <th className="w-[140px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Packet loss</th>
                    <th className="w-[160px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Stability</th>
                    <th className="w-[300px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Recommended use</th>
                  </tr>
                </thead>
                <tbody>
                  {brokerRows.map((b) => (
                    <tr key={b.brokerId} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{b.rank}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{b.broker}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{b.serverRegion}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatMs(b.averageLatencyMs)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatMs(b.p95LatencyMs)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatMs(b.p99LatencyMs)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatNumber(b.packetLossPercent, 2)}%</td>
                      <td className="px-3 py-2 text-sm">
                        <Badge variant={b.stabilityScore >= 75 ? "success" : b.stabilityScore >= 60 ? "warning" : "destructive"}>{b.stabilityScore}/100</Badge>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">{b.recommendedUse}</td>
                    </tr>
                  ))}
                  {!brokerRows.length ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-10 text-center text-sm font-semibold text-slate-500">
                        No broker comparison data.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Latency Threshold Management</p>
                <CardTitle className="mt-1 text-2xl">Threshold registry</CardTitle>
                <CardDescription className="mt-2">Configure thresholds by component type, broker, session, and strategy.</CardDescription>
              </div>
              <Badge variant="secondary">{thresholdRows.length} thresholds</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[420px] rounded-xl border border-slate-200 bg-white">
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
                      className={cn("flex flex-col gap-1 rounded-xl border px-3 py-2 text-left", selectedThreshold?.id === t.id ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50")}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-950">{t.componentType}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{t.brokerId ?? "All brokers"}</Badge>
                          <Badge variant="secondary">{t.strategyType}</Badge>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                        <span>Warn {formatMs(t.warningLatencyLimitMs)}</span>
                        <span>Crit {formatMs(t.criticalLatencyLimitMs)}</span>
                        <span>Block {formatMs(t.executionBlockLatencyMs)}</span>
                      </div>
                    </button>
                  ))}
                  {!thresholdRows.length ? <div className="py-12 text-center text-sm font-semibold text-slate-500">No thresholds.</div> : null}
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Latency Alerts & Logs</p>
                <CardTitle className="mt-1 text-2xl">Breach and route-block audit surface</CardTitle>
                <CardDescription className="mt-2">Track alerts, root cause, resolution status, and operator actions.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase text-slate-500">Filter</span>
                <select value={alertFilter} onChange={(e) => setAlertFilter(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900">
                  {[
                    "All",
                    "Warning",
                    "Critical",
                    "Broker Latency",
                    "EA Bridge Delay",
                    "Terminal Delay",
                    "Market Data Delay",
                    "Order Router Delay",
                    "Execution Queue Delay",
                    "Execution Feedback Delay",
                    "Route Blocked",
                    "Resolved",
                    "Unresolved"
                  ].map((f) => (
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
              <table aria-label="Latency alerts" className="min-w-[1200px] table-fixed border-collapse bg-white">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="w-[180px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Timestamp</th>
                    <th className="w-[220px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Component</th>
                    <th className="w-[160px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Broker</th>
                    <th className="w-[160px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Latency Type</th>
                    <th className="w-[150px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Current</th>
                    <th className="w-[170px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Alert Type</th>
                    <th className="w-[140px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Severity</th>
                    <th className="w-[260px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Root Cause</th>
                  </tr>
                </thead>
                <tbody>
                  {alertRows.slice(0, 60).map((a) => (
                    <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-sm text-slate-700">{formatIso(a.timestamp)}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{a.componentName}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{a.broker ?? "—"}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{a.latencyType}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{formatMs(a.currentLatencyMs)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{a.alertType}</td>
                      <td className="px-3 py-2 text-sm">
                        <Badge variant={variant(a.severity)}>{a.severity}</Badge>
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
              <table aria-label="Latency logs" className="min-w-[1100px] table-fixed border-collapse bg-white">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="w-[180px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Timestamp</th>
                    <th className="w-[180px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Event</th>
                    <th className="w-[140px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Severity</th>
                    <th className="w-[160px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Metric</th>
                    <th className="w-[320px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Message</th>
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
                      <td className="px-3 py-2 text-sm text-slate-700">{l.metricId}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{l.message}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{l.actionTaken}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">AI Latency Diagnostics</p>
                <CardTitle className="mt-1 text-2xl">Bottleneck detection and auto-block posture</CardTitle>
                <CardDescription className="mt-2">Detect spikes, timeouts, jitter instability, and route unsuitability for scalping/news.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={diagnostics.data?.diagnostics?.some((d) => d.severity === "Critical") ? "destructive" : "secondary"}>
                  <TriangleAlert className="h-3.5 w-3.5" />
                  {diagnostics.data?.diagnostics?.length ?? 0} findings
                </Badge>
                <Button variant="secondary" onClick={() => actions.autoFix.mutate()} disabled={!can(role, "diagnostics")}>
                  <Wrench className="h-4 w-4" />
                  Auto-Remediate
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DiagnosticsTable rows={(diagnostics.data?.diagnostics ?? []) as AiLatencyDiagnostic[]} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
