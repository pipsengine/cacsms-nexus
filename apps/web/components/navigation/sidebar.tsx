"use client";

import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useEffect } from "react";

import { navigationGroups } from "@/config/navigation";
import { CollapsedSidebar } from "@/components/navigation/collapsed-sidebar";
import { SidebarFooter } from "@/components/navigation/sidebar-footer";
import { SidebarGroup } from "@/components/navigation/sidebar-group";
import { SidebarSearch } from "@/components/navigation/sidebar-search";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";

export function Sidebar() {
  const isCollapsed = useSidebarStore((state) => state.isCollapsed);
  return isCollapsed ? <CollapsedSidebar /> : <ExpandedSidebar />;
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchTerm = useSidebarStore((state) => state.searchTerm);
  const setActivePath = useSidebarStore((state) => state.setActivePath);

  useEffect(() => {
    setActivePath(pathname);
  }, [pathname, setActivePath]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">Cacsms Nexus</p>
            <p className="truncate text-xs text-slate-500">AI-Driven Autonomous Institutional Trading Ecosystem</p>
          </div>
        </div>
      </div>

      <SidebarSearch />

      <ScrollArea className="flex-1">
        <nav className="space-y-4 px-4 pb-4" aria-label="Enterprise navigation">
          {navigationGroups.map((group) => (
            <SidebarGroup key={group.moduleKey} group={group} activePath={pathname} onNavigate={onNavigate} />
          ))}
          {searchTerm.trim() ? (
            <p className="pt-2 text-xs font-medium text-slate-500">{navigationGroups.length} domains configured</p>
          ) : null}
        </nav>
      </ScrollArea>

      <SidebarFooter />
    </div>
  );
}

function ExpandedSidebar() {
  return (
    <aside
      className={cn(
        "sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 border-r border-slate-200 bg-white xl:flex xl:flex-col",
        "lg:w-[280px] xl:w-[320px]"
      )}
    >
      <SidebarContent />
    </aside>
  );
}
