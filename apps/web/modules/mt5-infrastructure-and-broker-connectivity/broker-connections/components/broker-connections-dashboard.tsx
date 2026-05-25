"use client";

import {
  Activity, AlertTriangle, Bot, ChevronRight, Download, Gauge, Menu, PowerOff, RefreshCw, RotateCcw,
  Search, Server, ShieldCheck, Stethoscope, Workflow
} from "lucide-react";
import { Fragment, useState } from "react";
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { detectExecutionDegradation, detectSpreadSpikes } from "../algorithms/broker-connections.algorithms";
import { useBrokerConnections } from "../hooks/use-broker-connections";
import type { BrokerSeverity, BrokerTone } from "../types/broker-connections.types";

const variants: Record<BrokerTone, "success" | "warning" | "destructive" | "default" | "secondary"> = {
  Healthy: "success", Watch: "warning", Degraded: "warning", Critical: "destructive", Offline: "destructive", Syncing: "default", Inactive: "secondary"
};
const borders: Record<BrokerTone, string> = {
  Healthy: "border-t-emerald-500", Watch: "border-t-amber-500", Degraded: "border-t-amber-500", Critical: "border-t-red-500", Offline: "border-t-red-500", Syncing: "border-t-blue-500", Inactive: "border-t-slate-400"
};
function Status({ value }: { value: BrokerTone }) { return <Badge variant={variants[value]}>{value}</Badge>; }
function Severity({ value }: { value: BrokerSeverity }) { return <Badge variant={value === "Critical" ? "destructive" : value === "Warning" ? "warning" : "secondary"}>{value}</Badge>; }
function time(value: string | null) { return value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Never"; }
function SectionTitle({ icon: Icon, title, detail }: { icon: typeof Activity; title: string; detail: string }) {
  return <CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-lg"><Icon className="h-5 w-5 text-blue-600" />{title}</CardTitle><p className="mt-1 text-xs text-slate-500">{detail}</p></CardHeader>;
}
function Meter({ label, value, tone = "bg-emerald-500" }: { label: string; value: number; tone?: string }) {
  return <div><div className="mb-1 flex justify-between text-xs text-slate-600"><span>{label}</span><strong>{value}%</strong></div><div className="h-2 rounded-full bg-slate-100"><div className={cn("h-2 rounded-full", tone)} style={{ width: `${Math.min(value, 100)}%` }} /></div></div>;
}

export function BrokerConnectionsDashboard() {
  const query = useBrokerConnections();
  const [selectedId, setSelectedId] = useState("broker-ftmo");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sort, setSort] = useState("risk");
  const [incidentFilter, setIncidentFilter] = useState("All");
  const [notice, setNotice] = useState<string | null>(null);

  if (query.isError) return <div className="mx-auto max-w-[1900px] px-4 py-6"><Card className="border-red-200 p-6"><h1 className="text-xl font-semibold">Broker Connections unavailable</h1><p className="mt-2 text-sm text-slate-600">Broker telemetry could not be loaded. No execution change was issued.</p><Button className="mt-4" onClick={() => query.refetch()}>Retry</Button></Card></div>;
  if (query.isLoading || !query.data) return <div className="mx-auto max-w-[1900px] px-4 py-6 text-sm text-slate-600">Loading broker telemetry...</div>;
  const data = query.data;
  const selected = data.brokers.find((broker) => broker.id === selectedId) ?? data.brokers[0];
  const spreadRisk = detectSpreadSpikes(data.spreadLogs, selected.id);
  const executionRisk = detectExecutionDegradation(data.executionQuality, selected.id);
  const filteredBrokers = data.brokers
    .filter((broker) => `${broker.brokerName} ${broker.brokerCode} ${broker.mt5ServerName} ${broker.serverRegion}`.toLowerCase().includes(search.toLowerCase()))
    .filter((broker) => statusFilter === "All" || broker.connectionStatus === statusFilter || broker.riskLevel === statusFilter)
    .sort((left, right) => sort === "latency" ? right.averageLatencyMs - left.averageLatencyMs : sort === "uptime" ? right.uptimePercent - left.uptimePercent : left.healthScore - right.healthScore);
  const incidents = data.incidents.filter((incident) => incidentFilter === "All" || incident.incidentType === incidentFilter || incident.resolutionStatus === incidentFilter);

  async function command(label: string, path: string, body?: Record<string, unknown>) {
    if (!window.confirm(`Confirm ${label.toLowerCase()}? This broker infrastructure action will be audit-logged.`)) return;
    setNotice(null);
    try {
      await query.action.mutateAsync({ path, body: { confirmed: true, ...body } });
      setNotice(`${label} completed and recorded in the broker audit trail.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Broker operation failed.");
    }
  }
  function exportReport() {
    const file = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(file);
    anchor.download = "broker-connections-report.json";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }
  const actions = [
    { label: "Sync Broker Connections", path: "/api/mt5/broker-connections/sync", allowed: data.permissions.canSync },
    { label: "Test Connection", path: `/api/mt5/broker-connections/${selected.id}/test`, allowed: data.permissions.canTest },
    { label: "Run Broker Diagnostics", path: "/api/mt5/broker-connections/diagnostics", allowed: data.permissions.canDiagnostics, body: { brokerId: selected.id } },
    { label: "Reconnect Broker", path: `/api/mt5/broker-connections/${selected.id}/reconnect`, allowed: data.permissions.canReconnect }
  ];

  return <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
    <section className="sticky top-14 z-20 rounded-2xl border border-slate-200 bg-white/95 shadow-card backdrop-blur">
      <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-blue-600 via-emerald-500 to-purple-600" />
      <div className="flex flex-col gap-5 p-5 xl:flex-row xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">MT5 Infrastructure &amp; Broker Connectivity / Broker Connections</p>
          <div className="mt-2 flex flex-wrap items-center gap-2"><h1 className="text-3xl font-semibold tracking-tight text-slate-950">Broker Connections</h1><Badge variant={query.streamConnected ? "success" : "warning"}><Activity className="mr-1 h-3 w-3" />{query.streamConnected ? "Live stream" : "Reconnecting"}</Badge></div>
          <p className="mt-2 max-w-4xl text-sm text-slate-600">Real-time monitoring of broker connectivity, MT5 server sessions, execution reliability, latency, spreads, and data-feed quality.</p>
          <p className="mt-3 text-xs text-slate-500">Mode: {data.meta.monitoringMode} | Role: {data.permissions.role} | Selected broker: {selected.brokerName} | Updated: {time(data.meta.timestamp)}</p>
        </div>
        <div className="hidden flex-wrap justify-end gap-2 sm:flex">
          <Button variant="outline" onClick={() => query.refetch()}><RefreshCw className="h-4 w-4" />Refresh Brokers</Button>
          {actions.map((action) => <Button key={action.label} variant="outline" disabled={!action.allowed || query.action.isPending} onClick={() => command(action.label, action.path, action.body)}>{action.label}</Button>)}
          <Button variant="outline" onClick={exportReport}><Download className="h-4 w-4" />Export Broker Report</Button>
          <Button variant="destructive" disabled={!data.permissions.canExecutionControl || !selected.executionEnabled} onClick={() => command("Disable broker execution", `/api/mt5/broker-connections/${selected.id}/disable-execution`)}><PowerOff className="h-4 w-4" />Disable Broker Execution</Button>
        </div>
        <div className="sm:hidden"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline"><Menu className="h-4 w-4" />Actions</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => query.refetch()}>Refresh Brokers</DropdownMenuItem>{actions.map((action) => <DropdownMenuItem key={action.label} disabled={!action.allowed} onSelect={() => command(action.label, action.path, action.body)}>{action.label}</DropdownMenuItem>)}<DropdownMenuItem onSelect={exportReport}>Export Broker Report</DropdownMenuItem><DropdownMenuItem disabled={!data.permissions.canExecutionControl} className="text-red-700" onSelect={() => command("Disable broker execution", `/api/mt5/broker-connections/${selected.id}/disable-execution`)}>Disable Broker Execution</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
      </div>
      {notice ? <p className="border-t border-slate-100 px-5 py-2.5 text-xs font-semibold text-blue-700">{notice}</p> : null}
    </section>

    <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
      {data.kpis.map((kpi) => <Card key={kpi.label} className={cn("border-t-4", borders[kpi.status])}><CardContent className="p-3.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p><p className="mt-2 truncate text-xl font-semibold">{kpi.value}</p><p className="mt-1 truncate text-[11px] text-slate-500">{kpi.detail}</p></CardContent></Card>)}
    </section>

    <Card>
      <SectionTitle icon={Workflow} title="Broker Connectivity Workflow" detail="Operational readiness checks from registration through execution feedback and audit." />
      <CardContent className="overflow-x-auto"><div className="flex min-w-[1460px] gap-2">{data.workflow.map((node, index) => <Fragment key={node.title}><div className="min-h-36 flex-1 rounded-xl border border-slate-200 p-3"><Status value={node.status} /><p className="mt-3 text-sm font-semibold">{node.title}</p><div className="mt-2 grid grid-cols-2 text-[11px] text-slate-500"><span>Count {node.count}</span><span>Failed {node.failureCount}</span><span>{node.averageDelayMs}ms</span><span>{time(node.lastCheckedAt)}</span></div>{node.aiRecommendation ? <p className="mt-2 text-xs text-purple-700">AI: {node.aiRecommendation}</p> : null}</div>{index < data.workflow.length - 1 ? <ChevronRight className="mt-14 h-4 w-4 shrink-0 text-slate-300" /> : null}</Fragment>)}</div></CardContent>
    </Card>

    <Card>
      <SectionTitle icon={Server} title="Broker Connections Table" detail="Search, sort, inspect, and control broker execution eligibility." />
      <CardContent>
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:justify-between"><label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm md:w-80"><Search className="h-4 w-4 text-slate-400" /><input aria-label="Search brokers" className="w-full outline-none" placeholder="Search broker, server, region..." value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="flex gap-2"><select aria-label="Filter broker status" className="rounded-lg border border-slate-200 px-3 text-xs" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option><option>Healthy</option><option>Degraded</option><option>Critical</option><option>Offline</option></select><select aria-label="Sort brokers" className="rounded-lg border border-slate-200 px-3 text-xs" value={sort} onChange={(event) => setSort(event.target.value)}><option value="risk">Risk</option><option value="latency">Latency</option><option value="uptime">Uptime</option></select></div></div>
        <div className="overflow-x-auto"><table aria-label="Broker connections registry" className="w-full min-w-[1800px] text-left text-xs"><thead className="border-y border-slate-100 bg-slate-50"><tr>{["Broker ID", "Broker Name", "Code", "MT5 Server / Region", "Mode", "Connection", "Login", "Data Feed", "Execution", "Latency", "Spread Stability", "Slippage", "Requote", "Rejection", "Uptime", "Last Connected", "Last Disconnected", "Risk", "Actions"].map((head) => <th key={head} className="px-3 py-3 font-semibold uppercase text-slate-500">{head}</th>)}</tr></thead><tbody>{filteredBrokers.map((broker) => <tr key={broker.id} className={cn("border-b border-slate-100", broker.id === selected.id && "bg-blue-50/30")} onClick={() => setSelectedId(broker.id)}><td className="px-3 py-3">{broker.brokerId}</td><td className="px-3 py-3 font-semibold">{broker.brokerName}</td><td className="px-3 py-3">{broker.brokerCode}</td><td className="px-3 py-3">{broker.mt5ServerName}<p className="text-slate-500">{broker.serverRegion}</p></td><td className="px-3 py-3">{broker.connectionMode}</td><td className="px-3 py-3"><Status value={broker.connectionStatus} /></td><td className="px-3 py-3"><Status value={broker.loginStatus} /></td><td className="px-3 py-3"><Status value={broker.dataFeedStatus} /></td><td className="px-3 py-3"><Status value={broker.executionStatus} /></td><td className="px-3 py-3">{broker.averageLatencyMs}ms</td><td className="px-3 py-3">{broker.spreadStabilityScore}%</td><td className="px-3 py-3">{broker.slippageScore}%</td><td className="px-3 py-3">{broker.requoteRate}%</td><td className="px-3 py-3">{broker.rejectionRate}%</td><td className="px-3 py-3">{broker.uptimePercent}%</td><td className="px-3 py-3">{time(broker.lastConnectedAt)}</td><td className="px-3 py-3">{time(broker.lastDisconnectedAt)}</td><td className="px-3 py-3"><Status value={broker.riskLevel} /></td><td className="px-3 py-3" onClick={(event) => event.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline">Actions</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setSelectedId(broker.id)}>View Broker</DropdownMenuItem><DropdownMenuItem disabled={!data.permissions.canTest} onSelect={() => command("Test connection", `/api/mt5/broker-connections/${broker.id}/test`)}>Test Connection</DropdownMenuItem><DropdownMenuItem disabled={!data.permissions.canReconnect} onSelect={() => command("Reconnect broker", `/api/mt5/broker-connections/${broker.id}/reconnect`)}>Reconnect</DropdownMenuItem><DropdownMenuItem disabled={!data.permissions.canSync} onSelect={() => command("Sync symbols", `/api/mt5/broker-connections/${broker.id}/sync-symbols`)}>Sync Symbols</DropdownMenuItem><DropdownMenuItem disabled={!data.permissions.canSync} onSelect={() => command("Sync accounts", `/api/mt5/broker-connections/${broker.id}/sync-accounts`)}>Sync Accounts</DropdownMenuItem><DropdownMenuItem disabled={!data.permissions.canExecutionControl || !broker.executionEnabled} onSelect={() => command("Disable execution", `/api/mt5/broker-connections/${broker.id}/disable-execution`)}>Disable Execution</DropdownMenuItem><DropdownMenuItem disabled={!data.permissions.canApproveRestoration || broker.riskLevel !== "Critical"} onSelect={() => command("Approve high-risk restoration", `/api/mt5/broker-connections/${broker.id}/approve-restoration`)}>Approve Restoration</DropdownMenuItem><DropdownMenuItem disabled={!data.permissions.canExecutionControl || broker.executionEnabled} onSelect={() => command("Enable execution", `/api/mt5/broker-connections/${broker.id}/enable-execution`)}>Enable Execution</DropdownMenuItem><DropdownMenuItem onSelect={() => setIncidentFilter("All")}>View Logs</DropdownMenuItem><DropdownMenuItem disabled={!data.permissions.canDiagnostics} onSelect={() => command("Run diagnostics", "/api/mt5/broker-connections/diagnostics", { brokerId: broker.id })}>Run Diagnostics</DropdownMenuItem></DropdownMenuContent></DropdownMenu></td></tr>)}</tbody></table></div>
      </CardContent>
    </Card>

    <section className="grid gap-4 xl:grid-cols-3">
      <Card><SectionTitle icon={Server} title="Broker Identity" detail="Selected connection profile and supported trading scope." /><CardContent className="space-y-2 text-sm"><p><strong>Name:</strong> {selected.brokerName} ({selected.brokerCode})</p><p><strong>MT5 server:</strong> {selected.mt5ServerName}</p><p><strong>Region / timezone:</strong> {selected.serverRegion} / {selected.timezone}</p><p><strong>Mode:</strong> {selected.connectionMode}</p><p><strong>Accounts:</strong> {selected.supportedAccountTypes.join(", ")}</p><p><strong>Instruments:</strong> {selected.supportedInstruments.join(", ")}</p><p><strong>Sessions:</strong> {selected.tradingSessions}</p></CardContent></Card>
      <Card><SectionTitle icon={Activity} title="Connection Health" detail="Reachability, authentication, network behavior, and uptime." /><CardContent className="space-y-3"><div className="flex gap-2"><Status value={selected.connectionStatus} /><Badge variant={selected.serverReachable ? "success" : "destructive"}>{selected.serverReachable ? "Reachable" : "Unreachable"}</Badge></div><Meter label="Login success rate" value={selected.loginSuccessRate} /><Meter label="Uptime" value={selected.uptimePercent} /><p className="text-xs text-slate-600">Latency: <strong>{selected.averageLatencyMs}ms</strong> | Packet loss: <strong>{selected.packetLossPercent}%</strong> | Heartbeat delay: <strong>{selected.heartbeatDelaySeconds}s</strong></p><p className="text-xs text-slate-600">Failed logins: {selected.failedLoginCount} | Last login: {time(selected.lastSuccessfulLoginAt)}</p></CardContent></Card>
      <Card><SectionTitle icon={ShieldCheck} title="Execution & Market Data Health" detail="Routing quality and live feed integrity controls." /><CardContent className="space-y-3"><div className="flex gap-2"><Status value={selected.executionStatus} /><Badge variant={selected.executionEnabled ? "success" : "destructive"}>{selected.executionEnabled ? "Execution enabled" : "Execution disabled"}</Badge></div><Meter label="Fill quality" value={selected.fillQualityScore} tone="bg-blue-600" /><Meter label="Spread stability" value={selected.spreadStabilityScore} tone="bg-purple-600" /><p className="text-xs text-slate-600">Order time: {selected.averageExecutionTimeMs}ms | Rejection: {selected.rejectionRate}% | Requote: {selected.requoteRate}%</p><p className="text-xs text-slate-600">Tick delay: {selected.tickDelaySeconds}s | Data gaps: {selected.missingDataGapCount} | Frozen feed: {selected.frozenFeedStatus}</p><p className="text-xs font-medium text-red-700">{selected.lastRejectedOrderReason ?? "No rejected order reason reported."}</p></CardContent></Card>
    </section>

    <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <Card><SectionTitle icon={Gauge} title="Broker Reliability Ranking" detail="Weighted scoring across uptime, execution, pricing, and data continuity." /><CardContent><div className="grid grid-cols-2 gap-2 text-xs">{[["Best Overall Broker", data.rankings.ranked[0]?.brokerName], ["Best Execution Broker", data.rankings.bestExecutionBroker], ["Best Data Broker", data.rankings.bestDataBroker], ["Most Stable Broker", data.rankings.mostStableBroker], ["Highest Risk Broker", data.rankings.highestRiskBroker], ["Requires Review", data.rankings.brokerRequiringReview]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}</div><div className="mt-4 space-y-2">{data.rankings.ranked.map((broker, index) => <div key={broker.brokerId} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"><span>{index + 1}. {broker.brokerName}</span><Badge variant={broker.score >= 75 ? "success" : broker.score >= 60 ? "warning" : "destructive"}>{broker.score}/100</Badge></div>)}</div></CardContent></Card>
      <Card><SectionTitle icon={Activity} title="Latency, Spread & Execution Charts" detail="Responsive trend monitoring for feed and routing degradation." /><CardContent><div className="grid gap-4 md:grid-cols-2"><div><p className="mb-2 text-xs font-semibold uppercase text-slate-500">Broker latency trend</p><div className="h-44"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.latencyLogs}><XAxis dataKey="brokerName" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 10 }} /><ChartTooltip /><Line dataKey="latencyMs" stroke="#2563eb" strokeWidth={2} /></LineChart></ResponsiveContainer></div></div><div><p className="mb-2 text-xs font-semibold uppercase text-slate-500">Spread stability trend</p><div className="h-44"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.spreadLogs}><XAxis dataKey="symbol" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 10 }} /><ChartTooltip /><Bar dataKey="spreadStabilityScore" fill="#7c3aed" /></BarChart></ResponsiveContainer></div></div></div><div className="mt-4 grid gap-2 sm:grid-cols-4">{[["Spread spike", spreadRisk.detected ? "Detected" : "Clear"], ["Symbols widened", String(spreadRisk.affectedSymbols.length)], ["Execution delay", `${executionRisk.averageExecutionTimeMs}ms`], ["Rejected sample", `${executionRisk.rejectionRate}%`]].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3 text-center text-xs"><p className="uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}</div></CardContent></Card>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <Card><SectionTitle icon={AlertTriangle} title="Broker Logs & Incidents" detail="Connectivity, login, feed, spread, and execution incidents with recovery outcome." /><CardContent><div className="mb-3 flex flex-wrap gap-2">{["All", "Connection Loss", "Login Failure", "Market Data Issue", "Spread Spike", "Execution Delay", "Trade Rejection", "Resolved", "Open"].map((filter) => <button key={filter} className={cn("rounded-full border px-3 py-1 text-xs", incidentFilter === filter ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600")} onClick={() => setIncidentFilter(filter)}>{filter}</button>)}</div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="border-y border-slate-100 bg-slate-50"><tr>{["Timestamp", "Broker / Server", "Incident", "Severity", "Error", "Root Cause", "Action", "Resolution"].map((head) => <th key={head} className="px-2 py-3 uppercase text-slate-500">{head}</th>)}</tr></thead><tbody>{incidents.map((incident) => <tr key={incident.id} className="border-b border-slate-100"><td className="px-2 py-3">{time(incident.createdAt)}</td><td className="px-2 py-3 font-semibold">{incident.brokerName}<p className="font-normal text-slate-500">{incident.serverName}</p></td><td className="px-2 py-3">{incident.incidentType}</td><td className="px-2 py-3"><Severity value={incident.severity} /></td><td className="px-2 py-3">{incident.errorMessage}</td><td className="px-2 py-3">{incident.rootCause}</td><td className="px-2 py-3">{incident.actionTaken}</td><td className="px-2 py-3">{incident.resolutionStatus}</td></tr>)}</tbody></table></div></CardContent></Card>
      <Card><SectionTitle icon={Bot} title="AI Broker Diagnostics" detail="Autonomous assessment of unsafe execution conditions and controlled remediation." /><CardContent className="space-y-3">{data.diagnostics.map((diagnostic) => <div key={diagnostic.id} className="rounded-xl border border-purple-100 bg-purple-50/40 p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{diagnostic.issue}</p><Severity value={diagnostic.severity} /></div><p className="mt-1 text-xs text-slate-500">{diagnostic.affectedBroker}</p><p className="mt-3 text-xs"><strong>Root cause:</strong> {diagnostic.rootCause}</p><p className="mt-2 text-xs"><strong>Trading impact:</strong> {diagnostic.tradingImpact}</p><p className="mt-2 text-xs font-medium text-purple-800"><strong>Recommendation:</strong> {diagnostic.recommendation}</p><div className="mt-3 flex flex-wrap items-center gap-2"><Badge variant="purple">Confidence {Math.round(diagnostic.confidenceScore * 100)}%</Badge><Badge variant={diagnostic.autoRemediationAvailable ? "default" : "secondary"}>{diagnostic.autoRemediationStatus}</Badge>{diagnostic.escalationRequired ? <Badge variant="destructive">Escalation required</Badge> : null}<Button size="sm" disabled={!data.permissions.canAutoRemediate || !diagnostic.autoRemediationAvailable} onClick={() => command("Broker auto-remediation", "/api/mt5/broker-connections/auto-remediate", { diagnosticId: diagnostic.id })}><RotateCcw className="h-3.5 w-3.5" />Safe Recovery</Button></div></div>)}</CardContent></Card>
    </section>
  </div>;
}
