"use client";

import { ArrowDownRight, ArrowUpRight, Ban, PauseCircle } from "lucide-react";

import type { ExecutiveDashboardResponse, RecentAiDecision } from "../types/executive-dashboard.types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function decisionIcon(decision: RecentAiDecision["decision"]) {
  if (decision === "Buy") return ArrowUpRight;
  if (decision === "Sell") return ArrowDownRight;
  if (decision === "Blocked") return Ban;
  return PauseCircle;
}

function decisionTone(decision: RecentAiDecision["decision"]) {
  if (decision === "Buy") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (decision === "Sell") return "text-rose-700 bg-rose-50 border-rose-200";
  if (decision === "Blocked") return "text-red-700 bg-red-50 border-red-200";
  return "text-slate-700 bg-slate-50 border-slate-200";
}

export function RecentAiDecisions({ data }: { data: ExecutiveDashboardResponse }) {
  const rows = data.recentDecisions;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-violet-600">Recent AI Decisions</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Decision log (snapshot)</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Structured decision history with confidence, strategy family, risk approval state, and reason summary.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          No recent AI decisions available yet. Snapshot mode will populate once orchestration emits events.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[920px] border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {["Time", "Asset", "Decision", "Confidence", "Strategy", "Risk", "Reason"].map((h) => (
                  <th key={h} className="border-b border-slate-200 px-3 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const Icon = decisionIcon(row.decision);
                return (
                  <tr key={row.id} className="text-sm text-slate-800">
                    <td className="border-b border-slate-100 px-3 py-3 text-xs font-semibold text-slate-600">
                      {new Date(row.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-950">{row.asset}</td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", decisionTone(row.decision))}>
                        <Icon className="h-3.5 w-3.5" />
                        {row.decision}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <Badge variant={row.confidence >= 75 ? "success" : row.confidence >= 60 ? "default" : "warning"}>{row.confidence}%</Badge>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-xs font-semibold text-slate-700">{row.strategyFamily}</td>
                    <td className="border-b border-slate-100 px-3 py-3">
                      <Badge variant={row.riskApproval === "Approved" ? "success" : row.riskApproval === "Review" ? "warning" : "destructive"}>
                        {row.riskApproval}
                      </Badge>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-3 text-xs leading-5 text-slate-600">{row.reasonSummary}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

