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
  ShieldAlert,
  Siren,
  Wand2,
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
import { useMt5ErrorLogs } from "../hooks/use-mt5-error-logs";
import { useMt5ErrorLogsStore } from "../stores/mt5-error-logs.store";
import type { Mt5ErrorIncident, Mt5ErrorLog, Mt5ErrorRiskLevel, Mt5ErrorSeverity } from "../types/mt5-error-logs.types";

type SortKey =
  | "occurredAt"
  | "errorId"
  | "sourceModule"
  | "errorType"
  | "severity"
  | "broker"
  | "account"
  | "terminal"
  | "eaInstance"
  | "symbol"
  | "errorCode"
  | "repeatCount"
  | "resolutionStatus"
  | "riskLevel";
type SortDir = "asc" | "desc";

function variant(value: string) {
  const v = value.toLowerCase();
  if (v.includes("healthy") || v.includes("resolved") || v.includes("low") || v.includes("info")) return "success" as const;
  if (v.includes("warning") || v.includes("watch") || v.includes("moderate") || v.includes("elevated")) return "warning" as const;
  if (v.includes("critical") || v.includes("emergency") || v.includes("high") || v.includes("unsafe") || v.includes("breached")) return "destructive" as const;
  return "secondary" as const;
}

function can(role: Mt5Role, action: "refresh" | "sync" | "diagnostics" | "resolve" | "reopen" | "escalate" | "autoRemediate" | "export") {
  if (action === "refresh" || action === "export") return true;
  if (action === "sync") return role === "Super Admin" || role === "Infrastructure Admin" || role === "Trading Admin";
  if (action === "diagnostics") return role === "Super Admin" || role === "Infrastructure Admin" || role === "Trading Admin" || role === "Risk Manager";
  if (action === "escalate") return role === "Super Admin" || role === "Risk Manager" || role === "Infrastructure Admin";
  if (action === "autoRemediate") return role === "Super Admin" || role === "Infrastructure Admin";
  if (action === "reopen") return role === "Super Admin" || role === "Infrastructure Admin" || role === "Trading Admin";
  return role === "Super Admin" || role === "Infrastructure Admin" || role === "Trading Admin";
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

function sortRows(rows: Mt5ErrorLog[], key: SortKey, dir: SortDir) {
  const cmp = (a: Mt5ErrorLog, b: Mt5ErrorLog) => {
    const av = (a as any)[key];
    const bv = (b as any)[key];
    if (typeof av === "number" && typeof bv === "number") return av - bv;
    return String(av ?? "").localeCompare(String(bv ?? ""));
  };
  const sorted = [...rows].sort(cmp);
  return dir === "asc" ? sorted : sorted.reverse();
}

function labelColor(sev: Mt5ErrorSeverity, risk: Mt5ErrorRiskLevel) {
  if (sev === "Emergency") return "text-red-700";
  if (sev === "Critical") return "text-red-600";
  if (sev === "High") return "text-orange-600";
  if (sev === "Warning") return "text-yellow-700";
  if (risk === "Critical" || risk === "High") return "text-red-600";
  return "text-slate-700";
}

function incidentColor(inc: Mt5ErrorIncident) {
  const s = `${inc.severity} ${inc.slaStatus} ${inc.escalationStatus}`;
  return variant(s);
}

export function Mt5ErrorLogsDashboard() {
  const queryClient = useQueryClient();
  const ui = useMt5ErrorLogsStore();
  const data = useMt5ErrorLogs();

  const [sortKey, setSortKey] = React.useState<SortKey>("occurredAt");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [exportFormat, setExportFormat] = React.useState<"json" | "csv">("json");

  const role = ui.role;
  const rows = data.errors.data?.errors ?? [];
  const sorted = sortRows(rows, sortKey, sortDir);

  const brokers = React.useMemo(() => {
    const all = new Map<string, string>();
    for (const e of data.errors.data?.errors ?? []) {
      if (e.brokerId && e.broker) all.set(e.brokerId, e.broker);
    }
    return [...all.entries()].map(([brokerId, broker]) => ({ brokerId, broker }));
  }, [data.errors.data?.errors]);

  const bySeverity = React.useMemo(() => {
    const counts: Record<string, number> = { Info: 0, Warning: 0, High: 0, Critical: 0, Emergency: 0 };
    for (const e of rows) counts[e.severity] = (counts[e.severity] ?? 0) + 1;
    return Object.entries(counts).map(([severity, count]) => ({ severity, count }));
  }, [rows]);

  const byModule = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of rows) counts.set(e.sourceModule, (counts.get(e.sourceModule) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([module, count]) => ({ module, count }));
  }, [rows]);

  const byBroker = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of rows) counts.set(e.broker ?? "Unknown", (counts.get(e.broker ?? "Unknown") ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([broker, count]) => ({ broker, count }));
  }, [rows]);

  const trends = data.trends.data?.points ?? [];

  const selected = data.error.data?.error ?? null;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["mt5-error-logs"] });
  };

  const markSelectedResolved = async () => {
    const ids = ui.selectedErrorIds;
    if (!ids.length) return;
    for (const errorId of ids) {
      await data.actions.markResolved.mutateAsync({
        errorId,
        payload: { resolutionAction: "Apply remediation and verify stability", resolutionNote: "Resolved from MT5 Error Logs dashboard." }
      });
    }
    ui.clearSelection();
  };

  const escalateCriticalUnresolved = async () => {
    const critical = rows.filter((e) => (e.severity === "Critical" || e.severity === "Emergency") && e.resolutionStatus !== "Resolved");
    for (const e of critical.slice(0, 8)) {
      await data.actions.escalate.mutateAsync({ errorId: e.errorId, payload: { requiredAction: "Immediate triage; run diagnostics; enforce safety gates if needed." } });
    }
  };

  const doExport = async () => {
    const res = await data.actions.exportReport.mutateAsync({
      format: exportFormat,
      filters: {
        search: ui.searchTerm || undefined,
        severity: ui.severityFilter,
        module: ui.moduleFilter,
        status: ui.statusFilter,
        brokerId: ui.brokerFilter
      } as any
    });
    const filename = `mt5-error-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${exportFormat}`;
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
            <h1 className="text-2xl font-semibold tracking-tight">MT5 Error Logs</h1>
            <p className="text-sm text-muted-foreground">
              Centralized error intelligence for MT5 terminals, brokers, EA bridges, accounts, orders, execution, synchronization, and infrastructure failures.
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
            <Button variant="secondary" onClick={() => data.actions.refreshLogs.mutate()} disabled={!can(role, "sync") || data.actions.refreshLogs.isPending}>
              <Wrench className="mr-2 h-4 w-4" />
              Sync Latest Errors
            </Button>
            <Button variant="secondary" onClick={() => data.actions.runDiagnostics.mutate(undefined)} disabled={!can(role, "diagnostics") || data.actions.runDiagnostics.isPending}>
              <Brain className="mr-2 h-4 w-4" />
              Run Error Diagnostics
            </Button>
            <Button variant="secondary" onClick={markSelectedResolved} disabled={!can(role, "resolve") || ui.selectedErrorIds.length === 0 || data.actions.markResolved.isPending}>
              <BadgeCheck className="mr-2 h-4 w-4" />
              Mark Selected Resolved
            </Button>
            <Button variant="destructive" onClick={escalateCriticalUnresolved} disabled={!can(role, "escalate") || data.actions.escalate.isPending}>
              <Siren className="mr-2 h-4 w-4" />
              Escalate Critical Errors
            </Button>
            <Button variant="outline" onClick={doExport} disabled={!can(role, "export") || data.actions.exportReport.isPending}>
              <Download className="mr-2 h-4 w-4" />
              Export Error Report
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
              <CardTitle>Error Processing Workflow</CardTitle>
              <CardDescription>
                Error Captured → Source Classified → Severity Scored → Duplicate Checked → Root Cause Analyzed → AI Recommendation Generated → Resolution Action Assigned → Audit Logged
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                {(data.workflow.data?.workflow ?? []).map((node) => (
                  <div key={node.title} className="rounded-md border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium">{node.title}</div>
                      <Badge variant={variant(node.status)}>{node.status}</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded border border-slate-200 bg-slate-50 p-2">
                        <div className="text-muted-foreground">Errors</div>
                        <div className="font-medium">{node.errorCount}</div>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 p-2">
                        <div className="text-muted-foreground">Failed</div>
                        <div className="font-medium">{node.failedCount}</div>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 p-2">
                        <div className="text-muted-foreground">Avg ms</div>
                        <div className="font-medium">{node.averageProcessingMs}</div>
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 p-2">
                        <div className="text-muted-foreground">Latest Critical</div>
                        <div className="truncate font-medium">{node.latestCriticalError}</div>
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
              <CardTitle>Error Frequency & Trends</CardTitle>
              <CardDescription>Severity mix, module distribution, and time-series trend.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="h-44 rounded-md border border-slate-200 bg-white p-2">
                  <div className="mb-1 text-xs font-medium text-slate-700">Errors by Severity</div>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bySeverity}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="severity" fontSize={10} />
                      <YAxis fontSize={10} />
                      <RechartsTooltip />
                      <Bar dataKey="count" fill="#0f172a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="h-44 rounded-md border border-slate-200 bg-white p-2">
                  <div className="mb-1 text-xs font-medium text-slate-700">Errors by Module (Top)</div>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byModule} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" fontSize={10} />
                      <YAxis type="category" dataKey="module" width={90} fontSize={10} />
                      <RechartsTooltip />
                      <Bar dataKey="count" fill="#334155" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="h-52 rounded-md border border-slate-200 bg-white p-2">
                <div className="mb-1 text-xs font-medium text-slate-700">Errors over Time</div>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bucketStart" tickFormatter={(v) => String(v).slice(11, 16)} fontSize={10} />
                    <YAxis fontSize={10} />
                    <RechartsTooltip labelFormatter={(v) => formatIso(String(v))} />
                    <Line type="monotone" dataKey="total" stroke="#0f172a" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="critical" stroke="#dc2626" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="resolved" stroke="#16a34a" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="h-40 rounded-md border border-slate-200 bg-white p-2">
                <div className="mb-1 text-xs font-medium text-slate-700">Errors by Broker (Top)</div>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byBroker}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="broker" fontSize={10} />
                    <YAxis fontSize={10} />
                    <RechartsTooltip />
                    <Bar dataKey="count" fill="#64748b" />
                  </BarChart>
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
                  <CardTitle>Error Logs Table</CardTitle>
                  <CardDescription>Searchable, sortable, filterable logs with actions and selection.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => ui.toggleDetailPanel()}>
                    {ui.showDetailPanel ? "Hide Detail" : "Show Detail"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
                <div className="md:col-span-2">
                  <input
                    aria-label="Search errors"
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                    placeholder="Search by message, code, broker, account, symbol, ticket…"
                    value={ui.searchTerm}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => ui.setSearchTerm(event.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Severity</label>
                  <select
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                    value={ui.severityFilter}
                    onChange={(e) => ui.setSeverityFilter(e.target.value as any)}
                    aria-label="Severity filter"
                  >
                    <option value="all">All</option>
                    <option value="Emergency">Emergency</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Warning">Warning</option>
                    <option value="Info">Info</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Status</label>
                  <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm" value={ui.statusFilter} onChange={(e) => ui.setStatusFilter(e.target.value as any)} aria-label="Status filter">
                    <option value="all">All</option>
                    <option value="Unresolved">Unresolved</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Reopened">Reopened</option>
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
              </div>
            </CardHeader>

            <CardContent>
              <ScrollArea className="h-[520px] rounded-md border border-slate-200">
                <table className="w-full text-sm" aria-label="Error logs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200 text-xs text-muted-foreground">
                      <th className="px-2 py-2 text-left">Select</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("errorId")}>Error ID</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("occurredAt")}>Timestamp</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("sourceModule")}>Source Module</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("errorType")}>Error Type</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("severity")}>Severity</th>
                      <th className="px-2 py-2 text-left">Broker</th>
                      <th className="px-2 py-2 text-left">Account</th>
                      <th className="px-2 py-2 text-left">Terminal</th>
                      <th className="px-2 py-2 text-left">EA</th>
                      <th className="px-2 py-2 text-left">Symbol</th>
                      <th className="px-2 py-2 text-left">Order ID</th>
                      <th className="px-2 py-2 text-left">MT5 Ticket</th>
                      <th className="px-2 py-2 text-left">Error Code</th>
                      <th className="px-2 py-2 text-left">Error Message</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("repeatCount")}>Repeat</th>
                      <th className="px-2 py-2 text-left">First Seen</th>
                      <th className="px-2 py-2 text-left">Last Seen</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("resolutionStatus")}>Status</th>
                      <th className="px-2 py-2 text-left">Assigned</th>
                      <th className="cursor-pointer px-2 py-2 text-left" onClick={() => setSort("riskLevel")}>Risk</th>
                      <th className="px-2 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row) => (
                      <tr key={row.errorId} className={cn("border-b border-slate-100 hover:bg-slate-50", ui.selectedErrorId === row.errorId && "bg-slate-50")}>
                        <td className="px-2 py-2">
                          <input
                            aria-label={`select-${row.errorId}`}
                            type="checkbox"
                            checked={ui.selectedErrorIds.includes(row.errorId)}
                            onChange={() => ui.toggleSelectedErrorId(row.errorId)}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Button variant="ghost" className="h-7 px-2" onClick={() => ui.setSelectedErrorId(row.errorId)}>
                            {row.errorId}
                          </Button>
                        </td>
                        <td className="px-2 py-2 text-xs">{formatIso(row.occurredAt)}</td>
                        <td className="px-2 py-2 text-xs">{row.sourceModule}</td>
                        <td className="px-2 py-2 text-xs">{row.errorType}</td>
                        <td className={cn("px-2 py-2 text-xs font-medium", labelColor(row.severity, row.riskLevel))}>{row.severity}</td>
                        <td className="px-2 py-2 text-xs">{row.broker ?? "—"}</td>
                        <td className="px-2 py-2 text-xs">{row.account ?? "—"}</td>
                        <td className="px-2 py-2 text-xs">{row.terminal ?? "—"}</td>
                        <td className="px-2 py-2 text-xs">{row.eaInstance ?? "—"}</td>
                        <td className="px-2 py-2 text-xs">{row.symbol ?? "—"}</td>
                        <td className="px-2 py-2 text-xs">{row.orderId ?? "—"}</td>
                        <td className="px-2 py-2 text-xs">{row.mt5Ticket ?? "—"}</td>
                        <td className="px-2 py-2 text-xs">{row.errorCode ?? "—"}</td>
                        <td className="max-w-[360px] truncate px-2 py-2 text-xs" title={row.errorMessage}>{row.errorMessage}</td>
                        <td className="px-2 py-2 text-xs">{row.repeatCount}</td>
                        <td className="px-2 py-2 text-xs">{formatIso(row.firstSeenAt)}</td>
                        <td className="px-2 py-2 text-xs">{formatIso(row.lastSeenAt)}</td>
                        <td className="px-2 py-2 text-xs">
                          <Badge variant={variant(row.resolutionStatus)}>{row.resolutionStatus}</Badge>
                        </td>
                        <td className="px-2 py-2 text-xs">{row.assignedTo ?? "—"}</td>
                        <td className="px-2 py-2 text-xs">
                          <Badge variant={variant(row.riskLevel)}>{row.riskLevel}</Badge>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-1">
                            <Button variant="outline" className="h-7 px-2 text-xs" onClick={() => ui.setSelectedErrorId(row.errorId)}>
                              View Error
                            </Button>
                            <Button
                              variant="secondary"
                              className="h-7 px-2 text-xs"
                              disabled={!can(role, "resolve") || row.resolutionStatus === "Resolved" || data.actions.markResolved.isPending}
                              onClick={() =>
                                data.actions.markResolved.mutate({
                                  errorId: row.errorId,
                                  payload: { resolutionAction: "Resolve and audit", resolutionNote: "Resolved from row action." }
                                })
                              }
                            >
                              Mark Resolved
                            </Button>
                            <Button
                              variant="secondary"
                              className="h-7 px-2 text-xs"
                              disabled={!can(role, "reopen") || row.resolutionStatus !== "Resolved" || data.actions.reopen.isPending}
                              onClick={() => data.actions.reopen.mutate({ errorId: row.errorId, payload: { reopenReason: "Reopened due to repeat event." } })}
                            >
                              Reopen
                            </Button>
                            <Button
                              variant="destructive"
                              className="h-7 px-2 text-xs"
                              disabled={!can(role, "escalate") || data.actions.escalate.isPending}
                              onClick={() => data.actions.escalate.mutate({ errorId: row.errorId, payload: { requiredAction: "Escalate and enforce safety gating." } })}
                            >
                              Escalate
                            </Button>
                            <Button
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              disabled={!can(role, "diagnostics") || data.actions.runDiagnostics.isPending}
                              onClick={() => data.actions.runDiagnostics.mutate(row.errorId)}
                            >
                              Run Diagnostics
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!sorted.length && (
                      <tr>
                        <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={22}>
                          No errors found for current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ScrollArea>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Total: {data.errors.data?.meta.total ?? 0}</span>
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
                <CardTitle>Error Detail Panel</CardTitle>
                <CardDescription>Identity, trading context, technical detail, and resolution state.</CardDescription>
              </CardHeader>
              <CardContent>
                {!selected && <div className="text-sm text-muted-foreground">Select an error to view details.</div>}
                {selected && (
                  <div className="space-y-3">
                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold">{selected.errorId}</div>
                          <div className="text-xs text-muted-foreground">{formatIso(selected.occurredAt)}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={variant(selected.severity)}>{selected.severity}</Badge>
                          <Badge variant={variant(selected.riskLevel)}>{selected.riskLevel}</Badge>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">{selected.errorMessage}</div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Source</div>
                          <div className="font-medium">{selected.sourceModule}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Type</div>
                          <div className="font-medium">{selected.errorType}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Code</div>
                          <div className="font-medium">{selected.errorCode ?? "—"}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Fingerprint</div>
                          <div className="truncate font-mono text-[10px]">{selected.fingerprintHash}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Broker</div>
                          <div className="font-medium">{selected.broker ?? "—"}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Account</div>
                          <div className="font-medium">{selected.account ?? "—"}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Terminal</div>
                          <div className="font-medium">{selected.terminal ?? "—"}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">EA Instance</div>
                          <div className="font-medium">{selected.eaInstance ?? "—"}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Symbol</div>
                          <div className="font-medium">{selected.symbol ?? "—"}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Order / Ticket</div>
                          <div className="font-medium">{selected.orderId ?? "—"} / {selected.mt5Ticket ?? "—"}</div>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Status before</div>
                          <div className="font-medium">{selected.statusBefore ?? "—"}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Status after</div>
                          <div className="font-medium">{selected.statusAfter ?? "—"}</div>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Repeat</div>
                          <div className="font-medium">{selected.repeatCount}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">First seen</div>
                          <div className="font-medium">{formatIso(selected.firstSeenAt)}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Last seen</div>
                          <div className="font-medium">{formatIso(selected.lastSeenAt)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-sm font-medium">Resolution</div>
                        <Badge variant={variant(selected.resolutionStatus)}>{selected.resolutionStatus}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Assigned</div>
                          <div className="font-medium">{selected.assignedTo ?? "—"}</div>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Env / Host</div>
                          <div className="font-medium">{selected.environment} / {selected.hostMachine ?? "—"}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          disabled={!can(role, "resolve") || selected.resolutionStatus === "Resolved" || data.actions.markResolved.isPending}
                          onClick={() =>
                            data.actions.markResolved.mutate({
                              errorId: selected.errorId,
                              payload: { resolutionAction: "Resolve and audit", resolutionNote: "Resolved from detail panel." }
                            })
                          }
                        >
                          <BadgeCheck className="mr-2 h-4 w-4" />
                          Mark Resolved
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={!can(role, "reopen") || selected.resolutionStatus !== "Resolved" || data.actions.reopen.isPending}
                          onClick={() => data.actions.reopen.mutate({ errorId: selected.errorId, payload: { reopenReason: "Reopened for follow-up investigation." } })}
                        >
                          <AlertTriangle className="mr-2 h-4 w-4" />
                          Reopen
                        </Button>
                        <Button
                          variant="destructive"
                          disabled={!can(role, "escalate") || data.actions.escalate.isPending}
                          onClick={() => data.actions.escalate.mutate({ errorId: selected.errorId, payload: { requiredAction: "Escalate due to severity/risk." } })}
                        >
                          <ShieldAlert className="mr-2 h-4 w-4" />
                          Escalate
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!can(role, "autoRemediate") || data.actions.remediate.isPending}
                          onClick={() => data.actions.remediate.mutate(selected.errorId)}
                        >
                          <Wand2 className="mr-2 h-4 w-4" />
                          Auto-Remediate
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="text-sm font-medium">Technical Details</div>
                      <div className="mt-2 space-y-2 text-xs">
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Technical</div>
                          <pre className="whitespace-pre-wrap break-words font-mono text-[10px]">{selected.technicalDetails ?? "—"}</pre>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Stack trace</div>
                          <pre className="whitespace-pre-wrap break-words font-mono text-[10px]">{selected.stackTrace ?? "—"}</pre>
                        </div>
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <div className="text-muted-foreground">Payload hash</div>
                          <div className="font-mono text-[10px]">{selected.payloadHash ?? "—"}</div>
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
          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Error Categories</CardTitle>
              <CardDescription>Grouped by operational category with critical counts.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(data.categories.data?.categories ?? []).map((c) => (
                  <div key={c.key} className="rounded-md border border-slate-200 bg-white p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-medium">{c.key}</div>
                      <div className="flex items-center gap-2">
                        <Badge variant={c.criticalCount > 0 ? "destructive" : "secondary"}>{c.criticalCount} critical</Badge>
                        <Badge variant="secondary">{c.count} total</Badge>
                      </div>
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {c.topMessage ? <span className="truncate">{c.topMessage}</span> : <span>No recent errors.</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Duplicate & Repeated Detection</CardTitle>
              <CardDescription>Fingerprint-based grouping of duplicates and repeat trend.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[320px] rounded-md border border-slate-200">
                <table className="w-full text-sm" aria-label="Repeated fingerprints">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200 text-xs text-muted-foreground">
                      <th className="px-2 py-2 text-left">Fingerprint</th>
                      <th className="px-2 py-2 text-left">Module</th>
                      <th className="px-2 py-2 text-left">Type</th>
                      <th className="px-2 py-2 text-left">Repeat</th>
                      <th className="px-2 py-2 text-left">Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.repeated.data?.fingerprints ?? []).slice(0, 25).map((fp) => (
                      <tr key={fp.fingerprintHash} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="max-w-[160px] truncate px-2 py-2 font-mono text-[10px]" title={fp.fingerprintHash}>
                          {fp.fingerprintHash}
                        </td>
                        <td className="px-2 py-2 text-xs">{fp.sourceModule}</td>
                        <td className="px-2 py-2 text-xs">{fp.errorType}</td>
                        <td className="px-2 py-2 text-xs">{fp.repeatCount}</td>
                        <td className="px-2 py-2 text-xs">
                          <Badge variant={variant(fp.impactLevel)}>{fp.impactLevel}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
              <div className="mt-2 text-xs text-muted-foreground">Suggested permanent fix: standardize retries + circuit breakers; verify dependency health gating.</div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader>
              <CardTitle>Critical Incidents & Escalations</CardTitle>
              <CardDescription>Incident queue with SLA tracking and required actions.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[320px] rounded-md border border-slate-200">
                <table className="w-full text-sm" aria-label="Incidents">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200 text-xs text-muted-foreground">
                      <th className="px-2 py-2 text-left">Incident</th>
                      <th className="px-2 py-2 text-left">Error</th>
                      <th className="px-2 py-2 text-left">Severity</th>
                      <th className="px-2 py-2 text-left">Service</th>
                      <th className="px-2 py-2 text-left">SLA</th>
                      <th className="px-2 py-2 text-left">Deadline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.incidents.data?.incidents ?? []).map((inc) => (
                      <tr key={inc.incidentId} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-2 py-2 text-xs font-medium">{inc.incidentId}</td>
                        <td className="px-2 py-2 text-xs">{inc.errorId}</td>
                        <td className="px-2 py-2 text-xs">
                          <Badge variant={incidentColor(inc)}>{inc.severity}</Badge>
                        </td>
                        <td className="px-2 py-2 text-xs">{inc.affectedService}</td>
                        <td className="px-2 py-2 text-xs">
                          <Badge variant={variant(inc.slaStatus)}>{inc.slaStatus}</Badge>
                        </td>
                        <td className="px-2 py-2 text-xs">{formatIso(inc.resolutionDeadline)}</td>
                      </tr>
                    ))}
                    {!(data.incidents.data?.incidents ?? []).length && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                          No critical incidents at the moment.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ScrollArea>
              <div className="mt-2 text-xs text-muted-foreground">Assigned roles: Infra/Trading/Risk; all escalations are audit-logged.</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <CardHeader>
              <CardTitle>AI Error Diagnostics</CardTitle>
              <CardDescription>Root cause patterns, impact, recommended fix, eligibility and confidence.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[360px] rounded-md border border-slate-200">
                <div className="space-y-2 p-2">
                  {(data.diagnostics.data?.diagnostics ?? []).map((d) => (
                    <div key={d.id} className="rounded-md border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-medium">{d.issueSummary}</div>
                          <div className="text-xs text-muted-foreground">{d.rootCause}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={d.escalationRequired ? "destructive" : "secondary"}>{d.escalationRequired ? "Escalate" : "Monitor"}</Badge>
                          <Badge variant={d.autoRemediationEligible ? "success" : "secondary"}>{d.autoRemediationEligible ? "Auto-fix eligible" : "Manual only"}</Badge>
                          <Badge variant={variant(String(d.confidenceScore))}>{Math.round(d.confidenceScore * 100)}%</Badge>
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
                        <span className="font-medium text-slate-700">Affected:</span> {(d.affectedComponents ?? []).join(", ") || "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="lg:col-span-5">
            <CardHeader>
              <CardTitle>Resolution & Audit</CardTitle>
              <CardDescription>Resolution actions and audit trail for all error operations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-white">
                <div className="border-b border-slate-200 p-2 text-xs font-medium text-slate-700">Recent Resolutions</div>
                <ScrollArea className="h-[160px]">
                  <table className="w-full text-sm" aria-label="Resolutions">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-slate-200 text-xs text-muted-foreground">
                        <th className="px-2 py-2 text-left">Error</th>
                        <th className="px-2 py-2 text-left">Action</th>
                        <th className="px-2 py-2 text-left">By</th>
                        <th className="px-2 py-2 text-left">At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.resolutions.data?.resolutions ?? []).slice(0, 20).map((r) => (
                        <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-2 py-2 text-xs">{r.errorId}</td>
                          <td className="max-w-[220px] truncate px-2 py-2 text-xs" title={r.resolutionAction}>{r.resolutionAction}</td>
                          <td className="px-2 py-2 text-xs">{r.resolvedBy ?? "—"}</td>
                          <td className="px-2 py-2 text-xs">{formatIso(r.resolvedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>

              <div className="rounded-md border border-slate-200 bg-white">
                <div className="border-b border-slate-200 p-2 text-xs font-medium text-slate-700">Audit Trail</div>
                <ScrollArea className="h-[180px]">
                  <table className="w-full text-sm" aria-label="Audit trail">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-slate-200 text-xs text-muted-foreground">
                        <th className="px-2 py-2 text-left">At</th>
                        <th className="px-2 py-2 text-left">User</th>
                        <th className="px-2 py-2 text-left">Action</th>
                        <th className="px-2 py-2 text-left">Entity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.audit.data?.audit ?? []).slice(0, 25).map((a) => (
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
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-slate-700" />
                  <span>
                    Security: Viewer is read-only. Analyst can export. Infra/Trading can resolve per scope. Risk Manager escalates unsafe trading. Super Admin can do all.
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
