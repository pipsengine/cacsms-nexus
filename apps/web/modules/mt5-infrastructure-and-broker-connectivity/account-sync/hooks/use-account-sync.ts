"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mt5RealtimeQueryOptions } from "@/lib/mt5-realtime";
import { fetchAccountSync, runAccountSyncAction } from "../services/account-sync.service";
import type { AccountSyncResponse } from "../types/account-sync.types";

export function useAccountSync() {
  const client = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);
  const query = useQuery({ queryKey: ["account-sync"], queryFn: fetchAccountSync, ...mt5RealtimeQueryOptions });
  useEffect(() => {
    const source = new EventSource("/api/mt5/account-sync/events-stream");
    source.addEventListener("account-snapshot", (event) => {
      client.setQueryData(["account-sync"], JSON.parse((event as MessageEvent).data) as AccountSyncResponse);
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [client]);
  const action = useMutation({ mutationFn: ({ path, body }: { path: string; body?: Record<string, unknown> }) => runAccountSyncAction(path, body), onSuccess: () => client.invalidateQueries({ queryKey: ["account-sync"] }) });
  return { ...query, streamConnected, action };
}
