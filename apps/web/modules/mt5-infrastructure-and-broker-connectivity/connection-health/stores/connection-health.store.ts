"use client";

import { create } from "zustand";

import type { Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";

type ConnectionHealthUiState = {
  role: Mt5Role;
  searchTerm: string;
  typeFilter: string;
  statusFilter: string;
  selectedComponentId: string | null;
  selectedComponentIds: Record<string, boolean>;
  incidentFilter: string;
  showDetailPanel: boolean;
  setRole: (role: Mt5Role) => void;
  setSearchTerm: (term: string) => void;
  setTypeFilter: (value: string) => void;
  setStatusFilter: (value: string) => void;
  setSelectedComponentId: (id: string | null) => void;
  toggleSelected: (id: string) => void;
  clearSelected: () => void;
  setIncidentFilter: (value: string) => void;
  toggleDetailPanel: () => void;
};

export const useConnectionHealthStore = create<ConnectionHealthUiState>((set) => ({
  role: "Read-Only Viewer",
  searchTerm: "",
  typeFilter: "all",
  statusFilter: "all",
  selectedComponentId: null,
  selectedComponentIds: {},
  incidentFilter: "Unresolved",
  showDetailPanel: true,
  setRole: (role) => set({ role }),
  setSearchTerm: (term) => set({ searchTerm: term }),
  setTypeFilter: (value) => set({ typeFilter: value }),
  setStatusFilter: (value) => set({ statusFilter: value }),
  setSelectedComponentId: (id) => set({ selectedComponentId: id }),
  toggleSelected: (id) => set((s) => ({ selectedComponentIds: { ...s.selectedComponentIds, [id]: !s.selectedComponentIds[id] } })),
  clearSelected: () => set({ selectedComponentIds: {} }),
  setIncidentFilter: (value) => set({ incidentFilter: value }),
  toggleDetailPanel: () => set((s) => ({ showDetailPanel: !s.showDetailPanel }))
}));

