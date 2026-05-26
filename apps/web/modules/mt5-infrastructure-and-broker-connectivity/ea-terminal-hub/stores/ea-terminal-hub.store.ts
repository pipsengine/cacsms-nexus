"use client";

import { create } from "zustand";

import type { Mt5Role } from "../../mt5-control-center/types/mt5-control-center.types";

type EaTerminalHubUiState = {
  role: Mt5Role;
  searchTerm: string;
  selectedTerminalIds: string[];
  showRegisterForm: boolean;
  setRole: (role: Mt5Role) => void;
  setSearchTerm: (value: string) => void;
  toggleTerminalSelection: (terminalId: string) => void;
  clearSelection: () => void;
  setShowRegisterForm: (value: boolean) => void;
};

export const useEaTerminalHubStore = create<EaTerminalHubUiState>((set) => ({
  role: "Infrastructure Admin",
  searchTerm: "",
  selectedTerminalIds: [],
  showRegisterForm: false,
  setRole: (role) => set({ role }),
  setSearchTerm: (value) => set({ searchTerm: value }),
  toggleTerminalSelection: (terminalId) =>
    set((state) => ({
      selectedTerminalIds: state.selectedTerminalIds.includes(terminalId)
        ? state.selectedTerminalIds.filter((id) => id !== terminalId)
        : [...state.selectedTerminalIds, terminalId]
    })),
  clearSelection: () => set({ selectedTerminalIds: [] }),
  setShowRegisterForm: (value) => set({ showRegisterForm: value })
}));
