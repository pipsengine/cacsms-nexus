"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mt5RealtimeQueryOptions } from "@/lib/mt5-realtime";
import { fetchAccountCenter, runAccountCenterAction } from "../services/account-center.service";
import type { AccountCenterResponse } from "../types/account-center.types";

export function useAccountCenter() {
  const client = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);
  const query = useQuery({ queryKey: ["account-center"], queryFn: fetchAccountCenter, ...mt5RealtimeQueryOptions });

  useEffect(() => {
    const source = new EventSource("/api/accounts-and-portfolio/account-center/events-stream");
    source.addEventListener("account-center-snapshot", (event) => {
      client.setQueryData(["account-center"], JSON.parse((event as MessageEvent).data) as AccountCenterResponse);
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [client]);

  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: Record<string, unknown> }) => runAccountCenterAction(path, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["account-center"] })
  });

  return { ...query, streamConnected, action };
}
