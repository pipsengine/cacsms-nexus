"use client";

import { create } from "zustand";

import type { Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";
import type { ExecutionStatus, ReviewedStatus } from "../types/execution-logs.types";

type ExecutionLogsUiState = {
  role: Mt5Role;
  searchTerm: string;
  statusFilter: ExecutionStatus | "all";
  brokerFilter: string;
  symbolFilter: string;
  reviewedFilter: ReviewedStatus | "all";
  selectedLogId: string | null;
  selectedLogIds: string[];
  showDetailPanel: boolean;
  setRole: (role: Mt5Role) => void;
  setSearchTerm: (value: string) => void;
  setStatusFilter: (value: ExecutionStatus | "all") => void;
  setBrokerFilter: (value: string) => void;
  setSymbolFilter: (value: string) => void;
  setReviewedFilter: (value: ReviewedStatus | "all") => void;
  setSelectedLogId: (value: string | null) => void;
  toggleSelectedLogId: (logId: string) => void;
  clearSelection: () => void;
  toggleDetailPanel: () => void;
};

export const useExecutionLogsStore = create<ExecutionLogsUiState>((set) => ({
  role: "Read-Only Viewer",
  searchTerm: "",
  statusFilter: "all",
  brokerFilter: "all",
  symbolFilter: "all",
  reviewedFilter: "all",
  selectedLogId: null,
  selectedLogIds: [],
  showDetailPanel: true,
  setRole: (role) => set({ role }),
  setSearchTerm: (value) => set({ searchTerm: value }),
  setStatusFilter: (value) => set({ statusFilter: value }),
  setBrokerFilter: (value) => set({ brokerFilter: value }),
  setSymbolFilter: (value) => set({ symbolFilter: value }),
  setReviewedFilter: (value) => set({ reviewedFilter: value }),
  setSelectedLogId: (value) => set({ selectedLogId: value }),
  toggleSelectedLogId: (logId) =>
    set((s) => {
      const exists = s.selectedLogIds.includes(logId);
      const selectedLogIds = exists ? s.selectedLogIds.filter((id) => id !== logId) : [...s.selectedLogIds, logId];
      const selectedLogId = s.selectedLogId ?? logId;
      return { selectedLogIds, selectedLogId };
    }),
  clearSelection: () => set({ selectedLogIds: [] }),
  toggleDetailPanel: () => set((s) => ({ showDetailPanel: !s.showDetailPanel }))
}));

