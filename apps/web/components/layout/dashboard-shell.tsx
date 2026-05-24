import type { ReactNode } from "react";

import { SidebarPlaceholder } from "@/components/navigation/sidebar-placeholder";
import { Topbar } from "@/components/navigation/topbar";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <Topbar />
      <div className="flex bg-white">
        <SidebarPlaceholder />
        <main className="min-w-0 flex-1 bg-white">{children}</main>
      </div>
    </div>
  );
}
