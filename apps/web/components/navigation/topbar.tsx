import { Bell, Menu, OctagonAlert, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export function Topbar({ onOpenNavigation }: { onOpenNavigation?: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Open navigation"
              onClick={onOpenNavigation}
              className="xl:hidden"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">Cacsms Nexus</p>
              <p className="hidden truncate text-xs font-medium text-slate-500 sm:block">
                AI-Driven Autonomous Institutional Trading Ecosystem
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold uppercase text-green-700 md:flex">
            <ShieldCheck className="h-3.5 w-3.5" />
            System Stable
          </div>
          <div className="hidden rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase text-blue-700 sm:block">
            Development
          </div>
          <Button variant="destructive" size="sm" className="hidden sm:inline-flex">
            <OctagonAlert className="h-4 w-4" />
            Emergency Stop
          </Button>
          <Button variant="outline" size="icon" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
