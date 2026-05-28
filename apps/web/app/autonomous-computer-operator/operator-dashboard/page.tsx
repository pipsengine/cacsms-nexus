import { Suspense } from "react";
import { OperatorDashboard } from "@/modules/autonomous-computer-operator/operator-dashboard/components/operator-dashboard";

export default function OperatorDashboardPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[1900px] px-4 py-6 text-sm text-slate-600">Loading operator command center...</div>}>
      <OperatorDashboard />
    </Suspense>
  );
}
