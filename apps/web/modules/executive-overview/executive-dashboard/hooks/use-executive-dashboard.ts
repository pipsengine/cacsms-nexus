"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchExecutiveDashboard } from "../services/executive-dashboard-service";

export function useExecutiveDashboard() {
  return useQuery({
    queryKey: ["executive-dashboard"],
    queryFn: () => fetchExecutiveDashboard(),
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: 2
  });
}
