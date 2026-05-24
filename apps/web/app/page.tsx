import { DashboardShell } from "@/components/layout/dashboard-shell";
import { WorkflowDashboard } from "@/components/workflow/workflow-dashboard";

export default function Home() {
  return (
    <DashboardShell>
      <WorkflowDashboard />
    </DashboardShell>
  );
}
