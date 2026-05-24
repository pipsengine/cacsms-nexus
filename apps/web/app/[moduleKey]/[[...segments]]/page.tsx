import { notFound, redirect } from "next/navigation";

import { ModulePlaceholderPage } from "@/components/pages/module-placeholder-page";
import { WorkflowDashboard } from "@/components/workflow/workflow-dashboard";
import { navigationGroups, navigationItems } from "@/config/navigation";

export function generateStaticParams() {
  return navigationItems.map((item) => {
    const parts = item.path.split("/").filter(Boolean);
    return { moduleKey: parts[0], segments: parts.slice(1) };
  });
}

export default async function ModulePage({
  params
}: {
  params: Promise<{ moduleKey: string; segments?: string[] }>;
}) {
  const { moduleKey, segments } = await params;
  const group = navigationGroups.find((g) => g.moduleKey === moduleKey);

  if (!group) {
    notFound();
  }

  if (!segments?.length) {
    const defaultPath = group.items[0]?.path ?? group.groups?.[0]?.items[0]?.path;
    if (!defaultPath) {
      notFound();
    }
    redirect(defaultPath);
  }

  const path = `/${[moduleKey, ...(segments ?? [])].join("/")}`;
  const item = navigationItems.find((i) => i.path === path);

  if (!item) {
    notFound();
  }

  if (item.path === "/executive-overview/autonomous-workflow") {
    return <WorkflowDashboard />;
  }

  return (
    <ModulePlaceholderPage
      title={item.label}
      module={group.label}
      description={item.description}
      color={item.color}
      status={item.status}
      plannedFeatures={item.plannedFeatures ?? []}
    />
  );
}
