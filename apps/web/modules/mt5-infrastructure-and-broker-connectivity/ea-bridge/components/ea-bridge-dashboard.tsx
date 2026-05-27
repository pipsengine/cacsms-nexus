"use client";

import {
  Activity, AlertTriangle, Bot, Cable, ChevronRight, Clock3, DatabaseZap, KeyRound, Menu, PowerOff, RefreshCw, RotateCcw,
  Search, Send, Server, ShieldCheck, Stethoscope, Workflow
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { calculateDeliveryReliability, classifyTokenRisk } from "../algorithms/ea-bridge.algorithms";
import { useEaBridge } from "../hooks/use-ea-bridge";
import { EaBridgeActionError } from "../services/ea-bridge.service";
import type { BridgeSeverity, BridgeTone, EaPairingReceipt, EaPairingTestResult } from "../types/ea-bridge.types";

const statusVariant: Record<BridgeTone, "success" | "warning" | "destructive" | "default" | "secondary"> = {
  Healthy: "success", Watch: "warning", Degraded: "warning", Critical: "destructive", Offline: "destructive", Syncing: "default", Inactive: "secondary"
};
const statusBorder: Record<BridgeTone, string> = {
  Healthy: "border-t-emerald-500", Watch: "border-t-amber-500", Degraded: "border-t-amber-500", Critical: "border-t-red-500", Offline: "border-t-red-500", Syncing: "border-t-blue-500", Inactive: "border-t-slate-400"
};
function Status({ value }: { value: BridgeTone }) { return <Badge variant={statusVariant[value]}>{value}</Badge>; }
function Severity({ value }: { value: BridgeSeverity }) { return <Badge variant={value === "Critical" ? "destructive" : value === "Warning" ? "warning" : "secondary"}>{value}</Badge>; }
function time(value: string) { return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
function duration(seconds: number) { return seconds > 3600 ? `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m` : `${Math.floor(seconds / 60)}m`; }
function Title({ icon: Icon, title, description }: { icon: typeof Activity; title: string; description: string }) {
  return <CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-lg"><Icon className="h-5 w-5 text-blue-600" />{title}</CardTitle><p className="mt-1 text-xs text-slate-500">{description}</p></CardHeader>;
}
function Metric({ label, value, max = 100, suffix = "%", tone = "bg-blue-600" }: { label: string; value: number; max?: number; suffix?: string; tone?: string }) {
  return <div><div className="mb-1.5 flex justify-between text-xs text-slate-600"><span>{label}</span><strong>{value}{suffix}</strong></div><div className="h-2 rounded-full bg-slate-100"><div className={cn("h-2 rounded-full", tone)} style={{ width: `${Math.min(100, value / max * 100)}%` }} /></div></div>;
}
const riskOrder: Record<BridgeTone, number> = { Critical: 0, Offline: 1, Degraded: 2, Watch: 3, Syncing: 4, Healthy: 5, Inactive: 6 };

export function EaBridgeDashboard() {
  const query = useEaBridge();
  const [selectedId, setSelectedId] = useState("");
  const [expandedId, updateExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("risk");
  const [logFilter, setLogFilter] = useState("All");
  const [notice, setNotice] = useState<string | null>(null);
  const [pairingReceipt, setPairingReceipt] = useState<EaPairingReceipt | null>(null);
  const [pairingTestResult, setPairingTestResult] = useState<EaPairingTestResult | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  function setExpandedId(id: string | null) {
    updateExpandedId(id);
    if (id) setSelectedId(id);
  }

  if (query.isError) return <div className="mx-auto max-w-[1900px] px-4 py-6"><Card className="border-red-200 p-6"><h1 className="text-xl font-semibold">EA Bridge unavailable</h1><p className="mt-2 text-sm text-slate-600">Bridge telemetry could not be loaded. No command delivery action was issued.</p><Button className="mt-4" onClick={() => query.refetch()}>Retry</Button></Card></div>;
  if (query.isLoading || !query.data) return <div className="mx-auto max-w-[1900px] px-4 py-6 text-sm text-slate-600">Loading EA bridge telemetry...</div>;
  const data = query.data;
  const selected = data.instances.find((instance) => instance.id === selectedId) ?? data.instances[0] ?? null;
  const expanded = selected;
  const delivery = calculateDeliveryReliability(data.messages);
  const instances = data.instances
    .filter((instance) => `${instance.eaName} ${instance.terminalName} ${instance.brokerName} ${instance.accountLogin}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === "messages" ? b.messageCount - a.messageCount : sort === "latency" ? b.averageLatencyMs - a.averageLatencyMs : riskOrder[a.riskLevel] - riskOrder[b.riskLevel] || b.averageLatencyMs - a.averageLatencyMs);
  const logs = data.logs.filter((log) => logFilter === "All" || log.logType === logFilter || log.severity === logFilter);
  const blockedCommands = data.commands.filter((command) => command.riskApprovalStatus === "Blocked").length;
  const pendingCommands = data.commands.filter((command) => command.executionStatus === "Pending").length;
  const rejectedCommands = data.commands.filter((command) => command.executionStatus === "Rejected").length;
  const feedbackCount = data.messages.filter((message) => message.messageType === "Trade Execution Result" && message.status === "Delivered").length;
  const commandStages: Array<{ label: string; status: BridgeTone; detail: string }> = [
    { label: "Signal received", status: data.commands.length ? "Healthy" : "Inactive", detail: `${data.commands.length} command(s)` },
    { label: "Risk validated", status: blockedCommands ? "Critical" : "Healthy", detail: blockedCommands ? `${blockedCommands} blocked` : "No risk blocks" },
    { label: "Command approved", status: blockedCommands ? "Degraded" : "Healthy", detail: `${data.commands.filter((command) => command.riskApprovalStatus === "Approved").length} approved` },
    { label: "Delivered to EA", status: data.commands.some((command) => command.deliveryStatus === "Blocked") ? "Critical" : "Healthy", detail: `${data.commands.filter((command) => command.deliveryStatus === "Delivered").length} delivered` },
    { label: "Executed by MT5", status: rejectedCommands ? "Critical" : pendingCommands ? "Degraded" : "Healthy", detail: rejectedCommands ? `${rejectedCommands} rejected` : pendingCommands ? `${pendingCommands} pending` : "Executed" },
    { label: "Feedback received", status: feedbackCount < data.commands.filter((command) => command.executionStatus === "Executed").length ? "Degraded" : "Healthy", detail: `${feedbackCount} confirmed` }
  ];

  async function copyPairingReceipt(receipt: EaPairingReceipt) {
    const text = [
      `NexusBaseUrl=${receipt.nexusBaseUrl}`,
      `EaInstanceId=${receipt.eaInstanceId}`,
      `IngestionToken=${receipt.ingestionToken}`,
      `SigningSecret=${receipt.signingSecret}`
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setNotice("Pairing receipt copied to clipboard. Paste into NexusBridgeEA inputs inside MT5.");
  }

  async function reissuePairing(instanceId: string, label: string) {
    if (!window.confirm(`Confirm ${label.toLowerCase()}? The previous receipt remains accepted only for a short grace window.`)) return;
    setNotice(null);
    setPairingTestResult(null);
    try {
      const result = await query.action.mutateAsync({
        path: `/api/mt5/ea-bridge/instances/${instanceId}/reissue-pairing`,
        body: { confirmed: true }
      });
      const receipt = result as unknown as EaPairingReceipt;
      setPairingReceipt(receipt);
      const embeddedTest = receipt.test ?? null;
      if (embeddedTest) {
        setPairingTestResult(embeddedTest);
        if (embeddedTest.accepted) {
          setNotice(`${label} completed and verified. Copy the receipt below into NexusBridgeEA inputs.`);
        } else {
          setNotice(`${label} completed, but verification failed: ${embeddedTest.code ?? "failed"}.`);
        }
      } else {
        setNotice(`${label} completed. Copy the new receipt below into NexusBridgeEA inputs.`);
      }
      await query.refetch();
    } catch (error) {
      setPairingReceipt(null);
      setNotice(error instanceof Error ? error.message : "EA pairing reissue failed.");
    }
  }

  async function testPairing(receipt: EaPairingReceipt) {
    setNotice(null);
    setPairingTestResult(null);
    try {
      const result = await query.action.mutateAsync({
        path: `/api/mt5/ea-bridge/instances/${receipt.eaInstanceId}/test-pairing`,
        body: {
          confirmed: true,
          ingestionToken: receipt.ingestionToken,
          signingSecret: receipt.signingSecret
        }
      });
      setPairingTestResult(result as unknown as EaPairingTestResult);
      setNotice("Test Pairing succeeded. Backend accepted a signed heartbeat with the displayed credentials.");
      await query.refetch();
    } catch (error) {
      const bridgeError = error instanceof EaBridgeActionError ? error : null;
      setPairingTestResult({
        accepted: false,
        code: bridgeError?.code ?? "token_mismatch",
        error: error instanceof Error ? error.message : "Test Pairing failed.",
        diagnostics: bridgeError?.diagnostics
      });
      setNotice(error instanceof Error ? error.message : "Test Pairing failed.");
    }
  }

  async function command(label: string, path: string, body?: Record<string, unknown>) {
    if (!path) {
      setNotice("No EA instance is selected for this action yet.");
      return;
    }
    if (!window.confirm(`Confirm ${label.toLowerCase()}? This secure bridge action will be audit-logged.`)) return;
    setNotice(null);
    try {
      await query.action.mutateAsync({ path, body: { confirmed: true, ...body } });
      setNotice(`${label} completed and recorded in the EA Bridge audit trail.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "EA bridge action failed.");
    }
  }

  async function sendTestOrder() {
    if (!selected) {
      setNotice("No EA instance is selected for this action yet.");
      return;
    }
    const defaultSymbol = selected.symbolScope?.[0] ?? "";
    const symbol = window.prompt("Symbol to send (must exist in Market Watch and match EA symbol scope):", defaultSymbol)?.trim() ?? "";
    if (!symbol) return;
    const volumeRaw = window.prompt("Lot size (volume):", "0.01")?.trim() ?? "";
    const volume = Number.parseFloat(volumeRaw);
    if (!Number.isFinite(volume) || volume <= 0) {
      setNotice("Invalid volume.");
      return;
    }
    if (!window.confirm("Confirm sending a test order command to this EA? The EA will only execute it if EnableCommandExecution is enabled in EA inputs.")) {
      return;
    }
    setNotice(null);
    try {
      const result = await query.action.mutateAsync({
        path: `/api/mt5/ea-bridge/instances/${selected.id}/test-order`,
        body: { confirmed: true, symbol, volume, direction: "Buy", commandType: "Market", enableTradingChannel: true }
      });
      const accepted = Boolean((result as any)?.accepted);
      setNotice(accepted
        ? "Test order queued. Ensure PollApprovedCommands is enabled in the EA inputs to receive it."
        : (result as any)?.reason ?? "Test order was not accepted.");
      await query.refetch();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to send test order.");
    }
  }
  const actions = [
    { label: "Sync EA Instances", icon: DatabaseZap, path: "/api/mt5/ea-bridge/instances/sync", allowed: data.permissions.canSync },
    { label: "Run Bridge Diagnostics", icon: Stethoscope, path: "/api/mt5/ea-bridge/diagnostics", allowed: data.permissions.canDiagnostics },
    { label: "Restart Bridge", icon: RotateCcw, path: selected ? `/api/mt5/ea-bridge/instances/${selected.id}/restart` : "", allowed: data.permissions.canRestart && Boolean(selected) },
    { label: "Rotate Bridge Token", icon: KeyRound, path: selected ? `/api/mt5/ea-bridge/instances/${selected.id}/rotate-token` : "", allowed: data.permissions.canRotateToken && Boolean(selected) },
    { label: "Reissue EA Pairing", icon: KeyRound, path: selected ? `/api/mt5/ea-bridge/instances/${selected.id}/reissue-pairing` : "", allowed: data.permissions.canReissuePairing && Boolean(selected), reissue: true }
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <section className="sticky top-14 z-20 rounded-2xl border border-slate-200 bg-white/95 shadow-card backdrop-blur">
        <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-blue-600 via-emerald-500 to-purple-600" />
        <div className="flex flex-col gap-5 p-5 xl:flex-row xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">MT5 Infrastructure &amp; Broker Connectivity / EA Bridge</p>
            <div className="mt-2 flex flex-wrap items-center gap-2"><h1 className="text-3xl font-semibold tracking-tight text-slate-950">EA Bridge</h1><Badge variant={query.streamConnected ? "success" : "warning"}><Activity className="mr-1 h-3 w-3" />{query.streamConnected ? "Live stream" : "Reconnecting"}</Badge><Badge variant="purple">{data.bridgeHealth.score}/100 {data.bridgeHealth.rating}</Badge></div>
            <p className="mt-2 max-w-4xl text-sm text-slate-600">Real-time communication bridge between MT5 Expert Advisors, trading terminals, execution services, and Nexus AI engines.</p>
            <p className="mt-3 text-xs text-slate-500">Mode: {data.meta.monitoringMode} | Role: {data.permissions.role} | Selected EA: {selected?.eaName ?? "None"} | Updated: {time(data.meta.timestamp)} ({Math.max(0, Math.floor((now - new Date(data.meta.timestamp).getTime()) / 1000))}s ago)</p>
          </div>
          <div className="hidden flex-wrap justify-end gap-2 sm:flex">
            <Button variant="outline" onClick={() => query.refetch()}><RefreshCw className="h-4 w-4" />Refresh Bridge</Button>
            <Button variant="outline" disabled={!data.permissions.canTradeControl || !selected || query.action.isPending} onClick={sendTestOrder}><Send className="h-4 w-4" />Send Test Order</Button>
            {actions.map(({ label, icon: Icon, path, allowed, reissue }) => (
              <Button
                key={label}
                variant="outline"
                disabled={!allowed || query.action.isPending}
                onClick={() => (reissue && selected ? reissuePairing(selected.id, label) : command(label, path))}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            ))}
            <Button variant="destructive" disabled={!data.permissions.canEmergencyDisable} onClick={() => command("Disable all EA trading channels", "/api/mt5/ea-bridge/trading/emergency-disable")}><PowerOff className="h-4 w-4" />Disable EA Trading Channel</Button>
          </div>
          <div className="sm:hidden"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline"><Menu className="h-4 w-4" />Actions</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => query.refetch()}>Refresh Bridge</DropdownMenuItem>{actions.map((action) => <DropdownMenuItem key={action.label} disabled={!action.allowed} onSelect={() => (action.reissue && selected ? reissuePairing(selected.id, action.label) : command(action.label, action.path))}>{action.label}</DropdownMenuItem>)}<DropdownMenuItem disabled={!data.permissions.canEmergencyDisable} className="text-red-700" onSelect={() => command("Disable all EA trading channels", "/api/mt5/ea-bridge/trading/emergency-disable")}>Disable EA Trading Channel</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
        </div>
        {notice ? <p className="border-t border-slate-100 px-5 py-2.5 text-xs font-semibold text-blue-700">{notice}</p> : null}
      </section>

      {pairingReceipt ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-slate-950">One-Time EA Pairing Receipt: {pairingReceipt.eaInstanceId}</p>
            <Badge variant="warning">{pairingReceipt.state}</Badge>
          </div>
          <p className="mt-2 text-amber-800">
            Terminal <span className="font-mono">{pairingReceipt.terminalName}</span> / account{" "}
            <span className="font-mono">{pairingReceipt.accountLogin}</span> — copy these into NexusBridgeEA inputs now. They cannot be viewed again after you leave this page.
          </p>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            <p className="rounded-lg bg-white p-3"><strong>NexusBaseUrl</strong><br /><span className="break-all font-mono">{pairingReceipt.nexusBaseUrl}</span></p>
            <p className="rounded-lg bg-white p-3"><strong>EaInstanceId</strong><br /><span className="break-all font-mono">{pairingReceipt.eaInstanceId}</span></p>
            <p className="rounded-lg bg-white p-3"><strong>IngestionToken</strong><br /><span className="break-all font-mono">{pairingReceipt.ingestionToken}</span></p>
            <p className="rounded-lg bg-white p-3"><strong>SigningSecret</strong><br /><span className="break-all font-mono">{pairingReceipt.signingSecret}</span></p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={query.action.isPending}
              onClick={() => testPairing(pairingReceipt)}
            >
              Retest Pairing
            </Button>
            <Button variant="outline" disabled={query.action.isPending} onClick={() => copyPairingReceipt(pairingReceipt)}>
              Copy Receipt
            </Button>
            {pairingTestResult ? (
              <Badge variant={pairingTestResult.accepted ? "success" : "destructive"}>
                {pairingTestResult.accepted ? "Backend accepted heartbeat" : pairingTestResult.code ?? "failed"}
              </Badge>
            ) : null}
          </div>
          {pairingTestResult?.diagnostics ? (
            <div className="mt-3 rounded-lg bg-white p-3 font-mono text-[11px] text-slate-700">
              <p>endpoint: {pairingTestResult.diagnostics.endpoint}</p>
              <p>matched instance: {pairingTestResult.diagnostics.matchedEaInstanceId ?? "none"}</p>
              <p>account: {pairingTestResult.diagnostics.accountNumber ?? "none"} | broker: {pairingTestResult.diagnostics.broker ?? "none"}</p>
              <p>submitted token: len={pairingTestResult.diagnostics.received?.length ?? 0} prefix={pairingTestResult.diagnostics.received?.prefix ?? ""} suffix={pairingTestResult.diagnostics.received?.suffix ?? ""}</p>
              <p>active pairing token: len={pairingTestResult.diagnostics.expected?.length ?? 0} prefix={pairingTestResult.diagnostics.expected?.prefix ?? ""} suffix={pairingTestResult.diagnostics.expected?.suffix ?? ""}{pairingTestResult.accepted &&
                pairingTestResult.diagnostics.received?.prefix === pairingTestResult.diagnostics.expected?.prefix &&
                pairingTestResult.diagnostics.received?.suffix === pairingTestResult.diagnostics.expected?.suffix
                ? " ✓ match"
                : ""}</p>
              {pairingTestResult.accepted ? (
                <p className="mt-2 text-emerald-700">Paste this receipt into MT5. Experts log should show the same prefix/suffix after attach.</p>
              ) : (
                <p className="mt-2 text-red-700">
                  Credentials do not match the active server pairing. Use Reissue EA Pairing on this page — not Control Center onboarding receipts — then Test Pairing before MT5.
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {data.kpis.map((kpi) => <Card key={kpi.label} className={cn("border-t-4", statusBorder[kpi.status])}><CardContent className="p-3.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p><p className="mt-2 text-xl font-semibold">{kpi.value}</p><p className="mt-1 truncate text-[11px] text-slate-500">{kpi.detail}</p></CardContent></Card>)}
      </section>

      <section className="grid gap-3 xl:grid-cols-3" aria-label="Terminal connection readiness">
        <Card className="border-t-4 border-t-blue-500">
          <Title icon={Cable} title="Connect An MT5 Terminal" description="Terminal-side installation and pairing sequence." />
          <CardContent className="space-y-2 text-xs text-slate-600">
            <p><strong className="text-slate-900">1.</strong> Compile and attach <span className="font-mono text-blue-700">Experts/NexusBridgeEA/NexusBridgeEA</span> inside the logged-in MT5 terminal.</p>
            <p><strong className="text-slate-900">2.</strong> Allow the Nexus HTTPS origin in MT5 WebRequest settings.</p>
            <p><strong className="text-slate-900">3.</strong> Pair the EA instance ID, ingestion token, and signing secret. Lost the receipt? Use <strong>Reissue EA Pairing</strong> on this page.</p>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-emerald-500">
          <Title icon={ShieldCheck} title="Signed Connector Contract" description="Telemetry becomes live only after verification." />
          <CardContent className="space-y-2 text-xs text-slate-600">
            <p><span className="font-mono text-slate-900">POST /ingest/heartbeat</span> reports terminal and broker connectivity.</p>
            <p><span className="font-mono text-slate-900">POST /ingest/account-snapshot</span> feeds Account Sync reconciliation.</p>
            <p>HMAC signature, 60-second timestamp window, nonce replay protection, and account binding are enforced.</p>
          </CardContent>
        </Card>
        <Card className="border-t-4 border-t-purple-500">
          <Title icon={KeyRound} title="Execution Safety Gate" description="Approved commands are isolated from terminal telemetry." />
          <CardContent className="space-y-2 text-xs text-slate-600">
            <p>The EA must sign its command poll before Nexus reveals any approved pending instruction.</p>
            <p>Execution acknowledgements are signed and audit-logged.</p>
            <p className="font-medium text-purple-800">The supplied connector keeps order execution disabled until a certified risk-controlled execution module is installed.</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <Title icon={Workflow} title="EA Communication Workflow" description="Validated bridge delivery pipeline from EA ingestion to immutable audit output." />
        <CardContent className="overflow-x-auto"><div className="flex min-w-[1620px] gap-2">{data.workflow.map((node, index) => <Fragment key={node.title}><div className="min-h-36 flex-1 rounded-xl border border-slate-200 p-3"><Status value={node.status} /><p className="mt-3 text-sm font-semibold">{node.title}</p><div className="mt-2 grid grid-cols-2 text-[11px] text-slate-500"><span>Current {node.currentCount}</span><span>Failed {node.failureCount}</span><span>{node.averageDelayMs}ms</span><span>{time(node.lastEventAt)}</span></div>{node.aiRecommendation ? <p className="mt-2 text-xs text-purple-700">AI: {node.aiRecommendation}</p> : null}</div>{index < data.workflow.length - 1 ? <ChevronRight className="mt-14 h-4 w-4 shrink-0 text-slate-300" /> : null}</Fragment>)}</div></CardContent>
      </Card>

      <Card>
        <Title icon={Cable} title="EA Instance Registry" description="Search, assess, and control authenticated EA-to-terminal bindings." />
        <CardContent>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:justify-between"><label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm sm:w-80"><Search className="h-4 w-4 text-slate-400" /><input aria-label="Search EA instances" className="w-full outline-none" placeholder="Search EA, terminal, broker..." value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs text-slate-600">Sort<select aria-label="Sort EA instances" className="h-9 bg-white outline-none" value={sort} onChange={(event) => setSort(event.target.value)}><option value="risk">Risk</option><option value="latency">Latency</option><option value="messages">Messages</option></select></label></div>
          <div className="overflow-x-auto"><table aria-label="EA instance registry" className="w-full min-w-[1720px] text-left text-xs"><thead className="border-y border-slate-100 bg-slate-50"><tr>{["EA Instance", "Terminal", "Broker / Account", "Symbols", "Version / Build", "Token", "Connection", "Heartbeat", "Last Heartbeat", "Messages", "Failed", "Latency", "Trading Channel", "Last Error", "Risk", "Actions"].map((head) => <th key={head} className="px-3 py-3 font-semibold uppercase text-slate-500">{head}</th>)}</tr></thead><tbody>{instances.length ? instances.map((instance) => <tr key={instance.id} className={cn("border-b border-slate-100", selected?.id === instance.id && "bg-blue-50/30")} onClick={() => { setSelectedId(instance.id); setExpandedId(instance.id); }}><td className="px-3 py-3 font-semibold">{instance.eaName}<p className="font-normal text-slate-500">{instance.id}</p></td><td className="px-3 py-3">{instance.terminalName}</td><td className="px-3 py-3">{instance.brokerName}<p className="text-slate-500">{instance.accountLogin}</p></td><td className="px-3 py-3">{instance.symbolScope.join(", ")}</td><td className="px-3 py-3">{instance.eaVersion}<p className="text-slate-500">Build {instance.buildNumber}</p></td><td className="px-3 py-3">{instance.tokenStatus}<p className="text-purple-700">{classifyTokenRisk(instance)} risk</p></td><td className="px-3 py-3"><Status value={instance.connectionStatus} /></td><td className="px-3 py-3"><Status value={instance.heartbeatStatus} /></td><td className="px-3 py-3">{time(instance.lastHeartbeatAt)}</td><td className="px-3 py-3">{instance.messageCount.toLocaleString()}</td><td className="px-3 py-3">{instance.failedMessageCount}</td><td className="px-3 py-3">{instance.averageLatencyMs}ms</td><td className="px-3 py-3"><Badge variant={instance.tradingChannelEnabled ? "success" : "destructive"}>{instance.tradingChannelEnabled ? "Enabled" : "Disabled"}</Badge></td><td className="max-w-48 truncate px-3 py-3 text-red-700">{instance.lastError ?? "None"}</td><td className="px-3 py-3"><Status value={instance.riskLevel} /></td><td className="px-3 py-3" onClick={(event) => event.stopPropagation()}><DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline">Actions</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setSelectedId(instance.id)}>View Details</DropdownMenuItem><DropdownMenuItem disabled={!data.permissions.canDiagnostics} onSelect={() => command("Run diagnostics", `/api/mt5/ea-bridge/instances/${instance.id}/diagnostics`)}>Run Diagnostics</DropdownMenuItem><DropdownMenuItem disabled={!data.permissions.canRestart} onSelect={() => command("Restart bridge session", `/api/mt5/ea-bridge/instances/${instance.id}/restart`)}>Restart Bridge Session</DropdownMenuItem><DropdownMenuItem disabled={!data.permissions.canTradeControl || !instance.tradingChannelEnabled} onSelect={() => command("Disable trading channel", `/api/mt5/ea-bridge/instances/${instance.id}/disable-trading-channel`)}>Disable Trading Channel</DropdownMenuItem><DropdownMenuItem disabled={!data.permissions.canTradeControl || instance.tradingChannelEnabled} onSelect={() => command("Enable trading channel", `/api/mt5/ea-bridge/instances/${instance.id}/enable-trading-channel`)}>Enable Trading Channel</DropdownMenuItem><DropdownMenuItem disabled={!data.permissions.canRotateToken} onSelect={() => command("Rotate token", `/api/mt5/ea-bridge/instances/${instance.id}/rotate-token`)}>Rotate Token</DropdownMenuItem><DropdownMenuItem disabled={!data.permissions.canReissuePairing} onSelect={() => reissuePairing(instance.id, "Reissue EA pairing")}>Reissue EA Pairing</DropdownMenuItem><DropdownMenuItem onSelect={() => setExpandedId(instance.id)}>View Logs</DropdownMenuItem><DropdownMenuItem disabled={!data.permissions.canRebindTerminal} onSelect={() => command("Rebind terminal", `/api/mt5/ea-bridge/instances/${instance.id}/rebind-terminal`, { terminalName: instance.terminalName })}>Rebind Terminal</DropdownMenuItem></DropdownMenuContent></DropdownMenu></td></tr>) : <tr><td colSpan={16} className="px-3 py-8 text-center text-sm text-slate-500">No EA bridge instances registered. Complete MT5 terminal onboarding and attach NexusBridgeEA to begin signed telemetry.</td></tr>}</tbody></table></div>
          {expandedId && expanded ? <div className="mt-4 grid gap-3 rounded-xl border border-blue-100 bg-blue-50/30 p-4 md:grid-cols-4"><div><p className="text-xs font-semibold uppercase text-slate-500">Token Controls</p><p className="mt-2 text-xs">{expanded.tokenStatus}</p><p className="text-[11px] text-slate-500">Stored credential hash is never exposed in monitoring responses.</p>{data.activePairing?.[expanded.id]?.ingestionToken ? <p className="mt-2 font-mono text-[11px] text-slate-700">Active token: {data.activePairing[expanded.id].ingestionToken?.prefix}…{data.activePairing[expanded.id].ingestionToken?.suffix} (len {data.activePairing[expanded.id].ingestionToken?.length})</p> : null}{data.activePairing?.[expanded.id]?.signingSecret ? <p className="font-mono text-[11px] text-slate-700">Active secret: {data.activePairing[expanded.id].signingSecret?.prefix}…{data.activePairing[expanded.id].signingSecret?.suffix} (len {data.activePairing[expanded.id].signingSecret?.length})</p> : null}</div><div><p className="text-xs font-semibold uppercase text-slate-500">Identity Security</p><p className="mt-2 text-xs">IP: {expanded.currentIpAddress}</p><p className="text-xs">Fingerprint: {expanded.knownDeviceFingerprint ? "Trusted" : "Unknown"}</p></div><div><p className="text-xs font-semibold uppercase text-slate-500">Channel Health</p><p className="mt-2 text-xs">Token risk: {classifyTokenRisk(expanded)}</p><p className="text-xs">Auth failures: {expanded.failedAuthenticationAttempts}</p></div><div><p className="text-xs font-semibold uppercase text-purple-700">AI Recommendation</p><p className="mt-2 text-xs text-purple-800">{data.diagnostics.find((item) => item.eaInstanceId === expanded.id)?.recommendation ?? "Maintain monitoring."}</p></div></div> : null}
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card><Title icon={Server} title="Bridge Session Monitor" description="Connected and rejected bridge sessions by protocol and auth status." /><CardContent className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-xs"><thead className="border-y border-slate-100 bg-slate-50"><tr>{["Session", "EA / Terminal", "Broker / Account", "IP / Protocol", "Started", "Last Message", "Duration", "Auth", "Rate", "Latency", "Status"].map((head) => <th key={head} className="px-2 py-3 uppercase text-slate-500">{head}</th>)}</tr></thead><tbody>{data.sessions.map((session) => <tr key={session.id} className="border-b border-slate-100"><td className="px-2 py-3">{session.sessionUuid}</td><td className="px-2 py-3 font-semibold">{session.eaInstanceName}<p className="font-normal text-slate-500">{session.terminalName}</p></td><td className="px-2 py-3">{session.brokerName}<p>{session.accountLogin}</p></td><td className="px-2 py-3">{session.ipAddress}<p>{session.protocol}</p></td><td className="px-2 py-3">{time(session.connectionStartedAt)}</td><td className="px-2 py-3">{time(session.lastMessageAt)}</td><td className="px-2 py-3">{duration(session.sessionDurationSeconds)}</td><td className="px-2 py-3">{session.authStatus}</td><td className="px-2 py-3">{session.messageRatePerMinute}/min</td><td className="px-2 py-3">{session.latencyMs}ms</td><td className="px-2 py-3"><Status value={session.status} /></td></tr>)}</tbody></table></CardContent></Card>
        <Card><Title icon={Send} title="Delivery Reliability" description="Message delivery, retries, duplicate protection, and processing latency." /><CardContent><div className="grid grid-cols-3 gap-2">{[["Reliability", `${delivery.reliability}%`], ["Delivered", String(delivery.delivered)], ["Failed", String(delivery.failed)], ["Retries", String(delivery.retries)], ["Duplicates", String(delivery.duplicateCount)], ["Schema Errors", String(delivery.schemaErrors)]].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3 text-center"><p className="text-[10px] uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}</div><div className="mt-5 h-44"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.sessions}><XAxis dataKey="eaInstanceName" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><ChartTooltip /><Bar dataKey="messageRatePerMinute" fill="#2563eb" name="Messages/min" /></BarChart></ResponsiveContainer></div><div className="mt-3 space-y-3"><Metric label="Delivery reliability" value={delivery.reliability} tone="bg-emerald-600" /><Metric label="Bridge health score" value={data.bridgeHealth.score} tone="bg-purple-600" /></div></CardContent></Card>
      </section>

      <Card>
        <Title icon={Send} title="Message Queue & Delivery Monitor" description="Signed bridge payloads, schema enforcement, retry handling, and failure reasons." />
        <CardContent className="overflow-x-auto"><table className="w-full min-w-[1220px] text-left text-xs"><thead className="border-y border-slate-100 bg-slate-50"><tr>{["Message ID", "Type", "Source EA", "Destination", "Status", "Schema / Signature", "Retry", "Created", "Delivered", "Processing", "Failure Reason"].map((head) => <th key={head} className="px-3 py-3 uppercase text-slate-500">{head}</th>)}</tr></thead><tbody>{data.messages.map((message) => <tr key={message.id} className="border-b border-slate-100"><td className="px-3 py-3">{message.messageUuid}</td><td className="px-3 py-3 font-semibold">{message.messageType}</td><td className="px-3 py-3">{message.source}</td><td className="px-3 py-3">{message.destination}</td><td className="px-3 py-3"><Badge variant={message.status === "Delivered" ? "success" : message.status === "Retrying" ? "warning" : "destructive"}>{message.status}</Badge></td><td className="px-3 py-3">{message.schemaVersion} / {message.signed ? "Signed" : "Invalid"}</td><td className="px-3 py-3">{message.retryCount}</td><td className="px-3 py-3">{time(message.createdAt)}</td><td className="px-3 py-3">{message.deliveredAt ? time(message.deliveredAt) : "-"}</td><td className="px-3 py-3">{message.processingTimeMs}ms</td><td className="px-3 py-3 text-red-700">{message.failureReason ?? "None"}</td></tr>)}</tbody></table></CardContent>
      </Card>

      <Card>
        <Title icon={ShieldCheck} title="Trade Command Channel" description="Risk-approved signal lifecycle from Nexus routing to MT5 feedback and audit." />
        <CardContent>
          <div className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">{commandStages.map((step, index) => <div key={step.label} className="rounded-xl border border-slate-200 p-3"><Status value={step.status} /><p className="mt-2 text-xs font-semibold">{index + 1}. {step.label}</p><p className="mt-1 text-[11px] text-slate-500">{step.detail}</p></div>)}</div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1400px] text-left text-xs"><thead className="border-y border-slate-100 bg-slate-50"><tr>{["Command ID", "EA Instance", "Account", "Symbol", "Type / Direction", "Volume", "Requested Price", "Risk Approval", "Delivery", "Execution", "Response", "Rejection Reason", "Created"].map((head) => <th key={head} className="px-3 py-3 uppercase text-slate-500">{head}</th>)}</tr></thead><tbody>{data.commands.map((command) => <tr key={command.id} className="border-b border-slate-100"><td className="px-3 py-3">{command.commandUuid}</td><td className="px-3 py-3">{command.eaInstanceId}</td><td className="px-3 py-3">{command.accountLogin}</td><td className="px-3 py-3 font-semibold">{command.symbol}</td><td className="px-3 py-3">{command.commandType} / {command.direction}</td><td className="px-3 py-3">{command.volume}</td><td className="px-3 py-3">{command.requestedPrice}</td><td className="px-3 py-3">{command.riskApprovalStatus}</td><td className="px-3 py-3">{command.deliveryStatus}</td><td className="px-3 py-3">{command.executionStatus}</td><td className="px-3 py-3">{command.responseTimeMs}ms</td><td className="px-3 py-3 text-red-700">{command.rejectionReason ?? "None"}</td><td className="px-3 py-3">{time(command.createdAt)}</td></tr>)}</tbody></table></div>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card><Title icon={AlertTriangle} title="Bridge Logs & Errors" description="Authentication, token, payload, delivery, broker, and risk enforcement events." /><CardContent><div className="mb-3 flex flex-wrap gap-2">{["All", "Critical", "Authentication", "Token", "Schema", "Timeout", "Duplicate", "Connection", "Broker", "Risk"].map((filter) => <button key={filter} className={cn("rounded-full border px-3 py-1 text-xs", logFilter === filter ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600")} onClick={() => setLogFilter(filter)}>{filter}</button>)}</div><div className="space-y-2">{logs.map((log) => <div key={log.id} className="rounded-xl border border-slate-100 p-3"><div className="flex justify-between gap-2"><p className="text-sm font-semibold">{log.message}</p><Severity value={log.severity} /></div><p className="mt-1 text-xs text-slate-600">{log.eaInstanceName} / {log.terminalName} / {log.accountLogin}</p><p className="mt-2 text-[11px] text-slate-500">{time(log.createdAt)} | {log.logType} | {log.technicalDetails}</p></div>)}</div></CardContent></Card>
        <Card><Title icon={Bot} title="AI Bridge Diagnostics" description="Autonomous security and delivery analysis with controlled recovery." /><CardContent className="space-y-3">{data.diagnostics.map((diagnostic) => <div key={diagnostic.id} className="rounded-xl border border-purple-100 bg-purple-50/40 p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{diagnostic.issue}</p><Severity value={diagnostic.severity} /></div><p className="mt-1 text-xs text-slate-500">{diagnostic.affectedComponent}</p><div className="mt-3 grid gap-2 text-xs md:grid-cols-2"><p><strong>Root cause:</strong> {diagnostic.rootCause}</p><p><strong>Impact:</strong> {diagnostic.businessImpact}</p></div><p className="mt-3 text-xs font-medium text-purple-800"><strong>Recommendation:</strong> {diagnostic.recommendation}</p><div className="mt-3 flex flex-wrap items-center gap-2"><Badge variant="purple">Confidence {Math.round(diagnostic.confidenceScore * 100)}%</Badge><Badge variant={diagnostic.autoFixEligible ? "default" : "secondary"}>{diagnostic.autoFixStatus}</Badge>{diagnostic.escalationRequired ? <Badge variant="destructive">Escalation required</Badge> : null}<Button size="sm" disabled={!data.permissions.canAutoRemediate || !diagnostic.autoFixEligible} onClick={() => command("EA bridge auto-remediation", "/api/mt5/ea-bridge/auto-remediate", { diagnosticId: diagnostic.id })}>Trigger Safe Recovery</Button></div></div>)}</CardContent></Card>
      </section>
    </div>
  );
}
