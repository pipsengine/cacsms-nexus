"use client";

import { create } from "zustand";

import type { Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";

type ExecutionQueueUiState = {
  role: Mt5Role;
  searchTerm: string;
  statusFilter: string;
  priorityFilter: string;
  selectedQueueId: string | null;
  selectedQueueIds: Record<string, boolean>;
  showDetailPanel: boolean;
  setRole: (role: Mt5Role) => void;
  setSearchTerm: (term: string) => void;
  setStatusFilter: (filter: string) => void;
  setPriorityFilter: (filter: string) => void;
  setSelectedQueueId: (queueId: string | null) => void;
  toggleSelected: (queueId: string) => void;
  clearSelected: () => void;
  toggleDetailPanel: () => void;
};

export const useExecutionQueueStore = create<ExecutionQueueUiState>((set) => ({
  role: "Read-Only Viewer",
  searchTerm: "",
  statusFilter: "all",
  priorityFilter: "all",
  selectedQueueId: null,
  selectedQueueIds: {},
  showDetailPanel: true,
  setRole: (role) => set({ role }),
  setSearchTerm: (term) => set({ searchTerm: term }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),
  setPriorityFilter: (filter) => set({ priorityFilter: filter }),
  setSelectedQueueId: (queueId) => set({ selectedQueueId: queueId }),
  toggleSelected: (queueId) => set((s) => ({ selectedQueueIds: { ...s.selectedQueueIds, [queueId]: !s.selectedQueueIds[queueId] } })),
  clearSelected: () => set({ selectedQueueIds: {} }),
  toggleDetailPanel: () => set((s) => ({ showDetailPanel: !s.showDetailPanel }))
}));

