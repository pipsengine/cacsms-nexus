"use client";

import { useEffect } from "react";

import { useWorkflowStore } from "@/stores/workflow-store";

export function useWorkflowStatus() {
  const stages = useWorkflowStore((state) => state.stages);
  const selectedStage = useWorkflowStore((state) => state.selectedStage);
  const simulatedStatus = useWorkflowStore((state) => state.simulatedStatus);
  const lastUpdatedAt = useWorkflowStore((state) => state.lastUpdatedAt);
  const selectStage = useWorkflowStore((state) => state.selectStage);
  const touchLastUpdatedAt = useWorkflowStore((state) => state.touchLastUpdatedAt);

  useEffect(() => {
    if (!lastUpdatedAt) {
      touchLastUpdatedAt();
    }
  }, [lastUpdatedAt, touchLastUpdatedAt]);

  return { stages, selectedStage, simulatedStatus, lastUpdatedAt, selectStage };
}
