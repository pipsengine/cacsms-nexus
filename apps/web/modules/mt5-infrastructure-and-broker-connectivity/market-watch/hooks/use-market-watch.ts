"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMarketWatch, runMarketWatchAction } from "../services/market-watch.service";
import type { MarketWatchResponse } from "../types/market-watch.types";

export function useMarketWatch() {
  const client = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);
  const query = useQuery({ queryKey: ["market-watch"], queryFn: fetchMarketWatch, staleTime: 4_000, refetchInterval: 30_000 });
  useEffect(() => {
    const source = new EventSource("/api/mt5/market-watch/events-stream");
    source.addEventListener("market-snapshot", (event) => {
      client.setQueryData(["market-watch"], JSON.parse((event as MessageEvent).data) as MarketWatchResponse);
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [client]);
  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: Record<string, unknown> }) => runMarketWatchAction(path, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["market-watch"] })
  });
  return { ...query, streamConnected, action };
}
