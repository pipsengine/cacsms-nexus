import { create } from "zustand";

type UiState = {
  sidebarOpen: boolean;
  activeView: "executive-overview" | "workflow-dashboard" | "system-setup";
  setSidebarOpen: (open: boolean) => void;
  setActiveView: (view: UiState["activeView"]) => void;
};

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  activeView: "workflow-dashboard",
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveView: (view) => set({ activeView: view })
}));
