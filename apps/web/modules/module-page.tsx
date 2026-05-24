import type { NavigationLeaf } from "@/lib/navigation";
import { Activity, ArrowRight, CircleDot, Clock3, Database, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const moduleMetrics = [
  { label: "Operational state", value: "Foundation", icon: CircleDot, variant: "success" as const },
  { label: "Data readiness", value: "Mock feed", icon: Database, variant: "default" as const },
  { label: "Governance", value: "Protected", icon: ShieldCheck, variant: "purple" as const },
  { label: "Refresh window", value: "30 sec", icon: Clock3, variant: "secondary" as const }
];

export function ModulePage({ module }: { module: NavigationLeaf }) {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-slate-500">
              <span>Cacsms Nexus</span>
              <ArrowRight className="h-3.5 w-3.5" />
              <span>{module.sectionTitle}</span>
              {module.groupTitle ? (
                <>
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span>{module.groupTitle}</span>
                </>
              ) : null}
            </div>
            <h1 className="text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">{module.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
              Institutional control workspace for {module.title.toLowerCase()} within the {module.sectionTitle.toLowerCase()} domain.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="success">
              <Activity className="mr-1.5 h-3 w-3" />
              Operational
            </Badge>
            <Badge variant="secondary">Development</Badge>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {moduleMetrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-slate-500">{metric.label}</p>
                <metric.icon className="h-4 w-4 text-blue-600" />
              </div>
              <p className="mt-3 text-2xl font-semibold text-slate-950">{metric.value}</p>
              <Badge variant={metric.variant} className="mt-3">
                Ready
              </Badge>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-blue-600">Operational canvas</p>
              <CardTitle className="mt-1 text-xl">{module.title} Control Surface</CardTitle>
            </div>
            <Badge variant="default">Preview</Badge>
          </CardHeader>
          <Separator />
          <CardContent className="p-5">
            <div className="grid gap-3 md:grid-cols-3">
              {["Input Channel", "Decision Boundary", "Audit Output"].map((title, index) => (
                <div key={title} className="min-h-36 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Layer {String(index + 1).padStart(2, "0")}</p>
                  <h2 className="mt-3 text-sm font-semibold text-slate-950">{title}</h2>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    Configured workspace boundary with controlled placeholder state.
                  </p>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full w-2/3 rounded-full bg-blue-600" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-xs font-semibold uppercase text-slate-500">Activity stream</p>
            <CardTitle className="mt-1 text-xl">Recent Events</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-4 p-5">
            {[
              { time: "09:41:12", label: "Configuration boundary verified", tone: "bg-green-600" },
              { time: "09:39:46", label: "Mock telemetry synchronized", tone: "bg-blue-600" },
              { time: "09:38:02", label: "Governance checks retained", tone: "bg-purple-600" },
              { time: "09:35:18", label: "Live execution remains disabled", tone: "bg-orange-600" }
            ].map((event) => (
              <div key={event.time} className="flex gap-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${event.tone}`} />
                <div>
                  <p className="text-sm font-medium text-slate-800">{event.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{event.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
