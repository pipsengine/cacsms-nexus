"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { mt5RealtimeQueryOptions } from "@/lib/mt5-realtime";
import type { EaTerminalHubResponse } from "../types/ea-terminal-hub.types";
import { fetchEaTerminalHub, runEaTerminalHubAction } from "../services/ea-terminal-hub.service";

export function useEaTerminalHub() {
  const client = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);
  const query = useQuery({
    queryKey: ["ea-terminal-hub"],
    queryFn: fetchEaTerminalHub,
    ...mt5RealtimeQueryOptions
  });

  useEffect(() => {
    const source = new EventSource("/api/mt5/ea-terminal-hub/events-stream");
    source.addEventListener("ea-terminal-hub-snapshot", (event) => {
      client.setQueryData(["ea-terminal-hub"], JSON.parse((event as MessageEvent).data) as EaTerminalHubResponse);
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [client]);

  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: Record<string, unknown> }) => runEaTerminalHubAction(path, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["ea-terminal-hub"] })
  });

  return { ...query, streamConnected, action };
}
