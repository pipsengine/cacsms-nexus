import { Suspense } from "react";
import { DesktopAutomationHubDashboard } from "@/modules/autonomous-computer-operator/desktop-automation-hub/components/desktop-automation-hub-dashboard";

export default function DesktopAutomationHubPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[1900px] px-4 py-6 text-sm text-slate-600">Loading desktop automation hub...</div>}>
      <DesktopAutomationHubDashboard />
    </Suspense>
  );
}
