"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { Sidebar } from "@/components/navigation/sidebar";
import { Topbar } from "@/components/navigation/topbar";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <Topbar onOpenNavigation={() => setMobileNavigationOpen(true)} />
      <div className="flex bg-white">
        <Sidebar mobileOpen={mobileNavigationOpen} onMobileClose={() => setMobileNavigationOpen(false)} />
        <main className="min-w-0 flex-1 bg-white">{children}</main>
      </div>
    </div>
  );
}
