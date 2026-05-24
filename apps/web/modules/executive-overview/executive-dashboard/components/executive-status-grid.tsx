"use client";

import {
  Activity,
  AlertTriangle,
  Bot,
  Briefcase,
  Cpu,
  Gauge,
  Network,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wrench
} from "lucide-react";

import type { ExecutiveDashboardResponse } from "../types/executive-dashboard.types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function scoreVariant(score: number) {
  if (score >= 85) return "success" as const;
  if (score >= 70) return "default" as const;
  if (score >= 55) return "warning" as const;
  return "destructive" as const;
}

function progressBarColor(score: number) {
  if (score >= 85) return "bg-emerald-600";
  if (score >= 70) return "bg-blue-600";
  if (score >= 55) return "bg-orange-600";
  return "bg-red-600";
}

function StatusCard({
  title,
  value,
  description,
  score,
  icon: Icon,
  tone
}: {
  title: string;
  value: string;
  description: string;
  score: number;
  icon: typeof Activity;
  tone: string;
}) {
  const variant = scoreVariant(score);
  return (
    <div className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm", tone)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-slate-500">{title}</p>
          <p className="mt-2 truncate text-2xl font-semibold text-slate-950">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{description}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Badge variant={variant}>{score}/100</Badge>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div className={cn("h-full rounded-full", progressBarColor(score))} style={{ width: `${Math.max(2, score)}%` }} />
        </div>
      </div>
    </div>
  );
}

export function ExecutiveStatusGrid({ data }: { data: ExecutiveDashboardResponse }) {
  const cards = [
    {
      title: "Global System Health",
      value: String(data.summary.globalHealthScore.score),
      description: data.summary.globalHealthScore.explanation,
      score: data.summary.globalHealthScore.score,
      icon: ShieldCheck,
      tone: "bg-white"
    },
    {
      title: "AI Confidence",
      value: String(data.summary.aiConfidenceScore.score),
      description: data.summary.aiConfidenceScore.explanation,
      score: data.summary.aiConfidenceScore.score,
      icon: Sparkles,
      tone: "bg-white"
    },
    {
      title: "Workflow Progress",
      value: String(data.summary.workflowProgressScore.score),
      description: data.summary.workflowProgressScore.explanation,
      score: data.summary.workflowProgressScore.score,
      icon: TrendingUp,
      tone: "bg-white"
    },
    {
      title: "Risk Pressure",
      value: String(data.summary.riskPressureScore.score),
      description: data.summary.riskPressureScore.explanation,
      score: data.summary.riskPressureScore.score,
      icon: Scale,
      tone: "bg-white"
    },
    {
      title: "Prop Firm Compliance",
      value: String(data.summary.complianceScore.score),
      description: data.summary.complianceScore.explanation,
      score: data.summary.complianceScore.score,
      icon: ShieldCheck,
      tone: "bg-white"
    },
    {
      title: "MT5 Connection",
      value: data.mt5BrokerSummary.mt5TerminalStatus,
      description: "Terminal status and heartbeat readiness.",
      score: data.mt5BrokerSummary.mt5TerminalStatus === "Operational" ? 90 : 0,
      icon: Cpu,
      tone: "bg-white"
    },
    {
      title: "Broker Connection",
      value: data.mt5BrokerSummary.brokerConnectionStatus,
      description: "Broker connectivity and account sync.",
      score: data.mt5BrokerSummary.brokerConnectionStatus === "Operational" ? 90 : 0,
      icon: Network,
      tone: "bg-white"
    },
    {
      title: "VPS Health",
      value: data.systems.find((s) => s.key === "frontend")?.status ?? "Unknown",
      description: "VPS and runtime readiness placeholder.",
      score: data.systems.find((s) => s.key === "frontend")?.healthScore ?? 0,
      icon: Wrench,
      tone: "bg-white"
    },
    {
      title: "Cacsms Vision",
      value: data.visionSummary.visionEngineStatus,
      description: "Vision capture and analysis pipeline health.",
      score: data.visionSummary.visionEngineStatus === "Operational" ? 84 : 40,
      icon: Bot,
      tone: "bg-white"
    },
    {
      title: "Execution Readiness",
      value: String(data.summary.executionReadinessScore.score),
      description: data.summary.executionReadinessScore.explanation,
      score: data.summary.executionReadinessScore.score,
      icon: Gauge,
      tone: "bg-white"
    },
    {
      title: "Active Trades",
      value: String(data.summary.activeTrades),
      description: "Live execution disabled; placeholder count only.",
      score: data.summary.activeTrades === 0 ? 80 : 60,
      icon: Briefcase,
      tone: "bg-white"
    },
    {
      title: "Open Alerts",
      value: String(data.summary.openAlerts),
      description: "Alerts and incidents awaiting resolution.",
      score: Math.max(0, 100 - data.summary.openAlerts * 12),
      icon: AlertTriangle,
      tone: "bg-white"
    }
  ] as const;

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <StatusCard key={card.title} {...card} />
      ))}
    </section>
  );
}

