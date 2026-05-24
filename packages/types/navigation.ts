export type NavigationStatus = "Operational" | "Foundation" | "Reserved" | "Planned" | "Disabled";

export type NavigationModuleKey =
  | "executive-overview"
  | "administration-and-governance"
  | "accounts-and-portfolio"
  | "autonomous-computer-operator"
  | "mt5-infrastructure-and-broker-connectivity"
  | "market-intelligence"
  | "economic-news-and-sentiment-intelligence"
  | "data-engineering-and-intelligence"
  | "multi-timeframe-market-analysis"
  | "cacsms-vision"
  | "institutional-intelligence"
  | "strategy-intelligence"
  | "ai-and-autonomous-intelligence-core"
  | "quantitative-intelligence"
  | "risk-governance-and-prop-firm-compliance"
  | "execution-center"
  | "trade-management"
  | "portfolio-reporting-and-behavioral-intelligence"
  | "monitoring-recovery-and-self-healing"
  | "learning-and-optimization"
  | "reports-and-analytics"
  | "settings-and-personalization";

export type NavigationColor = {
  accent: string;
  accentBg: string;
  accentBorder: string;
  accentText: string;
};

export type NavigationItem<Icon = unknown> = {
  moduleKey: NavigationModuleKey;
  label: string;
  description: string;
  path: string;
  icon?: Icon;
  color: NavigationColor;
  badge?: string | null;
  status: NavigationStatus;
  plannedFeatures?: string[];
};

export type NavigationSubgroup<Icon = unknown> = {
  label: string;
  description: string;
  items: NavigationItem<Icon>[];
};

export type NavigationGroup<Icon = unknown> = {
  moduleKey: NavigationModuleKey;
  label: string;
  description: string;
  path: string;
  icon?: Icon;
  color: NavigationColor;
  badge?: string | null;
  status: NavigationStatus;
  items: NavigationItem<Icon>[];
  groups?: NavigationSubgroup<Icon>[];
};
