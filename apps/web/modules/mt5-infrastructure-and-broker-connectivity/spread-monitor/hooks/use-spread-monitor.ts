"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  autoRemediate,
  disableExecution,
  enableExecution,
  fetchAiDiagnostics,
  fetchAlerts,
  fetchBrokerComparison,
  fetchLogs,
  fetchSpreadSummary,
  fetchSpreads,
  fetchSymbolSpread,
  fetchThresholds,
  fetchTrends,
  patchThreshold,
  runSpreadDiagnostics
} from "../services/spread-monitor.service";
import { useSpreadMonitorStore } from "../stores/spread-monitor.store";

export function useSpreadMonitor() {
  const client = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);

  const searchTerm = useSpreadMonitorStore((s) => s.searchTerm);
  const assetFilter = useSpreadMonitorStore((s) => s.assetFilter);
  const statusFilter = useSpreadMonitorStore((s) => s.statusFilter);
  const brokerFilter = useSpreadMonitorStore((s) => s.brokerFilter);
  const selectedSymbol = useSpreadMonitorStore((s) => s.selectedSymbol);
  const alertFilter = useSpreadMonitorStore((s) => s.alertFilter);

  useEffect(() => {
    const isMock = typeof window !== "undefined" && window.location.search.includes("mock=1");
    if (isMock) return;

    const source = new EventSource("/api/mt5/spread-monitor/events-stream");
    source.addEventListener("spread-monitor-snapshot", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { summary: unknown; spreads: unknown; thresholds: unknown; alerts: unknown };
      client.setQueryData(["spread-monitor", "summary"], payload.summary);
      client.invalidateQueries({ queryKey: ["spread-monitor", "spreads"] });
      client.invalidateQueries({ queryKey: ["spread-monitor", "thresholds"] });
      client.invalidateQueries({ queryKey: ["spread-monitor", "alerts"] });
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [client]);

  const summary = useQuery({ queryKey: ["spread-monitor", "summary"], queryFn: fetchSpreadSummary, staleTime: 5_000, refetchInterval: 12_000, retry: 1 });
  const spreads = useQuery({
    queryKey: ["spread-monitor", "spreads", { searchTerm, assetFilter, statusFilter, brokerFilter }],
    queryFn: () => fetchSpreads({ search: searchTerm, assetClass: assetFilter === "all" ? undefined : assetFilter, status: statusFilter, brokerId: brokerFilter === "all" ? undefined : brokerFilter, page: 1, pageSize: 75 }),
    staleTime: 4_000,
    refetchInterval: 8_000,
    retry: 1
  });

  const symbol = useQuery({
    queryKey: ["spread-monitor", "symbol", selectedSymbol],
    queryFn: () => fetchSymbolSpread(selectedSymbol as string),
    enabled: Boolean(selectedSymbol),
    staleTime: 5_000,
    retry: 1
  });

  const brokerComparison = useQuery({ queryKey: ["spread-monitor", "broker-comparison"], queryFn: fetchBrokerComparison, staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const trends = useQuery({ queryKey: ["spread-monitor", "trends"], queryFn: fetchTrends, staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const thresholds = useQuery({ queryKey: ["spread-monitor", "thresholds"], queryFn: fetchThresholds, staleTime: 15_000, refetchInterval: 30_000, retry: 1 });
  const alerts = useQuery({
    queryKey: ["spread-monitor", "alerts", alertFilter],
    queryFn: () => fetchAlerts(alertFilter === "All" ? undefined : alertFilter === "Unresolved" ? "unresolved" : alertFilter === "Resolved" ? "resolved" : alertFilter.toLowerCase()),
    staleTime: 6_000,
    refetchInterval: 12_000,
    retry: 1
  });
  const logs = useQuery({ queryKey: ["spread-monitor", "logs"], queryFn: () => fetchLogs(), staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const diagnostics = useQuery({ queryKey: ["spread-monitor", "ai-diagnostics"], queryFn: fetchAiDiagnostics, staleTime: 10_000, refetchInterval: 25_000, retry: 1 });

  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ["spread-monitor"] });
  };

  const runDiagnostics = useMutation({ mutationFn: runSpreadDiagnostics, onSuccess: invalidate });
  const disableSymbolExecution = useMutation({ mutationFn: (symbolId: string) => disableExecution(symbolId), onSuccess: invalidate });
  const enableSymbolExecution = useMutation({ mutationFn: (symbolId: string) => enableExecution(symbolId), onSuccess: invalidate });
  const updateThreshold = useMutation({ mutationFn: ({ thresholdId, patch }: { thresholdId: string; patch: Record<string, unknown> }) => patchThreshold(thresholdId, patch as any), onSuccess: invalidate });
  const autoFix = useMutation({ mutationFn: autoRemediate, onSuccess: invalidate });

  return {
    streamConnected,
    summary,
    spreads,
    symbol,
    brokerComparison,
    trends,
    thresholds,
    alerts,
    logs,
    diagnostics,
    actions: { runDiagnostics, disableSymbolExecution, enableSymbolExecution, updateThreshold, autoFix }
  };
}

