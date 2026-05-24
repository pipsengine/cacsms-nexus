"use client";

import type { NavigationGroup, NavigationItem } from "@cacsms-nexus/types";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo } from "react";

import { SidebarItem } from "@/components/navigation/sidebar-item";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";

function matches(term: string, value: string) {
  const normalized = term.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return value.toLowerCase().includes(normalized);
}

function itemMatches(term: string, item: NavigationItem<LucideIcon>) {
  const normalized = term.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return item.label.toLowerCase().includes(normalized) || item.description.toLowerCase().includes(normalized);
}

export function SidebarGroup({
  group,
  activePath,
  onNavigate
}: {
  group: NavigationGroup<LucideIcon>;
  activePath: string;
  onNavigate?: () => void;
}) {
  const openGroups = useSidebarStore((state) => state.openGroups);
  const toggleGroup = useSidebarStore((state) => state.toggleGroup);
  const searchTerm = useSidebarStore((state) => state.searchTerm);

  const searching = searchTerm.trim().length > 0;
  const isOpen = searching || openGroups[group.moduleKey];
  const GroupIcon = group.icon;

  const { visibleItems, visibleSubgroups } = useMemo(() => {
    const visibleItems = group.items.filter((item) => itemMatches(searchTerm, item));
    const visibleSubgroups =
      group.groups
        ?.map((subgroup) => ({
          ...subgroup,
          items: subgroup.items.filter((item) => itemMatches(searchTerm, item)),
          open:
            searching ||
            matches(searchTerm, subgroup.label) ||
            matches(searchTerm, subgroup.description) ||
            subgroup.items.some((item) => itemMatches(searchTerm, item))
        }))
        .filter((subgroup) => subgroup.items.length > 0 || matches(searchTerm, subgroup.label) || matches(searchTerm, subgroup.description)) ?? [];

    const groupMatches =
      matches(searchTerm, group.label) ||
      matches(searchTerm, group.description) ||
      visibleItems.length > 0 ||
      visibleSubgroups.length > 0;

    return groupMatches ? { visibleItems, visibleSubgroups } : { visibleItems: [], visibleSubgroups: [] };
  }, [group, searchTerm, searching]);

  if (!visibleItems.length && !visibleSubgroups.length && searching) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => toggleGroup(group.moduleKey)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        aria-expanded={isOpen}
      >
        <span className="flex min-w-0 items-center gap-2">
          {GroupIcon ? (
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-[10px] border bg-white", group.color.accentBorder)}>
              <GroupIcon className={cn("h-[18px] w-[18px]", group.color.accentText)} />
            </span>
          ) : null}
          <span className="min-w-0 truncate">{group.label}</span>
        </span>
        {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />}
      </button>

      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="border-t border-slate-100 px-3 py-2"
          >
            {visibleItems.map((item) => (
              <SidebarItem key={item.path} item={item} active={item.path === activePath} onNavigate={onNavigate} />
            ))}

            {visibleSubgroups.map((subgroup) => (
              <div key={subgroup.label} className="mt-3">
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{subgroup.label}</p>
                <AnimatePresence initial={false}>
                  {subgroup.open ? (
                    <motion.div
                      key="subgroup"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      {subgroup.items.map((item) => (
                        <SidebarItem key={item.path} item={item} active={item.path === activePath} indent={28} onNavigate={onNavigate} />
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
