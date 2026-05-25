"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Bug,
  Download,
  Gauge,
  PauseCircle,
  RefreshCw,
  ShieldAlert,
  Shuffle,
  Table2,
  Wrench
} from "lucide-react";

import type {
  AiTradeSyncDiagnostic,
  Role,
  TradeLifecycleEvent,
  TradeModification,
  TradeReconciliationResponse,
  TradeSyncLogEntry,
  TradeSyncTrade
} from "../types/trade-synchronization.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useTradeSynchronization } from "../hooks/use-trade-synchronization";
import {
  fetchAiDiagnostics,
  fetchTradeLifecycle,
  fetchTradeModifications,
  fetchTradeReconciliation,
  fetchTradeSyncExceptions,
  fetchTradeSyncLogs,
  fetchTradeSyncTrade,
  postAutoRemediate,
  postEmergencyFreeze,
  postReconcileAll,
  postSyncAll,
  postSyncSelected,
  postTradeReconcile,
  postTradeSync
} from "../services/trade-synchronization-service";
import { useTradeSyncStore } from "../stores/trade-synchronization-store";
import { formatNumber, formatSeconds, formatUsd } from "../utils/trade-synchronization-mappers";

type SortDir = "asc" | "desc";

type TradeTab = "Identity" | "Lifecycle" | "Reconciliation" | "Modifications" | "Audit";

function badgeVariantForScore(score: number) {
  if (score >= 90) return "success" as const;
  if (score >= 75) return "default" as const;
  if (score >= 60) return "warning" as const;
  return "destructive" as const;
}

function badgeVariantForSyncStatus(status: TradeSyncTrade["syncStatus"]) {
  if (status === "Synced") return "success" as const;
  if (status === "Pending Sync") return "warning" as const;
  if (status === "Frozen") return "destructive" as const;
  return "destructive" as const;
}

function badgeVariantForMatchStatus(status: TradeSyncTrade["stateMatchStatus"]) {
  if (status === "Matched") return "success" as const;
  if (status === "Minor Difference") return "warning" as const;
  if (status === "Requires Review") return "warning" as const;
  return "destructive" as const;
}

function formatIsoTime(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
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

function toCsv(trades: TradeSyncTrade[]) {
  const headers: (keyof TradeSyncTrade)[] = [
    "tradeId",
    "mt5Ticket",
    "orderId",
    "account",
    "broker",
    "terminal",
    "symbol",
    "direction",
    "orderType",
    "volumeRequested",
    "volumeFilled",
    "entryPrice",
    "currentPrice",
    "stopLoss",
    "takeProfit",
    "tradeStatus",
    "nexusState",
    "mt5State",
    "syncStatus",
    "stateMatchStatus",
    "netProfitLoss",
    "swap",
    "commission",
    "openTime",
    "closeTime",
    "lastSyncAt",
    "syncDelaySeconds",
    "riskLevel"
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return `"${s.replaceAll('"', '""')}"`;
  };
  const rows = trades.map((t) => headers.map((h) => escape(t[h])).join(","));
  return `${headers.join(",")}\n${rows.join("\n")}`;
}

function canPerform(role: Role, action: "sync" | "reconcile" | "diagnostics" | "freeze") {
  if (action === "freeze") return role === "Super Admin";
  if (action === "sync") return role === "Super Admin" || role === "Trading Admin";
  if (action === "reconcile") return role === "Super Admin" || role === "Trading Admin" || role === "Risk Manager";
  return role === "Super Admin" || role === "Infrastructure Admin" || role === "Trading Admin";
}

function SortHeader({
  label,
  active,
  dir,
  onClick
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
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

export function TradeSynchronizationDashboard() {
  const queryClient = useQueryClient();
  const { summary, trades } = useTradeSynchronization();

  const role = useTradeSyncStore((s) => s.role);
  const setRole = useTradeSyncStore((s) => s.setRole);
  const selectedTradeId = useTradeSyncStore((s) => s.selectedTradeId);
  const setSelectedTradeId = useTradeSyncStore((s) => s.setSelectedTradeId);
  const selectedTradeIds = useTradeSyncStore((s) => s.selectedTradeIds);
  const toggleSelectedTrade = useTradeSyncStore((s) => s.toggleSelectedTrade);
  const clearSelectedTrades = useTradeSyncStore((s) => s.clearSelectedTrades);
  const searchTerm = useTradeSyncStore((s) => s.searchTerm);
  const setSearchTerm = useTradeSyncStore((s) => s.setSearchTerm);
  const statusFilter = useTradeSyncStore((s) => s.statusFilter);
  const setStatusFilter = useTradeSyncStore((s) => s.setStatusFilter);
  const showDetailPanel = useTradeSyncStore((s) => s.showDetailPanel);
  const toggleDetailPanel = useTradeSyncStore((s) => s.toggleDetailPanel);

  const [sortKey, setSortKey] = React.useState<keyof TradeSyncTrade>("lastSyncAt");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [detailTab, setDetailTab] = React.useState<TradeTab>("Identity");
  const [exceptionFilter, setExceptionFilter] = React.useState<
    "All" | "Failed Sync" | "Missing Ticket" | "State Mismatch" | "Volume Mismatch" | "SL/TP Mismatch" | "Missing Close Event" | "P/L Mismatch" | "Duplicate Ticket" | "Resolved" | "Unresolved"
  >("Unresolved");

  const selectedIds = React.useMemo(() => Object.entries(selectedTradeIds).filter(([, v]) => v).map(([k]) => k), [selectedTradeIds]);

  const frozen = summary.data?.meta.frozen ?? false;
  const healthScore = summary.data?.kpis.tradeSyncHealthScore.score ?? 0;

  const tradeQuery = useQuery({
    queryKey: ["trade-sync", "trade", selectedTradeId],
    queryFn: () => fetchTradeSyncTrade(selectedTradeId as string),
    enabled: Boolean(selectedTradeId),
    staleTime: 5_000,
    retry: 1
  });

  const lifecycleQuery = useQuery({
    queryKey: ["trade-sync", "lifecycle", selectedTradeId],
    queryFn: () => fetchTradeLifecycle(selectedTradeId as string),
    enabled: Boolean(selectedTradeId),
    staleTime: 5_000,
    retry: 1
  });

  const modificationsQuery = useQuery({
    queryKey: ["trade-sync", "modifications", selectedTradeId],
    queryFn: () => fetchTradeModifications(selectedTradeId as string),
    enabled: Boolean(selectedTradeId),
    staleTime: 5_000,
    retry: 1
  });

  const reconciliationQuery = useQuery({
    queryKey: ["trade-sync", "reconciliation", selectedTradeId],
    queryFn: () => fetchTradeReconciliation(selectedTradeId as string),
    enabled: Boolean(selectedTradeId),
    staleTime: 5_000,
    retry: 1
  });

  const logsQuery = useQuery({
    queryKey: ["trade-sync", "logs"],
    queryFn: () => fetchTradeSyncLogs(),
    refetchInterval: 15_000,
    staleTime: 5_000,
    retry: 1
  });

  const exceptionsQuery = useQuery({
    queryKey: ["trade-sync", "exceptions"],
    queryFn: () => fetchTradeSyncExceptions(),
    refetchInterval: 15_000,
    staleTime: 5_000,
    retry: 1
  });

  const diagnosticsQuery = useQuery({
    queryKey: ["trade-sync", "ai-diagnostics"],
    queryFn: () => fetchAiDiagnostics(),
    refetchInterval: 20_000,
    staleTime: 7_000,
    retry: 1
  });

  const invalidateAll = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["trade-sync"] });
  }, [queryClient]);

  const syncAll = useMutation({
    mutationFn: () => postSyncAll(),
    onSuccess: invalidateAll
  });

  const syncSelected = useMutation({
    mutationFn: (tradeIds: string[]) => postSyncSelected(tradeIds),
    onSuccess: invalidateAll
  });

  const syncTrade = useMutation({
    mutationFn: (tradeId: string) => postTradeSync(tradeId),
    onSuccess: invalidateAll
  });

  const reconcileTrade = useMutation({
    mutationFn: (tradeId: string) => postTradeReconcile(tradeId),
    onSuccess: invalidateAll
  });

  const reconcileAll = useMutation({
    mutationFn: () => postReconcileAll(),
    onSuccess: invalidateAll
  });

  const autoRemediate = useMutation({
    mutationFn: () => postAutoRemediate(),
    onSuccess: invalidateAll
  });

  const emergencyFreeze = useMutation({
    mutationFn: () => postEmergencyFreeze(),
    onSuccess: invalidateAll
  });

  const tradeRows = React.useMemo(() => {
    const rows = trades.data?.trades ?? [];
    const dir = sortDir === "asc" ? 1 : -1;
    const getValue = (t: TradeSyncTrade) => {
      const v = t[sortKey];
      if (typeof v === "number") return v;
      if (v == null) return "";
      return String(v);
    };
    return [...rows].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [trades.data?.trades, sortKey, sortDir]);

  const selectedTrade = tradeQuery.data ?? null;
  const filteredTradeLogs = React.useMemo(() => {
    const logs = logsQuery.data?.logs ?? [];
    if (!selectedTradeId) return logs;
    return logs.filter((l) => l.tradeId === selectedTradeId);
  }, [logsQuery.data?.logs, selectedTradeId]);

  const displayedExceptionLogs = React.useMemo(() => {
    const allLogs = logsQuery.data?.logs ?? [];
    if (exceptionFilter === "All") return allLogs;
    if (exceptionFilter === "Unresolved") return exceptionsQuery.data?.logs ?? allLogs.filter((l) => l.resolutionStatus !== "Resolved");
    if (exceptionFilter === "Resolved") return allLogs.filter((l) => l.resolutionStatus === "Resolved");
    const needle = exceptionFilter.toLowerCase();
    return allLogs.filter((l) => l.exceptionType.toLowerCase().includes(needle) || l.errorMessage.toLowerCase().includes(needle) || l.rootCause.toLowerCase().includes(needle));
  }, [exceptionFilter, exceptionsQuery.data?.logs, logsQuery.data?.logs]);

  const onToggleSort = (key: keyof TradeSyncTrade) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const exportReport = () => {
    const payload = {
      meta: { exportedAt: new Date().toISOString(), role },
      summary: summary.data ?? null,
      trades: trades.data?.trades ?? [],
      diagnostics: diagnosticsQuery.data?.diagnostics ?? [],
      logs: logsQuery.data?.logs ?? [],
      exceptions: exceptionsQuery.data?.logs ?? []
    };
    downloadText(`trade-sync-report-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.json`, JSON.stringify(payload, null, 2));
  };

  const exportTradesCsv = () => {
    downloadText(`trade-sync-trades-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.csv`, toCsv(trades.data?.trades ?? []), "text/csv");
  };

  const kpis = summary.data?.kpis;
  const workflow = summary.data?.workflow ?? [];

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="h-1.5 w-full rounded-t-2xl bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500" />
        <div className="p-5 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">Trade Synchronization</h1>
                <Badge variant={badgeVariantForScore(healthScore)}>
                  <Gauge className="h-3.5 w-3.5" />
                  Health {healthScore}/100
                </Badge>
                {frozen ? (
                  <Badge variant="destructive">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Frozen
                  </Badge>
                ) : (
                  <Badge variant="success">
                    <Activity className="h-3.5 w-3.5" />
                    Live
                  </Badge>
                )}
              </div>
              <p className="mt-2 max-w-5xl text-sm font-semibold text-slate-700 sm:text-base">
                Real-time synchronization, reconciliation, and lifecycle validation of MT5 trades, positions, orders, fills, modifications, and execution events.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase text-slate-500">Role</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900"
                >
                  {(["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager", "Analyst", "Viewer"] as const).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <Separator orientation="vertical" className="mx-1 h-6" />
                <div className="text-xs font-semibold text-slate-600">
                  Selected: <span className="text-slate-950">{selectedIds.length}</span>
                </div>
                <Button variant="outline" size="sm" onClick={clearSelectedTrades} disabled={!selectedIds.length}>
                  Clear Selected
                </Button>
                <Button variant="outline" size="sm" onClick={toggleDetailPanel}>
                  {showDetailPanel ? "Hide Detail" : "Show Detail"}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Button variant="outline" onClick={() => void invalidateAll()} disabled={summary.isFetching || trades.isFetching}>
                <RefreshCw className={cn("h-4 w-4", summary.isFetching || trades.isFetching ? "animate-spin" : "")} />
                Refresh Trades
              </Button>
              <Button
                onClick={() => syncAll.mutate()}
                disabled={!canPerform(role, "sync") || frozen || syncAll.isPending}
                title={!canPerform(role, "sync") ? "Requires Trading Admin or Super Admin" : undefined}
              >
                <Shuffle className="h-4 w-4" />
                Sync All Trades
              </Button>
              <Button
                onClick={() => syncSelected.mutate(selectedIds)}
                disabled={!canPerform(role, "sync") || frozen || !selectedIds.length || syncSelected.isPending}
                title={!canPerform(role, "sync") ? "Requires Trading Admin or Super Admin" : undefined}
              >
                <Table2 className="h-4 w-4" />
                Sync Selected Trades
              </Button>
              <Button
                variant="secondary"
                onClick={() => reconcileAll.mutate()}
                disabled={!canPerform(role, "reconcile") || frozen || reconcileAll.isPending}
                title={!canPerform(role, "reconcile") ? "Requires Trading Admin, Risk Manager, or Super Admin" : undefined}
              >
                <Wrench className="h-4 w-4" />
                Run Trade Reconciliation
              </Button>
              <Button variant="outline" onClick={() => void Promise.all([logsQuery.refetch(), exceptionsQuery.refetch(), diagnosticsQuery.refetch()])}>
                <Bug className="h-4 w-4" />
                Run Sync Diagnostics
              </Button>
              <Button variant="outline" onClick={exportReport} disabled={!canPerform(role, "diagnostics") && role !== "Analyst"}>
                <Download className="h-4 w-4" />
                Export Trade Sync Report
              </Button>
              <Button variant="outline" onClick={exportTradesCsv} disabled={!trades.data?.trades?.length}>
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button
                variant="destructive"
                onClick={() => emergencyFreeze.mutate()}
                disabled={!canPerform(role, "freeze") || frozen || emergencyFreeze.isPending}
                title={!canPerform(role, "freeze") ? "Requires Super Admin" : undefined}
              >
                <PauseCircle className="h-4 w-4" />
                Emergency Freeze Trade Sync
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Active Trades", value: kpis?.totalActiveTrades ?? 0, icon: Activity, tone: "border-slate-200" },
          { label: "Synced Trades", value: kpis?.syncedTrades ?? 0, icon: Gauge, tone: "border-green-200" },
          { label: "Pending Sync", value: kpis?.pendingSync ?? 0, icon: RefreshCw, tone: "border-orange-200" },
          { label: "Failed Sync", value: kpis?.failedSync ?? 0, icon: AlertTriangle, tone: "border-red-200" },
          { label: "Trade State Mismatches", value: kpis?.tradeStateMismatches ?? 0, icon: AlertTriangle, tone: "border-red-200" },
          { label: "Open Positions", value: kpis?.openPositions ?? 0, icon: Activity, tone: "border-slate-200" },
          { label: "Pending Orders", value: kpis?.pendingOrders ?? 0, icon: RefreshCw, tone: "border-orange-200" },
          { label: "Closed Trades Today", value: kpis?.closedTradesToday ?? 0, icon: Table2, tone: "border-slate-200" },
          { label: "Partial Fills", value: kpis?.partialFills ?? 0, icon: Wrench, tone: "border-orange-200" },
          { label: "Modification Events", value: kpis?.modificationEvents ?? 0, icon: Wrench, tone: "border-slate-200" },
          { label: "Average Sync Delay", value: formatSeconds(kpis?.averageSyncDelaySeconds ?? 0), icon: Gauge, tone: "border-slate-200" },
          {
            label: "Trade Sync Health Score",
            value: `${kpis?.tradeSyncHealthScore.score ?? 0}/100`,
            icon: ShieldAlert,
            tone: badgeVariantForScore(healthScore) === "success" ? "border-green-200" : badgeVariantForScore(healthScore) === "warning" ? "border-orange-200" : "border-red-200"
          }
        ].map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className={cn("p-4", tone)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                <p className="mt-2 truncate text-2xl font-semibold text-slate-950">{value}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
                <Icon className="h-5 w-5 text-slate-700" />
              </div>
            </div>
            {label === "Trade Sync Health Score" ? (
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{kpis?.tradeSyncHealthScore.explanation ?? "—"}</p>
            ) : (
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">Realtime snapshot derived from Nexus/MT5 trade drift indicators.</p>
            )}
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-blue-600">Trade Sync Workflow</p>
              <CardTitle className="mt-1 text-2xl">Lifecycle validation path</CardTitle>
              <CardDescription className="mt-2 max-w-4xl">
                Order Routed → MT5 Ticket Created → Execution Feedback Received → Position Synced → SL/TP Synced → Modification Synced → Partial Fill Checked → Close
                Event Synced → P/L Reconciled → Audit Logged
              </CardDescription>
            </div>
            <Badge variant={frozen ? "destructive" : "success"}>{frozen ? "Updates Frozen" : "Updates Enabled"}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {workflow.map((w) => (
              <div key={w.key} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-slate-600">{w.label}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">
                      {w.tradeCount} trades · {w.failedCount} failed
                    </p>
                  </div>
                  <Badge
                    variant={
                      w.status === "Operational" ? "success" : w.status === "Monitoring" ? "secondary" : w.status === "Degraded" ? "warning" : "destructive"
                    }
                  >
                    {w.status}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <p className="font-semibold text-slate-500">Avg delay</p>
                    <p className="font-semibold text-slate-800">{formatSeconds(w.averageDelaySeconds)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500">Last event</p>
                    <p className="font-semibold text-slate-800">{new Date(w.lastEventTime).toLocaleTimeString()}</p>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{w.aiRecommendation}</p>
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
                <p className="text-xs font-semibold uppercase text-blue-600">Trade Synchronization Table</p>
                <CardTitle className="mt-1 text-2xl">Trades, tickets, and sync state</CardTitle>
                <CardDescription className="mt-2">Search, filter, reconcile, and synchronize trades between Nexus and MT5.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search trade, ticket, account, symbol…"
                  className="h-10 w-72 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900"
                >
                  <option value="all">All</option>
                  <option value="Synced">Synced</option>
                  <option value="Pending Sync">Pending Sync</option>
                  <option value="Failed Sync">Failed Sync</option>
                  <option value="Open">Open</option>
                  <option value="Closed">Closed</option>
                  <option value="Pending">Pending</option>
                  <option value="Partially Filled">Partially Filled</option>
                  <option value="Matched">Matched</option>
                  <option value="Minor Difference">Minor Difference</option>
                  <option value="Material Difference">Material Difference</option>
                  <option value="Missing in MT5">Missing in MT5</option>
                  <option value="Missing in Nexus">Missing in Nexus</option>
                  <option value="Requires Review">Requires Review</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-xl border border-slate-200">
              <table className="min-w-[2200px] table-fixed border-collapse bg-white">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="w-10 px-3 py-2 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.length > 0 && selectedIds.length === tradeRows.length}
                        onChange={() => {
                          if (selectedIds.length === tradeRows.length) {
                            clearSelectedTrades();
                            return;
                          }
                          for (const t of tradeRows) toggleSelectedTrade(t.tradeId);
                        }}
                      />
                    </th>
                    <th className="w-[140px] px-3 py-2">
                      <SortHeader label="Trade ID" active={sortKey === "tradeId"} dir={sortDir} onClick={() => onToggleSort("tradeId")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="MT5 Ticket" active={sortKey === "mt5Ticket"} dir={sortDir} onClick={() => onToggleSort("mt5Ticket")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Order ID" active={sortKey === "orderId"} dir={sortDir} onClick={() => onToggleSort("orderId")} />
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
                    <th className="w-[110px] px-3 py-2">
                      <SortHeader label="Symbol" active={sortKey === "symbol"} dir={sortDir} onClick={() => onToggleSort("symbol")} />
                    </th>
                    <th className="w-[90px] px-3 py-2">
                      <SortHeader label="Dir" active={sortKey === "direction"} dir={sortDir} onClick={() => onToggleSort("direction")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Order Type" active={sortKey === "orderType"} dir={sortDir} onClick={() => onToggleSort("orderType")} />
                    </th>
                    <th className="w-[130px] px-3 py-2">
                      <SortHeader label="Vol Req" active={sortKey === "volumeRequested"} dir={sortDir} onClick={() => onToggleSort("volumeRequested")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Vol Fill" active={sortKey === "volumeFilled"} dir={sortDir} onClick={() => onToggleSort("volumeFilled")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Entry" active={sortKey === "entryPrice"} dir={sortDir} onClick={() => onToggleSort("entryPrice")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Current" active={sortKey === "currentPrice"} dir={sortDir} onClick={() => onToggleSort("currentPrice")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="SL" active={sortKey === "stopLoss"} dir={sortDir} onClick={() => onToggleSort("stopLoss")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="TP" active={sortKey === "takeProfit"} dir={sortDir} onClick={() => onToggleSort("takeProfit")} />
                    </th>
                    <th className="w-[140px] px-3 py-2">
                      <SortHeader label="Trade Status" active={sortKey === "tradeStatus"} dir={sortDir} onClick={() => onToggleSort("tradeStatus")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Nexus" active={sortKey === "nexusState"} dir={sortDir} onClick={() => onToggleSort("nexusState")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="MT5" active={sortKey === "mt5State"} dir={sortDir} onClick={() => onToggleSort("mt5State")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Sync" active={sortKey === "syncStatus"} dir={sortDir} onClick={() => onToggleSort("syncStatus")} />
                    </th>
                    <th className="w-[150px] px-3 py-2">
                      <SortHeader label="State Match" active={sortKey === "stateMatchStatus"} dir={sortDir} onClick={() => onToggleSort("stateMatchStatus")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Net P/L" active={sortKey === "netProfitLoss"} dir={sortDir} onClick={() => onToggleSort("netProfitLoss")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Open Time" active={sortKey === "openTime"} dir={sortDir} onClick={() => onToggleSort("openTime")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Close Time" active={sortKey === "closeTime"} dir={sortDir} onClick={() => onToggleSort("closeTime")} />
                    </th>
                    <th className="w-[140px] px-3 py-2">
                      <SortHeader label="Last Sync" active={sortKey === "lastSyncAt"} dir={sortDir} onClick={() => onToggleSort("lastSyncAt")} />
                    </th>
                    <th className="w-[130px] px-3 py-2">
                      <SortHeader label="Delay" active={sortKey === "syncDelaySeconds"} dir={sortDir} onClick={() => onToggleSort("syncDelaySeconds")} />
                    </th>
                    <th className="w-[120px] px-3 py-2">
                      <SortHeader label="Risk" active={sortKey === "riskLevel"} dir={sortDir} onClick={() => onToggleSort("riskLevel")} />
                    </th>
                    <th className="w-[430px] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeRows.map((t) => {
                    const checked = Boolean(selectedTradeIds[t.tradeId]);
                    const active = t.tradeId === selectedTradeId;
                    return (
                      <tr
                        key={t.tradeId}
                        className={cn("border-b border-slate-100 hover:bg-slate-50", active ? "bg-blue-50" : "bg-white")}
                        onClick={() => {
                          setSelectedTradeId(t.tradeId);
                          setDetailTab("Identity");
                        }}
                      >
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={checked} onChange={() => toggleSelectedTrade(t.tradeId)} />
                        </td>
                        <td className="px-3 py-2 text-sm font-semibold text-slate-950">{t.tradeId}</td>
                        <td className="px-3 py-2 text-sm font-semibold text-slate-800">{t.mt5Ticket ?? "—"}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{t.orderId ?? "—"}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{t.account}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{t.broker}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{t.terminal}</td>
                        <td className="px-3 py-2 text-sm font-semibold text-slate-950">{t.symbol}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{t.direction}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{t.orderType}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{formatNumber(t.volumeRequested, 2)}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{formatNumber(t.volumeFilled, 2)}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{formatNumber(t.entryPrice, 5)}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{formatNumber(t.currentPrice, 5)}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{t.stopLoss == null ? "—" : formatNumber(t.stopLoss, 5)}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{t.takeProfit == null ? "—" : formatNumber(t.takeProfit, 5)}</td>
                        <td className="px-3 py-2">
                          <Badge variant={t.tradeStatus === "Open" ? "success" : t.tradeStatus === "Pending" ? "warning" : "secondary"}>{t.tradeStatus}</Badge>
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-700">{t.nexusState}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{t.mt5State}</td>
                        <td className="px-3 py-2">
                          <Badge variant={badgeVariantForSyncStatus(t.syncStatus)}>{t.syncStatus}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={badgeVariantForMatchStatus(t.stateMatchStatus)}>{t.stateMatchStatus}</Badge>
                        </td>
                        <td className={cn("px-3 py-2 text-sm font-semibold", t.netProfitLoss >= 0 ? "text-emerald-700" : "text-red-700")}>
                          {formatUsd(t.netProfitLoss)}
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-700">{new Date(t.openTime).toLocaleTimeString()}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{t.closeTime ? new Date(t.closeTime).toLocaleTimeString() : "—"}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{new Date(t.lastSyncAt).toLocaleTimeString()}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">{formatSeconds(t.syncDelaySeconds)}</td>
                        <td className="px-3 py-2">
                          <Badge variant={t.riskLevel === "Critical" ? "destructive" : t.riskLevel === "High" ? "warning" : "secondary"}>{t.riskLevel}</Badge>
                        </td>
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setSelectedTradeId(t.tradeId)}>
                              View Trade
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => syncTrade.mutate(t.tradeId)}
                              disabled={!canPerform(role, "sync") || frozen || syncTrade.isPending}
                            >
                              Sync Trade
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => reconcileTrade.mutate(t.tradeId)}
                              disabled={!canPerform(role, "reconcile") || frozen || reconcileTrade.isPending}
                            >
                              Reconcile Trade
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDetailTab("Lifecycle")}>
                              View Lifecycle
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDetailTab("Identity")}>
                              View Execution Feedback
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDetailTab("Lifecycle")}>
                              View MT5 Events
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDetailTab("Audit")}>
                              View Audit Trail
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!tradeRows.length ? (
                    <tr>
                      <td colSpan={29} className="px-4 py-10 text-center text-sm font-semibold text-slate-600">
                        No trades match the current search/filter criteria.
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
                    <p className="text-xs font-semibold uppercase text-blue-600">Trade Detail Panel</p>
                    <CardTitle className="mt-1 text-2xl">{selectedTrade ? `Trade ${selectedTrade.tradeId}` : "Select a trade"}</CardTitle>
                    <CardDescription className="mt-2">
                      Trade identity, state, lifecycle stage, financial result, reconciliation deltas, modifications, and audit trail.
                    </CardDescription>
                  </div>
                  {selectedTrade ? <Badge variant={badgeVariantForSyncStatus(selectedTrade.syncStatus)}>{selectedTrade.syncStatus}</Badge> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(["Identity", "Lifecycle", "Reconciliation", "Modifications", "Audit"] as const).map((t) => (
                    <TabPill key={t} active={detailTab === t} onClick={() => setDetailTab(t)}>
                      {t}
                    </TabPill>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ScrollArea className="h-[610px] pr-3">
                {!selectedTrade ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-semibold text-slate-700">
                    Select a trade in the table to view identity, lifecycle, reconciliation, modifications, and audit trail.
                  </div>
                ) : detailTab === "Identity" ? (
                  <TradeIdentityPanel trade={selectedTrade} frozen={frozen} />
                ) : detailTab === "Lifecycle" ? (
                  <TradeLifecyclePanel events={lifecycleQuery.data ?? []} loading={lifecycleQuery.isLoading} />
                ) : detailTab === "Reconciliation" ? (
                  <TradeReconciliationPanel data={reconciliationQuery.data ?? null} loading={reconciliationQuery.isLoading} />
                ) : detailTab === "Modifications" ? (
                  <TradeModificationsPanel data={modificationsQuery.data ?? []} loading={modificationsQuery.isLoading} />
                ) : (
                  <TradeAuditPanel logs={filteredTradeLogs} loading={logsQuery.isLoading} />
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">Sync Exceptions & Logs</p>
                <CardTitle className="mt-1 text-2xl">Failure analysis and retry signals</CardTitle>
                <CardDescription className="mt-2">
                  Timestamp, trade/ticket, severity, root cause, retries, resolution status, and AI explanation across MT5 trade sync operations.
                </CardDescription>
              </div>
              <select
                value={exceptionFilter}
                onChange={(e) => setExceptionFilter(e.target.value as typeof exceptionFilter)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900"
              >
                {[
                  "All",
                  "Failed Sync",
                  "Missing Ticket",
                  "State Mismatch",
                  "Volume Mismatch",
                  "SL/TP Mismatch",
                  "Missing Close Event",
                  "P/L Mismatch",
                  "Duplicate Ticket",
                  "Resolved",
                  "Unresolved"
                ].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <ExceptionLogTable logs={displayedExceptionLogs} loading={logsQuery.isLoading || exceptionsQuery.isLoading} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-blue-600">AI Trade Sync Diagnostics</p>
                <CardTitle className="mt-1 text-2xl">Issue detection, impact, and remediation</CardTitle>
                <CardDescription className="mt-2">
                  Detects missing trades/tickets, mismatches, partial fill drift, delayed feedback, abnormal modification sequences, unsafe stale trade state, and reconciliation risk.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => autoRemediate.mutate()}
                  disabled={!canPerform(role, "diagnostics") || frozen || autoRemediate.isPending}
                  title={!canPerform(role, "diagnostics") ? "Requires Infrastructure Admin, Trading Admin, or Super Admin" : undefined}
                >
                  <Wrench className="h-4 w-4" />
                  Auto-Remediate
                </Button>
                <Button variant="outline" onClick={() => diagnosticsQuery.refetch()}>
                  <RefreshCw className={cn("h-4 w-4", diagnosticsQuery.isFetching ? "animate-spin" : "")} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <AiDiagnosticsTable diagnostics={diagnosticsQuery.data?.diagnostics ?? []} loading={diagnosticsQuery.isLoading} onSelectTrade={setSelectedTradeId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KeyValueGrid({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">{it.label}</p>
          <div className="mt-1 text-sm font-semibold text-slate-950">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

function TradeIdentityPanel({ trade, frozen }: { trade: TradeSyncTrade; frozen: boolean }) {
  const floating = trade.floatingProfitLoss;
  const realized = trade.realizedProfitLoss;
  const net = trade.netProfitLoss;

  return (
    <div className="space-y-4">
      {frozen ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
          Emergency freeze is active. Synchronization and reconciliation actions are blocked until state is validated.
        </div>
      ) : null}

      <div className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Trade Identity</p>
          <div className="mt-2">
            <KeyValueGrid
              items={[
                { label: "Trade ID", value: trade.tradeId },
                { label: "MT5 Ticket", value: trade.mt5Ticket ?? "—" },
                { label: "Order ID", value: trade.orderId ?? "—" },
                { label: "Signal ID", value: trade.signalId ?? "—" },
                { label: "Strategy ID", value: trade.strategyId ?? "—" },
                { label: "Account", value: trade.account },
                { label: "Broker", value: trade.broker },
                { label: "Terminal", value: trade.terminal },
                { label: "EA Instance", value: trade.eaInstance }
              ]}
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Trade Instruction</p>
          <div className="mt-2">
            <KeyValueGrid
              items={[
                { label: "Symbol", value: trade.symbol },
                { label: "Direction", value: <Badge variant={trade.direction === "Buy" ? "success" : "destructive"}>{trade.direction}</Badge> },
                { label: "Order Type", value: trade.orderType },
                { label: "Requested Volume", value: formatNumber(trade.volumeRequested, 2) },
                { label: "Filled Volume", value: formatNumber(trade.volumeFilled, 2) },
                { label: "Entry Price", value: formatNumber(trade.entryPrice, 5) },
                { label: "Current Price", value: formatNumber(trade.currentPrice, 5) },
                { label: "Stop Loss", value: trade.stopLoss == null ? "—" : formatNumber(trade.stopLoss, 5) },
                { label: "Take Profit", value: trade.takeProfit == null ? "—" : formatNumber(trade.takeProfit, 5) }
              ]}
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Trade State</p>
          <div className="mt-2">
            <KeyValueGrid
              items={[
                { label: "Trade Status", value: <Badge variant={trade.tradeStatus === "Open" ? "success" : trade.tradeStatus === "Pending" ? "warning" : "secondary"}>{trade.tradeStatus}</Badge> },
                { label: "Nexus State", value: trade.nexusState },
                { label: "MT5 State", value: trade.mt5State },
                { label: "Sync Status", value: <Badge variant={badgeVariantForSyncStatus(trade.syncStatus)}>{trade.syncStatus}</Badge> },
                { label: "State Match", value: <Badge variant={badgeVariantForMatchStatus(trade.stateMatchStatus)}>{trade.stateMatchStatus}</Badge> },
                { label: "Last MT5 Update", value: formatIsoTime(trade.lastMt5UpdateAt) },
                { label: "Last Nexus Update", value: formatIsoTime(trade.lastNexusUpdateAt) },
                { label: "Last Sync Time", value: formatIsoTime(trade.lastSyncAt) },
                { label: "Sync Delay", value: formatSeconds(trade.syncDelaySeconds) }
              ]}
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Financial Result</p>
          <div className="mt-2">
            <KeyValueGrid
              items={[
                { label: "Floating P/L", value: <span className={cn(floating >= 0 ? "text-emerald-700" : "text-red-700")}>{formatUsd(floating)}</span> },
                { label: "Realized P/L", value: <span className={cn(realized >= 0 ? "text-emerald-700" : "text-red-700")}>{formatUsd(realized)}</span> },
                { label: "Swap", value: formatUsd(trade.swap) },
                { label: "Commission", value: formatUsd(trade.commission) },
                { label: "Net P/L", value: <span className={cn(net >= 0 ? "text-emerald-700" : "text-red-700")}>{formatUsd(net)}</span> },
                { label: "Margin Used", value: formatUsd(trade.marginUsed) },
                { label: "Open Time", value: formatIsoTime(trade.openTime) },
                { label: "Close Time", value: formatIsoTime(trade.closeTime) },
                { label: "Risk Level", value: <Badge variant={trade.riskLevel === "Critical" ? "destructive" : trade.riskLevel === "High" ? "warning" : "secondary"}>{trade.riskLevel}</Badge> }
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TradeLifecyclePanel({ events, loading }: { events: TradeLifecycleEvent[]; loading: boolean }) {
  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">Loading lifecycle…</div>;
  }
  return (
    <div className="space-y-3">
      {events.map((e) => (
        <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">{e.eventType}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">
                {new Date(e.timestamp).toLocaleString()} · Source: {e.source} · Latency: {formatNumber(e.latencyMs, 0)}ms
              </p>
            </div>
            <Badge variant={e.result === "Ok" ? "success" : e.result === "Warn" ? "warning" : "destructive"}>{e.result}</Badge>
          </div>
          <div className="mt-2 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
            <div>
              <p className="font-semibold text-slate-500">Status before</p>
              <p className="font-semibold text-slate-900">{e.statusBefore}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-500">Status after</p>
              <p className="font-semibold text-slate-900">{e.statusAfter}</p>
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600">{e.message}</p>
        </div>
      ))}
      {!events.length ? <div className="text-sm font-semibold text-slate-600">No lifecycle events available.</div> : null}
    </div>
  );
}

function TradeReconciliationPanel({ data, loading }: { data: TradeReconciliationResponse | null; loading: boolean }) {
  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">Loading reconciliation…</div>;
  }
  if (!data || !data.comparisons.length) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">No reconciliation data available.</div>;
  }
  return (
    <div className="space-y-3">
      {data.comparisons.map((c) => (
        <div key={c.key} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-950">{c.label}</p>
            <Badge variant={badgeVariantForMatchStatus(c.status)}>{c.status}</Badge>
          </div>
          <div className="mt-2 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className="font-semibold text-slate-500">Nexus</p>
              <p className="font-semibold text-slate-900">{c.nexusValue}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <p className="font-semibold text-slate-500">MT5</p>
              <p className="font-semibold text-slate-900">{c.mt5Value}</p>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-700">
            <span className="font-semibold text-slate-500">Difference:</span> <span className="font-semibold text-slate-900">{c.difference}</span>
          </div>
          <div className="mt-1 text-xs text-slate-700">
            <span className="font-semibold text-slate-500">Required action:</span> <span className="font-semibold text-slate-900">{c.requiredAction}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TradeModificationsPanel({ data, loading }: { data: TradeModification[]; loading: boolean }) {
  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">Loading modifications…</div>;
  }
  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-[900px] border-collapse">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            {["Modification ID", "Type", "Old", "New", "Source", "Status", "Applied At", "Synced At", "Result"].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((m) => (
            <tr key={m.id} className="border-b border-slate-100">
              <td className="px-3 py-2 text-sm font-semibold text-slate-950">{m.modificationId}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{m.modificationType}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{m.oldValue}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{m.newValue}</td>
              <td className="px-3 py-2">
                <Badge variant={m.source === "MT5" ? "purple" : "secondary"}>{m.source}</Badge>
              </td>
              <td className="px-3 py-2">
                <Badge variant={m.status === "Applied" ? "success" : m.status === "Pending" ? "warning" : "destructive"}>{m.status}</Badge>
              </td>
              <td className="px-3 py-2 text-sm text-slate-700">{new Date(m.appliedAt).toLocaleTimeString()}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{m.syncedAt ? new Date(m.syncedAt).toLocaleTimeString() : "—"}</td>
              <td className="px-3 py-2">
                <Badge variant={m.syncResult === "Ok" ? "success" : m.syncResult === "Warn" ? "warning" : "destructive"}>{m.syncResult}</Badge>
              </td>
            </tr>
          ))}
          {!data.length ? (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-sm font-semibold text-slate-600">
                No modifications recorded.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function TradeAuditPanel({ logs, loading }: { logs: TradeSyncLogEntry[]; loading: boolean }) {
  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">Loading audit trail…</div>;
  }
  return (
    <div className="space-y-3">
      {logs.map((l) => (
        <div key={l.id} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">{l.exceptionType}</p>
              <p className="mt-1 text-xs font-semibold text-slate-600">
                {new Date(l.timestamp).toLocaleString()} · Trade: {l.tradeId ?? "—"} · Ticket: {l.mt5Ticket ?? "—"}
              </p>
            </div>
            <Badge variant={l.severity === "Critical" ? "destructive" : l.severity === "Warning" ? "warning" : "secondary"}>{l.severity}</Badge>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-700">
            <span className="font-semibold text-slate-500">Message:</span> <span className="font-semibold text-slate-900">{l.errorMessage}</span>
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            <span className="font-semibold text-slate-500">Root cause:</span> {l.rootCause} · Retries: {l.retryCount} · Status: {l.resolutionStatus}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-600">{l.aiExplanation}</p>
        </div>
      ))}
      {!logs.length ? <div className="text-sm font-semibold text-slate-600">No audit entries available.</div> : null}
    </div>
  );
}

function ExceptionLogTable({ logs, loading }: { logs: TradeSyncLogEntry[]; loading: boolean }) {
  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">Loading logs…</div>;
  }
  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-[980px] border-collapse">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            {["Timestamp", "Trade ID", "MT5 Ticket", "Account", "Broker", "Type", "Severity", "Message", "Root Cause", "Retries", "Status"].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id} className="border-b border-slate-100">
              <td className="px-3 py-2 text-sm text-slate-700">{new Date(l.timestamp).toLocaleTimeString()}</td>
              <td className="px-3 py-2 text-sm font-semibold text-slate-950">{l.tradeId ?? "—"}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{l.mt5Ticket ?? "—"}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{l.account ?? "—"}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{l.broker ?? "—"}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{l.exceptionType}</td>
              <td className="px-3 py-2">
                <Badge variant={l.severity === "Critical" ? "destructive" : l.severity === "Warning" ? "warning" : "secondary"}>{l.severity}</Badge>
              </td>
              <td className="px-3 py-2 text-sm text-slate-700">{l.errorMessage}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{l.rootCause}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{l.retryCount}</td>
              <td className="px-3 py-2">
                <Badge variant={l.resolutionStatus === "Resolved" ? "success" : "warning"}>{l.resolutionStatus}</Badge>
              </td>
            </tr>
          ))}
          {!logs.length ? (
            <tr>
              <td colSpan={11} className="px-4 py-8 text-center text-sm font-semibold text-slate-600">
                No log entries available.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function AiDiagnosticsTable({
  diagnostics,
  loading,
  onSelectTrade
}: {
  diagnostics: AiTradeSyncDiagnostic[];
  loading: boolean;
  onSelectTrade: (tradeId: string | null) => void;
}) {
  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700">Loading diagnostics…</div>;
  }
  return (
    <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-[980px] border-collapse">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200">
            {["Issue", "Trade", "Ticket", "Severity", "Root Cause", "Impact", "Recommended Action", "Auto-Fix", "Confidence", "Actions"].map((h) => (
              <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {diagnostics.map((d) => (
            <tr key={d.id} className="border-b border-slate-100">
              <td className="px-3 py-2 text-sm font-semibold text-slate-950">{d.issue}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{d.affectedTradeId ?? "—"}</td>
              <td className="px-3 py-2 text-sm text-slate-700">{d.affectedTicket ?? "—"}</td>
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
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectTrade(d.affectedTradeId ?? null)}
                    disabled={!d.affectedTradeId}
                  >
                    View Trade
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          {!diagnostics.length ? (
            <tr>
              <td colSpan={10} className="px-4 py-8 text-center text-sm font-semibold text-slate-600">
                No diagnostics issues detected.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
