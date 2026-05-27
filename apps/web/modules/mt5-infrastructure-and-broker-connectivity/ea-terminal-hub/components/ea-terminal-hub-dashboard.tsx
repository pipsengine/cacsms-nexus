"use client";

import * as React from "react";
import {
  Activity,
  Cable,
  ClipboardList,
  FolderSync,
  Link2,
  Monitor,
  Plug,
  PlugZap,
  RefreshCw,
  Search,
  Send,
  Server,
  ShieldCheck,
  Unplug
} from "lucide-react";

import type { Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";
import { checklistTone, driftTone } from "../algorithms/ea-terminal-hub.algorithms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useEaTerminalHub } from "../hooks/use-ea-terminal-hub";
import { useEaTerminalHubStore } from "../stores/ea-terminal-hub.store";
import type { Mt5TerminalLink, SyncPreviewItem } from "../types/ea-terminal-hub.types";

const roles: Mt5Role[] = ["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager", "Analyst", "Read-Only Viewer"];

function toneVariant(value: string) {
  const v = value.toLowerCase();
  if (v.includes("connected") || v.includes("linked") || v.includes("healthy") || v.includes("synced") || v.includes("complete")) return "success" as const;
  if (v.includes("drift") || v.includes("watch") || v.includes("connecting") || v.includes("attention") || v.includes("pending")) return "warning" as const;
  if (v.includes("critical") || v.includes("error") || v.includes("missing") || v.includes("offline") || v.includes("blocked")) return "destructive" as const;
  return "secondary" as const;
}

function time(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function EaTerminalHubDashboard() {
  const ui = useEaTerminalHubStore();
  const { data, isLoading, isError, error, streamConnected, action, refetch } = useEaTerminalHub();
  const [notice, setNotice] = React.useState<string | null>(null);
  const [sendingTestOrder, setSendingTestOrder] = React.useState(false);
  const [syncPreview, setSyncPreview] = React.useState<SyncPreviewItem[]>([]);
  const [registerDraft, setRegisterDraft] = React.useState({
    terminalName: "",
    terminalExecutablePath: "C:\\Program Files\\MetaTrader 5 IC Markets Global\\terminal64.exe",
    mt5DataPath: "",
    brokerName: "",
    accountLogin: "",
    hostMachine: "LOCAL",
    region: "Local"
  });

  React.useEffect(() => {
    void refetch();
  }, [ui.role, refetch]);

  const terminals = React.useMemo(() => {
    const rows = data?.terminals ?? [];
    const term = ui.searchTerm.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (row) =>
        row.terminalName.toLowerCase().includes(term) ||
        row.brokerName.toLowerCase().includes(term) ||
        row.accountLogin.includes(term) ||
        row.hostMachine.toLowerCase().includes(term) ||
        (row.eaInstanceId ?? "").toLowerCase().includes(term)
    );
  }, [data?.terminals, ui.searchTerm]);

  const activeTerminal = terminals.find((t) => t.terminalId === data?.summary.activeTerminalId) ?? terminals.find((t) => t.isActive);
  const selectedTerminals = terminals.filter((terminal) => ui.selectedTerminalIds.includes(terminal.terminalId));
  const targetTerminal =
    selectedTerminals.length === 1
      ? selectedTerminals[0]
      : selectedTerminals.find((terminal) => terminal.eaInstanceId) ?? activeTerminal ?? terminals.find((terminal) => terminal.eaInstanceId);
  const permissions = data?.permissions;
  const canSendTestOrder = Boolean(permissions?.canSendTestOrder && targetTerminal?.eaInstanceId);

  async function sendTestOrder(terminalId?: string) {
    const terminal =
      (terminalId ? terminals.find((row) => row.terminalId === terminalId) : undefined) ?? targetTerminal ?? terminals[0];
    if (!terminal) {
      setNotice("Select a terminal in the table below before sending a test order.");
      return;
    }
    if (!terminal.eaInstanceId) {
      setNotice(
        `${terminal.terminalName} has no EA Bridge instance yet. Complete EA pairing on EA Bridge, attach NexusBridgeEA, and wait for a healthy heartbeat.`
      );
      return;
    }
    const defaultSymbol = "EURUSD";
    const symbol = window.prompt("Symbol (must exist in MT5 Market Watch):", defaultSymbol)?.trim() ?? "";
    if (!symbol) return;
    const volumeRaw = window.prompt("Lot size (volume):", "0.01")?.trim() ?? "";
    const volume = Number.parseFloat(volumeRaw);
    if (!Number.isFinite(volume) || volume <= 0) {
      setNotice("Invalid volume.");
      return;
    }
    if (
      !window.confirm(
        `Send a test market order to ${terminal.terminalName}? The EA executes only when PollApprovedCommands and EnableCommandExecution are enabled in NexusBridgeEA inputs.`
      )
    ) {
      return;
    }
    setNotice(null);
    setSendingTestOrder(true);
    try {
      const result = await action.mutateAsync({
        path: "send-test-order",
        body: { confirmed: true, terminalId: terminal.terminalId, symbol, volume, direction: "Buy" }
      });
      setNotice(
        result.commandUuid
          ? `${result.message ?? "Test order queued."} Check EA Bridge → trade commands, or MT5 Experts log within ~5s.`
          : result.message ?? "Test order queued."
      );
      void refetch();
    } catch (commandError) {
      setNotice(commandError instanceof Error ? commandError.message : "Failed to send test order.");
    } finally {
      setSendingTestOrder(false);
    }
  }

  async function command(label: string, path: string, body?: Record<string, unknown>) {
    if (!window.confirm(`Confirm ${label.toLowerCase()}? This action will be audit-logged.`)) return;
    setNotice(null);
    setSyncPreview([]);
    try {
      const result = await action.mutateAsync({ path, body: { confirmed: true, ...body } });
      if (result.preview?.length) setSyncPreview(result.preview);
      setNotice(result.message ?? `${label} completed.`);
    } catch (commandError) {
      setNotice(commandError instanceof Error ? commandError.message : "EA terminal hub action failed.");
    }
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        <Card className="border-red-200 p-6">
          <h1 className="text-xl font-semibold text-slate-950">EA & Terminal Hub unavailable</h1>
          <p className="mt-2 text-sm text-red-700">{(error as Error).message}</p>
          <Button className="mt-4" onClick={() => refetch()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return <div className="mx-auto max-w-[1600px] px-4 py-6 text-sm text-slate-600">Loading EA & Terminal Hub…</div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="sticky top-14 z-20 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-card backdrop-blur sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">MT5 Infrastructure & Broker Connectivity</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold text-slate-950">EA & Terminal Hub</h1>
              <Badge variant={streamConnected ? "success" : "warning"}>
                <Activity className="mr-1 h-3 w-3" />
                {streamConnected ? "Live stream" : "Polling"}
              </Badge>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              Link the canonical Cacsms EA folder to each MT5 terminal Experts directory, reconcile drift with content hashes, and manage multi-terminal bridge connectivity from one control surface.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Role: {permissions?.role ?? ui.role} | Last update: {time(data.meta.timestamp)} | Target:{" "}
              {targetTerminal?.terminalName ?? "Select a terminal below"}
              {targetTerminal?.eaInstanceId ? ` · EA ${targetTerminal.eaInstanceId}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Operator role"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={ui.role}
              onChange={(event) => ui.setRole(event.target.value as Mt5Role)}
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" disabled={!permissions?.canScan || action.isPending} onClick={() => command("Scan folders", "scan")}>
              <RefreshCw className={cn("mr-2 h-4 w-4", action.isPending && "animate-spin")} />
              Scan folders
            </Button>
            <Button
              size="sm"
              disabled={!canSendTestOrder || sendingTestOrder}
              onClick={() => sendTestOrder(targetTerminal?.terminalId)}
              title={
                canSendTestOrder
                  ? `Queue a test order for ${targetTerminal?.terminalName}`
                  : "Select one terminal with a linked EA Bridge instance (checkbox in the table)"
              }
            >
              <Send className={cn("mr-2 h-4 w-4", sendingTestOrder && "animate-pulse")} />
              {sendingTestOrder ? "Sending…" : "Send test order"}
            </Button>
          </div>
        </div>
        {notice ? <p className="mt-4 border-t border-slate-100 pt-3 text-xs font-semibold text-teal-800">{notice}</p> : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["Bridge connected", data.summary.connectedTerminals],
          ["Managed", data.summary.managedTerminals],
          ["Linked folders", data.summary.linkedTerminals],
          ["Drifted", data.summary.driftedTerminals],
          ["Link health", `${data.summary.linkHealthScore}%`],
          ["System EA files", data.summary.systemFolder.fileCount]
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Server className="h-5 w-5 text-teal-700" />
              Cacsms system EA folder
            </CardTitle>
            <CardDescription>Canonical Experts and Include source used by Nexus (`services/cacsms-ea`).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 font-mono text-xs text-slate-700">{data.summary.cacsmsEaRoot}</div>
            <p className="text-slate-600">
              Experts path: <span className="font-mono text-xs">{data.summary.systemFolder.expertsPath}</span>
            </p>
            {data.summary.systemFolder.includePath ? (
              <p className="text-slate-600">
                Include path: <span className="font-mono text-xs">{data.summary.systemFolder.includePath}</span>
              </p>
            ) : null}
            <p className="text-slate-600">
              Last scan: {data.summary.systemFolder.lastScannedAt ? new Date(data.summary.systemFolder.lastScannedAt).toLocaleString() : "—"}
            </p>
            <ScrollArea className="h-44 rounded-xl border border-slate-100">
              <ul className="divide-y divide-slate-100 p-2 text-xs">
                {(data.summary.systemFolder.files ?? []).slice(0, 40).map((file) => (
                  <li key={file.relativePath} className="flex justify-between gap-2 py-2">
                    <span className="font-mono">{file.relativePath}</span>
                    <span className="text-slate-500">{file.sizeBytes} B</span>
                  </li>
                ))}
                {!data.summary.systemFolder.files?.length ? (
                  <li className="py-3 text-slate-500">No EA artifacts detected yet. NexusBridgeEA folder is bootstrapped automatically when available in the repo.</li>
                ) : null}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FolderSync className="h-5 w-5 text-teal-700" />
              Workflow & install checklist
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {data.workflow.map((step) => (
                <div key={step.step} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{step.step}</p>
                    <p className="text-slate-600">{step.detail}</p>
                  </div>
                  <Badge variant={toneVariant(step.status)}>{step.status}</Badge>
                </div>
              ))}
            </div>
            <Separator />
            <p className="rounded-lg border border-teal-100 bg-teal-50/60 p-3 text-xs leading-6 text-teal-900">
              <strong>Test orders</strong> only need a live EA Bridge heartbeat (step 4). They do not require operator-managed terminals or linked Experts folders.
              To deploy EA files, use <strong>Manage</strong> then <strong>Link EA</strong> with your MT5 AppData path.
              After queuing an order, confirm in MT5 that <strong>PollApprovedCommands</strong> and <strong>EnableCommandExecution</strong> are enabled on NexusBridgeEA.
            </p>
            <div className="space-y-2">
              {data.installChecklist.map((item) => (
                <div key={item.step} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{item.step}</p>
                    <p className="text-slate-600">{item.detail}</p>
                  </div>
                  <Badge variant={checklistTone(item.status)}>{item.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Monitor className="h-5 w-5 text-teal-700" />
                Multi-terminal connections
              </CardTitle>
              <CardDescription>Bridge connectivity is derived from live EA heartbeats. Hub management controls folder linking and sync scope.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  aria-label="Search terminals"
                  className="rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
                  placeholder="Search terminal, broker, EA instance…"
                  value={ui.searchTerm}
                  onChange={(event) => ui.setSearchTerm(event.target.value)}
                />
              </div>
              <Button
                size="sm"
                disabled={!canSendTestOrder || sendingTestOrder}
                onClick={() => sendTestOrder(targetTerminal?.terminalId)}
              >
                <Send className={cn("mr-2 h-4 w-4", sendingTestOrder && "animate-pulse")} />
                {sendingTestOrder ? "Sending…" : "Send test order"}
              </Button>
              <Button
                size="sm"
                disabled={!permissions?.canConnect || !ui.selectedTerminalIds.length || action.isPending}
                onClick={() => command("Connect selected terminals", "connect", { terminalIds: ui.selectedTerminalIds, autoLink: false })}
              >
                <PlugZap className="mr-2 h-4 w-4" />
                Manage selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!permissions?.canDisconnect || !ui.selectedTerminalIds.length || action.isPending}
                onClick={() => command("Remove selected from hub management", "disconnect", { terminalIds: ui.selectedTerminalIds })}
              >
                <Unplug className="mr-2 h-4 w-4" />
                Unmanage
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!permissions?.canSyncAll || action.isPending}
                onClick={() => command("Sync all managed terminals", "sync-all")}
              >
                <Link2 className="mr-2 h-4 w-4" />
                Sync managed
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-xs">
            <thead className="border-y border-slate-100 bg-slate-50">
              <tr>
                {["", "Terminal", "Broker / Account", "Bridge", "EA link", "Managed", "MT5 Experts path", "Actions"].map((head) => (
                  <th key={head} className="px-3 py-3 font-semibold uppercase text-slate-500">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {terminals.map((terminal) => (
                <TerminalRow
                  key={terminal.terminalId}
                  terminal={terminal}
                  selected={ui.selectedTerminalIds.includes(terminal.terminalId)}
                  permissions={permissions}
                  isActive={terminal.terminalId === data.summary.activeTerminalId}
                  isPending={action.isPending}
                  sendingTestOrder={sendingTestOrder}
                  onToggle={() => ui.toggleTerminalSelection(terminal.terminalId)}
                  onActivate={() => command("Set active terminal", "set-active", { terminalId: terminal.terminalId })}
                  onConnect={() => command(`Manage ${terminal.terminalName}`, "connect", { terminalIds: [terminal.terminalId], autoLink: false })}
                  onLink={() => {
                    const dataPath = window.prompt(
                      "MT5 data folder from File → Open Data Folder in MetaTrader (required for broker installs in Program Files).",
                      terminal.mt5DataPath ?? ""
                    );
                    if (dataPath === null) return;
                    void command(`Link EA folder for ${terminal.terminalName}`, "link", {
                      terminalId: terminal.terminalId,
                      ...(dataPath.trim() ? { mt5DataPath: dataPath.trim() } : {})
                    });
                  }}
                  onPreview={() => command(`Preview sync for ${terminal.terminalName}`, "preview-sync", { terminalId: terminal.terminalId })}
                  onToggleAutoLink={(enabled) => command(`Update auto-link for ${terminal.terminalName}`, "toggle-auto-link", { terminalId: terminal.terminalId, enabled })}
                  onSendTestOrder={() => sendTestOrder(terminal.terminalId)}
                />
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {activeTerminal ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Cable className="h-5 w-5 text-teal-700" />
              Active terminal — {activeTerminal.terminalName}
            </CardTitle>
            <CardDescription>Folder drift between canonical Cacsms EA artifacts and this terminal&apos;s MT5 directories.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold">MT5 Experts:</span> <span className="font-mono text-xs">{activeTerminal.mt5ExpertsPath}</span>
              </p>
              <p>
                <span className="font-semibold">MT5 Include:</span> <span className="font-mono text-xs">{activeTerminal.mt5IncludePath}</span>
              </p>
              <p>
                <span className="font-semibold">EA instance:</span> {activeTerminal.eaInstanceId ?? "Not provisioned"}
              </p>
              <p>
                <span className="font-semibold">Bridge heartbeat:</span> {activeTerminal.bridgeHeartbeatStatus ?? "No live heartbeat"}
              </p>
              <p>
                <span className="font-semibold">Drift items:</span> {activeTerminal.driftFileCount}
              </p>
            </div>
            <ScrollArea className="h-52 rounded-xl border border-slate-100">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {["File", "Status"].map((head) => (
                      <th key={head} className="px-3 py-2 text-left font-semibold uppercase text-slate-500">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.drift ?? []).map((item) => (
                    <tr key={item.relativePath} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-mono">{item.relativePath}</td>
                      <td className="px-3 py-2">
                        <Badge variant={driftTone(item.status)}>{item.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : null}

      {syncPreview.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="h-5 w-5 text-teal-700" />
              Sync preview
            </CardTitle>
            <CardDescription>Projected artifact changes before the next link operation.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100 text-sm">
              {syncPreview.map((item) => (
                <li key={item.relativePath} className="flex items-center justify-between py-2">
                  <span className="font-mono text-xs">{item.relativePath}</span>
                  <Badge variant={item.action === "Create" ? "success" : "warning"}>
                    {item.action} — {item.reason}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Register MT5 terminal profile</CardTitle>
              <CardDescription>Add a custom terminal path for local folder linking. For production provisioning, use MT5 Control Center onboarding.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => ui.setShowRegisterForm(!ui.showRegisterForm)}>
              {ui.showRegisterForm ? "Hide form" : "Add terminal"}
            </Button>
          </CardHeader>
          {ui.showRegisterForm ? (
            <CardContent className="grid gap-3 md:grid-cols-2">
              {Object.entries(registerDraft).map(([key, value]) => (
                <label key={key} className="text-sm text-slate-700">
                  <span className="mb-1 block font-semibold capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                  <input
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                    value={value}
                    onChange={(event) => setRegisterDraft((draft) => ({ ...draft, [key]: event.target.value }))}
                  />
                </label>
              ))}
              <div className="md:col-span-2">
                <Button
                  disabled={!permissions?.canRegister || action.isPending}
                  onClick={() => {
                    void command("Register terminal profile", "register-terminal", registerDraft).then(() => {
                      setRegisterDraft({
                        terminalName: "",
                        terminalExecutablePath: "C:\\Program Files\\MetaTrader 5 IC Markets Global\\terminal64.exe",
                        mt5DataPath: "",
                        brokerName: "",
                        accountLogin: "",
                        hostMachine: "LOCAL",
                        region: "Local"
                      });
                    });
                  }}
                >
                  <Plug className="mr-2 h-4 w-4" />
                  Register terminal
                </Button>
              </div>
            </CardContent>
          ) : null}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-teal-700" />
              Audit trail
            </CardTitle>
            <CardDescription>Recent hub management actions.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-56 rounded-xl border border-slate-100">
              <ul className="divide-y divide-slate-100 text-xs">
                {data.audits.length ? (
                  data.audits.map((entry) => (
                    <li key={entry.id} className="px-3 py-2">
                      <p className="font-semibold text-slate-900">{entry.action}</p>
                      <p className="text-slate-600">
                        {entry.entityId} · {entry.userId} · {new Date(entry.timestamp).toLocaleString()}
                      </p>
                    </li>
                  ))
                ) : (
                  <li className="px-3 py-4 text-slate-500">No audit records yet.</li>
                )}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Separator />
      <p className="text-xs text-slate-500">
        Broker MT5 installs keep writable files under AppData, not Program Files. In MT5 use <strong>File → Open Data Folder</strong> and paste that path into <strong>MT5 data path</strong> before linking.
        Configure `CACSMS_EA_ROOT` in `apps/web/.env.local` when the canonical EA folder differs on your host.
      </p>
    </div>
  );
}

function TerminalRow({
  terminal,
  selected,
  permissions,
  isActive,
  isPending,
  sendingTestOrder,
  onToggle,
  onActivate,
  onConnect,
  onLink,
  onPreview,
  onToggleAutoLink,
  onSendTestOrder
}: {
  terminal: Mt5TerminalLink;
  selected: boolean;
  permissions: ReturnType<typeof useEaTerminalHub>["data"] extends infer T ? (T extends { permissions: infer P } ? P : undefined) : undefined;
  isActive: boolean;
  isPending: boolean;
  sendingTestOrder: boolean;
  onToggle: () => void;
  onActivate: () => void;
  onConnect: () => void;
  onLink: () => void;
  onPreview: () => void;
  onToggleAutoLink: (enabled: boolean) => void;
  onSendTestOrder: () => void;
}) {
  return (
    <tr className={cn("border-b border-slate-100", isActive && "bg-teal-50/40")}>
      <td className="px-3 py-3">
        <input aria-label={`Select ${terminal.terminalName}`} type="checkbox" checked={selected} onChange={onToggle} />
      </td>
      <td className="px-3 py-3">
        <p className="font-semibold text-slate-900">{terminal.terminalName}</p>
        <p className="text-slate-500">
          {terminal.hostMachine} · {terminal.region}
        </p>
      </td>
      <td className="px-3 py-3">
        {terminal.brokerName}
        <p className="text-slate-500">{terminal.accountLogin}</p>
      </td>
      <td className="px-3 py-3">
        <Badge variant={toneVariant(terminal.connectionStatus)}>{terminal.connectionStatus}</Badge>
        {terminal.bridgeHeartbeatStatus ? <p className="mt-1 text-[10px] text-slate-500">{terminal.bridgeHeartbeatStatus}</p> : null}
        {terminal.eaInstanceId ? <p className="mt-1 font-mono text-[10px] text-teal-700">{terminal.eaInstanceId}</p> : null}
      </td>
      <td className="px-3 py-3">
        <Badge variant={toneVariant(terminal.linkStatus)}>{terminal.linkStatus}</Badge>
      </td>
      <td className="px-3 py-3">
        <Badge variant={terminal.operatorManaged ? "success" : "secondary"}>{terminal.operatorManaged ? "Yes" : "No"}</Badge>
      </td>
      <td className="px-3 py-3 font-mono text-[11px] text-slate-600">{terminal.mt5ExpertsPath}</td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" disabled={!permissions?.canSetActive || isPending} onClick={onActivate}>
            Focus
          </Button>
          <Button size="sm" variant="outline" disabled={!permissions?.canConnect || isPending} onClick={onConnect}>
            Manage
          </Button>
          <Button size="sm" variant="outline" disabled={!permissions?.canLink || isPending} onClick={onLink}>
            Link EA
          </Button>
          <Button size="sm" variant="outline" disabled={!permissions?.canPreviewSync || isPending} onClick={onPreview}>
            Preview
          </Button>
          <Button
            size="sm"
            disabled={!permissions?.canSendTestOrder || !terminal.eaInstanceId || isPending || sendingTestOrder}
            onClick={onSendTestOrder}
            title={terminal.eaInstanceId ? "Queue test order via EA Bridge" : "EA Bridge instance not linked yet"}
          >
            <Send className="mr-1 h-3 w-3" />
            Test order
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!permissions?.canConnect || isPending}
            onClick={() => onToggleAutoLink(!terminal.autoLinkOnConnect)}
          >
            Auto-link {terminal.autoLinkOnConnect ? "On" : "Off"}
          </Button>
        </div>
      </td>
    </tr>
  );
}
