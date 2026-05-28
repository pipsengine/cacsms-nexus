import { Suspense } from "react";
import { PortfolioDashboard } from "@/modules/accounts-and-portfolio/portfolio-dashboard/components/portfolio-dashboard";

export default function PortfolioDashboardPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[1900px] px-4 py-6 text-sm text-slate-600">Loading portfolio dashboard...</div>}>
      <PortfolioDashboard />
    </Suspense>
  );
}
