"use client";

import { useRouter } from "next/navigation";

import { ExecutiveActionBar } from "@/modules/executive-overview/executive-dashboard/components/executive-action-bar";
import { AccountComplianceOverview } from "@/modules/executive-overview/executive-dashboard/components/account-compliance-overview";
import { AiIntelligenceOverview } from "@/modules/executive-overview/executive-dashboard/components/ai-intelligence-overview";
import { AlertsAndIncidents } from "@/modules/executive-overview/executive-dashboard/components/alerts-and-incidents";
import { AutonomousWorkflowSummary } from "@/modules/executive-overview/executive-dashboard/components/autonomous-workflow-summary";
import { CacsmsVisionSummary } from "@/modules/executive-overview/executive-dashboard/components/cacsms-vision-summary";
import { EcosystemHealthMap } from "@/modules/executive-overview/executive-dashboard/components/ecosystem-health-map";
import { ExecutiveDashboardHeader } from "@/modules/executive-overview/executive-dashboard/components/executive-dashboard-header";
import { ExecutiveDashboardSkeleton } from "@/modules/executive-overview/executive-dashboard/components/executive-dashboard-skeleton";
import { ExecutiveStatusGrid } from "@/modules/executive-overview/executive-dashboard/components/executive-status-grid";
import { ExecutionReadinessPanel } from "@/modules/executive-overview/executive-dashboard/components/execution-readiness-panel";
import { MarketConditionOverview } from "@/modules/executive-overview/executive-dashboard/components/market-condition-overview";
import { Mt5BrokerConnectivity } from "@/modules/executive-overview/executive-dashboard/components/mt5-broker-connectivity";
import { RecentAiDecisions } from "@/modules/executive-overview/executive-dashboard/components/recent-ai-decisions";
import { RiskCommandSummary } from "@/modules/executive-overview/executive-dashboard/components/risk-command-summary";
import { useExecutiveDashboard } from "@/modules/executive-overview/executive-dashboard/hooks/use-executive-dashboard";
import { mockAuditLog } from "@/modules/executive-overview/executive-dashboard/services/executive-dashboard-service";

export default function ExecutiveDashboardPage() {
  const router = useRouter();
  const query = useExecutiveDashboard();

  if (query.isLoading || !query.data) {
    return <ExecutiveDashboardSkeleton />;
  }

  if (query.isError) {
    return (
      <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-card">
          <h1 className="text-2xl font-semibold text-slate-950">Executive Dashboard</h1>
          <p className="mt-2 text-sm text-slate-700">Failed to load the executive snapshot. Retry to continue.</p>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white"
          >
            Retry
          </button>
        </section>
      </div>
    );
  }

  const data = query.data;

  function emergencyStop() {
    mockAuditLog({ action: "emergency-stop-placeholder", at: new Date().toISOString(), actor: "operator@local", context: { guarded: true } });
  }

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <ExecutiveDashboardHeader data={data} onRefresh={() => query.refetch()} onEmergencyStop={emergencyStop} />

      <ExecutiveActionBar
        onRefresh={() => query.refetch()}
        onEmergencyStop={emergencyStop}
        onOpenWorkflow={() => router.push("/executive-overview/workflow-pipeline")}
        onOpenRiskCenter={() => router.push("/risk-governance-and-prop-firm-compliance/risk-dashboard")}
      />

      <ExecutiveStatusGrid data={data} />

      <AutonomousWorkflowSummary data={data} />

      <EcosystemHealthMap data={data} />

      <AccountComplianceOverview data={data} />

      <AiIntelligenceOverview data={data} />

      <MarketConditionOverview data={data} />

      <RiskCommandSummary data={data} />

      <CacsmsVisionSummary data={data} />

      <Mt5BrokerConnectivity data={data} />

      <ExecutionReadinessPanel data={data} />

      <RecentAiDecisions data={data} />

      <AlertsAndIncidents data={data} />
    </div>
  );
}

