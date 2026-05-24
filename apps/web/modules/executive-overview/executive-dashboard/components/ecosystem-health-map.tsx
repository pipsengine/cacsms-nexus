"use client";

import { Activity, Clock3, HeartPulse } from "lucide-react";

import type { ExecutiveDashboardResponse, HealthStatus, SystemHealthItem } from "../types/executive-dashboard.types";
import { cn } from "@/lib/utils";

function statusTone(status: HealthStatus) {
  if (status === "Operational") return "border-green-200 bg-green-50 text-green-700";
  if (status === "Warning") return "border-orange-200 bg-orange-50 text-orange-700";
  if (status === "Degraded") return "border-yellow-200 bg-yellow-50 text-yellow-800";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function dot(status: HealthStatus) {
  if (status === "Operational") return "bg-emerald-600";
  if (status === "Warning") return "bg-orange-600";
  if (status === "Degraded") return "bg-yellow-500";
  return "bg-slate-400";
}

function ItemCard({ item }: { item: SystemHealthItem }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", dot(item.status))} />
            <p className="truncate text-sm font-semibold text-slate-950">{item.name}</p>
          </div>
          <p className={cn("mt-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase", statusTone(item.status))}>
            {item.status}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
          {item.healthScore}/100
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Activity className="h-3.5 w-3.5" />
            <p className="text-[10px] font-semibold uppercase">Latency</p>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-950">{item.latencyMs ? `${item.latencyMs}ms` : "N/A"}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Clock3 className="h-3.5 w-3.5" />
            <p className="text-[10px] font-semibold uppercase">Heartbeat</p>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-950">{new Date(item.lastHeartbeat).toLocaleTimeString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-1.5 text-slate-500">
            <HeartPulse className="h-3.5 w-3.5" />
            <p className="text-[10px] font-semibold uppercase">Error</p>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-950">{Math.round(item.errorRate * 100)}%</p>
        </div>
      </div>
    </div>
  );
}

export function EcosystemHealthMap({ data }: { data: ExecutiveDashboardResponse }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div>
        <p className="text-xs font-semibold uppercase text-blue-600">Ecosystem Health Map</p>
        <h2 className="mt-1 text-2xl font-semibold text-slate-950">Service telemetry surface</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Snapshot-friendly, WebSocket/SSE-ready health cards for every critical subsystem.
        </p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {data.systems.map((item) => (
          <ItemCard key={item.key} item={item} />
        ))}
      </div>
    </section>
  );
}

