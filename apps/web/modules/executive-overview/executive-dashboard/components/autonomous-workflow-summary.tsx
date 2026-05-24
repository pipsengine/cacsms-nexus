"use client";

import { ArrowRight, Gauge } from "lucide-react";
import { motion } from "framer-motion";

import type { ExecutiveDashboardResponse, WorkflowStageSummary } from "../types/executive-dashboard.types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useExecutiveDashboardStore } from "../stores/executive-dashboard-store";

function statusVariant(status: WorkflowStageSummary["status"]) {
  if (status === "Operational" || status === "Approved") return "success" as const;
  if (status === "Running" || status === "Analyzing" || status === "Learning" || status === "Recovering") return "default" as const;
  if (status === "Pending") return "secondary" as const;
  if (status === "Warning") return "warning" as const;
  if (status === "Critical" || status === "Blocked") return "destructive" as const;
  return "secondary" as const;
}

function tone(colorType: WorkflowStageSummary["colorType"]) {
  if (colorType === "green") return "border-green-200 bg-green-50/60";
  if (colorType === "blue") return "border-blue-200 bg-blue-50/60";
  if (colorType === "purple") return "border-purple-200 bg-purple-50/60";
  if (colorType === "teal") return "border-teal-200 bg-teal-50/60";
  if (colorType === "orange") return "border-orange-200 bg-orange-50/60";
  if (colorType === "red") return "border-red-200 bg-red-50/60";
  if (colorType === "yellow") return "border-yellow-200 bg-yellow-50/60";
  if (colorType === "indigo") return "border-indigo-200 bg-indigo-50/60";
  if (colorType === "pink") return "border-pink-200 bg-pink-50/60";
  return "border-slate-200 bg-slate-50";
}

export function AutonomousWorkflowSummary({ data }: { data: ExecutiveDashboardResponse }) {
  const selectedWorkflowStage = useExecutiveDashboardStore((state) => state.selectedWorkflowStage);
  const setSelectedWorkflowStage = useExecutiveDashboardStore((state) => state.setSelectedWorkflowStage);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-blue-600">Autonomous Workflow</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">23-stage pipeline summary</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Compressed executive view of the full orchestration chain. Hover and select stages for context.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
          <Gauge className="h-4 w-4 text-blue-600" />
          Progress score: {data.summary.workflowProgressScore.score}/100
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-2">
        <div className="flex min-w-max items-stretch gap-2">
          {data.workflowStages.map((stage, index) => {
            const active = stage.stageNumber === selectedWorkflowStage;
            return (
              <div key={stage.stageNumber} className="flex items-stretch gap-2">
                <motion.button
                  type="button"
                  onClick={() => setSelectedWorkflowStage(active ? null : stage.stageNumber)}
                  className={cn(
                    "w-[250px] shrink-0 rounded-2xl border p-4 text-left shadow-sm transition-colors hover:bg-white",
                    tone(stage.colorType),
                    active ? "ring-2 ring-blue-500 ring-offset-2" : "ring-0"
                  )}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(index * 0.01, 0.22) }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase text-slate-600">Stage {String(stage.stageNumber).padStart(2, "0")}</p>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-950">{stage.title}</p>
                    </div>
                    <Badge variant={statusVariant(stage.status)}>{stage.status}</Badge>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                    <span>Progress</span>
                    <span className="text-slate-900">{stage.progress}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/70">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(2, stage.progress)}%` }} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase text-slate-500">Latency</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{stage.latencyMs ? `${stage.latencyMs}ms` : "N/A"}</p>
                    </div>
                    <div className="rounded-xl border border-white/70 bg-white/70 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase text-slate-500">Health</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{stage.health}</p>
                    </div>
                  </div>
                </motion.button>

                {index !== data.workflowStages.length - 1 ? (
                  <div className="hidden items-center xl:flex">
                    <div className="rounded-full border border-slate-200 bg-white p-1 text-slate-400 shadow-sm">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

