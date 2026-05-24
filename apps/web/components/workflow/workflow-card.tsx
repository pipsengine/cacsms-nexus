"use client";

import type { WorkflowColorType, WorkflowStage } from "@cacsms-nexus/types/workflow";
import { motion } from "framer-motion";
import { Activity, ArrowRight, Cpu, Gauge } from "lucide-react";

import { StatusBadge } from "@/components/status/status-badge";
import { cn } from "@/lib/utils";

const colorStyles: Record<WorkflowColorType, string> = {
  blue: "border-blue-200 bg-blue-50/70 text-blue-700",
  purple: "border-purple-200 bg-purple-50/70 text-purple-700",
  green: "border-green-200 bg-green-50/70 text-green-700",
  red: "border-red-200 bg-red-50/70 text-red-700",
  orange: "border-orange-200 bg-orange-50/70 text-orange-700",
  yellow: "border-yellow-200 bg-yellow-50/70 text-yellow-700",
  teal: "border-teal-200 bg-teal-50/70 text-teal-700",
  indigo: "border-indigo-200 bg-indigo-50/70 text-indigo-700",
  pink: "border-pink-200 bg-pink-50/70 text-pink-700",
  gray: "border-slate-200 bg-slate-50 text-slate-600"
};

type WorkflowCardProps = WorkflowStage & {
  isLast?: boolean;
  onSelect?: (stageNumber: number) => void;
};

export function WorkflowCard({
  stageNumber,
  title,
  description,
  status,
  confidence,
  latency,
  health,
  colorType,
  isLast = false,
  onSelect
}: WorkflowCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.24, delay: Math.min(stageNumber * 0.018, 0.42) }}
      onClick={() => onSelect?.(stageNumber)}
      className={cn(
        "group relative min-h-[248px] cursor-default rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-card",
        colorStyles[colorType]
      )}
    >
      {!isLast ? (
        <div className="pointer-events-none absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-slate-200 bg-white p-1 text-slate-400 shadow-sm motion-safe:animate-pulse xl:block">
          <ArrowRight className="h-4 w-4" />
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase text-slate-500">Stage {String(stageNumber).padStart(2, "0")}</p>
            <h3 className="mt-1 text-sm font-semibold leading-5 text-slate-950">{title}</h3>
          </div>
        </div>
      </div>

      <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-600">{description}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={status} variant="compact" />
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
          {health}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/80 bg-white/80 p-3">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Gauge className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold uppercase">Confidence</span>
          </div>
          <p className="mt-1 text-lg font-semibold text-slate-950">{confidence}</p>
        </div>
        <div className="rounded-xl border border-white/80 bg-white/80 p-3">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Activity className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold uppercase">Latency</span>
          </div>
          <p className="mt-1 text-lg font-semibold text-slate-950">{latency}</p>
        </div>
      </div>
    </motion.article>
  );
}
