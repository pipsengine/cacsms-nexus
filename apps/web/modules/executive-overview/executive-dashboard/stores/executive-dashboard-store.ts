"use client";

import { create } from "zustand";

import type { AccountType, SystemMode } from "../types/executive-dashboard.types";

type ExecutiveDashboardState = {
  selectedAccountId: string;
  selectedAccountType: AccountType;
  selectedAccountName: string;
  selectedSystemMode: SystemMode;
  selectedWorkflowStage: number | null;
  showOnlyAlertsOpen: boolean;
  toggleAlertsFilter: () => void;
  setSelectedWorkflowStage: (stageNumber: number | null) => void;
  setAccount: (account: { id: string; type: AccountType; name: string }) => void;
  setSystemMode: (mode: SystemMode) => void;
};

export const useExecutiveDashboardStore = create<ExecutiveDashboardState>((set) => ({
  selectedAccountId: "acct_prop_001",
  selectedAccountType: "Prop Firm",
  selectedAccountName: "FTMO Challenge - Demo",
  selectedSystemMode: "Monitoring",
  selectedWorkflowStage: null,
  showOnlyAlertsOpen: true,
  toggleAlertsFilter: () => set((state) => ({ showOnlyAlertsOpen: !state.showOnlyAlertsOpen })),
  setSelectedWorkflowStage: (stageNumber) => set({ selectedWorkflowStage: stageNumber }),
  setAccount: (account) =>
    set({
      selectedAccountId: account.id,
      selectedAccountType: account.type,
      selectedAccountName: account.name
    }),
  setSystemMode: (mode) => set({ selectedSystemMode: mode })
}));

