"use client";

import {
  Activity, AlertTriangle, Bot, ChevronDown, ChevronRight, Clock3, Download, Gauge, HardDrive, HeartPulse, Menu,
  PowerOff, RefreshCw, RotateCcw, Search, Server, ShieldCheck, SlidersHorizontal, Stethoscope, Workflow
} from "lucide-react";
import { Fragment, useState } from "react";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { classifyResourcePressure, detectTerminalFreeze } from "../algorithms/terminal-status.algorithms";
import { useTerminalStatus } from "../hooks/use-terminal-status";
import type { TerminalErrorLog, TerminalStatusRecord, TerminalTone } from "../types/terminal-status.types";

const variant: Record<TerminalTone, "success" | "warning" | "destructive" | "default" | "secondary"> = {
  Healthy: "success", Watch: "warning", Degraded: "warning", Critical: "destructive", Offline: "destructive", Syncing: "default", Inactive: "secondary"
};
const border: Record<TerminalTone, string> = {
  Healthy: "border-t-emerald-500", Watch: "border-t-amber-500", Degraded: "border-t-amber-500", Critical: "border-t-red-500", Offline: "border-t-red-500", Syncing: "border-t-blue-500", Inactive: "border-t-slate-400"
};

function Status({ value }: { value: TerminalTone }) { return <Badge variant={variant[value]}>{value}</Badge>; }
function time(value: string) { return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function duration(seconds: number) { return seconds > 86_400 ? `${Math.floor(seconds / 86_400)}d ${Math.floor(seconds % 86_400 / 3600)}h` : `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`; }

function Title({ icon: Icon, title, description }: { icon: typeof Activity; title: string; description: string }) {
  return <CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-lg"><Icon className="h-5 w-5 text-blue-600" />{title}</CardTitle><p className="mt-1 text-xs text-slate-500">{description}</p></CardHeader>;
}

function BarMetric({ label, value, max = 100, suffix = "%", tone = "bg-blue-600" }: { label: string; value: number; max?: number; suffix?: string; tone?: string }) {
  return <div><div className="mb-1 flex justify-between text-xs text-slate-600"><span>{label}</span><strong>{value}{suffix}</strong></div><div className="h-2 rounded-full bg-slate-100"><div className={cn("h-2 rounded-full", tone)} style={{ width: `${Math.min(100, value / max * 100)}%` }} /></div></div>;
}

function DetailItem({ label, value, state }: { label: string; value: string; state?: boolean }) {
  return <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className={cn("mt-1 truncate text-xs font-medium text-slate-900", state === true && "text-emerald-700", state === false && "text-red-700")}>{value}</p></div>;
}

export function TerminalStatusDashboard() {
  const query = useTerminalStatus();
  const [selectedId, setSelectedId] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [errorFilter, setErrorFilter] = useState("All");
  const [sort, setSort] = useState("risk");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);

  if (query.isError) return <div className="mx-auto max-w-[1900px] px-4 py-6"><Card className="border-red-200 p-6"><h1 className="text-xl font-semibold">Terminal Status unavailable</h1><p className="mt-2 text-sm text-slate-600">Terminal telemetry cannot be loaded. No operational command has been issued.</p><Button className="mt-4" onClick={() => query.refetch()}>Retry</Button></Card></div>;
  if (query.isLoading || !query.data) return <div className="mx-auto max-w-[1900px] px-4 py-6 text-sm text-slate-600">Loading live terminal telemetry...</div>;

  const data = query.data;
  const selected = data.terminals.find((terminal) => terminal.terminalId === selectedId) ?? data.terminals[0] ?? null;
  const filtered = data.terminals
    .filter((terminal) => `${terminal.terminalName} ${terminal.terminalId} ${terminal.brokerName} ${terminal.serverName} ${terminal.accountLogin} ${terminal.hostMachine}`.toLowerCase().includes(search.toLowerCase()))
    .filter((terminal) => statusFilter === "All" || terminal.riskLevel === statusFilter || terminal.heartbeatStatus === statusFilter)
    .sort((a, b) => sort === "cpu" ? b.cpuUsagePercent - a.cpuUsagePercent : sort === "delay" ? b.heartbeatDelaySeconds - a.heartbeatDelaySeconds : a.healthScore - b.healthScore);
  const pageSize = 3;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const shown = filtered.slice((Math.min(page, pages) - 1) * pageSize, Math.min(page, pages) * pageSize);
  const visibleErrors = data.errors.filter((error) => errorFilter === "All" || error.severity === errorFilter || error.sourceModule === errorFilter || (errorFilter === "Resolved" && error.resolved) || (errorFilter === "Unresolved" && !error.resolved));
  const selectedHeartbeats = selected ? data.heartbeatLogs.filter((log) => log.terminalId === selected.terminalId) : [];
  const selectedEvents = selected ? data.events.filter((event) => event.terminalId === selected.terminalId).slice(0, 10) : [];
  const selectedDiagnostic = selected ? data.diagnostics.find((diagnostic) => diagnostic.terminalId === selected.terminalId) : undefined;
  const freeze = selected ? detectTerminalFreeze(selected) : { state: "No terminal selected" };
  const pressure = selected ? classifyResourcePressure(selected) : { level: "None" };

  async function command(label: string, path: string, body?: Record<string, unknown>) {
    if (!path) {
      setNotice("No terminal is selected for this action yet.");
      return;
    }
    if (!window.confirm(`Confirm ${label.toLowerCase()} for terminal operations? This action will be audit-logged.`)) return;
    setNotice(null);
    try {
      await query.action.mutateAsync({ path, body: { confirmed: true, ...body } });
      setNotice(`${label} completed. An audit record has been written.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Terminal action failed.");
    }
  }

  function exportReport() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "terminal-status-report.json";
    anchor.click();
    URL.revokeObjectURL(href);
  }

  const headerActions = [
    { label: "Sync Terminal Status", path: "/api/mt5/terminal-status/sync", allowed: data.permissions.canSync, icon: RefreshCw },
    { label: "Run Health Check", path: selected ? `/api/mt5/terminal-status/${selected.terminalId}/health-check` : "", allowed: data.permissions.canRunHealthCheck && Boolean(selected), icon: Stethoscope },
    { label: "Restart Selected", path: selected ? `/api/mt5/terminal-status/${selected.terminalId}/restart` : "", allowed: data.permissions.canRestart && Boolean(selected), icon: RotateCcw }
  ];

  return (
    <TooltipProvider>
      <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <section className="sticky top-14 z-20 rounded-2xl border border-slate-200 bg-white/95 shadow-card backdrop-blur">
          <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-blue-600 via-emerald-500 to-purple-600" />
          <div className="flex flex-col gap-5 p-5 xl:flex-row xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">MT5 Infrastructure &amp; Broker Connectivity / Terminal Status</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Terminal Status</h1>
                <Badge variant={query.streamConnected ? "success" : "warning"}><Activity className="mr-1 h-3 w-3" />{query.streamConnected ? "Live stream" : "Reconnecting"}</Badge>
                <Badge variant="purple">Autonomous monitoring</Badge>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">Real-time health, heartbeat, uptime, resource usage, and operational readiness of all MT5 terminals.</p>
              <p className="mt-3 text-xs text-slate-500">Role: {data.permissions.role} | Last update: {time(data.meta.timestamp)} | Selected: {selected?.terminalName ?? "None"}</p>
            </div>
            <div className="hidden flex-wrap items-start justify-end gap-2 sm:flex">
              <Button variant="outline" onClick={() => query.refetch()}><RefreshCw className="h-4 w-4" />Refresh Terminals</Button>
              {headerActions.map(({ label, path, allowed, icon: Icon }) => <Button key={label} variant="outline" disabled={!allowed || query.action.isPending} onClick={() => command(label, path)}><Icon className="h-4 w-4" />{label}</Button>)}
              <Button variant="outline" onClick={exportReport}><Download className="h-4 w-4" />Export Status Report</Button>
              <Button variant="destructive" disabled={!data.permissions.canEmergencyDisable || !selected} onClick={() => command("Emergency disable terminal trading", selected ? `/api/mt5/terminal-status/${selected.terminalId}/disable-trading` : "")}><PowerOff className="h-4 w-4" />Emergency Disable Terminal Trading</Button>
            </div>
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline"><Menu className="h-4 w-4" />Actions</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => query.refetch()}>Refresh Terminals</DropdownMenuItem>
                  {headerActions.map((item) => <DropdownMenuItem key={item.label} disabled={!item.allowed} onSelect={() => command(item.label, item.path)}>{item.label}</DropdownMenuItem>)}
                  <DropdownMenuItem onSelect={exportReport}>Export Status Report</DropdownMenuItem>
                  <DropdownMenuItem disabled={!data.permissions.canEmergencyDisable || !selected} className="text-red-700" onSelect={() => command("Emergency disable terminal trading", selected ? `/api/mt5/terminal-status/${selected.terminalId}/disable-trading` : "")}>Emergency Disable Trading</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {notice ? <p className="border-t border-slate-100 px-5 py-2.5 text-xs font-semibold text-blue-700">{notice}</p> : null}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {data.kpis.map((kpi) => (
            <Card key={kpi.label} className={cn("overflow-hidden border-t-4", border[kpi.status])}>
              <CardContent className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
                  <Tooltip><TooltipTrigger asChild><button aria-label={`${kpi.label} help`} className="text-xs text-slate-400">?</button></TooltipTrigger><TooltipContent>{kpi.detail}</TooltipContent></Tooltip>
                </div>
                <p className="mt-2 text-xl font-semibold text-slate-950">{kpi.value}</p>
                <div className="mt-2 flex justify-between text-[11px]"><span className="font-medium text-slate-500">{kpi.trend}</span><span className="text-slate-400">{time(kpi.updatedAt)}</span></div>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card>
          <Title icon={Workflow} title="Terminal Status Workflow" description="Lifecycle readiness from registration to execution-ready terminals." />
          <CardContent className="overflow-x-auto">
            <div className="flex min-w-[1480px] gap-2">
              {data.workflow.map((node) => (
                <div key={node.title} className="min-h-36 flex-1 rounded-xl border border-slate-200 p-3">
                  <Status value={node.status} />
                  <p className="mt-3 text-sm font-semibold">{node.title}</p>
                  <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-slate-500"><span>Ready {node.count}</span><span>Failed {node.failedCount}</span><span>Delay {node.averageDelaySeconds}s</span><span>{time(node.lastCheckedAt)}</span></div>
                  {node.aiRecommendation ? <p className="mt-2 text-xs text-purple-700">AI: {node.aiRecommendation}</p> : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <Title icon={Server} title="Terminal Inventory & Operations" description="Filter, sort, inspect, and control every monitored terminal instance." />
          <CardContent>
            <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm lg:w-80"><Search className="h-4 w-4 text-slate-400" /><input aria-label="Search terminals" className="w-full outline-none" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search terminals, broker, host..." /></label>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs text-slate-600"><SlidersHorizontal className="h-3.5 w-3.5" />Status<select aria-label="Filter terminal status" className="h-9 bg-white outline-none" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>{["All", "Healthy", "Watch", "Degraded", "Critical", "Offline"].map((option) => <option key={option}>{option}</option>)}</select></label>
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs text-slate-600">Sort<select aria-label="Sort terminals" className="h-9 bg-white outline-none" value={sort} onChange={(event) => setSort(event.target.value)}><option value="risk">Risk score</option><option value="delay">Heartbeat delay</option><option value="cpu">CPU usage</option></select></label>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table aria-label="Terminal status inventory" className="w-full min-w-[2250px] text-left text-xs">
                <thead className="border-y border-slate-100 bg-slate-50 text-slate-500"><tr>{["", "Terminal ID / Name", "Broker / Server", "Account", "Host / IP / OS", "Version / Build", "Risk", "Process", "Connection", "Heartbeat", "Last Heartbeat", "Delay", "CPU", "Memory", "Disk", "Uptime", "Trading", "Market Data", "Positions", "Orders", "Last Error", "Actions"].map((head) => <th className="px-3 py-3 font-semibold uppercase" key={head}>{head}</th>)}</tr></thead>
                <tbody>
                  {shown.length ? shown.map((terminal) => (
                    <Fragment key={terminal.terminalId}>
                      <tr className={cn("border-b border-slate-100", selected?.terminalId === terminal.terminalId && "bg-blue-50/40")} onClick={() => setSelectedId(terminal.terminalId)}>
                        <td className="px-3 py-3"><button aria-label={`Expand ${terminal.terminalName}`} onClick={(event) => { event.stopPropagation(); setExpandedId(expandedId === terminal.terminalId ? null : terminal.terminalId); }}>{expandedId === terminal.terminalId ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></td>
                        <td className="px-3 py-3 font-semibold">{terminal.terminalName}<p className="font-normal text-slate-500">{terminal.terminalId}</p></td>
                        <td className="px-3 py-3">{terminal.brokerName}<p className="text-slate-500">{terminal.serverName}</p></td>
                        <td className="px-3 py-3">{terminal.accountLogin}<p className="text-slate-500">{terminal.accountType}</p></td>
                        <td className="px-3 py-3">{terminal.hostMachine}<p className="text-slate-500">{terminal.ipAddress} | {terminal.operatingSystem}</p></td>
                        <td className="px-3 py-3">{terminal.terminalVersion}<p className={terminal.buildNumber < 4700 ? "text-amber-700" : "text-slate-500"}>Build {terminal.buildNumber}</p></td>
                        <td className="px-3 py-3"><Status value={terminal.riskLevel} /><p className="mt-1">{terminal.healthScore}/100</p></td>
                        <td className="px-3 py-3">{terminal.processStatus}</td><td className="px-3 py-3"><Status value={terminal.connectionStatus} /></td><td className="px-3 py-3"><Status value={terminal.heartbeatStatus} /></td>
                        <td className="px-3 py-3">{time(terminal.lastHeartbeatAt)}</td><td className="px-3 py-3 font-semibold">{terminal.heartbeatDelaySeconds}s</td>
                        <td className="px-3 py-3">{terminal.cpuUsagePercent}%</td><td className="px-3 py-3">{terminal.memoryUsagePercent}%</td><td className="px-3 py-3">{terminal.diskUsagePercent}%</td><td className="px-3 py-3">{duration(terminal.uptimeSeconds)}</td>
                        <td className="px-3 py-3"><Badge variant={terminal.tradingEnabled ? "success" : "destructive"}>{terminal.tradingEnabled ? "Enabled" : "Disabled"}</Badge></td>
                        <td className="px-3 py-3">{terminal.marketDataActive ? "Active" : "Down"}</td><td className="px-3 py-3">{terminal.openPositionsCount}</td><td className="px-3 py-3">{terminal.pendingOrdersCount}</td>
                        <td className="max-w-56 truncate px-3 py-3 text-red-700">{terminal.lastErrorMessage ?? "None"}</td>
                        <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                          <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline">Actions</Button></DropdownMenuTrigger><DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setSelectedId(terminal.terminalId)}>View Details</DropdownMenuItem>
                            <DropdownMenuItem disabled={!data.permissions.canRestart} onSelect={() => command("Restart terminal", `/api/mt5/terminal-status/${terminal.terminalId}/restart`)}>Restart Terminal</DropdownMenuItem>
                            <DropdownMenuItem disabled={!data.permissions.canRunHealthCheck} onSelect={() => command("Run diagnostics", `/api/mt5/terminal-status/${terminal.terminalId}/health-check`)}>Run Diagnostics</DropdownMenuItem>
                            <DropdownMenuItem disabled={!data.permissions.canSync} onSelect={() => command("Sync account", `/api/mt5/terminal-status/${terminal.terminalId}/sync-account`)}>Sync Account</DropdownMenuItem>
                            <DropdownMenuItem disabled={!data.permissions.canSync} onSelect={() => command("Sync symbols", `/api/mt5/terminal-status/${terminal.terminalId}/sync-symbols`)}>Sync Symbols</DropdownMenuItem>
                            <DropdownMenuItem disabled={!data.permissions.canTradeControl || !terminal.tradingEnabled} onSelect={() => command("Disable trading", `/api/mt5/terminal-status/${terminal.terminalId}/disable-trading`)}>Disable Trading</DropdownMenuItem>
                            <DropdownMenuItem disabled={!data.permissions.canTradeControl || terminal.tradingEnabled} onSelect={() => command("Enable trading", `/api/mt5/terminal-status/${terminal.terminalId}/enable-trading`)}>Enable Trading</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setExpandedId(terminal.terminalId)}>View Logs</DropdownMenuItem>
                            <DropdownMenuItem disabled={!data.permissions.canMaintenance} onSelect={() => command("Mark for maintenance", `/api/mt5/terminal-status/${terminal.terminalId}/maintenance`, { enabled: true })}>Mark for Maintenance</DropdownMenuItem>
                          </DropdownMenuContent></DropdownMenu>
                        </td>
                      </tr>
                      {expandedId === terminal.terminalId ? (
                        <tr key={`${terminal.terminalId}-detail`} className="border-b border-blue-100 bg-blue-50/30"><td colSpan={22} className="p-4">
                          <div className="grid gap-4 xl:grid-cols-4">
                            <div><p className="text-xs font-semibold uppercase text-slate-500">Heartbeat Timeline</p><div className="mt-2 flex gap-1">{data.heartbeatLogs.filter((item) => item.terminalId === terminal.terminalId).map((item) => <div title={`${item.delaySeconds}s`} key={item.id} className={cn("h-10 flex-1 rounded", item.delaySeconds <= 30 ? "bg-emerald-500" : item.delaySeconds <= 60 ? "bg-amber-400" : "bg-red-500")} />)}</div></div>
                            <div><p className="text-xs font-semibold uppercase text-slate-500">Last Events</p><p className="mt-2 text-xs text-slate-700">{data.events.find((item) => item.terminalId === terminal.terminalId)?.message ?? "No incidents recorded."}</p></div>
                            <div><p className="text-xs font-semibold uppercase text-slate-500">Resource Usage</p><div className="mt-2 space-y-2"><BarMetric label="CPU" value={terminal.cpuUsagePercent} /><BarMetric label="Memory" value={terminal.memoryUsagePercent} tone="bg-purple-600" /></div></div>
                            <div><p className="text-xs font-semibold uppercase text-purple-700">AI Diagnosis</p><p className="mt-2 text-xs text-slate-700">{data.diagnostics.find((item) => item.terminalId === terminal.terminalId)?.recommendation ?? "No recovery action recommended."}</p><p className="mt-2 text-xs text-red-700">{terminal.lastErrorMessage}</p></div>
                          </div>
                        </td></tr>
                      ) : null}
                    </Fragment>
                  )) : <tr><td colSpan={22} className="px-3 py-8 text-center text-sm text-slate-500">No MT5 terminals registered yet. Complete onboarding in MT5 Control Center to begin monitoring.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-600"><p>Showing {shown.length} of {filtered.length} terminals</p><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {Math.min(page, pages)} of {pages}</span><Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button></div></div>
          </CardContent>
        </Card>

        {selected ? (
        <section className="grid gap-4 xl:grid-cols-3">
          <Card><Title icon={Server} title="Terminal Identity" description={selected.terminalName} /><CardContent className="grid grid-cols-2 gap-2"><DetailItem label="UUID" value={selected.terminalUuid} /><DetailItem label="Broker" value={selected.brokerName} /><DetailItem label="Server" value={selected.serverName} /><DetailItem label="Account" value={`${selected.accountLogin} / ${selected.accountCurrency}`} /><DetailItem label="Path" value={selected.terminalPath} /><DetailItem label="Host" value={selected.hostMachine} /><DetailItem label="Region" value={selected.region} /><DetailItem label="Timezone" value={selected.timezone} /></CardContent></Card>
          <Card><Title icon={HeartPulse} title="Runtime & Resource Health" description={`${freeze.state} | ${pressure.level} pressure`} /><CardContent className="grid grid-cols-2 gap-2"><DetailItem label="Process" value={`${selected.processStatus} / PID ${selected.processId ?? "-"}`} state={selected.processStatus === "Running"} /><DetailItem label="Uptime" value={duration(selected.uptimeSeconds)} /><DetailItem label="Last Heartbeat" value={time(selected.lastHeartbeatAt)} /><DetailItem label="Delay" value={`${selected.heartbeatDelaySeconds}s`} state={selected.heartbeatDelaySeconds <= 30} /><DetailItem label="CPU / Memory" value={`${selected.cpuUsagePercent}% / ${selected.memoryUsagePercent}%`} /><DetailItem label="Disk / Latency" value={`${selected.diskUsagePercent}% / ${selected.networkLatencyMs}ms`} /><DetailItem label="Packet Loss" value={`${selected.packetLossPercent}%`} state={selected.packetLossPercent < 1} /><DetailItem label="Logs / Data" value={`${selected.logFileSizeMb}MB / ${selected.dataFolderSizeMb}MB`} /></CardContent></Card>
          <Card><Title icon={ShieldCheck} title="Trading Readiness" description={`Health score ${selected.healthScore}/100`} /><CardContent className="grid grid-cols-2 gap-2"><DetailItem label="Trading Enabled" value={selected.tradingEnabled ? "Enabled" : "Blocked"} state={selected.tradingEnabled} /><DetailItem label="Expert Advisors" value={selected.expertAdvisorsEnabled ? "Enabled" : "Disabled"} state={selected.expertAdvisorsEnabled} /><DetailItem label="DLL Imports" value={selected.dllImportsEnabled ? "Allowed" : "Blocked"} state={selected.dllImportsEnabled} /><DetailItem label="Account Trading" value={selected.accountTradeAllowed ? "Allowed" : "Blocked"} state={selected.accountTradeAllowed} /><DetailItem label="Market Data" value={selected.marketDataActive ? "Active" : "Inactive"} state={selected.marketDataActive} /><DetailItem label="Symbol Mappings" value={selected.symbolMappingsValid ? "Valid" : "Invalid"} state={selected.symbolMappingsValid} /><DetailItem label="Order Gateway" value={selected.orderGatewayConnected ? "Connected" : "Disconnected"} state={selected.orderGatewayConnected} /><DetailItem label="Risk Engine" value={selected.riskEngineConnected ? "Connected" : "Disconnected"} state={selected.riskEngineConnected} /></CardContent></Card>
        </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <Card>
            <Title icon={Gauge} title="Terminal Resource Monitor" description="CPU, memory, latency, and heartbeat pressure by terminal." />
            <CardContent className="grid gap-5 md:grid-cols-2">
              <div className="h-56"><p className="mb-2 text-xs font-semibold text-slate-500">CPU and Memory Usage</p><ResponsiveContainer width="100%" height="100%"><BarChart data={data.terminals}><XAxis dataKey="terminalName" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><ChartTooltip /><Bar dataKey="cpuUsagePercent" fill="#2563eb" name="CPU %" /><Bar dataKey="memoryUsagePercent" fill="#7c3aed" name="Memory %" /></BarChart></ResponsiveContainer></div>
              <div className="h-56"><p className="mb-2 text-xs font-semibold text-slate-500">Heartbeat Delay Trend - Selected</p><ResponsiveContainer width="100%" height="100%"><LineChart data={[...selectedHeartbeats].reverse()}><XAxis dataKey="heartbeatReceivedAt" tickFormatter={time} tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><ChartTooltip /><Line type="monotone" dataKey="delaySeconds" stroke="#dc2626" strokeWidth={2} name="Delay seconds" /></LineChart></ResponsiveContainer></div>
              <div className="md:col-span-2 grid gap-3 sm:grid-cols-4"><BarMetric label="Average CPU" value={data.resourceSummary.averageCpu} /><BarMetric label="Average Memory" value={data.resourceSummary.averageMemory} tone="bg-purple-600" /><BarMetric label="Average Disk" value={data.resourceSummary.averageDisk} tone="bg-amber-500" /><BarMetric label="Pressure Score" value={data.resourceSummary.pressureScore} tone="bg-red-600" /></div>
            </CardContent>
          </Card>
          <Card>
            <Title icon={Clock3} title="Heartbeat Monitor" description="Heartbeat threshold enforcement and freeze risk response." />
            <CardContent className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-left text-xs"><thead className="border-y border-slate-100 bg-slate-50"><tr>{["Terminal", "Expected", "Last Beat", "Delay", "Missed", "Status", "Freeze Risk", "Recovery"].map((label) => <th key={label} className="px-2 py-3 uppercase text-slate-500">{label}</th>)}</tr></thead><tbody>{data.terminals.map((terminal) => { const state = detectTerminalFreeze(terminal); return <tr key={terminal.terminalId} className="border-b border-slate-100"><td className="px-2 py-3 font-semibold">{terminal.terminalName}</td><td className="px-2 py-3">{terminal.expectedHeartbeatIntervalSeconds}s</td><td className="px-2 py-3">{time(terminal.lastHeartbeatAt)}</td><td className="px-2 py-3">{terminal.heartbeatDelaySeconds}s</td><td className="px-2 py-3">{terminal.missedHeartbeatCount}</td><td className="px-2 py-3"><Status value={terminal.heartbeatStatus} /></td><td className="px-2 py-3">{state.state}</td><td className="px-2 py-3 text-purple-700">{terminal.restartRequired ? "Safe restart review" : "Monitor"}</td></tr>; })}</tbody></table>
              <p className="mt-3 text-[11px] text-slate-500">Rules: 0-30s Healthy | 31-60s Watch | 61-120s Degraded | 121-300s Critical | Above 300s Offline</p>
            </CardContent>
          </Card>
        </section>

        <Card>
          <Title icon={AlertTriangle} title="Terminal Logs & Errors" description="Operational faults, AI explanations, and resolution status." />
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-2">{["All", "Critical", "Warning", "Authentication", "Broker", "Market Data", "Trade", "Resource", "Resolved", "Unresolved"].map((filter) => <button key={filter} className={cn("rounded-full border px-3 py-1 text-xs font-medium", errorFilter === filter ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600")} onClick={() => setErrorFilter(filter)}>{filter}</button>)}</div>
            <div className="overflow-x-auto"><table className="w-full min-w-[1350px] text-left text-xs"><thead className="border-y border-slate-100 bg-slate-50"><tr>{["Timestamp", "Terminal", "Broker / Account", "Code", "Error Message", "Severity", "Module", "Repeat", "Status", "AI Explanation", "Suggested Fix"].map((label) => <th key={label} className="px-3 py-3 uppercase text-slate-500">{label}</th>)}</tr></thead><tbody>{visibleErrors.map((error: TerminalErrorLog) => <tr className="border-b border-slate-100" key={error.id}><td className="px-3 py-3">{time(error.lastSeenAt)}</td><td className="px-3 py-3 font-semibold">{error.terminalName}</td><td className="px-3 py-3">{error.brokerName}<p className="text-slate-500">{error.accountLogin}</p></td><td className="px-3 py-3">{error.errorCode}</td><td className="px-3 py-3">{error.errorMessage}</td><td className="px-3 py-3"><Badge variant={error.severity === "Critical" ? "destructive" : error.severity === "Warning" ? "warning" : "secondary"}>{error.severity}</Badge></td><td className="px-3 py-3">{error.sourceModule}</td><td className="px-3 py-3">{error.repeatCount}</td><td className="px-3 py-3">{error.resolved ? "Resolved" : "Open"}</td><td className="px-3 py-3 text-purple-700">{error.aiExplanation}</td><td className="px-3 py-3">{error.suggestedFix}</td></tr>)}</tbody></table></div>
          </CardContent>
        </Card>

        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <Title icon={Bot} title="AI Terminal Diagnostics" description="Failure prediction and safely governed recovery recommendations." />
            <CardContent className="space-y-3">
              {data.diagnostics.map((diagnostic) => <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-4" key={diagnostic.id}>
                <div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{diagnostic.terminalName}</p><p className="mt-1 text-sm text-slate-700">{diagnostic.anomalyDetected}</p></div><Badge variant={diagnostic.severity === "Critical" ? "destructive" : "warning"}>{diagnostic.failureProbability}% failure probability</Badge></div>
                <div className="mt-3 grid gap-2 text-xs md:grid-cols-2"><p><strong>Root cause:</strong> {diagnostic.rootCause}</p><p><strong>Business impact:</strong> {diagnostic.businessImpact}</p></div>
                <p className="mt-3 text-xs font-medium text-purple-800"><strong>Recommendation:</strong> {diagnostic.recommendation}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2"><Badge variant="purple">Confidence {Math.round(diagnostic.confidenceScore * 100)}%</Badge><Badge variant="default">Recovery {Math.round(diagnostic.estimatedRecoveryConfidence * 100)}%</Badge><Badge variant={diagnostic.autoFixEligible ? "success" : "secondary"}>{diagnostic.autoFixStatus}</Badge>{diagnostic.escalationRequired ? <Badge variant="destructive">Escalation required</Badge> : null}<Button size="sm" disabled={!data.permissions.canAutoRemediate || !diagnostic.autoFixEligible} onClick={() => command("AI auto-remediation", "/api/mt5/terminal-status/auto-remediate", { diagnosticId: diagnostic.id })}>Trigger Safe Recovery</Button></div>
              </div>)}
            </CardContent>
          </Card>
          <Card>
            <Title icon={ShieldCheck} title="Incident & Restart Timeline" description="Terminal actions, triggers, and recovery results." />
            <CardContent className="space-y-2">
              {data.events.map((event) => <div key={event.id} className="flex gap-3 border-l-2 border-slate-100 py-2 pl-4"><span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", event.severity === "Critical" ? "bg-red-600" : event.severity === "Warning" ? "bg-amber-500" : "bg-emerald-600")} /><div><div className="flex flex-wrap gap-2"><p className="text-sm font-semibold">{event.eventType}</p><Badge variant={event.severity === "Critical" ? "destructive" : event.severity === "Warning" ? "warning" : "success"}>{event.severity}</Badge></div><p className="mt-1 text-xs text-slate-700">{event.terminalName} | {event.message}</p><p className="mt-1 text-[11px] text-slate-500">{time(event.createdAt)} | Trigger: {event.triggeredBy} | Action: {event.actionTaken} | Result: {event.result}</p></div></div>)}
            </CardContent>
          </Card>
        </section>
      </div>
    </TooltipProvider>
  );
}
