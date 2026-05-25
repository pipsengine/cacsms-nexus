"use client";

import { create } from "zustand";

import type { Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";

type SpreadMonitorUiState = {
  role: Mt5Role;
  searchTerm: string;
  assetFilter: string;
  statusFilter: string;
  brokerFilter: string;
  selectedSymbol: string | null;
  selectedThresholdId: string | null;
  showDetailPanel: boolean;
  alertFilter: string;
  setRole: (role: Mt5Role) => void;
  setSearchTerm: (term: string) => void;
  setAssetFilter: (value: string) => void;
  setStatusFilter: (value: string) => void;
  setBrokerFilter: (value: string) => void;
  setSelectedSymbol: (symbol: string | null) => void;
  setSelectedThresholdId: (id: string | null) => void;
  toggleDetailPanel: () => void;
  setAlertFilter: (value: string) => void;
};

export const useSpreadMonitorStore = create<SpreadMonitorUiState>((set) => ({
  role: "Read-Only Viewer",
  searchTerm: "",
  assetFilter: "all",
  statusFilter: "all",
  brokerFilter: "all",
  selectedSymbol: null,
  selectedThresholdId: null,
  showDetailPanel: true,
  alertFilter: "Unresolved",
  setRole: (role) => set({ role }),
  setSearchTerm: (term) => set({ searchTerm: term }),
  setAssetFilter: (value) => set({ assetFilter: value }),
  setStatusFilter: (value) => set({ statusFilter: value }),
  setBrokerFilter: (value) => set({ brokerFilter: value }),
  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
  setSelectedThresholdId: (id) => set({ selectedThresholdId: id }),
  toggleDetailPanel: () => set((s) => ({ showDetailPanel: !s.showDetailPanel })),
  setAlertFilter: (value) => set({ alertFilter: value })
}));

