"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { cancelAutomationRun, fetchDesktopAutomationHub, startTopDownAnalysis } from "../services/desktop-automation-hub.service";
import type { DesktopAutomationHubResponse, TopDownAnalysisInput } from "../types/desktop-automation-hub.types";

export function useDesktopAutomationHub() {
  const client = useQueryClient();
  const searchParams = useSearchParams();
  const terminalId = searchParams.get("terminalId");
  const [streamConnected, setStreamConnected] = useState(false);

  useEffect(() => {
    const query = terminalId ? `?terminalId=${encodeURIComponent(terminalId)}` : "";
    const source = new EventSource(`/api/autonomous-computer-operator/desktop-automation-hub/events-stream${query}`);
    source.addEventListener("desktop-automation-hub-snapshot", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as DesktopAutomationHubResponse;
      client.setQueryData(["desktop-automation-hub", terminalId ?? "all"], payload);
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [terminalId, client]);

  const query = useQuery({
    queryKey: ["desktop-automation-hub", terminalId ?? "all"],
    queryFn: () => fetchDesktopAutomationHub(terminalId),
    staleTime: 2_000,
    refetchInterval: 5_000,
    retry: 1
  });

  const startRun = useMutation({
    mutationFn: (input: TopDownAnalysisInput) => startTopDownAnalysis(input),
    onSuccess: (run) => {
      client.setQueryData<DesktopAutomationHubResponse>(["desktop-automation-hub", terminalId ?? "all"], (current) => {
        if (!current) return current;
        return {
          ...current,
          activeRun: null,
          recentRuns: [run, ...current.recentRuns.filter((entry) => entry.id !== run.id)],
          operator: { ...current.operator, lastCompletedAt: run.completedAt, activeRunId: null }
        };
      });
      client.invalidateQueries({ queryKey: ["desktop-automation-hub"] });
    }
  });

  const cancelRun = useMutation({
    mutationFn: (runId: string) => cancelAutomationRun(runId),
    onSuccess: () => client.invalidateQueries({ queryKey: ["desktop-automation-hub"] })
  });

  return { ...query, streamConnected, highlightedTerminalId: terminalId, startRun, cancelRun };
}
