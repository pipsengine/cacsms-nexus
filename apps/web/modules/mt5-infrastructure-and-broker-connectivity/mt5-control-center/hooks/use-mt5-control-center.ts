"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { mt5RealtimeQueryOptions } from "@/lib/mt5-realtime";
import { fetchMt5ControlCenter, runMt5Action } from "../services/mt5-control-center.service";
import type { Broker, Mt5ControlCenterResponse, TerminalOnboardingReceipt } from "../types/mt5-control-center.types";

export function useMt5ControlCenter() {
  const queryClient = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);
  const query = useQuery({
    queryKey: ["mt5-control-center"],
    queryFn: fetchMt5ControlCenter,
    ...mt5RealtimeQueryOptions
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
    onSuccess: (result, variables) => {
      if (variables.path === "/api/mt5/brokers" && result && typeof result === "object" && "id" in result) {
        const broker = result as Broker;
        queryClient.setQueryData<Mt5ControlCenterResponse>(["mt5-control-center"], (current) => {
          if (!current || current.brokers.some((item) => item.id === broker.id)) {
            return current;
          }
          return { ...current, brokers: [...current.brokers, broker] };
        });
      }

      if (variables.path === "/api/mt5/onboarding/terminals" && result && typeof result === "object" && "terminal" in result) {
        const receipt = result as TerminalOnboardingReceipt;
        queryClient.setQueryData<Mt5ControlCenterResponse>(["mt5-control-center"], (current) => {
          if (!current) return current;
          if (current.terminals.some((item) => item.id === receipt.terminal.id)) {
            return current;
          }
          return { ...current, terminals: [...current.terminals, receipt.terminal] };
        });
      }

      queryClient.invalidateQueries({ queryKey: ["mt5-control-center"] });
      if (variables.path.includes("/brokers") || variables.path.includes("/onboarding/")) {
        queryClient.invalidateQueries({ queryKey: ["broker-connections"] });
        queryClient.invalidateQueries({ queryKey: ["ea-bridge"] });
        queryClient.invalidateQueries({ queryKey: ["terminal-status"] });
        queryClient.invalidateQueries({ queryKey: ["account-sync"] });
        queryClient.invalidateQueries({ queryKey: ["ea-terminal-hub"] });
      }
    }
  });

  return { ...query, streamConnected, action };
}
