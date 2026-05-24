"use client";

import { AlertTriangle, CheckCircle2, Info, Siren } from "lucide-react";

import type { AlertIncident, ExecutiveDashboardResponse } from "../types/executive-dashboard.types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useExecutiveDashboardStore } from "../stores/executive-dashboard-store";

function severityIcon(severity: AlertIncident["severity"]) {
  if (severity === "Critical") return Siren;
  if (severity === "Warning") return AlertTriangle;
  if (severity === "Resolved") return CheckCircle2;
  return Info;
}

function severityTone(severity: AlertIncident["severity"]) {
  if (severity === "Critical") return "border-red-200 bg-red-50 text-red-700";
  if (severity === "Warning") return "border-orange-200 bg-orange-50 text-orange-700";
  if (severity === "Resolved") return "border-green-200 bg-green-50 text-green-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export function AlertsAndIncidents({ data }: { data: ExecutiveDashboardResponse }) {
  const showOnlyOpen = useExecutiveDashboardStore((state) => state.showOnlyAlertsOpen);
  const toggle = useExecutiveDashboardStore((state) => state.toggleAlertsFilter);

  const alerts = showOnlyOpen ? data.alerts.filter((a) => a.status !== "Resolved") : data.alerts;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-red-600">Alerts & Incidents</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Operational alerts stream</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Severity, source, timestamp, and suggested actions. Designed to be driven by future realtime event channels.
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase text-slate-700 hover:bg-white"
        >
          {showOnlyOpen ? "Showing: Open" : "Showing: All"}
        </button>
      </div>

      {alerts.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          No alerts to display. The system is operating within the current snapshot constraints.
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {alerts.map((alert) => {
            const Icon = severityIcon(alert.severity);
            return (
              <div key={alert.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", severityTone(alert.severity))}>
                        <Icon className="h-3.5 w-3.5" />
                        {alert.severity}
                      </span>
                      <Badge variant="secondary">{alert.source}</Badge>
                      <Badge variant={alert.status === "Resolved" ? "success" : alert.status === "Acknowledged" ? "warning" : "default"}>
                        {alert.status}
                      </Badge>
                      <span className="text-xs font-semibold text-slate-500">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{alert.message}</p>
                    <p className="mt-2 text-xs leading-6 text-slate-600">
                      Suggested action: <span className="font-semibold text-slate-800">{alert.suggestedAction}</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

