"use client";

import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";

export const MT5_REALTIME_STALE_MS = 1_000;
export const MT5_REALTIME_REFETCH_MS = 2_000;
export const MT5_REALTIME_CLOCK_MS = 1_000;

export const mt5RealtimeQueryOptions = {
  staleTime: MT5_REALTIME_STALE_MS,
  refetchInterval: MT5_REALTIME_REFETCH_MS
} as const;

export function useLiveClock(tickMs = MT5_REALTIME_CLOCK_MS) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), tickMs);
    return () => window.clearInterval(interval);
  }, [tickMs]);

  return now;
}

export function formatLiveTime(value?: string | Date, reference = new Date()) {
  const date = value instanceof Date ? value : value ? new Date(value) : reference;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatRelativeAgeSeconds(value?: string, reference = new Date()) {
  if (!value) return "None";
  const ageMs = reference.getTime() - new Date(value).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return "just now";
  const seconds = Math.round(ageMs / 1000);
  if (seconds < 2) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return formatLiveTime(value, reference);
}

export function useMt5EventStream<T>(input: {
  endpoint: string;
  eventName: string;
  queryKey: readonly unknown[];
  client: QueryClient;
  enabled?: boolean;
}) {
  const [streamConnected, setStreamConnected] = useState(false);

  useEffect(() => {
    if (input.enabled === false) {
      setStreamConnected(false);
      return;
    }

    const source = new EventSource(input.endpoint);
    source.addEventListener(input.eventName, (event) => {
      input.client.setQueryData(input.queryKey, JSON.parse((event as MessageEvent).data) as T);
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [input.client, input.enabled, input.endpoint, input.eventName, input.queryKey]);

  return streamConnected;
}
