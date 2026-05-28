import { Suspense } from "react";
import { RiskAndExposureDashboard } from "@/modules/accounts-and-portfolio/risk-and-exposure/components/risk-and-exposure-dashboard";

export default function RiskAndExposurePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[1900px] px-4 py-6 text-sm text-slate-600">Loading risk and exposure monitor...</div>}>
      <RiskAndExposureDashboard />
    </Suspense>
  );
}
