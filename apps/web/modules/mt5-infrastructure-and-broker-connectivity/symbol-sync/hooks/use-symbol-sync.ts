"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSymbolSync, runSymbolSyncAction } from "../services/symbol-sync.service";
import type { SymbolSyncResponse } from "../types/symbol-sync.types";

export function useSymbolSync() {
  const client = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);
  const query = useQuery({ queryKey: ["symbol-sync"], queryFn: fetchSymbolSync, staleTime: 4_000, refetchInterval: 30_000 });
  useEffect(() => {
    const source = new EventSource("/api/mt5/symbol-sync/events-stream");
    source.addEventListener("symbol-snapshot", (event) => {
      client.setQueryData(["symbol-sync"], JSON.parse((event as MessageEvent).data) as SymbolSyncResponse);
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [client]);
  const action = useMutation({
    mutationFn: ({ path, body, method }: { path: string; body?: Record<string, unknown>; method?: "POST" | "PATCH" }) => runSymbolSyncAction(path, body, method),
    onSuccess: () => client.invalidateQueries({ queryKey: ["symbol-sync"] })
  });
  return { ...query, streamConnected, action };
}
