import { Boxes, CircleDot } from "lucide-react";

export function TopNavigation() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-600 text-white">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">Cacsms Nexus</p>
            <p className="text-xs font-medium text-slate-500">Institutional trading ecosystem</p>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 sm:flex">
          <CircleDot className="h-4 w-4" />
          Foundation Mode
        </div>
      </div>
    </header>
  );
}
