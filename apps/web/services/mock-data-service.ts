import type { WorkflowStage } from "@cacsms-nexus/types/workflow";

export const mockWorkflowStages: WorkflowStage[] = [
  {
    stageNumber: 1,
    title: "Human Administration",
    description: "Executive controls, approvals, policies, and platform oversight.",
    status: "Operational",
    confidence: "98%",
    latency: "12ms",
    health: "Nominal",
    colorType: "blue"
  },
  {
    stageNumber: 2,
    title: "Infrastructure Validation",
    description: "Environment readiness, connectivity, secrets, and runtime checks.",
    status: "Running",
    confidence: "96%",
    latency: "24ms",
    health: "Stable",
    colorType: "green"
  },
  {
    stageNumber: 3,
    title: "Autonomous Computer Operation",
    description: "Reserved desktop automation lane for future supervised control.",
    status: "Pending",
    confidence: "72%",
    latency: "140ms",
    health: "Watch",
    colorType: "teal"
  },
  {
    stageNumber: 4,
    title: "MT5/Broker Control",
    description: "Placeholder terminal and broker command boundary.",
    status: "Offline",
    confidence: "0%",
    latency: "N/A",
    health: "Offline",
    colorType: "gray"
  },
  {
    stageNumber: 5,
    title: "Market Data Acquisition",
    description: "Future ingestion lane for market prices, depth, and feeds.",
    status: "Analyzing",
    confidence: "89%",
    latency: "42ms",
    health: "Stable",
    colorType: "blue"
  },
  {
    stageNumber: 6,
    title: "Data Engineering",
    description: "Feature preparation, cleansing, normalization, and lineage.",
    status: "Running",
    confidence: "91%",
    latency: "58ms",
    health: "Nominal",
    colorType: "indigo"
  },
  {
    stageNumber: 7,
    title: "Market Regime Classification",
    description: "Future regime maps for trend, volatility, and structure.",
    status: "Analyzing",
    confidence: "84%",
    latency: "86ms",
    health: "Stable",
    colorType: "purple"
  },
  {
    stageNumber: 8,
    title: "Multi-Timeframe Analysis",
    description: "Reserved multi-horizon intelligence and confluence lane.",
    status: "Running",
    confidence: "88%",
    latency: "63ms",
    health: "Nominal",
    colorType: "teal"
  },
  {
    stageNumber: 9,
    title: "Cacsms Vision AI",
    description: "Placeholder for chart, terminal, and screen-state vision.",
    status: "Pending",
    confidence: "67%",
    latency: "N/A",
    health: "Watch",
    colorType: "purple"
  },
  {
    stageNumber: 10,
    title: "Institutional Intelligence",
    description: "Liquidity, session behavior, and institutional context.",
    status: "Analyzing",
    confidence: "86%",
    latency: "74ms",
    health: "Stable",
    colorType: "teal"
  },
  {
    stageNumber: 11,
    title: "Retail Strategy Intelligence",
    description: "Future signal comparison and retail behavior lens.",
    status: "Pending",
    confidence: "64%",
    latency: "N/A",
    health: "Watch",
    colorType: "pink"
  },
  {
    stageNumber: 12,
    title: "Quantitative Intelligence",
    description: "Future quantitative scoring, factor review, and model signals.",
    status: "Analyzing",
    confidence: "82%",
    latency: "93ms",
    health: "Stable",
    colorType: "indigo"
  },
  {
    stageNumber: 13,
    title: "Fundamental & Sentiment Intelligence",
    description: "News, macro, sentiment, and event-context placeholder.",
    status: "Warning",
    confidence: "59%",
    latency: "210ms",
    health: "Degraded",
    colorType: "orange"
  },
  {
    stageNumber: 14,
    title: "AI Strategy Orchestration",
    description: "Future strategy selection and ensemble coordination layer.",
    status: "Learning",
    confidence: "78%",
    latency: "124ms",
    health: "Stable",
    colorType: "pink"
  },
  {
    stageNumber: 15,
    title: "AI Decision Engine",
    description: "Reserved decision boundary for future reasoning systems.",
    status: "Pending",
    confidence: "71%",
    latency: "N/A",
    health: "Watch",
    colorType: "purple"
  },
  {
    stageNumber: 16,
    title: "Risk Governance",
    description: "Policy, exposure, drawdown, and approval guardrails.",
    status: "Approved",
    confidence: "97%",
    latency: "18ms",
    health: "Nominal",
    colorType: "green"
  },
  {
    stageNumber: 17,
    title: "Pre-Execution Validation",
    description: "Placeholder checks before any future execution action.",
    status: "Blocked",
    confidence: "0%",
    latency: "N/A",
    health: "Blocked",
    colorType: "red"
  },
  {
    stageNumber: 18,
    title: "Trade Execution",
    description: "Execution lane intentionally disabled in this foundation phase.",
    status: "Offline",
    confidence: "0%",
    latency: "N/A",
    health: "Offline",
    colorType: "gray"
  },
  {
    stageNumber: 19,
    title: "Active Trade Management",
    description: "Future position supervision, adjustment, and exit handling.",
    status: "Offline",
    confidence: "0%",
    latency: "N/A",
    health: "Offline",
    colorType: "gray"
  },
  {
    stageNumber: 20,
    title: "Reporting & Explainability",
    description: "Future audit, explanations, attribution, and operator reporting.",
    status: "Running",
    confidence: "92%",
    latency: "46ms",
    health: "Nominal",
    colorType: "blue"
  },
  {
    stageNumber: 21,
    title: "Learning & Optimization",
    description: "Future feedback loops, model review, and optimization backlog.",
    status: "Learning",
    confidence: "76%",
    latency: "156ms",
    health: "Stable",
    colorType: "purple"
  },
  {
    stageNumber: 22,
    title: "Monitoring & Self-Healing",
    description: "Operational telemetry, recovery playbooks, and incident lanes.",
    status: "Recovering",
    confidence: "83%",
    latency: "88ms",
    health: "Watch",
    colorType: "orange"
  },
  {
    stageNumber: 23,
    title: "Continuous Autonomous Loop",
    description: "Closed-loop governance placeholder for future autonomy.",
    status: "Critical",
    confidence: "41%",
    latency: "N/A",
    health: "Degraded",
    colorType: "red"
  }
];

export function getMockWorkflowStages() {
  return mockWorkflowStages;
}
