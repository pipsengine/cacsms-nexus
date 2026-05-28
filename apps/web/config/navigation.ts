import type { NavigationColor, NavigationGroup, NavigationItem, NavigationModuleKey, NavigationStatus } from "@cacsms-nexus/types";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  BrainCircuit,
  Briefcase,
  Building2,
  CandlestickChart,
  Cog,
  Database,
  Gavel,
  Globe,
  GraduationCap,
  Landmark,
  LineChart,
  MonitorCheck,
  Shield,
  Target,
  TrendingUp,
  Wallet,
  Workflow
} from "lucide-react";

import { createNavigationSectionDefinitions, type NavigationSectionDefinition } from "./navigation-sections";

type SectionDefinition = NavigationSectionDefinition;

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\//g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const colors: Record<
  NavigationModuleKey,
  {
    color: NavigationColor;
    icon: LucideIcon;
  }
> = {
  "executive-overview": {
    icon: BarChart3,
    color: { accent: "blue", accentBg: "bg-blue-50", accentBorder: "border-blue-200", accentText: "text-blue-700" }
  },
  "administration-and-governance": {
    icon: Shield,
    color: { accent: "indigo", accentBg: "bg-indigo-50", accentBorder: "border-indigo-200", accentText: "text-indigo-700" }
  },
  "accounts-and-portfolio": {
    icon: Wallet,
    color: { accent: "green", accentBg: "bg-green-50", accentBorder: "border-green-200", accentText: "text-green-700" }
  },
  "autonomous-computer-operator": {
    icon: Workflow,
    color: { accent: "purple", accentBg: "bg-purple-50", accentBorder: "border-purple-200", accentText: "text-purple-700" }
  },
  "mt5-infrastructure-and-broker-connectivity": {
    icon: Landmark,
    color: { accent: "teal", accentBg: "bg-teal-50", accentBorder: "border-teal-200", accentText: "text-teal-700" }
  },
  "market-intelligence": {
    icon: TrendingUp,
    color: { accent: "blue", accentBg: "bg-blue-50", accentBorder: "border-blue-200", accentText: "text-blue-700" }
  },
  "economic-news-and-sentiment-intelligence": {
    icon: Globe,
    color: { accent: "orange", accentBg: "bg-orange-50", accentBorder: "border-orange-200", accentText: "text-orange-700" }
  },
  "data-engineering-and-intelligence": {
    icon: Database,
    color: { accent: "indigo", accentBg: "bg-indigo-50", accentBorder: "border-indigo-200", accentText: "text-indigo-700" }
  },
  "multi-timeframe-market-analysis": {
    icon: LineChart,
    color: { accent: "cyan", accentBg: "bg-cyan-50", accentBorder: "border-cyan-200", accentText: "text-cyan-700" }
  },
  "cacsms-vision": {
    icon: CandlestickChart,
    color: { accent: "purple", accentBg: "bg-purple-50", accentBorder: "border-purple-200", accentText: "text-purple-700" }
  },
  "institutional-intelligence": {
    icon: Building2,
    color: { accent: "teal", accentBg: "bg-teal-50", accentBorder: "border-teal-200", accentText: "text-teal-700" }
  },
  "strategy-intelligence": {
    icon: Target,
    color: { accent: "pink", accentBg: "bg-pink-50", accentBorder: "border-pink-200", accentText: "text-pink-700" }
  },
  "ai-and-autonomous-intelligence-core": {
    icon: BrainCircuit,
    color: { accent: "violet", accentBg: "bg-violet-50", accentBorder: "border-violet-200", accentText: "text-violet-700" }
  },
  "quantitative-intelligence": {
    icon: Activity,
    color: { accent: "indigo", accentBg: "bg-indigo-50", accentBorder: "border-indigo-200", accentText: "text-indigo-700" }
  },
  "risk-governance-and-prop-firm-compliance": {
    icon: Gavel,
    color: { accent: "red", accentBg: "bg-red-50", accentBorder: "border-red-200", accentText: "text-red-700" }
  },
  "execution-center": {
    icon: Briefcase,
    color: { accent: "emerald", accentBg: "bg-emerald-50", accentBorder: "border-emerald-200", accentText: "text-emerald-700" }
  },
  "trade-management": {
    icon: TrendingUp,
    color: { accent: "emerald", accentBg: "bg-emerald-50", accentBorder: "border-emerald-200", accentText: "text-emerald-700" }
  },
  "portfolio-reporting-and-behavioral-intelligence": {
    icon: BarChart3,
    color: { accent: "slate", accentBg: "bg-slate-50", accentBorder: "border-slate-200", accentText: "text-slate-700" }
  },
  "monitoring-recovery-and-self-healing": {
    icon: MonitorCheck,
    color: { accent: "amber", accentBg: "bg-amber-50", accentBorder: "border-amber-200", accentText: "text-amber-700" }
  },
  "learning-and-optimization": {
    icon: GraduationCap,
    color: { accent: "indigo", accentBg: "bg-indigo-50", accentBorder: "border-indigo-200", accentText: "text-indigo-700" }
  },
  "reports-and-analytics": {
    icon: BarChart3,
    color: { accent: "slate", accentBg: "bg-slate-50", accentBorder: "border-slate-200", accentText: "text-slate-700" }
  },
  "settings-and-personalization": {
    icon: Cog,
    color: { accent: "gray", accentBg: "bg-slate-50", accentBorder: "border-slate-200", accentText: "text-slate-700" }
  }
};

const defaultPlannedFeatures = [
  "Role-scoped controls and auditing",
  "Real-time telemetry placeholders",
  "DB-backed synchronization phase",
  "Operator approval boundaries"
];

const definitions: SectionDefinition[] = createNavigationSectionDefinitions(defaultPlannedFeatures);

function buildItem(
  moduleKey: NavigationModuleKey,
  label: string,
  description: string,
  status: NavigationStatus,
  plannedFeatures?: string[],
  slug?: string,
  pathOverride?: string
): NavigationItem<LucideIcon> {
  const itemSlug = slug ?? toSlug(label);
  const { color } = colors[moduleKey];
  return {
    moduleKey,
    label,
    description,
    status,
    badge: null,
    color,
    icon: Activity,
    plannedFeatures,
    path: pathOverride ?? `/${moduleKey}/${itemSlug}`
  };
}

export const navigationGroups: NavigationGroup<LucideIcon>[] = definitions.map((definition) => {
  const moduleKey = toSlug(definition.title) as NavigationModuleKey;
  const theme = colors[moduleKey];
  const items =
    definition.items?.map((item) =>
      buildItem(
        moduleKey,
        item.label,
        item.description,
        item.status ?? "Foundation",
        item.plannedFeatures ?? defaultPlannedFeatures,
        item.slug,
        item.path
      )
    ) ?? [];

  const groups =
    definition.groups?.map((group) => {
      const groupSlug = toSlug(group.title);
      return {
        label: group.title,
        description: group.description,
        items: group.items.map((item) => ({
          ...buildItem(
            moduleKey,
            item.label,
            item.description,
            item.status ?? "Foundation",
            item.plannedFeatures ?? defaultPlannedFeatures,
            item.slug,
            item.path ?? `/${moduleKey}/${groupSlug}/${item.slug ?? toSlug(item.label)}`
          )
        }))
      };
    }) ?? [];

  return {
    moduleKey,
    label: definition.title,
    description: definition.description,
    path: `/${moduleKey}`,
    status: definition.status,
    badge: null,
    icon: theme.icon,
    color: theme.color,
    items,
    groups: groups.length ? groups : undefined
  };
});

export const navigationItems: NavigationItem<LucideIcon>[] = navigationGroups.flatMap((group) => [
  ...group.items,
  ...(group.groups?.flatMap((subgroup) => subgroup.items) ?? [])
]);

export function findNavigationItemByPath(pathname: string) {
  const normalized = pathname.split("?")[0].split("#")[0];
  return navigationItems.find((item) => item.path === normalized) ?? null;
}

export function findNavigationGroupByPath(pathname: string) {
  const normalized = pathname.split("?")[0].split("#")[0];
  const segments = normalized.split("/").filter(Boolean);
  const moduleKey = segments[0] as NavigationModuleKey | undefined;
  if (!moduleKey) {
    return null;
  }
  return navigationGroups.find((group) => group.moduleKey === moduleKey) ?? null;
}
