import { Suspense } from "react";
import { AccountCenterDashboard } from "@/modules/accounts-and-portfolio/account-center/components/account-center-dashboard";

export default function AccountCenterPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[1900px] px-4 py-6 text-sm text-slate-600">Loading account center inventory...</div>}>
      <AccountCenterDashboard />
    </Suspense>
  );
}
