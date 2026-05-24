"use client";

import { useWorkflowStore } from "@/stores/workflow-store";

export function useWorkflowStatus() {
  return useWorkflowStore((state) => ({
    stages: state.stages,
    selectedStage: state.selectedStage,
    simulatedStatus: state.simulatedStatus,
    lastUpdatedAt: state.lastUpdatedAt,
    selectStage: state.selectStage
  }));
}
