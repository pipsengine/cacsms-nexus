"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  autoRemediate,
  disableUnsafeExecution,
  fetchAiDiagnostics,
  fetchAlerts,
  fetchBrokerComparison,
  fetchExecution,
  fetchExecutions,
  fetchLogs,
  fetchSlippageSummary,
  fetchThresholds,
  fetchTrends,
  fetchWorkflow,
  patchThreshold,
  runDiagnostics
} from "../services/slippage-monitor.service";
import { useSlippageMonitorStore } from "../stores/slippage-monitor.store";

export function useSlippageMonitor() {
  const client = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);

  const searchTerm = useSlippageMonitorStore((s) => s.searchTerm);
  const assetFilter = useSlippageMonitorStore((s) => s.assetFilter);
  const breachFilter = useSlippageMonitorStore((s) => s.breachFilter);
  const brokerFilter = useSlippageMonitorStore((s) => s.brokerFilter);
  const selectedExecutionId = useSlippageMonitorStore((s) => s.selectedExecutionId);
  const alertFilter = useSlippageMonitorStore((s) => s.alertFilter);

  useEffect(() => {
    const isMock = typeof window !== "undefined" && window.location.search.includes("mock=1");
    if (isMock) return;

    const source = new EventSource("/api/mt5/slippage-monitor/events-stream");
    source.addEventListener("slippage-monitor-snapshot", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { summary: unknown; executions: unknown; thresholds: unknown; alerts: unknown };
      client.setQueryData(["slippage-monitor", "summary"], payload.summary);
      client.invalidateQueries({ queryKey: ["slippage-monitor", "executions"] });
      client.invalidateQueries({ queryKey: ["slippage-monitor", "thresholds"] });
      client.invalidateQueries({ queryKey: ["slippage-monitor", "alerts"] });
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [client]);

  const summary = useQuery({ queryKey: ["slippage-monitor", "summary"], queryFn: fetchSlippageSummary, staleTime: 5_000, refetchInterval: 12_000, retry: 1 });
  const workflow = useQuery({ queryKey: ["slippage-monitor", "workflow"], queryFn: fetchWorkflow, staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const executions = useQuery({
    queryKey: ["slippage-monitor", "executions", { searchTerm, assetFilter, breachFilter, brokerFilter }],
    queryFn: () =>
      fetchExecutions({
        search: searchTerm,
        assetClass: assetFilter === "all" ? undefined : assetFilter,
        breach: breachFilter,
        brokerId: brokerFilter === "all" ? undefined : brokerFilter,
        page: 1,
        pageSize: 75
      }),
    staleTime: 4_000,
    refetchInterval: 8_000,
    retry: 1
  });

  const execution = useQuery({
    queryKey: ["slippage-monitor", "execution", selectedExecutionId],
    queryFn: () => fetchExecution(selectedExecutionId as string),
    enabled: Boolean(selectedExecutionId),
    staleTime: 5_000,
    retry: 1
  });

  const brokerComparison = useQuery({ queryKey: ["slippage-monitor", "broker-comparison"], queryFn: fetchBrokerComparison, staleTime: 10_000, refetchInterval: 25_000, retry: 1 });
  const trends = useQuery({ queryKey: ["slippage-monitor", "trends"], queryFn: fetchTrends, staleTime: 10_000, refetchInterval: 25_000, retry: 1 });
  const thresholds = useQuery({ queryKey: ["slippage-monitor", "thresholds"], queryFn: fetchThresholds, staleTime: 15_000, refetchInterval: 30_000, retry: 1 });
  const alerts = useQuery({
    queryKey: ["slippage-monitor", "alerts", alertFilter],
    queryFn: () => fetchAlerts(alertFilter === "All" ? undefined : alertFilter === "Unresolved" ? "unresolved" : alertFilter === "Resolved" ? "resolved" : alertFilter.toLowerCase()),
    staleTime: 6_000,
    refetchInterval: 12_000,
    retry: 1
  });
  const logs = useQuery({ queryKey: ["slippage-monitor", "logs"], queryFn: () => fetchLogs(), staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const diagnostics = useQuery({ queryKey: ["slippage-monitor", "ai-diagnostics"], queryFn: fetchAiDiagnostics, staleTime: 10_000, refetchInterval: 25_000, retry: 1 });

  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ["slippage-monitor"] });
  };

  const runSlippageDiagnostics = useMutation({ mutationFn: runDiagnostics, onSuccess: invalidate });
  const disableUnsafe = useMutation({ mutationFn: disableUnsafeExecution, onSuccess: invalidate });
  const updateThreshold = useMutation({ mutationFn: ({ thresholdId, patch }: { thresholdId: string; patch: Record<string, unknown> }) => patchThreshold(thresholdId, patch as any), onSuccess: invalidate });
  const autoFix = useMutation({ mutationFn: autoRemediate, onSuccess: invalidate });

  return {
    streamConnected,
    summary,
    workflow,
    executions,
    execution,
    brokerComparison,
    trends,
    thresholds,
    alerts,
    logs,
    diagnostics,
    actions: { runSlippageDiagnostics, disableUnsafe, updateThreshold, autoFix }
  };
}

