"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { ShieldAlert, ShieldCheck } from "lucide-react";

import type { ExecutiveDashboardResponse } from "../types/executive-dashboard.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mapExecutiveDashboardCharts } from "../utils/executive-dashboard-mappers";
import { mockAuditLog } from "../services/executive-dashboard-service";

function riskVariant(state: ExecutiveDashboardResponse["riskSummary"]["riskState"]) {
  if (state === "Safe") return "success" as const;
  if (state === "Warning") return "warning" as const;
  return "destructive" as const;
}

export function RiskCommandSummary({ data }: { data: ExecutiveDashboardResponse }) {
  const charts = mapExecutiveDashboardCharts(data);
  const r = data.riskSummary;

  function log(action: string) {
    mockAuditLog({ action, at: new Date().toISOString(), actor: "operator@local", context: { module: "risk-command" } });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-orange-600">Risk Command</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Risk posture and permissions</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Risk pressure drivers, permissions gating, and kill-switch posture. Execution remains disabled by design in this phase.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={riskVariant(r.riskState)}>
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            {r.riskState}
          </Badge>
          <Badge variant={data.summary.riskPressureScore.score < 50 ? "success" : data.summary.riskPressureScore.score < 70 ? "warning" : "destructive"}>
            Pressure {data.summary.riskPressureScore.score}/100
          </Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Risk pressure breakdown</p>
          <p className="mt-1 text-sm font-semibold text-slate-950">Drivers (0–100)</p>
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.riskPressureBreakdown}>
                <XAxis dataKey="key" tick={{ fontSize: 10 }} interval={0} height={40} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={30} />
                <RechartsTooltip
                  contentStyle={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: "#0F172A", fontWeight: 600 }}
                />
                <Bar dataKey="value" fill="#F97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs leading-6 text-slate-600">{data.summary.riskPressureScore.explanation}</p>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          {[
            { label: "Account risk used", value: `${r.accountRiskUsed}%` },
            { label: "Portfolio exposure", value: `${r.portfolioExposure}` },
            { label: "Correlation risk", value: `${r.correlationRisk}%` },
            { label: "News risk", value: `${r.newsRisk}%` },
            { label: "Spread risk", value: `${r.spreadRisk}%` },
            { label: "Volatility risk", value: `${r.volatilityRisk}%` },
            { label: "Kill switch", value: r.killSwitchState },
            { label: "Trade permission", value: r.tradePermissionState }
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{row.label}</p>
              <p className="text-sm font-semibold text-slate-950">{row.value}</p>
            </div>
          ))}

          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => log("view-risk-center")}>
              View Risk Center
            </Button>
            <Button variant="secondary" onClick={() => log("pause-trading")}>
              Pause Trading
            </Button>
            <Button variant="destructive" onClick={() => log("activate-kill-switch")} className="gap-2">
              <ShieldAlert className="h-4 w-4" />
              Activate Kill Switch
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

