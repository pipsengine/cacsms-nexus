import { clampScore, safeRatio } from "./utils";

export function calculateWorkflowProgressScore(input: {
  stages?: Array<{ status: string; progress: number }>;
}) {
  const stages = input.stages ?? [];
  if (!stages.length) {
    return { score: 0, explanation: "No workflow stages provided; score defaults to 0.", factors: {} as Record<string, number> };
  }

  const completed = stages.filter((s) => s.progress >= 100 || s.status === "Operational" || s.status === "Approved").length;
  const running = stages.filter((s) => s.status === "Running" || s.status === "Analyzing" || s.status === "Learning" || s.status === "Recovering").length;
  const blocked = stages.filter((s) => s.status === "Blocked").length;
  const critical = stages.filter((s) => s.status === "Critical").length;

  const completedRatio = safeRatio(completed, stages.length);
  const runningRatio = safeRatio(running, stages.length);

  const base = completedRatio * 80 + runningRatio * 20;
  const blockedPenalty = blocked * 6;
  const criticalPenalty = critical * 8;

  const score = clampScore(base - blockedPenalty - criticalPenalty);

  return {
    score,
    explanation: "Workflow progress reflects completed and running stages, minus penalties for blocked and critical stages.",
    factors: {
      completedRatio: Math.round(completedRatio * 100),
      runningRatio: Math.round(runningRatio * 100),
      blockedCount: blocked,
      criticalCount: critical
    }
  };
}

