"use client";

import Link from "next/link";
import { Activity, Bot, Camera, Play, Square, Workflow } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useDesktopAutomationHub } from "../hooks/use-desktop-automation-hub";
import type { AutomationTone, TopDownAnalysisRun } from "../types/desktop-automation-hub.types";

const variants: Record<AutomationTone, "success" | "warning" | "destructive" | "default" | "secondary"> = {
  Healthy: "success",
  Watch: "warning",
  Degraded: "warning",
  Critical: "destructive",
  Offline: "destructive",
  Pending: "secondary",
  Running: "default",
  Completed: "success",
  Failed: "destructive",
  Skipped: "secondary"
};

export function DesktopAutomationHubDashboard() {
  const query = useDesktopAutomationHub();
  const [symbol, setSymbol] = useState("");
  const [terminalId, setTerminalId] = useState("");

  const selectedTerminal = useMemo(() => {
    const terminals = query.data?.terminals ?? [];
    return terminals.find((terminal) => terminal.terminalId === (terminalId || query.highlightedTerminalId)) ?? terminals.find((t) => t.automationReady) ?? terminals[0] ?? null;
  }, [query.data?.terminals, terminalId, query.highlightedTerminalId]);

  const symbolsForTerminal = useMemo(() => {
    if (!query.data?.symbols) return [];
    if (!selectedTerminal) return query.data.symbols;
    return query.data.symbols.filter((option) => option.brokers.includes(selectedTerminal.brokerName));
  }, [query.data?.symbols, selectedTerminal]);

  useEffect(() => {
    if (!symbolsForTerminal.length) return;
    if (!symbolsForTerminal.some((option) => option.symbol === symbol)) {
      setSymbol(symbolsForTerminal[0]!.symbol);
    }
  }, [symbolsForTerminal, symbol]);

  if (query.isError) {
    return (
      <div className="mx-auto max-w-[1900px] px-4 py-6">
        <Card className="border-red-200 p-6">
          <h1 className="text-xl font-semibold">Desktop Automation Hub unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">{query.error?.message ?? "Automation hub could not be loaded."}</p>
          <Button className="mt-4" onClick={() => query.refetch()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (query.isLoading || !query.data) {
    return <div className="mx-auto max-w-[1900px] px-4 py-6 text-sm text-slate-600">Loading desktop automation hub...</div>;
  }

  const data = query.data;
  const displayRun = data.activeRun ?? data.recentRuns[0] ?? null;

  const startAnalysis = () => {
    if (!selectedTerminal) return;
    query.startRun.mutate({ symbol, terminalId: selectedTerminal.terminalId, autonomous: true });
  };

  return (
    <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <section className="sticky top-14 z-20 rounded-2xl border border-slate-200 bg-white/95 shadow-card backdrop-blur">
        <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-fuchsia-600 via-purple-500 to-violet-500" />
        <div className="flex flex-col gap-5 p-5 xl:flex-row xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Autonomous Computer Operator / Desktop Automation Hub</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Desktop Automation Hub</h1>
              <Badge variant={query.streamConnected ? "success" : "warning"}>
                <Activity className="mr-1 h-3 w-3" />
                {query.streamConnected ? "Live stream" : "Polling"}
              </Badge>
              <Badge variant={data.operator.autonomousMode ? "success" : "warning"}>
                <Bot className="mr-1 h-3 w-3" />
                Autonomous operator
              </Badge>
            </div>
            <p className="mt-2 max-w-4xl text-sm text-slate-600">
              Operates the computer without human input: opens MT5 chart, selects any pair, walks top-down timeframes (D1 → H4 → H1 → M15 → M5), and captures screenshots for AI analysis.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/mt5-infrastructure-and-broker-connectivity/chart-control">Chart Control</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/autonomous-computer-operator/operator-dashboard">Operator Dashboard</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.kpis.slice(0, 8).map((kpi) => (
          <Card key={kpi.label} className="border-t-4 border-t-fuchsia-500">
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
          <CardTitle className="text-lg">Start Top-Down Analysis (No Human Input)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <label className="text-sm">
            <span className="mb-2 block font-medium text-slate-700">Trading pair</span>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
              aria-label="Trading pair"
            >
              {symbolsForTerminal.map((option) => (
                <option key={option.normalizedSymbol} value={option.symbol}>
                  {option.symbol}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium text-slate-700">MT5 terminal</span>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={selectedTerminal?.terminalId ?? ""}
              onChange={(event) => setTerminalId(event.target.value)}
              aria-label="MT5 terminal"
            >
              {data.terminals.map((terminal) => (
                <option key={terminal.terminalId} value={terminal.terminalId}>
                  {terminal.terminalName} · {terminal.brokerName} {terminal.automationReady ? "" : "(not ready)"}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col justify-end gap-2">
            <p className="text-xs text-slate-600">Timeframes: {data.topDownTimeframes.join(" → ")}</p>
            {!selectedTerminal?.automationReady && selectedTerminal?.automationBlockers.length ? (
              <p className="text-xs text-amber-700">{selectedTerminal.automationBlockers.join(" ")}</p>
            ) : null}
            {query.startRun.isError ? (
              <p className="text-xs text-red-600">{query.startRun.error?.message ?? "Top-down analysis failed to start."}</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!data.permissions.canStartAutomation || !selectedTerminal?.automationReady || query.startRun.isPending || Boolean(data.activeRun)}
                onClick={startAnalysis}
              >
                <Play className="mr-2 h-4 w-4" />
                Run Top-Down Analysis
              </Button>
              {data.activeRun ? (
                <Button
                  variant="outline"
                  disabled={!data.permissions.canCancelAutomation || query.cancelRun.isPending}
                  onClick={() => query.cancelRun.mutate(data.activeRun!.id)}
                >
                  <Square className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {displayRun ? <RunPanel run={displayRun} title={data.activeRun ? "Active Automation Run" : "Latest Run"} /> : null}

      {data.recentRuns.length > 1 ? (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Recent Top-Down Runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentRuns.slice(0, 5).map((run) => (
              <div key={run.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={run.status === "Completed" ? "success" : run.status === "Failed" ? "destructive" : "secondary"}>{run.status}</Badge>
                  <span className="font-semibold">{run.symbol}</span>
                  <span className="text-slate-500">{run.terminalName}</span>
                </div>
                <p className="mt-2 text-xs text-slate-600">{run.summary}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function RunPanel({ run, title }: { run: TopDownAnalysisRun; title: string }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Workflow className="h-5 w-5 text-purple-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={run.status === "Completed" ? "success" : run.status === "Failed" ? "destructive" : "default"}>{run.status}</Badge>
          <span>
            <strong>{run.symbol}</strong> on {run.terminalName} ({run.hostMachine})
          </span>
          <span className="text-slate-500">
            {run.screenshotsCaptured} screenshots · {run.aiAnalysisQueued} AI frames
          </span>
        </div>
        <p className="text-sm text-slate-600">{run.summary}</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm" aria-label="Automation run steps">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="px-3 py-2">Step</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Capture / AI</th>
                <th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {run.steps.map((step) => (
                <tr key={step.id} className={cn("border-b border-slate-100", step.id === run.currentStepId && "bg-fuchsia-50/50")}>
                  <td className="px-3 py-3 font-medium">{step.title}</td>
                  <td className="px-3 py-3">{step.type.replace(/_/g, " ")}</td>
                  <td className="px-3 py-3">
                    <Badge variant={variants[step.status]}>{step.status}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    {step.snapshotId ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Camera className="h-3.5 w-3.5" />
                        {step.snapshotId}
                      </span>
                    ) : step.aiAnalysis ? (
                      <span className="text-xs">
                        {step.aiAnalysis.trend} · RSI {step.aiAnalysis.rsi}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-600">{step.error ?? step.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
