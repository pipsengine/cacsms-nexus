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

type SectionDefinition = {
  title: string;
  description: string;
  status: NavigationStatus;
  items?: Array<{ label: string; description: string; status?: NavigationStatus; plannedFeatures?: string[] }>;
  groups?: Array<{
    title: string;
    description: string;
    items: Array<{ label: string; description: string; status?: NavigationStatus; plannedFeatures?: string[] }>;
  }>;
};

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

const definitions: SectionDefinition[] = [
  {
    title: "Executive Overview",
    description: "High-level operational cockpit for institutional oversight.",
    status: "Operational",
    items: [
      { label: "Executive Dashboard", description: "Executive-level system overview.", status: "Foundation", plannedFeatures: defaultPlannedFeatures },
      { label: "Autonomous Workflow", description: "Workflow-first orchestration preview.", status: "Operational", plannedFeatures: defaultPlannedFeatures },
      { label: "System Architecture", description: "Architecture and service boundary map.", status: "Planned", plannedFeatures: defaultPlannedFeatures },
      { label: "System Model", description: "System model and capability matrix.", status: "Planned", plannedFeatures: defaultPlannedFeatures },
      { label: "AI Ecosystem Overview", description: "AI modules and decision lanes overview.", status: "Planned", plannedFeatures: defaultPlannedFeatures },
      { label: "Workflow Pipeline", description: "Pipeline staging and orchestration view.", status: "Planned", plannedFeatures: defaultPlannedFeatures },
      { label: "Operational Timeline", description: "System events and execution timeline.", status: "Planned", plannedFeatures: defaultPlannedFeatures },
      { label: "Global System Status", description: "Global health rollup across domains.", status: "Foundation", plannedFeatures: defaultPlannedFeatures },
      { label: "Infrastructure Status", description: "Compute, network, and runtime status.", status: "Foundation", plannedFeatures: defaultPlannedFeatures },
      { label: "Trading Overview", description: "Trading posture placeholder overview.", status: "Reserved", plannedFeatures: defaultPlannedFeatures },
      { label: "Portfolio Overview", description: "Portfolio posture and exposure preview.", status: "Reserved", plannedFeatures: defaultPlannedFeatures },
      { label: "Market Overview", description: "Market regime and watchlist preview.", status: "Reserved", plannedFeatures: defaultPlannedFeatures },
      { label: "Performance Overview", description: "Performance and attribution preview.", status: "Reserved", plannedFeatures: defaultPlannedFeatures },
      { label: "AI Confidence Overview", description: "AI confidence and validation preview.", status: "Planned", plannedFeatures: defaultPlannedFeatures },
      { label: "Risk Exposure Overview", description: "Risk posture and limit preview.", status: "Reserved", plannedFeatures: defaultPlannedFeatures },
      { label: "Broker Connectivity Overview", description: "Broker and gateway connectivity view.", status: "Reserved", plannedFeatures: defaultPlannedFeatures },
      { label: "VPS Status Overview", description: "VPS and remote session readiness.", status: "Foundation", plannedFeatures: defaultPlannedFeatures },
      { label: "Workflow Heatmap", description: "Stage heatmap and bottlenecks preview.", status: "Planned", plannedFeatures: defaultPlannedFeatures },
      { label: "System Health Matrix", description: "Health matrix across subsystems.", status: "Foundation", plannedFeatures: defaultPlannedFeatures },
      { label: "Alerts Overview", description: "Alerting and incident preview.", status: "Foundation", plannedFeatures: defaultPlannedFeatures },
      { label: "Real-Time Activity Feed", description: "Live activity feed placeholder.", status: "Reserved", plannedFeatures: defaultPlannedFeatures }
    ]
  },
  {
    title: "Administration & Governance",
    description: "Operator governance, access control, and compliance surfaces.",
    status: "Operational",
    groups: [
      {
        title: "User Management",
        description: "Users, roles, permissions, and authentication controls.",
        items: [
          { label: "All Users", description: "User directory and operational status.", plannedFeatures: defaultPlannedFeatures },
          { label: "Create User", description: "Provision and onboard operators.", plannedFeatures: defaultPlannedFeatures },
          { label: "User Roles", description: "Role definitions and assignment.", plannedFeatures: defaultPlannedFeatures },
          { label: "Permissions Matrix", description: "Permission model and policy surface.", plannedFeatures: defaultPlannedFeatures },
          { label: "User Activity", description: "Operator activity audit stream.", plannedFeatures: defaultPlannedFeatures },
          { label: "User Sessions", description: "Session inventory and revocation.", plannedFeatures: defaultPlannedFeatures },
          { label: "Account Restrictions", description: "Restriction policies and enforcement.", plannedFeatures: defaultPlannedFeatures },
          { label: "MFA Management", description: "Multi-factor authentication controls.", plannedFeatures: defaultPlannedFeatures }
        ]
      },
      {
        title: "Super Administration",
        description: "Root controls and emergency governance.",
        items: [
          { label: "Super Admin Console", description: "Root operator control panel.", plannedFeatures: defaultPlannedFeatures },
          { label: "Root Permissions", description: "Root-level permission policies.", plannedFeatures: defaultPlannedFeatures },
          { label: "System Overrides", description: "Override switches and protections.", plannedFeatures: defaultPlannedFeatures },
          { label: "Emergency Controls", description: "Emergency response controls.", plannedFeatures: defaultPlannedFeatures },
          { label: "Master Configurations", description: "System master configuration surface.", plannedFeatures: defaultPlannedFeatures },
          { label: "System Lockdown", description: "Lockdown policies and enforcement.", plannedFeatures: defaultPlannedFeatures }
        ]
      },
      {
        title: "Broker Governance",
        description: "Broker registry, connectivity, and failover policy.",
        items: [
          { label: "Broker Registry", description: "Broker registry and metadata.", plannedFeatures: defaultPlannedFeatures },
          { label: "Broker APIs", description: "Broker API integrations inventory.", plannedFeatures: defaultPlannedFeatures },
          { label: "Broker Health", description: "Broker health and availability.", plannedFeatures: defaultPlannedFeatures },
          { label: "Broker Restrictions", description: "Restriction policy per broker.", plannedFeatures: defaultPlannedFeatures },
          { label: "Broker Credentials", description: "Credential vault placeholder.", plannedFeatures: defaultPlannedFeatures },
          { label: "Broker Failover", description: "Failover policy and routing.", plannedFeatures: defaultPlannedFeatures }
        ]
      },
      {
        title: "Prop Firm Governance",
        description: "Prop firm constraints and compliance enforcement.",
        items: [
          { label: "Prop Firm Rules", description: "Rule inventory and versioning.", plannedFeatures: defaultPlannedFeatures },
          { label: "Drawdown Rules", description: "Drawdown limits and checks.", plannedFeatures: defaultPlannedFeatures },
          { label: "Profit Target Rules", description: "Profit target tracking rules.", plannedFeatures: defaultPlannedFeatures },
          { label: "Consistency Rules", description: "Consistency and behavior checks.", plannedFeatures: defaultPlannedFeatures },
          { label: "Trading Day Rules", description: "Trading day enforcement policies.", plannedFeatures: defaultPlannedFeatures },
          { label: "News Restrictions", description: "News-time restriction rules.", plannedFeatures: defaultPlannedFeatures },
          { label: "Weekend Restrictions", description: "Weekend holding restrictions.", plannedFeatures: defaultPlannedFeatures },
          { label: "Max Lot Rules", description: "Max lot and sizing constraints.", plannedFeatures: defaultPlannedFeatures },
          { label: "Compliance Engine", description: "Compliance rule evaluation surface.", plannedFeatures: defaultPlannedFeatures },
          { label: "Rule Violation Logs", description: "Violation events and remediation.", plannedFeatures: defaultPlannedFeatures },
          { label: "Challenge Monitoring", description: "Challenge state and oversight.", plannedFeatures: defaultPlannedFeatures }
        ]
      },
      {
        title: "Global Settings",
        description: "Global configuration surfaces by domain.",
        items: [
          { label: "System Settings", description: "Core runtime and environment settings.", plannedFeatures: defaultPlannedFeatures },
          { label: "Trading Settings", description: "Trading configuration placeholders.", plannedFeatures: defaultPlannedFeatures },
          { label: "AI Settings", description: "AI controls and governance.", plannedFeatures: defaultPlannedFeatures },
          { label: "Vision Settings", description: "Vision module configuration.", plannedFeatures: defaultPlannedFeatures },
          { label: "Risk Settings", description: "Risk governance settings.", plannedFeatures: defaultPlannedFeatures },
          { label: "Notification Settings", description: "Notification routing settings.", plannedFeatures: defaultPlannedFeatures },
          { label: "Security Settings", description: "Security configuration surface.", plannedFeatures: defaultPlannedFeatures },
          { label: "Theme Settings", description: "Theme configuration placeholder.", plannedFeatures: defaultPlannedFeatures },
          { label: "Localization Settings", description: "Localization and time zone settings.", plannedFeatures: defaultPlannedFeatures }
        ]
      },
      {
        title: "Audit & Compliance",
        description: "Auditing across operator and system domains.",
        items: [
          { label: "Audit Logs", description: "Audit log stream placeholder.", plannedFeatures: defaultPlannedFeatures },
          { label: "Access Logs", description: "Access log stream placeholder.", plannedFeatures: defaultPlannedFeatures },
          { label: "Trade Logs", description: "Trade logs placeholder.", plannedFeatures: defaultPlannedFeatures },
          { label: "AI Decision Logs", description: "AI decision logs placeholder.", plannedFeatures: defaultPlannedFeatures },
          { label: "Execution Logs", description: "Execution logs placeholder.", plannedFeatures: defaultPlannedFeatures },
          { label: "Operator Logs", description: "Operator action logs placeholder.", plannedFeatures: defaultPlannedFeatures },
          { label: "Incident Logs", description: "Incident records placeholder.", plannedFeatures: defaultPlannedFeatures },
          { label: "Compliance Reports", description: "Compliance reports placeholder.", plannedFeatures: defaultPlannedFeatures }
        ]
      },
      {
        title: "API & Integration Management",
        description: "API keys, gateways, and third-party integrations.",
        items: [
          { label: "API Keys", description: "API key inventory placeholder.", plannedFeatures: defaultPlannedFeatures },
          { label: "API Gateway", description: "Gateway routes and policies.", plannedFeatures: defaultPlannedFeatures },
          { label: "Third-Party Integrations", description: "Integration inventory placeholder.", plannedFeatures: defaultPlannedFeatures },
          { label: "Webhooks", description: "Webhook endpoints and logs.", plannedFeatures: defaultPlannedFeatures },
          { label: "OAuth Integrations", description: "OAuth connectors and scopes.", plannedFeatures: defaultPlannedFeatures },
          { label: "MT5 APIs", description: "MT5 API placeholders and status.", plannedFeatures: defaultPlannedFeatures },
          { label: "AI Provider APIs", description: "AI provider integration placeholders.", plannedFeatures: defaultPlannedFeatures },
          { label: "Integration Logs", description: "Integration logs placeholder.", plannedFeatures: defaultPlannedFeatures }
        ]
      }
    ]
  },
  {
    title: "Accounts & Portfolio",
    description: "Accounts, balances, exposure, and portfolio analytics placeholders.",
    status: "Reserved",
    items: [
      { label: "Account Center", description: "Account inventory and switching surface.", plannedFeatures: defaultPlannedFeatures },
      { label: "Broker Accounts", description: "Broker account placeholders.", plannedFeatures: defaultPlannedFeatures },
      { label: "Prop Firm Accounts", description: "Prop firm account placeholders.", plannedFeatures: defaultPlannedFeatures },
      { label: "Live Accounts", description: "Live account placeholders.", plannedFeatures: defaultPlannedFeatures },
      { label: "Demo Accounts", description: "Demo account placeholders.", plannedFeatures: defaultPlannedFeatures },
      { label: "Account Switcher", description: "Account switching UI placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Portfolio Dashboard", description: "Portfolio dashboard placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Balance & Equity", description: "Balance and equity placeholders.", plannedFeatures: defaultPlannedFeatures },
      { label: "Margin Monitor", description: "Margin monitoring placeholders.", plannedFeatures: defaultPlannedFeatures },
      { label: "Leverage Monitor", description: "Leverage monitoring placeholders.", plannedFeatures: defaultPlannedFeatures },
      { label: "Exposure Dashboard", description: "Exposure overview placeholders.", plannedFeatures: defaultPlannedFeatures },
      { label: "Account Performance", description: "Performance placeholders.", plannedFeatures: defaultPlannedFeatures },
      { label: "Multi-Account Sync", description: "Multi-account sync placeholders.", plannedFeatures: defaultPlannedFeatures },
      { label: "Account Analytics", description: "Account analytics placeholders.", plannedFeatures: defaultPlannedFeatures },
      { label: "Capital Allocation", description: "Allocation placeholders.", plannedFeatures: defaultPlannedFeatures },
      { label: "Account History", description: "History placeholders.", plannedFeatures: defaultPlannedFeatures },
      { label: "Funding History", description: "Funding placeholders.", plannedFeatures: defaultPlannedFeatures }
    ]
  },
  {
    title: "Autonomous Computer Operator",
    description: "Future desktop automation and operator control surfaces.",
    status: "Reserved",
    items: [
      { label: "Autonomous Operator Dashboard", description: "Operator lane dashboard placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Computer Control", description: "Computer control placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "VPS Control", description: "VPS control placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Remote Session Manager", description: "Remote sessions placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "MT5 Automation", description: "MT5 automation placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Application Launcher", description: "Launcher placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Application Health", description: "Application health placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Window Detection", description: "Window detection placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Screen Monitoring", description: "Screen monitoring placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Mouse Control", description: "Mouse control placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Keyboard Control", description: "Keyboard control placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Human Behavior Simulation", description: "Behavior simulation placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Login Automation", description: "Login automation placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Screenshot Verification", description: "Screenshot verification placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Chart Navigation", description: "Chart navigation placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Auto Recovery", description: "Auto recovery placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Failure Detection", description: "Failure detection placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Recovery Actions", description: "Recovery actions placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Autonomous Workflow Engine", description: "Workflow engine placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Scheduler Engine", description: "Scheduler placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Workflow Orchestration", description: "Orchestration placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Emergency Shutdown", description: "Emergency shutdown placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Kill Switch", description: "Kill switch placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Operator Action Logs", description: "Operator logs placeholder.", plannedFeatures: defaultPlannedFeatures }
    ]
  },
  {
    title: "MT5 Infrastructure & Broker Connectivity",
    description: "MT5 terminal, broker gateway, and autonomous recovery operations.",
    status: "Operational",
    items: [
      { label: "MT5 Control Center", description: "Real-time MT5 infrastructure command room.", status: "Operational", plannedFeatures: defaultPlannedFeatures },
      { label: "Terminal Status", description: "Real-time terminal heartbeat and recovery operations.", status: "Operational", plannedFeatures: defaultPlannedFeatures },
      { label: "EA Bridge", description: "Secure real-time Expert Advisor communication bridge.", status: "Operational", plannedFeatures: defaultPlannedFeatures },
      { label: "EA & Terminal Hub", description: "Link Cacsms EA folder to MT5 Experts paths and manage multi-terminal connections.", status: "Operational", plannedFeatures: defaultPlannedFeatures },
      { label: "Broker Connections", description: "Real-time broker session, execution, and data-feed control.", status: "Operational", plannedFeatures: defaultPlannedFeatures },
      { label: "Account Sync", description: "Real-time MT5 balances, exposure, and reconciliation control.", status: "Operational", plannedFeatures: defaultPlannedFeatures },
      { label: "Symbol Sync", description: "Real-time broker instrument normalization and feed readiness.", status: "Operational", plannedFeatures: defaultPlannedFeatures },
      { label: "Market Watch", description: "Real-time quotes, sessions, spreads, and watchlist intelligence.", status: "Operational", plannedFeatures: defaultPlannedFeatures },
      { label: "Chart Control", description: "Interactive MT5 chart workspaces, overlays, signals, and snapshots.", status: "Operational", plannedFeatures: defaultPlannedFeatures },
      { label: "Chart Templates", description: "Governed chart presets, indicator packs, versioning, and deployments.", status: "Operational", plannedFeatures: defaultPlannedFeatures },
      { label: "Order Router", description: "Audited MT5 order validation and routing command center.", status: "Operational", plannedFeatures: defaultPlannedFeatures },
      { label: "Trade Synchronization", description: "Trade sync placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Execution Queue", description: "Execution queue placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Connection Health", description: "Connection health placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Spread Monitor", description: "Spread monitor placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Slippage Monitor", description: "Slippage monitor placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Latency Monitor", description: "Latency monitor placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "MT5 Error Logs", description: "MT5 error logs placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Broker Error Logs", description: "Broker error logs placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Execution Logs", description: "Execution logs placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "EA Monitoring", description: "EA monitoring placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Broker Failover", description: "Broker failover placeholder.", plannedFeatures: defaultPlannedFeatures }
    ]
  },
  {
    title: "Market Intelligence",
    description: "Market intelligence surfaces (placeholder).",
    status: "Reserved",
    items: [
      { label: "Market Scanner", description: "Market scanner placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Asset Selection Engine", description: "Asset selection placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Currency Strength Meter", description: "Strength meter placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Volatility Scanner", description: "Volatility scanner placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Spread Scanner", description: "Spread scanner placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Correlation Matrix", description: "Correlation matrix placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Liquidity Heatmap", description: "Liquidity heatmap placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Market Regime Engine", description: "Regime engine placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Session Monitor", description: "Session monitor placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Session Manipulation Tracker", description: "Session manipulation placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Market Sentiment", description: "Market sentiment placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Institutional Bias", description: "Institutional bias placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Trend Scanner", description: "Trend scanner placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Momentum Scanner", description: "Momentum scanner placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Breakout Scanner", description: "Breakout scanner placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Reversal Scanner", description: "Reversal scanner placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Watchlists", description: "Watchlists placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Favorite Assets", description: "Favorites placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Market Alerts", description: "Market alerts placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Real-Time Market Feed", description: "Real-time feed placeholder.", plannedFeatures: defaultPlannedFeatures }
    ]
  },
  {
    title: "Economic, News & Sentiment Intelligence",
    description: "Macro, news, and sentiment surfaces (placeholder).",
    status: "Reserved",
    items: [
      { label: "Economic Calendar", description: "Economic calendar placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "High Impact News", description: "High impact news placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Medium Impact News", description: "Medium impact news placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Low Impact News", description: "Low impact news placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Central Bank Monitor", description: "Central bank monitor placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Interest Rate Tracker", description: "Rate tracker placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Inflation Monitor", description: "Inflation monitor placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Employment Data", description: "Employment data placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "GDP Monitor", description: "GDP monitor placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Retail Sentiment", description: "Retail sentiment placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Institutional Sentiment", description: "Institutional sentiment placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "News Sentiment AI", description: "News sentiment placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "COT Data", description: "COT data placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "COT Positioning", description: "COT positioning placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Risk-On / Risk-Off", description: "Risk-on/off placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Fundamental Bias", description: "Fundamental bias placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Macro Dashboard", description: "Macro dashboard placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Event Impact Analysis", description: "Event impact placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Historical News Analysis", description: "Historical analysis placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "News Risk Engine", description: "News risk placeholder.", plannedFeatures: defaultPlannedFeatures }
    ]
  },
  {
    title: "Data Engineering & Intelligence",
    description: "Data engineering, storage, and quality surfaces (placeholder).",
    status: "Reserved",
    items: [
      { label: "Data Center", description: "Data center placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Candle Data", description: "Candle data placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Tick Data", description: "Tick data placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Spread Data", description: "Spread data placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Order Book Data", description: "Order book placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Economic Data", description: "Economic data placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Sentiment Data", description: "Sentiment data placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Vision Data", description: "Vision data placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Feature Store", description: "Feature store placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Data Warehouse", description: "Warehouse placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Data Lake", description: "Data lake placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Data Synchronization", description: "Synchronization placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Data Quality Monitoring", description: "Quality monitoring placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Data Validation", description: "Validation placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Missing Data Detection", description: "Missing data placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Data Repair Engine", description: "Repair engine placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Historical Archives", description: "Archives placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Data Retention", description: "Retention placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Backup Management", description: "Backup placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Data Recovery", description: "Recovery placeholder.", plannedFeatures: defaultPlannedFeatures }
    ]
  },
  {
    title: "Multi-Timeframe Market Analysis",
    description: "Top-down and multi-timeframe analysis surfaces (placeholder).",
    status: "Reserved",
    items: [
      { label: "Top-Down Analysis", description: "Top-down analysis placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Weekly Analysis", description: "Weekly analysis placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Daily Analysis", description: "Daily analysis placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "H4 Analysis", description: "H4 analysis placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "H1 Analysis", description: "H1 analysis placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "M15 Analysis", description: "M15 analysis placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Multi-Timeframe Matrix", description: "Matrix placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Bias Dashboard", description: "Bias dashboard placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Structure Analysis", description: "Structure analysis placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Trend Analysis", description: "Trend analysis placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Momentum Analysis", description: "Momentum analysis placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Range Analysis", description: "Range analysis placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Breakout Analysis", description: "Breakout analysis placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Reversal Analysis", description: "Reversal analysis placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Liquidity Analysis", description: "Liquidity analysis placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Timeframe Alignment", description: "Alignment placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Confluence Engine", description: "Confluence placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Analysis History", description: "Analysis history placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Screenshot History", description: "Screenshot history placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Analysis Replay", description: "Replay placeholder.", plannedFeatures: defaultPlannedFeatures }
    ]
  },
  {
    title: "Cacsms Vision",
    description: "Computer vision analysis surfaces (placeholder).",
    status: "Reserved",
    items: [
      { label: "Vision Intelligence Room", description: "Vision command center placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Live Chart Feed", description: "Live feed placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Screenshot Capture", description: "Capture placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Screenshot Archive", description: "Archive placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "OCR Reader", description: "OCR placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Candle Detection", description: "Detection placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Pattern Detection", description: "Pattern placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Order Block Detection", description: "Order block placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Fair Value Gap Detection", description: "FVG placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Liquidity Detection", description: "Liquidity placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "BOS Detection", description: "BOS placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "CHoCH Detection", description: "CHoCH placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Trendline Detection", description: "Trendline placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Support & Resistance Detection", description: "S/R placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Wyckoff Detection", description: "Wyckoff placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Premium & Discount Zones", description: "Zones placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Chart Annotation Engine", description: "Annotation placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Vision Confidence Scoring", description: "Confidence placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Vision Replay", description: "Replay placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Vision Model Monitoring", description: "Monitoring placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Vision AI Training", description: "Training placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Vision AI Drift Detection", description: "Drift placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Vision AI Health", description: "Health placeholder.", plannedFeatures: defaultPlannedFeatures }
    ]
  },
  {
    title: "Institutional Intelligence",
    description: "Institutional intelligence and smart money surfaces (placeholder).",
    status: "Reserved",
    items: [
      { label: "Institutional Intelligence Center", description: "Institutional center placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Smart Money Analysis", description: "Smart money placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Liquidity Engine", description: "Liquidity engine placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Stop Hunt Detection", description: "Stop hunt placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Inducement Detection", description: "Inducement placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Order Block Validation", description: "Validation placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "FVG Rebalancing", description: "Rebalancing placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Market Maker Model", description: "MMM placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Session Manipulation", description: "Manipulation placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Volume Imbalance", description: "Imbalance placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "VWAP Intelligence", description: "VWAP placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Institutional Footprints", description: "Footprints placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Institutional Trend Bias", description: "Trend bias placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Institutional Liquidity Map", description: "Liquidity map placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Institutional Risk Bias", description: "Risk bias placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Smart Money Replay", description: "Replay placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Liquidity Heatmaps", description: "Heatmaps placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Institutional Confluence", description: "Confluence placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Institutional Analytics", description: "Analytics placeholder.", plannedFeatures: defaultPlannedFeatures }
    ]
  },
  {
    title: "Strategy Intelligence",
    description: "Strategy library and evaluation surfaces (placeholder).",
    status: "Reserved",
    items: [
      { label: "Strategy Command Center", description: "Command center placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Strategy Library", description: "Library placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Institutional Strategies", description: "Institutional strategies placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Retail Strategies", description: "Retail strategies placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Quantitative Strategies", description: "Quant strategies placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Fundamental Strategies", description: "Fundamental strategies placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Scalping Strategies", description: "Scalping strategies placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Swing Strategies", description: "Swing strategies placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Intraday Strategies", description: "Intraday strategies placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Position Trading Strategies", description: "Position strategies placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Strategy Ranking", description: "Ranking placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Strategy Competition", description: "Competition placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Strategy Scoring", description: "Scoring placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Strategy Performance", description: "Performance placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Strategy Confluence", description: "Confluence placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Strategy Correlation", description: "Correlation placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Strategy Registry", description: "Registry placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Strategy Replay", description: "Replay placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Strategy Analytics", description: "Analytics placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Backtesting Engine", description: "Backtesting placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Walk-Forward Testing", description: "Walk-forward placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Monte Carlo Testing", description: "Monte Carlo placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Strategy Optimization", description: "Optimization placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Strategy Learning", description: "Learning placeholder.", plannedFeatures: defaultPlannedFeatures }
    ]
  },
  {
    title: "AI & Autonomous Intelligence Core",
    description: "AI decisioning, orchestration, and governance surfaces (placeholder).",
    status: "Reserved",
    items: [
      { label: "AI Decision Console", description: "Decision console placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "AI Orchestration Engine", description: "Orchestration placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Signal Aggregation", description: "Signal aggregation placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "AI Reasoning", description: "Reasoning placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "AI Confidence Engine", description: "Confidence engine placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Prediction Engine", description: "Prediction placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Market Regime Models", description: "Regime models placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Reinforcement Learning", description: "RL placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Ensemble Models", description: "Ensembles placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Neural Network Models", description: "Neural networks placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Forecasting Models", description: "Forecasting placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Model Registry", description: "Model registry placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Model Monitoring", description: "Monitoring placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Model Drift Detection", description: "Drift placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Feature Engineering", description: "Feature engineering placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "AI Training Pipelines", description: "Training pipelines placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "AI Evaluation", description: "Evaluation placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "AI Experiments", description: "Experiments placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "AI Evolution", description: "Evolution placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "AI Replay", description: "Replay placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "AI Explainability", description: "Explainability placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "AI Decision History", description: "Decision history placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "AI Health Monitoring", description: "Health monitoring placeholder.", plannedFeatures: defaultPlannedFeatures }
    ]
  },
  {
    title: "Quantitative Intelligence",
    description: "Quant models and statistical systems (placeholder).",
    status: "Reserved",
    items: [
      { label: "Quant Dashboard", description: "Quant dashboard placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Probability Engine", description: "Probability placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Monte Carlo Engine", description: "Monte Carlo placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Bayesian Engine", description: "Bayesian placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Volatility Models", description: "Volatility placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Correlation Engine", description: "Correlation placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Factor Models", description: "Factor models placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Portfolio Optimization", description: "Optimization placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Risk Models", description: "Risk models placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Statistical Arbitrage", description: "Stat arb placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Quant Analytics", description: "Analytics placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Quant Replay", description: "Replay placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Quant Learning", description: "Learning placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Quant Signals", description: "Signals placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Quant Optimization", description: "Optimization placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Quant Performance", description: "Performance placeholder.", plannedFeatures: defaultPlannedFeatures }
    ]
  },
  {
    title: "Risk Governance & Prop Firm Compliance",
    description: "Risk controls and compliance surfaces (placeholder).",
    status: "Reserved",
    items: [
      { label: "Risk Dashboard", description: "Risk dashboard placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Position Sizing", description: "Sizing placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Lot Size Engine", description: "Lot size placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Exposure Monitor", description: "Exposure monitor placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Correlation Risk", description: "Correlation risk placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Drawdown Monitor", description: "Drawdown monitor placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Daily Drawdown", description: "Daily drawdown placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Overall Drawdown", description: "Overall drawdown placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "News Risk Blocker", description: "News risk placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Spread Risk Blocker", description: "Spread risk placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Volatility Risk Blocker", description: "Volatility risk placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Weekend Protection", description: "Weekend protection placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Kill Switch", description: "Kill switch placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Risk Events", description: "Risk events placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Risk Heatmaps", description: "Heatmaps placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Risk Replay", description: "Replay placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Compliance Engine", description: "Compliance engine placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Compliance Alerts", description: "Alerts placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Rule Violations", description: "Violations placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Risk Reports", description: "Reports placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Prop Firm Reports", description: "Prop firm reports placeholder.", plannedFeatures: defaultPlannedFeatures }
    ]
  },
  {
    title: "Execution Center",
    description: "Execution surfaces (disabled placeholder).",
    status: "Reserved",
    items: [
      { label: "Execution Dashboard", description: "Execution dashboard placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Pre-Execution Validation", description: "Validation placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Order Validation", description: "Order validation placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Order Management", description: "Order management placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Pending Orders", description: "Pending orders placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Open Orders", description: "Open orders placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Broker API Execution", description: "Broker API execution placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "MT5 Execution", description: "MT5 execution placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "GUI Fallback Execution", description: "GUI fallback placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Retry Engine", description: "Retry engine placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Slippage Control", description: "Slippage control placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Spread Control", description: "Spread control placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Execution Queue", description: "Queue placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Execution Replay", description: "Replay placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Execution Audit", description: "Audit placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Execution Analytics", description: "Analytics placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Execution Latency", description: "Latency placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Execution Logs", description: "Logs placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Trade Confirmation", description: "Confirmation placeholder.", plannedFeatures: defaultPlannedFeatures }
    ]
  },
  {
    title: "Trade Management",
    description: "Trade management surfaces (disabled placeholder).",
    status: "Reserved",
    items: [
      { label: "Active Trades", description: "Active trades placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Closed Trades", description: "Closed trades placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Trade Lifecycle", description: "Lifecycle placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Trade Management", description: "Trade management placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Breakeven Engine", description: "Breakeven placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Trailing Stop Engine", description: "Trailing stop placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Partial Close Engine", description: "Partial close placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "PnL Analysis", description: "PnL placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Trade Replay", description: "Replay placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Trade Journal", description: "Journal placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Trade Analytics", description: "Analytics placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Trade History", description: "History placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Trade Psychology", description: "Psychology placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Trade Heatmaps", description: "Heatmaps placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Trade Performance", description: "Performance placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Trade Screenshots", description: "Screenshots placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Trade Comments", description: "Comments placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Trade AI Analysis", description: "AI analysis placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Trade Reports", description: "Reports placeholder.", plannedFeatures: defaultPlannedFeatures }
    ]
  },
  {
    title: "Portfolio, Reporting & Behavioral Intelligence",
    description: "Portfolio analytics and behavioral overlays (placeholder).",
    status: "Reserved",
    items: [
      { label: "Portfolio Dashboard", description: "Portfolio dashboard placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Portfolio Analytics", description: "Portfolio analytics placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Asset Allocation", description: "Allocation placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Correlation Dashboard", description: "Correlation placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Exposure Dashboard", description: "Exposure placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Daily Reports", description: "Daily reports placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Weekly Reports", description: "Weekly reports placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Monthly Reports", description: "Monthly reports placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Performance Reports", description: "Performance reports placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "AI Reports", description: "AI reports placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Execution Reports", description: "Execution reports placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Risk Reports", description: "Risk reports placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Prop Firm Reports", description: "Prop firm reports placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Behavioral Analytics", description: "Behavioral analytics placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Trading Psychology Analytics", description: "Psychology analytics placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Win Rate Analytics", description: "Win rate placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Profit Factor Analytics", description: "Profit factor placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Sharpe Ratio Analytics", description: "Sharpe ratio placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Expectancy Analytics", description: "Expectancy placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Behavioral Replay", description: "Behavioral replay placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Export Center", description: "Export center placeholder.", plannedFeatures: defaultPlannedFeatures }
    ]
  },
  {
    title: "Monitoring, Recovery & Self-Healing",
    description: "Monitoring and recovery surfaces (placeholder).",
    status: "Reserved",
    items: [
      { label: "Monitoring Center", description: "Monitoring center placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Infrastructure Health", description: "Infrastructure health placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "API Health", description: "API health placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Database Health", description: "Database health placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Queue Health", description: "Queue health placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Worker Health", description: "Worker health placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "AI Health", description: "AI health placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Vision Health", description: "Vision health placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Broker Health", description: "Broker health placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "MT5 Health", description: "MT5 health placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "VPS Health", description: "VPS health placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Alerts Center", description: "Alerts placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Incident Management", description: "Incidents placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Recovery Actions", description: "Recovery actions placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Self-Healing Engine", description: "Self-healing placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Restart Services", description: "Restart placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Auto Recovery", description: "Auto recovery placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Reconnect Broker", description: "Reconnect placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Requeue Jobs", description: "Requeue placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Failure Analytics", description: "Failure analytics placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Monitoring Logs", description: "Monitoring logs placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "System Diagnostics", description: "Diagnostics placeholder.", plannedFeatures: defaultPlannedFeatures }
    ]
  },
  {
    title: "Learning & Optimization",
    description: "Learning, optimization, and improvement surfaces (placeholder).",
    status: "Reserved",
    items: [
      { label: "Learning Center", description: "Learning center placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Optimization Center", description: "Optimization center placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "AI Training", description: "AI training placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Strategy Learning", description: "Strategy learning placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Quant Learning", description: "Quant learning placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Vision Learning", description: "Vision learning placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Performance Learning", description: "Performance learning placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Genetic Optimization", description: "Genetic optimization placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Bayesian Optimization", description: "Bayesian optimization placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Reinforcement Optimization", description: "Reinforcement optimization placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Champion/Challenger", description: "Champion/challenger placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Hyperparameter Tuning", description: "Hyperparameter placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Optimization Replay", description: "Replay placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Learning Analytics", description: "Analytics placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Model Evolution", description: "Evolution placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Strategy Evolution", description: "Evolution placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Optimization History", description: "History placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Learning History", description: "History placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Continuous Improvement", description: "Improvement placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "AI Evolution Dashboard", description: "AI evolution placeholder.", plannedFeatures: defaultPlannedFeatures }
    ]
  },
  {
    title: "Reports & Analytics",
    description: "Reporting and analytics surfaces (placeholder).",
    status: "Reserved",
    items: [
      { label: "Reports Center", description: "Reports center placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Trading Reports", description: "Trading reports placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "AI Reports", description: "AI reports placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Execution Reports", description: "Execution reports placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Vision Reports", description: "Vision reports placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Risk Reports", description: "Risk reports placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Portfolio Reports", description: "Portfolio reports placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Prop Firm Reports", description: "Prop firm reports placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Audit Reports", description: "Audit reports placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Performance Analytics", description: "Performance analytics placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "System Analytics", description: "System analytics placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Workflow Analytics", description: "Workflow analytics placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Strategy Analytics", description: "Strategy analytics placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Market Analytics", description: "Market analytics placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Historical Analytics", description: "Historical analytics placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Export Reports", description: "Export reports placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Scheduled Reports", description: "Scheduled reports placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Report Builder", description: "Report builder placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Analytics Dashboard", description: "Analytics dashboard placeholder.", plannedFeatures: defaultPlannedFeatures }
    ]
  },
  {
    title: "Settings & Personalization",
    description: "User and workspace personalization surfaces.",
    status: "Foundation",
    items: [
      { label: "User Profile", description: "User profile placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Appearance", description: "Appearance placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Theme Configuration", description: "Theme configuration placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Notifications", description: "Notifications placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Security", description: "Security placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Privacy", description: "Privacy placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "AI Preferences", description: "AI preferences placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Strategy Preferences", description: "Strategy preferences placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Risk Preferences", description: "Risk preferences placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Execution Preferences", description: "Execution preferences placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Workspace Layouts", description: "Workspace layouts placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Dashboard Widgets", description: "Widgets placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Language Settings", description: "Language settings placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Timezone Settings", description: "Timezone settings placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Device Management", description: "Device management placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Session Management", description: "Session management placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Integration Settings", description: "Integration settings placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Backup Settings", description: "Backup settings placeholder.", plannedFeatures: defaultPlannedFeatures },
      { label: "Personalization Profiles", description: "Profiles placeholder.", plannedFeatures: defaultPlannedFeatures }
    ]
  }
];

function buildItem(
  moduleKey: NavigationModuleKey,
  label: string,
  description: string,
  status: NavigationStatus,
  plannedFeatures?: string[]
): NavigationItem<LucideIcon> {
  const itemSlug = toSlug(label);
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
    path: `/${moduleKey}/${itemSlug}`
  };
}

export const navigationGroups: NavigationGroup<LucideIcon>[] = definitions.map((definition) => {
  const moduleKey = toSlug(definition.title) as NavigationModuleKey;
  const theme = colors[moduleKey];
  const items =
    definition.items?.map((item) =>
      buildItem(moduleKey, item.label, item.description, item.status ?? "Foundation", item.plannedFeatures ?? defaultPlannedFeatures)
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
            item.plannedFeatures ?? defaultPlannedFeatures
          ),
          path: `/${moduleKey}/${groupSlug}/${toSlug(item.label)}`
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
