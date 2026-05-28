export type NavigationLeaf = {
  title: string;
  slug: string;
  href: string;
  sectionTitle: string;
  groupTitle?: string;
};

export type NavigationGroup = {
  title: string;
  slug: string;
  items: NavigationLeaf[];
};

export type NavigationSection = {
  title: string;
  slug: string;
  items: NavigationLeaf[];
  groups?: NavigationGroup[];
};

type SectionDefinition = {
  title: string;
  items?: string[];
  groups?: Array<{ title: string; items: string[] }>;
};

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\//g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const definitions: SectionDefinition[] = [
  {
    title: "Executive Overview",
    items: [
      "Executive Dashboard",
      "Autonomous Workflow",
      "System Architecture",
      "System Model",
      "AI Ecosystem Overview",
      "Workflow Pipeline",
      "Operational Timeline",
      "Global System Status",
      "Infrastructure Status",
      "Trading Overview",
      "Portfolio Overview",
      "Market Overview",
      "Performance Overview",
      "AI Confidence Overview",
      "Risk Exposure Overview",
      "Broker Connectivity Overview",
      "VPS Status Overview",
      "Workflow Heatmap",
      "System Health Matrix",
      "Alerts Overview",
      "Real-Time Activity Feed"
    ]
  },
  {
    title: "Administration & Governance",
    groups: [
      {
        title: "User Management",
        items: [
          "All Users",
          "Create User",
          "User Roles",
          "Permissions Matrix",
          "User Activity",
          "User Sessions",
          "Account Restrictions",
          "MFA Management"
        ]
      },
      {
        title: "Super Administration",
        items: [
          "Super Admin Console",
          "Root Permissions",
          "System Overrides",
          "Emergency Controls",
          "Master Configurations",
          "System Lockdown"
        ]
      },
      {
        title: "Broker Governance",
        items: [
          "Broker Registry",
          "Broker APIs",
          "Broker Health",
          "Broker Restrictions",
          "Broker Credentials",
          "Broker Failover"
        ]
      },
      {
        title: "Prop Firm Governance",
        items: [
          "Prop Firm Rules",
          "Drawdown Rules",
          "Profit Target Rules",
          "Consistency Rules",
          "Trading Day Rules",
          "News Restrictions",
          "Weekend Restrictions",
          "Max Lot Rules",
          "Compliance Engine",
          "Rule Violation Logs",
          "Challenge Monitoring"
        ]
      },
      {
        title: "Global Settings",
        items: [
          "System Settings",
          "Trading Settings",
          "AI Settings",
          "Vision Settings",
          "Risk Settings",
          "Notification Settings",
          "Security Settings",
          "Theme Settings",
          "Localization Settings"
        ]
      },
      {
        title: "Audit & Compliance",
        items: [
          "Audit Logs",
          "Access Logs",
          "Trade Logs",
          "AI Decision Logs",
          "Execution Logs",
          "Operator Logs",
          "Incident Logs",
          "Compliance Reports"
        ]
      },
      {
        title: "API & Integration Management",
        items: [
          "API Keys",
          "API Gateway",
          "Third-Party Integrations",
          "Webhooks",
          "OAuth Integrations",
          "MT5 APIs",
          "AI Provider APIs",
          "Integration Logs"
        ]
      }
    ]
  },
  {
    title: "Accounts & Portfolio",
    items: ["Account Center", "Portfolio Dashboard", "Risk & Exposure", "Account History"]
  },
  {
    title: "Autonomous Computer Operator",
    items: [
      "Autonomous Operator Dashboard",
      "Computer Control",
      "VPS Control",
      "Remote Session Manager",
      "MT5 Automation",
      "Application Launcher",
      "Application Health",
      "Window Detection",
      "Screen Monitoring",
      "Mouse Control",
      "Keyboard Control",
      "Human Behavior Simulation",
      "Login Automation",
      "Screenshot Verification",
      "Chart Navigation",
      "Auto Recovery",
      "Failure Detection",
      "Recovery Actions",
      "Autonomous Workflow Engine",
      "Scheduler Engine",
      "Workflow Orchestration",
      "Emergency Shutdown",
      "Kill Switch",
      "Operator Action Logs"
    ]
  },
  {
    title: "MT5 Infrastructure & Broker Connectivity",
    items: [
      "MT5 Control Center",
      "Terminal Status",
      "EA Bridge",
      "Broker Connections",
      "Account Sync",
      "Symbol Sync",
      "Market Watch",
      "Chart Control",
      "Chart Templates",
      "Order Router",
      "Trade Synchronization",
      "Execution Queue",
      "Connection Health",
      "Spread Monitor",
      "Slippage Monitor",
      "Latency Monitor",
      "MT5 Error Logs",
      "Broker Error Logs",
      "Execution Logs",
      "EA Monitoring",
      "Broker Failover"
    ]
  },
  {
    title: "Market Intelligence",
    items: [
      "Market Scanner",
      "Asset Selection Engine",
      "Currency Strength Meter",
      "Volatility Scanner",
      "Spread Scanner",
      "Correlation Matrix",
      "Liquidity Heatmap",
      "Market Regime Engine",
      "Session Monitor",
      "Session Manipulation Tracker",
      "Market Sentiment",
      "Institutional Bias",
      "Trend Scanner",
      "Momentum Scanner",
      "Breakout Scanner",
      "Reversal Scanner",
      "Watchlists",
      "Favorite Assets",
      "Market Alerts",
      "Real-Time Market Feed"
    ]
  },
  {
    title: "Economic, News & Sentiment Intelligence",
    items: [
      "Economic Calendar",
      "High Impact News",
      "Medium Impact News",
      "Low Impact News",
      "Central Bank Monitor",
      "Interest Rate Tracker",
      "Inflation Monitor",
      "Employment Data",
      "GDP Monitor",
      "Retail Sentiment",
      "Institutional Sentiment",
      "News Sentiment AI",
      "COT Data",
      "COT Positioning",
      "Risk-On / Risk-Off",
      "Fundamental Bias",
      "Macro Dashboard",
      "Event Impact Analysis",
      "Historical News Analysis",
      "News Risk Engine"
    ]
  },
  {
    title: "Data Engineering & Intelligence",
    items: [
      "Data Center",
      "Candle Data",
      "Tick Data",
      "Spread Data",
      "Order Book Data",
      "Economic Data",
      "Sentiment Data",
      "Vision Data",
      "Feature Store",
      "Data Warehouse",
      "Data Lake",
      "Data Synchronization",
      "Data Quality Monitoring",
      "Data Validation",
      "Missing Data Detection",
      "Data Repair Engine",
      "Historical Archives",
      "Data Retention",
      "Backup Management",
      "Data Recovery"
    ]
  },
  {
    title: "Multi-Timeframe Market Analysis",
    items: [
      "Top-Down Analysis",
      "Weekly Analysis",
      "Daily Analysis",
      "H4 Analysis",
      "H1 Analysis",
      "M15 Analysis",
      "Multi-Timeframe Matrix",
      "Bias Dashboard",
      "Structure Analysis",
      "Trend Analysis",
      "Momentum Analysis",
      "Range Analysis",
      "Breakout Analysis",
      "Reversal Analysis",
      "Liquidity Analysis",
      "Timeframe Alignment",
      "Confluence Engine",
      "Analysis History",
      "Screenshot History",
      "Analysis Replay"
    ]
  },
  {
    title: "Cacsms Vision",
    items: [
      "Vision Intelligence Room",
      "Live Chart Feed",
      "Screenshot Capture",
      "Screenshot Archive",
      "OCR Reader",
      "Candle Detection",
      "Pattern Detection",
      "Order Block Detection",
      "Fair Value Gap Detection",
      "Liquidity Detection",
      "BOS Detection",
      "CHoCH Detection",
      "Trendline Detection",
      "Support & Resistance Detection",
      "Wyckoff Detection",
      "Premium & Discount Zones",
      "Chart Annotation Engine",
      "Vision Confidence Scoring",
      "Vision Replay",
      "Vision Model Monitoring",
      "Vision AI Training",
      "Vision AI Drift Detection",
      "Vision AI Health"
    ]
  },
  {
    title: "Institutional Intelligence",
    items: [
      "Institutional Intelligence Center",
      "Smart Money Analysis",
      "Liquidity Engine",
      "Stop Hunt Detection",
      "Inducement Detection",
      "Order Block Validation",
      "FVG Rebalancing",
      "Market Maker Model",
      "Session Manipulation",
      "Volume Imbalance",
      "VWAP Intelligence",
      "Institutional Footprints",
      "Institutional Trend Bias",
      "Institutional Liquidity Map",
      "Institutional Risk Bias",
      "Smart Money Replay",
      "Liquidity Heatmaps",
      "Institutional Confluence",
      "Institutional Analytics"
    ]
  },
  {
    title: "Strategy Intelligence",
    items: [
      "Strategy Command Center",
      "Strategy Library",
      "Institutional Strategies",
      "Retail Strategies",
      "Quantitative Strategies",
      "Fundamental Strategies",
      "Scalping Strategies",
      "Swing Strategies",
      "Intraday Strategies",
      "Position Trading Strategies",
      "Strategy Ranking",
      "Strategy Competition",
      "Strategy Scoring",
      "Strategy Performance",
      "Strategy Confluence",
      "Strategy Correlation",
      "Strategy Registry",
      "Strategy Replay",
      "Strategy Analytics",
      "Backtesting Engine",
      "Walk-Forward Testing",
      "Monte Carlo Testing",
      "Strategy Optimization",
      "Strategy Learning"
    ]
  },
  {
    title: "AI & Autonomous Intelligence Core",
    items: [
      "AI Decision Console",
      "AI Orchestration Engine",
      "Signal Aggregation",
      "AI Reasoning",
      "AI Confidence Engine",
      "Prediction Engine",
      "Market Regime Models",
      "Reinforcement Learning",
      "Ensemble Models",
      "Neural Network Models",
      "Forecasting Models",
      "Model Registry",
      "Model Monitoring",
      "Model Drift Detection",
      "Feature Engineering",
      "AI Training Pipelines",
      "AI Evaluation",
      "AI Experiments",
      "AI Evolution",
      "AI Replay",
      "AI Explainability",
      "AI Decision History",
      "AI Health Monitoring"
    ]
  },
  {
    title: "Quantitative Intelligence",
    items: [
      "Quant Dashboard",
      "Probability Engine",
      "Monte Carlo Engine",
      "Bayesian Engine",
      "Volatility Models",
      "Correlation Engine",
      "Factor Models",
      "Portfolio Optimization",
      "Risk Models",
      "Statistical Arbitrage",
      "Quant Analytics",
      "Quant Replay",
      "Quant Learning",
      "Quant Signals",
      "Quant Optimization",
      "Quant Performance"
    ]
  },
  {
    title: "Risk Governance & Prop Firm Compliance",
    items: [
      "Risk Dashboard",
      "Position Sizing",
      "Lot Size Engine",
      "Exposure Monitor",
      "Correlation Risk",
      "Drawdown Monitor",
      "Daily Drawdown",
      "Overall Drawdown",
      "News Risk Blocker",
      "Spread Risk Blocker",
      "Volatility Risk Blocker",
      "Weekend Protection",
      "Kill Switch",
      "Risk Events",
      "Risk Heatmaps",
      "Risk Replay",
      "Compliance Engine",
      "Compliance Alerts",
      "Rule Violations",
      "Risk Reports",
      "Prop Firm Reports"
    ]
  },
  {
    title: "Execution Center",
    items: [
      "Execution Dashboard",
      "Pre-Execution Validation",
      "Order Validation",
      "Order Management",
      "Pending Orders",
      "Open Orders",
      "Broker API Execution",
      "MT5 Execution",
      "GUI Fallback Execution",
      "Retry Engine",
      "Slippage Control",
      "Spread Control",
      "Execution Queue",
      "Execution Replay",
      "Execution Audit",
      "Execution Analytics",
      "Execution Latency",
      "Execution Logs",
      "Trade Confirmation"
    ]
  },
  {
    title: "Trade Management",
    items: [
      "Active Trades",
      "Closed Trades",
      "Trade Lifecycle",
      "Trade Management",
      "Breakeven Engine",
      "Trailing Stop Engine",
      "Partial Close Engine",
      "PnL Analysis",
      "Trade Replay",
      "Trade Journal",
      "Trade Analytics",
      "Trade History",
      "Trade Psychology",
      "Trade Heatmaps",
      "Trade Performance",
      "Trade Screenshots",
      "Trade Comments",
      "Trade AI Analysis",
      "Trade Reports"
    ]
  },
  {
    title: "Portfolio, Reporting & Behavioral Intelligence",
    items: [
      "Portfolio Dashboard",
      "Portfolio Analytics",
      "Asset Allocation",
      "Correlation Dashboard",
      "Exposure Dashboard",
      "Daily Reports",
      "Weekly Reports",
      "Monthly Reports",
      "Performance Reports",
      "AI Reports",
      "Execution Reports",
      "Risk Reports",
      "Prop Firm Reports",
      "Behavioral Analytics",
      "Trading Psychology Analytics",
      "Win Rate Analytics",
      "Profit Factor Analytics",
      "Sharpe Ratio Analytics",
      "Expectancy Analytics",
      "Behavioral Replay",
      "Export Center"
    ]
  },
  {
    title: "Monitoring, Recovery & Self-Healing",
    items: [
      "Monitoring Center",
      "Infrastructure Health",
      "API Health",
      "Database Health",
      "Queue Health",
      "Worker Health",
      "AI Health",
      "Vision Health",
      "Broker Health",
      "MT5 Health",
      "VPS Health",
      "Alerts Center",
      "Incident Management",
      "Recovery Actions",
      "Self-Healing Engine",
      "Restart Services",
      "Auto Recovery",
      "Reconnect Broker",
      "Requeue Jobs",
      "Failure Analytics",
      "Monitoring Logs",
      "System Diagnostics"
    ]
  },
  {
    title: "Learning & Optimization",
    items: [
      "Learning Center",
      "Optimization Center",
      "AI Training",
      "Strategy Learning",
      "Quant Learning",
      "Vision Learning",
      "Performance Learning",
      "Genetic Optimization",
      "Bayesian Optimization",
      "Reinforcement Optimization",
      "Champion/Challenger",
      "Hyperparameter Tuning",
      "Optimization Replay",
      "Learning Analytics",
      "Model Evolution",
      "Strategy Evolution",
      "Optimization History",
      "Learning History",
      "Continuous Improvement",
      "AI Evolution Dashboard"
    ]
  },
  {
    title: "Reports & Analytics",
    items: [
      "Reports Center",
      "Trading Reports",
      "AI Reports",
      "Execution Reports",
      "Vision Reports",
      "Risk Reports",
      "Portfolio Reports",
      "Prop Firm Reports",
      "Audit Reports",
      "Performance Analytics",
      "System Analytics",
      "Workflow Analytics",
      "Strategy Analytics",
      "Market Analytics",
      "Historical Analytics",
      "Export Reports",
      "Scheduled Reports",
      "Report Builder",
      "Analytics Dashboard"
    ]
  },
  {
    title: "Settings & Personalization",
    items: [
      "User Profile",
      "Appearance",
      "Theme Configuration",
      "Notifications",
      "Security",
      "Privacy",
      "AI Preferences",
      "Strategy Preferences",
      "Risk Preferences",
      "Execution Preferences",
      "Workspace Layouts",
      "Dashboard Widgets",
      "Language Settings",
      "Timezone Settings",
      "Device Management",
      "Session Management",
      "Integration Settings",
      "Backup Settings",
      "Personalization Profiles"
    ]
  }
];

export const navigationSections: NavigationSection[] = definitions.map((definition) => {
  const sectionSlug = toSlug(definition.title);
  const items =
    definition.items?.map((title) => ({
      title,
      slug: toSlug(title),
      href: `/modules/${sectionSlug}/${toSlug(title)}`,
      sectionTitle: definition.title
    })) ?? [];
  const groups =
    definition.groups?.map((group) => {
      const groupSlug = toSlug(group.title);
      return {
        title: group.title,
        slug: groupSlug,
        items: group.items.map((title) => ({
          title,
          slug: toSlug(title),
          href: `/modules/${sectionSlug}/${groupSlug}/${toSlug(title)}`,
          sectionTitle: definition.title,
          groupTitle: group.title
        }))
      };
    }) ?? [];

  return {
    title: definition.title,
    slug: sectionSlug,
    items,
    groups: groups.length ? groups : undefined
  };
});

export const navigationLeaves = navigationSections.flatMap((section) => [
  ...section.items,
  ...(section.groups?.flatMap((group) => group.items) ?? [])
]);

export function findNavigationLeaf(segments: string[]) {
  const href = `/modules/${segments.join("/")}`;
  return navigationLeaves.find((item) => item.href === href);
}

