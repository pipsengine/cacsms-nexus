"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchChartTemplates, runTemplateAction } from "../services/chart-templates.service";
import type { TemplateResponse } from "../types/chart-templates.types";

export function useChartTemplates() {
  const client = useQueryClient();
  const [streamConnected, setStreamConnected] = useState(false);
  const query = useQuery({ queryKey: ["chart-templates"], queryFn: fetchChartTemplates, staleTime: 4_000, refetchInterval: 30_000 });
  useEffect(() => {
    const source = new EventSource("/api/mt5/chart-templates/events-stream");
    source.addEventListener("template-snapshot", (event) => {
      client.setQueryData(["chart-templates"], JSON.parse((event as MessageEvent).data) as TemplateResponse);
      setStreamConnected(true);
    });
    source.onerror = () => setStreamConnected(false);
    return () => source.close();
  }, [client]);
  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body?: Record<string, unknown> }) => runTemplateAction(path, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ["chart-templates"] })
  });
  return { ...query, streamConnected, action };
}
