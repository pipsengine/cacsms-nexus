"use client";

import Link from "next/link";
import { Activity, AlertTriangle, Cloud, Gauge, MonitorSmartphone, Network, Server, Terminal, Workflow } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AUTONOMOUS_SYNC_NOTICE } from "@/lib/mt5-autonomous";
import { useRemoteControlHub } from "../hooks/use-remote-control-hub";
import type { RemoteControlCapability, RemoteControlTone } from "../types/remote-control-hub.types";

const variants: Record<RemoteControlTone, "success" | "warning" | "destructive" | "default" | "secondary"> = {
  Healthy: "success",
  Watch: "warning",
  Degraded: "warning",
  Critical: "destructive",
  Offline: "destructive",
  Syncing: "default",
  Inactive: "secondary"
};

const borders: Record<RemoteControlTone, string> = {
  Healthy: "border-t-emerald-500",
  Watch: "border-t-amber-500",
  Degraded: "border-t-amber-500",
  Critical: "border-t-red-500",
  Offline: "border-t-red-500",
  Syncing: "border-t-blue-500",
  Inactive: "border-t-slate-400"
};

export function RemoteControlHubDashboard() {
  const query = useRemoteControlHub();
  const [selectedHost, setSelectedHost] = useState("");
  const highlight = query.highlightedHost;

  const filteredSessions = useMemo(() => {
    const sessions = query.data?.remoteSessions ?? [];
    const host = selectedHost || highlight;
    if (!host) return sessions;
    const terminals = query.data?.mt5Automation.filter((row) => row.hostMachine === host).map((row) => row.terminalName) ?? [];
    return sessions.filter((session) => terminals.includes(session.terminalName));
  }, [query.data?.remoteSessions, query.data?.mt5Automation, selectedHost, highlight]);

  if (query.isError) {
    return (
      <div className="mx-auto max-w-[1900px] px-4 py-6">
        <Card className="border-red-200 p-6">
          <h1 className="text-xl font-semibold">Remote Control Hub unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">VPS, session, and application control telemetry could not be loaded.</p>
          <Button className="mt-4" onClick={() => query.refetch()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (query.isLoading || !query.data) {
    return <div className="mx-auto max-w-[1900px] px-4 py-6 text-sm text-slate-600">Loading remote control hub...</div>;
  }

  const data = query.data;

  return (
    <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <section className="sticky top-14 z-20 rounded-2xl border border-slate-200 bg-white/95 shadow-card backdrop-blur">
        <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-sky-600 via-cyan-500 to-teal-500" />
        <div className="flex flex-col gap-5 p-5 xl:flex-row xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Autonomous Computer Operator / Remote Control Hub</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Remote Control Hub</h1>
              <Badge variant={query.streamConnected ? "success" : "warning"}>
                <Activity className="mr-1 h-3 w-3" />
                {query.streamConnected ? "Live stream" : "Polling"}
              </Badge>
              <Badge variant={variants[toneFromScore(data.meta.overallReadiness.score)]}>
                Readiness {data.meta.overallReadiness.score}/100
              </Badge>
            </div>
            <p className="mt-2 max-w-4xl text-sm text-slate-600">
              Consolidated computer, VPS, remote session, MT5 automation, launcher, and application health control — derived from terminal, bridge, and host telemetry.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/autonomous-computer-operator/operator-dashboard">Operator Dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/mt5-infrastructure-and-broker-connectivity/ea-bridge">EA Bridge</Link>
            </Button>
          </div>
        </div>
        <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-600">{AUTONOMOUS_SYNC_NOTICE}</p>
      </section>

      {!data.vpsComputers.length ? (
        <Card>
          <CardContent className="p-6 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">No remote control targets</p>
            <p className="mt-2">Connect MT5 terminals to populate VPS inventory, sessions, and application health.</p>
            <Button asChild className="mt-4">
              <Link href="/mt5-infrastructure-and-broker-connectivity/terminal-status">Open Terminal Status</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.kpis.map((kpi) => (
              <Card key={kpi.label} className={cn("border-t-4", borders[kpi.status])}>
                <CardContent className="p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
                  <p className="mt-2 text-xl font-semibold">{kpi.value}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{kpi.detail}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Cloud className="h-5 w-5 text-sky-600" />
                Control Capabilities
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.capabilities.map((capability) => (
                <CapabilityCard key={capability.id} capability={capability} />
              ))}
            </CardContent>
          </Card>

          {data.warnings.length ? (
            <Card className="border-amber-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  Remote Control Warnings
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-2">
                {data.warnings.map((warning) => (
                  <div key={warning.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={variants[warning.severity]}>{warning.severity}</Badge>
                      <Badge variant="secondary">{warning.category}</Badge>
                      <span className="font-semibold">{warning.title}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">{warning.detail}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Workflow className="h-5 w-5 text-cyan-600" />
                Remote Control Workflow
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.workflow.map((node) => (
                <div key={node.title} className="rounded-xl border border-slate-200 p-4">
                  <Badge variant={variants[node.status]}>{node.status}</Badge>
                  <p className="mt-3 text-sm font-semibold">{node.title}</p>
                  <p className="mt-2 text-xs text-slate-600">{node.detail}</p>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Assets {node.assetCount} · Blocked {node.blockedCount}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Server className="h-5 w-5 text-teal-600" />
                  VPS &amp; Computer Inventory
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm" aria-label="VPS and computer inventory">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-slate-500">
                        <th className="px-3 py-2">Host</th>
                        <th className="px-3 py-2">Region</th>
                        <th className="px-3 py-2">Processes</th>
                        <th className="px-3 py-2">Sessions</th>
                        <th className="px-3 py-2">Control</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.vpsComputers.map((host) => (
                        <tr
                          key={host.id}
                          className={cn(
                            "cursor-pointer border-b border-slate-100 hover:bg-slate-50",
                            (selectedHost === host.hostMachine || highlight === host.hostMachine) && "bg-sky-50/50"
                          )}
                          onClick={() => setSelectedHost(host.hostMachine)}
                        >
                          <td className="px-3 py-3">
                            <p className="font-medium">{host.hostMachine}</p>
                            <p className="text-xs text-slate-500">{host.ipAddress}</p>
                          </td>
                          <td className="px-3 py-3">{host.region}</td>
                          <td className="px-3 py-3">
                            {host.runningProcesses}/{host.terminalCount}
                          </td>
                          <td className="px-3 py-3">{host.remoteSessionCount}</td>
                          <td className="px-3 py-3">{host.controlScore}/100</td>
                          <td className="px-3 py-3">
                            <Badge variant={variants[host.status]}>{host.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Network className="h-5 w-5 text-blue-600" />
                  Remote Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm" aria-label="Remote sessions">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-slate-500">
                        <th className="px-3 py-2">Terminal</th>
                        <th className="px-3 py-2">Protocol</th>
                        <th className="px-3 py-2">Auth</th>
                        <th className="px-3 py-2">Latency</th>
                        <th className="px-3 py-2">Stability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSessions.map((session) => (
                        <tr key={session.id} className="border-b border-slate-100">
                          <td className="px-3 py-3">
                            <p className="font-medium">{session.terminalName}</p>
                            <p className="text-xs text-slate-500">{session.accountLogin}</p>
                          </td>
                          <td className="px-3 py-3">{session.protocol}</td>
                          <td className="px-3 py-3">{session.authStatus}</td>
                          <td className="px-3 py-3">{session.latencyMs}ms</td>
                          <td className="px-3 py-3">
                            <Badge variant={variants[session.status]}>{session.stabilityScore}/100</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Terminal className="h-5 w-5 text-indigo-600" />
                  MT5 Automation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.mt5Automation.slice(0, 6).map((row) => (
                  <div key={row.terminalId} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{row.terminalName}</p>
                      <Badge variant={variants[row.status]}>{row.automationScore}/100</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {row.eaInstanceName ?? "No EA"} · {row.processStatus} · bridge {row.bridgeConnected ? "connected" : "offline"}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MonitorSmartphone className="h-5 w-5 text-violet-600" />
                  Application Launcher
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.applicationLaunchers.slice(0, 6).map((row) => (
                  <div key={row.terminalId} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{row.terminalName}</p>
                      <Badge variant={variants[row.status]}>{row.launcherScore}/100</Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-600">{row.terminalPath}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      PID {row.processId ?? "—"} · {row.processStatus}
                      {row.maintenanceMode ? " · maintenance" : ""}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Gauge className="h-5 w-5 text-emerald-600" />
                  Application Health
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.applicationHealth.slice(0, 6).map((row) => (
                  <div key={row.terminalId} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{row.terminalName}</p>
                      <Badge variant={variants[row.status]}>{row.healthScore}/100</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      CPU {row.cpuUsagePercent}% · MEM {row.memoryUsagePercent}% · latency {row.networkLatencyMs}ms
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Related Modules</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.quickLinks.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-xl border border-slate-200 p-4 transition hover:border-sky-300 hover:bg-sky-50/40">
                  <p className="text-sm font-semibold text-slate-900">{link.label}</p>
                  <p className="mt-2 text-xs text-slate-600">{link.description}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function toneFromScore(score: number): RemoteControlTone {
  if (score >= 85) return "Healthy";
  if (score >= 70) return "Watch";
  if (score >= 50) return "Degraded";
  if (score >= 25) return "Critical";
  return "Offline";
}

function CapabilityCard({ capability }: { capability: RemoteControlCapability }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={variants[capability.status]}>{capability.status}</Badge>
        <span className="text-sm font-semibold">{capability.readinessScore}/100</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{capability.title}</p>
      <p className="mt-2 text-xs text-slate-600">{capability.detail}</p>
      <p className="mt-2 text-[11px] text-slate-500">
        Active {capability.activeCount} · Blocked {capability.blockedCount}
      </p>
    </div>
  );
}
