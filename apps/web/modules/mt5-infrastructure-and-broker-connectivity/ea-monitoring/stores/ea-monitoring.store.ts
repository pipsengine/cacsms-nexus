"use client";

import { create } from "zustand";

import type { Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";
import type { EaRiskLevel } from "../types/ea-monitoring.types";

type EaMonitoringUiState = {
  role: Mt5Role;
  searchTerm: string;
  statusFilter: "all" | "Online" | "Offline" | "Degraded";
  riskFilter: EaRiskLevel | "all";
  tradingFilter: "all" | "enabled" | "disabled";
  selectedEaId: string | null;
  selectedEaIds: string[];
  showDetailPanel: boolean;
  logsFilter: string;
  setRole: (role: Mt5Role) => void;
  setSearchTerm: (value: string) => void;
  setStatusFilter: (value: EaMonitoringUiState["statusFilter"]) => void;
  setRiskFilter: (value: EaMonitoringUiState["riskFilter"]) => void;
  setTradingFilter: (value: EaMonitoringUiState["tradingFilter"]) => void;
  setSelectedEaId: (value: string | null) => void;
  toggleSelectedEaId: (eaId: string) => void;
  clearSelection: () => void;
  toggleDetailPanel: () => void;
  setLogsFilter: (value: string) => void;
};

export const useEaMonitoringStore = create<EaMonitoringUiState>((set) => ({
  role: "Read-Only Viewer",
  searchTerm: "",
  statusFilter: "all",
  riskFilter: "all",
  tradingFilter: "all",
  selectedEaId: null,
  selectedEaIds: [],
  showDetailPanel: true,
  logsFilter: "All",
  setRole: (role) => set({ role }),
  setSearchTerm: (value) => set({ searchTerm: value }),
  setStatusFilter: (value) => set({ statusFilter: value }),
  setRiskFilter: (value) => set({ riskFilter: value }),
  setTradingFilter: (value) => set({ tradingFilter: value }),
  setSelectedEaId: (value) => set({ selectedEaId: value }),
  toggleSelectedEaId: (eaId) =>
    set((s) => {
      const exists = s.selectedEaIds.includes(eaId);
      const selectedEaIds = exists ? s.selectedEaIds.filter((id) => id !== eaId) : [...s.selectedEaIds, eaId];
      const selectedEaId = s.selectedEaId ?? eaId;
      return { selectedEaIds, selectedEaId };
    }),
  clearSelection: () => set({ selectedEaIds: [] }),
  toggleDetailPanel: () => set((s) => ({ showDetailPanel: !s.showDetailPanel })),
  setLogsFilter: (value) => set({ logsFilter: value })
}));

