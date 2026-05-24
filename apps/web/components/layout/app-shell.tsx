import { ReactNode } from "react";

import { TopNavigation } from "@/components/navigation/top-navigation";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <TopNavigation />
      {children}
    </div>
  );
}
