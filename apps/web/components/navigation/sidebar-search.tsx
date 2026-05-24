"use client";

import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSidebarStore } from "@/stores/sidebar-store";

export function SidebarSearch() {
  const searchTerm = useSidebarStore((state) => state.searchTerm);
  const setSearchTerm = useSidebarStore((state) => state.setSearchTerm);

  return (
    <div className="px-4 pb-4">
      <p className="text-[11px] font-semibold uppercase text-slate-500">Navigation</p>
      <div className="mt-3 flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search modules"
          aria-label="Search navigation"
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
        />
        {searchTerm.trim() ? (
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Clear search"
            className="h-8 w-8"
            onClick={() => setSearchTerm("")}
          >
            <X className="h-4 w-4 text-slate-500" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
