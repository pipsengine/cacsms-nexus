"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Ban,
  Bot,
  Clock3,
  Download,
  Gauge,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
  Shuffle,
  SlidersHorizontal,
  Wrench
} from "lucide-react";

import type { Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useExecutionQueue } from "../hooks/use-execution-queue";
import { useExecutionQueueStore } from "../stores/execution-queue.store";
import type {
  ExecutionFeedback,
  ExecutionQueueItem,
  QueueBottleneck,
  QueueDiagnostic,
  QueueException,
  QueueLog,
  QueueSlaPrioritySummary
} from "../types/execution-queue.types";
import { formatIso, formatNumber, formatSeconds } from "../utils/execution-queue.mappers";

type SortDir = "asc" | "desc";

type DetailTab = "Identity" | "Readiness" | "State" | "Feedback" | "Audit";

function scoreVariant(score: number) {
  if (score >= 90) return "success" as const;
  if (score >= 75) return "default" as const;
  if (score >= 60) return "warning" as const;
  return "destructive" as const;
}

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s.includes("executed") || s.includes("ready") || s.includes("passed")) return "success" as const;
  if (s.includes("pending") || s.includes("monitoring") || s.includes("nearing")) return "warning" as const;
  if (s.includes("blocked") || s.includes("failed") || s.includes("breached") || s.includes("expired") || s.includes("stop")) return "destructive" as const;
  return "secondary" as const;
}

function can(role: Mt5Role, action: "process" | "pauseResume" | "retry" | "cancel" | "validate" | "reassign" | "emergency" | "diagnostics" | "autoRemediate") {
  if (action === "emergency") return role === "Super Admin";
  if (action === "reassign") return role === "Super Admin" || role === "Infrastructure Admin";
  if (action === "diagnostics" || action === "autoRemediate") return role === "Super Admin" || role === "Infrastructure Admin";
  if (action === "process" || action === "pauseResume" || action === "retry" || action === "cancel" || action === "validate") return role === "Super Admin" || role === "Trading Admin";
  return false;
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

function toCsv(items: ExecutionQueueItem[]) {
  const headers: (keyof ExecutionQueueItem)[] = [
    "queueId",
    "orderId",
    "signalId",
    "strategyId",
    "priority",
    "account",
    "broker",
    "terminal",
    "eaInstance",
    "symbol",
    "direction",
    "orderType",
    "volume",
    "entryPrice",
    "stopLoss",
    "takeProfit",
    "queueStatus",
    "validationStatus",
    "riskStatus",
    "routingStatus",
    "executionStatus",
    "retryCount",
    "queueAgeSeconds",
    "slaStatus",
    "failureReason",
    "createdAt",
    "updatedAt"
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return `"${s.replaceAll('"', '""')}"`;
  };
  const rows = items.map((i) => headers.map((h) => escape(i[h])).join(","));
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

export function ExecutionQueueDashboard() {
  const queryClient = useQueryClient();
  const { summary, items, item, prioritySla, bottlenecks, exceptions, feedback, logs, diagnostics, actions } = useExecutionQueue();

  const role = useExecutionQueueStore((s) => s.role);
  const setRole = useExecutionQueueStore((s) => s.setRole);
  const searchTerm = useExecutionQueueStore((s) => s.searchTerm);
  const setSearchTerm = useExecutionQueueStore((s) => s.setSearchTerm);
  const statusFilter = useExecutionQueueStore((s) => s.statusFilter);
  const setStatusFilter = useExecutionQueueStore((s) => s.setStatusFilter);
  const priorityFilter = useExecutionQueueStore((s) => s.priorityFilter);
  const setPriorityFilter = useExecutionQueueStore((s) => s.setPriorityFilter);
  const selectedQueueId = useExecutionQueueStore((s) => s.selectedQueueId);
  const setSelectedQueueId = useExecutionQueueStore((s) => s.setSelectedQueueId);
  const selectedQueueIds = useExecutionQueueStore((s) => s.selectedQueueIds);
  const toggleSelected = useExecutionQueueStore((s) => s.toggleSelected);
  const clearSelected = useExecutionQueueStore((s) => s.clearSelected);
  const showDetailPanel = useExecutionQueueStore((s) => s.showDetailPanel);
  const toggleDetailPanel = useExecutionQueueStore((s) => s.toggleDetailPanel);

  const [sortKey, setSortKey] = React.useState<keyof ExecutionQueueItem>("priority");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [detailTab, setDetailTab] = React.useState<DetailTab>("Identity");

  const selectedIds = React.useMemo(() => Object.entries(selectedQueueIds).filter(([, v]) => v).map(([k]) => k), [selectedQueueIds]);

  const queuePaused = summary.data?.meta.queuePaused ?? false;
  const emergencyStopActive = summary.data?.meta.emergencyStopActive ?? false;
  const healthScore = summary.data?.health.score ?? 0;

  const queueItems = items.data?.items ?? [];
  const sortedRows = React.useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const value = (r: ExecutionQueueItem) => r[sortKey];
    return [...queueItems].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
    });
  }, [queueItems, sortKey, sortDir]);

  const selectedItem = item.data?.item ?? null;
  const itemLogs = React.useMemo(() => {
    const all = logs.data?.logs ?? [];
    if (!selectedQueueId) return all;
    return all.filter((l) => l.queueId === selectedQueueId || l.queueId === "ALL");
  }, [logs.data?.logs, selectedQueueId]);

  const itemFeedback = React.useMemo(() => {
    const all = feedback.data?.feedback ?? [];
    if (!selectedQueueId) return all;
    return all.filter((f) => f.queueId === selectedQueueId);
  }, [feedback.data?.feedback, selectedQueueId]);

  const onToggleSort = (key: keyof ExecutionQueueItem) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["execution-queue"] });
  };

  const exportReport = () => {
    const payload = {
      meta: { exportedAt: new Date().toISOString(), role },
      summary: summary.data ?? null,
      items: items.data?.items ?? [],
      prioritySla: prioritySla.data ?? null,
      bottlenecks: bottlenecks.data ?? null,
      exceptions: exceptions.data?.exceptions ?? [],
      feedback: feedback.data?.feedback ?? [],
      logs: logs.data?.logs ?? [],
      diagnostics: diagnostics.data?.diagnostics ?? []
    };
    downloadText(`execution-queue-report-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.json`, JSON.stringify(payload, null, 2));
  };

  const exportCsv = () => {
    downloadText(`execution-queue-items-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.csv`, toCsv(items.data?.items ?? []), "text/csv");
  };

  const cancelSelected = async () => {
    for (const id of selectedIds.slice(0, 25)) {
      await actions.cancelItem.mutateAsync(id);
    }
    clearSelected();
  };

  const retryFailed = async () => {
    const failed = prioritizeFailures(items.data?.items ?? []).slice(0, 15);
    for (const it of failed) {
      await actions.retryItem.mutateAsync(it.queueId);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="h-1.5 w-full rounded-t-2xl bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500" />
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">Execution Queue</h1>
                <Badge variant={scoreVariant(healthScore)}>
                  <Gauge className="h-3.5 w-3.5" />
                  Health {healthScore}/100
                </Badge>
                {emergencyStopActive ? (
                  <Badge variant="destructive">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Emergency Stop
                  </Badge>
                ) : queuePaused ? (
                  <Badge variant="warning">
                    <PauseCircle className="h-3.5 w-3.5" />
                    Paused
                  </Badge>
                ) : (
                  <Badge variant="success">
                    <PlayCircle className="h-3.5 w-3.5" />
                    Running
                  </Badge>
                )}
              </div>
              <p className="mt-2 max-w-5xl text-sm font-semibold text-slate-700 sm:text-base">
                Real-time queue management for pending, validated, routed, failed, retried, blocked, and executed MT5 trade requests.
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
              <Button variant="outline" onClick={() => void refresh()} disabled={summary.isFetching || items.isFetching}>
                <RefreshCw className={cn("h-4 w-4", summary.isFetching || items.isFetching ? "animate-spin" : "")} />
                Refresh Queue
              </Button>
              <Button onClick={() => actions.processQueue.mutate()} disabled={!can(role, "process") || queuePaused || emergencyStopActive || actions.processQueue.isPending}>
                <Shuffle className="h-4 w-4" />
                Process Queue
              </Button>
              <Button
                variant="outline"
                onClick={() => actions.pauseQueue.mutate()}
                disabled={!can(role, "pauseResume") || queuePaused || emergencyStopActive || actions.pauseQueue.isPending}
              >
                <PauseCircle className="h-4 w-4" />
                Pause Execution Queue
              </Button>
              <Button
                variant="outline"
                onClick={() => actions.resumeQueue.mutate()}
                disabled={!can(role, "pauseResume") || !queuePaused || emergencyStopActive || actions.resumeQueue.isPending}
              >
                <PlayCircle className="h-4 w-4" />
                Resume Execution Queue
              </Button>
              <Button variant="secondary" onClick={() => void retryFailed()} disabled={!can(role, "retry") || queuePaused || emergencyStopActive || actions.retryItem.isPending}>
                <Wrench className="h-4 w-4" />
                Retry Failed Items
              </Button>
              <Button variant="secondary" onClick={() => void cancelSelected()} disabled={!can(role, "cancel") || !selectedIds.length || actions.cancelItem.isPending}>
                <Ban className="h-4 w-4" />
                Cancel Selected
              </Button>
              <Button
                variant="destructive"
                onClick={() => actions.emergencyStop.mutate()}
                disabled={!can(role, "emergency") || emergencyStopActive || actions.emergencyStop.isPending}
              >
                <ShieldAlert className="h-4 w-4" />
                Emergency Stop Execution
              </Button>
              <Button variant="outline" onClick={exportReport} disabled={role === "Read-Only Viewer"}>
                <Download className="h-4 w-4" />
                Export Queue Report
              </Button>
              <Button variant="outline" onClick={exportCsv} disabled={!items.data?.items?.length}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(summary.data?.kpis ?? []).slice(0, 12).map((kpi) => (
          <Card key={kpi.label} className={cn("p-4", kpi.status === "Critical" ? "border-red-200" : kpi.status === "Degraded" ? "border-orange-200" : "border-slate-200")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-slate-500">{kpi.label}</p>
                <p className="mt-2 truncate text-2xl font-semibold text-slate-950">{kpi.value}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
                {kpi.label.includes("Health") ? <Gauge className="h-5 w-5 text-slate-700" /> : kpi.label.includes("Failed") ? <AlertTriangle className="h-5 w-5 text-slate-700" /> : <Clock3 className="h-5 w-5 text-slate-700" />}
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
              <p className="text-xs font-semibold uppercase text-blue-600">Execution Queue Workflow</p>
              <CardTitle className="mt-1 text-2xl">Pipeline state visibility</CardTitle>
              <CardDescription className="mt-2 max-w-4xl">
                Trade Decision Approved → Queue Created → Pre-Execution Validation → Risk Gate Passed → Broker/Account Readiness → Route Assigned → EA Delivery → MT5 Execution → Feedback Received → Queue Closed
              </CardDescription>
            </div>
            <Badge variant={emergencyStopActive ? "destructive" : queuePaused ? "warning" : "success"}>{emergencyStopActive ? "Stop Active" : queuePaused ? "Paused" : "Operational"}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {(summary.data?.workflow ?? []).map((w) => (
              <div key={w.title} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-slate-600">{w.title}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">
                      {w.itemCount} items · {w.failedCount} failed
                    </p>
                  </div>
                  <Badge variant={w.status === "Operational" ? "success" : w.status === "Monitoring" ? "secondary" : w.status === "Degraded" ? "warning" : "destructive"}>{w.status}</Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <p className="font-semibold text-slate-500">Avg delay</p>
                    <p className="font-semibold text-slate-800">{formatSeconds(w.averageDelaySeconds)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">Last</p>
                    <p className="font-semibold text-slate-800">{new Date(w.lastProcessedItem).toLocaleTimeString()}</p>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{w.aiRecommendation ?? "Monitor pipeline stage and enforce SLA rules."}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className={cn("grid gap-4", showDetailPanel ? "xl:grid-cols-[1.25fr_0.75fr]" : "")}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Execution Queue Table</p>
                <CardTitle className="mt-1 text-2xl">Queue items before MT5</CardTitle>
                <CardDescription className="mt-2">Monitor, validate, route, retry, cancel, and audit every execution request.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="queue-search">
                  Search execution queue
                </label>
                <input
                  id="queue-search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search queue, order, account, symbol…"
                  className="h-10 w-72 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400"
                />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900">
                  <option value="all">All</option>
                  {["Pending", "Validated", "Processing", "Routed", "Executed", "Failed", "Retried", "Cancelled", "Blocked", "Expired"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  {["Within SLA", "Nearing Breach", "Breached", "Expired"].map((s) => (
                    <option key={s} value={s}>
                      SLA: {s}
                    </option>
                  ))}
                </select>
                <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900">
                  <option value="all">All priorities</option>
                  {["Critical", "High", "Normal", "Low"].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-xl border border-slate-200">
              <table aria-label="Execution queue items" className="min-w-[2400px] table-fixed border-collapse bg-white">
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
                          for (const row of sortedRows) toggleSelected(row.queueId);
                        }}
                      />
                    </th>
                    <th className="w-[140px] px-3 py-2">
                      <SortHeader label="Queue ID" active={sortKey === "queueId"} dir={sortDir} onClick={() => onToggleSort("queueId")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Order ID" active={sortKey === "orderId"} dir={sortDir} onClick={() => onToggleSort("orderId")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Signal ID" active={sortKey === "signalId"} dir={sortDir} onClick={() => onToggleSort("signalId")} />
                    </th>
                    <th className="w-[160px] px-3 py-2">
                      <SortHeader label="Strategy ID" active={sortKey === "strategyId"} dir={sortDir} onClick={() => onToggleSort("strategyId")} />
                    </th>
                    <th className="w-[110px] px-3 py-2">
                      <SortHeader label="Priority" active={sortKey === "priority"} dir={sortDir} onClick={() => onToggleSort("priority")} />
                    </th>
                    <th className="w-[190px] px-3 py-2">
                      <SortHeader label="Account" active={sortKey === "account"} dir={sortDir} onClick={() => onToggleSort("account")} />
                    </th>
                    <th className="w-[140px] px-3 py-2">
                      <SortHeader label="Broker" active={sortKey === "broker"} dir={sortDir} onClick={() => onToggleSort("broker")} />
                    </th>
                    <th className="w-[170px] px-3 py-2">
                      <SortHeader label="Terminal" active={sortKey === "terminal"} dir={sortDir} onClick={() => onToggleSort("terminal")} />
                    </th>
                    <th className="w-[150px] px-3 py-2">
                      <SortHeader label="EA Instance" active={sortKey === "eaInstance"} dir={sortDir} onClick={() => onToggleSort("eaInstance")} />
                    </th>
                    <th className="w-[110px] px-3 py-2">
                      <SortHeader label="Symbol" active={sortKey === "symbol"} dir={sortDir} onClick={() => onToggleSort("symbol")} />
                    </th>
                    <th className="w-[90px] px-3 py-2">
                      <SortHeader label="Dir" active={sortKey === "direction"} dir={sortDir} onClick={() => onToggleSort("direction")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Order Type" active={sortKey === "orderType"} dir={sortDir} onClick={() => onToggleSort("orderType")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Volume" active={sortKey === "volume"} dir={sortDir} onClick={() => onToggleSort("volume")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Entry" active={sortKey === "entryPrice"} dir={sortDir} onClick={() => onToggleSort("entryPrice")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="SL" active={sortKey === "stopLoss"} dir={sortDir} onClick={() => onToggleSort("stopLoss")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="TP" active={sortKey === "takeProfit"} dir={sortDir} onClick={() => onToggleSort("takeProfit")} />
                    </th>
                    <th className="w-[140px] px-3 py-2">
                      <SortHeader label="Queue Status" active={sortKey === "queueStatus"} dir={sortDir} onClick={() => onToggleSort("queueStatus")} />
                    </th>
                    <th className="w-[140px] px-3 py-2">
                      <SortHeader label="Validation" active={sortKey === "validationStatus"} dir={sortDir} onClick={() => onToggleSort("validationStatus")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Risk" active={sortKey === "riskStatus"} dir={sortDir} onClick={() => onToggleSort("riskStatus")} />
                    </th>
                    <th className="w-[140px] px-3 py-2">
                      <SortHeader label="Routing" active={sortKey === "routingStatus"} dir={sortDir} onClick={() => onToggleSort("routingStatus")} />
                    </th>
                    <th className="w-[140px] px-3 py-2">
                      <SortHeader label="Execution" active={sortKey === "executionStatus"} dir={sortDir} onClick={() => onToggleSort("executionStatus")} />
                    </th>
                    <th className="w-[110px] px-3 py-2">
                      <SortHeader label="Retry" active={sortKey === "retryCount"} dir={sortDir} onClick={() => onToggleSort("retryCount")} />
                    </th>
                    <th className="w-[130px] px-3 py-2">
                      <SortHeader label="Queue Age" active={sortKey === "queueAgeSeconds"} dir={sortDir} onClick={() => onToggleSort("queueAgeSeconds")} />
                    </th>
                    <th className="w-[130px] px-3 py-2">
                      <SortHeader label="SLA" active={sortKey === "slaStatus"} dir={sortDir} onClick={() => onToggleSort("slaStatus")} />
                    </th>
                    <th className="w-[240px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">Failure Reason</th>
                    <th className="w-[140px] px-3 py-2">
                      <SortHeader label="Created" active={sortKey === "createdAt"} dir={sortDir} onClick={() => onToggleSort("createdAt")} />
                    </th>
                    <th className="w-[140px] px-3 py-2">
                      <SortHeader label="Updated" active={sortKey === "updatedAt"} dir={sortDir} onClick={() => onToggleSort("updatedAt")} />
                    </th>
                    <th className="w-[420px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => {
                    const checked = Boolean(selectedQueueIds[row.queueId]);
                    const active = row.queueId === selectedQueueId;
                    return (
                      <tr
                        key={row.queueId}
                        className={cn("border-b border-slate-100 hover:bg-slate-50", active ? "bg-blue-50" : "bg-white")}
                        onClick={() => {
                          setSelectedQueueId(row.queueId);
                          setDetailTab("Identity");
                        }}
                      >
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={checked} onChange={() => toggleSelected(row.queueId)} />
                        </td>
                        <td className="px-3 py-2 text-sm font-semibold text-slate-950">{row.queueId}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.orderId}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.signalId}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.strategyId}</td>
                        <td className="px-3 py-2">
                          <Badge variant={row.priority === "Critical" ? "destructive" : row.priority === "High" ? "warning" : "secondary"}>{row.priority}</Badge>
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.account}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.broker}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.terminal}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.eaInstance}</td>
                        <td className="px-3 py-2 text-sm font-semibold text-slate-950">{row.symbol}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.direction}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.orderType}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{formatNumber(row.volume, 2)}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{formatNumber(row.entryPrice, 5)}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.stopLoss == null ? "—" : formatNumber(row.stopLoss, 5)}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.takeProfit == null ? "—" : formatNumber(row.takeProfit, 5)}</td>
                        <td className="px-3 py-2">
                          <Badge variant={statusBadge(row.queueStatus)}>{row.queueStatus}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={statusBadge(row.validationStatus)}>{row.validationStatus}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={statusBadge(row.riskStatus)}>{row.riskStatus}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={statusBadge(row.routingStatus)}>{row.routingStatus}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={statusBadge(row.executionStatus)}>{row.executionStatus}</Badge>
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.retryCount}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{formatSeconds(row.queueAgeSeconds)}</td>
                        <td className="px-3 py-2">
                          <Badge variant={statusBadge(row.slaStatus)}>{row.slaStatus}</Badge>
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-700">{row.failureReason ?? "—"}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{new Date(row.createdAt).toLocaleTimeString()}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{new Date(row.updatedAt).toLocaleTimeString()}</td>
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setSelectedQueueId(row.queueId)}>
                              View Queue Item
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => actions.validateItem.mutate(row.queueId)}
                              disabled={!can(role, "validate") || queuePaused || emergencyStopActive || actions.validateItem.isPending}
                            >
                              Force Validate
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => actions.retryItem.mutate(row.queueId)}
                              disabled={!can(role, "retry") || queuePaused || emergencyStopActive || actions.retryItem.isPending}
                            >
                              Retry Execution
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => actions.cancelItem.mutate(row.queueId)} disabled={!can(role, "cancel") || actions.cancelItem.isPending}>
                              Cancel Item
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => actions.reassignRoute.mutate(row.queueId)}
                              disabled={!can(role, "reassign") || actions.reassignRoute.isPending}
                            >
                              Reassign Route
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDetailTab("Readiness")}>
                              View Risk Decision
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDetailTab("State")}>
                              View Route
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDetailTab("Feedback")}>
                              View Execution Feedback
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
                      <td colSpan={31} className="px-4 py-10 text-center text-sm font-semibold text-slate-600">
                        No queue items match the current search/filter criteria.
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
                    <p className="text-xs font-semibold uppercase text-blue-600">Queue Item Detail Panel</p>
                    <CardTitle className="mt-1 text-2xl">{selectedItem ? `Queue ${selectedItem.queueId}` : "Select a queue item"}</CardTitle>
                    <CardDescription className="mt-2">Identity, readiness checks, processing state, SLA risk, and audit trail.</CardDescription>
                  </div>
                  {selectedItem ? <Badge variant={statusBadge(selectedItem.queueStatus)}>{selectedItem.queueStatus}</Badge> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(["Identity", "Readiness", "State", "Feedback", "Audit"] as const).map((t) => (
                    <TabPill key={t} active={detailTab === t} onClick={() => setDetailTab(t)}>
                      {t}
                    </TabPill>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-[610px] pr-3">
                {!selectedItem ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-semibold text-slate-700">
                    Select an item in the queue table to inspect identity, readiness checks, SLA status, feedback, and audit trail.
                  </div>
                ) : detailTab === "Identity" ? (
                  <ItemIdentity item={selectedItem} />
                ) : detailTab === "Readiness" ? (
                  <ItemReadiness item={selectedItem} />
                ) : detailTab === "State" ? (
                  <ItemState item={selectedItem} />
                ) : detailTab === "Feedback" ? (
                  <ItemFeedback feedback={itemFeedback} />
                ) : (
                  <ItemAudit logs={itemLogs} />
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Queue Priority & SLA Monitor</p>
                <CardTitle className="mt-1 text-2xl">Priority distribution and SLA posture</CardTitle>
                <CardDescription className="mt-2">Critical/high/normal/low queue counts, expiries, SLA breaches, and primary bottleneck stage.</CardDescription>
              </div>
              <Badge variant="secondary">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                SLA-aware
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <PrioritySlaPanel data={prioritySla.data?.summary ?? null} loading={prioritySla.isLoading} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Queue Bottleneck Analysis</p>
                <CardTitle className="mt-1 text-2xl">Stage congestion and root cause</CardTitle>
                <CardDescription className="mt-2">Validation, risk gate, readiness checks, EA delivery, feedback delay, retry congestion, and blocked buildup.</CardDescription>
              </div>
              <Badge variant="secondary">{(bottlenecks.data?.bottlenecks?.length ?? 0).toString()} findings</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <BottleneckTable data={bottlenecks.data?.bottlenecks ?? []} loading={bottlenecks.isLoading} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Failed, Retried & Blocked Queue Items</p>
                <CardTitle className="mt-1 text-2xl">Exceptions and required actions</CardTitle>
                <CardDescription className="mt-2">Failure reasons, retry eligibility, block reasons, AI explanation, and required action.</CardDescription>
              </div>
              <Badge variant="secondary">{(exceptions.data?.exceptions?.length ?? 0).toString()} items</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ExceptionsTable data={exceptions.data?.exceptions ?? []} loading={exceptions.isLoading} onSelect={(id) => setSelectedQueueId(id)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Execution Feedback Panel</p>
                <CardTitle className="mt-1 text-2xl">MT5 delivery and execution feedback</CardTitle>
                <CardDescription className="mt-2">MT5 ticket, timestamps, slippage, response codes, and final status linked to queue items.</CardDescription>
              </div>
              <Badge variant="secondary">{(feedback.data?.feedback?.length ?? 0).toString()} feedback</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <FeedbackTable data={feedback.data?.feedback ?? []} loading={feedback.isLoading} onSelect={(id) => setSelectedQueueId(id)} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-blue-600">AI Execution Queue Diagnostics</p>
              <CardTitle className="mt-1 text-2xl">Backlog, stuck items, unsafe retries, SLA breaches</CardTitle>
              <CardDescription className="mt-2">
                Detects queue backlog, stuck items, repeated retry failures, unsafe retry risk, SLA breach, bottlenecks, route assignment failures, expired requests, and missing feedback.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={() => actions.autoRemediate.mutate()} disabled={!can(role, "autoRemediate") || actions.autoRemediate.isPending}>
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
          <DiagnosticsTable data={diagnostics.data?.diagnostics ?? []} loading={diagnostics.isLoading} onSelect={(id) => setSelectedQueueId(id)} />
        </CardContent>
      </Card>
    </div>
  );
}

function prioritizeFailures(items: ExecutionQueueItem[]) {
  const score = (it: ExecutionQueueItem) => (it.priority === "Critical" ? 4 : it.priority === "High" ? 3 : it.priority === "Normal" ? 2 : 1) * 10 + it.queueAgeSeconds + it.retryCount * 20;
  return [...items]
    .filter((it) => it.queueStatus === "Failed" || it.queueStatus === "Retried")
    .sort((a, b) => score(b) - score(a));
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

function ItemIdentity({ item }: { item: ExecutionQueueItem }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase text-slate-500">Queue Identity</p>
        <div className="mt-2">
          <KeyGrid
            rows={[
              { label: "Queue ID", value: item.queueId },
              { label: "Order ID", value: item.orderId },
              { label: "Signal ID", value: item.signalId },
              { label: "Strategy ID", value: item.strategyId },
              { label: "Source Engine", value: item.sourceEngine },
              { label: "Queue Priority", value: <Badge variant={item.priority === "Critical" ? "destructive" : item.priority === "High" ? "warning" : "secondary"}>{item.priority}</Badge> },
              { label: "Created Time", value: formatIso(item.createdAt) },
              { label: "Target Execution Window", value: formatIso(item.targetExecutionWindow) },
              { label: "Expiry Time", value: formatIso(item.expiryTime) }
            ]}
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase text-slate-500">Trade Request</p>
        <div className="mt-2">
          <KeyGrid
            rows={[
              { label: "Symbol", value: item.symbol },
              { label: "Normalized Symbol", value: item.normalizedSymbol },
              { label: "Broker Symbol", value: item.brokerSymbol },
              { label: "Direction", value: <Badge variant={item.direction === "Buy" ? "success" : "destructive"}>{item.direction}</Badge> },
              { label: "Order Type", value: item.orderType },
              { label: "Volume", value: formatNumber(item.volume, 2) },
              { label: "Entry Price", value: formatNumber(item.entryPrice, 5) },
              { label: "Stop Loss", value: item.stopLoss == null ? "—" : formatNumber(item.stopLoss, 5) },
              { label: "Take Profit", value: item.takeProfit == null ? "—" : formatNumber(item.takeProfit, 5) },
              { label: "Time in Force", value: item.timeInForce }
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function ItemReadiness({ item }: { item: ExecutionQueueItem }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase text-slate-500">Readiness Checks</p>
        <div className="mt-2">
          <KeyGrid
            rows={[
              { label: "Signal approval status", value: <Badge variant={statusBadge(item.validationStatus)}>{item.validationStatus}</Badge> },
              { label: "Risk validation status", value: <Badge variant={statusBadge(item.riskStatus)}>{item.riskStatus}</Badge> },
              { label: "Account readiness", value: <Badge variant={statusBadge(item.accountReadinessStatus)}>{item.accountReadinessStatus}</Badge> },
              { label: "Broker readiness", value: <Badge variant={statusBadge(item.brokerReadinessStatus)}>{item.brokerReadinessStatus}</Badge> },
              { label: "Terminal readiness", value: <Badge variant={statusBadge(item.terminalReadinessStatus)}>{item.terminalReadinessStatus}</Badge> },
              { label: "EA bridge readiness", value: <Badge variant={statusBadge(item.eaBridgeReadinessStatus)}>{item.eaBridgeReadinessStatus}</Badge> },
              { label: "Symbol mapping status", value: <Badge variant={statusBadge(item.symbolMappingStatus)}>{item.symbolMappingStatus}</Badge> },
              { label: "Spread validation", value: <Badge variant={statusBadge(item.spreadValidationStatus)}>{item.spreadValidationStatus}</Badge> },
              { label: "Margin validation", value: <Badge variant={statusBadge(item.marginValidationStatus)}>{item.marginValidationStatus}</Badge> },
              { label: "Duplicate protection", value: <Badge variant={statusBadge(item.duplicateCheckStatus)}>{item.duplicateCheckStatus}</Badge> }
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function ItemState({ item }: { item: ExecutionQueueItem }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase text-slate-500">Processing State</p>
        <div className="mt-2">
          <KeyGrid
            rows={[
              { label: "Queue status", value: <Badge variant={statusBadge(item.queueStatus)}>{item.queueStatus}</Badge> },
              { label: "Validation status", value: <Badge variant={statusBadge(item.validationStatus)}>{item.validationStatus}</Badge> },
              { label: "Routing status", value: <Badge variant={statusBadge(item.routingStatus)}>{item.routingStatus}</Badge> },
              { label: "Delivery status", value: <Badge variant={statusBadge(item.deliveryStatus)}>{item.deliveryStatus}</Badge> },
              { label: "Execution status", value: <Badge variant={statusBadge(item.executionStatus)}>{item.executionStatus}</Badge> },
              { label: "Retry count", value: `${item.retryCount}/${item.maxRetryCount}` },
              { label: "Last retry time", value: formatIso(item.lastRetryAt ?? null) },
              { label: "Queue age", value: formatSeconds(item.queueAgeSeconds) },
              { label: "SLA status", value: <Badge variant={statusBadge(item.slaStatus)}>{item.slaStatus}</Badge> },
              { label: "Failure reason", value: item.failureReason ?? "—" },
              { label: "Assigned route", value: item.assignedRoute ?? "—" },
              { label: "Next action", value: item.nextAction }
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function ItemFeedback({ feedback }: { feedback: ExecutionFeedback[] }) {
  if (!feedback.length) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">No execution feedback available.</div>;
  }
  return (
    <div className="space-y-3">
      {feedback.map((f) => (
        <div key={f.id} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">Order {f.orderId}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">
                Ticket: {f.mt5Ticket ?? "—"} · Code: {f.responseCode} · Status: {f.finalStatus}
              </p>
            </div>
            <Badge variant={statusBadge(f.finalStatus)}>{f.finalStatus}</Badge>
          </div>
          <div className="mt-2 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
            <div>
              <p className="font-semibold text-slate-500">Delivered</p>
              <p className="font-semibold text-slate-900">{formatIso(f.deliveredAt ?? null)}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-500">Executed</p>
              <p className="font-semibold text-slate-900">{formatIso(f.executedAt ?? null)}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-500">Requested price</p>
              <p className="font-semibold text-slate-900">{formatNumber(f.requestedPrice, 5)}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-500">Executed price</p>
              <p className="font-semibold text-slate-900">{f.executedPrice == null ? "—" : formatNumber(f.executedPrice, 5)}</p>
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600">{f.responseMessage}</p>
        </div>
      ))}
    </div>
  );
}

function ItemAudit({ logs }: { logs: QueueLog[] }) {
  if (!logs.length) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">No audit entries available.</div>;
  }
  return (
    <div className="space-y-3">
      {logs.map((l) => (
        <div key={l.id} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">{l.eventType}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">
                {new Date(l.createdAt).toLocaleString()} · Queue: {l.queueId} · Order: {l.orderId}
              </p>
            </div>
            <Badge variant={l.severity === "Critical" ? "destructive" : l.severity === "Warning" ? "warning" : "secondary"}>{l.severity}</Badge>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-700">
            <span className="font-semibold text-slate-500">Message:</span> <span className="font-semibold text-slate-900">{l.message}</span>
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            <span className="font-semibold text-slate-500">Action:</span> {l.actionTaken} · <span className="font-semibold text-slate-500">Result:</span> {l.result}
          </p>
        </div>
      ))}
    </div>
  );
}

function PrioritySlaPanel({ data, loading }: { data: QueueSlaPrioritySummary | null; loading: boolean }) {
  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">Loading SLA summary…</div>;
  if (!data) return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">No SLA summary available.</div>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[
        { label: "Critical priority queue", value: data.criticalPriorityQueue },
        { label: "High priority queue", value: data.highPriorityQueue },
        { label: "Normal priority queue", value: data.normalPriorityQueue },
        { label: "Low priority queue", value: data.lowPriorityQueue },
        { label: "Expired queue items", value: data.expiredQueueItems },
        { label: "SLA-breached queue items", value: data.slaBreachedQueueItems },
        { label: "Items nearing expiry", value: data.itemsNearingExpiry },
        { label: "Average time in queue", value: formatSeconds(data.averageTimeInQueueSeconds) },
        { label: "Bottleneck stage", value: data.bottleneckStage }
      ].map((k) => (
        <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">{k.label}</p>
          <p className="mt-1 text-sm font-semibold text-slate-950">{k.value}</p>
        </div>
      ))}
    </div>
  );
}

function BottleneckTable({ data, loading }: { data: QueueBottleneck[]; loading: boolean }) {
  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">Loading bottlenecks…</div>;
  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-[950px] border-collapse">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            {["Stage", "Affected", "Avg Delay", "Severity", "Root Cause", "Recommended Action"].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((b) => (
            <tr key={b.id} className="border-b border-slate-100">
              <td className="px-3 py-2 text-sm font-semibold text-slate-950">{b.bottleneckStage}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{b.affectedCount}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{formatSeconds(b.averageDelaySeconds)}</td>
              <td className="px-3 py-2">
                <Badge variant={b.severity === "Critical" ? "destructive" : b.severity === "Warning" ? "warning" : "secondary"}>{b.severity}</Badge>
              </td>
              <td className="px-3 py-2 text-sm text-slate-700">{b.rootCause}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{b.recommendedAction}</td>
            </tr>
          ))}
          {!data.length ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-sm font-semibold text-slate-600">
                No bottlenecks detected.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function ExceptionsTable({ data, loading, onSelect }: { data: QueueException[]; loading: boolean; onSelect: (queueId: string) => void }) {
  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">Loading exceptions…</div>;
  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-[980px] border-collapse">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            {["Queue ID", "Order ID", "Account", "Broker", "Symbol", "Status", "Failure reason", "Retry", "Eligibility", "Required action"].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((e) => (
            <tr key={e.queueId} className="border-b border-slate-100">
              <td className="px-3 py-2 text-sm font-semibold text-slate-950">
                <button type="button" className="text-left hover:underline" onClick={() => onSelect(e.queueId)}>
                  {e.queueId}
                </button>
              </td>
              <td className="px-3 py-2 text-sm text-slate-700">{e.orderId}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{e.account}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{e.broker}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{e.symbol}</td>
              <td className="px-3 py-2">
                <Badge variant={statusBadge(e.status)}>{e.status}</Badge>
              </td>
              <td className="px-3 py-2 text-sm text-slate-700">{e.failureReason}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{e.retryCount}</td>
              <td className="px-3 py-2">
                <Badge variant={e.retryEligibility === "Eligible" ? "success" : "warning"}>{e.retryEligibility}</Badge>
              </td>
              <td className="px-3 py-2 text-sm text-slate-700">{e.requiredAction}</td>
            </tr>
          ))}
          {!data.length ? (
            <tr>
              <td colSpan={10} className="px-4 py-8 text-center text-sm font-semibold text-slate-600">
                No failed/retried/blocked items.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function FeedbackTable({ data, loading, onSelect }: { data: ExecutionFeedback[]; loading: boolean; onSelect: (queueId: string) => void }) {
  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">Loading feedback…</div>;
  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-[980px] border-collapse">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            {["Queue ID", "Order ID", "MT5 Ticket", "Delivered", "Executed", "Req Price", "Exec Price", "Slippage", "Time", "Code", "Final Status"].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((f) => (
            <tr key={f.id} className="border-b border-slate-100">
              <td className="px-3 py-2 text-sm font-semibold text-slate-950">
                <button type="button" className="text-left hover:underline" onClick={() => onSelect(f.queueId)}>
                  {f.queueId}
                </button>
              </td>
              <td className="px-3 py-2 text-sm text-slate-700">{f.orderId}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{f.mt5Ticket ?? "—"}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{f.deliveredAt ? new Date(f.deliveredAt).toLocaleTimeString() : "—"}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{f.executedAt ? new Date(f.executedAt).toLocaleTimeString() : "—"}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{formatNumber(f.requestedPrice, 5)}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{f.executedPrice == null ? "—" : formatNumber(f.executedPrice, 5)}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{f.slippagePoints == null ? "—" : `${formatNumber(f.slippagePoints, 1)}p`}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{f.executionTimeMs == null ? "—" : `${f.executionTimeMs}ms`}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{f.responseCode}</td>
              <td className="px-3 py-2">
                <Badge variant={statusBadge(f.finalStatus)}>{f.finalStatus}</Badge>
              </td>
            </tr>
          ))}
          {!data.length ? (
            <tr>
              <td colSpan={11} className="px-4 py-8 text-center text-sm font-semibold text-slate-600">
                No execution feedback available.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function DiagnosticsTable({ data, loading, onSelect }: { data: QueueDiagnostic[]; loading: boolean; onSelect: (queueId: string) => void }) {
  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">Loading diagnostics…</div>;
  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-[980px] border-collapse">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            {["Issue", "Queue/Stage", "Severity", "Root Cause", "Impact", "Recommended Action", "Auto-fix", "Confidence", "Actions"].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.id} className="border-b border-slate-100">
              <td className="px-3 py-2 text-sm font-semibold text-slate-950">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-slate-600" />
                  <span>{d.issue}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-sm text-slate-700">{d.affectedQueueId ?? d.affectedStage ?? "—"}</td>
              <td className="px-3 py-2">
                <Badge variant={d.severity === "Critical" ? "destructive" : d.severity === "Warning" ? "warning" : "secondary"}>{d.severity}</Badge>
              </td>
              <td className="px-3 py-2 text-sm text-slate-700">{d.rootCause}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{d.tradingImpact}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{d.recommendedAction}</td>
              <td className="px-3 py-2">
                <Badge variant={d.autoFixEligible ? "success" : "secondary"}>{d.autoFixEligible ? "Eligible" : "Manual"}</Badge>
              </td>
              <td className="px-3 py-2 text-sm font-semibold text-slate-950">{d.confidenceScore}%</td>
              <td className="px-3 py-2">
                <Button variant="outline" size="sm" onClick={() => d.affectedQueueId && onSelect(d.affectedQueueId)} disabled={!d.affectedQueueId}>
                  Inspect Item
                </Button>
              </td>
            </tr>
          ))}
          {!data.length ? (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-sm font-semibold text-slate-600">
                No diagnostics issues detected.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
