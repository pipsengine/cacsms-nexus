"use client";

import { Camera, Eye, ScanText, Sparkles } from "lucide-react";

import type { ExecutiveDashboardResponse } from "../types/executive-dashboard.types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function tone(status: ExecutiveDashboardResponse["visionSummary"]["visionEngineStatus"]) {
  if (status === "Operational") return "success" as const;
  if (status === "Warning") return "warning" as const;
  if (status === "Degraded") return "warning" as const;
  return "destructive" as const;
}

export function CacsmsVisionSummary({ data }: { data: ExecutiveDashboardResponse }) {
  const v = data.visionSummary;
  const confidence = v.visionConfidence;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-purple-600">Cacsms Vision</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-950">Vision engine status</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Chart capture, OCR posture, pattern detection counts, and vision confidence surface.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={tone(v.visionEngineStatus)}>{v.visionEngineStatus}</Badge>
          <Badge variant={confidence >= 75 ? "purple" : confidence >= 60 ? "default" : "warning"}>Confidence {confidence}%</Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { title: "Latest capture", value: new Date(v.latestChartCaptureTime).toLocaleTimeString(), icon: Camera, tone: "text-purple-600" },
          { title: "Analyzed charts", value: String(v.analyzedChartsCount), icon: Eye, tone: "text-purple-600" },
          { title: "Order blocks", value: String(v.detectedOrderBlocks), icon: Sparkles, tone: "text-purple-600" },
          { title: "FVGs", value: String(v.detectedFVGs), icon: Sparkles, tone: "text-purple-600" },
          { title: "Liquidity sweeps", value: String(v.detectedLiquiditySweeps), icon: Sparkles, tone: "text-purple-600" },
          { title: "OCR status", value: v.ocrStatus, icon: ScanText, tone: "text-purple-600" },
          { title: "Annotations", value: v.annotationStatus, icon: Sparkles, tone: "text-purple-600" },
          { title: "Vision confidence", value: `${confidence}%`, icon: Eye, tone: "text-purple-600" }
        ].map((card) => (
          <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase text-slate-500">{card.title}</p>
              <card.icon className={cn("h-4 w-4", card.tone)} />
            </div>
            <p className="mt-2 text-lg font-semibold text-slate-950">{card.value}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Structured snapshot surface for future vision pipeline integration.</p>
          </div>
        ))}
      </div>
    </section>
  );
}

