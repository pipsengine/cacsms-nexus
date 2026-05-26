"use client";

import { create } from "zustand";

import type { Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";
import type { Mt5ErrorResolutionStatus, Mt5ErrorSeverity, Mt5ErrorSourceModule } from "../types/mt5-error-logs.types";

type Mt5ErrorLogsUiState = {
  role: Mt5Role;
  searchTerm: string;
  severityFilter: Mt5ErrorSeverity | "all";
  moduleFilter: Mt5ErrorSourceModule | "all";
  statusFilter: Mt5ErrorResolutionStatus | "all";
  brokerFilter: string;
  selectedErrorId: string | null;
  selectedErrorIds: string[];
  showDetailPanel: boolean;
  setRole: (role: Mt5Role) => void;
  setSearchTerm: (value: string) => void;
  setSeverityFilter: (value: Mt5ErrorSeverity | "all") => void;
  setModuleFilter: (value: Mt5ErrorSourceModule | "all") => void;
  setStatusFilter: (value: Mt5ErrorResolutionStatus | "all") => void;
  setBrokerFilter: (value: string) => void;
  setSelectedErrorId: (value: string | null) => void;
  toggleSelectedErrorId: (errorId: string) => void;
  clearSelection: () => void;
  toggleDetailPanel: () => void;
};

export const useMt5ErrorLogsStore = create<Mt5ErrorLogsUiState>((set) => ({
  role: "Read-Only Viewer",
  searchTerm: "",
  severityFilter: "all",
  moduleFilter: "all",
  statusFilter: "all",
  brokerFilter: "all",
  selectedErrorId: null,
  selectedErrorIds: [],
  showDetailPanel: true,
  setRole: (role) => set({ role }),
  setSearchTerm: (value) => set({ searchTerm: value }),
  setSeverityFilter: (value) => set({ severityFilter: value }),
  setModuleFilter: (value) => set({ moduleFilter: value }),
  setStatusFilter: (value) => set({ statusFilter: value }),
  setBrokerFilter: (value) => set({ brokerFilter: value }),
  setSelectedErrorId: (value) => set({ selectedErrorId: value }),
  toggleSelectedErrorId: (errorId) =>
    set((s) => {
      const exists = s.selectedErrorIds.includes(errorId);
      const selectedErrorIds = exists ? s.selectedErrorIds.filter((id) => id !== errorId) : [...s.selectedErrorIds, errorId];
      const selectedErrorId = s.selectedErrorId ?? errorId;
      return { selectedErrorIds, selectedErrorId };
    }),
  clearSelection: () => set({ selectedErrorIds: [] }),
  toggleDetailPanel: () => set((s) => ({ showDetailPanel: !s.showDetailPanel }))
}));

