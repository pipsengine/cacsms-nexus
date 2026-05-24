"use client";

import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { navigationSections, type NavigationSection } from "@/lib/navigation";

type SidebarProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const activeSection = navigationSections.find((section) =>
    [...section.items, ...(section.groups?.flatMap((group) => group.items) ?? [])].some((item) => item.href === pathname)
  );
  const [query, setQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    [activeSection?.slug ?? navigationSections[0].slug]: true
  });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const sections = useMemo(() => filterSections(navigationSections, query), [query]);
  const searching = query.trim().length > 0;

  function toggleSection(slug: string) {
    setExpandedSections((current) => ({ ...current, [slug]: !current[slug] }));
  }

  function toggleGroup(slug: string) {
    setExpandedGroups((current) => ({ ...current, [slug]: !current[slug] }));
  }

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-slate-950/20 xl:hidden"
          onClick={onMobileClose}
        />
      ) : null}
      <aside
        className={cn(
          "fixed bottom-0 left-0 top-0 z-50 flex w-[min(90vw,22rem)] flex-col border-r border-slate-200 bg-white transition-transform xl:sticky xl:top-16 xl:z-20 xl:h-[calc(100vh-4rem)] xl:w-80 xl:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"
        )}
      >
        <div className="border-b border-slate-200 p-4 xl:hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">Cacsms Nexus</p>
              <p className="text-xs text-slate-500">Enterprise Navigation</p>
            </div>
            <button
              type="button"
              onClick={onMobileClose}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="border-b border-slate-200 p-4">
          <p className="hidden text-xs font-semibold uppercase text-slate-500 xl:block">Navigation</p>
          <label className="mt-0 flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 xl:mt-3">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search modules"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </label>
          <p className="mt-3 text-xs font-medium text-slate-500">{sections.length} domains available</p>
        </div>

        <ScrollArea className="flex-1">
          <nav className="space-y-2 p-3" aria-label="Primary navigation">
            {sections.map((section) => {
              const isOpen = searching || expandedSections[section.slug] || section.slug === activeSection?.slug;
              return (
                <div key={section.slug} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.slug)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    aria-expanded={isOpen}
                  >
                    <span className="min-w-0 truncate">{section.title}</span>
                    {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  </button>
                  {isOpen ? (
                    <div className="border-t border-slate-100 px-2 py-2">
                      {section.items.map((item) => (
                        <SidebarLink key={item.href} item={item} active={item.href === pathname} close={onMobileClose} />
                      ))}
                      {section.groups?.map((group) => {
                        const groupOpen =
                          searching || expandedGroups[group.slug] || group.items.some((item) => item.href === pathname);
                        return (
                          <div key={group.slug} className="mb-1">
                            <button
                              type="button"
                              onClick={() => toggleGroup(group.slug)}
                              className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs font-semibold uppercase text-slate-500 hover:bg-slate-50"
                              aria-expanded={groupOpen}
                            >
                              <span>{group.title}</span>
                              {groupOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                            {groupOpen
                              ? group.items.map((item) => (
                                  <SidebarLink key={item.href} item={item} active={item.href === pathname} close={onMobileClose} />
                                ))
                              : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </ScrollArea>
      </aside>
    </>
  );
}

function SidebarLink({
  item,
  active,
  close
}: {
  item: { title: string; href: string };
  active: boolean;
  close?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={close}
      className={cn(
        "mb-1 block rounded-md px-3 py-2 text-sm transition-colors",
        active ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
      )}
    >
      {item.title}
    </Link>
  );
}

function filterSections(sections: NavigationSection[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return sections;
  }

  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => item.title.toLowerCase().includes(normalized) || section.title.toLowerCase().includes(normalized)
      ),
      groups: section.groups
        ?.map((group) => ({
          ...group,
          items: group.items.filter(
            (item) =>
              item.title.toLowerCase().includes(normalized) ||
              group.title.toLowerCase().includes(normalized) ||
              section.title.toLowerCase().includes(normalized)
          )
        }))
        .filter((group) => group.items.length > 0)
    }))
    .filter((section) => section.items.length > 0 || (section.groups?.length ?? 0) > 0);
}

