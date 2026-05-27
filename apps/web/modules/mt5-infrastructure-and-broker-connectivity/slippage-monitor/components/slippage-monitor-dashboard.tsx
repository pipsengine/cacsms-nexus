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
import { SLIPPAGE_AUTONOMOUS_NOTICE } from "@/lib/mt5-autonomous";
import { useSlippageMonitor } from "../hooks/use-slippage-monitor";
import { useSlippageMonitorStore } from "../stores/slippage-monitor.store";
import type { AiSlippageDiagnostic, BrokerSlippageComparisonRow, SlippageAlert, SlippageExecution, SlippageThreshold, SlippageTrendPoint, SlippageWorkflowNode } from "../types/slippage-monitor.types";
import { formatIso, formatMs, formatNumber, formatPips, formatPoints } from "../utils/slippage-monitor.mappers";

type SortKey =
  | "executionId"
  | "orderId"
  | "mt5Ticket"
  | "account"
  | "broker"
  | "terminal"
  | "eaInstance"
  | "normalizedSymbol"
  | "assetClass"
  | "direction"
  | "orderType"
  | "requestedPrice"
  | "executedPrice"
  | "slippagePoints"
  | "slippagePips"
  | "slippageValue"
  | "executionTimeMs"
  | "spreadAtExecution"
  | "marketVolatilityScore"
  | "breachStatus"
  | "executionQuality"
  | "riskLevel"
  | "createdAt";
type SortDir = "asc" | "desc";
type DetailTab = "Identity" | "Price" | "Context" | "Risk" | "Alerts";

function variant(value: string) {
  const s = value.toLowerCase();
  if (s.includes("excellent") || s.includes("good") || s.includes("healthy") || s.includes("low") || s.includes("normal")) return "success" as const;
  if (s.includes("watch") || s.includes("moderate") || s.includes("warning") || s.includes("elevated")) return "warning" as const;
  if (s.includes("degraded") || s.includes("high")) return "warning" as const;
  if (s.includes("critical") || s.includes("blocked") || s.includes("poor")) return "destructive" as const;
  return "secondary" as const;
}

function can(role: Mt5Role, action: "refresh" | "diagnostics" | "thresholds" | "disableUnsafe" | "export") {
  if (action === "export" || action === "refresh") return true;
  if (action === "diagnostics") return role === "Super Admin" || role === "Trading Admin" || role === "Risk Manager" || role === "Analyst";
  if (action === "thresholds") return role === "Super Admin" || role === "Trading Admin" || role === "Risk Manager";
  return role === "Super Admin" || role === "Risk Manager";
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

function kpis(executions: SlippageExecution[], comparisons: BrokerSlippageComparisonRow[]) {
  const total = executions.length;
  const positive = executions.filter((e) => e.slippagePips > 0.05).length;
  const negative = executions.filter((e) => e.slippagePips < -0.05).length;
  const avgSlip = total ? executions.reduce((s, e) => s + e.slippagePips, 0) / total : 0;
  const worstSymbol = [...executions].sort((a, b) => Math.abs(b.slippagePips) - Math.abs(a.slippagePips))[0];
  const byBroker = new Map<string, { broker: string; worst: number; avg: number; count: number }>();
  for (const e of executions) {
    const prev = byBroker.get(e.brokerId) ?? { broker: e.broker, worst: 0, avg: 0, count: 0 };
    byBroker.set(e.brokerId, { broker: e.broker, worst: Math.max(prev.worst, Math.abs(e.slippagePips)), avg: prev.avg + Math.abs(e.slippagePips), count: prev.count + 1 });
  }
  const brokerStats = [...byBroker.values()].map((b) => ({ ...b, avg: b.count ? b.avg / b.count : 0 }));
  const worstBroker = [...brokerStats].sort((a, b) => b.worst - a.worst)[0];
  const bestBroker = [...comparisons].sort((a, b) => b.executionQualityRank - a.executionQualityRank)[0];
  const breaches = executions.filter((e) => e.breachStatus === "Warning" || e.breachStatus === "Critical" || e.breachStatus === "Blocked").length;
  const blocked = executions.filter((e) => !e.executionAllowed).length;
  const avgExec = total ? executions.reduce((s, e) => s + e.executionTimeMs, 0) / total : 0;
  const execQuality = total ? executions.reduce((s, e) => s + e.executionQualityScore, 0) / total : 0;
  const risk = Math.min(100, Math.round(blocked * 12 + breaches * 2 + Math.max(0, 70 - execQuality) + avgExec / 40));
  const riskScore = Math.max(0, Math.min(100, 100 - risk));
  return {
    total,
    positive,
    negative,
    avgSlip,
    worstSymbol,
    worstBroker,
    bestBroker,
    breaches,
    blocked,
    avgExec,
    execQuality: Math.round(execQuality),
    riskScore
  };
}

function WorkflowGrid({ nodes }: { nodes: SlippageWorkflowNode[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {nodes.map((n) => (
        <div key={n.title} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">{n.title}</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {n.orderCount} orders · {n.failedCount} flagged
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-600">Avg delay {formatNumber(n.averageDelayMs, 0)}ms</p>
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

function TrendMiniChart({ points, brokerId, normalizedSymbol }: { points: SlippageTrendPoint[]; brokerId: string; normalizedSymbol: string }) {
  const data = points.filter((p) => p.brokerId === brokerId && p.normalizedSymbol === normalizedSymbol).slice(0, 30).reverse();
  if (!data.length) return <div className="text-xs font-semibold text-slate-500">No trend data.</div>;
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="measuredAt" hide />
          <YAxis width={42} tick={{ fontSize: 11 }} />
          <RechartsTooltip formatter={(value: any) => [`${Number(value).toFixed(2)} pips`, "Slippage"]} labelFormatter={(label) => formatIso(String(label))} />
          <Line type="monotone" dataKey="slippagePips" stroke="#2563eb" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ThresholdEditor({ threshold, onSave, disabled }: { threshold: SlippageThreshold; onSave: (patch: Partial<SlippageThreshold>) => void; disabled: boolean }) {
  const [draft, setDraft] = React.useState(() => ({
    normalLimitPips: threshold.normalLimitPips,
    warningLimitPips: threshold.warningLimitPips,
    criticalLimitPips: threshold.criticalLimitPips,
    executionBlockLimitPips: threshold.executionBlockLimitPips,
    maxRetrySlippagePips: threshold.maxRetrySlippagePips,
    newsMultiplier: threshold.newsMultiplier,
    autoDisableEnabled: threshold.autoDisableEnabled
  }));

  React.useEffect(() => {
    setDraft({
      normalLimitPips: threshold.normalLimitPips,
      warningLimitPips: threshold.warningLimitPips,
      criticalLimitPips: threshold.criticalLimitPips,
      executionBlockLimitPips: threshold.executionBlockLimitPips,
      maxRetrySlippagePips: threshold.maxRetrySlippagePips,
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
        {field("Max Retry Slippage (pips)", draft.maxRetrySlippagePips, (v) => setDraft((d) => ({ ...d, maxRetrySlippagePips: v })))}
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
              maxRetrySlippagePips: draft.maxRetrySlippagePips,
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

function DiagnosticsTable({ rows }: { rows: AiSlippageDiagnostic[] }) {
  return (
    <div className="overflow-auto rounded-xl border border-slate-200">
      <table aria-label="AI slippage diagnostics" className="min-w-[1100px] table-fixed border-collapse bg-white">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            <th className="w-[260px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Issue</th>
            <th className="w-[260px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Affected</th>
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

export function SlippageMonitorDashboard() {
  const client = useQueryClient();
  const { streamConnected, summary, workflow, executions, execution, brokerComparison, trends, thresholds, alerts, logs, diagnostics, actions } = useSlippageMonitor();

  const role = useSlippageMonitorStore((s) => s.role);
  const setRole = useSlippageMonitorStore((s) => s.setRole);
  const searchTerm = useSlippageMonitorStore((s) => s.searchTerm);
  const setSearchTerm = useSlippageMonitorStore((s) => s.setSearchTerm);
  const assetFilter = useSlippageMonitorStore((s) => s.assetFilter);
  const setAssetFilter = useSlippageMonitorStore((s) => s.setAssetFilter);
  const breachFilter = useSlippageMonitorStore((s) => s.breachFilter);
  const setBreachFilter = useSlippageMonitorStore((s) => s.setBreachFilter);
  const brokerFilter = useSlippageMonitorStore((s) => s.brokerFilter);
  const setBrokerFilter = useSlippageMonitorStore((s) => s.setBrokerFilter);
  const selectedExecutionId = useSlippageMonitorStore((s) => s.selectedExecutionId);
  const setSelectedExecutionId = useSlippageMonitorStore((s) => s.setSelectedExecutionId);
  const selectedThresholdId = useSlippageMonitorStore((s) => s.selectedThresholdId);
  const setSelectedThresholdId = useSlippageMonitorStore((s) => s.setSelectedThresholdId);
  const showDetailPanel = useSlippageMonitorStore((s) => s.showDetailPanel);
  const toggleDetailPanel = useSlippageMonitorStore((s) => s.toggleDetailPanel);
  const alertFilter = useSlippageMonitorStore((s) => s.alertFilter);
  const setAlertFilter = useSlippageMonitorStore((s) => s.setAlertFilter);

  const execRows = executions.data?.executions ?? [];
  const workflowNodes = workflow.data?.workflow ?? [];
  const thresholdRows = thresholds.data?.thresholds ?? [];
  const alertRows = alerts.data?.alerts ?? [];
  const trendPoints = trends.data?.points ?? [];
  const comparisons = brokerComparison.data?.comparisons ?? [];

  const stats = kpis(execRows, comparisons);
  const brokers = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const e of execRows) map.set(e.brokerId, e.broker);
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [execRows]);

  const selected = execution.data?.execution ?? (selectedExecutionId ? execRows.find((e) => e.executionId === selectedExecutionId) ?? null : null);
  const selectedThreshold = React.useMemo(() => {
    if (selectedThresholdId) return thresholdRows.find((t) => t.id === selectedThresholdId) ?? null;
    if (selected) return thresholdRows.find((t) => t.id === selected.thresholdId) ?? null;
    return null;
  }, [selectedThresholdId, selected, thresholdRows]);

  const [sortKey, setSortKey] = React.useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [detailTab, setDetailTab] = React.useState<DetailTab>("Identity");

  const sortedRows = React.useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const get = (row: SlippageExecution) => (row as any)[sortKey];
    return [...execRows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
  }, [execRows, sortKey, sortDir]);

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["slippage-monitor"] });
  };

  const exportReport = () => {
    const snapshot = {
      generatedAt: new Date().toISOString(),
      summary: summary.data,
      workflow: workflow.data,
      executions: execRows,
      thresholds: thresholdRows,
      alerts: alertRows.slice(0, 80),
      diagnostics: diagnostics.data?.diagnostics ?? []
    };
    downloadText(`slippage-monitor-${new Date().toISOString().slice(0, 19).replace(/[:]/g, "")}.json`, JSON.stringify(snapshot, null, 2));
  };

  const exportCsv = () => {
    const rows = execRows.map((e) => ({
      executionId: e.executionId,
      orderId: e.orderId,
      mt5Ticket: e.mt5Ticket ?? "",
      broker: e.broker,
      account: e.account,
      symbol: e.symbol,
      normalizedSymbol: e.normalizedSymbol,
      direction: e.direction,
      orderType: e.orderType,
      requestedPrice: e.requestedPrice,
      executedPrice: e.executedPrice,
      slippagePoints: e.slippagePoints,
      slippagePips: e.slippagePips,
      slippageValue: e.slippageValue,
      executionTimeMs: e.executionTimeMs,
      spreadAtExecution: e.spreadAtExecution,
      marketVolatilityScore: e.marketVolatilityScore,
      breachStatus: e.breachStatus,
      executionQuality: e.executionQuality,
      riskLevel: e.riskLevel,
      executionAllowed: e.executionAllowed,
      createdAt: e.createdAt
    }));
    downloadText(`slippage-monitor-${new Date().toISOString().slice(0, 19).replace(/[:]/g, "")}.csv`, toCsv(rows), "text/csv");
  };

  const titleBadge = summary.data?.slippageRiskScore?.score != null ? (
    <Badge variant={variant(summary.data.slippageRiskScore.rating)}>
      <Activity className="h-3.5 w-3.5" />
      Overall {summary.data.slippageRiskScore.score}/100
    </Badge>
  ) : null;

  if (summary.isError || executions.isError) {
    return (
      <div className="mx-auto max-w-[1800px] px-4 py-6">
        <Card className="border-red-200 p-6">
          <h1 className="text-xl font-semibold">Slippage Monitor unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">Execution slippage telemetry could not be loaded.</p>
          <Button className="mt-4" onClick={refresh}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (summary.isLoading && !summary.data) {
    return <div className="mx-auto max-w-[1800px] px-4 py-6 text-sm text-slate-600">Loading slippage monitor telemetry...</div>;
  }

  const hasExecutions = execRows.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="h-1.5 w-full rounded-t-2xl bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500" />
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">Slippage Monitor</h1>
                {titleBadge}
                <Badge variant={streamConnected ? "success" : "secondary"}>
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {streamConnected ? "Live" : "Polling"}
                </Badge>
              </div>
              <p className="mt-2 max-w-5xl text-sm font-semibold text-slate-700 sm:text-base">
                Real-time slippage intelligence, execution quality monitoring, broker comparison, and slippage-based trade safety control.
              </p>
              <p className="mt-3 text-xs text-slate-500">{SLIPPAGE_AUTONOMOUS_NOTICE}</p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase text-slate-500">Role</span>
                <select value={role} onChange={(e) => setRole(e.target.value as Mt5Role)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900">
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
                  Refresh Slippage
                </Button>
                <Button onClick={() => actions.runSlippageDiagnostics.mutate()} disabled={!can(role, "diagnostics")}>
                  <Wrench className="h-4 w-4" />
                  Run Slippage Diagnostics
                </Button>
                <Button variant="secondary" onClick={() => toggleDetailPanel()} disabled={!can(role, "refresh")}>
                  <SlidersHorizontal className="h-4 w-4" />
                  Toggle Panel
                </Button>
              </div>
              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                <Button onClick={() => actions.disableUnsafe.mutate()} disabled={!can(role, "disableUnsafe")}>
                  <ShieldAlert className="h-4 w-4" />
                  Disable Unsafe Execution
                </Button>
                <Button onClick={exportReport} disabled={!can(role, "export")}>
                  <Download className="h-4 w-4" />
                  Export Slippage Report
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
          { label: "Total Executed Orders", value: String(stats.total), tone: "Healthy", detail: "Executions sampled in the current window" },
          { label: "Orders With Positive Slippage", value: String(stats.positive), tone: "Healthy", detail: "Executed better than requested" },
          { label: "Orders With Negative Slippage", value: String(stats.negative), tone: stats.negative > 0 ? "Watch" : "Healthy", detail: "Executed worse than requested" },
          { label: "Average Slippage", value: formatPips(stats.avgSlip), tone: Math.abs(stats.avgSlip) > 0.9 ? "Degraded" : "Healthy", detail: "Mean signed slippage (pips)" },
          { label: "Worst Slippage Symbol", value: stats.worstSymbol?.normalizedSymbol ?? "—", tone: stats.worstSymbol && Math.abs(stats.worstSymbol.slippagePips) > 1.8 ? "Critical" : "Watch", detail: stats.worstSymbol ? formatPips(stats.worstSymbol.slippagePips) : "—" },
          { label: "Worst Slippage Broker", value: stats.worstBroker?.broker ?? "—", tone: stats.worstBroker && stats.worstBroker.worst > 2.2 ? "Degraded" : "Watch", detail: stats.worstBroker ? `Worst ${formatPips(stats.worstBroker.worst)}` : "—" },
          { label: "Best Execution Broker", value: stats.bestBroker?.broker ?? "—", tone: "Healthy", detail: stats.bestBroker ? `${stats.bestBroker.executionQualityRank}/100` : "—" },
          { label: "Slippage Breach Count", value: String(stats.breaches), tone: stats.breaches > 0 ? "Degraded" : "Healthy", detail: "Warning/Critical/Blocked" },
          { label: "Blocked Executions", value: String(stats.blocked), tone: stats.blocked > 0 ? "Critical" : "Healthy", detail: "Executions blocked by slippage controls" },
          { label: "Average Execution Time", value: formatMs(stats.avgExec), tone: stats.avgExec > 800 ? "Degraded" : stats.avgExec > 450 ? "Watch" : "Healthy", detail: "Latency across executions" },
          { label: "Execution Quality Score", value: `${stats.execQuality}/100`, tone: stats.execQuality >= 75 ? "Healthy" : stats.execQuality >= 60 ? "Degraded" : "Critical", detail: "Composite quality score" },
          { label: "Slippage Risk Score", value: `${stats.riskScore}/100`, tone: stats.riskScore >= 75 ? "Healthy" : stats.riskScore >= 60 ? "Degraded" : "Critical", detail: summary.data?.slippageRiskScore.rating ?? "—" }
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

      {!hasExecutions ? (
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="p-6 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Waiting for live executions</p>
            <p className="mt-2">{SLIPPAGE_AUTONOMOUS_NOTICE}</p>
            <p className="mt-2">
              When NexusBridgeEA confirms a routed trade (for example on GBPUSD), slippage metrics, broker comparison, and threshold checks populate here automatically.
              Ensure <code className="rounded bg-white px-1">PollApprovedCommands</code> and <code className="rounded bg-white px-1">EnableCommandExecution</code> are enabled on the EA.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Slippage Workflow</p>
                <CardTitle className="mt-1 text-2xl">Order-to-audit execution workflow</CardTitle>
                <CardDescription className="mt-2 max-w-4xl">
                  Order requested → price captured → MT5 execution → executed price returned → slippage calculated → thresholds/brokers → risk scored → unsafe execution blocked → audit logged.
                </CardDescription>
              </div>
              <Badge variant="secondary">{workflow.data?.meta.timestamp ? formatIso(workflow.data.meta.timestamp) : "—"}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <WorkflowGrid nodes={workflowNodes} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase text-blue-600">Slippage Trend Charts</p>
              <CardTitle className="mt-1 text-2xl">Selected execution trend</CardTitle>
              <CardDescription className="mt-2">Slippage over time for the selected broker + symbol.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {selected ? <TrendMiniChart points={trendPoints} brokerId={selected.brokerId} normalizedSymbol={selected.normalizedSymbol} /> : <div className="text-sm font-semibold text-slate-600">Select an execution row.</div>}
          </CardContent>
        </Card>
      </section>

      <div className={cn("grid gap-4", showDetailPanel ? "xl:grid-cols-[1.45fr_0.55fr]" : "")}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Slippage Monitor Table</p>
                <CardTitle className="mt-1 text-2xl">Execution slippage, thresholds, and risk</CardTitle>
                <CardDescription className="mt-2">Search, filter, compare brokers, and audit execution safety controls.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="slip-search">
                  Search executions
                </label>
                <input
                  id="slip-search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search exec, order, broker, symbol, status…"
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
                <select value={breachFilter} onChange={(e) => setBreachFilter(e.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900">
                  <option value="all">All breach</option>
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
              <table aria-label="Slippage executions" className="min-w-[2600px] table-fixed border-collapse bg-white">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr className="border-b border-slate-200">
                    {[
                      { key: "executionId", label: "Execution ID", w: "w-[180px]" },
                      { key: "orderId", label: "Order ID", w: "w-[170px]" },
                      { key: "mt5Ticket", label: "MT5 Ticket", w: "w-[140px]" },
                      { key: "account", label: "Account", w: "w-[210px]" },
                      { key: "broker", label: "Broker", w: "w-[160px]" },
                      { key: "terminal", label: "Terminal", w: "w-[170px]" },
                      { key: "eaInstance", label: "EA Instance", w: "w-[160px]" },
                      { key: "normalizedSymbol", label: "Symbol", w: "w-[130px]" },
                      { key: "assetClass", label: "Asset", w: "w-[110px]" },
                      { key: "direction", label: "Dir", w: "w-[90px]" },
                      { key: "orderType", label: "Type", w: "w-[130px]" },
                      { key: "requestedPrice", label: "Requested", w: "w-[130px]" },
                      { key: "executedPrice", label: "Executed", w: "w-[130px]" },
                      { key: "slippagePoints", label: "Slip Pts", w: "w-[120px]" },
                      { key: "slippagePips", label: "Slip Pips", w: "w-[120px]" },
                      { key: "slippageValue", label: "Slip $", w: "w-[110px]" },
                      { key: "executionTimeMs", label: "Exec Time", w: "w-[120px]" },
                      { key: "spreadAtExecution", label: "Spread", w: "w-[110px]" },
                      { key: "marketVolatilityScore", label: "Vol", w: "w-[110px]" },
                      { key: "breachStatus", label: "Breach", w: "w-[130px]" },
                      { key: "executionQuality", label: "Quality", w: "w-[130px]" },
                      { key: "riskLevel", label: "Risk", w: "w-[120px]" },
                      { key: "createdAt", label: "Created", w: "w-[190px]" },
                      { key: "actions", label: "Actions", w: "w-[260px]" }
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
                    <tr key={row.id} className={cn("border-b border-slate-100 hover:bg-slate-50", selectedExecutionId === row.executionId ? "bg-blue-50/40" : "")}>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => {
                            setSelectedExecutionId(row.executionId);
                            setSelectedThresholdId(row.thresholdId);
                            setDetailTab("Identity");
                          }}
                        >
                          {row.executionId}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{row.orderId}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{row.mt5Ticket ?? "—"}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{row.account}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{row.broker}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{row.terminal}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{row.eaInstance}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{row.normalizedSymbol}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{row.assetClass}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{row.direction}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{row.orderType}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatNumber(row.requestedPrice, 5)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatNumber(row.executedPrice, 5)}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{formatPoints(row.slippagePoints)}</td>
                      <td className="px-3 py-2 text-sm">
                        <Badge variant={row.slippagePips < -0.05 ? "destructive" : row.slippagePips > 0.05 ? "success" : "secondary"}>{formatPips(row.slippagePips)}</Badge>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatNumber(row.slippageValue, 2)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatMs(row.executionTimeMs)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatNumber(row.spreadAtExecution, 2)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatNumber(row.marketVolatilityScore, 0)}/100</td>
                      <td className="px-3 py-2 text-sm">
                        <Badge variant={variant(row.breachStatus)}>{row.breachStatus}</Badge>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <Badge variant={variant(row.executionQuality)}>{row.executionQuality}</Badge>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <Badge variant={variant(row.riskLevel)}>{row.riskLevel}</Badge>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatIso(row.createdAt)}</td>
                      <td className="px-3 py-2 text-sm">
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedExecutionId(row.executionId);
                              setDetailTab("Identity");
                            }}
                          >
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedExecutionId(row.executionId);
                              setDetailTab("Risk");
                            }}
                          >
                            Risk
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedExecutionId(row.executionId);
                              setDetailTab("Alerts");
                            }}
                          >
                            Alerts
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!sortedRows.length ? (
                    <tr>
                      <td colSpan={24} className="px-3 py-10 text-center text-sm font-semibold text-slate-500">
                        No executions match the current filters.
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
                  <p className="text-xs font-semibold uppercase text-blue-600">Slippage Detail Panel</p>
                  <CardTitle className="mt-1 text-2xl">{selected ? selected.executionId : "Select an execution"}</CardTitle>
                  <CardDescription className="mt-2">Identity, price comparison, context, risk posture, and alerts.</CardDescription>
                </div>
                {selected ? (
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={variant(selected.breachStatus)}>{selected.breachStatus}</Badge>
                    <Badge variant={selected.executionAllowed ? "success" : "destructive"}>{selected.executionAllowed ? "Execution Allowed" : "Execution Blocked"}</Badge>
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(["Identity", "Price", "Context", "Risk", "Alerts"] as DetailTab[]).map((t) => (
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
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">Select an execution from the table to view details.</div>
              ) : detailTab === "Identity" ? (
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Order</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">{selected.orderId}</p>
                      <p className="mt-2 text-xs font-semibold uppercase text-slate-500">MT5 Ticket</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">{selected.mt5Ticket ?? "—"}</p>
                      <p className="mt-2 text-xs font-semibold uppercase text-slate-500">Trade ID</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">{selected.tradeId ?? "—"}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Account / Broker</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">{selected.account}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">{selected.broker}</p>
                      <p className="mt-2 text-xs font-semibold uppercase text-slate-500">Strategy</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">{selected.strategy}</p>
                    </div>
                  </div>
                </div>
              ) : detailTab === "Price" ? (
                <div className="grid gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">Price Comparison</p>
                    <div className="mt-2 grid gap-2 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">Requested</span>
                        <span className="font-semibold text-slate-950">{formatNumber(selected.requestedPrice, 5)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">Executed</span>
                        <span className="font-semibold text-slate-950">{formatNumber(selected.executedPrice, 5)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">Slippage</span>
                        <span className="font-semibold text-slate-950">{formatPips(selected.slippagePips)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">Direction-adjusted</span>
                        <span className="font-semibold text-slate-950">{formatPips(selected.directionAdjustedSlippage)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">Spread at execution</span>
                        <span className="font-semibold text-slate-950">{formatNumber(selected.spreadAtExecution, 2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : detailTab === "Context" ? (
                <div className="grid gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">Market Context</p>
                    <div className="mt-2 grid gap-2 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">Session</span>
                        <span className="font-semibold text-slate-950">{selected.tradingSession}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">News window</span>
                        <span className="font-semibold text-slate-950">{selected.newsWindowActive ? "Active" : "Inactive"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">Volatility</span>
                        <span className="font-semibold text-slate-950">{formatNumber(selected.marketVolatilityScore, 0)}/100</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">Execution latency</span>
                        <span className="font-semibold text-slate-950">{formatMs(selected.executionTimeMs)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : detailTab === "Risk" ? (
                <div className="grid gap-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">Risk Interpretation</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant={variant(selected.breachStatus)}>{selected.breachStatus}</Badge>
                      <Badge variant={variant(selected.executionQuality)}>{selected.executionQuality}</Badge>
                      <Badge variant={variant(selected.riskLevel)}>{selected.riskLevel}</Badge>
                      <Badge variant={selected.executionAllowed ? "success" : "destructive"}>{selected.executionAllowed ? "Allowed" : "Blocked"}</Badge>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-700">
                      Slippage risk aggregates breach status, negative slippage bias, broker comparison posture, latency, spread at execution, and volatility regime.
                    </p>
                  </div>

                  {selectedThreshold ? (
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Threshold Used</p>
                      <div className="mt-2 grid gap-2 text-sm text-slate-700">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">Symbol</span>
                          <span className="font-semibold text-slate-950">{selectedThreshold.normalizedSymbol}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">Warn / Crit / Block</span>
                          <span className="font-semibold text-slate-950">
                            {formatNumber(selectedThreshold.warningLimitPips, 2)} / {formatNumber(selectedThreshold.criticalLimitPips, 2)} / {formatNumber(selectedThreshold.executionBlockLimitPips, 2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">Related Alerts</p>
                    <p className="mt-2 text-sm font-semibold text-slate-700">Alerts related to this execution, broker, and symbol.</p>
                  </div>
                  <div className="overflow-auto rounded-xl border border-slate-200">
                    <table aria-label="Execution alerts" className="min-w-[900px] table-fixed border-collapse bg-white">
                      <thead className="bg-slate-50">
                        <tr className="border-b border-slate-200">
                          <th className="w-[180px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Time</th>
                          <th className="w-[160px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Type</th>
                          <th className="w-[140px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Severity</th>
                          <th className="w-[180px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Slippage</th>
                          <th className="w-[220px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Root Cause</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alertRows
                          .filter((a) => a.executionId === selected.executionId || (a.brokerId === selected.brokerId && a.normalizedSymbol === selected.normalizedSymbol))
                          .slice(0, 14)
                          .map((a) => (
                            <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="px-3 py-2 text-sm text-slate-700">{formatIso(a.timestamp)}</td>
                              <td className="px-3 py-2 text-sm font-semibold text-slate-950">{a.alertType}</td>
                              <td className="px-3 py-2 text-sm">
                                <Badge variant={variant(a.severity)}>{a.severity}</Badge>
                              </td>
                              <td className="px-3 py-2 text-sm font-semibold text-slate-950">{formatPips(a.slippagePips)}</td>
                              <td className="px-3 py-2 text-sm text-slate-700">{a.rootCause}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
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
                <p className="text-xs font-semibold uppercase text-blue-600">Broker Slippage Comparison</p>
                <CardTitle className="mt-1 text-2xl">Broker execution quality ranking</CardTitle>
                <CardDescription className="mt-2">Average/median/worst slippage, rates, latency, and execution quality rank.</CardDescription>
              </div>
              <Badge variant="secondary">
                <AlertTriangle className="h-3.5 w-3.5" />
                {comparisons.length} rows
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-xl border border-slate-200">
              <table aria-label="Broker slippage comparison" className="min-w-[1200px] table-fixed border-collapse bg-white">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="w-[160px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Broker</th>
                    <th className="w-[140px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Symbol</th>
                    <th className="w-[160px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Avg</th>
                    <th className="w-[160px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Median</th>
                    <th className="w-[160px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Worst</th>
                    <th className="w-[140px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Exec</th>
                    <th className="w-[180px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Quality Rank</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.slice(0, 18).map((c) => (
                    <tr key={`${c.brokerId}-${c.normalizedSymbol}`} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{c.broker}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{c.normalizedSymbol}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatPips(c.averageSlippagePips)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatPips(c.medianSlippagePips)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatPips(c.worstSlippagePips)}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{formatMs(c.averageExecutionTimeMs)}</td>
                      <td className="px-3 py-2 text-sm">
                        <Badge variant={c.executionQualityRank >= 75 ? "success" : c.executionQualityRank >= 60 ? "warning" : "destructive"}>{c.executionQualityRank}/100</Badge>
                      </td>
                    </tr>
                  ))}
                  {!comparisons.length ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-sm font-semibold text-slate-500">
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
                <p className="text-xs font-semibold uppercase text-blue-600">Slippage Threshold Management</p>
                <CardTitle className="mt-1 text-2xl">Threshold registry</CardTitle>
                <CardDescription className="mt-2">Configure limits by symbol/asset/broker/session/strategy with audit logging.</CardDescription>
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
                        setDetailTab("Risk");
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

            <Separator className="my-4" />

            {selectedThreshold ? (
              <ThresholdEditor threshold={selectedThreshold} disabled={!can(role, "thresholds")} onSave={(patch) => actions.updateThreshold.mutate({ thresholdId: selectedThreshold.id, patch })} />
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700">Select a threshold to edit.</div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Slippage Alerts & Logs</p>
                <CardTitle className="mt-1 text-2xl">Alerts and audit surface</CardTitle>
                <CardDescription className="mt-2">Track breaches, blocks, root causes, and resolution status.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase text-slate-500">Filter</span>
                <select value={alertFilter} onChange={(e) => setAlertFilter(e.target.value)} className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900">
                  {["All", "Warning", "Critical", "Broker Issue", "Symbol Issue", "News Driven", "Volatility Driven", "Execution Blocked", "Resolved", "Unresolved"].map((f) => (
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
              <table aria-label="Slippage alerts" className="min-w-[1200px] table-fixed border-collapse bg-white">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="w-[180px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Timestamp</th>
                    <th className="w-[180px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Order</th>
                    <th className="w-[160px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Broker</th>
                    <th className="w-[140px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Symbol</th>
                    <th className="w-[160px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Slippage</th>
                    <th className="w-[160px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Alert Type</th>
                    <th className="w-[140px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Severity</th>
                    <th className="w-[200px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Root Cause</th>
                  </tr>
                </thead>
                <tbody>
                  {alertRows.slice(0, 60).map((a: SlippageAlert) => (
                    <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-sm text-slate-700">{formatIso(a.timestamp)}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{a.orderId}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{a.broker}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{a.normalizedSymbol}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{formatPips(a.slippagePips)}</td>
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
              <table aria-label="Slippage logs" className="min-w-[1100px] table-fixed border-collapse bg-white">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="w-[180px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Timestamp</th>
                    <th className="w-[180px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Event</th>
                    <th className="w-[140px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Severity</th>
                    <th className="w-[180px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Execution</th>
                    <th className="w-[260px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Message</th>
                    <th className="w-[140px] px-3 py-2 text-left text-xs font-semibold uppercase text-slate-600">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(logs.data?.logs ?? []).slice(0, 22).map((l: any) => (
                    <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-sm text-slate-700">{formatIso(l.timestamp)}</td>
                      <td className="px-3 py-2 text-sm font-semibold text-slate-950">{l.eventType}</td>
                      <td className="px-3 py-2 text-sm">
                        <Badge variant={variant(l.severity)}>{l.severity}</Badge>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">{l.executionId}</td>
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
                <p className="text-xs font-semibold uppercase text-blue-600">AI Slippage Diagnostics</p>
                <CardTitle className="mt-1 text-2xl">Latency/spread/slippage root cause analysis</CardTitle>
                <CardDescription className="mt-2">Detect abnormal negative slippage, broker spikes, session clusters, and unsafe retry conditions.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={diagnostics.data?.diagnostics?.some((d: any) => d.severity === "Critical") ? "destructive" : "secondary"}>
                  <TriangleAlert className="h-3.5 w-3.5" />
                  {diagnostics.data?.diagnostics?.length ?? 0} findings
                </Badge>
                <Button variant="secondary" onClick={() => actions.autoFix.mutate()} disabled={!can(role, "disableUnsafe")}>
                  <Wrench className="h-4 w-4" />
                  Auto-Remediate
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DiagnosticsTable rows={diagnostics.data?.diagnostics ?? ([] as AiSlippageDiagnostic[])} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

