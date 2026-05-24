import { ChevronRight, LayoutDashboard, Settings, Workflow } from "lucide-react";

const navItems = [
  { label: "Executive Overview", icon: LayoutDashboard },
  { label: "Workflow Dashboard", icon: Workflow, active: true },
  { label: "System Setup", icon: Settings },
  { label: "Coming Soon modules", icon: ChevronRight }
];

export function SidebarPlaceholder() {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white xl:block">
      <div className="sticky top-16 p-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">Navigation placeholder</p>
          <p className="mt-1 text-sm text-slate-600">Full enterprise sidebar will be added later.</p>
        </div>
        <nav className="mt-5 space-y-2">
          {navItems.map((item) => (
            <div
              key={item.label}
              className={cnNav(
                "flex items-center gap-3 rounded-xl border px-3 py-3 text-sm font-semibold",
                item.active
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-transparent bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}

function cnNav(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}
