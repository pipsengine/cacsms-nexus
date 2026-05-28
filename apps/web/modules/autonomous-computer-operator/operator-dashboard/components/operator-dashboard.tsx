"use client";

import Link from "next/link";
import { Activity, AlertTriangle, Bot, Cpu, Gauge, Monitor, ShieldAlert, Siren, Workflow } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AUTONOMOUS_SYNC_NOTICE } from "@/lib/mt5-autonomous";
import { useOperatorDashboard } from "../hooks/use-operator-dashboard";
import type { OperatorLane, OperatorTone } from "../types/operator-dashboard.types";

const variants: Record<OperatorTone, "success" | "warning" | "destructive" | "default" | "secondary"> = {
  Healthy: "success",
  Watch: "warning",
  Degraded: "warning",
  Critical: "destructive",
  Offline: "destructive",
  Syncing: "default",
  Inactive: "secondary"
};

const borders: Record<OperatorTone, string> = {
  Healthy: "border-t-emerald-500",
  Watch: "border-t-amber-500",
  Degraded: "border-t-amber-500",
  Critical: "border-t-red-500",
  Offline: "border-t-red-500",
  Syncing: "border-t-blue-500",
  Inactive: "border-t-slate-400"
};

const priorityVariants = {
  Immediate: "destructive",
  High: "warning",
  Normal: "secondary"
} as const;

export function OperatorDashboard() {
  const query = useOperatorDashboard();
  const [selectedHost, setSelectedHost] = useState("");
  const highlight = query.highlightedHost;

  const filteredTerminals = useMemo(() => {
    const terminals = query.data?.terminals ?? [];
    const host = selectedHost || highlight;
    if (!host) return terminals;
    return terminals.filter((terminal) => terminal.hostMachine === host);
  }, [query.data?.terminals, selectedHost, highlight]);

  if (query.isError) {
    return (
      <div className="mx-auto max-w-[1900px] px-4 py-6">
        <Card className="border-red-200 p-6">
          <h1 className="text-xl font-semibold">Operator Dashboard unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">Autonomous operator telemetry could not be loaded.</p>
          <Button className="mt-4" onClick={() => query.refetch()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (query.isLoading || !query.data) {
    return <div className="mx-auto max-w-[1900px] px-4 py-6 text-sm text-slate-600">Loading operator command center...</div>;
  }

  const data = query.data;

  return (
    <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <section className="sticky top-14 z-20 rounded-2xl border border-slate-200 bg-white/95 shadow-card backdrop-blur">
        <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-violet-600 via-indigo-500 to-blue-500" />
        <div className="flex flex-col gap-5 p-5 xl:flex-row xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Autonomous Computer Operator / Operator Dashboard</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Operator Dashboard</h1>
              <Badge variant={query.streamConnected ? "success" : "warning"}>
                <Activity className="mr-1 h-3 w-3" />
                {query.streamConnected ? "Live stream" : "Polling"}
              </Badge>
              <Badge variant={variants[toneFromScore(data.meta.overallReadiness.score)]}>
                Readiness {data.meta.overallReadiness.score}/100
              </Badge>
              {data.safety.globalKillSwitchActive ? (
                <Badge variant="destructive">
                  <Siren className="mr-1 h-3 w-3" />
                  Kill switch active
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 max-w-4xl text-sm text-slate-600">
              Unified command center for remote control, desktop automation, MT5 execution lanes, and recovery safety — scored from live terminal, bridge, and connection telemetry.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/mt5-infrastructure-and-broker-connectivity/terminal-status">Terminal Status</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/autonomous-computer-operator/recovery-and-safety-hub">Recovery &amp; Safety</Link>
            </Button>
          </div>
        </div>
        <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-600">{AUTONOMOUS_SYNC_NOTICE}</p>
      </section>

      {!data.terminals.length ? (
        <Card>
          <CardContent className="p-6 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">No operator scope detected</p>
            <p className="mt-2">Connect MT5 terminals and EA bridge instances to populate the operator command center.</p>
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

          <Card className={cn(data.safety.globalKillSwitchActive ? "border-red-300 bg-red-50/40" : "border-slate-200")}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldAlert className="h-5 w-5 text-violet-600" />
                Safety Posture
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SafetyFlag label="Global kill switch" active={data.safety.globalKillSwitchActive} />
              <SafetyFlag label="Router emergency stop" active={data.safety.routingEmergencyStop} />
              <SafetyFlag label="Queue emergency stop" active={data.safety.queueEmergencyStop} />
              <SafetyFlag label="Unsafe trading disabled" active={data.safety.unsafeTradingDisabled} />
              <SafetyFlag label="Trading path safe" active={data.safety.tradingPathSafe} positive />
              <SafetyFlag label="Autonomous pipeline" active={data.safety.autonomousPipelineHealthy} positive />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bot className="h-5 w-5 text-indigo-600" />
                Operator Lanes
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {data.lanes.map((lane) => (
                <LaneCard key={lane.id} lane={lane} />
              ))}
            </CardContent>
          </Card>

          {data.warnings.length ? (
            <Card className="border-amber-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  Active Operator Warnings
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-2">
                {data.warnings.map((warning) => (
                  <div key={warning.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={variants[warning.severity]}>{warning.severity}</Badge>
                      <Badge variant="secondary">{warning.source}</Badge>
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
                <Workflow className="h-5 w-5 text-blue-600" />
                Operator Workflow
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

          <section className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Cpu className="h-5 w-5 text-violet-600" />
                  Execution Hosts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm" aria-label="Execution hosts">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-slate-500">
                        <th className="px-3 py-2">Host</th>
                        <th className="px-3 py-2">Region</th>
                        <th className="px-3 py-2">Terminals</th>
                        <th className="px-3 py-2">CPU</th>
                        <th className="px-3 py-2">Memory</th>
                        <th className="px-3 py-2">Pressure</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.hosts.map((host) => (
                        <tr
                          key={host.hostMachine}
                          className={cn(
                            "cursor-pointer border-b border-slate-100 hover:bg-slate-50",
                            (selectedHost === host.hostMachine || highlight === host.hostMachine) && "bg-indigo-50/50"
                          )}
                          onClick={() => setSelectedHost(host.hostMachine)}
                        >
                          <td className="px-3 py-3">
                            <p className="font-medium">{host.hostMachine}</p>
                            <p className="text-xs text-slate-500">{host.operatingSystem}</p>
                          </td>
                          <td className="px-3 py-3">{host.region}</td>
                          <td className="px-3 py-3">
                            {host.healthyTerminals}/{host.terminalCount}
                          </td>
                          <td className="px-3 py-3">{host.averageCpuPercent}%</td>
                          <td className="px-3 py-3">{host.averageMemoryPercent}%</td>
                          <td className="px-3 py-3">{host.resourcePressureScore}/100</td>
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
                  <Gauge className="h-5 w-5 text-indigo-600" />
                  Recommended Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.recommendedActions.length ? (
                  data.recommendedActions.map((action) => (
                    <Link key={action.id} href={action.href} className="block rounded-lg border border-slate-200 p-3 transition hover:border-indigo-300 hover:bg-indigo-50/40">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={priorityVariants[action.priority]}>{action.priority}</Badge>
                        {action.automatedEligible ? <Badge variant="success">Auto-eligible</Badge> : null}
                      </div>
                      <p className="mt-2 text-sm font-semibold">{action.title}</p>
                      <p className="mt-1 text-xs text-slate-600">{action.detail}</p>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-slate-600">No immediate operator actions required.</p>
                )}
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Monitor className="h-5 w-5 text-blue-600" />
                Terminal Operator Readiness
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm" aria-label="Terminal operator readiness">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-slate-500">
                      <th className="px-3 py-2">Terminal</th>
                      <th className="px-3 py-2">Host</th>
                      <th className="px-3 py-2">Account</th>
                      <th className="px-3 py-2">Process</th>
                      <th className="px-3 py-2">Heartbeat</th>
                      <th className="px-3 py-2">Readiness</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTerminals.map((terminal) => (
                      <tr key={terminal.terminalId} className="border-b border-slate-100">
                        <td className="px-3 py-3">
                          <p className="font-medium">{terminal.terminalName}</p>
                          <p className="text-xs text-slate-500">{terminal.brokerName}</p>
                        </td>
                        <td className="px-3 py-3">{terminal.hostMachine}</td>
                        <td className="px-3 py-3">{terminal.accountLogin}</td>
                        <td className="px-3 py-3">{terminal.processStatus}</td>
                        <td className="px-3 py-3">{terminal.heartbeatDelaySeconds}s</td>
                        <td className="px-3 py-3">{terminal.readinessScore}/100</td>
                        <td className="px-3 py-3">
                          <Badge variant={variants[terminal.connectionStatus]}>{terminal.connectionStatus}</Badge>
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
              <CardTitle className="text-lg">Related Modules</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.quickLinks.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-xl border border-slate-200 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/40">
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

function toneFromScore(score: number): OperatorTone {
  if (score >= 85) return "Healthy";
  if (score >= 70) return "Watch";
  if (score >= 50) return "Degraded";
  if (score >= 25) return "Critical";
  return "Offline";
}

function SafetyFlag({ label, active, positive = false }: { label: string; active: boolean; positive?: boolean }) {
  const ok = positive ? active : !active;
  return (
    <div className={cn("rounded-lg border p-3 text-sm", ok ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50")}>
      <p className="font-medium text-slate-900">{label}</p>
      <p className={cn("mt-1 text-xs", ok ? "text-emerald-700" : "text-red-700")}>{ok ? "Clear" : "Attention required"}</p>
    </div>
  );
}

function LaneCard({ lane }: { lane: OperatorLane }) {
  return (
    <Link href={lane.href} className="block rounded-xl border border-slate-200 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/40">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={variants[lane.status]}>{lane.status}</Badge>
        <span className="text-sm font-semibold">{lane.readinessScore}/100</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{lane.title}</p>
      <p className="mt-2 text-xs text-slate-600">{lane.detail}</p>
      <p className="mt-2 text-[11px] text-slate-500">
        Assets {lane.activeAssets} · Blocked {lane.blockedCount}
      </p>
    </Link>
  );
}
