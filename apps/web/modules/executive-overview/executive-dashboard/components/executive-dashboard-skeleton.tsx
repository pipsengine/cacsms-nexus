"use client";

import { cn } from "@/lib/utils";

function Block({ className }: { className: string }) {
  return <div className={cn("animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm", className)} />;
}

export function ExecutiveDashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <Block className="h-[220px]" />
      <Block className="h-[72px]" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Block key={i} className="h-[140px]" />
        ))}
      </div>
      <Block className="h-[360px]" />
      <Block className="h-[420px]" />
      <Block className="h-[420px]" />
      <Block className="h-[420px]" />
      <Block className="h-[420px]" />
      <Block className="h-[420px]" />
    </div>
  );
}

