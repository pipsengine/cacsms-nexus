"use client";

import { create } from "zustand";

import type { Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";

type LatencyMonitorUiState = {
  role: Mt5Role;
  searchTerm: string;
  componentFilter: string;
  breachFilter: string;
  brokerFilter: string;
  selectedMetricId: string | null;
  selectedThresholdId: string | null;
  showDetailPanel: boolean;
  alertFilter: string;
  setRole: (role: Mt5Role) => void;
  setSearchTerm: (term: string) => void;
  setComponentFilter: (value: string) => void;
  setBreachFilter: (value: string) => void;
  setBrokerFilter: (value: string) => void;
  setSelectedMetricId: (id: string | null) => void;
  setSelectedThresholdId: (id: string | null) => void;
  toggleDetailPanel: () => void;
  setAlertFilter: (value: string) => void;
};

export const useLatencyMonitorStore = create<LatencyMonitorUiState>((set) => ({
  role: "Read-Only Viewer",
  searchTerm: "",
  componentFilter: "all",
  breachFilter: "all",
  brokerFilter: "all",
  selectedMetricId: null,
  selectedThresholdId: null,
  showDetailPanel: true,
  alertFilter: "Unresolved",
  setRole: (role) => set({ role }),
  setSearchTerm: (term) => set({ searchTerm: term }),
  setComponentFilter: (value) => set({ componentFilter: value }),
  setBreachFilter: (value) => set({ breachFilter: value }),
  setBrokerFilter: (value) => set({ brokerFilter: value }),
  setSelectedMetricId: (id) => set({ selectedMetricId: id }),
  setSelectedThresholdId: (id) => set({ selectedThresholdId: id }),
  toggleDetailPanel: () => set((s) => ({ showDetailPanel: !s.showDetailPanel })),
  setAlertFilter: (value) => set({ alertFilter: value })
}));

