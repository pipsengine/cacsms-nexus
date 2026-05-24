import type { ReactNode } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";

export function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
