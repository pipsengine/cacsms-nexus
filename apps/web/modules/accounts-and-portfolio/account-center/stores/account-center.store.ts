import type { Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import { create } from "zustand";

type AccountCenterUiState = {
  role: Mt5Role;
  searchTerm: string;
  categoryFilter: string;
  setRole: (role: Mt5Role) => void;
  setSearchTerm: (value: string) => void;
  setCategoryFilter: (value: string) => void;
};

export const useAccountCenterStore = create<AccountCenterUiState>((set) => ({
  role: "Infrastructure Admin",
  searchTerm: "",
  categoryFilter: "All",
  setRole: (role) => set({ role }),
  setSearchTerm: (searchTerm) => set({ searchTerm }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter })
}));
