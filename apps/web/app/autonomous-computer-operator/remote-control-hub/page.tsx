import { Suspense } from "react";
import { RemoteControlHubDashboard } from "@/modules/autonomous-computer-operator/remote-control-hub/components/remote-control-hub-dashboard";

export default function RemoteControlHubPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[1900px] px-4 py-6 text-sm text-slate-600">Loading remote control hub...</div>}>
      <RemoteControlHubDashboard />
    </Suspense>
  );
}
