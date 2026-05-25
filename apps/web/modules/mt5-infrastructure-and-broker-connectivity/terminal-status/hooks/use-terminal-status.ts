"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchTerminalStatus, runTerminalAction } from "../services/terminal-status.service";
import type { TerminalStatusResponse } from "../types/terminal-status.types";

export function useTerminalStatus() {
  const client = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);
  const query = useQuery({ queryKey: ["terminal-status"], queryFn: fetchTerminalStatus, staleTime: 4_000, refetchInterval: 30_000 });

  useEffect(() => {
    const source = new EventSource("/api/mt5/terminal-status/events-stream");
    source.addEventListener("terminal-snapshot", (event) => {
      client.setQueryData(["terminal-status"], JSON.parse((event as MessageEvent).data) as TerminalStatusResponse);
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [client]);

  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: Record<string, unknown> }) => runTerminalAction(path, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["terminal-status"] })
  });

  return { ...query, streamConnected, action };
}
