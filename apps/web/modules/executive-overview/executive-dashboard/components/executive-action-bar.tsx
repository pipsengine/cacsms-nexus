"use client";

import { FileText, PauseCircle, PlayCircle, RefreshCw, Route, ShieldAlert, Workflow } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { mockAuditLog } from "../services/executive-dashboard-service";

function ActionButton({
  label,
  description,
  variant,
  icon: Icon,
  onClick
}: {
  label: string;
  description: string;
  variant: "default" | "outline" | "secondary" | "destructive";
  icon: typeof RefreshCw;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant={variant} onClick={onClick} className="gap-2">
          <Icon className="h-4 w-4" />
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent className="border-slate-200 bg-white text-slate-900">{description}</TooltipContent>
    </Tooltip>
  );
}

export function ExecutiveActionBar({
  onRefresh,
  onOpenWorkflow,
  onOpenRiskCenter,
  onEmergencyStop
}: {
  onRefresh: () => void;
  onOpenWorkflow: () => void;
  onOpenRiskCenter: () => void;
  onEmergencyStop: () => void;
}) {
  function log(action: string) {
    mockAuditLog({ action, at: new Date().toISOString(), actor: "operator@local", context: { page: "executive-dashboard" } });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <TooltipProvider delayDuration={120}>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            label="Refresh Dashboard"
            description="Fetch latest executive snapshot (mock-ready, realtime-ready)."
            variant="outline"
            icon={RefreshCw}
            onClick={() => {
              log("refresh-dashboard");
              onRefresh();
            }}
          />
          <ActionButton
            label="Pause Autonomous Engine"
            description="Placeholder only. Will require permissions + confirmation modal."
            variant="secondary"
            icon={PauseCircle}
            onClick={() => log("pause-autonomous-engine")}
          />
          <ActionButton
            label="Resume Engine"
            description="Placeholder only. Resumes autonomous loop in future phase."
            variant="secondary"
            icon={PlayCircle}
            onClick={() => log("resume-autonomous-engine")}
          />
          <ActionButton
            label="Emergency Stop"
            description="Placeholder only. Permission-protected and requires confirmation."
            variant="destructive"
            icon={ShieldAlert}
            onClick={() => {
              log("emergency-stop");
              onEmergencyStop();
            }}
          />
          <ActionButton
            label="View Audit Logs"
            description="Placeholder navigation for governance and audit."
            variant="outline"
            icon={FileText}
            onClick={() => log("open-audit-logs")}
          />
          <ActionButton
            label="Open Workflow Pipeline"
            description="Jump to the workflow pipeline module."
            variant="outline"
            icon={Workflow}
            onClick={() => {
              log("open-workflow-pipeline");
              onOpenWorkflow();
            }}
          />
          <ActionButton
            label="Open Risk Center"
            description="Jump to risk governance module."
            variant="outline"
            icon={Route}
            onClick={() => {
              log("open-risk-center");
              onOpenRiskCenter();
            }}
          />
        </div>
      </TooltipProvider>
    </section>
  );
}
