import { create } from "zustand";

type AppState = {
  foundationMode: boolean;
  setFoundationMode: (enabled: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  foundationMode: true,
  setFoundationMode: (enabled) => set({ foundationMode: enabled })
}));
