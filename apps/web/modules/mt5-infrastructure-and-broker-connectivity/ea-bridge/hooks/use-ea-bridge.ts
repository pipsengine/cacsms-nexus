"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { mt5RealtimeQueryOptions } from "@/lib/mt5-realtime";
import { fetchEaBridge, runEaBridgeAction } from "../services/ea-bridge.service";
import type { EaBridgeResponse } from "../types/ea-bridge.types";

export function useEaBridge() {
  const client = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);
  const query = useQuery({ queryKey: ["ea-bridge"], queryFn: fetchEaBridge, ...mt5RealtimeQueryOptions });

  useEffect(() => {
    const source = new EventSource("/api/mt5/ea-bridge/events-stream");
    source.addEventListener("bridge-snapshot", (event) => {
      client.setQueryData(["ea-bridge"], JSON.parse((event as MessageEvent).data) as EaBridgeResponse);
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [client]);

  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: Record<string, unknown> }) => runEaBridgeAction(path, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["ea-bridge"] })
  });

  return { ...query, streamConnected, action };
}
