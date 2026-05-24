"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { navigationGroups } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/stores/sidebar-store";

function defaultGroupPath(moduleKey: string) {
  const group = navigationGroups.find((g) => g.moduleKey === moduleKey);
  if (!group) {
    return "/";
  }
  return group.items[0]?.path ?? group.groups?.[0]?.items[0]?.path ?? "/";
}

export function CollapsedSidebar() {
  const pathname = usePathname();
  const toggleCollapsed = useSidebarStore((state) => state.toggleCollapsed);

  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[76px] shrink-0 border-r border-slate-200 bg-white xl:flex xl:flex-col">
      <div className="flex flex-1 flex-col gap-2 px-3 py-4">
        <TooltipProvider delayDuration={120}>
          {navigationGroups.map((group) => {
            const Icon = group.icon;
            const active = pathname.startsWith(group.path);
            return (
              <Tooltip key={group.moduleKey}>
                <TooltipTrigger asChild>
                  <Link
                    href={defaultGroupPath(group.moduleKey)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-[10px] border border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                      active ? "border-blue-200 bg-blue-50" : "hover:bg-slate-50"
                    )}
                  >
                    {Icon ? <Icon className={cn("h-[18px] w-[18px]", active ? "text-blue-600" : group.color.accentText)} /> : null}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="border-slate-200 bg-white text-slate-900">
                  {group.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>
      <div className="border-t border-slate-200 p-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Expand sidebar"
          onClick={toggleCollapsed}
          className="h-11 w-11 rounded-[10px]"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}
