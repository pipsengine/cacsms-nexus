"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { MobileSidebar } from "@/components/navigation/mobile-sidebar";
import { NavigationBreadcrumb } from "@/components/navigation/navigation-breadcrumb";
import { Sidebar } from "@/components/navigation/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <Topbar onOpenNavigation={() => setMobileNavigationOpen(true)} />
      <MobileSidebar open={mobileNavigationOpen} onClose={() => setMobileNavigationOpen(false)} />
      <div className="flex bg-white">
        <Sidebar />
        <main className="min-w-0 flex-1 bg-white">
          <div className="px-4 pt-4 sm:px-6 lg:px-8">
            <NavigationBreadcrumb />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
