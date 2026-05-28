"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { fetchRiskAndExposure } from "../services/risk-and-exposure.service";
import type { RiskAndExposureResponse } from "../types/risk-and-exposure.types";

export function useRiskAndExposure() {
  const client = useQueryClient();
  const searchParams = useSearchParams();
  const accountId = searchParams.get("accountId");
  const [streamConnected, setStreamConnected] = useState(false);

  useEffect(() => {
    const query = accountId ? `?accountId=${encodeURIComponent(accountId)}` : "";
    const source = new EventSource(`/api/accounts-and-portfolio/risk-and-exposure/events-stream${query}`);
    source.addEventListener("risk-and-exposure-snapshot", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as RiskAndExposureResponse;
      client.setQueryData(["risk-and-exposure", accountId ?? "all"], payload);
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [accountId, client]);

  const query = useQuery({
    queryKey: ["risk-and-exposure", accountId ?? "all"],
    queryFn: () => fetchRiskAndExposure(accountId),
    staleTime: 5_000,
    refetchInterval: 10_000,
    retry: 1
  });

  return { ...query, streamConnected, highlightedAccountId: accountId };
}
