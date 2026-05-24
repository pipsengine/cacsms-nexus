"use client";

import { motion } from "framer-motion";

const stages = [
  "Market Intake",
  "Signal Registry",
  "Data Validation",
  "Risk Boundary",
  "Liquidity Map",
  "Execution Context",
  "Portfolio Lens",
  "Scenario Queue",
  "Compliance Gate",
  "Capital Allocation",
  "Venue Routing",
  "Order Preview",
  "Policy Check",
  "Human Oversight",
  "Autonomy Guard",
  "Execution Hold",
  "Trade Dispatch",
  "Fill Monitor",
  "Exposure Update",
  "Exception Review",
  "Audit Trail",
  "Performance Readout",
  "Learning Backlog"
];

const tones = [
  "border-blue-200 bg-blue-50 text-blue-700",
  "border-cyan-200 bg-cyan-50 text-cyan-700",
  "border-emerald-200 bg-emerald-50 text-emerald-700",
  "border-amber-200 bg-amber-50 text-amber-700",
  "border-rose-200 bg-rose-50 text-rose-700",
  "border-violet-200 bg-violet-50 text-violet-700"
];

export function WorkflowPreview() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-enterprise">
      <div className="flex flex-col gap-2 border-b border-slate-100 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-blue-600">Workflow dashboard</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">23-stage institutional workflow preview</h2>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          Placeholder stages only. Full workflow orchestration, trading logic, AI modules, and backend services will be attached later.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {stages.map((stage, index) => (
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.025, duration: 0.25 }}
            className={`${tones[index % tones.length]} rounded-md border p-3`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold">Stage {String(index + 1).padStart(2, "0")}</span>
              <span className="h-2 w-2 rounded-full bg-current" />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-950">{stage}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Reserved module boundary</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
