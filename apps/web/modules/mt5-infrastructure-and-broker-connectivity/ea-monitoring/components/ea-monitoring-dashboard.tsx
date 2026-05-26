"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Brain,
  Download,
  RefreshCw,
  ShieldAlert,
  Siren,
  ToggleLeft,
  ToggleRight,
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
import { useEaMonitoring } from "../hooks/use-ea-monitoring";
import { useEaMonitoringStore } from "../stores/ea-monitoring.store";
import type { EaInstance, EaRiskLevel } from "../types/ea-monitoring.types";

type SortKey =
  | "eaId"
  | "eaName"
  | "terminal"
  | "broker"
  | "accountLogin"
  | "strategyName"
  | "connectionStatus"
  | "heartbeatStatus"
  | "lastHeartbeatAt"
  | "bridgeStatus"
  | "tradingEnabled"
  | "commandSuccessRate"
  | "failedCommands"
  | "averageLatencyMs"
  | "riskLevel"
  | "healthScore";
type SortDir = "asc" | "desc";

function variant(value: string) {
  const v = value.toLowerCase();
  if (v.includes("healthy") || v.includes("online") || v.includes("active") || v.includes("ready") || v.includes("enabled") || v.includes("low") || v.includes("excellent")) return "success" as const;
  if (v.includes("watch") || v.includes("warning") || v.includes("moderate") || v.includes("elevated") || v.includes("degraded") || v.includes("delayed")) return "warning" as const;
  if (v.includes("critical") || v.includes("offline") || v.includes("missing") || v.includes("high")) return "destructive" as const;
  return "secondary" as const;
}

function can(role: Mt5Role, action: "refresh" | "sync" | "diagnostics" | "restart" | "disable" | "enable" | "export" | "remediate") {
  if (action === "refresh" || action === "export") return true;
  if (action === "diagnostics") return role === "Super Admin" || role === "Infrastructure Admin" || role === "Trading Admin" || role === "Risk Manager" || role === "Analyst";
  if (action === "restart") return role === "Super Admin" || role === "Infrastructure Admin";
  if (action === "disable" || action === "enable") return role === "Super Admin" || role === "Trading Admin";
  if (action === "sync") return role === "Super Admin" || role === "Infrastructure Admin" || role === "Trading Admin";
  return role === "Super Admin" || role === "Infrastructure Admin";
}

function formatIso(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
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

function sortRows(rows: EaInstance[], key: SortKey, dir: SortDir) {
  const cmp = (a: EaInstance, b: EaInstance) => {
    const av = (a as any)[key];
    const bv = (b as any)[key];
    if (typeof av === "number" && typeof bv === "number") return av - bv;
    if (typeof av === "boolean" && typeof bv === "boolean") return Number(av) - Number(bv);
    return String(av ?? "").localeCompare(String(bv ?? ""));
  };
  const sorted = [...rows].sort(cmp);
  return dir === "asc" ? sorted : sorted.reverse();
}

function riskColor(risk: EaRiskLevel) {
  if (risk === "Critical") return "text-red-700";
  if (risk === "High") return "text-red-600";
  if (risk === "Elevated") return "text-orange-600";
  if (risk === "Moderate") return "text-yellow-700";
  return "text-slate-700";
}

export function EaMonitoringDashboard() {
  const queryClient = useQueryClient();
  const ui = useEaMonitoringStore();
  const data = useEaMonitoring();

  const [sortKey, setSortKey] = React.useState<SortKey>("healthScore");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [exportFormat, setExportFormat] = React.useState<"json" | "csv">("json");

  const role = ui.role;
  const rows = data.instances.data?.instances ?? [];
  const sorted = sortRows(rows, sortKey, sortDir);
  const selected = data.instance.data?.instance ?? null;

  const brokers = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.brokerId, r.broker);
    return [...map.entries()].map(([brokerId, broker]) => ({ brokerId, broker }));
  }, [rows]);

  const byStatus = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.connectionStatus, (counts.get(r.connectionStatus) ?? 0) + 1);
    return [...counts.entries()].map(([status, count]) => ({ status, count }));
  }, [rows]);

  const byRisk = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.riskLevel, (counts.get(r.riskLevel) ?? 0) + 1);
    return [...counts.entries()].map(([risk, count]) => ({ risk, count }));
  }, [rows]);

  const analytics = React.useMemo(() => {
    const eaId = ui.selectedEaId ?? rows[0]?.eaId ?? null;
    if (!eaId) return [];
    return (data.analytics.data?.points ?? []).filter((p) => p.eaId === eaId).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  }, [data.analytics.data?.points, rows, ui.selectedEaId]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["ea-monitoring"] });
  };

  const setSort = (key: SortKey) => {
    setSortKey(key);
    setSortDir((d) => (key === sortKey ? (d === "asc" ? "desc" : "asc") : "desc"));
  };

  const doExport = async () => {
    const res = await data.actions.exportReport.mutateAsync({
      format: exportFormat,
      filters: { search: ui.searchTerm || undefined, status: ui.statusFilter, risk: ui.riskFilter, trading: ui.tradingFilter } as any
    });
    const filename = `ea-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${exportFormat}`;
    downloadText(filename, res.message, exportFormat === "csv" ? "text/csv" : "application/json");
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[1600px] space-y-4 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">EA Monitoring</h1>
            <p className="text-sm text-muted-foreground">
              Real-time monitoring of MT5 Expert Advisors, strategy bindings, bridge sessions, command flow, risk compliance, and execution readiness.
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
              Refresh EAs
            </Button>
            <Button variant="secondary" onClick={() => data.actions.sync.mutate()} disabled={!can(role, "sync") || data.actions.sync.isPending}>
              <Wrench className="mr-2 h-4 w-4" />
              Sync EA Status
            </Button>
            <Button variant="secondary" onClick={() => data.actions.runDiagnostics.mutate(undefined)} disabled={!can(role, "diagnostics") || data.actions.runDiagnostics.isPending}>
              <Brain className="mr-2 h-4 w-4" />
              Run EA Diagnostics
            </Button>
            <Button variant="secondary" onClick={() => selected && data.actions.restart.mutate(selected.eaId)} disabled={!selected || !can(role, "restart") || data.actions.restart.isPending}>
              <AlertTriangle className="mr-2 h-4 w-4" />
              Restart EA Session
            </Button>
            <Button variant="secondary" onClick={() => selected && data.actions.disableTrading.mutate(selected.eaId)} disabled={!selected || !can(role, "disable") || data.actions.disableTrading.isPending}>
              <ToggleLeft className="mr-2 h-4 w-4" />
              Disable EA Trading
            </Button>
            <Button variant="secondary" onClick={() => selected && data.actions.enableTrading.mutate(selected.eaId)} disabled={!selected || !can(role, "enable") || data.actions.enableTrading.isPending}>
              <ToggleRight className="mr-2 h-4 w-4" />
              Enable EA Trading
            </Button>
            <Button variant="outline" onClick={doExport} disabled={!can(role, "export") || data.actions.exportReport.isPending}>
              <Download className="mr-2 h-4 w-4" />
              Export EA Report
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
              <CardTitle>EA Monitoring Workflow</CardTitle>
              <CardDescription>
                EA Registered → Terminal Bound → Broker Account Linked → Strategy Bound → Symbol Scope Loaded → Heartbeat Active → Bridge Connected → Risk Rules Loaded → Command Channel Ready → Execution Feedback Active
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
                        <div className="text-muted-foreground">EAs</div>
                        <div className="font-medium">{node.eaCount}</div>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 p-2">
                        <div className="text-muted-foreground">Failed</div>
                        <div className="font-medium">{node.failedCount}</div>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 p-2">
                        <div className="text-muted-foreground">Avg ms</div>
                        <div className="font-medium">{node.averageDelayMs}</div>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 p-2">
                        <div className="text-muted-foreground">Latest</div>
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
              <CardTitle>Performance & Stability Analytics</CardTitle>
              <CardDescription>Status and risk distribution + selected EA trends.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="h-44 rounded-md border border-slate-200 bg-white p-2">
                  <div className="mb-1 text-xs font-medium text-slate-700">EA Status</div>
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
                  <div className="mb-1 text-xs font-medium text-slate-700">EA Risk Levels</div>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byRisk}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="risk" fontSize={10} />
                      <YAxis fontSize={10} />
                      <RechartsTooltip />
                      <Bar dataKey="count" fill="#334155" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="h-56 rounded-md border border-slate-200 bg-white p-2">
                <div className="mb-1 text-xs font-medium text-slate-700">Heartbeat Delay Trend (selected EA)</div>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="measuredAt" tickFormatter={(v) => String(v).slice(11, 16)} fontSize={10} />
                    <YAxis fontSize={10} />
                    <RechartsTooltip labelFormatter={(v) => formatIso(String(v))} />
                    <Line type="monotone" dataKey="heartbeatDelaySeconds" stroke="#dc2626" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="averageLatencyMs" stroke="#0f172a" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <Card className={cn("lg:col-span-8", ui.showDetailPanel ? "lg:col-span-8" : "lg:col-span-12")}>
            <CardHeader className="space-y-2">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle>EA Instances Table</CardTitle>
                  <CardDescription>Searchable, sortable, filterable EA instance registry with actions.</CardDescription>
                </div>
                <Button variant="outline" onClick={() => ui.toggleDetailPanel()}>
                  {ui.showDetailPanel ? "Hide Detail" : "Show Detail"}
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                <div className="md:col-span-2">
                  <input
                    aria-label="Search EAs"
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                    placeholder="Search EA, broker, account, terminal, strategy, error…"
                    value={ui.searchTerm}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => ui.setSearchTerm(event.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Status</label>
                  <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm" value={ui.statusFilter} onChange={(e) => ui.setStatusFilter(e.target.value as any)} aria-label="Status filter">
                    <option value="all">All</option>
                    <option value="Online">Online</option>
                    <option value="Degraded">Degraded</option>
                    <option value="Offline">Offline</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Risk</label>
                  <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm" value={ui.riskFilter} onChange={(e) => ui.setRiskFilter(e.target.value as any)} aria-label="Risk filter">
                    <option value="all">All</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Elevated">Elevated</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Trading</label>
                  <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm" value={ui.tradingFilter} onChange={(e) => ui.setTradingFilter(e.target.value as any)} aria-label="Trading filter">
                    <option value="all">All</option>
                    <option value="enabled">Enabled</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Export</label>
                  <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm" value={exportFormat} onChange={(e) => setExportFormat(e.target.value as any)} aria-label="Export format">
                    <option value="json">JSON</option>
                    <option value="csv">CSV</option>
                  </select>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <ScrollArea className="h-[520px] rounded-md border border-slate-200">
                <table className="w-full text-sm" aria-label="EA instances">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200 text-xs text-muted-foreground">
                      <th className="px-2 py-2 text-left">Select</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("eaId")}>EA ID</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("eaName")}>EA Name</th>
                      <th className="px-2 py-2 text-left">Version</th>
                      <th className="px-2 py-2 text-left">Build</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("terminal")}>Terminal</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("broker")}>Broker</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("accountLogin")}>Account</th>
                      <th className="px-2 py-2 text-left">Strategy</th>
                      <th className="px-2 py-2 text-left">Symbols</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("connectionStatus")}>Conn</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("heartbeatStatus")}>HB</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("lastHeartbeatAt")}>Last HB</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("bridgeStatus")}>Bridge</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("tradingEnabled")}>Trading</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("commandSuccessRate")}>Cmd %</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("failedCommands")}>Fail</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("averageLatencyMs")}>Lat</th>
                      <th className="px-2 py-2 text-left">Last Error</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("riskLevel")}>Risk</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("healthScore")}>Health</th>
                      <th className="px-2 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row) => (
                      <tr key={row.eaId} className={cn("border-b border-slate-100 hover:bg-slate-50", ui.selectedEaId === row.eaId && "bg-slate-50")}>
                        <td className="px-2 py-2">
                          <input aria-label={`select-${row.eaId}`} type="checkbox" checked={ui.selectedEaIds.includes(row.eaId)} onChange={() => ui.toggleSelectedEaId(row.eaId)} />
                        </td>
                        <td className="px-2 py-2">
                          <Button variant="ghost" className="h-7 px-2" onClick={() => ui.setSelectedEaId(row.eaId)}>
                            {row.eaId}
                          </Button>
                        </td>
                        <td className="px-2 py-2 text-xs">{row.eaName}</td>
                        <td className="px-2 py-2 text-xs">{row.eaVersion}</td>
                        <td className="px-2 py-2 text-xs">{row.buildNumber}</td>
                        <td className="px-2 py-2 text-xs">{row.terminal}</td>
                        <td className="px-2 py-2 text-xs">{row.broker}</td>
                        <td className="px-2 py-2 text-xs">{row.accountLogin}</td>
                        <td className="px-2 py-2 text-xs">{row.strategyName ?? "—"}</td>
                        <td className="max-w-[140px] truncate px-2 py-2 text-xs" title={row.symbolScope.join(", ")}>{row.symbolScope.join(", ") || "—"}</td>
                        <td className="px-2 py-2 text-xs"><Badge variant={variant(row.connectionStatus)}>{row.connectionStatus}</Badge></td>
                        <td className="px-2 py-2 text-xs"><Badge variant={variant(row.heartbeatStatus)}>{row.heartbeatStatus}</Badge></td>
                        <td className="px-2 py-2 text-xs">{formatIso(row.lastHeartbeatAt)}</td>
                        <td className="px-2 py-2 text-xs"><Badge variant={variant(row.bridgeStatus)}>{row.bridgeStatus}</Badge></td>
                        <td className="px-2 py-2 text-xs"><Badge variant={variant(row.tradingEnabled ? "Enabled" : "Disabled")}>{row.tradingEnabled ? "Enabled" : "Disabled"}</Badge></td>
                        <td className="px-2 py-2 text-xs">{row.commandSuccessRate}%</td>
                        <td className="px-2 py-2 text-xs">{row.failedCommands}</td>
                        <td className="px-2 py-2 text-xs">{row.averageLatencyMs}ms</td>
                        <td className="max-w-[220px] truncate px-2 py-2 text-xs" title={row.lastError ?? ""}>{row.lastError ?? "—"}</td>
                        <td className={cn("px-2 py-2 text-xs font-medium", riskColor(row.riskLevel))}>{row.riskLevel}</td>
                        <td className="px-2 py-2 text-xs">{row.healthScore}/100</td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-1">
                            <Button variant="outline" className="h-7 px-2 text-xs" onClick={() => ui.setSelectedEaId(row.eaId)}>
                              View EA
                            </Button>
                            <Button variant="outline" className="h-7 px-2 text-xs" disabled={!can(role, "restart") || data.actions.restart.isPending} onClick={() => data.actions.restart.mutate(row.eaId)}>
                              Restart
                            </Button>
                            <Button variant="outline" className="h-7 px-2 text-xs" disabled={!can(role, "diagnostics") || data.actions.runDiagnostics.isPending} onClick={() => data.actions.runDiagnostics.mutate(row.eaId)}>
                              Diagnostics
                            </Button>
                            <Button
                              variant="secondary"
                              className="h-7 px-2 text-xs"
                              disabled={!can(role, "disable") || !row.tradingEnabled || data.actions.disableTrading.isPending}
                              onClick={() => data.actions.disableTrading.mutate(row.eaId)}
                            >
                              Disable
                            </Button>
                            <Button
                              variant="secondary"
                              className="h-7 px-2 text-xs"
                              disabled={!can(role, "enable") || row.tradingEnabled || data.actions.enableTrading.isPending}
                              onClick={() => data.actions.enableTrading.mutate(row.eaId)}
                            >
                              Enable
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!sorted.length && (
                      <tr>
                        <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={22}>
                          No EA instances found for current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ScrollArea>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Total: {data.instances.data?.meta.total ?? 0}</span>
                <span>
                  Sort: {sortKey} ({sortDir})
                </span>
                <span className="flex items-center gap-2">
                  <Button variant="outline" className="h-8 px-2 text-xs" onClick={doExport} disabled={!can(role, "export") || data.actions.exportReport.isPending}>
                    <Download className="mr-1 h-3.5 w-3.5" />
                    Export
                  </Button>
                </span>
              </div>
            </CardContent>
          </Card>

          {ui.showDetailPanel && (
            <Card className="lg:col-span-4">
              <CardHeader>
                <CardTitle>EA Detail Panel</CardTitle>
                <CardDescription>Identity, binding, runtime health, and execution readiness.</CardDescription>
              </CardHeader>
              <CardContent>
                {!selected && <div className="text-sm text-muted-foreground">Select an EA to view details.</div>}
                {selected && (
                  <div className="space-y-3">
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">{selected.eaId}</div>
                          <div className="text-xs text-muted-foreground">{selected.eaName} • v{selected.eaVersion} • build {selected.buildNumber}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={variant(selected.connectionStatus)}>{selected.connectionStatus}</Badge>
                          <Badge variant={variant(selected.riskLevel)}>{selected.riskLevel}</Badge>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Terminal</div>
                          <div className="font-medium">{selected.terminal}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Broker / Account</div>
                          <div className="font-medium">{selected.broker} / {selected.accountLogin}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Host / Env</div>
                          <div className="font-medium">{selected.hostMachine} / {selected.environment}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Strategy</div>
                          <div className="font-medium">{selected.strategyName ?? "—"}</div>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Heartbeat</div>
                          <div className="font-medium">{selected.heartbeatStatus} • {selected.heartbeatDelaySeconds}s</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Bridge</div>
                          <div className="font-medium">{selected.bridgeStatus} • cmd {selected.commandChannelStatus}</div>
                        </div>
                      </div>
                      <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
                        <div className="mb-1 flex items-center justify-between">
                          <div className="font-medium text-slate-700">Execution Readiness</div>
                          <Badge variant={selected.readiness.executionReady ? "success" : "destructive"}>{selected.readiness.executionReady ? "Ready" : "Blocked"}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>Trading enabled: <span className="font-medium">{String(selected.tradingEnabled)}</span></div>
                          <div>Risk rules loaded: <span className="font-medium">{String(selected.riskRulesLoaded)}</span></div>
                          <div>Spread filter: <span className="font-medium">{String(selected.spreadFilterActive)}</span></div>
                          <div>Slippage filter: <span className="font-medium">{String(selected.slippageFilterActive)}</span></div>
                          <div>Latency filter: <span className="font-medium">{String(selected.latencyFilterActive)}</span></div>
                          <div>Dup protection: <span className="font-medium">{String(selected.duplicateProtectionActive)}</span></div>
                        </div>
                        {!selected.readiness.executionReady && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Blockers: {selected.readiness.blockers.join(", ")}
                          </div>
                        )}
                      </div>
                      {selected.lastError && (
                        <div className="mt-2 rounded-md border border-slate-200 bg-white p-2 text-xs">
                          <div className="font-medium text-slate-700">Last Error</div>
                          <div className="text-muted-foreground">{selected.lastError}</div>
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button variant="outline" disabled={!can(role, "diagnostics") || data.actions.runDiagnostics.isPending} onClick={() => data.actions.runDiagnostics.mutate(selected.eaId)}>
                          <Brain className="mr-2 h-4 w-4" />
                          Run Diagnostics
                        </Button>
                        <Button variant="outline" disabled={!can(role, "remediate") || data.actions.remediate.isPending} onClick={() => data.actions.remediate.mutate(selected.eaId)}>
                          <ShieldAlert className="mr-2 h-4 w-4" />
                          Auto-Remediate
                        </Button>
                        <Button variant="destructive" disabled={!can(role, "restart") || data.actions.restart.isPending} onClick={() => data.actions.restart.mutate(selected.eaId)}>
                          <Siren className="mr-2 h-4 w-4" />
                          Restart Session
                        </Button>
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
              <CardTitle>EA Command Flow Monitor</CardTitle>
              <CardDescription>Tracks every command delivered and executed by EAs.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[340px] rounded-md border border-slate-200">
                <table className="w-full text-sm" aria-label="EA commands">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200 text-xs text-muted-foreground">
                      <th className="px-2 py-2 text-left">Command</th>
                      <th className="px-2 py-2 text-left">EA</th>
                      <th className="px-2 py-2 text-left">Strategy</th>
                      <th className="px-2 py-2 text-left">Broker</th>
                      <th className="px-2 py-2 text-left">Symbol</th>
                      <th className="px-2 py-2 text-left">Type</th>
                      <th className="px-2 py-2 text-left">Status</th>
                      <th className="px-2 py-2 text-left">Risk</th>
                      <th className="px-2 py-2 text-left">RTT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.commands.data?.commands ?? []).slice(0, 60).map((c) => (
                      <tr key={c.commandId} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-2 py-2 text-xs">{c.commandId}</td>
                        <td className="px-2 py-2 text-xs">{c.eaId}</td>
                        <td className="px-2 py-2 text-xs">{c.strategyId ?? "—"}</td>
                        <td className="px-2 py-2 text-xs">{c.broker}</td>
                        <td className="px-2 py-2 text-xs">{c.symbol}</td>
                        <td className="px-2 py-2 text-xs">{c.commandType}</td>
                        <td className="px-2 py-2 text-xs"><Badge variant={variant(c.commandStatus)}>{c.commandStatus}</Badge></td>
                        <td className="px-2 py-2 text-xs"><Badge variant={variant(c.riskApprovalStatus)}>{c.riskApprovalStatus}</Badge></td>
                        <td className="px-2 py-2 text-xs">{c.responseTimeMs ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="lg:col-span-6">
            <CardHeader>
              <CardTitle>EA Strategy Binding Monitor</CardTitle>
              <CardDescription>Strategy assignment, symbols/timeframes allowed, and binding integrity.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[340px] rounded-md border border-slate-200">
                <table className="w-full text-sm" aria-label="EA strategy bindings">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200 text-xs text-muted-foreground">
                      <th className="px-2 py-2 text-left">EA</th>
                      <th className="px-2 py-2 text-left">Strategy</th>
                      <th className="px-2 py-2 text-left">Version</th>
                      <th className="px-2 py-2 text-left">Symbols</th>
                      <th className="px-2 py-2 text-left">Timeframes</th>
                      <th className="px-2 py-2 text-left">Risk</th>
                      <th className="px-2 py-2 text-left">Status</th>
                      <th className="px-2 py-2 text-left">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.bindings.data?.bindings ?? []).slice(0, 60).map((b) => (
                      <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-2 py-2 text-xs">{b.eaId}</td>
                        <td className="px-2 py-2 text-xs">{b.strategyName}</td>
                        <td className="px-2 py-2 text-xs">{b.strategyVersion}</td>
                        <td className="max-w-[160px] truncate px-2 py-2 text-xs" title={b.symbolsAllowed.join(", ")}>{b.symbolsAllowed.join(", ")}</td>
                        <td className="px-2 py-2 text-xs">{b.timeframesAllowed.join(", ")}</td>
                        <td className="px-2 py-2 text-xs">{b.riskProfile}</td>
                        <td className="px-2 py-2 text-xs"><Badge variant={variant(b.bindingStatus)}>{b.bindingStatus}</Badge></td>
                        <td className="px-2 py-2 text-xs">{formatIso(b.lastBindingUpdateAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>EA Logs & Exceptions</CardTitle>
              <CardDescription>Runtime errors and exceptions with resolution state and AI explanation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Filter</label>
                <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm" value={ui.logsFilter} onChange={(e) => ui.setLogsFilter(e.target.value)} aria-label="Logs filter">
                  <option>All</option>
                  <option>Offline</option>
                  <option>Heartbeat Missing</option>
                  <option>Bridge Error</option>
                  <option>Command Failure</option>
                  <option>Strategy Binding Error</option>
                  <option>Risk Rule Error</option>
                  <option>Execution Error</option>
                  <option>Resolved</option>
                  <option>Unresolved</option>
                </select>
              </div>
              <ScrollArea className="h-[320px] rounded-md border border-slate-200">
                <table className="w-full text-sm" aria-label="EA logs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200 text-xs text-muted-foreground">
                      <th className="px-2 py-2 text-left">At</th>
                      <th className="px-2 py-2 text-left">EA</th>
                      <th className="px-2 py-2 text-left">Severity</th>
                      <th className="px-2 py-2 text-left">Message</th>
                      <th className="px-2 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.logs.data?.logs ?? []).slice(0, 60).map((l) => (
                      <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-2 py-2 text-xs">{formatIso(l.timestamp)}</td>
                        <td className="px-2 py-2 text-xs">{l.eaId}</td>
                        <td className="px-2 py-2 text-xs"><Badge variant={variant(l.severity)}>{l.severity}</Badge></td>
                        <td className="max-w-[260px] truncate px-2 py-2 text-xs" title={l.message}>{l.message}</td>
                        <td className="px-2 py-2 text-xs"><Badge variant={variant(l.resolutionStatus)}>{l.resolutionStatus}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
              <ScrollArea className="h-[220px] rounded-md border border-slate-200">
                <table className="w-full text-sm" aria-label="EA exceptions">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200 text-xs text-muted-foreground">
                      <th className="px-2 py-2 text-left">At</th>
                      <th className="px-2 py-2 text-left">EA</th>
                      <th className="px-2 py-2 text-left">Type</th>
                      <th className="px-2 py-2 text-left">Severity</th>
                      <th className="px-2 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.exceptions.data?.exceptions ?? []).slice(0, 60).map((ex) => (
                      <tr key={ex.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-2 py-2 text-xs">{formatIso(ex.timestamp)}</td>
                        <td className="px-2 py-2 text-xs">{ex.eaId}</td>
                        <td className="px-2 py-2 text-xs">{ex.exceptionType}</td>
                        <td className="px-2 py-2 text-xs"><Badge variant={variant(ex.severity)}>{ex.severity}</Badge></td>
                        <td className="px-2 py-2 text-xs"><Badge variant={variant(ex.resolutionStatus)}>{ex.resolutionStatus}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle>AI EA Diagnostics</CardTitle>
              <CardDescription>Root cause, impact, recommended fix, auto-remediation and escalation signals.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[560px] rounded-md border border-slate-200">
                <div className="space-y-2 p-2">
                  {(data.diagnostics.data?.diagnostics ?? []).slice(0, 24).map((d) => (
                    <div key={d.id} className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium">{d.issueSummary}</div>
                          <div className="text-xs text-muted-foreground">{d.rootCause}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={variant(d.severity)}>{d.severity}</Badge>
                          <Badge variant={d.autoRemediationEligible ? "success" : "secondary"}>{d.autoRemediationEligible ? "Auto-fix eligible" : "Manual only"}</Badge>
                          <Badge variant={d.escalationRequired ? "destructive" : "secondary"}>{d.escalationRequired ? "Escalate" : "Monitor"}</Badge>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                        <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                          <div className="text-muted-foreground">Trading impact</div>
                          <div className="font-medium">{d.tradingImpact}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs">
                          <div className="text-muted-foreground">Recommended fix</div>
                          <div className="font-medium">{d.recommendedFix}</div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        <span className="font-medium text-slate-700">EA:</span> {d.eaId} • {Math.round(d.confidenceScore * 100)}% confidence
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>All EA actions are audit-logged.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[560px] rounded-md border border-slate-200">
                <table className="w-full text-sm" aria-label="EA audit trail">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200 text-xs text-muted-foreground">
                      <th className="px-2 py-2 text-left">At</th>
                      <th className="px-2 py-2 text-left">User</th>
                      <th className="px-2 py-2 text-left">Action</th>
                      <th className="px-2 py-2 text-left">Entity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.audit.data?.audit ?? []).slice(0, 80).map((a) => (
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
              <div className="mt-2 rounded-md border border-slate-200 bg-white p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-slate-700" />
                  <span>Security: Viewer is read-only. Analyst can view diagnostics/exports. Infra can restart/rebind. Trading Admin can toggle trading. Risk Manager escalates high-risk restoration.</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

