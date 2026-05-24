"use client";

import type { NavigationColor, NavigationStatus } from "@cacsms-nexus/types";
import { Activity, LayoutGrid, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const statusVariant: Record<NavigationStatus, "default" | "secondary" | "success" | "warning" | "destructive" | "purple"> = {
  Operational: "success",
  Foundation: "default",
  Reserved: "secondary",
  Planned: "warning",
  Disabled: "destructive"
};

export function ModulePlaceholderPage({
  title,
  module,
  description,
  color,
  status,
  plannedFeatures
}: {
  title: string;
  module: string;
  description: string;
  color: NavigationColor;
  status: NavigationStatus;
  plannedFeatures: string[];
}) {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className={cn("rounded-2xl border bg-white p-5 shadow-card sm:p-7", color.accentBorder)}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-slate-500">{module}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">{description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant[status]}>{status}</Badge>
            <div className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase", color.accentBorder, color.accentBg, color.accentText)}>
              {color.accent.toUpperCase()}
            </div>
            <Badge variant="secondary">Coming implementation phase</Badge>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Operational state", value: status, icon: ShieldCheck },
          { label: "Data readiness", value: "Mock feed", icon: Activity },
          { label: "Governance", value: "Protected", icon: ShieldCheck },
          { label: "Surface", value: "Placeholder", icon: LayoutGrid }
        ].map((metric) => (
          <Card key={metric.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-slate-500">{metric.label}</p>
                <metric.icon className={cn("h-4 w-4", color.accentText)} />
              </div>
              <p className="mt-3 text-2xl font-semibold text-slate-950">{metric.value}</p>
              <div className={cn("mt-3 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase", color.accentBorder, color.accentBg, color.accentText)}>
                Ready
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <p className={cn("text-xs font-semibold uppercase", color.accentText)}>Planned scope</p>
              <CardTitle className="mt-1 text-xl">Implementation checklist</CardTitle>
            </div>
            <Badge variant="secondary">Preview</Badge>
          </CardHeader>
          <Separator />
          <CardContent className="p-5">
            <div className="grid gap-3 md:grid-cols-2">
              {plannedFeatures.slice(0, 6).map((feature) => (
                <div key={feature} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">{feature}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">Reserved for the next implementation phase.</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-xs font-semibold uppercase text-slate-500">Status</p>
            <CardTitle className="mt-1 text-xl">Operational notes</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-4 p-5">
            {[
              { label: "No live execution enabled", tone: "bg-orange-600" },
              { label: "Mock data surfaces only", tone: "bg-blue-600" },
              { label: "Governance boundaries enforced", tone: "bg-purple-600" },
              { label: "UI-only placeholder phase", tone: "bg-slate-600" }
            ].map((event) => (
              <div key={event.label} className="flex gap-3">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", event.tone)} />
                <p className="text-sm font-medium text-slate-800">{event.label}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
