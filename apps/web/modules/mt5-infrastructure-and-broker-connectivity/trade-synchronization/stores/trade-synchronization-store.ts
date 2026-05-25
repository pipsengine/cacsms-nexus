"use client";

import { create } from "zustand";

import type { Role } from "../types/trade-synchronization.types";

type TradeSyncState = {
  role: Role;
  selectedTradeId: string | null;
  selectedTradeIds: Record<string, boolean>;
  searchTerm: string;
  statusFilter: string;
  showDetailPanel: boolean;
  setRole: (role: Role) => void;
  setSelectedTradeId: (tradeId: string | null) => void;
  toggleSelectedTrade: (tradeId: string) => void;
  clearSelectedTrades: () => void;
  setSearchTerm: (term: string) => void;
  setStatusFilter: (filter: string) => void;
  toggleDetailPanel: () => void;
};

export const useTradeSyncStore = create<TradeSyncState>((set) => ({
  role: "Trading Admin",
  selectedTradeId: null,
  selectedTradeIds: {},
  searchTerm: "",
  statusFilter: "all",
  showDetailPanel: true,
  setRole: (role) => set({ role }),
  setSelectedTradeId: (tradeId) => set({ selectedTradeId: tradeId }),
  toggleSelectedTrade: (tradeId) =>
    set((state) => ({ selectedTradeIds: { ...state.selectedTradeIds, [tradeId]: !state.selectedTradeIds[tradeId] } })),
  clearSelectedTrades: () => set({ selectedTradeIds: {} }),
  setSearchTerm: (term) => set({ searchTerm: term }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),
  toggleDetailPanel: () => set((state) => ({ showDetailPanel: !state.showDetailPanel }))
}));

