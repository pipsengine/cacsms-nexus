"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { fetchPortfolioDashboard } from "../services/portfolio-dashboard.service";
import type { PortfolioDashboardResponse } from "../types/portfolio-dashboard.types";

export function usePortfolioDashboard() {
  const client = useQueryClient();
  const searchParams = useSearchParams();
  const accountId = searchParams.get("accountId");
  const [streamConnected, setStreamConnected] = useState(false);

  useEffect(() => {
    const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
    const source = new EventSource(`/api/accounts-and-portfolio/portfolio-dashboard/events-stream${query}`);
    source.addEventListener("portfolio-dashboard-snapshot", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as PortfolioDashboardResponse;
      client.setQueryData(["portfolio-dashboard", accountId ?? "all"], payload);
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [accountId, client]);

  const query = useQuery({
    queryKey: ["portfolio-dashboard", accountId ?? "all"],
    queryFn: () => fetchPortfolioDashboard(accountId),
    staleTime: 5_000,
    refetchInterval: 12_000,
    retry: 1
  });

  return { ...query, streamConnected, highlightedAccountId: accountId };
}
