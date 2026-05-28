import { analyzeChart } from "@/modules/mt5-infrastructure-and-broker-connectivity/chart-control/algorithms/chart-control.algorithms";
import type { ChartInstrument, Timeframe } from "@/modules/mt5-infrastructure-and-broker-connectivity/chart-control/types/chart-control.types";
import type { TerminalStatusRecord } from "@/modules/mt5-infrastructure-and-broker-connectivity/terminal-status/types/terminal-status.types";
import type {
  AutomationStep,
  AutomationStepType,
  AutomationTone,
  DesktopAutomationHubResponse,
  DesktopOperatorCommand,
  SymbolAutomationOption,
  TerminalAutomationTarget,
  TopDownAnalysisRun
} from "../types/desktop-automation-hub.types";
import { TOP_DOWN_TIMEFRAMES } from "../types/desktop-automation-hub.types";
import { AUTOMATION_SYMBOL_CATALOG } from "../types/desktop-automation-hub.types";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function toneFromScore(score: number): AutomationTone {
  if (score >= 85) return "Healthy";
  if (score >= 70) return "Watch";
  if (score >= 50) return "Degraded";
  if (score >= 25) return "Critical";
  return "Failed";
}

export function normalizeSymbol(symbol: string) {
  return symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function getTerminalAutomationBlockers(terminal: TerminalStatusRecord): string[] {
  const blockers: string[] = [];
  if (terminal.maintenanceMode) blockers.push("Maintenance mode is enabled.");
  if (terminal.processStatus !== "Running") {
    blockers.push(`MT5 process is ${terminal.processStatus.toLowerCase()}; start the terminal on ${terminal.hostMachine}.`);
  }
  return blockers;
}

export function terminalAutomationReady(terminal: TerminalStatusRecord) {
  return getTerminalAutomationBlockers(terminal).length === 0;
}

export function buildTerminalTargets(terminals: TerminalStatusRecord[]): TerminalAutomationTarget[] {
  return terminals
    .map((terminal) => {
      const blockers = getTerminalAutomationBlockers(terminal);
      const ready = blockers.length === 0;
      return {
        terminalId: terminal.terminalId,
        terminalName: terminal.terminalName,
        hostMachine: terminal.hostMachine,
        brokerName: terminal.brokerName,
        accountLogin: terminal.accountLogin,
        processStatus: terminal.processStatus,
        automationReady: ready,
        automationBlockers: blockers,
        status: ready ? "Healthy" : terminal.processStatus === "Running" ? "Watch" : "Critical"
      };
    })
    .sort((left, right) => Number(right.automationReady) - Number(left.automationReady));
}

export function buildSymbolOptions(instruments: ChartInstrument[], brokerNames: string[] = []): SymbolAutomationOption[] {
  const grouped = new Map<string, SymbolAutomationOption>();
  for (const instrument of instruments) {
    const normalizedSymbol = normalizeSymbol(instrument.symbol);
    const existing = grouped.get(normalizedSymbol) ?? {
      symbol: instrument.symbol,
      normalizedSymbol,
      brokers: [],
      instrumentIds: []
    };
    if (!existing.brokers.includes(instrument.brokerName)) existing.brokers.push(instrument.brokerName);
    existing.instrumentIds.push(instrument.id);
    grouped.set(normalizedSymbol, existing);
  }

  for (const brokerName of [...new Set(brokerNames.filter(Boolean))]) {
    for (const symbol of AUTOMATION_SYMBOL_CATALOG) {
      const normalizedSymbol = normalizeSymbol(symbol);
      const existing = grouped.get(normalizedSymbol) ?? {
        symbol,
        normalizedSymbol,
        brokers: [],
        instrumentIds: []
      };
      if (!existing.brokers.includes(brokerName)) existing.brokers.push(brokerName);
      grouped.set(normalizedSymbol, existing);
    }
  }

  return [...grouped.values()].sort((left, right) => left.symbol.localeCompare(right.symbol));
}

export function resolveInstrumentForSymbol(instruments: ChartInstrument[], symbol: string, brokerName: string) {
  const normalized = normalizeSymbol(symbol);
  return (
    instruments.find((instrument) => normalizeSymbol(instrument.symbol) === normalized && instrument.brokerName === brokerName) ??
    instruments.find((instrument) => normalizeSymbol(instrument.symbol) === normalized)
  );
}

export function buildTopDownSteps(timeframes: Timeframe[]): Array<{ type: AutomationStepType; title: string; timeframe: Timeframe | null }> {
  const steps: Array<{ type: AutomationStepType; title: string; timeframe: Timeframe | null }> = [
    { type: "open_mt5_chart", title: "Open MT5 chart window", timeframe: null },
    { type: "select_symbol", title: "Select trading pair in chart", timeframe: null }
  ];

  for (const timeframe of timeframes) {
    steps.push(
      { type: "select_timeframe", title: `Switch chart to ${timeframe}`, timeframe },
      { type: "capture_screenshot", title: `Capture ${timeframe} screenshot`, timeframe },
      { type: "queue_ai_analysis", title: `Queue ${timeframe} frame for AI analysis`, timeframe }
    );
  }

  return steps;
}

export function createRunSkeleton(input: {
  runId: string;
  symbol: string;
  terminal: TerminalStatusRecord;
  instrumentId: string | null;
  timeframes: Timeframe[];
  role: DesktopAutomationHubResponse["permissions"]["role"];
}): TopDownAnalysisRun {
  const steps = buildTopDownSteps(input.timeframes).map((step, index) => ({
    id: `${input.runId}-step-${index + 1}`,
    type: step.type,
    title: step.title,
    timeframe: step.timeframe,
    status: "Pending" as AutomationTone,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    detail: "Awaiting autonomous execution.",
    snapshotId: null,
    aiAnalysis: null,
    operatorCommands: [] as DesktopOperatorCommand[],
    error: null
  }));

  return {
    id: input.runId,
    symbol: input.symbol,
    normalizedSymbol: normalizeSymbol(input.symbol),
    terminalId: input.terminal.terminalId,
    terminalName: input.terminal.terminalName,
    hostMachine: input.terminal.hostMachine,
    brokerName: input.terminal.brokerName,
    instrumentId: input.instrumentId,
    timeframes: input.timeframes,
    status: "Queued",
    currentStepId: steps[0]?.id ?? null,
    steps,
    screenshotsCaptured: 0,
    aiAnalysisQueued: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    initiatedBy: input.role,
    summary: `Top-down analysis queued for ${input.symbol} on ${input.terminal.terminalName}.`
  };
}

export function validateTopDownRun(input: {
  terminal: TerminalStatusRecord | undefined;
  instrument: ChartInstrument | undefined;
  symbol: string;
  timeframes: Timeframe[];
}) {
  if (!input.terminal) throw new Error("Terminal not found for automation run.");
  if (!terminalAutomationReady(input.terminal)) {
    const blockers = getTerminalAutomationBlockers(input.terminal);
    throw new Error(
      `${input.terminal.terminalName} is not ready for desktop automation.${blockers.length ? ` ${blockers.join(" ")}` : ""}`
    );
  }
  if (!input.instrument) {
    throw new Error(
      `Symbol ${input.symbol} could not be prepared for ${input.terminal?.brokerName ?? "the selected broker"}. Choose a supported pair or sync broker symbols first.`
    );
  }
  for (const timeframe of input.timeframes) {
    if (!input.instrument.availableTimeframes.includes(timeframe)) {
      throw new Error(`Timeframe ${timeframe} is not available for ${input.instrument.symbol}.`);
    }
  }
}

export function buildOperatorCommand(input: {
  runId: string;
  stepId: string;
  terminal: TerminalStatusRecord;
  commandType: DesktopOperatorCommand["commandType"];
  payload: DesktopOperatorCommand["payload"];
  detail: string;
}): DesktopOperatorCommand {
  return {
    id: `cmd-${input.stepId}-${input.commandType.toLowerCase()}`,
    runId: input.runId,
    stepId: input.stepId,
    commandType: input.commandType,
    terminalId: input.terminal.terminalId,
    hostMachine: input.terminal.hostMachine,
    payload: input.payload,
    status: "Executed",
    executedAt: new Date().toISOString(),
    detail: input.detail
  };
}

export function operatorReadinessScore(terminals: TerminalAutomationTarget[], activeRun: TopDownAnalysisRun | null) {
  const ready = terminals.filter((terminal) => terminal.automationReady).length;
  const ratio = terminals.length ? (ready / terminals.length) * 100 : 0;
  const penalty = activeRun?.status === "Failed" ? 20 : 0;
  const score = clamp(Math.round(ratio - penalty), 0, 100);
  const rating = score >= 90 ? "Excellent" : score >= 75 ? "Healthy" : score >= 60 ? "Degraded" : score >= 40 ? "High Risk" : "Critical";
  return { score, rating, factors: [`Ready terminals: ${ready}/${terminals.length}`] };
}

export function buildAutomationKpis(
  terminals: TerminalAutomationTarget[],
  runs: TopDownAnalysisRun[],
  activeRun: TopDownAnalysisRun | null,
  readiness: DesktopAutomationHubResponse["meta"]["operatorReadiness"],
  timestamp: string
) {
  const completed = runs.filter((run) => run.status === "Completed").length;
  const failed = runs.filter((run) => run.status === "Failed").length;
  const screenshots = runs.reduce((sum, run) => sum + run.screenshotsCaptured, 0);

  return [
    { label: "Operator Readiness", value: `${readiness.score}/100`, status: toneFromScore(readiness.score), detail: readiness.rating, updatedAt: timestamp },
    { label: "Automation Targets", value: String(terminals.length), status: terminals.length ? "Healthy" : "Watch", detail: "MT5 terminals in scope", updatedAt: timestamp },
    { label: "Ready Terminals", value: String(terminals.filter((terminal) => terminal.automationReady).length), status: "Healthy", detail: "Can run without human input", updatedAt: timestamp },
    { label: "Active Run", value: activeRun ? activeRun.symbol : "None", status: activeRun ? "Running" : "Pending", detail: activeRun ? activeRun.status : "Idle", updatedAt: timestamp },
    { label: "Completed Runs", value: String(completed), status: completed ? "Completed" : "Pending", detail: "Successful top-down workflows", updatedAt: timestamp },
    { label: "Failed Runs", value: String(failed), status: failed ? "Failed" : "Healthy", detail: "Runs requiring operator review", updatedAt: timestamp },
    { label: "AI Captures", value: String(screenshots), status: screenshots ? "Healthy" : "Pending", detail: "Screenshots queued for AI analysis", updatedAt: timestamp },
    { label: "Top-Down Frames", value: String(TOP_DOWN_TIMEFRAMES.length), status: "Healthy", detail: TOP_DOWN_TIMEFRAMES.join(" → "), updatedAt: timestamp }
  ] satisfies DesktopAutomationHubResponse["kpis"];
}

export function summarizeRun(run: TopDownAnalysisRun) {
  if (run.status === "Completed") {
    return `Captured ${run.screenshotsCaptured} timeframe screenshots for ${run.symbol}; ${run.aiAnalysisQueued} frames queued for AI analysis.`;
  }
  if (run.status === "Failed") {
    const failedStep = run.steps.find((step) => step.status === "Failed");
    return failedStep ? `Failed at ${failedStep.title}: ${failedStep.error ?? failedStep.detail}` : "Automation run failed.";
  }
  if (run.status === "Running") {
    const current = run.steps.find((step) => step.id === run.currentStepId);
    return current ? `Running ${current.title}…` : "Automation run in progress.";
  }
  return run.summary;
}

export function attachAiAnalysisToStep(step: AutomationStep, instrument: ChartInstrument) {
  step.aiAnalysis = analyzeChart(instrument, step.timeframe ?? instrument.timeframe);
  step.detail = `AI analysis queued: ${step.aiAnalysis.trend} trend, RSI ${step.aiAnalysis.rsi}, volatility ${step.aiAnalysis.volatilityPercent}%.`;
}

export { TOP_DOWN_TIMEFRAMES };
