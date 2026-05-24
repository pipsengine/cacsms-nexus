"use client";

import { BrainCircuit, Clock3, Radar } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";

import type { ExecutiveDashboardResponse } from "../types/executive-dashboard.types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { mapExecutiveDashboardCharts } from "../utils/executive-dashboard-mappers";

function gaugeTone(score: number) {
  if (score >= 80) return "bg-emerald-600";
  if (score >= 65) return "bg-blue-600";
  if (score >= 50) return "bg-orange-600";
  return "bg-red-600";
}

export function AiIntelligenceOverview({ data }: { data: ExecutiveDashboardResponse }) {
  const charts = mapExecutiveDashboardCharts(data);
  const aiScore = data.summary.aiConfidenceScore.score;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-purple-600">AI Intelligence</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Orchestration and model posture</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Confidence scoring, model drift risk, strategy family selection, and decision latency posture.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={aiScore >= 75 ? "purple" : aiScore >= 60 ? "default" : "warning"}>AI {aiScore}/100</Badge>
          <Badge variant={data.aiIntelligence.learningStatus === "Learning" ? "purple" : "secondary"}>{data.aiIntelligence.learningStatus}</Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">AI confidence trend</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">Recent decision confidence</p>
            </div>
            <div className="text-xs font-semibold text-slate-600">last {charts.aiConfidenceTrend.length} events</div>
          </div>

          <div className="mt-4 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.aiConfidenceTrend}>
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={30} />
                <RechartsTooltip
                  contentStyle={{ background: "white", border: "1px solid #E2E8F0", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: "#0F172A", fontWeight: 600 }}
                />
                <Line type="monotone" dataKey="confidence" stroke="#7C3AED" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { label: "Orchestration confidence", value: `${data.aiIntelligence.orchestrationConfidence}%`, icon: BrainCircuit },
              { label: "Regime confidence", value: `${data.aiIntelligence.marketRegimeConfidence}%`, icon: Radar },
              { label: "Decision latency", value: `${data.aiIntelligence.decisionLatencyMs}ms`, icon: Clock3 },
              { label: "Active models", value: String(data.aiIntelligence.activeModelCount), icon: BrainCircuit }
            ].map((metric) => (
              <div key={metric.label} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p>
                  <metric.icon className="h-4 w-4 text-purple-600" />
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-950">{metric.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">AI confidence gauge</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{aiScore}/100</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className={cn("h-full rounded-full", gaugeTone(aiScore))} style={{ width: `${Math.max(2, aiScore)}%` }} />
            </div>
            <p className="mt-3 text-xs leading-6 text-slate-600">{data.summary.aiConfidenceScore.explanation}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Active strategy family</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{data.aiIntelligence.activeStrategyFamily}</p>
            <p className="mt-2 text-xs leading-5 text-slate-600">{data.aiIntelligence.lastDecisionSummary}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Model drift risk</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{data.aiIntelligence.modelDriftRisk}%</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className={cn("h-full rounded-full", data.aiIntelligence.modelDriftRisk < 35 ? "bg-emerald-600" : data.aiIntelligence.modelDriftRisk < 65 ? "bg-orange-600" : "bg-red-600")}
                style={{ width: `${Math.max(2, Math.min(100, data.aiIntelligence.modelDriftRisk))}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

