"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Brain,
  Download,
  RefreshCw,
  Siren,
  Wrench
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from "recharts";

import type { Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useExecutionLogs } from "../hooks/use-execution-logs";
import { useExecutionLogsStore } from "../stores/execution-logs.store";
import type { ExecutionLog, RiskLevel } from "../types/execution-logs.types";

type SortKey =
  | "occurredAt"
  | "logId"
  | "executionId"
  | "orderId"
  | "strategyId"
  | "account"
  | "broker"
  | "terminal"
  | "symbol"
  | "executionStatus"
  | "slippagePoints"
  | "executionTimeMs"
  | "retryCount"
  | "riskLevel"
  | "reviewedStatus";
type SortDir = "asc" | "desc";

function variant(value: string) {
  const v = value.toLowerCase();
  if (v.includes("healthy") || v.includes("reviewed") || v.includes("low") || v.includes("excellent") || v.includes("synced") || v.includes("executed")) return "success" as const;
  if (v.includes("warning") || v.includes("watch") || v.includes("moderate") || v.includes("elevated") || v.includes("degraded")) return "warning" as const;
  if (v.includes("critical") || v.includes("high risk") || v.includes("failed") || v.includes("timeout") || v.includes("rejected") || v.includes("missing")) return "destructive" as const;
  return "secondary" as const;
}

function can(role: Mt5Role, action: "refresh" | "sync" | "diagnostics" | "export" | "escalate" | "review") {
  if (action === "refresh") return true;
  if (action === "export") return role !== "Read-Only Viewer" ? true : true;
  if (action === "sync") return role === "Super Admin" || role === "Infrastructure Admin" || role === "Trading Admin";
  if (action === "diagnostics") return role === "Super Admin" || role === "Infrastructure Admin" || role === "Trading Admin";
  if (action === "escalate") return role === "Super Admin" || role === "Risk Manager" || role === "Trading Admin";
  return role === "Super Admin" || role === "Trading Admin";
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

function formatIso(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function labelColor(risk: RiskLevel) {
  if (risk === "Critical") return "text-red-700";
  if (risk === "High") return "text-red-600";
  if (risk === "Elevated") return "text-orange-600";
  if (risk === "Moderate") return "text-yellow-700";
  return "text-slate-700";
}

function sortRows(rows: ExecutionLog[], key: SortKey, dir: SortDir) {
  const cmp = (a: ExecutionLog, b: ExecutionLog) => {
    const av = (a as any)[key];
    const bv = (b as any)[key];
    if (typeof av === "number" && typeof bv === "number") return av - bv;
    return String(av ?? "").localeCompare(String(bv ?? ""));
  };
  const sorted = [...rows].sort(cmp);
  return dir === "asc" ? sorted : sorted.reverse();
}

export function ExecutionLogsDashboard() {
  const queryClient = useQueryClient();
  const ui = useExecutionLogsStore();
  const data = useExecutionLogs();

  const [sortKey, setSortKey] = React.useState<SortKey>("occurredAt");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [exportFormat, setExportFormat] = React.useState<"json" | "csv">("json");

  const role = ui.role;
  const rows = data.logs.data?.logs ?? [];
  const sorted = sortRows(rows, sortKey, sortDir);
  const selected = data.log.data?.log ?? null;
  const brokerResponse = data.brokerResponse.data?.brokerResponse ?? null;
  const retryCancellation = data.retryCancellation.data?.retryCancellation ?? null;

  const brokers = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const l of rows) map.set(l.brokerId, l.broker);
    return [...map.entries()].map(([brokerId, broker]) => ({ brokerId, broker }));
  }, [rows]);

  const symbols = React.useMemo(() => {
    const set = new Set(rows.map((r) => r.normalizedSymbol));
    return [...set].sort();
  }, [rows]);

  const byStatus = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.executionStatus, (counts.get(r.executionStatus) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([status, count]) => ({ status, count }));
  }, [rows]);

  const byBroker = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.broker, (counts.get(r.broker) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([broker, count]) => ({ broker, count }));
  }, [rows]);

  const slippageTrend = React.useMemo(() => {
    const points = [...rows]
      .filter((r) => r.slippagePoints != null)
      .slice(0, 80)
      .map((r) => ({ at: r.occurredAt, slippage: r.slippagePoints as number, broker: r.broker }))
      .sort((a, b) => a.at.localeCompare(b.at));
    return points;
  }, [rows]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["execution-logs"] });
  };

  const markSelectedReviewed = async () => {
    if (!ui.selectedLogIds.length) return;
    for (const logId of ui.selectedLogIds) {
      await data.actions.markAsReviewed.mutateAsync({ logId, payload: { reviewedBy: "operator" } });
    }
    ui.clearSelection();
  };

  const escalateFailed = async () => {
    const failed = rows.filter((l) => l.executionStatus === "Failed" || l.executionStatus === "Timed Out" || l.executionStatus === "Missing Feedback" || l.executionStatus === "Rejected");
    for (const l of failed.slice(0, 10)) {
      await data.actions.escalateFailed.mutateAsync({ logId: l.logId, payload: { requiredAction: "Triage execution failure; verify ticket state; block unsafe retries; apply fallback route if safe." } });
    }
  };

  const doExport = async () => {
    const res = await data.actions.exportLogs.mutateAsync({
      format: exportFormat,
      filters: {
        search: ui.searchTerm || undefined,
        status: ui.statusFilter,
        brokerId: ui.brokerFilter,
        symbol: ui.symbolFilter,
        reviewed: ui.reviewedFilter
      } as any
    });
    const filename = `execution-logs-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${exportFormat}`;
    downloadText(filename, res.message, exportFormat === "csv" ? "text/csv" : "application/json");
  };

  const setSort = (key: SortKey) => {
    setSortKey(key);
    setSortDir((d) => (key === sortKey ? (d === "asc" ? "desc" : "asc") : "desc"));
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1600px] space-y-4 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Execution Logs</h1>
            <p className="text-sm text-muted-foreground">
              Complete execution audit trail for MT5 order routing, broker responses, EA delivery, fills, rejections, retries, cancellations, and synchronization outcomes.
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("inline-flex items-center gap-1", data.streamConnected ? "text-emerald-700" : "text-slate-500")}>
                <Activity className="h-3.5 w-3.5" />
                {data.streamConnected ? "Realtime connected" : "Realtime disconnected"}
              </span>
              <Separator orientation="vertical" className="h-3" />
              <span>Role: {role}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={refresh} disabled={!can(role, "refresh") || data.summary.isLoading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Logs
            </Button>
            <Button variant="secondary" onClick={() => data.actions.refresh.mutate()} disabled={!can(role, "sync") || data.actions.refresh.isPending}>
              <Wrench className="mr-2 h-4 w-4" />
              Sync Latest Executions
            </Button>
            <Button variant="secondary" onClick={() => data.actions.runExecDiagnostics.mutate(undefined)} disabled={!can(role, "diagnostics") || data.actions.runExecDiagnostics.isPending}>
              <Brain className="mr-2 h-4 w-4" />
              Run Execution Diagnostics
            </Button>
            <Button variant="outline" onClick={doExport} disabled={!can(role, "export") || data.actions.exportLogs.isPending}>
              <Download className="mr-2 h-4 w-4" />
              Export Execution Logs
            </Button>
            <Button variant="destructive" onClick={escalateFailed} disabled={!can(role, "escalate") || data.actions.escalateFailed.isPending}>
              <Siren className="mr-2 h-4 w-4" />
              Escalate Failed Executions
            </Button>
            <Button variant="secondary" onClick={markSelectedReviewed} disabled={!can(role, "review") || ui.selectedLogIds.length === 0 || data.actions.markAsReviewed.isPending}>
              <BadgeCheck className="mr-2 h-4 w-4" />
              Mark Reviewed
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {(data.summary.data?.kpis ?? []).map((kpi) => (
            <Card key={kpi.label} className="border-slate-200">
              <CardHeader className="space-y-1 pb-2">
                <div className="flex items-center justify-between text-sm leading-6 text-slate-600">
                  <span>{kpi.label}</span>
                  <Badge variant={variant(kpi.status)}>{kpi.status}</Badge>
                </div>
                <CardTitle className="text-2xl">{kpi.value}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xs text-muted-foreground">{kpi.detail}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle>Execution Lifecycle Workflow</CardTitle>
              <CardDescription>
                Signal Approved → Order Queued → Risk Passed → Route Assigned → EA Command Sent → Broker Response Received → MT5 Ticket Created → Fill Confirmed → Trade Synced → Audit Completed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
                {(data.workflow.data?.workflow ?? []).map((node) => (
                  <div key={node.title} className="rounded-md border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium">{node.title}</div>
                      <Badge variant={variant(node.status)}>{node.status}</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded border border-slate-200 bg-slate-50 p-2">
                        <div className="text-muted-foreground">Events</div>
                        <div className="font-medium">{node.eventCount}</div>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 p-2">
                        <div className="text-muted-foreground">Failed</div>
                        <div className="font-medium">{node.failedCount}</div>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 p-2">
                        <div className="text-muted-foreground">Avg ms</div>
                        <div className="font-medium">{node.averageDurationMs}</div>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 p-2">
                        <div className="text-muted-foreground">Latest failure</div>
                        <div className="truncate font-medium">{node.latestFailure}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      <span className="font-medium text-slate-700">AI:</span> {node.aiRecommendation}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle>Execution Quality Analytics</CardTitle>
              <CardDescription>Status distribution, broker volume, and slippage trend.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="h-44 rounded-md border border-slate-200 bg-white p-2">
                  <div className="mb-1 text-xs font-medium text-slate-700">Executions by Status (Top)</div>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byStatus}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="status" fontSize={10} />
                      <YAxis fontSize={10} />
                      <RechartsTooltip />
                      <Bar dataKey="count" fill="#0f172a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-44 rounded-md border border-slate-200 bg-white p-2">
                  <div className="mb-1 text-xs font-medium text-slate-700">Executions by Broker</div>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byBroker}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="broker" fontSize={10} />
                      <YAxis fontSize={10} />
                      <RechartsTooltip />
                      <Bar dataKey="count" fill="#334155" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="h-56 rounded-md border border-slate-200 bg-white p-2">
                <div className="mb-1 text-xs font-medium text-slate-700">Slippage Trend (points)</div>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={slippageTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="at" tickFormatter={(v) => String(v).slice(11, 16)} fontSize={10} />
                    <YAxis fontSize={10} />
                    <RechartsTooltip labelFormatter={(v) => formatIso(String(v))} />
                    <Line type="monotone" dataKey="slippage" stroke="#dc2626" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-3 text-xs text-muted-foreground">
                <span>Execution quality score updates from realtime snapshots.</span>
                <Badge variant={variant(data.summary.data?.executionQualityScore.rating ?? "Healthy")}>{data.summary.data?.executionQualityScore.rating ?? "—"}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <Card className={cn("lg:col-span-8", ui.showDetailPanel ? "lg:col-span-8" : "lg:col-span-12")}>
            <CardHeader className="space-y-2">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle>Execution Logs Table</CardTitle>
                  <CardDescription>Searchable, sortable, filterable execution events with audit actions.</CardDescription>
                </div>
                <Button variant="outline" onClick={() => ui.toggleDetailPanel()}>
                  {ui.showDetailPanel ? "Hide Detail" : "Show Detail"}
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                <div className="md:col-span-2">
                  <input
                    aria-label="Search execution logs"
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                    placeholder="Search by execution, order, broker response, ticket, symbol…"
                    value={ui.searchTerm}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => ui.setSearchTerm(event.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Status</label>
                  <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm" value={ui.statusFilter} onChange={(e) => ui.setStatusFilter(e.target.value as any)} aria-label="Status filter">
                    <option value="all">All</option>
                    <option value="Synced">Synced</option>
                    <option value="Executed">Executed</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Requoted">Requoted</option>
                    <option value="Failed">Failed</option>
                    <option value="Timed Out">Timed Out</option>
                    <option value="Missing Feedback">Missing Feedback</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Broker</label>
                  <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm" value={ui.brokerFilter} onChange={(e) => ui.setBrokerFilter(e.target.value)} aria-label="Broker filter">
                    <option value="all">All</option>
                    {brokers.map((b) => (
                      <option key={b.brokerId} value={b.brokerId}>
                        {b.broker}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Symbol</label>
                  <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm" value={ui.symbolFilter} onChange={(e) => ui.setSymbolFilter(e.target.value)} aria-label="Symbol filter">
                    <option value="all">All</option>
                    {symbols.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Reviewed</label>
                  <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm" value={ui.reviewedFilter} onChange={(e) => ui.setReviewedFilter(e.target.value as any)} aria-label="Reviewed filter">
                    <option value="all">All</option>
                    <option value="Unreviewed">Unreviewed</option>
                    <option value="Reviewed">Reviewed</option>
                  </select>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <ScrollArea className="h-[520px] rounded-md border border-slate-200">
                <table className="w-full text-sm" aria-label="Execution logs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200 text-xs text-muted-foreground">
                      <th className="px-2 py-2 text-left">Select</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("logId")}>Log ID</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("occurredAt")}>Timestamp</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("executionId")}>Execution ID</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("orderId")}>Order ID</th>
                      <th className="px-2 py-2 text-left">Signal</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("strategyId")}>Strategy</th>
                      <th className="px-2 py-2 text-left">Account</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("broker")}>Broker</th>
                      <th className="px-2 py-2 text-left">Terminal</th>
                      <th className="px-2 py-2 text-left">EA</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("symbol")}>Symbol</th>
                      <th className="px-2 py-2 text-left">Direction</th>
                      <th className="px-2 py-2 text-left">Order Type</th>
                      <th className="px-2 py-2 text-left">Vol</th>
                      <th className="px-2 py-2 text-left">Req</th>
                      <th className="px-2 py-2 text-left">Exec</th>
                      <th className="px-2 py-2 text-left">MT5 Ticket</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("executionStatus")}>Status</th>
                      <th className="px-2 py-2 text-left">Resp Code</th>
                      <th className="px-2 py-2 text-left">Resp Msg</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("slippagePoints")}>Slip</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("executionTimeMs")}>Time</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("retryCount")}>Retry</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("riskLevel")}>Risk</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("reviewedStatus")}>Reviewed</th>
                      <th className="px-2 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row) => (
                      <tr key={row.logId} className={cn("border-b border-slate-100 hover:bg-slate-50", ui.selectedLogId === row.logId && "bg-slate-50")}>
                        <td className="px-2 py-2">
                          <input aria-label={`select-${row.logId}`} type="checkbox" checked={ui.selectedLogIds.includes(row.logId)} onChange={() => ui.toggleSelectedLogId(row.logId)} />
                        </td>
                        <td className="px-2 py-2">
                          <Button variant="ghost" className="h-7 px-2" onClick={() => ui.setSelectedLogId(row.logId)}>
                            {row.logId}
                          </Button>
                        </td>
                        <td className="px-2 py-2 text-xs">{formatIso(row.occurredAt)}</td>
                        <td className="px-2 py-2 text-xs">{row.executionId}</td>
                        <td className="px-2 py-2 text-xs">{row.orderId}</td>
                        <td className="px-2 py-2 text-xs">{row.signalId ?? "—"}</td>
                        <td className="px-2 py-2 text-xs">{row.strategyId}</td>
                        <td className="px-2 py-2 text-xs">{row.account}</td>
                        <td className="px-2 py-2 text-xs">{row.broker}</td>
                        <td className="px-2 py-2 text-xs">{row.terminal}</td>
                        <td className="px-2 py-2 text-xs">{row.eaInstance ?? "—"}</td>
                        <td className="px-2 py-2 text-xs">{row.normalizedSymbol}</td>
                        <td className="px-2 py-2 text-xs">{row.direction}</td>
                        <td className="px-2 py-2 text-xs">{row.orderType}</td>
                        <td className="px-2 py-2 text-xs">{row.volume}</td>
                        <td className="px-2 py-2 text-xs">{row.requestedPrice}</td>
                        <td className="px-2 py-2 text-xs">{row.executedPrice ?? "—"}</td>
                        <td className="px-2 py-2 text-xs">{row.mt5Ticket ?? "—"}</td>
                        <td className="px-2 py-2 text-xs">
                          <Badge variant={variant(row.executionStatus)}>{row.executionStatus}</Badge>
                        </td>
                        <td className="px-2 py-2 text-xs">{row.brokerResponseCode ?? "—"}</td>
                        <td className="max-w-[220px] truncate px-2 py-2 text-xs" title={row.brokerResponseMessage ?? ""}>
                          {row.brokerResponseMessage ?? "—"}
                        </td>
                        <td className="px-2 py-2 text-xs">{row.slippagePoints ?? "—"}</td>
                        <td className="px-2 py-2 text-xs">{row.executionTimeMs ?? "—"}</td>
                        <td className="px-2 py-2 text-xs">{row.retryCount}</td>
                        <td className={cn("px-2 py-2 text-xs font-medium", labelColor(row.riskLevel))}>{row.riskLevel}</td>
                        <td className="px-2 py-2 text-xs">
                          <Badge variant={variant(row.reviewedStatus)}>{row.reviewedStatus}</Badge>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-1">
                            <Button variant="outline" className="h-7 px-2 text-xs" onClick={() => ui.setSelectedLogId(row.logId)}>
                              View Execution
                            </Button>
                            <Button
                              variant="secondary"
                              className="h-7 px-2 text-xs"
                              disabled={!can(role, "review") || row.reviewedStatus === "Reviewed" || data.actions.markAsReviewed.isPending}
                              onClick={() => data.actions.markAsReviewed.mutate({ logId: row.logId, payload: { reviewedBy: "operator" } })}
                            >
                              Mark Reviewed
                            </Button>
                            <Button
                              variant="destructive"
                              className="h-7 px-2 text-xs"
                              disabled={!can(role, "escalate") || data.actions.escalateFailed.isPending}
                              onClick={() => data.actions.escalateFailed.mutate({ logId: row.logId, payload: { requiredAction: "Escalate failed execution for triage." } })}
                            >
                              Escalate
                            </Button>
                            <Button
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              disabled={!can(role, "diagnostics") || data.actions.runExecDiagnostics.isPending}
                              onClick={() => data.actions.runExecDiagnostics.mutate(row.logId)}
                            >
                              Run Diagnostics
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!sorted.length && (
                      <tr>
                        <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={27}>
                          No execution logs found for current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ScrollArea>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Total: {data.logs.data?.meta.total ?? 0}</span>
                <span>
                  Sort: {sortKey} ({sortDir})
                </span>
                <span className="flex items-center gap-2">
                  <label className="text-xs">Export</label>
                  <select className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs" value={exportFormat} onChange={(e) => setExportFormat(e.target.value as any)} aria-label="Export format">
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                  </select>
                </span>
              </div>
            </CardContent>
          </Card>

          {ui.showDetailPanel && (
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>Execution Detail Panel</CardTitle>
                <CardDescription>Identity, broker response, retry/cancel, and final state.</CardDescription>
              </CardHeader>
              <CardContent>
                {!selected && <div className="text-sm text-muted-foreground">Select an execution log to view details.</div>}
                {selected && (
                  <div className="space-y-3">
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">{selected.executionId}</div>
                          <div className="text-xs text-muted-foreground">{selected.logId} • {formatIso(selected.occurredAt)}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={variant(selected.executionStatus)}>{selected.executionStatus}</Badge>
                          <Badge variant={variant(selected.riskLevel)}>{selected.riskLevel}</Badge>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Order / Signal</div>
                          <div className="font-medium">{selected.orderId} / {selected.signalId ?? "—"}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Strategy / Engine</div>
                          <div className="font-medium">{selected.strategyId} / {selected.sourceEngine}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Broker / Server</div>
                          <div className="font-medium">{selected.broker}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Account</div>
                          <div className="font-medium">{selected.account}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Terminal / EA</div>
                          <div className="font-medium">{selected.terminal} / {selected.eaInstance ?? "—"}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Symbol</div>
                          <div className="font-medium">{selected.symbol} ({selected.brokerSymbol})</div>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Instruction</div>
                          <div className="font-medium">{selected.direction} {selected.orderType} • vol {selected.volume}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Prices</div>
                          <div className="font-medium">{selected.requestedPrice} → {selected.executedPrice ?? "—"}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Ticket / Fill</div>
                          <div className="font-medium">{selected.mt5Ticket ?? "—"} / {selected.fillStatus}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Slippage / Time</div>
                          <div className="font-medium">{selected.slippagePoints ?? "—"} pts / {selected.executionTimeMs ?? "—"} ms</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          disabled={!can(role, "review") || selected.reviewedStatus === "Reviewed" || data.actions.markAsReviewed.isPending}
                          onClick={() => data.actions.markAsReviewed.mutate({ logId: selected.logId, payload: { reviewedBy: "operator" } })}
                        >
                          <BadgeCheck className="mr-2 h-4 w-4" />
                          Mark Reviewed
                        </Button>
                        <Button
                          variant="destructive"
                          disabled={!can(role, "escalate") || data.actions.escalateFailed.isPending}
                          onClick={() => data.actions.escalateFailed.mutate({ logId: selected.logId, payload: { requiredAction: "Escalate execution for investigation." } })}
                        >
                          <AlertTriangle className="mr-2 h-4 w-4" />
                          Escalate
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">Broker Response</div>
                        <Badge variant={variant(brokerResponse?.responseCode ?? "—")}>{brokerResponse?.responseCode ?? "—"}</Badge>
                      </div>
                      <div className="mt-2 space-y-2 text-xs">
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Message</div>
                          <div className="font-medium">{brokerResponse?.responseMessage ?? "—"}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Rejection reason</div>
                          <div className="font-medium">{brokerResponse?.rejectionReason ?? "—"}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Required fix</div>
                          <div className="font-medium">{brokerResponse?.requiredFix ?? "—"}</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="text-sm font-medium">Retry & Cancellation</div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Retry count</div>
                          <div className="font-medium">{retryCancellation?.retryCount ?? "—"}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Safe retry</div>
                          <div className="font-medium">{retryCancellation?.safeRetryStatus ?? "—"}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Reason</div>
                          <div className="font-medium">{retryCancellation?.retryReason ?? retryCancellation?.cancellationReason ?? "—"}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Final outcome</div>
                          <div className="font-medium">{retryCancellation?.finalOutcome ?? "—"}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <Card className="lg:col-span-6">
            <CardHeader>
              <CardTitle>Execution Exceptions</CardTitle>
              <CardDescription>Failed/rejected/requoted/timeout/missing feedback exceptions with impact and AI explanation.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[320px] rounded-md border border-slate-200">
                <table className="w-full text-sm" aria-label="Execution exceptions">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200 text-xs text-muted-foreground">
                      <th className="px-2 py-2 text-left">At</th>
                      <th className="px-2 py-2 text-left">Execution</th>
                      <th className="px-2 py-2 text-left">Broker</th>
                      <th className="px-2 py-2 text-left">Account</th>
                      <th className="px-2 py-2 text-left">Symbol</th>
                      <th className="px-2 py-2 text-left">Type</th>
                      <th className="px-2 py-2 text-left">Severity</th>
                      <th className="px-2 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.exceptions.data?.exceptions ?? []).slice(0, 40).map((ex) => (
                      <tr key={ex.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-2 py-2 text-xs">{formatIso(ex.occurredAt)}</td>
                        <td className="px-2 py-2 text-xs">{ex.executionId}</td>
                        <td className="px-2 py-2 text-xs">{ex.broker}</td>
                        <td className="px-2 py-2 text-xs">{ex.account}</td>
                        <td className="px-2 py-2 text-xs">{ex.symbol}</td>
                        <td className="px-2 py-2 text-xs">{ex.exceptionType}</td>
                        <td className="px-2 py-2 text-xs">
                          <Badge variant={variant(ex.severity)}>{ex.severity}</Badge>
                        </td>
                        <td className="px-2 py-2 text-xs">
                          <Badge variant={variant(ex.resolutionStatus)}>{ex.resolutionStatus}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="lg:col-span-6">
            <CardHeader>
              <CardTitle>AI Execution Diagnostics</CardTitle>
              <CardDescription>Clusters, broker patterns, unsafe retry risk, and recommended fix/fallback.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[320px] rounded-md border border-slate-200">
                <div className="space-y-2 p-2">
                  {(data.diagnostics.data?.diagnostics ?? []).slice(0, 18).map((d) => (
                    <div key={d.id} className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium">{d.issueSummary}</div>
                          <div className="text-xs text-muted-foreground">{d.likelyRootCause}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={variant(d.severity)}>{d.severity}</Badge>
                          <Badge variant={d.autoRemediationEligible ? "success" : "secondary"}>{d.autoRemediationEligible ? "Auto-fix eligible" : "Manual only"}</Badge>
                          <Badge variant={d.escalationRequired ? "destructive" : "secondary"}>{d.escalationRequired ? "Escalate" : "Monitor"}</Badge>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                        <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                          <div className="text-muted-foreground">Impact</div>
                          <div className="font-medium">{d.tradingImpact}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                          <div className="text-muted-foreground">Fix / Fallback</div>
                          <div className="font-medium">{d.recommendedFix}</div>
                          <div className="mt-1 text-muted-foreground">{d.fallbackRecommendation}</div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        <span className="font-medium text-slate-700">Execution:</span> {d.executionId} • <span className="font-medium text-slate-700">Order:</span> {d.orderId} • {Math.round(d.confidenceScore * 100)}% confidence
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle>Broker Response & Rejection Analysis</CardTitle>
              <CardDescription>Response classification with required fix and AI explanation.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[260px] rounded-md border border-slate-200">
                <table className="w-full text-sm" aria-label="Broker response analysis">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200 text-xs text-muted-foreground">
                      <th className="px-2 py-2 text-left">Broker</th>
                      <th className="px-2 py-2 text-left">Account</th>
                      <th className="px-2 py-2 text-left">Order</th>
                      <th className="px-2 py-2 text-left">Ticket</th>
                      <th className="px-2 py-2 text-left">Code</th>
                      <th className="px-2 py-2 text-left">Reason</th>
                      <th className="px-2 py-2 text-left">Fix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.logs.data?.logs ?? []).slice(0, 30).map((l) => (
                      <tr key={l.logId} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-2 py-2 text-xs">{l.broker}</td>
                        <td className="px-2 py-2 text-xs">{l.account}</td>
                        <td className="px-2 py-2 text-xs">{l.orderId}</td>
                        <td className="px-2 py-2 text-xs">{l.mt5Ticket ?? "—"}</td>
                        <td className="px-2 py-2 text-xs">{l.brokerResponseCode ?? "—"}</td>
                        <td className="px-2 py-2 text-xs">{l.brokerResponseMessage ?? "—"}</td>
                        <td className="px-2 py-2 text-xs text-muted-foreground">Open detail for AI fix.</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>Review/escalation/remediation/export actions are logged.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[260px] rounded-md border border-slate-200">
                <table className="w-full text-sm" aria-label="Execution audit trail">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200 text-xs text-muted-foreground">
                      <th className="px-2 py-2 text-left">At</th>
                      <th className="px-2 py-2 text-left">User</th>
                      <th className="px-2 py-2 text-left">Action</th>
                      <th className="px-2 py-2 text-left">Entity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.audit.data?.audit ?? []).slice(0, 30).map((a) => (
                      <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-2 py-2 text-xs">{formatIso(a.timestamp)}</td>
                        <td className="px-2 py-2 text-xs">{a.userId}</td>
                        <td className="px-2 py-2 text-xs">{a.action}</td>
                        <td className="px-2 py-2 text-xs">{a.entityId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

