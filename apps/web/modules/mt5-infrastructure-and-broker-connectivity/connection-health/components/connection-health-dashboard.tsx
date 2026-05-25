"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Cable,
  Download,
  Gauge,
  GitBranch,
  HeartPulse,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  TriangleAlert,
  Wrench
} from "lucide-react";
import {
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
import { useConnectionHealth } from "../hooks/use-connection-health";
import { useConnectionHealthStore } from "../stores/connection-health.store";
import type {
  AiConnectionDiagnostic,
  ConnectionComponent,
  ConnectionIncident,
  ConnectionLogEntry,
  DependencyMapResponse,
  HeartbeatMonitorRow,
  LatencyPoint,
  PacketLossPoint
} from "../types/connection-health.types";
import { formatIso, formatMs, formatNumber, formatPercent, formatSeconds } from "../utils/connection-health.mappers";

type SortDir = "asc" | "desc";
type DetailTab = "Identity" | "Dependencies" | "Readiness" | "Incidents" | "Audit";

function statusVariant(status: string) {
  const s = status.toLowerCase();
  if (s.includes("healthy") || s.includes("low")) return "success" as const;
  if (s.includes("sync") || s.includes("watch") || s.includes("moderate")) return "warning" as const;
  if (s.includes("degraded") || s.includes("high")) return "warning" as const;
  if (s.includes("critical") || s.includes("offline")) return "destructive" as const;
  return "secondary" as const;
}

function scoreVariant(score: number) {
  if (score >= 90) return "success" as const;
  if (score >= 75) return "default" as const;
  if (score >= 60) return "warning" as const;
  return "destructive" as const;
}

function can(role: Mt5Role, action: "diagnostics" | "reconnect" | "restart" | "disablePath" | "disableGlobal") {
  if (action === "disableGlobal") return role === "Super Admin";
  if (action === "reconnect" || action === "restart") return role === "Super Admin" || role === "Infrastructure Admin";
  if (action === "disablePath") return role === "Super Admin" || role === "Trading Admin";
  return role === "Super Admin" || role === "Infrastructure Admin" || role === "Analyst";
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

function toCsv(components: ConnectionComponent[]) {
  const headers: (keyof ConnectionComponent)[] = [
    "componentId",
    "componentType",
    "componentName",
    "broker",
    "account",
    "terminal",
    "eaInstance",
    "hostMachine",
    "connectionStatus",
    "heartbeatStatus",
    "lastHeartbeat",
    "latencyMs",
    "packetLossPercent",
    "uptimePercent",
    "errorCount",
    "retryCount",
    "lastIncident",
    "healthScore",
    "riskLevel",
    "tradingPathActive",
    "createdAt",
    "updatedAt"
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return `"${s.replaceAll('"', '""')}"`;
  };
  const rows = components.map((c) => headers.map((h) => escape(c[h])).join(","));
  return `${headers.join(",")}\n${rows.join("\n")}`;
}

function SortHeader({ label, active, dir, onClick }: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("inline-flex items-center gap-1 text-left text-[11px] font-semibold uppercase tracking-wide", active ? "text-slate-950" : "text-slate-600")}
    >
      <span>{label}</span>
      <span className={cn("text-[11px]", active ? "text-slate-700" : "text-slate-400")}>{active ? (dir === "asc" ? "↑" : "↓") : "↕"}</span>
    </button>
  );
}

function TabPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[11px] font-semibold uppercase",
        active ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

export function ConnectionHealthDashboard() {
  const queryClient = useQueryClient();
  const {
    summary,
    workflow,
    dependencyMap,
    components,
    component,
    latency,
    packetLoss,
    heartbeats,
    incidents,
    logs,
    diagnostics,
    streamConnected,
    actions
  } = useConnectionHealth();

  const role = useConnectionHealthStore((s) => s.role);
  const setRole = useConnectionHealthStore((s) => s.setRole);
  const searchTerm = useConnectionHealthStore((s) => s.searchTerm);
  const setSearchTerm = useConnectionHealthStore((s) => s.setSearchTerm);
  const typeFilter = useConnectionHealthStore((s) => s.typeFilter);
  const setTypeFilter = useConnectionHealthStore((s) => s.setTypeFilter);
  const statusFilter = useConnectionHealthStore((s) => s.statusFilter);
  const setStatusFilter = useConnectionHealthStore((s) => s.setStatusFilter);
  const incidentFilter = useConnectionHealthStore((s) => s.incidentFilter);
  const setIncidentFilter = useConnectionHealthStore((s) => s.setIncidentFilter);
  const selectedComponentId = useConnectionHealthStore((s) => s.selectedComponentId);
  const setSelectedComponentId = useConnectionHealthStore((s) => s.setSelectedComponentId);
  const selectedComponentIds = useConnectionHealthStore((s) => s.selectedComponentIds);
  const toggleSelected = useConnectionHealthStore((s) => s.toggleSelected);
  const clearSelected = useConnectionHealthStore((s) => s.clearSelected);
  const showDetailPanel = useConnectionHealthStore((s) => s.showDetailPanel);
  const toggleDetailPanel = useConnectionHealthStore((s) => s.toggleDetailPanel);

  const [sortKey, setSortKey] = React.useState<keyof ConnectionComponent>("healthScore");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [detailTab, setDetailTab] = React.useState<DetailTab>("Identity");

  const selectedIds = React.useMemo(() => Object.entries(selectedComponentIds).filter(([, v]) => v).map(([k]) => k), [selectedComponentIds]);
  const allComponents = components.data?.components ?? [];
  const selected = component.data?.component ?? null;

  const sortedRows = React.useMemo(() => {
    const rows = allComponents;
    const dir = sortDir === "asc" ? 1 : -1;
    const val = (r: ConnectionComponent) => r[sortKey];
    return [...rows].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
  }, [allComponents, sortKey, sortDir]);

  const onToggleSort = (key: keyof ConnectionComponent) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ["connection-health"] });
  };

  const exportReport = () => {
    const payload = {
      meta: { exportedAt: new Date().toISOString(), role },
      summary: summary.data ?? null,
      workflow: workflow.data ?? null,
      dependencyMap: dependencyMap.data ?? null,
      components: components.data?.components ?? [],
      latency: latency.data ?? null,
      packetLoss: packetLoss.data ?? null,
      heartbeats: heartbeats.data ?? null,
      incidents: incidents.data?.incidents ?? [],
      logs: logs.data?.logs ?? [],
      diagnostics: diagnostics.data?.diagnostics ?? []
    };
    downloadText(`connection-health-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.json`, JSON.stringify(payload, null, 2));
  };

  const exportComponentsCsv = () => {
    downloadText(`connection-components-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.csv`, toCsv(allComponents), "text/csv");
  };

  const summaryScore = summary.data?.overallHealth.score ?? 0;
  const infraRisk = summary.data?.infrastructureRiskLevel ?? "Low";

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="h-1.5 w-full rounded-t-2xl bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500" />
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">Connection Health</h1>
                <Badge variant={scoreVariant(summaryScore)}>
                  <Gauge className="h-3.5 w-3.5" />
                  Overall {summaryScore}/100
                </Badge>
                <Badge variant={statusVariant(infraRisk)}>
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Risk {infraRisk}
                </Badge>
                <Badge variant={streamConnected ? "success" : "secondary"}>
                  <Cable className="h-3.5 w-3.5" />
                  {streamConnected ? "Realtime" : "Snapshot"}
                </Badge>
              </div>
              <p className="mt-2 max-w-5xl text-sm font-semibold text-slate-700 sm:text-base">
                Real-time health intelligence for MT5 terminals, brokers, EA bridges, accounts, market feeds, routing channels, and execution services.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase text-slate-500">Role</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Mt5Role)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900"
                >
                  {(["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager", "Analyst", "Read-Only Viewer"] as const).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                <Separator orientation="vertical" className="mx-1 h-6" />

                <div className="text-xs font-semibold text-slate-600">
                  Selected: <span className="text-slate-950">{selectedIds.length}</span>
                </div>
                <Button variant="outline" size="sm" onClick={clearSelected} disabled={!selectedIds.length}>
                  Clear Selected
                </Button>
                <Button variant="outline" size="sm" onClick={toggleDetailPanel}>
                  {showDetailPanel ? "Hide Detail" : "Show Detail"}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Button variant="outline" onClick={() => void refreshAll()} disabled={summary.isFetching || components.isFetching}>
                <RefreshCw className={cn("h-4 w-4", summary.isFetching || components.isFetching ? "animate-spin" : "")} />
                Refresh Health
              </Button>
              <Button
                variant="secondary"
                onClick={() => actions.runFullDiagnostics.mutate()}
                disabled={!can(role, "diagnostics") || actions.runFullDiagnostics.isPending}
                title={!can(role, "diagnostics") ? "Requires Analyst, Infrastructure Admin, or Super Admin" : undefined}
              >
                <Wrench className="h-4 w-4" />
                Run Full Diagnostics
              </Button>
              <Button variant="outline" onClick={() => void refreshAll()}>
                <RotateCcw className="h-4 w-4" />
                Sync Connection Status
              </Button>
              <Button
                variant="secondary"
                onClick={() => actions.reconnectFailed.mutate()}
                disabled={!can(role, "reconnect") || actions.reconnectFailed.isPending}
                title={!can(role, "reconnect") ? "Requires Infrastructure Admin or Super Admin" : undefined}
              >
                <RotateCcw className="h-4 w-4" />
                Reconnect Failed Services
              </Button>
              <Button
                variant="secondary"
                onClick={() => actions.restartUnhealthy.mutate()}
                disabled={!can(role, "restart") || actions.restartUnhealthy.isPending}
                title={!can(role, "restart") ? "Requires Infrastructure Admin or Super Admin" : undefined}
              >
                <Wrench className="h-4 w-4" />
                Restart Unhealthy Channels
              </Button>
              <Button
                variant="destructive"
                onClick={() => actions.disableUnsafeTrading.mutate()}
                disabled={!can(role, "disableGlobal") || actions.disableUnsafeTrading.isPending}
                title={!can(role, "disableGlobal") ? "Requires Super Admin" : undefined}
              >
                <ShieldAlert className="h-4 w-4" />
                Disable Unsafe Trading
              </Button>
              <Button variant="outline" onClick={exportReport} disabled={role === "Read-Only Viewer"}>
                <Download className="h-4 w-4" />
                Export Health Report
              </Button>
              <Button variant="outline" onClick={exportComponentsCsv} disabled={!allComponents.length}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(summary.data?.kpis ?? []).slice(0, 12).map((kpi) => (
          <Card
            key={kpi.label}
            className={cn("p-4", kpi.status === "Critical" ? "border-red-200" : kpi.status === "Degraded" ? "border-orange-200" : "border-slate-200")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-slate-500">{kpi.label}</p>
                <p className="mt-2 truncate text-2xl font-semibold text-slate-950">{kpi.value}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
                {kpi.label.includes("Heartbeat") ? (
                  <HeartPulse className="h-5 w-5 text-slate-700" />
                ) : kpi.label.includes("Latency") ? (
                  <Activity className="h-5 w-5 text-slate-700" />
                ) : kpi.label.includes("Risk") ? (
                  <ShieldAlert className="h-5 w-5 text-slate-700" />
                ) : (
                  <Gauge className="h-5 w-5 text-slate-700" />
                )}
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{kpi.detail}</p>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-blue-600">End-to-End Connection Workflow</p>
              <CardTitle className="mt-1 text-2xl">Connectivity chain validation</CardTitle>
              <CardDescription className="mt-2 max-w-4xl">
                Terminal Heartbeat → EA Bridge Session → Broker Server Connection → Account Authentication → Symbol Availability → Market Data Feed → Order Router Channel → Execution Queue → MT5 Execution Feedback → Audit Confirmation
              </CardDescription>
            </div>
            <Badge variant={scoreVariant(summaryScore)}>{summary.data?.overallHealth.rating ?? "—"}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {(workflow.data?.workflow ?? []).map((w) => (
              <div key={w.title} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-slate-600">{w.title}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">
                      {w.componentCount} comps · {w.failedCount} failed
                    </p>
                  </div>
                  <Badge variant={statusVariant(w.status)}>{w.status}</Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <p className="font-semibold text-slate-500">Avg latency</p>
                    <p className="font-semibold text-slate-800">{formatMs(w.averageLatencyMs)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">Last OK</p>
                    <p className="font-semibold text-slate-800">{new Date(w.lastSuccessfulEvent).toLocaleTimeString()}</p>
                  </div>
                </div>
                <p className="mt-2 line-clamp-1 text-xs leading-5 text-slate-700">{w.bottleneckWarning}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{w.aiRecommendation}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-blue-600">Dependency Map</p>
              <CardTitle className="mt-1 text-2xl">Exact failed link identification</CardTitle>
              <CardDescription className="mt-2 max-w-4xl">
                Host Machine → MT5 Terminal → EA Bridge → Broker Server → Account Session → Market Data Feed → Risk Engine → Order Router → Execution Queue → MT5 Execution Feedback
              </CardDescription>
            </div>
            <Badge variant={dependencyMap.data?.firstFailedComponentId ? "warning" : "success"}>
              <GitBranch className="h-3.5 w-3.5" />
              {dependencyMap.data?.firstFailedComponentId ? "Degraded Link" : "Chain OK"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <DependencyMapPanel data={dependencyMap.data ?? null} loading={dependencyMap.isLoading} />
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Latency & Packet Loss Monitor</p>
                <CardTitle className="mt-1 text-2xl">Trend analysis</CardTitle>
                <CardDescription className="mt-2 max-w-4xl">Latency, packet loss, and stability indicators across brokers and critical components.</CardDescription>
              </div>
              <Badge variant="secondary">
                <Activity className="h-3.5 w-3.5" />
                Trend
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <LatencyPacketLossCharts latency={latency.data?.points ?? []} packetLoss={packetLoss.data?.points ?? []} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Heartbeat & Availability Monitor</p>
                <CardTitle className="mt-1 text-2xl">Heartbeat classification and missed counts</CardTitle>
                <CardDescription className="mt-2 max-w-4xl">
                  Healthy: 0–30s · Watch: 31–60s · Degraded: 61–120s · Critical: 121–300s · Offline: &gt; 300s
                </CardDescription>
              </div>
              <Badge variant="secondary">{heartbeats.data?.meta.total ?? 0} rows</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <HeartbeatTable rows={heartbeats.data?.heartbeats ?? []} loading={heartbeats.isLoading} onSelect={(id) => setSelectedComponentId(id)} />
          </CardContent>
        </Card>
      </section>

      <div className={cn("grid gap-4", showDetailPanel ? "xl:grid-cols-[1.25fr_0.75fr]" : "")}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Connection Components Table</p>
                <CardTitle className="mt-1 text-2xl">Component-level health and actions</CardTitle>
                <CardDescription className="mt-2">Search, filter, and control terminals, brokers, EA bridges, feeds, router channels, and execution services.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="component-search">
                  Search components
                </label>
                <input
                  id="component-search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search component, broker, host, status…"
                  className="h-10 w-72 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400"
                />
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900">
                  <option value="all">All types</option>
                  {[
                    "Host Machine",
                    "MT5 Terminal",
                    "EA Bridge",
                    "Broker Server",
                    "Trading Account",
                    "Market Data Feed",
                    "Risk Engine",
                    "Order Router",
                    "Execution Queue",
                    "MT5 Feedback",
                    "Audit Service"
                  ].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900">
                  <option value="all">All statuses</option>
                  {["Healthy", "Syncing", "Degraded", "Critical", "Offline", "Unknown"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  {["Healthy", "Watch", "Degraded", "Critical", "Offline"].map((s) => (
                    <option key={s} value={s}>
                      Heartbeat: {s}
                    </option>
                  ))}
                  {["Low", "Moderate", "High", "Critical"].map((s) => (
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
              <table aria-label="Connection components" className="min-w-[2300px] table-fixed border-collapse bg-white">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="w-10 px-3 py-2 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.length > 0 && selectedIds.length === sortedRows.length}
                        onChange={() => {
                          if (selectedIds.length === sortedRows.length) {
                            clearSelected();
                            return;
                          }
                          for (const row of sortedRows) toggleSelected(row.componentId);
                        }}
                      />
                    </th>
                    <th className="w-[170px] px-3 py-2">
                      <SortHeader label="Component ID" active={sortKey === "componentId"} dir={sortDir} onClick={() => onToggleSort("componentId")} />
                    </th>
                    <th className="w-[170px] px-3 py-2">
                      <SortHeader label="Type" active={sortKey === "componentType"} dir={sortDir} onClick={() => onToggleSort("componentType")} />
                    </th>
                    <th className="w-[220px] px-3 py-2">
                      <SortHeader label="Name" active={sortKey === "componentName"} dir={sortDir} onClick={() => onToggleSort("componentName")} />
                    </th>
                    <th className="w-[140px] px-3 py-2">
                      <SortHeader label="Broker" active={sortKey === "broker"} dir={sortDir} onClick={() => onToggleSort("broker")} />
                    </th>
                    <th className="w-[190px] px-3 py-2">
                      <SortHeader label="Account" active={sortKey === "account"} dir={sortDir} onClick={() => onToggleSort("account")} />
                    </th>
                    <th className="w-[160px] px-3 py-2">
                      <SortHeader label="Terminal" active={sortKey === "terminal"} dir={sortDir} onClick={() => onToggleSort("terminal")} />
                    </th>
                    <th className="w-[160px] px-3 py-2">
                      <SortHeader label="EA Instance" active={sortKey === "eaInstance"} dir={sortDir} onClick={() => onToggleSort("eaInstance")} />
                    </th>
                    <th className="w-[160px] px-3 py-2">
                      <SortHeader label="Host" active={sortKey === "hostMachine"} dir={sortDir} onClick={() => onToggleSort("hostMachine")} />
                    </th>
                    <th className="w-[140px] px-3 py-2">
                      <SortHeader label="Conn" active={sortKey === "connectionStatus"} dir={sortDir} onClick={() => onToggleSort("connectionStatus")} />
                    </th>
                    <th className="w-[140px] px-3 py-2">
                      <SortHeader label="Heartbeat" active={sortKey === "heartbeatStatus"} dir={sortDir} onClick={() => onToggleSort("heartbeatStatus")} />
                    </th>
                    <th className="w-[160px] px-3 py-2">
                      <SortHeader label="Last Heartbeat" active={sortKey === "lastHeartbeat"} dir={sortDir} onClick={() => onToggleSort("lastHeartbeat")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Latency" active={sortKey === "latencyMs"} dir={sortDir} onClick={() => onToggleSort("latencyMs")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Packet Loss" active={sortKey === "packetLossPercent"} dir={sortDir} onClick={() => onToggleSort("packetLossPercent")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Uptime" active={sortKey === "uptimePercent"} dir={sortDir} onClick={() => onToggleSort("uptimePercent")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Errors" active={sortKey === "errorCount"} dir={sortDir} onClick={() => onToggleSort("errorCount")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Retries" active={sortKey === "retryCount"} dir={sortDir} onClick={() => onToggleSort("retryCount")} />
                    </th>
                    <th className="w-[160px] px-3 py-2">
                      <SortHeader label="Last Incident" active={sortKey === "lastIncident"} dir={sortDir} onClick={() => onToggleSort("lastIncident")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Health" active={sortKey === "healthScore"} dir={sortDir} onClick={() => onToggleSort("healthScore")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Risk" active={sortKey === "riskLevel"} dir={sortDir} onClick={() => onToggleSort("riskLevel")} />
                    </th>
                    <th className="w-[500px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => {
                    const checked = Boolean(selectedComponentIds[row.componentId]);
                    const active = row.componentId === selectedComponentId;
                    return (
                      <tr
                        key={row.componentId}
                        className={cn("border-b border-slate-100 hover:bg-slate-50", active ? "bg-blue-50" : "bg-white")}
                        onClick={() => {
                          setSelectedComponentId(row.componentId);
                          setDetailTab("Identity");
                        }}
                      >
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={checked} onChange={() => toggleSelected(row.componentId)} />
                        </td>
                        <td className="px-3 py-2 text-sm font-semibold text-slate-950">{row.componentId}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.componentType}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.componentName}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.broker ?? "—"}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.account ?? "—"}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.terminal ?? "—"}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.eaInstance ?? "—"}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.hostMachine}</td>
                        <td className="px-3 py-2">
                          <Badge variant={statusVariant(row.connectionStatus)}>{row.connectionStatus}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={statusVariant(row.heartbeatStatus)}>{row.heartbeatStatus}</Badge>
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.lastHeartbeat ? new Date(row.lastHeartbeat).toLocaleTimeString() : "—"}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{formatMs(row.latencyMs)}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{formatPercent(row.packetLossPercent)}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{formatPercent(row.uptimePercent)}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.errorCount}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.retryCount}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.lastIncident ? new Date(row.lastIncident).toLocaleTimeString() : "—"}</td>
                        <td className="px-3 py-2">
                          <Badge variant={scoreVariant(row.healthScore)}>{row.healthScore}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={statusVariant(row.riskLevel)}>{row.riskLevel}</Badge>
                        </td>
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setSelectedComponentId(row.componentId)}>
                              View Component
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => actions.componentDiagnostics.mutate(row.componentId)}
                              disabled={!can(role, "diagnostics") || actions.componentDiagnostics.isPending}
                            >
                              Run Diagnostics
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => actions.componentReconnect.mutate(row.componentId)}
                              disabled={!can(role, "reconnect") || actions.componentReconnect.isPending}
                            >
                              Reconnect
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => actions.componentRestart.mutate(row.componentId)}
                              disabled={!can(role, "restart") || actions.componentRestart.isPending}
                            >
                              Restart Channel
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => actions.componentDisablePath.mutate(row.componentId)}
                              disabled={!can(role, "disablePath") || actions.componentDisablePath.isPending}
                            >
                              Disable Trading Path
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDetailTab("Audit")}>
                              View Logs
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDetailTab("Dependencies")}>
                              View Dependency Map
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDetailTab("Audit")}>
                              View Audit Trail
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!sortedRows.length ? (
                    <tr>
                      <td colSpan={22} className="px-4 py-10 text-center text-sm font-semibold text-slate-600">
                        No components match the current search/filter criteria.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {showDetailPanel ? (
          <Card className="min-h-[720px]">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-blue-600">Component Detail Panel</p>
                    <CardTitle className="mt-1 text-2xl">{selected ? selected.componentName : "Select a component"}</CardTitle>
                    <CardDescription className="mt-2">Identity, runtime health, dependency health, trading readiness, incidents, and audit trail.</CardDescription>
                  </div>
                  {selected ? <Badge variant={statusVariant(selected.connectionStatus)}>{selected.connectionStatus}</Badge> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(["Identity", "Dependencies", "Readiness", "Incidents", "Audit"] as const).map((t) => (
                    <TabPill key={t} active={detailTab === t} onClick={() => setDetailTab(t)}>
                      {t}
                    </TabPill>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-[610px] pr-3">
                {!selected ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-semibold text-slate-700">
                    Select a component in the table to view identity, dependencies, readiness, incidents, and audit trail.
                  </div>
                ) : detailTab === "Identity" ? (
                  <ComponentIdentityPanel component={selected} />
                ) : detailTab === "Dependencies" ? (
                  <ComponentDependenciesPanel component={selected} map={dependencyMap.data ?? null} />
                ) : detailTab === "Readiness" ? (
                  <ComponentReadinessPanel component={selected} map={dependencyMap.data ?? null} />
                ) : detailTab === "Incidents" ? (
                  <ComponentIncidentsPanel componentId={selected.componentId} incidents={incidents.data?.incidents ?? []} />
                ) : (
                  <ComponentAuditPanel componentId={selected.componentId} logs={logs.data?.logs ?? []} />
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Connection Incidents & Logs</p>
                <CardTitle className="mt-1 text-2xl">Operational incidents and root cause</CardTitle>
                <CardDescription className="mt-2">
                  Timestamp, component, broker/account, incident type, severity, error message, root cause, action taken, resolution status, and AI explanation.
                </CardDescription>
              </div>
              <select
                value={incidentFilter}
                onChange={(e) => setIncidentFilter(e.target.value)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900"
              >
                {["All", "Terminal", "EA Bridge", "Broker", "Account", "Market Data", "Order Router", "Execution Queue", "Heartbeat", "Latency", "Packet Loss", "Resolved", "Unresolved"].map(
                  (f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  )
                )}
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <IncidentsTable incidents={incidents.data?.incidents ?? []} loading={incidents.isLoading} onSelect={(id) => setSelectedComponentId(id)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">AI Connection Diagnostics</p>
                <CardTitle className="mt-1 text-2xl">Dependency impact and trading safety</CardTitle>
                <CardDescription className="mt-2">
                  Detects broken dependency chain, heartbeat delay, EA bridge instability, broker degradation, authentication failures, market feed interruptions, routing/queue congestion, packet loss spikes, and unsafe trading paths.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => actions.autoRemediate.mutate()}
                  disabled={!can(role, "reconnect") || actions.autoRemediate.isPending}
                  title={!can(role, "reconnect") ? "Requires Infrastructure Admin or Super Admin" : undefined}
                >
                  <Wrench className="h-4 w-4" />
                  Auto-Remediate
                </Button>
                <Button variant="outline" onClick={() => diagnostics.refetch()}>
                  <RefreshCw className={cn("h-4 w-4", diagnostics.isFetching ? "animate-spin" : "")} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DiagnosticsTable diagnostics={diagnostics.data?.diagnostics ?? []} loading={diagnostics.isLoading} onSelect={(id) => setSelectedComponentId(id)} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function LatencyPacketLossCharts({ latency, packetLoss }: { latency: LatencyPoint[]; packetLoss: PacketLossPoint[] }) {
  const latencySeries = React.useMemo(() => {
    const points = latency
      .filter((p) => p.componentType === "EA Bridge" || p.componentType === "Broker Server" || p.componentType === "MT5 Feedback")
      .slice(-180);
    const grouped: Record<string, Array<{ t: string; v: number }>> = {};
    for (const p of points) {
      const key = p.componentType;
      grouped[key] ??= [];
      grouped[key].push({ t: p.measuredAt, v: p.latencyMs });
    }
    const times = Array.from(new Set(points.map((p) => p.measuredAt))).sort();
    return times.map((t) => ({
      t,
      eaBridge: grouped["EA Bridge"]?.find((x) => x.t === t)?.v ?? null,
      broker: grouped["Broker Server"]?.find((x) => x.t === t)?.v ?? null,
      feedback: grouped["MT5 Feedback"]?.find((x) => x.t === t)?.v ?? null
    }));
  }, [latency]);

  const packetLossSeries = React.useMemo(() => {
    const points = packetLoss.filter((p) => p.componentType === "EA Bridge" || p.componentType === "MT5 Feedback").slice(-120);
    const times = Array.from(new Set(points.map((p) => p.measuredAt))).sort();
    return times.map((t) => ({
      t,
      eaBridge: points.find((p) => p.componentType === "EA Bridge" && p.measuredAt === t)?.packetLossPercent ?? null,
      feedback: points.find((p) => p.componentType === "MT5 Feedback" && p.measuredAt === t)?.packetLossPercent ?? null
    }));
  }, [packetLoss]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase text-slate-500">Latency by component</p>
        <div className="mt-2 h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={latencySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="t" hide />
              <YAxis width={32} tick={{ fontSize: 10 }} />
              <RechartsTooltip formatter={(v: any) => `${v}ms`} labelFormatter={() => ""} />
              <Line type="monotone" dataKey="eaBridge" stroke="#2563eb" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="broker" stroke="#f97316" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="feedback" stroke="#ef4444" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-600" /> EA Bridge
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-orange-500" /> Broker
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" /> Feedback
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase text-slate-500">Packet loss trend</p>
        <div className="mt-2 h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={packetLossSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="t" hide />
              <YAxis width={32} tick={{ fontSize: 10 }} />
              <RechartsTooltip formatter={(v: any) => `${v}%`} labelFormatter={() => ""} />
              <Line type="monotone" dataKey="eaBridge" stroke="#7c3aed" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="feedback" stroke="#ef4444" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-violet-600" /> EA Bridge
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" /> Feedback
          </span>
        </div>
      </div>
    </div>
  );
}

function DependencyMapPanel({ data, loading }: { data: DependencyMapResponse | null; loading: boolean }) {
  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">Loading dependency map…</div>;
  }
  if (!data) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">No dependency map available.</div>;
  }

  const failed = data.firstFailedComponentId;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {data.nodes.map((n, idx) => {
          const isFailed = n.id === failed;
          const isDownstream = data.downstreamImpactedComponentIds.includes(n.id);
          const tone =
            n.tone === "Healthy"
              ? "border-green-200 bg-green-50 text-green-800"
              : n.tone === "Syncing"
                ? "border-blue-200 bg-blue-50 text-blue-800"
                : n.tone === "Degraded"
                  ? "border-orange-200 bg-orange-50 text-orange-800"
                  : n.tone === "Critical"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : n.tone === "Ai Warning"
                      ? "border-purple-200 bg-purple-50 text-purple-800"
                      : "border-slate-200 bg-slate-50 text-slate-700";

          return (
            <div key={n.id} className="flex items-center">
              <div className={cn("rounded-xl border px-3 py-2 text-xs font-semibold", tone, isFailed ? "ring-2 ring-red-300" : "", isDownstream ? "opacity-80" : "")}>
                <div className="text-[11px] uppercase">{n.componentType}</div>
                <div className="mt-0.5 max-w-[160px] truncate text-sm font-semibold">{n.label}</div>
                <div className="mt-1 text-[11px] uppercase">Score {n.healthScore}</div>
              </div>
              {idx < data.nodes.length - 1 ? <div className={cn("mx-2 h-[2px] w-10 rounded", failed && data.nodes[idx + 1]?.id === failed ? "bg-red-400" : "bg-slate-200")} /> : null}
            </div>
          );
        })}
      </div>

      <div className={cn("rounded-xl border p-3 text-sm font-semibold", failed ? "border-orange-200 bg-orange-50 text-orange-900" : "border-green-200 bg-green-50 text-green-900")}>
        {failed ? (
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4" />
            <div className="min-w-0">
              <div>First failed component: {failed}</div>
              <div className="mt-1 text-xs leading-5 text-orange-800">{data.tradingImpact}</div>
              <div className="mt-2 text-xs leading-5 text-orange-800">
                Recovery sequence: <span className="font-semibold text-orange-950">{data.recommendedRecoverySequence.join(" → ")}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <HeartPulse className="mt-0.5 h-4 w-4" />
            <div className="min-w-0">
              <div>Dependency chain is healthy.</div>
              <div className="mt-1 text-xs leading-5 text-green-800">{data.tradingImpact}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HeartbeatTable({ rows, loading, onSelect }: { rows: HeartbeatMonitorRow[]; loading: boolean; onSelect: (componentId: string) => void }) {
  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">Loading heartbeats…</div>;
  }
  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-[1200px] border-collapse">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            {["Component", "Type", "Expected", "Last heartbeat", "Delay", "Missed", "Availability", "State", "Recovery action", "Next check"].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.componentId} className="border-b border-slate-100">
              <td className="px-3 py-2 text-sm font-semibold text-slate-950">
                <button type="button" className="text-left hover:underline" onClick={() => onSelect(r.componentId)}>
                  {r.componentId}
                </button>
              </td>
              <td className="px-3 py-2 text-sm text-slate-700">{r.componentType}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{formatSeconds(r.expectedHeartbeatIntervalSeconds)}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{r.lastHeartbeat ? new Date(r.lastHeartbeat).toLocaleTimeString() : "—"}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{formatSeconds(r.heartbeatDelaySeconds)}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{r.missedHeartbeatCount}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{formatPercent(r.availabilityPercent, 2)}</td>
              <td className="px-3 py-2">
                <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
              </td>
              <td className="px-3 py-2 text-sm text-slate-700">{r.recoveryAction}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{new Date(r.nextCheckTime).toLocaleTimeString()}</td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={10} className="px-4 py-8 text-center text-sm font-semibold text-slate-600">
                No heartbeat rows available.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function KeyGrid({ rows }: { rows: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.label} className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">{r.label}</p>
          <div className="mt-1 text-sm font-semibold text-slate-950">{r.value}</div>
        </div>
      ))}
    </div>
  );
}

function ComponentIdentityPanel({ component }: { component: ConnectionComponent }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase text-slate-500">Component Identity</p>
        <div className="mt-2">
          <KeyGrid
            rows={[
              { label: "Component ID", value: component.componentId },
              { label: "Component type", value: component.componentType },
              { label: "Component name", value: component.componentName },
              { label: "Linked terminal", value: component.terminal ?? "—" },
              { label: "Linked broker", value: component.broker ?? "—" },
              { label: "Linked account", value: component.account ?? "—" },
              { label: "Linked EA bridge", value: component.eaInstance ?? "—" },
              { label: "Host machine", value: component.hostMachine },
              { label: "Server region", value: component.serverRegion },
              { label: "Environment", value: component.environment }
            ]}
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase text-slate-500">Runtime Health</p>
        <div className="mt-2">
          <KeyGrid
            rows={[
              { label: "Connection status", value: <Badge variant={statusVariant(component.connectionStatus)}>{component.connectionStatus}</Badge> },
              { label: "Heartbeat status", value: <Badge variant={statusVariant(component.heartbeatStatus)}>{component.heartbeatStatus}</Badge> },
              { label: "Last heartbeat", value: formatIso(component.lastHeartbeat) },
              { label: "Expected heartbeat interval", value: formatSeconds(component.expectedHeartbeatIntervalSeconds) },
              { label: "Latency", value: formatMs(component.latencyMs) },
              { label: "Packet loss", value: formatPercent(component.packetLossPercent) },
              { label: "Uptime", value: formatPercent(component.uptimePercent) },
              { label: "Error count", value: component.errorCount },
              { label: "Retry count", value: component.retryCount },
              { label: "Failure probability", value: `${formatNumber(Math.max(0, Math.min(100, 100 - component.healthScore)), 0)}%` },
              { label: "Health score", value: <Badge variant={scoreVariant(component.healthScore)}>{component.healthScore}/100</Badge> },
              { label: "Risk level", value: <Badge variant={statusVariant(component.riskLevel)}>{component.riskLevel}</Badge> }
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function ComponentDependenciesPanel({ component, map }: { component: ConnectionComponent; map: DependencyMapResponse | null }) {
  const isInMap = Boolean(map?.nodes.some((n) => n.id === component.componentId));
  return (
    <div className="space-y-4">
      {!isInMap ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">Component not present in the main dependency chain map.</div>
      ) : (
        <DependencyMapPanel data={map} loading={false} />
      )}
    </div>
  );
}

function ComponentReadinessPanel({ component, map }: { component: ConnectionComponent; map: DependencyMapResponse | null }) {
  const chainFailed = Boolean(map?.firstFailedComponentId);
  const pathActive = component.tradingPathActive && !chainFailed && component.connectionStatus !== "Offline" && component.connectionStatus !== "Critical";
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase text-slate-500">Trading Readiness</p>
        <div className="mt-2">
          <KeyGrid
            rows={[
              { label: "Trading path active", value: <Badge variant={pathActive ? "success" : "destructive"}>{pathActive ? "Active" : "Unsafe"}</Badge> },
              { label: "Data feed active", value: <Badge variant={component.componentType === "Market Data Feed" && component.connectionStatus !== "Healthy" ? "warning" : "success"}>{component.componentType === "Market Data Feed" ? component.connectionStatus : "Inherited"}</Badge> },
              { label: "Risk engine reachable", value: <Badge variant={chainFailed ? "warning" : "success"}>{chainFailed ? "Degraded chain" : "Reachable"}</Badge> },
              { label: "Execution channel active", value: <Badge variant={component.componentType === "MT5 Feedback" && component.connectionStatus !== "Healthy" ? "warning" : "success"}>{component.componentType === "MT5 Feedback" ? component.connectionStatus : "Inherited"}</Badge> },
              { label: "Emergency stop status", value: <Badge variant={chainFailed ? "warning" : "success"}>{chainFailed ? "Review" : "Inactive"}</Badge> }
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function ComponentIncidentsPanel({ componentId, incidents }: { componentId: string; incidents: ConnectionIncident[] }) {
  const rows = incidents.filter((i) => i.componentId === componentId);
  return <IncidentsTable incidents={rows} loading={false} onSelect={() => {}} />;
}

function ComponentAuditPanel({ componentId, logs }: { componentId: string; logs: ConnectionLogEntry[] }) {
  const rows = logs.filter((l) => l.componentId === componentId || l.componentId === "ALL");
  return <LogsPanel logs={rows} />;
}

function IncidentsTable({ incidents, loading, onSelect }: { incidents: ConnectionIncident[]; loading: boolean; onSelect: (componentId: string) => void }) {
  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">Loading incidents…</div>;
  }
  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-[1100px] border-collapse">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            {["Timestamp", "Component", "Type", "Broker", "Account", "Incident type", "Severity", "Error", "Root cause", "Action", "Status"].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {incidents.map((i) => (
            <tr key={i.id} className="border-b border-slate-100">
              <td className="px-3 py-2 text-sm text-slate-700">{new Date(i.timestamp).toLocaleTimeString()}</td>
              <td className="px-3 py-2 text-sm font-semibold text-slate-950">
                <button type="button" className="text-left hover:underline" onClick={() => onSelect(i.componentId)}>
                  {i.componentId}
                </button>
              </td>
              <td className="px-3 py-2 text-sm text-slate-700">{i.componentType}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{i.broker ?? "—"}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{i.account ?? "—"}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{i.incidentType}</td>
              <td className="px-3 py-2">
                <Badge variant={i.severity === "Critical" ? "destructive" : i.severity === "Warning" ? "warning" : "secondary"}>{i.severity}</Badge>
              </td>
              <td className="px-3 py-2 text-sm text-slate-700">
                {i.errorCode}: {i.errorMessage}
              </td>
              <td className="px-3 py-2 text-sm text-slate-700">{i.rootCause}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{i.actionTaken}</td>
              <td className="px-3 py-2">
                <Badge variant={i.resolutionStatus === "Resolved" ? "success" : "warning"}>{i.resolutionStatus}</Badge>
              </td>
            </tr>
          ))}
          {!incidents.length ? (
            <tr>
              <td colSpan={11} className="px-4 py-8 text-center text-sm font-semibold text-slate-600">
                No incidents available.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function LogsPanel({ logs }: { logs: ConnectionLogEntry[] }) {
  return (
    <div className="space-y-3">
      {logs.map((l) => (
        <div key={l.id} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">{l.eventType}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">
                {new Date(l.timestamp).toLocaleString()} · Component: {l.componentId}
              </p>
            </div>
            <Badge variant={l.severity === "Critical" ? "destructive" : l.severity === "Warning" ? "warning" : "secondary"}>{l.severity}</Badge>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-700">
            <span className="font-semibold text-slate-500">Message:</span> <span className="font-semibold text-slate-900">{l.message}</span>
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            <span className="font-semibold text-slate-500">Root cause:</span> {l.rootCause} · <span className="font-semibold text-slate-500">Action:</span> {l.actionTaken}
          </p>
          <div className="mt-2 grid gap-2 text-xs text-slate-700 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className="font-semibold text-slate-500">Latency</p>
              <p className="font-semibold text-slate-900">{formatMs(l.latencyMs)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className="font-semibold text-slate-500">Packet loss</p>
              <p className="font-semibold text-slate-900">{formatPercent(l.packetLossPercent)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className="font-semibold text-slate-500">Heartbeat delay</p>
              <p className="font-semibold text-slate-900">{formatSeconds(l.heartbeatDelaySeconds)}</p>
            </div>
          </div>
        </div>
      ))}
      {!logs.length ? <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">No logs available.</div> : null}
    </div>
  );
}

function DiagnosticsTable({ diagnostics, loading, onSelect }: { diagnostics: AiConnectionDiagnostic[]; loading: boolean; onSelect: (componentId: string) => void }) {
  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">Loading AI diagnostics…</div>;
  }
  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-[1050px] border-collapse">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            {["Issue", "Affected component", "Dependency impact", "Severity", "Trading impact", "Recommended action", "Auto-fix", "Confidence", "Actions"].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {diagnostics.map((d) => (
            <tr key={d.id} className="border-b border-slate-100">
              <td className="px-3 py-2 text-sm font-semibold text-slate-950">
                <div className="flex items-center gap-2">
                  {d.severity === "Critical" ? (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  ) : d.severity === "Warning" ? (
                    <TriangleAlert className="h-4 w-4 text-orange-600" />
                  ) : (
                    <Activity className="h-4 w-4 text-slate-600" />
                  )}
                  <span>{d.issue}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-sm text-slate-700">{d.affectedComponentId}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{d.dependencyImpact}</td>
              <td className="px-3 py-2">
                <Badge variant={d.severity === "Critical" ? "destructive" : d.severity === "Warning" ? "warning" : "secondary"}>{d.severity}</Badge>
              </td>
              <td className="px-3 py-2 text-sm text-slate-700">{d.tradingImpact}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{d.recommendedAction}</td>
              <td className="px-3 py-2">
                <Badge variant={d.autoFixEligible ? "success" : "secondary"}>{d.autoFixEligible ? "Eligible" : "Manual"}</Badge>
              </td>
              <td className="px-3 py-2 text-sm font-semibold text-slate-950">{d.confidenceScore}%</td>
              <td className="px-3 py-2">
                <Button variant="outline" size="sm" onClick={() => onSelect(d.affectedComponentId)}>
                  Inspect
                </Button>
              </td>
            </tr>
          ))}
          {!diagnostics.length ? (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-sm font-semibold text-slate-600">
                No AI diagnostics issues detected.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

