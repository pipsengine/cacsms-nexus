"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  autoRemediate,
  escalateError,
  exportErrorReport,
  fetchAiDiagnostics,
  fetchAuditTrail,
  fetchCategories,
  fetchErrorLog,
  fetchErrorLogs,
  fetchErrorLogsSummary,
  fetchIncidents,
  fetchRepeated,
  fetchResolutions,
  fetchTrends,
  fetchWorkflow,
  reopenError,
  resolveError,
  runErrorDiagnostics,
  syncLatestErrors
} from "../services/mt5-error-logs.service";
import { useMt5ErrorLogsStore } from "../stores/mt5-error-logs.store";

export function useMt5ErrorLogs() {
  const client = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);

  const searchTerm = useMt5ErrorLogsStore((s) => s.searchTerm);
  const severityFilter = useMt5ErrorLogsStore((s) => s.severityFilter);
  const moduleFilter = useMt5ErrorLogsStore((s) => s.moduleFilter);
  const statusFilter = useMt5ErrorLogsStore((s) => s.statusFilter);
  const brokerFilter = useMt5ErrorLogsStore((s) => s.brokerFilter);
  const selectedErrorId = useMt5ErrorLogsStore((s) => s.selectedErrorId);

  useEffect(() => {
    const isMock = typeof window !== "undefined" && window.location.search.includes("mock=1");
    if (isMock) return;

    const source = new EventSource("/api/mt5/error-logs/events-stream");
    source.addEventListener("error-logs-snapshot", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { summary: unknown };
      client.setQueryData(["mt5-error-logs", "summary"], payload.summary);
      client.invalidateQueries({ queryKey: ["mt5-error-logs", "errors"] });
      client.invalidateQueries({ queryKey: ["mt5-error-logs", "categories"] });
      client.invalidateQueries({ queryKey: ["mt5-error-logs", "repeated"] });
      client.invalidateQueries({ queryKey: ["mt5-error-logs", "incidents"] });
      client.invalidateQueries({ queryKey: ["mt5-error-logs", "ai-diagnostics"] });
      client.invalidateQueries({ queryKey: ["mt5-error-logs", "audit"] });
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [client]);

  const summary = useQuery({ queryKey: ["mt5-error-logs", "summary"], queryFn: fetchErrorLogsSummary, staleTime: 5_000, refetchInterval: 12_000, retry: 1 });
  const workflow = useQuery({ queryKey: ["mt5-error-logs", "workflow"], queryFn: fetchWorkflow, staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const errors = useQuery({
    queryKey: ["mt5-error-logs", "errors", { searchTerm, severityFilter, moduleFilter, statusFilter, brokerFilter }],
    queryFn: () =>
      fetchErrorLogs({
        search: searchTerm,
        severity: severityFilter === "all" ? undefined : severityFilter,
        module: moduleFilter === "all" ? undefined : moduleFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
        brokerId: brokerFilter === "all" ? undefined : brokerFilter,
        page: 1,
        pageSize: 75
      }),
    staleTime: 4_000,
    refetchInterval: 8_000,
    retry: 1
  });

  const error = useQuery({
    queryKey: ["mt5-error-logs", "error", selectedErrorId],
    queryFn: () => fetchErrorLog(selectedErrorId as string),
    enabled: Boolean(selectedErrorId),
    staleTime: 5_000,
    retry: 1
  });

  const categories = useQuery({ queryKey: ["mt5-error-logs", "categories"], queryFn: fetchCategories, staleTime: 10_000, refetchInterval: 25_000, retry: 1 });
  const trends = useQuery({ queryKey: ["mt5-error-logs", "trends"], queryFn: fetchTrends, staleTime: 10_000, refetchInterval: 25_000, retry: 1 });
  const repeated = useQuery({ queryKey: ["mt5-error-logs", "repeated"], queryFn: fetchRepeated, staleTime: 10_000, refetchInterval: 25_000, retry: 1 });
  const incidents = useQuery({ queryKey: ["mt5-error-logs", "incidents"], queryFn: fetchIncidents, staleTime: 10_000, refetchInterval: 25_000, retry: 1 });
  const diagnostics = useQuery({ queryKey: ["mt5-error-logs", "ai-diagnostics"], queryFn: fetchAiDiagnostics, staleTime: 10_000, refetchInterval: 25_000, retry: 1 });
  const resolutions = useQuery({ queryKey: ["mt5-error-logs", "resolutions"], queryFn: fetchResolutions, staleTime: 15_000, refetchInterval: 35_000, retry: 1 });
  const audit = useQuery({ queryKey: ["mt5-error-logs", "audit"], queryFn: fetchAuditTrail, staleTime: 10_000, refetchInterval: 25_000, retry: 1 });

  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ["mt5-error-logs"] });
  };

  const refreshLogs = useMutation({ mutationFn: syncLatestErrors, onSuccess: invalidate });
  const runDiagnostics = useMutation({ mutationFn: (errorId?: string) => runErrorDiagnostics(errorId), onSuccess: invalidate });
  const markResolved = useMutation({ mutationFn: ({ errorId, payload }: { errorId: string; payload: { resolutionAction: string; resolutionNote: string; assignedTo?: string | null } }) => resolveError(errorId, payload), onSuccess: invalidate });
  const reopen = useMutation({ mutationFn: ({ errorId, payload }: { errorId: string; payload: { reopenReason: string } }) => reopenError(errorId, payload), onSuccess: invalidate });
  const escalate = useMutation({ mutationFn: ({ errorId, payload }: { errorId: string; payload: { requiredAction: string; assignedRole?: any } }) => escalateError(errorId, payload as any), onSuccess: invalidate });
  const remediate = useMutation({ mutationFn: (errorId: string) => autoRemediate({ errorId }), onSuccess: invalidate });
  const exportReport = useMutation({ mutationFn: exportErrorReport });

  return {
    streamConnected,
    summary,
    workflow,
    errors,
    error,
    categories,
    trends,
    repeated,
    incidents,
    diagnostics,
    resolutions,
    audit,
    actions: { refreshLogs, runDiagnostics, markResolved, reopen, escalate, remediate, exportReport }
  };
}

