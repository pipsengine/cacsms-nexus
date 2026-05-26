"use client";

import * as React from "react";
import {
  Cable,
  FolderSync,
  Link2,
  Monitor,
  Plug,
  PlugZap,
  RefreshCw,
  Server,
  Unplug
} from "lucide-react";

import type { Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useEaTerminalHub } from "../hooks/use-ea-terminal-hub";
import { useEaTerminalHubStore } from "../stores/ea-terminal-hub.store";
import type { Mt5TerminalLink } from "../types/ea-terminal-hub.types";

const roles: Mt5Role[] = ["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager", "Analyst", "Read-Only Viewer"];

function toneVariant(value: string) {
  const v = value.toLowerCase();
  if (v.includes("connected") || v.includes("linked") || v.includes("healthy") || v.includes("synced")) return "success" as const;
  if (v.includes("drift") || v.includes("watch") || v.includes("connecting")) return "warning" as const;
  if (v.includes("critical") || v.includes("error") || v.includes("missing") || v.includes("offline")) return "destructive" as const;
  return "secondary" as const;
}

function canManage(role: Mt5Role) {
  return role === "Super Admin" || role === "Infrastructure Admin" || role === "Trading Admin";
}

export function EaTerminalHubDashboard() {
  const ui = useEaTerminalHubStore();
  const { data, isLoading, isError, error, streamConnected, action } = useEaTerminalHub();
  const [registerDraft, setRegisterDraft] = React.useState({
    terminalName: "",
    terminalExecutablePath: "C:\\MT5\\Custom\\terminal64.exe",
    brokerName: "",
    accountLogin: "",
    hostMachine: "LOCAL",
    region: "Local"
  });

  const terminals = React.useMemo(() => {
    const rows = data?.terminals ?? [];
    const term = ui.searchTerm.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (row) =>
        row.terminalName.toLowerCase().includes(term) ||
        row.brokerName.toLowerCase().includes(term) ||
        row.accountLogin.includes(term) ||
        row.hostMachine.toLowerCase().includes(term)
    );
  }, [data?.terminals, ui.searchTerm]);

  const activeTerminal = terminals.find((t) => t.terminalId === data?.summary.activeTerminalId) ?? terminals.find((t) => t.isActive);

  const run = (path: string, body?: Record<string, unknown>) => action.mutate({ path, body });

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">MT5 Infrastructure & Broker Connectivity</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">EA & Terminal Hub</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              Link the Cacsms system EA folder to each MT5 terminal Experts directory and manage multi-terminal connections from one control surface.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={streamConnected ? "success" : "secondary"}>{streamConnected ? "Live stream" : "Polling"}</Badge>
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
            <Button variant="outline" size="sm" disabled={action.isPending} onClick={() => run("scan")}>
              <RefreshCw className={cn("mr-2 h-4 w-4", action.isPending && "animate-spin")} />
              Scan folders
            </Button>
          </div>
        </div>
      </section>

      {isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-red-700">{(error as Error).message}</CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Connected terminals", data?.summary.connectedTerminals ?? 0],
          ["Linked folders", data?.summary.linkedTerminals ?? 0],
          ["Drifted", data?.summary.driftedTerminals ?? 0],
          ["Link health", `${data?.summary.linkHealthScore ?? 0}%`],
          ["System EA files", data?.summary.systemFolder.fileCount ?? 0]
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{isLoading ? "…" : value}</p>
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
            <CardDescription>Canonical Experts source used by Nexus (`services/cacsms-ea`).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 font-mono text-xs text-slate-700">
              {data?.summary.cacsmsEaRoot ?? "C:\\Next-Generation\\cacsms-nexus\\services\\cacsms-ea"}
            </div>
            <p className="text-slate-600">
              Experts path: <span className="font-mono text-xs">{data?.summary.systemFolder.expertsPath ?? "—"}</span>
            </p>
            <p className="text-slate-600">Last scan: {data?.summary.systemFolder.lastScannedAt ? new Date(data.summary.systemFolder.lastScannedAt).toLocaleString() : "—"}</p>
            <ScrollArea className="h-44 rounded-xl border border-slate-100">
              <ul className="divide-y divide-slate-100 p-2 text-xs">
                {(data?.summary.systemFolder.files ?? []).slice(0, 30).map((file) => (
                  <li key={file.relativePath} className="flex justify-between gap-2 py-2">
                    <span className="font-mono">{file.relativePath}</span>
                    <span className="text-slate-500">{file.sizeBytes} B</span>
                  </li>
                ))}
                {!data?.summary.systemFolder.files?.length ? <li className="py-3 text-slate-500">No EA artifacts detected yet. Add `.mq5` / `.ex5` files under `Experts/`.</li> : null}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FolderSync className="h-5 w-5 text-teal-700" />
              Workflow
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.workflow ?? []).map((step) => (
              <div key={step.step} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{step.step}</p>
                  <p className="text-slate-600">{step.detail}</p>
                </div>
                <Badge variant={toneVariant(step.status)}>{step.status}</Badge>
              </div>
            ))}
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
              <CardDescription>Connect to any MT5 terminal profile and optionally auto-link EA folders on connect.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                aria-label="Search terminals"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Search terminal, broker, host…"
                value={ui.searchTerm}
                onChange={(event) => ui.setSearchTerm(event.target.value)}
              />
              <Button
                size="sm"
                disabled={!canManage(ui.role) || !ui.selectedTerminalIds.length || action.isPending}
                onClick={() => run("connect", { terminalIds: ui.selectedTerminalIds, autoLink: true })}
              >
                <PlugZap className="mr-2 h-4 w-4" />
                Connect selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!canManage(ui.role) || !ui.selectedTerminalIds.length || action.isPending}
                onClick={() => run("disconnect", { terminalIds: ui.selectedTerminalIds })}
              >
                <Unplug className="mr-2 h-4 w-4" />
                Disconnect
              </Button>
              <Button size="sm" variant="outline" disabled={!canManage(ui.role) || action.isPending} onClick={() => run("sync-all")}>
                <Link2 className="mr-2 h-4 w-4" />
                Sync all connected
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="border-y border-slate-100 bg-slate-50">
              <tr>
                {["", "Terminal", "Broker / Account", "Connection", "EA link", "MT5 Experts path", "Actions"].map((head) => (
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
                  canManage={canManage(ui.role)}
                  isActive={terminal.terminalId === data?.summary.activeTerminalId}
                  onToggle={() => ui.toggleTerminalSelection(terminal.terminalId)}
                  onActivate={() => run("set-active", { terminalId: terminal.terminalId })}
                  onConnect={() => run("connect", { terminalIds: [terminal.terminalId], autoLink: true })}
                  onLink={() => run("link", { terminalId: terminal.terminalId })}
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
            <CardDescription>Folder drift between Cacsms EA and this terminal Experts directory.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold">MT5 Experts:</span> <span className="font-mono text-xs">{activeTerminal.mt5ExpertsPath}</span>
              </p>
              <p>
                <span className="font-semibold">Bridge channel:</span> {activeTerminal.bridgeChannelId ?? "Not connected"}
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
                  {(data?.drift ?? []).map((item) => (
                    <tr key={item.fileName} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-mono">{item.fileName}</td>
                      <td className="px-3 py-2">
                        <Badge variant={toneVariant(item.status)}>{item.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Register MT5 terminal profile</CardTitle>
            <CardDescription>Add a custom terminal path to connect at any point.</CardDescription>
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
                disabled={!canManage(ui.role) || action.isPending}
                onClick={() => {
                  run("register-terminal", registerDraft);
                  setRegisterDraft({
                    terminalName: "",
                    terminalExecutablePath: "C:\\MT5\\Custom\\terminal64.exe",
                    brokerName: "",
                    accountLogin: "",
                    hostMachine: "LOCAL",
                    region: "Local"
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

      <Separator />
      <p className="text-xs text-slate-500">Configure `CACSMS_EA_ROOT` in `apps/web/.env.local` if the system EA folder path differs on your host.</p>
    </div>
  );
}

function TerminalRow({
  terminal,
  selected,
  canManage,
  isActive,
  onToggle,
  onActivate,
  onConnect,
  onLink
}: {
  terminal: Mt5TerminalLink;
  selected: boolean;
  canManage: boolean;
  isActive: boolean;
  onToggle: () => void;
  onActivate: () => void;
  onConnect: () => void;
  onLink: () => void;
}) {
  return (
    <tr className={cn("border-b border-slate-100", isActive && "bg-teal-50/40")}>
      <td className="px-3 py-3">
        <input aria-label={`Select ${terminal.terminalName}`} type="checkbox" checked={selected} onChange={onToggle} />
      </td>
      <td className="px-3 py-3">
        <p className="font-semibold text-slate-900">{terminal.terminalName}</p>
        <p className="text-slate-500">{terminal.hostMachine} · {terminal.region}</p>
      </td>
      <td className="px-3 py-3">
        {terminal.brokerName}
        <p className="text-slate-500">{terminal.accountLogin}</p>
      </td>
      <td className="px-3 py-3">
        <Badge variant={toneVariant(terminal.connectionStatus)}>{terminal.connectionStatus}</Badge>
      </td>
      <td className="px-3 py-3">
        <Badge variant={toneVariant(terminal.linkStatus)}>{terminal.linkStatus}</Badge>
      </td>
      <td className="px-3 py-3 font-mono text-[11px] text-slate-600">{terminal.mt5ExpertsPath}</td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" disabled={!canManage} onClick={onActivate}>
            Focus
          </Button>
          <Button size="sm" variant="outline" disabled={!canManage} onClick={onConnect}>
            Connect
          </Button>
          <Button size="sm" variant="outline" disabled={!canManage} onClick={onLink}>
            Link EA
          </Button>
        </div>
      </td>
    </tr>
  );
}
