"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mt5RealtimeQueryOptions } from "@/lib/mt5-realtime";
import { fetchChartControl, runChartAction } from "../services/chart-control.service";
import type { ChartControlResponse } from "../types/chart-control.types";

export function useChartControl() {
  const client = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);
  const query = useQuery({ queryKey: ["chart-control"], queryFn: fetchChartControl, ...mt5RealtimeQueryOptions });
  useEffect(() => {
    const source = new EventSource("/api/mt5/chart-control/events-stream");
    source.addEventListener("chart-snapshot", (event) => {
      client.setQueryData(["chart-control"], JSON.parse((event as MessageEvent).data) as ChartControlResponse);
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [client]);
  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: Record<string, unknown> }) => runChartAction(path, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["chart-control"] })
  });
  return { ...query, streamConnected, action };
}
