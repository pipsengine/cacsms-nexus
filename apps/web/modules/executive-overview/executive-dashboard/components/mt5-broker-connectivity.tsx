"use client";

import { Cable, Clock3, PlugZap } from "lucide-react";

import type { ExecutiveDashboardResponse, HealthStatus } from "../types/executive-dashboard.types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function tone(status: HealthStatus) {
  if (status === "Operational") return "success" as const;
  if (status === "Warning") return "warning" as const;
  if (status === "Degraded") return "warning" as const;
  return "destructive" as const;
}

export function Mt5BrokerConnectivity({ data }: { data: ExecutiveDashboardResponse }) {
  const m = data.mt5BrokerSummary;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-teal-600">MT5 & Broker Connectivity</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Connectivity and sync surface</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Terminal, EA bridge, broker connectivity, and synchronization posture (execution remains disabled).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={tone(m.mt5TerminalStatus)}>MT5 {m.mt5TerminalStatus}</Badge>
          <Badge variant={tone(m.brokerConnectionStatus)}>Broker {m.brokerConnectionStatus}</Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { title: "MT5 terminal", value: m.mt5TerminalStatus, icon: PlugZap },
          { title: "EA bridge", value: m.eaBridgeStatus, icon: PlugZap },
          { title: "Broker connection", value: m.brokerConnectionStatus, icon: Cable },
          { title: "Account sync", value: m.accountSyncStatus, icon: Cable },
          { title: "Symbol sync", value: m.symbolSyncStatus, icon: Cable },
          { title: "Trade sync", value: m.tradeSyncStatus, icon: Cable },
          { title: "Latency", value: m.latencyMs ? `${m.latencyMs}ms` : "N/A", icon: Clock3 },
          { title: "Reconnect attempts", value: String(m.reconnectAttempts), icon: PlugZap }
        ].map((card) => (
          <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase text-slate-500">{card.title}</p>
              <card.icon className={cn("h-4 w-4", "text-teal-600")} />
            </div>
            <p className="mt-2 text-lg font-semibold text-slate-950">{card.value}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Heartbeat: {new Date(m.lastHeartbeat).toLocaleTimeString()}</p>
          </div>
        ))}
      </div>
    </section>

  );
}

