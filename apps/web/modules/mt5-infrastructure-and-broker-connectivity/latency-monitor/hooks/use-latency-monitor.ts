"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  autoRemediate,
  disableRoute,
  enableRoute,
  fetchAiDiagnostics,
  fetchAlerts,
  fetchBrokerComparison,
  fetchLatencySummary,
  fetchLogs,
  fetchMetric,
  fetchMetrics,
  fetchThresholds,
  fetchTrends,
  fetchWorkflow,
  patchThreshold,
  runDiagnostics,
  testPing,
  testRoundTrip
} from "../services/latency-monitor.service";
import { useLatencyMonitorStore } from "../stores/latency-monitor.store";

export function useLatencyMonitor() {
  const client = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);

  const searchTerm = useLatencyMonitorStore((s) => s.searchTerm);
  const componentFilter = useLatencyMonitorStore((s) => s.componentFilter);
  const breachFilter = useLatencyMonitorStore((s) => s.breachFilter);
  const brokerFilter = useLatencyMonitorStore((s) => s.brokerFilter);
  const selectedMetricId = useLatencyMonitorStore((s) => s.selectedMetricId);
  const alertFilter = useLatencyMonitorStore((s) => s.alertFilter);

  useEffect(() => {
    const isMock = typeof window !== "undefined" && window.location.search.includes("mock=1");
    if (isMock) return;

    const source = new EventSource("/api/mt5/latency-monitor/events-stream");
    source.addEventListener("latency-monitor-snapshot", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { summary: unknown; metrics: unknown; thresholds: unknown; alerts: unknown };
      client.setQueryData(["latency-monitor", "summary"], payload.summary);
      client.invalidateQueries({ queryKey: ["latency-monitor", "metrics"] });
      client.invalidateQueries({ queryKey: ["latency-monitor", "thresholds"] });
      client.invalidateQueries({ queryKey: ["latency-monitor", "alerts"] });
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [client]);

  const summary = useQuery({ queryKey: ["latency-monitor", "summary"], queryFn: fetchLatencySummary, staleTime: 5_000, refetchInterval: 12_000, retry: 1 });
  const workflow = useQuery({ queryKey: ["latency-monitor", "workflow"], queryFn: fetchWorkflow, staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const metrics = useQuery({
    queryKey: ["latency-monitor", "metrics", { searchTerm, componentFilter, breachFilter, brokerFilter }],
    queryFn: () =>
      fetchMetrics({
        search: searchTerm,
        componentType: componentFilter === "all" ? undefined : componentFilter,
        breach: breachFilter,
        brokerId: brokerFilter === "all" ? undefined : brokerFilter,
        page: 1,
        pageSize: 75
      }),
    staleTime: 4_000,
    refetchInterval: 8_000,
    retry: 1
  });

  const metric = useQuery({
    queryKey: ["latency-monitor", "metric", selectedMetricId],
    queryFn: () => fetchMetric(selectedMetricId as string),
    enabled: Boolean(selectedMetricId),
    staleTime: 5_000,
    retry: 1
  });

  const brokerComparison = useQuery({ queryKey: ["latency-monitor", "broker-comparison"], queryFn: fetchBrokerComparison, staleTime: 10_000, refetchInterval: 25_000, retry: 1 });
  const trends = useQuery({ queryKey: ["latency-monitor", "trends"], queryFn: fetchTrends, staleTime: 10_000, refetchInterval: 25_000, retry: 1 });
  const thresholds = useQuery({ queryKey: ["latency-monitor", "thresholds"], queryFn: fetchThresholds, staleTime: 15_000, refetchInterval: 30_000, retry: 1 });
  const alerts = useQuery({
    queryKey: ["latency-monitor", "alerts", alertFilter],
    queryFn: () => fetchAlerts(alertFilter === "All" ? undefined : alertFilter === "Unresolved" ? "unresolved" : alertFilter === "Resolved" ? "resolved" : alertFilter.toLowerCase()),
    staleTime: 6_000,
    refetchInterval: 12_000,
    retry: 1
  });
  const logs = useQuery({ queryKey: ["latency-monitor", "logs"], queryFn: () => fetchLogs(), staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const diagnostics = useQuery({ queryKey: ["latency-monitor", "ai-diagnostics"], queryFn: fetchAiDiagnostics, staleTime: 10_000, refetchInterval: 25_000, retry: 1 });

  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ["latency-monitor"] });
  };

  const runLatencyDiagnostics = useMutation({ mutationFn: runDiagnostics, onSuccess: invalidate });
  const runPingTest = useMutation({ mutationFn: (metricId?: string) => testPing(metricId ? { metricId } : {}), onSuccess: invalidate });
  const runRoundTripTest = useMutation({ mutationFn: (metricId?: string) => testRoundTrip(metricId ? { metricId } : {}), onSuccess: invalidate });
  const updateThreshold = useMutation({ mutationFn: ({ thresholdId, patch }: { thresholdId: string; patch: Record<string, unknown> }) => patchThreshold(thresholdId, patch as any), onSuccess: invalidate });
  const blockRoute = useMutation({ mutationFn: (metricId: string) => disableRoute({ metricId }), onSuccess: invalidate });
  const unblockRoute = useMutation({ mutationFn: (metricId: string) => enableRoute({ metricId }), onSuccess: invalidate });
  const autoFix = useMutation({ mutationFn: autoRemediate, onSuccess: invalidate });

  return {
    streamConnected,
    summary,
    workflow,
    metrics,
    metric,
    brokerComparison,
    trends,
    thresholds,
    alerts,
    logs,
    diagnostics,
    actions: { runLatencyDiagnostics, runPingTest, runRoundTripTest, updateThreshold, blockRoute, unblockRoute, autoFix }
  };
}

