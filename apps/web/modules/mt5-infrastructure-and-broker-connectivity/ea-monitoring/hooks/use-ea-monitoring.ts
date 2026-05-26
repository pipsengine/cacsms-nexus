"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  autoRemediate,
  disableEaTrading,
  enableEaTrading,
  exportEaReport,
  fetchAiDiagnostics,
  fetchAnalytics,
  fetchAuditTrail,
  fetchCommands,
  fetchEaSummary,
  fetchExceptions,
  fetchInstance,
  fetchInstances,
  fetchLogs,
  fetchStrategyBindings,
  fetchWorkflow,
  rebindStrategy,
  rebindTerminal,
  restartEaSession,
  runEaDiagnostics,
  syncEaStatus
} from "../services/ea-monitoring.service";
import { useEaMonitoringStore } from "../stores/ea-monitoring.store";

export function useEaMonitoring() {
  const client = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);

  const searchTerm = useEaMonitoringStore((s) => s.searchTerm);
  const statusFilter = useEaMonitoringStore((s) => s.statusFilter);
  const riskFilter = useEaMonitoringStore((s) => s.riskFilter);
  const tradingFilter = useEaMonitoringStore((s) => s.tradingFilter);
  const selectedEaId = useEaMonitoringStore((s) => s.selectedEaId);
  const logsFilter = useEaMonitoringStore((s) => s.logsFilter);

  useEffect(() => {
    const source = new EventSource("/api/mt5/ea-monitoring/events-stream");
    source.addEventListener("ea-monitoring-snapshot", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { summary: unknown };
      client.setQueryData(["ea-monitoring", "summary"], payload.summary);
      client.invalidateQueries({ queryKey: ["ea-monitoring", "instances"] });
      client.invalidateQueries({ queryKey: ["ea-monitoring", "commands"] });
      client.invalidateQueries({ queryKey: ["ea-monitoring", "logs"] });
      client.invalidateQueries({ queryKey: ["ea-monitoring", "exceptions"] });
      client.invalidateQueries({ queryKey: ["ea-monitoring", "ai-diagnostics"] });
      client.invalidateQueries({ queryKey: ["ea-monitoring", "audit"] });
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [client]);

  const summary = useQuery({ queryKey: ["ea-monitoring", "summary"], queryFn: fetchEaSummary, staleTime: 5_000, refetchInterval: 12_000, retry: 1 });
  const workflow = useQuery({ queryKey: ["ea-monitoring", "workflow"], queryFn: fetchWorkflow, staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const instances = useQuery({
    queryKey: ["ea-monitoring", "instances", { searchTerm, statusFilter, riskFilter, tradingFilter }],
    queryFn: () =>
      fetchInstances({
        search: searchTerm,
        status: statusFilter === "all" ? undefined : statusFilter,
        risk: riskFilter === "all" ? undefined : riskFilter,
        trading: tradingFilter === "all" ? undefined : tradingFilter,
        page: 1,
        pageSize: 75
      }),
    staleTime: 4_000,
    refetchInterval: 8_000,
    retry: 1
  });

  const instance = useQuery({
    queryKey: ["ea-monitoring", "instance", selectedEaId],
    queryFn: () => fetchInstance(selectedEaId as string),
    enabled: Boolean(selectedEaId),
    staleTime: 5_000,
    retry: 1
  });

  const commands = useQuery({ queryKey: ["ea-monitoring", "commands"], queryFn: () => fetchCommands({ page: 1, pageSize: 75 }), staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const bindings = useQuery({ queryKey: ["ea-monitoring", "strategy-bindings"], queryFn: fetchStrategyBindings, staleTime: 15_000, refetchInterval: 30_000, retry: 1 });
  const logs = useQuery({ queryKey: ["ea-monitoring", "logs", logsFilter], queryFn: () => fetchLogs(logsFilter === "All" ? undefined : logsFilter.toLowerCase()), staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const exceptions = useQuery({ queryKey: ["ea-monitoring", "exceptions", logsFilter], queryFn: () => fetchExceptions(logsFilter === "All" ? undefined : logsFilter.toLowerCase()), staleTime: 10_000, refetchInterval: 25_000, retry: 1 });
  const analytics = useQuery({ queryKey: ["ea-monitoring", "analytics"], queryFn: fetchAnalytics, staleTime: 20_000, refetchInterval: 35_000, retry: 1 });
  const diagnostics = useQuery({ queryKey: ["ea-monitoring", "ai-diagnostics"], queryFn: fetchAiDiagnostics, staleTime: 12_000, refetchInterval: 25_000, retry: 1 });
  const audit = useQuery({ queryKey: ["ea-monitoring", "audit"], queryFn: fetchAuditTrail, staleTime: 12_000, refetchInterval: 25_000, retry: 1 });

  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ["ea-monitoring"] });
  };

  const sync = useMutation({ mutationFn: syncEaStatus, onSuccess: invalidate });
  const runDiagnostics = useMutation({ mutationFn: (eaId?: string) => runEaDiagnostics(eaId), onSuccess: invalidate });
  const restart = useMutation({ mutationFn: (eaId: string) => restartEaSession(eaId), onSuccess: invalidate });
  const disableTrading = useMutation({ mutationFn: (eaId: string) => disableEaTrading(eaId), onSuccess: invalidate });
  const enableTrading = useMutation({ mutationFn: (eaId: string) => enableEaTrading(eaId), onSuccess: invalidate });
  const rebindStrat = useMutation({ mutationFn: ({ eaId, payload }: { eaId: string; payload: any }) => rebindStrategy(eaId, payload), onSuccess: invalidate });
  const rebindTerm = useMutation({ mutationFn: ({ eaId, payload }: { eaId: string; payload: any }) => rebindTerminal(eaId, payload), onSuccess: invalidate });
  const remediate = useMutation({ mutationFn: (eaId: string) => autoRemediate({ eaId }), onSuccess: invalidate });
  const exportReport = useMutation({ mutationFn: exportEaReport });

  return {
    streamConnected,
    summary,
    workflow,
    instances,
    instance,
    commands,
    bindings,
    logs,
    exceptions,
    analytics,
    diagnostics,
    audit,
    actions: { sync, runDiagnostics, restart, disableTrading, enableTrading, rebindStrat, rebindTerm, remediate, exportReport }
  };
}

