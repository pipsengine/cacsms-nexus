"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { findNavigationGroupByPath, findNavigationItemByPath } from "@/config/navigation";

export function NavigationBreadcrumb() {
  const pathname = usePathname();
  const group = findNavigationGroupByPath(pathname);
  const item = findNavigationItemByPath(pathname);

  if (!group || !item) {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  const subgroup = segments.length === 3 ? segments[1] : null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-slate-500">
      <Link href="/" className="hover:text-slate-900">
        Cacsms Nexus
      </Link>
      <ArrowRight className="h-3.5 w-3.5" />
      <Link href={group.items[0]?.path ?? group.groups?.[0]?.items[0]?.path ?? group.path} className="hover:text-slate-900">
        {group.label}
      </Link>
      {subgroup ? (
        <>
          <ArrowRight className="h-3.5 w-3.5" />
          <span>{subgroup.replace(/-/g, " ")}</span>
        </>
      ) : null}
      <ArrowRight className="h-3.5 w-3.5" />
      <span className="text-slate-900">{item.label}</span>
    </div>
  );
}
