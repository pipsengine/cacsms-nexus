"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { fetchOperatorDashboard } from "../services/operator-dashboard.service";
import type { OperatorDashboardResponse } from "../types/operator-dashboard.types";

export function useOperatorDashboard() {
  const client = useQueryClient();
  const searchParams = useSearchParams();
  const host = searchParams.get("host");
  const [streamConnected, setStreamConnected] = useState(false);

  useEffect(() => {
    const query = host ? `?host=${encodeURIComponent(host)}` : "";
    const source = new EventSource(`/api/autonomous-computer-operator/operator-dashboard/events-stream${query}`);
    source.addEventListener("operator-dashboard-snapshot", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as OperatorDashboardResponse;
      client.setQueryData(["operator-dashboard", host ?? "all"], payload);
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [host, client]);

  const query = useQuery({
    queryKey: ["operator-dashboard", host ?? "all"],
    queryFn: () => fetchOperatorDashboard(host),
    staleTime: 5_000,
    refetchInterval: 10_000,
    retry: 1
  });

  return { ...query, streamConnected, highlightedHost: host };
}
