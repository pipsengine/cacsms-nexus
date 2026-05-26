import type { WorkflowStage, WorkflowStatus } from "@cacsms-nexus/types/workflow";
import { create } from "zustand";

type WorkflowState = {
  stages: WorkflowStage[];
  selectedStage: WorkflowStage | null;
  simulatedStatus: WorkflowStatus;
  lastUpdatedAt: string;
  touchLastUpdatedAt: () => void;
  selectStage: (stageNumber: number) => void;
  setSimulatedStatus: (status: WorkflowStatus) => void;
};

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  stages: [],
  selectedStage: null,
  simulatedStatus: "Running",
  lastUpdatedAt: "",
  touchLastUpdatedAt: () => set({ lastUpdatedAt: new Date().toISOString() }),
  selectStage: (stageNumber) => {
    const selectedStage = get().stages.find((stage) => stage.stageNumber === stageNumber) ?? null;
    set({ selectedStage, lastUpdatedAt: new Date().toISOString() });
  },
  setSimulatedStatus: (status) => set({ simulatedStatus: status, lastUpdatedAt: new Date().toISOString() })
}));
