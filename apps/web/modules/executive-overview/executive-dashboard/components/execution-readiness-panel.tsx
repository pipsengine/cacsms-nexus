"use client";

import { CheckCircle2, OctagonAlert, Route, Timer } from "lucide-react";

import type { ExecutiveDashboardResponse } from "../types/executive-dashboard.types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function readinessTone(score: number) {
  if (score >= 80) return "bg-emerald-600";
  if (score >= 60) return "bg-blue-600";
  if (score >= 45) return "bg-orange-600";
  return "bg-red-600";
}

export function ExecutionReadinessPanel({ data }: { data: ExecutiveDashboardResponse }) {
  const e = data.executionSummary;
  const readiness = data.summary.executionReadinessScore.score;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-600">Execution Readiness</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Pre-execution gating surface</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Execution readiness score and blockers. Live execution remains disabled until the execution phase.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={readiness >= 70 ? "success" : readiness >= 55 ? "default" : "warning"}>Readiness {readiness}/100</Badge>
          <Badge variant={e.preExecutionBlockerCount === 0 ? "success" : "warning"}>Blockers: {e.preExecutionBlockerCount}</Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Readiness score</p>
          <p className="mt-1 text-4xl font-semibold text-slate-950">{readiness}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
            <div className={cn("h-full rounded-full", readinessTone(readiness))} style={{ width: `${Math.max(2, readiness)}%` }} />
          </div>
          <p className="mt-3 text-xs leading-6 text-slate-600">{data.summary.executionReadinessScore.explanation}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { label: "Order router", value: e.orderRouterState, icon: Route },
              { label: "Spread validation", value: e.spreadValidationState, icon: CheckCircle2 },
              { label: "Slippage risk", value: `${e.slippageRisk}%`, icon: Timer },
              { label: "Execution score", value: `${e.executionReadinessScore}%`, icon: Route }
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p>
                  <metric.icon className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-950">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          {[
            { label: "Broker permission", value: e.brokerPermission, ok: e.brokerPermission === "Allowed" },
            { label: "Risk permission", value: e.riskPermission, ok: e.riskPermission === "Allowed" },
            { label: "MT5 permission", value: e.mt5Permission, ok: e.mt5Permission === "Allowed" }
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{row.label}</p>
              <Badge variant={row.ok ? "success" : "destructive"}>
                {row.ok ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> : <OctagonAlert className="mr-1.5 h-3.5 w-3.5" />}
                {row.value}
              </Badge>
            </div>
          ))}

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Blocker notes</p>
            <p className="mt-2 text-xs leading-6 text-slate-600">
              Pre-execution blockers represent missing connectivity or disabled permissions. This is intentional until the execution phase is enabled.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

