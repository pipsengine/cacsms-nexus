import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { findNavigationLeaf, navigationLeaves } from "@/lib/navigation";
import { ModulePage } from "@/modules/module-page";

export function generateStaticParams() {
  return navigationLeaves.map((item) => ({
    segments: item.href.replace("/modules/", "").split("/")
  }));
}

export default async function ModuleRoute({
  params
}: {
  params: Promise<{ segments: string[] }>;
}) {
  const { segments } = await params;
  const selectedModule = findNavigationLeaf(segments);

  if (!selectedModule) {
    notFound();
  }

  return (
    <DashboardShell>
      <ModulePage module={selectedModule} />
    </DashboardShell>
  );
}
