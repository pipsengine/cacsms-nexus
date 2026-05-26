"use client";

import { create } from "zustand";

import type { Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";

type SlippageMonitorUiState = {
  role: Mt5Role;
  searchTerm: string;
  assetFilter: string;
  breachFilter: string;
  brokerFilter: string;
  selectedExecutionId: string | null;
  selectedThresholdId: string | null;
  showDetailPanel: boolean;
  alertFilter: string;
  setRole: (role: Mt5Role) => void;
  setSearchTerm: (term: string) => void;
  setAssetFilter: (value: string) => void;
  setBreachFilter: (value: string) => void;
  setBrokerFilter: (value: string) => void;
  setSelectedExecutionId: (id: string | null) => void;
  setSelectedThresholdId: (id: string | null) => void;
  toggleDetailPanel: () => void;
  setAlertFilter: (value: string) => void;
};

export const useSlippageMonitorStore = create<SlippageMonitorUiState>((set) => ({
  role: "Read-Only Viewer",
  searchTerm: "",
  assetFilter: "all",
  breachFilter: "all",
  brokerFilter: "all",
  selectedExecutionId: null,
  selectedThresholdId: null,
  showDetailPanel: true,
  alertFilter: "Unresolved",
  setRole: (role) => set({ role }),
  setSearchTerm: (term) => set({ searchTerm: term }),
  setAssetFilter: (value) => set({ assetFilter: value }),
  setBreachFilter: (value) => set({ breachFilter: value }),
  setBrokerFilter: (value) => set({ brokerFilter: value }),
  setSelectedExecutionId: (id) => set({ selectedExecutionId: id }),
  setSelectedThresholdId: (id) => set({ selectedThresholdId: id }),
  toggleDetailPanel: () => set((s) => ({ showDetailPanel: !s.showDetailPanel })),
  setAlertFilter: (value) => set({ alertFilter: value })
}));

