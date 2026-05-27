"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mt5RealtimeQueryOptions } from "@/lib/mt5-realtime";
import { fetchOrderRouter, runRouterAction } from "../services/order-router.service";
import type { RouterResponse } from "../types/order-router.types";

export function useOrderRouter() {
  const client = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);
  const query = useQuery({ queryKey: ["order-router"], queryFn: fetchOrderRouter, ...mt5RealtimeQueryOptions });
  useEffect(() => {
    const source = new EventSource("/api/mt5/order-router/events-stream");
    source.addEventListener("router-snapshot", (event) => {
      client.setQueryData(["order-router"], JSON.parse((event as MessageEvent).data) as RouterResponse);
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [client]);
  const action = useMutation({ mutationFn: ({ path, body }: { path: string; body?: Record<string, unknown> }) => runRouterAction(path, body), onSuccess: () => client.invalidateQueries({ queryKey: ["order-router"] }) });
  return { ...query, streamConnected, action };
}
