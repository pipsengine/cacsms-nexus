"use client";

import { useEffect, useMemo, useState } from "react";

export function useTradeSyncRealtime(options?: { enabled?: boolean; endpoint?: string }) {
  const enabled = options?.enabled ?? false;
  const endpoint = options?.endpoint ?? "/api/mt5/trade-synchronization/summary";

  const [connected, setConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    let canceled = false;
    const controller = new AbortController();

    async function connect() {
      try {
        await fetch(endpoint, { method: "GET", cache: "no-store", signal: controller.signal });
        if (!canceled) {
          setConnected(true);
          setLastEventAt(new Date().toISOString());
        }
      } catch {
        if (!canceled) {
          setConnected(false);
        }
      }
    }

    connect();

    return () => {
      canceled = true;
      controller.abort();
      setConnected(false);
    };
  }, [enabled, endpoint]);

  return useMemo(() => ({ enabled, connected, lastEventAt }), [enabled, connected, lastEventAt]);
}

