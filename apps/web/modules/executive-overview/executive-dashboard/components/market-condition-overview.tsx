"use client";

import { Activity, BarChart3, Globe, Scale, TrendingUp } from "lucide-react";

import type { ExecutiveDashboardResponse } from "../types/executive-dashboard.types";
import { Badge } from "@/components/ui/badge";

export function MarketConditionOverview({ data }: { data: ExecutiveDashboardResponse }) {
  const m = data.marketCondition;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-blue-600">Market Conditions</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Regime and liquidity posture</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Executive view of regime, volatility, spreads, liquidity quality, and macro/news risk state.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">{m.sessionStatus}</Badge>
          <Badge variant={m.volatilityState === "High" ? "warning" : "secondary"}>Volatility: {m.volatilityState}</Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { title: "Best Asset Candidate", value: m.bestAssetCandidate, icon: TrendingUp },
          { title: "Market Regime", value: m.marketRegime, icon: BarChart3 },
          { title: "Spread Conditions", value: m.spreadState, icon: Activity },
          { title: "Liquidity Quality", value: m.liquidityQuality, icon: Globe },
          { title: "Correlation Risk", value: `${m.correlationPressure}%`, icon: Scale },
          { title: "Macro Risk", value: m.macroRiskState, icon: Globe },
          { title: "News Risk", value: m.newsRiskState, icon: Globe },
          { title: "Session State", value: m.sessionStatus, icon: Globe }
        ].map((card) => (
          <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase text-slate-500">{card.title}</p>
              <card.icon className="h-4 w-4 text-blue-600" />
            </div>
            <p className="mt-2 text-lg font-semibold text-slate-950">{card.value}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Snapshot-ready placeholder surface for live feeds.</p>
          </div>
        ))}
      </div>
    </section>
  );
}

