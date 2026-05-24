import type { WorkflowStatus } from "@cacsms-nexus/types/workflow";

import { cn } from "@/lib/utils";

const statusStyles: Record<WorkflowStatus, string> = {
  Operational: "border-green-200 bg-green-50 text-green-700",
  Running: "border-blue-200 bg-blue-50 text-blue-700",
  Analyzing: "border-purple-200 bg-purple-50 text-purple-700",
  Pending: "border-yellow-200 bg-yellow-50 text-yellow-700",
  Approved: "border-green-200 bg-green-50 text-green-700",
  Blocked: "border-red-200 bg-red-50 text-red-700",
  Warning: "border-orange-200 bg-orange-50 text-orange-700",
  Critical: "border-red-200 bg-red-50 text-red-700",
  Learning: "border-indigo-200 bg-indigo-50 text-indigo-700",
  Recovering: "border-orange-200 bg-orange-50 text-orange-700",
  Offline: "border-slate-200 bg-slate-50 text-slate-600"
};

type StatusBadgeProps = {
  status: WorkflowStatus;
  variant?: "default" | "compact";
};

export function StatusBadge({ status, variant = "default" }: StatusBadgeProps) {
  const isLive = status === "Running" || status === "Operational" || status === "Analyzing" || status === "Recovering";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-normal",
        variant === "compact" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
        statusStyles[status]
      )}
    >
      {isLive ? <span className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse" /> : null}
      {status}
    </span>
  );
}
