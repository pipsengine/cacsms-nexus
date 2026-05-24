"use client";

import type { NavigationItem } from "@cacsms-nexus/types";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export function SidebarItem({
  item,
  active,
  indent = 0,
  onNavigate
}: {
  item: NavigationItem<LucideIcon>;
  active: boolean;
  indent?: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.path}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative mb-1 flex items-center gap-2 rounded-[10px] border border-transparent px-3 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        active ? "border-blue-200 bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
      )}
      style={{ paddingLeft: 12 + indent }}
    >
      {active ? <span className="absolute left-0 top-1.5 h-[calc(100%-0.75rem)] w-0.5 rounded bg-blue-600" /> : null}
      {Icon ? (
        <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600")} />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}
