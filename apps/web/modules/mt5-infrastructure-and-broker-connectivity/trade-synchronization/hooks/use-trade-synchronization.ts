"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchTradeSyncSummary, fetchTradeSyncTrades } from "../services/trade-synchronization-service";
import { useTradeSyncStore } from "../stores/trade-synchronization-store";

export function useTradeSynchronization() {
  const searchTerm = useTradeSyncStore((s) => s.searchTerm);
  const statusFilter = useTradeSyncStore((s) => s.statusFilter);

  const summary = useQuery({
    queryKey: ["trade-sync", "summary"],
    queryFn: () => fetchTradeSyncSummary({ allowMockFallback: true }),
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: 2
  });

  const trades = useQuery({
    queryKey: ["trade-sync", "trades", { searchTerm, statusFilter }],
    queryFn: () => fetchTradeSyncTrades({ search: searchTerm, status: statusFilter, page: 1, pageSize: 50 }),
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: 2
  });

  return { summary, trades };
}

