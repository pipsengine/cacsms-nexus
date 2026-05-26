"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchAiDiagnostics,
  fetchConnectionComponent,
  fetchConnectionComponents,
  fetchConnectionHealthSummary,
  fetchConnectionWorkflow,
  fetchDependencyMap,
  fetchHeartbeats,
  fetchIncidents,
  fetchLatency,
  fetchLogs,
  fetchPacketLoss,
  postAutoRemediate,
  postComponentDiagnostics,
  postComponentReconnect,
  postComponentRestart,
  postDisableTradingPath,
  postDisableUnsafeTrading,
  postReconnectFailedServices,
  postRestartUnhealthyChannels,
  postRunFullDiagnostics
} from "../services/connection-health.service";
import { useConnectionHealthStore } from "../stores/connection-health.store";

export function useConnectionHealth() {
  const client = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);

  const searchTerm = useConnectionHealthStore((s) => s.searchTerm);
  const typeFilter = useConnectionHealthStore((s) => s.typeFilter);
  const statusFilter = useConnectionHealthStore((s) => s.statusFilter);
  const incidentFilter = useConnectionHealthStore((s) => s.incidentFilter);
  const selectedComponentId = useConnectionHealthStore((s) => s.selectedComponentId);

  useEffect(() => {
    const source = new EventSource("/api/mt5/connection-health/events-stream");
    source.addEventListener("connection-health-snapshot", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { summary: unknown; components: unknown };
      client.setQueryData(["connection-health", "summary"], payload.summary);
      client.invalidateQueries({ queryKey: ["connection-health", "components"] });
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [client]);

  const summary = useQuery({ queryKey: ["connection-health", "summary"], queryFn: fetchConnectionHealthSummary, staleTime: 5_000, refetchInterval: 12_000, retry: 1 });
  const workflow = useQuery({ queryKey: ["connection-health", "workflow"], queryFn: fetchConnectionWorkflow, staleTime: 8_000, refetchInterval: 18_000, retry: 1 });
  const dependencyMap = useQuery({ queryKey: ["connection-health", "dependency-map"], queryFn: fetchDependencyMap, staleTime: 10_000, refetchInterval: 25_000, retry: 1 });
  const components = useQuery({
    queryKey: ["connection-health", "components", { searchTerm, typeFilter, statusFilter }],
    queryFn: () => fetchConnectionComponents({ search: searchTerm, type: typeFilter === "all" ? undefined : typeFilter, status: statusFilter, page: 1, pageSize: 60 }),
    staleTime: 6_000,
    refetchInterval: 12_000,
    retry: 1
  });

  const component = useQuery({
    queryKey: ["connection-health", "component", selectedComponentId],
    queryFn: () => fetchConnectionComponent(selectedComponentId as string),
    enabled: Boolean(selectedComponentId),
    staleTime: 5_000,
    retry: 1
  });

  const latency = useQuery({ queryKey: ["connection-health", "latency"], queryFn: fetchLatency, staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const packetLoss = useQuery({ queryKey: ["connection-health", "packet-loss"], queryFn: fetchPacketLoss, staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const heartbeats = useQuery({ queryKey: ["connection-health", "heartbeats"], queryFn: fetchHeartbeats, staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const incidents = useQuery({
    queryKey: ["connection-health", "incidents", incidentFilter],
    queryFn: () => fetchIncidents(incidentFilter === "All" ? undefined : incidentFilter === "Unresolved" ? "unresolved" : incidentFilter === "Resolved" ? "resolved" : incidentFilter.toLowerCase()),
    staleTime: 10_000,
    refetchInterval: 20_000,
    retry: 1
  });
  const logs = useQuery({ queryKey: ["connection-health", "logs"], queryFn: () => fetchLogs(), staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const diagnostics = useQuery({ queryKey: ["connection-health", "ai-diagnostics"], queryFn: fetchAiDiagnostics, staleTime: 10_000, refetchInterval: 25_000, retry: 1 });

  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ["connection-health"] });
  };

  const runFullDiagnostics = useMutation({ mutationFn: postRunFullDiagnostics, onSuccess: invalidate });
  const reconnectFailed = useMutation({ mutationFn: postReconnectFailedServices, onSuccess: invalidate });
  const restartUnhealthy = useMutation({ mutationFn: postRestartUnhealthyChannels, onSuccess: invalidate });
  const disableUnsafeTrading = useMutation({ mutationFn: postDisableUnsafeTrading, onSuccess: invalidate });
  const autoRemediate = useMutation({ mutationFn: postAutoRemediate, onSuccess: invalidate });

  const componentDiagnostics = useMutation({ mutationFn: (id: string) => postComponentDiagnostics(id), onSuccess: invalidate });
  const componentReconnect = useMutation({ mutationFn: (id: string) => postComponentReconnect(id), onSuccess: invalidate });
  const componentRestart = useMutation({ mutationFn: (id: string) => postComponentRestart(id), onSuccess: invalidate });
  const componentDisablePath = useMutation({ mutationFn: (id: string) => postDisableTradingPath(id), onSuccess: invalidate });

  return {
    summary,
    workflow,
    dependencyMap,
    components,
    component,
    latency,
    packetLoss,
    heartbeats,
    incidents,
    logs,
    diagnostics,
    streamConnected,
    actions: { runFullDiagnostics, reconnectFailed, restartUnhealthy, disableUnsafeTrading, autoRemediate, componentDiagnostics, componentReconnect, componentRestart, componentDisablePath }
  };
}

