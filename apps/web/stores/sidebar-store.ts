"use client";

import { create } from "zustand";

import { navigationGroups } from "@/config/navigation";

type SidebarState = {
  isCollapsed: boolean;
  openGroups: Record<string, boolean>;
  activePath: string;
  searchTerm: string;
  toggleCollapsed: () => void;
  toggleGroup: (moduleKey: string) => void;
  setSearchTerm: (term: string) => void;
  setActivePath: (path: string) => void;
};

function computeOpenGroupsForSearch(term: string) {
  const normalized = term.trim().toLowerCase();
  if (!normalized) {
    return {};
  }

  return navigationGroups.reduce<Record<string, boolean>>((acc, group) => {
    const inGroup =
      group.label.toLowerCase().includes(normalized) ||
      group.description.toLowerCase().includes(normalized) ||
      group.items.some(
        (item) => item.label.toLowerCase().includes(normalized) || item.description.toLowerCase().includes(normalized)
      ) ||
      (group.groups?.some(
        (subgroup) =>
          subgroup.label.toLowerCase().includes(normalized) ||
          subgroup.description.toLowerCase().includes(normalized) ||
          subgroup.items.some(
            (item) => item.label.toLowerCase().includes(normalized) || item.description.toLowerCase().includes(normalized)
          )
      ) ??
        false);

    if (inGroup) {
      acc[group.moduleKey] = true;
    }

    return acc;
  }, {});
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isCollapsed: false,
  openGroups: { [navigationGroups[0]?.moduleKey ?? "executive-overview"]: true },
  activePath: "",
  searchTerm: "",
  toggleCollapsed: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
  toggleGroup: (moduleKey) => set((state) => ({ openGroups: { ...state.openGroups, [moduleKey]: !state.openGroups[moduleKey] } })),
  setSearchTerm: (term) =>
    set((state) => ({
      searchTerm: term,
      openGroups: term.trim()
        ? { ...state.openGroups, ...computeOpenGroupsForSearch(term) }
        : { [(state.activePath.split("/").filter(Boolean)[0] ?? navigationGroups[0]?.moduleKey ?? "executive-overview") as string]: true }
    })),
  setActivePath: (path) => set({ activePath: path })
}));
