"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  autoRemediate,
  escalate,
  exportExecutionLogs,
  fetchAiDiagnostics,
  fetchAuditTrail,
  fetchBrokerResponse,
  fetchExceptions,
  fetchExecutionLog,
  fetchExecutionLogs,
  fetchExecutionLogsSummary,
  fetchQualityAnalytics,
  fetchRetryCancellation,
  fetchWorkflow,
  markReviewed,
  runDiagnostics,
  syncLatestExecutions
} from "../services/execution-logs.service";
import { useExecutionLogsStore } from "../stores/execution-logs.store";

export function useExecutionLogs() {
  const client = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);

  const searchTerm = useExecutionLogsStore((s) => s.searchTerm);
  const statusFilter = useExecutionLogsStore((s) => s.statusFilter);
  const brokerFilter = useExecutionLogsStore((s) => s.brokerFilter);
  const symbolFilter = useExecutionLogsStore((s) => s.symbolFilter);
  const reviewedFilter = useExecutionLogsStore((s) => s.reviewedFilter);
  const selectedLogId = useExecutionLogsStore((s) => s.selectedLogId);

  useEffect(() => {
    const source = new EventSource("/api/mt5/execution-logs/events-stream");
    source.addEventListener("execution-logs-snapshot", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { summary: unknown };
      client.setQueryData(["execution-logs", "summary"], payload.summary);
      client.invalidateQueries({ queryKey: ["execution-logs", "logs"] });
      client.invalidateQueries({ queryKey: ["execution-logs", "exceptions"] });
      client.invalidateQueries({ queryKey: ["execution-logs", "ai-diagnostics"] });
      client.invalidateQueries({ queryKey: ["execution-logs", "quality-analytics"] });
      client.invalidateQueries({ queryKey: ["execution-logs", "audit"] });
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [client]);

  const summary = useQuery({ queryKey: ["execution-logs", "summary"], queryFn: fetchExecutionLogsSummary, staleTime: 5_000, refetchInterval: 12_000, retry: 1 });
  const workflow = useQuery({ queryKey: ["execution-logs", "workflow"], queryFn: fetchWorkflow, staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const logs = useQuery({
    queryKey: ["execution-logs", "logs", { searchTerm, statusFilter, brokerFilter, symbolFilter, reviewedFilter }],
    queryFn: () =>
      fetchExecutionLogs({
        search: searchTerm,
        status: statusFilter === "all" ? undefined : statusFilter,
        brokerId: brokerFilter === "all" ? undefined : brokerFilter,
        symbol: symbolFilter === "all" ? undefined : symbolFilter,
        reviewed: reviewedFilter === "all" ? undefined : reviewedFilter,
        page: 1,
        pageSize: 75
      }),
    staleTime: 4_000,
    refetchInterval: 8_000,
    retry: 1
  });

  const log = useQuery({
    queryKey: ["execution-logs", "log", selectedLogId],
    queryFn: () => fetchExecutionLog(selectedLogId as string),
    enabled: Boolean(selectedLogId),
    staleTime: 5_000,
    retry: 1
  });

  const brokerResponse = useQuery({
    queryKey: ["execution-logs", "broker-response", selectedLogId],
    queryFn: () => fetchBrokerResponse(selectedLogId as string),
    enabled: Boolean(selectedLogId),
    staleTime: 10_000,
    retry: 1
  });

  const retryCancellation = useQuery({
    queryKey: ["execution-logs", "retry-cancellation", selectedLogId],
    queryFn: () => fetchRetryCancellation(selectedLogId as string),
    enabled: Boolean(selectedLogId),
    staleTime: 10_000,
    retry: 1
  });

  const qualityAnalytics = useQuery({ queryKey: ["execution-logs", "quality-analytics"], queryFn: fetchQualityAnalytics, staleTime: 15_000, refetchInterval: 30_000, retry: 1 });
  const exceptions = useQuery({ queryKey: ["execution-logs", "exceptions"], queryFn: () => fetchExceptions(), staleTime: 10_000, refetchInterval: 25_000, retry: 1 });
  const diagnostics = useQuery({ queryKey: ["execution-logs", "ai-diagnostics"], queryFn: fetchAiDiagnostics, staleTime: 10_000, refetchInterval: 25_000, retry: 1 });
  const audit = useQuery({ queryKey: ["execution-logs", "audit"], queryFn: fetchAuditTrail, staleTime: 10_000, refetchInterval: 25_000, retry: 1 });

  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ["execution-logs"] });
  };

  const refresh = useMutation({ mutationFn: syncLatestExecutions, onSuccess: invalidate });
  const runExecDiagnostics = useMutation({ mutationFn: (logId?: string) => runDiagnostics(logId), onSuccess: invalidate });
  const markAsReviewed = useMutation({ mutationFn: ({ logId, payload }: { logId: string; payload: { reviewedBy?: string } }) => markReviewed(logId, payload), onSuccess: invalidate });
  const escalateFailed = useMutation({ mutationFn: ({ logId, payload }: { logId: string; payload: { requiredAction: string } }) => escalate(logId, payload), onSuccess: invalidate });
  const remediate = useMutation({ mutationFn: (logId: string) => autoRemediate({ logId }), onSuccess: invalidate });
  const exportLogs = useMutation({ mutationFn: exportExecutionLogs });

  return {
    streamConnected,
    summary,
    workflow,
    logs,
    log,
    brokerResponse,
    retryCancellation,
    qualityAnalytics,
    exceptions,
    diagnostics,
    audit,
    actions: { refresh, runExecDiagnostics, markAsReviewed, escalateFailed, remediate, exportLogs }
  };
}

