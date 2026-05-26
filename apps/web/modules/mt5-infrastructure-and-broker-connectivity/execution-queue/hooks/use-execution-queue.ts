"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchBottlenecks,
  fetchExceptions,
  fetchExecutionFeedback,
  fetchExecutionQueueDiagnostics,
  fetchExecutionQueueItem,
  fetchExecutionQueueItems,
  fetchExecutionQueueLogs,
  fetchExecutionQueueSummary,
  fetchPrioritySla,
  postAutoRemediate,
  postCancelQueueItem,
  postEmergencyStopQueue,
  postPauseQueue,
  postProcessQueue,
  postReassignRoute,
  postResumeQueue,
  postRetryQueueItem,
  postValidateQueueItem
} from "../services/execution-queue.service";
import { useExecutionQueueStore } from "../stores/execution-queue.store";

export function useExecutionQueue() {
  const client = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);
  const searchTerm = useExecutionQueueStore((s) => s.searchTerm);
  const statusFilter = useExecutionQueueStore((s) => s.statusFilter);
  const priorityFilter = useExecutionQueueStore((s) => s.priorityFilter);
  const selectedQueueId = useExecutionQueueStore((s) => s.selectedQueueId);

  useEffect(() => {
    const source = new EventSource("/api/mt5/execution-queue/events-stream");
    source.addEventListener("queue-snapshot", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { summary: unknown; items: unknown };
      client.setQueryData(["execution-queue", "summary"], payload.summary);
      client.invalidateQueries({ queryKey: ["execution-queue", "items"] });
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [client]);

  const summary = useQuery({ queryKey: ["execution-queue", "summary"], queryFn: fetchExecutionQueueSummary, staleTime: 5_000, refetchInterval: 12_000, retry: 1 });
  const items = useQuery({
    queryKey: ["execution-queue", "items", { searchTerm, statusFilter, priorityFilter }],
    queryFn: () => fetchExecutionQueueItems({ search: searchTerm, status: statusFilter, priority: priorityFilter, page: 1, pageSize: 60 }),
    staleTime: 5_000,
    refetchInterval: 12_000,
    retry: 1
  });
  const item = useQuery({
    queryKey: ["execution-queue", "item", selectedQueueId],
    queryFn: () => fetchExecutionQueueItem(selectedQueueId as string),
    enabled: Boolean(selectedQueueId),
    staleTime: 5_000,
    retry: 1
  });

  const prioritySla = useQuery({ queryKey: ["execution-queue", "priority-sla"], queryFn: fetchPrioritySla, staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const bottlenecks = useQuery({ queryKey: ["execution-queue", "bottlenecks"], queryFn: fetchBottlenecks, staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const exceptions = useQuery({ queryKey: ["execution-queue", "exceptions"], queryFn: fetchExceptions, staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const feedback = useQuery({ queryKey: ["execution-queue", "execution-feedback"], queryFn: fetchExecutionFeedback, staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const logs = useQuery({ queryKey: ["execution-queue", "logs"], queryFn: fetchExecutionQueueLogs, staleTime: 10_000, refetchInterval: 20_000, retry: 1 });
  const diagnostics = useQuery({ queryKey: ["execution-queue", "ai-diagnostics"], queryFn: fetchExecutionQueueDiagnostics, staleTime: 10_000, refetchInterval: 20_000, retry: 1 });

  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ["execution-queue"] });
  };

  const processQueue = useMutation({ mutationFn: postProcessQueue, onSuccess: invalidate });
  const pauseQueue = useMutation({ mutationFn: postPauseQueue, onSuccess: invalidate });
  const resumeQueue = useMutation({ mutationFn: postResumeQueue, onSuccess: invalidate });
  const emergencyStop = useMutation({ mutationFn: postEmergencyStopQueue, onSuccess: invalidate });
  const autoRemediate = useMutation({ mutationFn: postAutoRemediate, onSuccess: invalidate });

  const validateItem = useMutation({ mutationFn: (queueId: string) => postValidateQueueItem(queueId), onSuccess: invalidate });
  const retryItem = useMutation({ mutationFn: (queueId: string) => postRetryQueueItem(queueId), onSuccess: invalidate });
  const cancelItem = useMutation({ mutationFn: (queueId: string) => postCancelQueueItem(queueId), onSuccess: invalidate });
  const reassignRoute = useMutation({ mutationFn: (queueId: string) => postReassignRoute(queueId), onSuccess: invalidate });

  return {
    summary,
    items,
    item,
    prioritySla,
    bottlenecks,
    exceptions,
    feedback,
    logs,
    diagnostics,
    streamConnected,
    actions: { processQueue, pauseQueue, resumeQueue, emergencyStop, autoRemediate, validateItem, retryItem, cancelItem, reassignRoute }
  };
}
