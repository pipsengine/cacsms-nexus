import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const toneClasses = {
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700"
};

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  tone: keyof typeof toneClasses;
  icon: LucideIcon;
};

export function MetricCard({ label, value, detail, tone, icon: Icon }: MetricCardProps) {
  return (
    <article className={cn("rounded-lg border p-4 shadow-sm", toneClasses[tone])}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium opacity-80">{label}</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">{value}</h2>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/80">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-700">{detail}</p>
    </article>
  );
}
