"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchMt5ControlCenter, runMt5Action } from "../services/mt5-control-center.service";
import type { Mt5ControlCenterResponse } from "../types/mt5-control-center.types";

export function useMt5ControlCenter() {
  const queryClient = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);
  const query = useQuery({
    queryKey: ["mt5-control-center"],
    queryFn: fetchMt5ControlCenter,
    refetchInterval: 30_000,
    staleTime: 4_000
  });

  useEffect(() => {
    const source = new EventSource("/api/mt5/events");
    source.addEventListener("snapshot", (event) => {
      queryClient.setQueryData(["mt5-control-center"], JSON.parse((event as MessageEvent).data) as Mt5ControlCenterResponse);
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [queryClient]);

  const action = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method?: "POST" | "PATCH"; body?: unknown }) => runMt5Action(path, method, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mt5-control-center"] })
  });

  return { ...query, streamConnected, action };
}
