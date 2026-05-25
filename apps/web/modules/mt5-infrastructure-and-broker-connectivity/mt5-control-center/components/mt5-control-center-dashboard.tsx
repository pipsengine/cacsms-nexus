"use client";

import {
  Activity, AlertTriangle, ArrowRight, Bot, Cable, DatabaseZap, Gauge, Menu, Network, PowerOff, RefreshCw, RotateCcw,
  Server, ShieldAlert, ShieldCheck, Stethoscope, Unplug, Wallet, Workflow
} from "lucide-react";
import { type FormEvent, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { useMt5ControlCenter } from "../hooks/use-mt5-control-center";
import type { Mt5Status, TerminalOnboardingInput, TerminalOnboardingReceipt } from "../types/mt5-control-center.types";

const statusVariant: Record<Mt5Status, "success" | "warning" | "destructive" | "default" | "secondary"> = {
  Healthy: "success", Warning: "warning", Critical: "destructive", Offline: "destructive", Syncing: "default", Inactive: "secondary"
};

function Status({ value }: { value: Mt5Status }) {
  return <Badge variant={statusVariant[value]}>{value}</Badge>;
}

function time(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function SectionTitle({ title, description, icon: Icon }: { title: string; description: string; icon: typeof Activity }) {
  return (
    <CardHeader className="flex flex-row items-start justify-between gap-3 pb-4">
      <div>
        <CardTitle className="flex items-center gap-2 text-lg"><Icon className="h-5 w-5 text-blue-600" />{title}</CardTitle>
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      </div>
    </CardHeader>
  );
}

function MetricBar({ label, value, max = 100, tone = "bg-blue-600", suffix = "" }: { label: string; value: number; max?: number; tone?: string; suffix?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-medium text-slate-600">{label}</span><span className="font-semibold text-slate-900">{value}{suffix}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div>
    </div>
  );
}

export function Mt5ControlCenterDashboard() {
  const query = useMt5ControlCenter();
  const [notice, setNotice] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [receipt, setReceipt] = useState<TerminalOnboardingReceipt | null>(null);
  const [onboarding, setOnboarding] = useState<TerminalOnboardingInput>({
    terminalUuid: "", terminalName: "", brokerId: "broker-icm", brokerName: "IC Markets", serverName: "ICMarketsSC-Live23", accountLogin: "",
    accountName: "", accountType: "Live", currency: "USD", leverage: "1:100", terminalVersion: "5.00", hostMachine: "", eaName: "NexusBridgeEA",
    operatingSystem: "Windows Server 2022", region: "", timezone: "UTC", terminalPath: "", symbolScope: ["EURUSD", "XAUUSD"]
  });

  if (query.isError) {
    return <div className="mx-auto max-w-[1800px] px-4 py-6"><Card className="border-red-200 p-6"><h1 className="text-xl font-semibold">MT5 Control Center unavailable</h1><p className="mt-2 text-sm text-slate-600">The status service could not be reached. No trading action has been issued.</p><Button className="mt-4" onClick={() => query.refetch()}>Retry</Button></Card></div>;
  }
  if (query.isLoading || !query.data) {
    return <div className="mx-auto max-w-[1800px] px-4 py-6 text-sm text-slate-600">Loading MT5 infrastructure telemetry...</div>;
  }
  const data = query.data;
  const targetTerminal = data.terminals.find((terminal) => terminal.status === "Critical") ?? data.terminals[0];
  const invoke = async (label: string, path: string, body?: unknown) => {
    setNotice(null);
    try {
      await query.action.mutateAsync({ path, body });
      setNotice(`${label} completed and recorded in the audit log.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Operation failed.");
    }
  };
  const submitOnboarding = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!window.confirm("Confirm terminal onboarding? The terminal and account will be created with trading disabled and the EA credential receipt will be shown once.")) return;
    setNotice(null);
    setReceipt(null);
    try {
      const provisioned = await query.action.mutateAsync({ path: "/api/mt5/onboarding/terminals", body: { ...onboarding, confirmed: true } }) as TerminalOnboardingReceipt;
      setReceipt(provisioned);
      setNotice("Terminal provisioned. Install and configure the EA, then wait for the first verified heartbeat.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Terminal onboarding failed.");
    }
  };
  const actions = [
    { label: "Sync Brokers", path: "/api/mt5/brokers/sync", icon: DatabaseZap, allowed: data.permissions.canSync },
    { label: "Restart Terminal", path: `/api/mt5/terminals/${targetTerminal.id}/restart`, icon: RotateCcw, allowed: data.permissions.canRestart },
    { label: "Run Diagnostics", path: "/api/mt5/diagnostics/run", icon: Stethoscope, allowed: data.permissions.canRestart }
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <section className="sticky top-14 z-20 rounded-2xl border border-slate-200 bg-white/95 shadow-card backdrop-blur">
        <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-blue-600 via-emerald-500 to-purple-600" />
        <div className="flex flex-col gap-5 p-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">MT5 Control Center</h1>
              <Badge variant={query.streamConnected ? "success" : "warning"}><Activity className="mr-1 h-3 w-3" />{query.streamConnected ? "Live stream" : "Reconnecting"}</Badge>
              <Badge variant={statusVariant[data.kpis[9].status]}>{data.connectionHealth.score}/100 {data.connectionHealth.rating}</Badge>
            </div>
            <p className="mt-2 max-w-4xl text-sm text-slate-600">Centralized control room for MT5 terminals, broker sessions, execution gateways, and trading infrastructure health.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">Mode: {data.meta.monitoringMode}</span>
              <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">Role: {data.permissions.role}</span>
              <span className="rounded-lg bg-slate-50 px-2.5 py-1.5">Updated: {time(data.meta.timestamp)}</span>
            </div>
          </div>
          <div className="hidden flex-wrap justify-end gap-2 sm:flex">
            <Button variant="outline" onClick={() => query.refetch()}><RefreshCw className="h-4 w-4" />Refresh Status</Button>
            <Button variant="outline" disabled={!data.permissions.canRegisterTerminal} onClick={() => setShowOnboarding((open) => !open)}><Cable className="h-4 w-4" />Register Terminal</Button>
            {actions.map(({ label, path, icon: Icon, allowed }) => <Button key={label} variant="outline" disabled={!allowed || query.action.isPending} onClick={() => invoke(label, path)}><Icon className="h-4 w-4" />{label}</Button>)}
            <Button variant="destructive" disabled={!data.permissions.canEmergencyShutdown || query.action.isPending} onClick={() => invoke("Emergency shutdown", "/api/mt5/trading/emergency-disable")}><PowerOff className="h-4 w-4" />Emergency Disable Trading</Button>
          </div>
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline"><Menu className="h-4 w-4" />Actions</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => query.refetch()}>Refresh Status</DropdownMenuItem>
                <DropdownMenuItem disabled={!data.permissions.canRegisterTerminal} onSelect={() => setShowOnboarding(true)}>Register Terminal</DropdownMenuItem>
                {actions.map((action) => <DropdownMenuItem key={action.label} disabled={!action.allowed} onSelect={() => invoke(action.label, action.path)}>{action.label}</DropdownMenuItem>)}
                <DropdownMenuItem disabled={!data.permissions.canEmergencyShutdown} className="text-red-700" onSelect={() => invoke("Emergency shutdown", "/api/mt5/trading/emergency-disable")}>Emergency Disable Trading</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {notice ? <p className="border-t border-slate-100 px-5 py-2.5 text-xs font-medium text-blue-700">{notice}</p> : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {data.kpis.map((kpi, index) => {
          const icons = [Server, Network, Wallet, Activity, Workflow, Gauge, Unplug, AlertTriangle, DatabaseZap, ShieldAlert];
          const Icon = icons[index];
          return (
            <Card key={kpi.label} className={cn("overflow-hidden border-t-4", kpi.status === "Healthy" ? "border-t-emerald-500" : kpi.status === "Critical" ? "border-t-red-500" : "border-t-amber-500")}>
              <CardContent className="p-3.5">
                <div className="flex items-start justify-between gap-2"><p className="text-[11px] font-semibold uppercase text-slate-500">{kpi.label}</p><Icon className="h-4 w-4 shrink-0 text-slate-500" /></div>
                <p className="mt-2 text-xl font-semibold text-slate-950">{kpi.value}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{kpi.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card>
        <SectionTitle title="Terminal Onboarding" description="Register a terminal, bind a broker account, and issue a secure EA pairing receipt with trading disabled until verified." icon={Cable} />
        <CardContent>
          <div className="grid gap-3 text-xs lg:grid-cols-3">
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3"><p className="font-semibold text-blue-900">1. Provision</p><p className="mt-1 text-slate-600">Create the terminal, broker/account binding, monitoring row, and EA bridge instance.</p></div>
            <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-3"><p className="font-semibold text-purple-900">2. Pair EA</p><p className="mt-1 text-slate-600">Enter the one-time ingestion token and signing secret in <span className="font-mono">NexusBridgeEA</span>.</p></div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3"><p className="font-semibold text-emerald-900">3. Activate</p><p className="mt-1 text-slate-600">A verified signed heartbeat activates monitoring. Trading remains blocked pending readiness review.</p></div>
          </div>
          {!data.permissions.canRegisterTerminal ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Registration is locked for role <strong>{data.permissions.role}</strong>. For local development, enable server-only <span className="font-mono">MT5_LOCAL_OPERATOR_MODE=true</span> with <span className="font-mono">MT5_LOCAL_OPERATOR_ROLE=Infrastructure Admin</span> and restart the web server. Production requires authenticated RBAC.</p> : null}
          {showOnboarding ? (
            <form aria-label="Terminal onboarding form" className="mt-4 rounded-xl border border-slate-200 p-4" onSubmit={submitOnboarding}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Terminal UUID", "terminalUuid"], ["Terminal Name", "terminalName"], ["Account Login", "accountLogin"], ["Account Name", "accountName"],
                  ["Host Machine", "hostMachine"], ["Region", "region"], ["Terminal Path", "terminalPath"], ["EA Name", "eaName"]
                ].map(([label, key]) => (
                  <label key={key} className="text-xs font-semibold text-slate-600">{label}
                    <input required={["terminalUuid", "terminalName", "accountLogin", "accountName", "hostMachine", "eaName"].includes(key)} value={String(onboarding[key as keyof TerminalOnboardingInput] ?? "")} onChange={(event) => setOnboarding((value) => ({ ...value, [key]: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal text-slate-900 outline-none focus:border-blue-500" />
                  </label>
                ))}
                <label className="text-xs font-semibold text-slate-600">Broker
                  <select value={onboarding.brokerId} onChange={(event) => {
                    const selected = data.brokers.find((broker) => broker.id === event.target.value);
                    if (selected) setOnboarding((value) => ({ ...value, brokerId: selected.id, brokerName: selected.brokerName, serverName: selected.mt5ServerName }));
                  }} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal text-slate-900">
                    {data.brokers.map((broker) => <option key={broker.id} value={broker.id}>{broker.brokerName}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">Server<input readOnly value={onboarding.serverName} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-normal" /></label>
                <label className="text-xs font-semibold text-slate-600">Account Type<input value={onboarding.accountType} onChange={(event) => setOnboarding((value) => ({ ...value, accountType: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal" /></label>
                <label className="text-xs font-semibold text-slate-600">Leverage<input value={onboarding.leverage} onChange={(event) => setOnboarding((value) => ({ ...value, leverage: event.target.value }))} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 font-normal" /></label>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={!data.permissions.canRegisterTerminal || query.action.isPending}>Provision Terminal &amp; EA Pairing</Button>
                <Button type="button" variant="ghost" onClick={() => setShowOnboarding(false)}>Cancel</Button>
                <Badge variant="warning">Trading disabled during onboarding</Badge>
              </div>
            </form>
          ) : null}
          {receipt ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-950">One-Time EA Pairing Receipt: {receipt.eaInstanceId}</p><Badge variant="warning">{receipt.state}</Badge></div>
              <p className="mt-2 text-amber-800">Store these values in the terminal EA inputs now. The plaintext credentials are not shown again in monitoring responses.</p>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                <p className="rounded-lg bg-white p-3"><strong>NexusBaseUrl</strong><br /><span className="break-all font-mono">{receipt.nexusBaseUrl}</span></p>
                <p className="rounded-lg bg-white p-3"><strong>EaInstanceId</strong><br /><span className="break-all font-mono">{receipt.eaInstanceId}</span></p>
                <p className="rounded-lg bg-white p-3"><strong>IngestionToken</strong><br /><span className="break-all font-mono">{receipt.ingestionToken}</span></p>
                <p className="rounded-lg bg-white p-3"><strong>SigningSecret</strong><br /><span className="break-all font-mono">{receipt.signingSecret}</span></p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <SectionTitle title="MT5 Infrastructure Workflow" description="Autonomous monitoring path from broker connectivity through immutable audit output." icon={Workflow} />
        <CardContent className="overflow-x-auto pb-5">
          <div className="flex min-w-[1350px] items-stretch gap-2">
            {data.workflow.map((step, index) => (
              <div className="flex flex-1 items-center gap-2" key={step.id}>
                <div className="h-full min-h-36 flex-1 rounded-xl border border-slate-200 p-3">
                  <Status value={step.status} />
                  <p className="mt-3 text-sm font-semibold text-slate-950">{step.title}</p>
                  <p className="mt-2 text-[11px] text-slate-500">Checked {time(step.lastCheckedAt)}</p>
                  {step.failureReason ? <p className="mt-2 text-xs text-red-700">{step.failureReason}</p> : null}
                  <p className="mt-2 text-xs text-purple-700">AI: {step.aiRecommendation}</p>
                </div>
                {index < data.workflow.length - 1 ? <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" /> : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <SectionTitle title="Terminal Health Monitor" description="Terminal resource pressure, heartbeats, authentication sessions, and operator recovery controls." icon={Server} />
        <CardContent className="overflow-x-auto">
          <table className="min-w-[1220px] w-full text-left text-xs">
            <thead className="border-y border-slate-100 bg-slate-50 text-slate-500"><tr>{["Terminal ID", "Broker / Server", "Account", "Status", "Version", "CPU", "Memory", "Disk", "Latency", "Uptime", "Heartbeat", "Actions"].map((head) => <th key={head} className="px-3 py-3 font-semibold uppercase">{head}</th>)}</tr></thead>
            <tbody>
              {data.terminals.map((terminal) => (
                <tr key={terminal.id} className="border-b border-slate-100">
                  <td className="px-3 py-3 font-semibold text-slate-950">{terminal.terminalName}<p className="font-normal text-slate-500">{terminal.id}</p></td>
                  <td className="px-3 py-3">{terminal.brokerName}<p className="text-slate-500">{terminal.serverName}</p></td>
                  <td className="px-3 py-3">{terminal.accountLogin}<p className="text-slate-500">{terminal.accountType}</p></td>
                  <td className="px-3 py-3"><Status value={terminal.status} /></td>
                  <td className="px-3 py-3 whitespace-nowrap">{terminal.terminalVersion}</td>
                  <td className="px-3 py-3">{terminal.cpuUsage}%</td><td className="px-3 py-3">{terminal.memoryUsage}%</td><td className="px-3 py-3">{terminal.diskUsage}%</td>
                  <td className={cn("px-3 py-3 font-semibold", terminal.latencyMs > 250 ? "text-red-700" : "text-emerald-700")}>{terminal.latencyMs} ms</td>
                  <td className="px-3 py-3">{Math.floor(terminal.uptimeSeconds / 3600)}h</td><td className="px-3 py-3">{time(terminal.lastHeartbeatAt)}</td>
                  <td className="px-3 py-3"><Button size="sm" variant="outline" disabled={!data.permissions.canRestart} onClick={() => invoke("Terminal restart", `/api/mt5/terminals/${terminal.id}/restart`)}>Restart</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <SectionTitle title="Broker Connectivity" description="Routing quality, feeds, login health, and reliability ranking." icon={Network} />
          <CardContent className="grid gap-3 md:grid-cols-3">
            {data.brokers.map((broker) => (
              <div key={broker.id} className="rounded-xl border border-slate-200 p-3.5">
                <div className="flex justify-between gap-2"><div><p className="font-semibold text-slate-950">{broker.brokerName}</p><p className="text-xs text-slate-500">{broker.mt5ServerName}</p></div><Status value={broker.status} /></div>
                <p className="mt-3 text-xs text-slate-500">{broker.serverRegion} | {broker.connectionMode}</p>
                <div className="mt-3 space-y-2.5">
                  <MetricBar label="Feed quality" value={broker.dataFeedQualityScore} tone="bg-emerald-600" suffix="/100" />
                  <MetricBar label="Execution quality" value={broker.executionQualityScore} tone={broker.executionQualityScore < 60 ? "bg-red-600" : "bg-blue-600"} suffix="/100" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><p>Spread <strong>{broker.averageSpread}</strong></p><p>Latency <strong>{broker.averageLatencyMs}ms</strong></p><p>Requote <strong>{broker.requoteRate}%</strong></p><p>Slippage <strong>{broker.slippageRate}%</strong></p></div>
                <p className="mt-3 text-xs text-slate-500">Login: <span className={broker.loginHealth === "Critical" ? "text-red-700" : "text-emerald-700"}>{broker.loginHealth}</span></p>
                <p className="mt-2 line-clamp-2 text-[11px] text-slate-500">Incident: {broker.lastIncident ?? "No current incidents"}</p>
              </div>
            ))}
            <div className="md:col-span-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-4">
              <p>Best execution<br /><strong>{data.brokerRanking.bestForExecution}</strong></p><p>Best data quality<br /><strong>{data.brokerRanking.bestForDataQuality}</strong></p><p>Risky broker<br /><strong className="text-red-700">{data.brokerRanking.riskyBroker}</strong></p><p>Monitor<br /><strong className="text-amber-700">{data.brokerRanking.requiresMonitoring.join(", ")}</strong></p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <SectionTitle title="Latency & Execution Quality" description="Rolling execution and market-data continuity metrics." icon={Gauge} />
          <CardContent>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[["Execution", `${data.executionQuality.averageExecutionMs} ms`], ["Slippage", `${data.executionQuality.averageSlippagePoints} pts`], ["Fill score", `${data.executionQuality.fillQualityScore}/100`], ["Requotes", `${data.executionQuality.requoteRate}%`], ["Failed orders", `${data.executionQuality.rejectionRate}%`], ["Data gaps", String(data.executionQuality.marketDataGaps)]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}
            </div>
            <div className="mt-5 space-y-4">
              {data.executionQuality.brokerMetrics.map((broker) => <MetricBar key={broker.brokerId} label={`${broker.brokerName} latency`} value={broker.latencyMs} max={600} suffix=" ms" tone={broker.latencyMs > 250 ? "bg-red-600" : "bg-emerald-600"} />)}
              <MetricBar label="Delayed tick feeds" value={data.executionQuality.delayedTicks} max={data.symbols.length} tone="bg-amber-500" />
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <SectionTitle title="Account Synchronization" description="Balances, equity, margin availability, and permission enforcement." icon={Wallet} />
        <CardContent className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-xs">
            <thead className="border-y border-slate-100 bg-slate-50 text-slate-500"><tr>{["Account", "Broker", "Currency", "Balance", "Equity", "Margin", "Free Margin", "Leverage", "Trading", "Sync", "Last Sync"].map((head) => <th className="px-3 py-3 font-semibold uppercase" key={head}>{head}</th>)}</tr></thead>
            <tbody>{data.accounts.map((account) => <tr className="border-b border-slate-100" key={account.id}><td className="px-3 py-3 font-semibold">{account.accountLogin}<p className="font-normal text-slate-500">{account.accountType}</p></td><td className="px-3 py-3">{account.brokerName}</td><td className="px-3 py-3">{account.currency}</td><td className="px-3 py-3">{money(account.balance, account.currency)}</td><td className="px-3 py-3">{money(account.equity, account.currency)}</td><td className="px-3 py-3">{money(account.margin, account.currency)}</td><td className="px-3 py-3">{money(account.freeMargin, account.currency)}</td><td className="px-3 py-3">{account.leverage}</td><td className="px-3 py-3"><Badge variant={account.tradeAllowed ? "success" : "destructive"}>{account.tradeAllowed ? "Allowed" : "Blocked"}</Badge></td><td className="px-3 py-3"><Status value={account.syncStatus} /></td><td className="px-3 py-3">{time(account.lastSyncAt)}</td></tr>)}</tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <SectionTitle title="Symbol & Instrument Sync" description="Broker-normalized asset registry, feed readiness, and anomaly checks." icon={DatabaseZap} />
        <CardContent className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left text-xs">
            <thead className="border-y border-slate-100 bg-slate-50 text-slate-500"><tr>{["Symbol", "Broker Symbol", "Normalized", "Asset Class", "Spread", "Digits", "Contract Size", "Tick Value", "Trading", "Data Feed", "Mapping"].map((head) => <th className="px-3 py-3 font-semibold uppercase" key={head}>{head}</th>)}</tr></thead>
            <tbody>{data.symbols.map((symbol) => <tr className="border-b border-slate-100" key={symbol.id}><td className="px-3 py-3 font-semibold">{symbol.symbol}</td><td className="px-3 py-3">{symbol.brokerSymbol}</td><td className="px-3 py-3 text-blue-700">{symbol.normalizedSymbol}</td><td className="px-3 py-3">{symbol.assetClass}</td><td className={cn("px-3 py-3", symbol.spread > symbol.normalSpread * 2.5 && "font-semibold text-red-700")}>{symbol.spread}</td><td className="px-3 py-3">{symbol.digits}</td><td className="px-3 py-3">{symbol.contractSize.toLocaleString()}</td><td className="px-3 py-3">{symbol.tickValue}</td><td className="px-3 py-3">{symbol.tradingAllowed ? "Allowed" : "Blocked"}</td><td className="px-3 py-3"><Badge variant={symbol.dataFeedActive ? "success" : "destructive"}>{symbol.dataFeedActive ? "Active" : "Down"}</Badge></td><td className="px-3 py-3"><Status value={symbol.mappingStatus} /></td></tr>)}</tbody>
          </table>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <SectionTitle title="AI Diagnostics & Recommendations" description="Root cause reasoning with governed auto-remediation paths." icon={Bot} />
          <CardContent className="space-y-3">
            {data.diagnostics.map((item) => (
              <div key={item.id} className="rounded-xl border border-purple-100 bg-purple-50/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-slate-950">{item.issue}</p><Badge variant={item.severity === "Critical" ? "destructive" : "warning"}>{item.severity} {item.severityScore}</Badge></div>
                <p className="mt-2 text-xs text-slate-600"><strong>Root cause:</strong> {item.rootCauseAnalysis}</p>
                <p className="mt-1 text-xs text-slate-600"><strong>Impact:</strong> {item.businessImpact}</p>
                <p className="mt-2 text-xs font-medium text-purple-800"><strong>Recommendation:</strong> {item.recommendation}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><Badge variant="purple">Confidence {Math.round(item.confidenceScore * 100)}%</Badge><Badge variant={item.autoRemediationAvailable ? "default" : "secondary"}>{item.autoRemediationStatus}</Badge>{item.escalationRequired ? <Badge variant="destructive">Escalation required</Badge> : null}</div>
                {item.autoRemediationAvailable ? <Button size="sm" className="mt-3" disabled={!data.permissions.canRestart || query.action.isPending} onClick={() => invoke("Auto-remediation", "/api/mt5/diagnostics/auto-remediate", { diagnosticId: item.id })}>Trigger recovery workflow</Button> : null}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <SectionTitle title="Incident & Recovery Timeline" description="Failure conditions and autonomous recovery activity." icon={ShieldCheck} />
          <CardContent className="space-y-1">
            {data.incidents.map((incident) => (
              <div key={incident.id} className="flex gap-3 border-l-2 border-slate-100 py-3 pl-4">
                <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", incident.severity === "Critical" ? "bg-red-600" : incident.severity === "Warning" ? "bg-amber-500" : "bg-emerald-600")} />
                <div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{incident.eventType}</p><Badge variant={incident.autoResolved ? "success" : incident.severity === "Critical" ? "destructive" : "warning"}>{incident.autoResolved ? "Recovered" : incident.severity}</Badge></div><p className="mt-1 text-xs text-slate-600">{incident.message}</p><p className="mt-1 text-[11px] text-slate-500">{time(incident.createdAt)} | {incident.rootCause}</p></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
