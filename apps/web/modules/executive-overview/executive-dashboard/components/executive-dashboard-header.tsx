"use client";

import { AlarmClock, RefreshCw, ShieldCheck } from "lucide-react";

import type { ExecutiveDashboardResponse } from "../types/executive-dashboard.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function statusVariant(score: number) {
  if (score >= 85) return "success" as const;
  if (score >= 70) return "default" as const;
  if (score >= 55) return "warning" as const;
  return "destructive" as const;
}

export function ExecutiveDashboardHeader({
  data,
  onRefresh,
  onEmergencyStop
}: {
  data: ExecutiveDashboardResponse;
  onRefresh: () => void;
  onEmergencyStop: () => void;
}) {
  const globalScore = data.summary.globalHealthScore.score;
  const globalVariant = statusVariant(globalScore);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="h-1.5 w-full rounded-t-2xl bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500" />
      <div className="p-5 sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">Executive Dashboard</h1>
              <Badge variant={globalVariant}>
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                Global {globalScore}/100
              </Badge>
            </div>
            <p className="mt-2 max-w-4xl text-sm font-semibold text-slate-700 sm:text-base">
              Real-time command center for Cacsms Nexus autonomous trading ecosystem.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Active account", value: `${data.meta.activeAccountType} · ${data.meta.activeAccountName}` },
                { label: "Environment", value: data.meta.environment },
                { label: "System mode", value: data.meta.systemMode },
                { label: "Last updated", value: new Date(data.meta.lastUpdated).toLocaleTimeString() }
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-950">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="destructive" onClick={onEmergencyStop} className={cn("gap-2")}>
              <AlarmClock className="h-4 w-4" />
              Emergency Stop
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

