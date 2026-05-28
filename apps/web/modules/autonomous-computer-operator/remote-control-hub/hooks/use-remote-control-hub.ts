"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { fetchRemoteControlHub } from "../services/remote-control-hub.service";
import type { RemoteControlHubResponse } from "../types/remote-control-hub.types";

export function useRemoteControlHub() {
  const client = useQueryClient();
  const searchParams = useSearchParams();
  const host = searchParams.get("host");
  const [streamConnected, setStreamConnected] = useState(false);

  useEffect(() => {
    const query = host ? `?host=${encodeURIComponent(host)}` : "";
    const source = new EventSource(`/api/autonomous-computer-operator/remote-control-hub/events-stream${query}`);
    source.addEventListener("remote-control-hub-snapshot", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as RemoteControlHubResponse;
      client.setQueryData(["remote-control-hub", host ?? "all"], payload);
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [host, client]);

  const query = useQuery({
    queryKey: ["remote-control-hub", host ?? "all"],
    queryFn: () => fetchRemoteControlHub(host),
    staleTime: 5_000,
    refetchInterval: 10_000,
    retry: 1
  });

  return { ...query, streamConnected, highlightedHost: host };
}
