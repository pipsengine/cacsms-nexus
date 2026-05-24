"use client";

import { ChevronLeft, ChevronRight, ShieldCheck, UserCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";

export function SidebarFooter() {
  const isCollapsed = useSidebarStore((state) => state.isCollapsed);
  const toggleCollapsed = useSidebarStore((state) => state.toggleCollapsed);

  return (
    <div className={cn("border-t border-slate-200 p-4", isCollapsed ? "px-3" : "px-4")}>
      <div className={cn("flex items-center justify-between gap-2", isCollapsed ? "flex-col" : "flex-row")}>
        <div className={cn("flex items-center gap-2", isCollapsed ? "justify-center" : "min-w-0")}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm">
            <ShieldCheck className="h-4 w-4" />
          </div>
          {isCollapsed ? null : (
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase text-slate-500">System</p>
              <p className="truncate text-sm font-semibold text-slate-900">Stable</p>
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleCollapsed}
          className="h-9 w-9 rounded-xl"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <div className={cn("mt-4 flex items-center gap-2", isCollapsed ? "justify-center" : "justify-between")}>
        <div className="flex items-center gap-2">
          <UserCircle2 className="h-5 w-5 text-slate-500" />
          {isCollapsed ? null : (
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase text-slate-500">Operator</p>
              <p className="truncate text-sm font-semibold text-slate-900">User Profile</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
