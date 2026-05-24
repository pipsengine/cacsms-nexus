"use client";

import { motion } from "framer-motion";
import { ArrowRight, BrainCircuit, Gauge, ShieldCheck, Workflow } from "lucide-react";

import { StatusBadge } from "@/components/status/status-badge";
import { WorkflowCard } from "@/components/workflow/workflow-card";
import { useWorkflowStatus } from "@/hooks/use-workflow-status";

export function WorkflowDashboard() {
  const { stages, selectedStage, lastUpdatedAt, selectStage } = useWorkflowStatus();
  const lastUpdatedLabel = lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : "—";

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card lg:p-7">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="Operational" />
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold uppercase text-blue-700">
                Environment: Development
              </span>
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-normal text-slate-950 lg:text-5xl">Cacsms Nexus</h1>
              <p className="max-w-4xl text-xl font-semibold text-slate-700">
                AI-Driven Autonomous Institutional Trading Ecosystem
              </p>
            </div>
            <p className="max-w-5xl text-sm leading-7 text-slate-600 sm:text-base">
              A self-driving institutional AI trading ecosystem designed for prop firm accounts, broker accounts,
              autonomous MT5 operation, computer vision analysis, institutional intelligence, multi-strategy orchestration,
              risk governance, and continuous optimization.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            {[
              { label: "Workflow stages", value: "23", icon: Workflow, tone: "text-blue-700 bg-blue-50 border-blue-200" },
              { label: "Risk guardrails", value: "Enabled", icon: ShieldCheck, tone: "text-green-700 bg-green-50 border-green-200" },
              { label: "AI lanes", value: "Reserved", icon: BrainCircuit, tone: "text-purple-700 bg-purple-50 border-purple-200" }
            ].map((item) => (
              <div key={item.label} className={`rounded-2xl border p-4 ${item.tone}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase opacity-80">{item.label}</p>
                  <item.icon className="h-4 w-4" />
                </div>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-blue-600">Workflow-first dashboard</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">
                Autonomous institutional workflow preview
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Placeholder control flow only. The visual chain prepares the system for future modules without enabling live execution.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              Last updated: {lastUpdatedLabel}
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-4 min-[1800px]:grid-cols-5">
            {stages.map((stage, index) => (
              <WorkflowCard
                key={stage.stageNumber}
                {...stage}
                isLast={index === stages.length - 1}
                onSelect={selectStage}
              />
            ))}
          </div>
        </div>

        <motion.aside
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Selected stage</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">{selectedStage?.title ?? "No stage selected"}</h2>
            </div>
            <Gauge className="h-5 w-5 text-blue-600" />
          </div>

          {selectedStage ? (
            <div className="mt-5 space-y-4">
              <StatusBadge status={selectedStage.status} />
              <p className="text-sm leading-6 text-slate-600">{selectedStage.description}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Confidence</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{selectedStage.confidence}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Latency</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{selectedStage.latency}</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <ArrowRight className="h-4 w-4 text-blue-600" />
                  Future implementation boundary
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This stage is a UI and architecture placeholder. Live data, AI decisions, broker execution, and backend services
                  remain intentionally disabled.
                </p>
              </div>
            </div>
          ) : null}
        </motion.aside>
      </section>
    </div>
  );
}
