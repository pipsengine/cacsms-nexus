import type { NavigationStatus } from "@cacsms-nexus/types";

export type NavigationEntry = {
  label: string;
  description: string;
  status?: NavigationStatus;
  plannedFeatures?: string[];
  slug?: string;
  path?: string;
};

export type NavigationSectionDefinition = {
  title: string;
  description: string;
  status: NavigationStatus;
  items?: NavigationEntry[];
  groups?: Array<{
    title: string;
    description: string;
    items: NavigationEntry[];
  }>;
};

const MT5 = "/mt5-infrastructure-and-broker-connectivity";
const ACCOUNTS = "/accounts-and-portfolio";
const EXEC = "/executive-overview";

const mt5 = (slug: string, label: string, description: string, status: NavigationStatus = "Operational"): NavigationEntry => ({
  label,
  slug,
  path: `${MT5}/${slug}`,
  status,
  description
});

export function createNavigationSectionDefinitions(_defaultPlannedFeatures: string[]): NavigationSectionDefinition[] {
  return [
    {
      title: "Executive Overview",
      description: "Institutional command cockpit, system health, and domain rollups.",
      status: "Operational",
      groups: [
        {
          title: "Command",
          description: "Primary executive and workflow surfaces.",
          items: [
            {
              label: "Executive Dashboard",
              slug: "executive-dashboard",
              path: `${EXEC}/executive-dashboard`,
              status: "Foundation",
              description: "Executive-level system overview and KPI rollups."
            },
            {
              label: "Autonomous Workflow",
              slug: "autonomous-workflow",
              path: `${EXEC}/autonomous-workflow`,
              status: "Operational",
              description: "Workflow-first orchestration and pipeline control."
            }
          ]
        },
        {
          title: "System Health",
          description: "Replaces separate global status, infrastructure, matrix, alerts, and VPS links.",
          items: [
            {
              label: "System Health Hub",
              slug: "system-health-hub",
              path: `${EXEC}/system-health-hub`,
              status: "Foundation",
              description: "Global health, infrastructure posture, health matrix, alerts, and VPS readiness."
            }
          ]
        },
        {
          title: "Blueprint",
          description: "Architecture and orchestration design surfaces (planned).",
          items: [
            {
              label: "System Blueprint",
              slug: "system-blueprint",
              path: `${EXEC}/system-blueprint`,
              status: "Planned",
              description: "Architecture, system model, AI ecosystem, workflow pipeline, timeline, and heatmap."
            }
          ]
        },
        {
          title: "Domain Rollups",
          description: "Cross-domain posture previews (planned).",
          items: [
            {
              label: "Domain Overviews",
              slug: "domain-overviews",
              path: `${EXEC}/domain-overviews`,
              status: "Reserved",
              description: "Trading, portfolio, market, performance, AI confidence, risk, and broker rollups."
            },
            {
              label: "Activity Feed",
              slug: "activity-feed",
              path: `${EXEC}/activity-feed`,
              status: "Reserved",
              description: "Real-time institutional activity stream."
            }
          ]
        }
      ]
    },
    {
      title: "Administration & Governance",
      description: "Access control, broker and prop firm policy, audit, and integrations.",
      status: "Operational",
      groups: [
        {
          title: "Users & Access",
          description: "Replaces user directory, roles, permissions, MFA, sessions, and restrictions links.",
          items: [
            {
              label: "Users & Access Hub",
              slug: "users-and-access-hub",
              path: "/administration-and-governance/users-and-access-hub",
              description: "User directory, provisioning, roles, permissions, MFA, sessions, and restrictions."
            }
          ]
        },
        {
          title: "Super Administration",
          description: "Root operator controls and emergency governance.",
          items: [
            {
              label: "Super Admin Console",
              slug: "super-admin-console",
              path: "/administration-and-governance/super-admin-console",
              description: "Root permissions, overrides, emergency controls, master config, and lockdown."
            }
          ]
        },
        {
          title: "Broker & Prop Firm",
          description: "Broker registry and prop firm compliance in two focused hubs.",
          items: [
            {
              label: "Broker Governance Hub",
              slug: "broker-governance-hub",
              path: "/administration-and-governance/broker-governance-hub",
              description: "Broker registry, APIs, health, restrictions, credentials, and failover policy."
            },
            {
              label: "Prop Firm Rules Hub",
              slug: "prop-firm-rules-hub",
              path: "/administration-and-governance/prop-firm-rules-hub",
              description: "Drawdown, profit, consistency, news/weekend rules, compliance, and challenge monitoring."
            }
          ]
        },
        {
          title: "Platform",
          description: "Global settings, audit trails, and integration management.",
          items: [
            {
              label: "Settings Hub",
              slug: "settings-hub",
              path: "/administration-and-governance/settings-hub",
              description: "System, trading, AI, vision, risk, notification, security, theme, and localization settings."
            },
            {
              label: "Audit & Compliance Hub",
              slug: "audit-and-compliance-hub",
              path: "/administration-and-governance/audit-and-compliance-hub",
              description: "Audit, access, trade, AI, execution, operator, and incident logs plus compliance reports."
            },
            {
              label: "Integration Hub",
              slug: "integration-hub",
              path: "/administration-and-governance/integration-hub",
              description: "API keys, gateway, webhooks, OAuth, MT5 APIs, AI providers, and integration logs."
            }
          ]
        }
      ]
    },
    {
      title: "Accounts & Portfolio",
      description: "Linked trading accounts, workspace context, portfolio analytics, and financial health.",
      status: "Operational",
      groups: [
        {
          title: "Workspace",
          description: "Manage all account types and portfolio-wide analytics in two focused surfaces.",
          items: [
            {
              label: "Account Center",
              slug: "account-center",
              path: `${ACCOUNTS}/account-center`,
              status: "Operational",
              description: "Single inventory for Live, Demo, Prop Firm, and Broker accounts — switch workspace, pin, filter, and export."
            },
            {
              label: "Portfolio Dashboard",
              slug: "portfolio-dashboard",
              path: `${ACCOUNTS}/portfolio-dashboard`,
              status: "Operational",
              description: "Cross-account equity, allocation mix, category breakdown, and performance snapshot."
            }
          ]
        },
        {
          title: "Financial Health",
          description: "Combined risk monitoring (replaces margin, leverage, and exposure links).",
          items: [
            {
              label: "Risk & Exposure",
              slug: "risk-and-exposure",
              path: `${ACCOUNTS}/risk-and-exposure`,
            status: "Operational",
            description: "Margin, leverage, and cross-account exposure in one monitor."
            }
          ]
        },
        {
          title: "Records",
          description: "Historical account activity (replaces account and funding history links).",
          items: [
            {
              label: "Account History",
              slug: "account-history",
              path: `${ACCOUNTS}/account-history`,
              status: "Planned",
              description: "Deposits, withdrawals, funding events, and workspace change timeline."
            }
          ]
        }
      ]
    },
    {
      title: "Autonomous Computer Operator",
      description: "Desktop automation, remote control, and operator safety.",
      status: "Operational",
      groups: [
        {
          title: "Operator",
          description: "Primary operator control surfaces.",
          items: [
            {
              label: "Operator Dashboard",
              slug: "operator-dashboard",
              path: "/autonomous-computer-operator/operator-dashboard",
              status: "Operational",
              description: "Autonomous operator lane overview and action center."
            }
          ]
        },
        {
          title: "Remote Control",
          description: "VPS, computer, session, and application control.",
          items: [
            {
              label: "Remote Control Hub",
              slug: "remote-control-hub",
              path: "/autonomous-computer-operator/remote-control-hub",
              status: "Operational",
              description: "Computer, VPS, remote sessions, MT5 automation, launcher, and application health."
            }
          ]
        },
        {
          title: "Automation",
          description: "Input simulation and desktop interaction.",
          items: [
            {
              label: "Desktop Automation Hub",
              slug: "desktop-automation-hub",
              path: "/autonomous-computer-operator/desktop-automation-hub",
              status: "Operational",
              description: "Autonomous MT5 operator: open chart, select pair, walk top-down timeframes, capture screenshots for AI analysis."
            }
          ]
        },
        {
          title: "Safety",
          description: "Recovery workflows and emergency controls.",
          items: [
            {
              label: "Recovery & Safety Hub",
              slug: "recovery-and-safety-hub",
              path: "/autonomous-computer-operator/recovery-and-safety-hub",
              description: "Auto recovery, failure detection, workflow engine, scheduler, emergency shutdown, kill switch, and operator logs."
            }
          ]
        }
      ]
    },
    {
      title: "MT5 Infrastructure & Broker Connectivity",
      description: "MT5 terminals, broker gateways, execution, and quality monitoring.",
      status: "Operational",
      groups: [
        {
          title: "Command & Terminals",
          description: "MT5 control room, terminal status, EA bridge, and terminal hub.",
          items: [
            mt5("mt5-control-center", "MT5 Control Center", "Real-time MT5 infrastructure command room."),
            mt5("terminal-status", "Terminal Status", "Terminal heartbeat, diagnostics, and recovery operations."),
            mt5("ea-bridge", "EA Bridge", "Secure Expert Advisor communication bridge."),
            mt5("ea-terminal-hub", "EA & Terminal Hub", "Link EA folder to MT5 Experts paths and manage multi-terminal connections.")
          ]
        },
        {
          title: "Broker & Sync",
          description: "Broker sessions and account/symbol synchronization.",
          items: [
            mt5("broker-connections", "Broker Connections", "Broker session, execution, and data-feed control."),
            mt5("account-sync", "Account Sync", "MT5 balances, exposure, reconciliation, and permission controls."),
            mt5("symbol-sync", "Symbol Sync", "Broker instrument normalization and feed readiness.")
          ]
        },
        {
          title: "Market & Charts",
          description: "Quotes, watchlists, and chart workspaces.",
          items: [
            mt5("market-watch", "Market Watch", "Real-time quotes, sessions, spreads, and watchlist intelligence."),
            mt5("chart-control", "Chart Control", "Interactive chart workspaces, overlays, signals, and snapshots."),
            mt5("chart-templates", "Chart Templates", "Governed chart presets, indicator packs, and deployments.")
          ]
        },
        {
          title: "Execution",
          description: "Order routing, trade sync, and execution queue.",
          items: [
            mt5("order-router", "Order Router", "Audited MT5 order validation and routing command center."),
            mt5("trade-synchronization", "Trade Synchronization", "Trade sync state, reconciliation, and recovery."),
            mt5("execution-queue", "Execution Queue", "Queued execution jobs, retries, and dispatch status.")
          ]
        },
        {
          title: "Quality & Monitoring",
          description: "Connection health, execution quality, logs, and EA monitoring.",
          items: [
            mt5("connection-health", "Connection Health", "Component connectivity, latency, incidents, and remediation."),
            {
              label: "Execution Quality Monitor",
              slug: "execution-quality-monitor",
              path: `${MT5}/slippage-monitor`,
              status: "Operational",
              description: "Spread, slippage, and latency monitoring — canonical entry for execution quality."
            },
            {
              label: "Logs & EA Monitoring",
              slug: "logs-and-ea-monitoring",
              path: `${MT5}/ea-monitoring`,
              status: "Operational",
              description: "MT5 error logs, execution logs, broker errors, and EA monitoring."
            },
            {
              label: "Broker Failover",
              slug: "broker-failover",
              path: `${MT5}/broker-failover`,
              status: "Planned",
              description: "Broker failover routing and recovery policies."
            }
          ]
        }
      ]
    },
    {
      title: "Market Intelligence",
      description: "Market scanning, regime analysis, and watchlists (planned).",
      status: "Reserved",
      groups: [
        {
          title: "Scanning",
          description: "Asset and pattern scanners.",
          items: [{ label: "Market Scanner Hub", slug: "market-scanner-hub", path: "/market-intelligence/market-scanner-hub", description: "Scanners for assets, trends, momentum, breakouts, reversals, volatility, and spreads." }]
        },
        {
          title: "Regime & Sentiment",
          description: "Market regime and sentiment intelligence.",
          items: [{ label: "Regime & Sentiment Hub", slug: "regime-and-sentiment-hub", path: "/market-intelligence/regime-and-sentiment-hub", description: "Regime engine, sentiment, institutional bias, and session monitors." }]
        },
        {
          title: "Structure",
          description: "Correlation and liquidity views.",
          items: [{ label: "Liquidity & Correlation Hub", slug: "liquidity-and-correlation-hub", path: "/market-intelligence/liquidity-and-correlation-hub", description: "Correlation matrix, liquidity heatmap, and currency strength." }]
        },
        {
          title: "Watchlists",
          description: "Lists, favorites, and alerts.",
          items: [{ label: "Watchlists & Alerts", slug: "watchlists-and-alerts", path: "/market-intelligence/watchlists-and-alerts", description: "Watchlists, favorite assets, market alerts, and live feed." }]
        }
      ]
    },
    {
      title: "Economic, News & Sentiment Intelligence",
      description: "Macro calendar, sentiment, and news risk (planned).",
      status: "Reserved",
      groups: [
        {
          title: "Calendar",
          description: "Economic events and impact tiers.",
          items: [{ label: "Economic Calendar Hub", slug: "economic-calendar-hub", path: "/economic-news-and-sentiment-intelligence/economic-calendar-hub", description: "Calendar with high, medium, and low impact news in one view." }]
        },
        {
          title: "Macro",
          description: "Macroeconomic monitors.",
          items: [{ label: "Macro Monitor Hub", slug: "macro-monitor-hub", path: "/economic-news-and-sentiment-intelligence/macro-monitor-hub", description: "Central bank, rates, inflation, employment, GDP, and macro dashboard." }]
        },
        {
          title: "Sentiment",
          description: "Sentiment and positioning.",
          items: [{ label: "Sentiment & Positioning Hub", slug: "sentiment-and-positioning-hub", path: "/economic-news-and-sentiment-intelligence/sentiment-and-positioning-hub", description: "Retail and institutional sentiment, news AI, COT, and risk-on/off bias." }]
        },
        {
          title: "News Risk",
          description: "Event impact and news risk engine.",
          items: [{ label: "News Risk Hub", slug: "news-risk-hub", path: "/economic-news-and-sentiment-intelligence/news-risk-hub", description: "Event impact analysis, historical news review, and news risk engine." }]
        }
      ]
    },
    {
      title: "Data Engineering & Intelligence",
      description: "Data platform, quality, and lifecycle (planned).",
      status: "Reserved",
      groups: [
        {
          title: "Platform",
          description: "Core data platform surfaces.",
          items: [{ label: "Data Platform Hub", slug: "data-platform-hub", path: "/data-engineering-and-intelligence/data-platform-hub", description: "Data center, warehouse, lake, synchronization, and feature store." }]
        },
        {
          title: "Market Data",
          description: "Tick, candle, and microstructure data.",
          items: [{ label: "Market Data Hub", slug: "market-data-hub", path: "/data-engineering-and-intelligence/market-data-hub", description: "Candle, tick, spread, and order book datasets." }]
        },
        {
          title: "Intelligence Feeds",
          description: "Non-price intelligence datasets.",
          items: [{ label: "Intelligence Data Hub", slug: "intelligence-data-hub", path: "/data-engineering-and-intelligence/intelligence-data-hub", description: "Economic, sentiment, and vision datasets." }]
        },
        {
          title: "Quality",
          description: "Validation, repair, and retention.",
          items: [{ label: "Data Quality & Lifecycle Hub", slug: "data-quality-and-lifecycle-hub", path: "/data-engineering-and-intelligence/data-quality-and-lifecycle-hub", description: "Quality monitoring, validation, repair, archives, retention, backup, and recovery." }]
        }
      ]
    },
    {
      title: "Multi-Timeframe Market Analysis",
      description: "Top-down and multi-timeframe analysis (planned).",
      status: "Reserved",
      groups: [
        {
          title: "Timeframes",
          description: "Weekly through M15 analysis.",
          items: [{ label: "Multi-Timeframe Hub", slug: "multi-timeframe-hub", path: "/multi-timeframe-market-analysis/multi-timeframe-hub", description: "Top-down, weekly, daily, H4, H1, M15, matrix, and alignment views." }]
        },
        {
          title: "Structure",
          description: "Bias and market structure.",
          items: [{ label: "Structure & Bias Hub", slug: "structure-and-bias-hub", path: "/multi-timeframe-market-analysis/structure-and-bias-hub", description: "Bias dashboard, structure, trend, momentum, and range analysis." }]
        },
        {
          title: "Patterns",
          description: "Breakout, reversal, and confluence.",
          items: [{ label: "Pattern Analysis Hub", slug: "pattern-analysis-hub", path: "/multi-timeframe-market-analysis/pattern-analysis-hub", description: "Breakout, reversal, liquidity, and confluence engine." }]
        },
        {
          title: "History",
          description: "Replay and screenshot history.",
          items: [{ label: "Analysis History Hub", slug: "analysis-history-hub", path: "/multi-timeframe-market-analysis/analysis-history-hub", description: "Analysis history, screenshot archive, and replay." }]
        }
      ]
    },
    {
      title: "Cacsms Vision",
      description: "Computer vision chart analysis (planned).",
      status: "Reserved",
      groups: [
        {
          title: "Vision Room",
          description: "Live feed and capture.",
          items: [{ label: "Vision Command Hub", slug: "vision-command-hub", path: "/cacsms-vision/vision-command-hub", description: "Vision intelligence room, live chart feed, capture, and archive." }]
        },
        {
          title: "Detection",
          description: "Chart pattern and structure detection.",
          items: [{ label: "Chart Detection Hub", slug: "chart-detection-hub", path: "/cacsms-vision/chart-detection-hub", description: "OCR, candles, patterns, order blocks, FVG, liquidity, BOS, CHoCH, trendlines, S/R, Wyckoff, and zones." }]
        },
        {
          title: "Annotation",
          description: "Annotations and confidence scoring.",
          items: [{ label: "Annotation & Scoring Hub", slug: "annotation-and-scoring-hub", path: "/cacsms-vision/annotation-and-scoring-hub", description: "Chart annotation engine and vision confidence scoring." }]
        },
        {
          title: "MLOps",
          description: "Vision model operations.",
          items: [{ label: "Vision MLOps Hub", slug: "vision-mlops-hub", path: "/cacsms-vision/vision-mlops-hub", description: "Replay, monitoring, training, drift detection, and health." }]
        }
      ]
    },
    {
      title: "Institutional Intelligence",
      description: "Smart money and institutional flow analysis (planned).",
      status: "Reserved",
      groups: [
        {
          title: "Center",
          description: "Institutional intelligence command surface.",
          items: [{ label: "Institutional Center", slug: "institutional-center", path: "/institutional-intelligence/institutional-center", description: "Primary institutional intelligence workspace." }]
        },
        {
          title: "Smart Money",
          description: "Liquidity and manipulation models.",
          items: [{ label: "Smart Money Hub", slug: "smart-money-hub", path: "/institutional-intelligence/smart-money-hub", description: "Smart money, liquidity engine, stop hunts, inducement, OB validation, FVG, MMM, and session manipulation." }]
        },
        {
          title: "Analytics",
          description: "Footprints, bias, and replay.",
          items: [{ label: "Institutional Analytics Hub", slug: "institutional-analytics-hub", path: "/institutional-intelligence/institutional-analytics-hub", description: "Footprints, VWAP, bias, confluence, heatmaps, analytics, and replay." }]
        }
      ]
    },
    {
      title: "Strategy Intelligence",
      description: "Strategy library, evaluation, and optimization (planned).",
      status: "Reserved",
      groups: [
        {
          title: "Command",
          description: "Strategy command and library.",
          items: [{ label: "Strategy Command Hub", slug: "strategy-command-hub", path: "/strategy-intelligence/strategy-command-hub", description: "Strategy command center and governed strategy library." }]
        },
        {
          title: "Catalog",
          description: "Strategy types and styles.",
          items: [{ label: "Strategy Catalog Hub", slug: "strategy-catalog-hub", path: "/strategy-intelligence/strategy-catalog-hub", description: "Institutional, retail, quant, fundamental, scalping, swing, intraday, and position strategies." }]
        },
        {
          title: "Evaluation",
          description: "Ranking, scoring, and correlation.",
          items: [{ label: "Strategy Evaluation Hub", slug: "strategy-evaluation-hub", path: "/strategy-intelligence/strategy-evaluation-hub", description: "Ranking, competition, scoring, performance, confluence, correlation, and registry." }]
        },
        {
          title: "Research",
          description: "Backtesting and optimization.",
          items: [{ label: "Strategy Research Hub", slug: "strategy-research-hub", path: "/strategy-intelligence/strategy-research-hub", description: "Replay, analytics, backtesting, walk-forward, Monte Carlo, optimization, and learning." }]
        }
      ]
    },
    {
      title: "AI & Autonomous Intelligence Core",
      description: "AI decisioning, models, and MLOps (planned).",
      status: "Reserved",
      groups: [
        {
          title: "Decisioning",
          description: "AI decision console and orchestration.",
          items: [{ label: "AI Decision Hub", slug: "ai-decision-hub", path: "/ai-and-autonomous-intelligence-core/ai-decision-hub", description: "Decision console, orchestration, signal aggregation, reasoning, confidence, and prediction." }]
        },
        {
          title: "Models",
          description: "Model registry and families.",
          items: [{ label: "Model Registry Hub", slug: "model-registry-hub", path: "/ai-and-autonomous-intelligence-core/model-registry-hub", description: "Regime, RL, ensemble, neural, forecasting models, and registry." }]
        },
        {
          title: "MLOps",
          description: "Training, drift, and health.",
          items: [{ label: "AI MLOps Hub", slug: "ai-mlops-hub", path: "/ai-and-autonomous-intelligence-core/ai-mlops-hub", description: "Monitoring, drift, feature engineering, training, evaluation, experiments, evolution, and health." }]
        },
        {
          title: "Audit",
          description: "Explainability and decision history.",
          items: [{ label: "AI Audit Hub", slug: "ai-audit-hub", path: "/ai-and-autonomous-intelligence-core/ai-audit-hub", description: "Replay, explainability, and immutable decision history." }]
        }
      ]
    },
    {
      title: "Quantitative Intelligence",
      description: "Quant models and statistical engines (planned).",
      status: "Reserved",
      groups: [
        {
          title: "Dashboard",
          description: "Quant overview.",
          items: [{ label: "Quant Dashboard", slug: "quant-dashboard", path: "/quantitative-intelligence/quant-dashboard", description: "Quantitative intelligence overview." }]
        },
        {
          title: "Engines",
          description: "Statistical and factor engines.",
          items: [{ label: "Quant Engines Hub", slug: "quant-engines-hub", path: "/quantitative-intelligence/quant-engines-hub", description: "Probability, Monte Carlo, Bayesian, volatility, correlation, factor, portfolio optimization, risk, and stat arb." }]
        },
        {
          title: "Analytics",
          description: "Signals and performance.",
          items: [{ label: "Quant Analytics Hub", slug: "quant-analytics-hub", path: "/quantitative-intelligence/quant-analytics-hub", description: "Analytics, replay, learning, signals, optimization, and performance." }]
        }
      ]
    },
    {
      title: "Risk Governance & Prop Firm Compliance",
      description: "Risk controls, blockers, and compliance (planned).",
      status: "Reserved",
      groups: [
        {
          title: "Risk",
          description: "Risk dashboard and exposure.",
          items: [{ label: "Risk Dashboard", slug: "risk-dashboard", path: "/risk-governance-and-prop-firm-compliance/risk-dashboard", description: "Primary risk governance dashboard." }]
        },
        {
          title: "Exposure",
          description: "Sizing and drawdown monitors.",
          items: [{ label: "Exposure & Sizing Hub", slug: "exposure-and-sizing-hub", path: "/risk-governance-and-prop-firm-compliance/exposure-and-sizing-hub", description: "Position sizing, lot engine, exposure, correlation, and drawdown monitors." }]
        },
        {
          title: "Blockers",
          description: "Automated risk blockers.",
          items: [{ label: "Risk Blockers Hub", slug: "risk-blockers-hub", path: "/risk-governance-and-prop-firm-compliance/risk-blockers-hub", description: "News, spread, volatility, weekend protection, and kill switch." }]
        },
        {
          title: "Compliance",
          description: "Compliance engine and reports.",
          items: [{ label: "Compliance & Reports Hub", slug: "compliance-and-reports-hub", path: "/risk-governance-and-prop-firm-compliance/compliance-and-reports-hub", description: "Compliance engine, alerts, violations, heatmaps, replay, and prop firm reports." }]
        }
      ]
    },
    {
      title: "Execution Center",
      description: "Order lifecycle and execution intelligence.",
      status: "Reserved",
      groups: [
        {
          title: "Command",
          description: "Execution overview — routes to MT5 Order Router when live.",
          items: [
            {
              label: "Execution Dashboard",
              slug: "execution-dashboard",
              path: `${MT5}/order-router`,
              status: "Operational",
              description: "Execution command surface (canonical: MT5 Order Router)."
            }
          ]
        },
        {
          title: "Orders",
          description: "Validation and order lifecycle (planned).",
          items: [{ label: "Order Lifecycle Hub", slug: "order-lifecycle-hub", path: "/execution-center/order-lifecycle-hub", description: "Pre-execution validation, order validation, management, pending, and open orders." }]
        },
        {
          title: "Controls",
          description: "Execution channels and quality controls.",
          items: [
            {
              label: "Execution Controls Hub",
              slug: "execution-controls-hub",
              path: `${MT5}/execution-quality-monitor`,
              status: "Operational",
              description: "Slippage and spread controls (canonical: execution quality monitors)."
            }
          ]
        },
        {
          title: "Intelligence",
          description: "Queue, logs, and analytics.",
          items: [
            {
              label: "Execution Intelligence Hub",
              slug: "execution-intelligence-hub",
              path: `${MT5}/execution-logs`,
              status: "Operational",
              description: "Execution queue, replay, audit, analytics, latency, logs, and confirmations."
            }
          ]
        }
      ]
    },
    {
      title: "Trade Management",
      description: "Active trades, automation, and journal (planned).",
      status: "Reserved",
      groups: [
        {
          title: "Desk",
          description: "Active and closed trade management.",
          items: [{ label: "Trade Desk Hub", slug: "trade-desk-hub", path: "/trade-management/trade-desk-hub", description: "Active trades, closed trades, lifecycle, and trade management." }]
        },
        {
          title: "Automation",
          description: "Breakeven, trailing, and partial closes.",
          items: [{ label: "Trade Automation Hub", slug: "trade-automation-hub", path: "/trade-management/trade-automation-hub", description: "Breakeven, trailing stop, and partial close engines." }]
        },
        {
          title: "Analytics",
          description: "Performance and history.",
          items: [{ label: "Trade Analytics Hub", slug: "trade-analytics-hub", path: "/trade-management/trade-analytics-hub", description: "PnL, analytics, performance, heatmaps, and trade history." }]
        },
        {
          title: "Journal",
          description: "Journal, psychology, and AI review.",
          items: [{ label: "Trade Journal Hub", slug: "trade-journal-hub", path: "/trade-management/trade-journal-hub", description: "Journal, replay, psychology, screenshots, comments, AI analysis, and reports." }]
        }
      ]
    },
    {
      title: "Portfolio, Reporting & Behavioral Intelligence",
      description: "Portfolio analytics, reports, and behavioral overlays.",
      status: "Reserved",
      groups: [
        {
          title: "Portfolio",
          description: "Cross-account analytics.",
          items: [
            {
              label: "Portfolio Analytics",
              slug: "portfolio-analytics",
              path: `${ACCOUNTS}/portfolio-dashboard`,
              status: "Operational",
              description: "Canonical portfolio analytics — opens Portfolio Dashboard."
            }
          ]
        },
        {
          title: "Reports",
          description: "Scheduled and on-demand reports.",
          items: [{ label: "Reports Hub", slug: "reports-hub", path: "/portfolio-reporting-and-behavioral-intelligence/reports-hub", description: "Daily, weekly, monthly, performance, AI, execution, risk, and prop firm reports." }]
        },
        {
          title: "Behavior",
          description: "Behavioral and psychology analytics.",
          items: [{ label: "Behavioral Intelligence Hub", slug: "behavioral-intelligence-hub", path: "/portfolio-reporting-and-behavioral-intelligence/behavioral-intelligence-hub", description: "Behavioral analytics, psychology, win rate, profit factor, Sharpe, expectancy, and replay." }]
        },
        {
          title: "Export",
          description: "Export and delivery.",
          items: [{ label: "Export Center", slug: "export-center", path: "/portfolio-reporting-and-behavioral-intelligence/export-center", description: "Report export, scheduling, and delivery center." }]
        }
      ]
    },
    {
      title: "Monitoring, Recovery & Self-Healing",
      description: "Platform health, incidents, and recovery.",
      status: "Reserved",
      groups: [
        {
          title: "Monitoring",
          description: "Primary monitoring center.",
          items: [{ label: "Monitoring Center", slug: "monitoring-center", path: "/monitoring-recovery-and-self-healing/monitoring-center", description: "Unified monitoring command surface." }]
        },
        {
          title: "Infrastructure",
          description: "Core infrastructure health.",
          items: [{ label: "Infrastructure Health Hub", slug: "infrastructure-health-hub", path: "/monitoring-recovery-and-self-healing/infrastructure-health-hub", description: "Infrastructure, API, database, queue, worker, and VPS health." }]
        },
        {
          title: "Trading Stack",
          description: "Trading-related health monitors.",
          items: [
            {
              label: "Trading Stack Health Hub",
              slug: "trading-stack-health-hub",
              path: `${MT5}/connection-health`,
              status: "Operational",
              description: "AI, vision, broker, and MT5 health (canonical: Connection Health)."
            }
          ]
        },
        {
          title: "Recovery",
          description: "Incidents and self-healing.",
          items: [{ label: "Incidents & Recovery Hub", slug: "incidents-and-recovery-hub", path: "/monitoring-recovery-and-self-healing/incidents-and-recovery-hub", description: "Alerts, incidents, recovery, self-healing, reconnect, requeue, diagnostics, and logs." }]
        }
      ]
    },
    {
      title: "Learning & Optimization",
      description: "Continuous learning and optimization (planned).",
      status: "Reserved",
      groups: [
        {
          title: "Learning",
          description: "Learning center and tracks.",
          items: [{ label: "Learning Center Hub", slug: "learning-center-hub", path: "/learning-and-optimization/learning-center-hub", description: "Learning center plus AI, strategy, quant, vision, and performance tracks." }]
        },
        {
          title: "Optimization",
          description: "Optimization lab.",
          items: [{ label: "Optimization Lab Hub", slug: "optimization-lab-hub", path: "/learning-and-optimization/optimization-lab-hub", description: "Genetic, Bayesian, RL, champion/challenger, hyperparameter tuning, and continuous improvement." }]
        },
        {
          title: "Evolution",
          description: "Model and strategy evolution history.",
          items: [{ label: "Evolution & History Hub", slug: "evolution-and-history-hub", path: "/learning-and-optimization/evolution-and-history-hub", description: "Model evolution, strategy evolution, optimization history, and AI evolution dashboard." }]
        }
      ]
    },
    {
      title: "Reports & Analytics",
      description: "Cross-domain reporting and analytics (planned).",
      status: "Reserved",
      groups: [
        {
          title: "Reports",
          description: "All report types in one hub.",
          items: [{ label: "Reports Center", slug: "reports-center", path: "/reports-and-analytics/reports-center", description: "Trading, AI, execution, vision, risk, portfolio, prop firm, and audit reports." }]
        },
        {
          title: "Analytics",
          description: "Cross-domain analytics.",
          items: [{ label: "Analytics Hub", slug: "analytics-hub", path: "/reports-and-analytics/analytics-hub", description: "Performance, system, workflow, strategy, market, and historical analytics." }]
        },
        {
          title: "Tools",
          description: "Export, scheduling, and builder.",
          items: [{ label: "Report Tools Hub", slug: "report-tools-hub", path: "/reports-and-analytics/report-tools-hub", description: "Export, scheduled reports, report builder, and analytics dashboard." }]
        }
      ]
    },
    {
      title: "Settings & Personalization",
      description: "Profile, preferences, workspace, and integrations.",
      status: "Foundation",
      groups: [
        {
          title: "Profile",
          description: "Profile and security.",
          items: [{ label: "Profile & Security Hub", slug: "profile-and-security-hub", path: "/settings-and-personalization/profile-and-security-hub", description: "User profile, security, privacy, sessions, and device management." }]
        },
        {
          title: "Preferences",
          description: "Appearance and trading preferences.",
          items: [{ label: "Preferences Hub", slug: "preferences-hub", path: "/settings-and-personalization/preferences-hub", description: "Appearance, theme, notifications, language, timezone, AI, strategy, risk, and execution preferences." }]
        },
        {
          title: "Workspace",
          description: "Layouts and widgets.",
          items: [{ label: "Workspace Hub", slug: "workspace-hub", path: "/settings-and-personalization/workspace-hub", description: "Workspace layouts, dashboard widgets, and personalization profiles." }]
        },
        {
          title: "Integrations",
          description: "Integration and backup settings.",
          items: [{ label: "Integration Settings Hub", slug: "integration-settings-hub", path: "/settings-and-personalization/integration-settings-hub", description: "Integration settings and backup configuration." }]
        }
      ]
    }
  ] as NavigationSectionDefinition[];
}
