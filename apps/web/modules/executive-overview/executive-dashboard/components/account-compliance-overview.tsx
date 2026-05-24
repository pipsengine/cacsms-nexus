"use client";

import { AlertTriangle, ShieldCheck, Target } from "lucide-react";

import type { AccountComplianceSummary, ExecutiveDashboardResponse } from "../types/executive-dashboard.types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "../utils/executive-dashboard-mappers";

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function ProgressRow({
  label,
  value,
  percent,
  tone
}: {
  label: string;
  value: string;
  percent: number;
  tone: string;
}) {
  const pct = clampPercent(percent);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
        <span className="uppercase">{label}</span>
        <span className="text-slate-900">{value}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
    </div>
  );
}

function ruleStateVariant(state: AccountComplianceSummary["propFirmRuleState"]) {
  if (state === "Safe") return "success" as const;
  if (state === "Warning") return "warning" as const;
  if (state === "Critical" || state === "Breach Risk") return "destructive" as const;
  return "destructive" as const;
}

export function AccountComplianceOverview({ data }: { data: ExecutiveDashboardResponse }) {
  const c = data.accountCompliance;

  const dailyDrawdownPct = c.maxDailyDrawdown > 0 ? (c.dailyDrawdownUsed / c.maxDailyDrawdown) * 100 : 0;
  const overallDrawdownPct = c.maxOverallDrawdown > 0 ? (c.overallDrawdownUsed / c.maxOverallDrawdown) * 100 : 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-600">Account & Compliance</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Prop firm compliance overview</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Drawdown utilization, profit target tracking, and rule-state posture for the active account.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={ruleStateVariant(c.propFirmRuleState)}>
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            {c.propFirmRuleState}
          </Badge>
          <Badge variant={c.ruleViolationCount === 0 ? "success" : "warning"}>
            <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
            Violations: {c.ruleViolationCount}
          </Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Balance", value: formatCurrency(c.accountBalance) },
              { label: "Equity", value: formatCurrency(c.equity) },
              { label: "Trading days", value: formatNumber(c.tradingDayCount) },
              { label: "Max lot", value: `${c.maxLotAllowed}` },
              { label: "Open exposure", value: formatCurrency(c.openExposure) },
              { label: "Account type", value: c.accountType }
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <ProgressRow
            label="Daily drawdown used"
            value={`${formatCurrency(c.dailyDrawdownUsed)} / ${formatCurrency(c.maxDailyDrawdown)}`}
            percent={dailyDrawdownPct}
            tone={dailyDrawdownPct < 50 ? "bg-emerald-600" : dailyDrawdownPct < 80 ? "bg-orange-600" : "bg-red-600"}
          />
          <ProgressRow
            label="Overall drawdown used"
            value={`${formatCurrency(c.overallDrawdownUsed)} / ${formatCurrency(c.maxOverallDrawdown)}`}
            percent={overallDrawdownPct}
            tone={overallDrawdownPct < 50 ? "bg-emerald-600" : overallDrawdownPct < 80 ? "bg-orange-600" : "bg-red-600"}
          />
          <ProgressRow
            label="Profit target"
            value={`${formatNumber(c.profitTargetProgress)}%`}
            percent={c.profitTargetProgress}
            tone="bg-blue-600"
          />
          <ProgressRow
            label="Consistency score"
            value={`${formatNumber(c.consistencyScore)}%`}
            percent={c.consistencyScore}
            tone="bg-purple-600"
          />

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Target className="h-4 w-4 text-emerald-600" />
              Compliance score: {data.summary.complianceScore.score}/100
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">{data.summary.complianceScore.explanation}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

