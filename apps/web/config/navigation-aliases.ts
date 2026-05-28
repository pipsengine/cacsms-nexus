function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\//g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function modulePath(moduleKey: string, slug: string) {
  return `/${moduleKey}/${slug}`;
}

/** Map legacy sidebar slugs to canonical routes (full paths). */
function buildModuleAliases(moduleKey: string, targets: Record<string, string>) {
  const aliases: Record<string, string> = {};
  for (const [legacyLabelOrSlug, targetPath] of Object.entries(targets)) {
    const legacySlug = legacyLabelOrSlug.includes("-") ? legacyLabelOrSlug : toSlug(legacyLabelOrSlug);
    aliases[modulePath(moduleKey, legacySlug)] = targetPath.startsWith("/") ? targetPath : modulePath(moduleKey, targetPath);
  }
  return aliases;
}

function buildGroupedModuleAliases(moduleKey: string, groupSlug: string, targets: Record<string, string>) {
  const flat = buildModuleAliases(moduleKey, targets);
  const grouped: Record<string, string> = {};
  for (const [legacyLabelOrSlug, targetPath] of Object.entries(targets)) {
    const legacySlug = legacyLabelOrSlug.includes("-") ? legacyLabelOrSlug : toSlug(legacyLabelOrSlug);
    grouped[`/${moduleKey}/${groupSlug}/${legacySlug}`] = targetPath.startsWith("/")
      ? targetPath
      : modulePath(moduleKey, targetPath);
  }
  return { ...flat, ...grouped };
}

const EXEC = "executive-overview";
const ADMIN = "administration-and-governance";
const ACCOUNTS = "accounts-and-portfolio";
const OPERATOR = "autonomous-computer-operator";
const MT5 = "mt5-infrastructure-and-broker-connectivity";
const MARKET = "market-intelligence";
const ECON = "economic-news-and-sentiment-intelligence";
const DATA = "data-engineering-and-intelligence";
const MTF = "multi-timeframe-market-analysis";
const VISION = "cacsms-vision";
const INST = "institutional-intelligence";
const STRATEGY = "strategy-intelligence";
const AI = "ai-and-autonomous-intelligence-core";
const QUANT = "quantitative-intelligence";
const RISK = "risk-governance-and-prop-firm-compliance";
const EXEC_CENTER = "execution-center";
const TRADE = "trade-management";
const PORTFOLIO_RPT = "portfolio-reporting-and-behavioral-intelligence";
const MONITOR = "monitoring-recovery-and-self-healing";
const LEARNING = "learning-and-optimization";
const REPORTS = "reports-and-analytics";
const SETTINGS = "settings-and-personalization";

const mt5 = (slug: string) => modulePath(MT5, slug);

export const consolidatedNavigationAliases: Record<string, string> = {
  "/mt5-infrastructure-and-broker-connectivity/ea-and-terminal-hub": mt5("ea-terminal-hub"),

  ...buildModuleAliases(EXEC, {
    "system-architecture": modulePath(EXEC, "system-blueprint"),
    "system-model": modulePath(EXEC, "system-blueprint"),
    "ai-ecosystem-overview": modulePath(EXEC, "system-blueprint"),
    "workflow-pipeline": modulePath(EXEC, "system-blueprint"),
    "operational-timeline": modulePath(EXEC, "system-blueprint"),
    "workflow-heatmap": modulePath(EXEC, "system-blueprint"),
    "global-system-status": modulePath(EXEC, "system-health-hub"),
    "infrastructure-status": modulePath(EXEC, "system-health-hub"),
    "system-health-matrix": modulePath(EXEC, "system-health-hub"),
    "alerts-overview": modulePath(EXEC, "system-health-hub"),
    "vps-status-overview": modulePath(EXEC, "system-health-hub"),
    "trading-overview": modulePath(EXEC, "domain-overviews"),
    "portfolio-overview": "/accounts-and-portfolio/portfolio-dashboard",
    "market-overview": modulePath(EXEC, "domain-overviews"),
    "performance-overview": modulePath(EXEC, "domain-overviews"),
    "ai-confidence-overview": modulePath(EXEC, "domain-overviews"),
    "risk-exposure-overview": modulePath(EXEC, "domain-overviews"),
    "broker-connectivity-overview": modulePath(EXEC, "domain-overviews"),
    "real-time-activity-feed": modulePath(EXEC, "activity-feed")
  }),

  ...buildGroupedModuleAliases(ADMIN, "user-management", {
    "all-users": modulePath(ADMIN, "users-and-access-hub"),
    "create-user": modulePath(ADMIN, "users-and-access-hub"),
    "user-roles": modulePath(ADMIN, "users-and-access-hub"),
    "permissions-matrix": modulePath(ADMIN, "users-and-access-hub"),
    "user-activity": modulePath(ADMIN, "users-and-access-hub"),
    "user-sessions": modulePath(ADMIN, "users-and-access-hub"),
    "account-restrictions": modulePath(ADMIN, "users-and-access-hub"),
    "mfa-management": modulePath(ADMIN, "users-and-access-hub")
  }),

  ...buildGroupedModuleAliases(ADMIN, "super-administration", {
    "super-admin-console": modulePath(ADMIN, "super-admin-console"),
    "root-permissions": modulePath(ADMIN, "super-admin-console"),
    "system-overrides": modulePath(ADMIN, "super-admin-console"),
    "emergency-controls": modulePath(ADMIN, "super-admin-console"),
    "master-configurations": modulePath(ADMIN, "super-admin-console"),
    "system-lockdown": modulePath(ADMIN, "super-admin-console")
  }),

  ...buildGroupedModuleAliases(ADMIN, "broker-governance", {
    "broker-registry": modulePath(ADMIN, "broker-governance-hub"),
    "broker-apis": modulePath(ADMIN, "broker-governance-hub"),
    "broker-health": modulePath(ADMIN, "broker-governance-hub"),
    "broker-restrictions": modulePath(ADMIN, "broker-governance-hub"),
    "broker-credentials": modulePath(ADMIN, "broker-governance-hub"),
    "broker-failover": modulePath(ADMIN, "broker-governance-hub")
  }),

  ...buildGroupedModuleAliases(ADMIN, "prop-firm-governance", {
    "prop-firm-rules": modulePath(ADMIN, "prop-firm-rules-hub"),
    "drawdown-rules": modulePath(ADMIN, "prop-firm-rules-hub"),
    "profit-target-rules": modulePath(ADMIN, "prop-firm-rules-hub"),
    "consistency-rules": modulePath(ADMIN, "prop-firm-rules-hub"),
    "trading-day-rules": modulePath(ADMIN, "prop-firm-rules-hub"),
    "news-restrictions": modulePath(ADMIN, "prop-firm-rules-hub"),
    "weekend-restrictions": modulePath(ADMIN, "prop-firm-rules-hub"),
    "max-lot-rules": modulePath(ADMIN, "prop-firm-rules-hub"),
    "compliance-engine": modulePath(ADMIN, "prop-firm-rules-hub"),
    "rule-violation-logs": modulePath(ADMIN, "prop-firm-rules-hub"),
    "challenge-monitoring": modulePath(ADMIN, "prop-firm-rules-hub")
  }),

  ...buildGroupedModuleAliases(ADMIN, "global-settings", {
    "system-settings": modulePath(ADMIN, "settings-hub"),
    "trading-settings": modulePath(ADMIN, "settings-hub"),
    "ai-settings": modulePath(ADMIN, "settings-hub"),
    "vision-settings": modulePath(ADMIN, "settings-hub"),
    "risk-settings": modulePath(ADMIN, "settings-hub"),
    "notification-settings": modulePath(ADMIN, "settings-hub"),
    "security-settings": modulePath(ADMIN, "settings-hub"),
    "theme-settings": modulePath(ADMIN, "settings-hub"),
    "localization-settings": modulePath(ADMIN, "settings-hub")
  }),

  ...buildGroupedModuleAliases(ADMIN, "audit-and-compliance", {
    "audit-logs": modulePath(ADMIN, "audit-and-compliance-hub"),
    "access-logs": modulePath(ADMIN, "audit-and-compliance-hub"),
    "trade-logs": modulePath(ADMIN, "audit-and-compliance-hub"),
    "ai-decision-logs": modulePath(ADMIN, "audit-and-compliance-hub"),
    "execution-logs": mt5("execution-logs"),
    "operator-logs": modulePath(ADMIN, "audit-and-compliance-hub"),
    "incident-logs": modulePath(ADMIN, "audit-and-compliance-hub"),
    "compliance-reports": modulePath(ADMIN, "audit-and-compliance-hub")
  }),

  ...buildGroupedModuleAliases(ADMIN, "api-and-integration-management", {
    "api-keys": modulePath(ADMIN, "integration-hub"),
    "api-gateway": modulePath(ADMIN, "integration-hub"),
    "third-party-integrations": modulePath(ADMIN, "integration-hub"),
    webhooks: modulePath(ADMIN, "integration-hub"),
    "oauth-integrations": modulePath(ADMIN, "integration-hub"),
    "mt5-apis": modulePath(ADMIN, "integration-hub"),
    "ai-provider-apis": modulePath(ADMIN, "integration-hub"),
    "integration-logs": modulePath(ADMIN, "integration-hub")
  }),

  ...buildModuleAliases(ACCOUNTS, {
    "broker-accounts": "/accounts-and-portfolio/account-center?category=Broker",
    "prop-firm-accounts": "/accounts-and-portfolio/account-center?category=Prop%20Firm",
    "live-accounts": "/accounts-and-portfolio/account-center?category=Live",
    "demo-accounts": "/accounts-and-portfolio/account-center?category=Demo",
    "account-switcher": modulePath(ACCOUNTS, "account-center"),
    "balance-and-equity": modulePath(ACCOUNTS, "portfolio-dashboard"),
    "margin-monitor": modulePath(ACCOUNTS, "risk-and-exposure"),
    "leverage-monitor": modulePath(ACCOUNTS, "risk-and-exposure"),
    "exposure-dashboard": modulePath(ACCOUNTS, "risk-and-exposure"),
    "account-performance": modulePath(ACCOUNTS, "portfolio-dashboard"),
    "account-analytics": modulePath(ACCOUNTS, "portfolio-dashboard"),
    "capital-allocation": modulePath(ACCOUNTS, "portfolio-dashboard"),
    "multi-account-sync": mt5("account-sync"),
    "funding-history": modulePath(ACCOUNTS, "account-history")
  }),

  ...buildModuleAliases(OPERATOR, {
    "autonomous-operator-dashboard": modulePath(OPERATOR, "operator-dashboard"),
    "computer-control": modulePath(OPERATOR, "remote-control-hub"),
    "vps-control": modulePath(OPERATOR, "remote-control-hub"),
    "remote-session-manager": modulePath(OPERATOR, "remote-control-hub"),
    "mt5-automation": modulePath(OPERATOR, "remote-control-hub"),
    "application-launcher": modulePath(OPERATOR, "remote-control-hub"),
    "application-health": modulePath(OPERATOR, "remote-control-hub"),
    "window-detection": modulePath(OPERATOR, "desktop-automation-hub"),
    "screen-monitoring": modulePath(OPERATOR, "desktop-automation-hub"),
    "mouse-control": modulePath(OPERATOR, "desktop-automation-hub"),
    "keyboard-control": modulePath(OPERATOR, "desktop-automation-hub"),
    "human-behavior-simulation": modulePath(OPERATOR, "desktop-automation-hub"),
    "login-automation": modulePath(OPERATOR, "desktop-automation-hub"),
    "screenshot-verification": modulePath(OPERATOR, "desktop-automation-hub"),
    "chart-navigation": modulePath(OPERATOR, "desktop-automation-hub"),
    "auto-recovery": modulePath(OPERATOR, "recovery-and-safety-hub"),
    "failure-detection": modulePath(OPERATOR, "recovery-and-safety-hub"),
    "recovery-actions": modulePath(OPERATOR, "recovery-and-safety-hub"),
    "autonomous-workflow-engine": modulePath(OPERATOR, "recovery-and-safety-hub"),
    "scheduler-engine": modulePath(OPERATOR, "recovery-and-safety-hub"),
    "workflow-orchestration": modulePath(OPERATOR, "recovery-and-safety-hub"),
    "emergency-shutdown": modulePath(OPERATOR, "recovery-and-safety-hub"),
    "kill-switch": modulePath(OPERATOR, "recovery-and-safety-hub"),
    "operator-action-logs": modulePath(OPERATOR, "recovery-and-safety-hub")
  }),

  ...buildModuleAliases(MT5, {
    "execution-quality-monitor": mt5("slippage-monitor"),
    "broker-error-logs": mt5("mt5-error-logs"),
    "logs-and-ea-monitoring": mt5("ea-monitoring")
  }),

  ...buildModuleAliases(MARKET, {
    "market-scanner": modulePath(MARKET, "market-scanner-hub"),
    "asset-selection-engine": modulePath(MARKET, "market-scanner-hub"),
    "trend-scanner": modulePath(MARKET, "market-scanner-hub"),
    "momentum-scanner": modulePath(MARKET, "market-scanner-hub"),
    "breakout-scanner": modulePath(MARKET, "market-scanner-hub"),
    "reversal-scanner": modulePath(MARKET, "market-scanner-hub"),
    "volatility-scanner": modulePath(MARKET, "market-scanner-hub"),
    "spread-scanner": modulePath(MARKET, "market-scanner-hub"),
    "market-regime-engine": modulePath(MARKET, "regime-and-sentiment-hub"),
    "market-sentiment": modulePath(MARKET, "regime-and-sentiment-hub"),
    "institutional-bias": modulePath(MARKET, "regime-and-sentiment-hub"),
    "session-monitor": modulePath(MARKET, "regime-and-sentiment-hub"),
    "session-manipulation-tracker": modulePath(MARKET, "regime-and-sentiment-hub"),
    "correlation-matrix": modulePath(MARKET, "liquidity-and-correlation-hub"),
    "liquidity-heatmap": modulePath(MARKET, "liquidity-and-correlation-hub"),
    "currency-strength-meter": modulePath(MARKET, "liquidity-and-correlation-hub"),
    watchlists: modulePath(MARKET, "watchlists-and-alerts"),
    "favorite-assets": modulePath(MARKET, "watchlists-and-alerts"),
    "market-alerts": modulePath(MARKET, "watchlists-and-alerts"),
    "real-time-market-feed": modulePath(MARKET, "watchlists-and-alerts")
  }),

  ...buildModuleAliases(ECON, {
    "economic-calendar": modulePath(ECON, "economic-calendar-hub"),
    "high-impact-news": modulePath(ECON, "economic-calendar-hub"),
    "medium-impact-news": modulePath(ECON, "economic-calendar-hub"),
    "low-impact-news": modulePath(ECON, "economic-calendar-hub"),
    "central-bank-monitor": modulePath(ECON, "macro-monitor-hub"),
    "interest-rate-tracker": modulePath(ECON, "macro-monitor-hub"),
    "inflation-monitor": modulePath(ECON, "macro-monitor-hub"),
    "employment-data": modulePath(ECON, "macro-monitor-hub"),
    "gdp-monitor": modulePath(ECON, "macro-monitor-hub"),
    "macro-dashboard": modulePath(ECON, "macro-monitor-hub"),
    "retail-sentiment": modulePath(ECON, "sentiment-and-positioning-hub"),
    "institutional-sentiment": modulePath(ECON, "sentiment-and-positioning-hub"),
    "news-sentiment-ai": modulePath(ECON, "sentiment-and-positioning-hub"),
    "cot-data": modulePath(ECON, "sentiment-and-positioning-hub"),
    "cot-positioning": modulePath(ECON, "sentiment-and-positioning-hub"),
    "risk-on-risk-off": modulePath(ECON, "sentiment-and-positioning-hub"),
    "fundamental-bias": modulePath(ECON, "sentiment-and-positioning-hub"),
    "event-impact-analysis": modulePath(ECON, "news-risk-hub"),
    "historical-news-analysis": modulePath(ECON, "news-risk-hub"),
    "news-risk-engine": modulePath(ECON, "news-risk-hub")
  }),

  ...buildModuleAliases(DATA, {
    "data-center": modulePath(DATA, "data-platform-hub"),
    "data-warehouse": modulePath(DATA, "data-platform-hub"),
    "data-lake": modulePath(DATA, "data-platform-hub"),
    "data-synchronization": modulePath(DATA, "data-platform-hub"),
    "feature-store": modulePath(DATA, "data-platform-hub"),
    "candle-data": modulePath(DATA, "market-data-hub"),
    "tick-data": modulePath(DATA, "market-data-hub"),
    "spread-data": modulePath(DATA, "market-data-hub"),
    "order-book-data": modulePath(DATA, "market-data-hub"),
    "economic-data": modulePath(DATA, "intelligence-data-hub"),
    "sentiment-data": modulePath(DATA, "intelligence-data-hub"),
    "vision-data": modulePath(DATA, "intelligence-data-hub"),
    "data-quality-monitoring": modulePath(DATA, "data-quality-and-lifecycle-hub"),
    "data-validation": modulePath(DATA, "data-quality-and-lifecycle-hub"),
    "missing-data-detection": modulePath(DATA, "data-quality-and-lifecycle-hub"),
    "data-repair-engine": modulePath(DATA, "data-quality-and-lifecycle-hub"),
    "historical-archives": modulePath(DATA, "data-quality-and-lifecycle-hub"),
    "data-retention": modulePath(DATA, "data-quality-and-lifecycle-hub"),
    "backup-management": modulePath(DATA, "data-quality-and-lifecycle-hub"),
    "data-recovery": modulePath(DATA, "data-quality-and-lifecycle-hub")
  }),

  ...buildModuleAliases(MTF, {
    "top-down-analysis": modulePath(MTF, "multi-timeframe-hub"),
    "weekly-analysis": modulePath(MTF, "multi-timeframe-hub"),
    "daily-analysis": modulePath(MTF, "multi-timeframe-hub"),
    "h4-analysis": modulePath(MTF, "multi-timeframe-hub"),
    "h1-analysis": modulePath(MTF, "multi-timeframe-hub"),
    "m15-analysis": modulePath(MTF, "multi-timeframe-hub"),
    "multi-timeframe-matrix": modulePath(MTF, "multi-timeframe-hub"),
    "timeframe-alignment": modulePath(MTF, "multi-timeframe-hub"),
    "bias-dashboard": modulePath(MTF, "structure-and-bias-hub"),
    "structure-analysis": modulePath(MTF, "structure-and-bias-hub"),
    "trend-analysis": modulePath(MTF, "structure-and-bias-hub"),
    "momentum-analysis": modulePath(MTF, "structure-and-bias-hub"),
    "range-analysis": modulePath(MTF, "structure-and-bias-hub"),
    "breakout-analysis": modulePath(MTF, "pattern-analysis-hub"),
    "reversal-analysis": modulePath(MTF, "pattern-analysis-hub"),
    "liquidity-analysis": modulePath(MTF, "pattern-analysis-hub"),
    "confluence-engine": modulePath(MTF, "pattern-analysis-hub"),
    "analysis-history": modulePath(MTF, "analysis-history-hub"),
    "screenshot-history": modulePath(MTF, "analysis-history-hub"),
    "analysis-replay": modulePath(MTF, "analysis-history-hub")
  }),

  ...buildModuleAliases(VISION, {
    "vision-intelligence-room": modulePath(VISION, "vision-command-hub"),
    "live-chart-feed": modulePath(VISION, "vision-command-hub"),
    "screenshot-capture": modulePath(VISION, "vision-command-hub"),
    "screenshot-archive": modulePath(VISION, "vision-command-hub"),
    "ocr-reader": modulePath(VISION, "chart-detection-hub"),
    "candle-detection": modulePath(VISION, "chart-detection-hub"),
    "pattern-detection": modulePath(VISION, "chart-detection-hub"),
    "order-block-detection": modulePath(VISION, "chart-detection-hub"),
    "fair-value-gap-detection": modulePath(VISION, "chart-detection-hub"),
    "liquidity-detection": modulePath(VISION, "chart-detection-hub"),
    "bos-detection": modulePath(VISION, "chart-detection-hub"),
    "choch-detection": modulePath(VISION, "chart-detection-hub"),
    "trendline-detection": modulePath(VISION, "chart-detection-hub"),
    "support-and-resistance-detection": modulePath(VISION, "chart-detection-hub"),
    "wyckoff-detection": modulePath(VISION, "chart-detection-hub"),
    "premium-and-discount-zones": modulePath(VISION, "chart-detection-hub"),
    "chart-annotation-engine": modulePath(VISION, "annotation-and-scoring-hub"),
    "vision-confidence-scoring": modulePath(VISION, "annotation-and-scoring-hub"),
    "vision-replay": modulePath(VISION, "vision-mlops-hub"),
    "vision-model-monitoring": modulePath(VISION, "vision-mlops-hub"),
    "vision-ai-training": modulePath(VISION, "vision-mlops-hub"),
    "vision-ai-drift-detection": modulePath(VISION, "vision-mlops-hub"),
    "vision-ai-health": modulePath(VISION, "vision-mlops-hub")
  }),

  ...buildModuleAliases(INST, {
    "institutional-intelligence-center": modulePath(INST, "institutional-center"),
    "smart-money-analysis": modulePath(INST, "smart-money-hub"),
    "liquidity-engine": modulePath(INST, "smart-money-hub"),
    "stop-hunt-detection": modulePath(INST, "smart-money-hub"),
    "inducement-detection": modulePath(INST, "smart-money-hub"),
    "order-block-validation": modulePath(INST, "smart-money-hub"),
    "fvg-rebalancing": modulePath(INST, "smart-money-hub"),
    "market-maker-model": modulePath(INST, "smart-money-hub"),
    "session-manipulation": modulePath(INST, "smart-money-hub"),
    "volume-imbalance": modulePath(INST, "smart-money-hub"),
    "vwap-intelligence": modulePath(INST, "institutional-analytics-hub"),
    "institutional-footprints": modulePath(INST, "institutional-analytics-hub"),
    "institutional-trend-bias": modulePath(INST, "institutional-analytics-hub"),
    "institutional-liquidity-map": modulePath(INST, "institutional-analytics-hub"),
    "institutional-risk-bias": modulePath(INST, "institutional-analytics-hub"),
    "smart-money-replay": modulePath(INST, "institutional-analytics-hub"),
    "liquidity-heatmaps": modulePath(INST, "institutional-analytics-hub"),
    "institutional-confluence": modulePath(INST, "institutional-analytics-hub"),
    "institutional-analytics": modulePath(INST, "institutional-analytics-hub")
  }),

  ...buildModuleAliases(STRATEGY, {
    "strategy-command-center": modulePath(STRATEGY, "strategy-command-hub"),
    "strategy-library": modulePath(STRATEGY, "strategy-command-hub"),
    "institutional-strategies": modulePath(STRATEGY, "strategy-catalog-hub"),
    "retail-strategies": modulePath(STRATEGY, "strategy-catalog-hub"),
    "quantitative-strategies": modulePath(STRATEGY, "strategy-catalog-hub"),
    "fundamental-strategies": modulePath(STRATEGY, "strategy-catalog-hub"),
    "scalping-strategies": modulePath(STRATEGY, "strategy-catalog-hub"),
    "swing-strategies": modulePath(STRATEGY, "strategy-catalog-hub"),
    "intraday-strategies": modulePath(STRATEGY, "strategy-catalog-hub"),
    "position-trading-strategies": modulePath(STRATEGY, "strategy-catalog-hub"),
    "strategy-ranking": modulePath(STRATEGY, "strategy-evaluation-hub"),
    "strategy-competition": modulePath(STRATEGY, "strategy-evaluation-hub"),
    "strategy-scoring": modulePath(STRATEGY, "strategy-evaluation-hub"),
    "strategy-performance": modulePath(STRATEGY, "strategy-evaluation-hub"),
    "strategy-confluence": modulePath(STRATEGY, "strategy-evaluation-hub"),
    "strategy-correlation": modulePath(STRATEGY, "strategy-evaluation-hub"),
    "strategy-registry": modulePath(STRATEGY, "strategy-evaluation-hub"),
    "strategy-replay": modulePath(STRATEGY, "strategy-research-hub"),
    "strategy-analytics": modulePath(STRATEGY, "strategy-research-hub"),
    "backtesting-engine": modulePath(STRATEGY, "strategy-research-hub"),
    "walk-forward-testing": modulePath(STRATEGY, "strategy-research-hub"),
    "monte-carlo-testing": modulePath(STRATEGY, "strategy-research-hub"),
    "strategy-optimization": modulePath(STRATEGY, "strategy-research-hub"),
    "strategy-learning": modulePath(STRATEGY, "strategy-research-hub")
  }),

  ...buildModuleAliases(AI, {
    "ai-decision-console": modulePath(AI, "ai-decision-hub"),
    "ai-orchestration-engine": modulePath(AI, "ai-decision-hub"),
    "signal-aggregation": modulePath(AI, "ai-decision-hub"),
    "ai-reasoning": modulePath(AI, "ai-decision-hub"),
    "ai-confidence-engine": modulePath(AI, "ai-decision-hub"),
    "prediction-engine": modulePath(AI, "ai-decision-hub"),
    "market-regime-models": modulePath(AI, "model-registry-hub"),
    "reinforcement-learning": modulePath(AI, "model-registry-hub"),
    "ensemble-models": modulePath(AI, "model-registry-hub"),
    "neural-network-models": modulePath(AI, "model-registry-hub"),
    "forecasting-models": modulePath(AI, "model-registry-hub"),
    "model-registry": modulePath(AI, "model-registry-hub"),
    "model-monitoring": modulePath(AI, "ai-mlops-hub"),
    "model-drift-detection": modulePath(AI, "ai-mlops-hub"),
    "feature-engineering": modulePath(AI, "ai-mlops-hub"),
    "ai-training-pipelines": modulePath(AI, "ai-mlops-hub"),
    "ai-evaluation": modulePath(AI, "ai-mlops-hub"),
    "ai-experiments": modulePath(AI, "ai-mlops-hub"),
    "ai-evolution": modulePath(AI, "ai-mlops-hub"),
    "ai-health-monitoring": modulePath(AI, "ai-mlops-hub"),
    "ai-replay": modulePath(AI, "ai-audit-hub"),
    "ai-explainability": modulePath(AI, "ai-audit-hub"),
    "ai-decision-history": modulePath(AI, "ai-audit-hub")
  }),

  ...buildModuleAliases(QUANT, {
    "probability-engine": modulePath(QUANT, "quant-engines-hub"),
    "monte-carlo-engine": modulePath(QUANT, "quant-engines-hub"),
    "bayesian-engine": modulePath(QUANT, "quant-engines-hub"),
    "volatility-models": modulePath(QUANT, "quant-engines-hub"),
    "correlation-engine": modulePath(QUANT, "quant-engines-hub"),
    "factor-models": modulePath(QUANT, "quant-engines-hub"),
    "portfolio-optimization": modulePath(QUANT, "quant-engines-hub"),
    "risk-models": modulePath(QUANT, "quant-engines-hub"),
    "statistical-arbitrage": modulePath(QUANT, "quant-engines-hub"),
    "quant-analytics": modulePath(QUANT, "quant-analytics-hub"),
    "quant-replay": modulePath(QUANT, "quant-analytics-hub"),
    "quant-learning": modulePath(QUANT, "quant-analytics-hub"),
    "quant-signals": modulePath(QUANT, "quant-analytics-hub"),
    "quant-optimization": modulePath(QUANT, "quant-analytics-hub"),
    "quant-performance": modulePath(QUANT, "quant-analytics-hub")
  }),

  ...buildModuleAliases(RISK, {
    "position-sizing": modulePath(RISK, "exposure-and-sizing-hub"),
    "lot-size-engine": modulePath(RISK, "exposure-and-sizing-hub"),
    "exposure-monitor": modulePath(RISK, "exposure-and-sizing-hub"),
    "correlation-risk": modulePath(RISK, "exposure-and-sizing-hub"),
    "drawdown-monitor": modulePath(RISK, "exposure-and-sizing-hub"),
    "daily-drawdown": modulePath(RISK, "exposure-and-sizing-hub"),
    "overall-drawdown": modulePath(RISK, "exposure-and-sizing-hub"),
    "news-risk-blocker": modulePath(RISK, "risk-blockers-hub"),
    "spread-risk-blocker": modulePath(RISK, "risk-blockers-hub"),
    "volatility-risk-blocker": modulePath(RISK, "risk-blockers-hub"),
    "weekend-protection": modulePath(RISK, "risk-blockers-hub"),
    "kill-switch": modulePath(RISK, "risk-blockers-hub"),
    "risk-events": modulePath(RISK, "compliance-and-reports-hub"),
    "risk-heatmaps": modulePath(RISK, "compliance-and-reports-hub"),
    "risk-replay": modulePath(RISK, "compliance-and-reports-hub"),
    "compliance-engine": modulePath(RISK, "compliance-and-reports-hub"),
    "compliance-alerts": modulePath(RISK, "compliance-and-reports-hub"),
    "rule-violations": modulePath(RISK, "compliance-and-reports-hub"),
    "risk-reports": modulePath(RISK, "compliance-and-reports-hub"),
    "prop-firm-reports": modulePath(RISK, "compliance-and-reports-hub")
  }),

  ...buildModuleAliases(EXEC_CENTER, {
    "pre-execution-validation": modulePath(EXEC_CENTER, "order-lifecycle-hub"),
    "order-validation": modulePath(EXEC_CENTER, "order-lifecycle-hub"),
    "order-management": modulePath(EXEC_CENTER, "order-lifecycle-hub"),
    "pending-orders": modulePath(EXEC_CENTER, "order-lifecycle-hub"),
    "open-orders": modulePath(EXEC_CENTER, "order-lifecycle-hub"),
    "broker-api-execution": modulePath(EXEC_CENTER, "execution-controls-hub"),
    "mt5-execution": mt5("order-router"),
    "gui-fallback-execution": modulePath(EXEC_CENTER, "execution-controls-hub"),
    "retry-engine": modulePath(EXEC_CENTER, "execution-controls-hub"),
    "slippage-control": mt5("slippage-monitor"),
    "spread-control": mt5("slippage-monitor"),
    "execution-queue": mt5("execution-queue"),
    "execution-replay": mt5("execution-logs"),
    "execution-audit": mt5("execution-logs"),
    "execution-analytics": mt5("execution-logs"),
    "execution-latency": mt5("slippage-monitor"),
    "execution-logs": mt5("execution-logs"),
    "trade-confirmation": mt5("execution-logs")
  }),

  ...buildModuleAliases(TRADE, {
    "active-trades": modulePath(TRADE, "trade-desk-hub"),
    "closed-trades": modulePath(TRADE, "trade-desk-hub"),
    "trade-lifecycle": modulePath(TRADE, "trade-desk-hub"),
    "trade-management": modulePath(TRADE, "trade-desk-hub"),
    "breakeven-engine": modulePath(TRADE, "trade-automation-hub"),
    "trailing-stop-engine": modulePath(TRADE, "trade-automation-hub"),
    "partial-close-engine": modulePath(TRADE, "trade-automation-hub"),
    "pnl-analysis": modulePath(TRADE, "trade-analytics-hub"),
    "trade-analytics": modulePath(TRADE, "trade-analytics-hub"),
    "trade-history": modulePath(TRADE, "trade-analytics-hub"),
    "trade-performance": modulePath(TRADE, "trade-analytics-hub"),
    "trade-heatmaps": modulePath(TRADE, "trade-analytics-hub"),
    "trade-replay": modulePath(TRADE, "trade-journal-hub"),
    "trade-journal": modulePath(TRADE, "trade-journal-hub"),
    "trade-psychology": modulePath(TRADE, "trade-journal-hub"),
    "trade-screenshots": modulePath(TRADE, "trade-journal-hub"),
    "trade-comments": modulePath(TRADE, "trade-journal-hub"),
    "trade-ai-analysis": modulePath(TRADE, "trade-journal-hub"),
    "trade-reports": modulePath(TRADE, "trade-journal-hub")
  }),

  ...buildModuleAliases(PORTFOLIO_RPT, {
    "portfolio-dashboard": modulePath(ACCOUNTS, "portfolio-dashboard"),
    "asset-allocation": modulePath(ACCOUNTS, "portfolio-dashboard"),
    "correlation-dashboard": modulePath(ACCOUNTS, "portfolio-dashboard"),
    "exposure-dashboard": modulePath(ACCOUNTS, "risk-and-exposure"),
    "daily-reports": modulePath(PORTFOLIO_RPT, "reports-hub"),
    "weekly-reports": modulePath(PORTFOLIO_RPT, "reports-hub"),
    "monthly-reports": modulePath(PORTFOLIO_RPT, "reports-hub"),
    "performance-reports": modulePath(PORTFOLIO_RPT, "reports-hub"),
    "ai-reports": modulePath(PORTFOLIO_RPT, "reports-hub"),
    "execution-reports": modulePath(PORTFOLIO_RPT, "reports-hub"),
    "risk-reports": modulePath(PORTFOLIO_RPT, "reports-hub"),
    "prop-firm-reports": modulePath(PORTFOLIO_RPT, "reports-hub"),
    "behavioral-analytics": modulePath(PORTFOLIO_RPT, "behavioral-intelligence-hub"),
    "trading-psychology-analytics": modulePath(PORTFOLIO_RPT, "behavioral-intelligence-hub"),
    "win-rate-analytics": modulePath(PORTFOLIO_RPT, "behavioral-intelligence-hub"),
    "profit-factor-analytics": modulePath(PORTFOLIO_RPT, "behavioral-intelligence-hub"),
    "sharpe-ratio-analytics": modulePath(PORTFOLIO_RPT, "behavioral-intelligence-hub"),
    "expectancy-analytics": modulePath(PORTFOLIO_RPT, "behavioral-intelligence-hub"),
    "behavioral-replay": modulePath(PORTFOLIO_RPT, "behavioral-intelligence-hub")
  }),

  ...buildModuleAliases(MONITOR, {
    "infrastructure-health": modulePath(MONITOR, "infrastructure-health-hub"),
    "api-health": modulePath(MONITOR, "infrastructure-health-hub"),
    "database-health": modulePath(MONITOR, "infrastructure-health-hub"),
    "queue-health": modulePath(MONITOR, "infrastructure-health-hub"),
    "worker-health": modulePath(MONITOR, "infrastructure-health-hub"),
    "vps-health": modulePath(MONITOR, "infrastructure-health-hub"),
    "ai-health": modulePath(MONITOR, "trading-stack-health-hub"),
    "vision-health": modulePath(MONITOR, "trading-stack-health-hub"),
    "broker-health": modulePath(MONITOR, "trading-stack-health-hub"),
    "mt5-health": modulePath(MONITOR, "trading-stack-health-hub"),
    "alerts-center": modulePath(MONITOR, "incidents-and-recovery-hub"),
    "incident-management": modulePath(MONITOR, "incidents-and-recovery-hub"),
    "recovery-actions": modulePath(MONITOR, "incidents-and-recovery-hub"),
    "self-healing-engine": modulePath(MONITOR, "incidents-and-recovery-hub"),
    "restart-services": modulePath(MONITOR, "incidents-and-recovery-hub"),
    "auto-recovery": modulePath(MONITOR, "incidents-and-recovery-hub"),
    "reconnect-broker": modulePath(MONITOR, "incidents-and-recovery-hub"),
    "requeue-jobs": modulePath(MONITOR, "incidents-and-recovery-hub"),
    "failure-analytics": modulePath(MONITOR, "incidents-and-recovery-hub"),
    "monitoring-logs": modulePath(MONITOR, "incidents-and-recovery-hub"),
    "system-diagnostics": modulePath(MONITOR, "incidents-and-recovery-hub")
  }),

  ...buildModuleAliases(LEARNING, {
    "learning-center": modulePath(LEARNING, "learning-center-hub"),
    "optimization-center": modulePath(LEARNING, "optimization-lab-hub"),
    "ai-training": modulePath(LEARNING, "learning-center-hub"),
    "strategy-learning": modulePath(LEARNING, "learning-center-hub"),
    "quant-learning": modulePath(LEARNING, "learning-center-hub"),
    "vision-learning": modulePath(LEARNING, "learning-center-hub"),
    "performance-learning": modulePath(LEARNING, "learning-center-hub"),
    "genetic-optimization": modulePath(LEARNING, "optimization-lab-hub"),
    "bayesian-optimization": modulePath(LEARNING, "optimization-lab-hub"),
    "reinforcement-optimization": modulePath(LEARNING, "optimization-lab-hub"),
    "champion-challenger": modulePath(LEARNING, "optimization-lab-hub"),
    "hyperparameter-tuning": modulePath(LEARNING, "optimization-lab-hub"),
    "optimization-replay": modulePath(LEARNING, "optimization-lab-hub"),
    "learning-analytics": modulePath(LEARNING, "learning-center-hub"),
    "model-evolution": modulePath(LEARNING, "evolution-and-history-hub"),
    "strategy-evolution": modulePath(LEARNING, "evolution-and-history-hub"),
    "optimization-history": modulePath(LEARNING, "evolution-and-history-hub"),
    "learning-history": modulePath(LEARNING, "evolution-and-history-hub"),
    "continuous-improvement": modulePath(LEARNING, "optimization-lab-hub"),
    "ai-evolution-dashboard": modulePath(LEARNING, "evolution-and-history-hub")
  }),

  ...buildModuleAliases(REPORTS, {
    "trading-reports": modulePath(REPORTS, "reports-center"),
    "ai-reports": modulePath(REPORTS, "reports-center"),
    "execution-reports": modulePath(REPORTS, "reports-center"),
    "vision-reports": modulePath(REPORTS, "reports-center"),
    "risk-reports": modulePath(REPORTS, "reports-center"),
    "portfolio-reports": modulePath(REPORTS, "reports-center"),
    "prop-firm-reports": modulePath(REPORTS, "reports-center"),
    "audit-reports": modulePath(REPORTS, "reports-center"),
    "performance-analytics": modulePath(REPORTS, "analytics-hub"),
    "system-analytics": modulePath(REPORTS, "analytics-hub"),
    "workflow-analytics": modulePath(REPORTS, "analytics-hub"),
    "strategy-analytics": modulePath(REPORTS, "analytics-hub"),
    "market-analytics": modulePath(REPORTS, "analytics-hub"),
    "historical-analytics": modulePath(REPORTS, "analytics-hub"),
    "export-reports": modulePath(REPORTS, "report-tools-hub"),
    "scheduled-reports": modulePath(REPORTS, "report-tools-hub"),
    "report-builder": modulePath(REPORTS, "report-tools-hub"),
    "analytics-dashboard": modulePath(REPORTS, "report-tools-hub")
  }),

  ...buildModuleAliases(SETTINGS, {
    "user-profile": modulePath(SETTINGS, "profile-and-security-hub"),
    security: modulePath(SETTINGS, "profile-and-security-hub"),
    privacy: modulePath(SETTINGS, "profile-and-security-hub"),
    "device-management": modulePath(SETTINGS, "profile-and-security-hub"),
    "session-management": modulePath(SETTINGS, "profile-and-security-hub"),
    appearance: modulePath(SETTINGS, "preferences-hub"),
    "theme-configuration": modulePath(SETTINGS, "preferences-hub"),
    notifications: modulePath(SETTINGS, "preferences-hub"),
    "language-settings": modulePath(SETTINGS, "preferences-hub"),
    "timezone-settings": modulePath(SETTINGS, "preferences-hub"),
    "ai-preferences": modulePath(SETTINGS, "preferences-hub"),
    "strategy-preferences": modulePath(SETTINGS, "preferences-hub"),
    "risk-preferences": modulePath(SETTINGS, "preferences-hub"),
    "execution-preferences": modulePath(SETTINGS, "preferences-hub"),
    "workspace-layouts": modulePath(SETTINGS, "workspace-hub"),
    "dashboard-widgets": modulePath(SETTINGS, "workspace-hub"),
    "personalization-profiles": modulePath(SETTINGS, "workspace-hub"),
    "integration-settings": modulePath(SETTINGS, "integration-settings-hub"),
    "backup-settings": modulePath(SETTINGS, "integration-settings-hub")
  })
};
