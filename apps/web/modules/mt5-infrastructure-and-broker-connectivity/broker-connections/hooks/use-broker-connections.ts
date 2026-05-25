"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchBrokerConnections, runBrokerAction } from "../services/broker-connections.service";
import type { BrokerConnectionsResponse } from "../types/broker-connections.types";

export function useBrokerConnections() {
  const client = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);
  const query = useQuery({ queryKey: ["broker-connections"], queryFn: fetchBrokerConnections, staleTime: 4_000, refetchInterval: 30_000 });

  useEffect(() => {
    const source = new EventSource("/api/mt5/broker-connections/events-stream");
    source.addEventListener("broker-snapshot", (event) => {
      client.setQueryData(["broker-connections"], JSON.parse((event as MessageEvent).data) as BrokerConnectionsResponse);
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [client]);

  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: Record<string, unknown> }) => runBrokerAction(path, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["broker-connections"] })
  });
  return { ...query, streamConnected, action };
}
