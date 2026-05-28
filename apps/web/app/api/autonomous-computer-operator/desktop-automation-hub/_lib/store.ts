import type { Mt5Role } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import type { Timeframe } from "@/modules/mt5-infrastructure-and-broker-connectivity/chart-control/types/chart-control.types";
import {
  attachAiAnalysisToStep,
  buildAutomationKpis,
  buildOperatorCommand,
  buildSymbolOptions,
  buildTerminalTargets,
  createRunSkeleton,
  operatorReadinessScore,
  resolveInstrumentForSymbol,
  summarizeRun,
  validateTopDownRun
} from "@/modules/autonomous-computer-operator/desktop-automation-hub/algorithms/top-down-analysis.algorithms";
import type {
  AutomationStep,
  DesktopAutomationHubResponse,
  TopDownAnalysisInput,
  TopDownAnalysisRun
} from "@/modules/autonomous-computer-operator/desktop-automation-hub/types/desktop-automation-hub.types";
import { TOP_DOWN_TIMEFRAMES as DEFAULT_TIMEFRAMES } from "@/modules/autonomous-computer-operator/desktop-automation-hub/types/desktop-automation-hub.types";
import { resolveMt5Role } from "../../../mt5/_lib/access";

type DesktopAutomationState = {
  runs: TopDownAnalysisRun[];
  activeRunId: string | null;
  autonomousMode: boolean;
  lastCompletedAt: string | null;
};

const state: DesktopAutomationState = {
  runs: [],
  activeRunId: null,
  autonomousMode: true,
  lastCompletedAt: null
};

export function resetDesktopAutomationState(override?: Partial<DesktopAutomationState>) {
  state.runs = override?.runs ?? [];
  state.activeRunId = override?.activeRunId ?? null;
  state.autonomousMode = override?.autonomousMode ?? true;
  state.lastCompletedAt = override?.lastCompletedAt ?? null;
}

export function desktopAutomationHubRole(request?: Request): Mt5Role {
  return resolveMt5Role(request);
}

const permissions: Record<"start" | "cancel" | "view", Mt5Role[]> = {
  start: ["Super Admin", "Infrastructure Admin", "Trading Admin"],
  cancel: ["Super Admin", "Infrastructure Admin", "Trading Admin"],
  view: ["Super Admin", "Infrastructure Admin", "Trading Admin", "Risk Manager", "Analyst"]
};

function authorize(role: Mt5Role, action: keyof typeof permissions) {
  if (!permissions[action].includes(role)) {
    throw new Error(`Role "${role}" is not authorized to ${action} desktop automation.`);
  }
}

async function loadContext(role: Mt5Role) {
  const [{ buildTerminalStatusResponse }, { buildChartControlResponse, changeTimeframe, captureSnapshot, applyLayout, ensureChartInstrument }] =
    await Promise.all([
      import("../../../mt5/terminal-status/_lib/store"),
      import("../../../mt5/chart-control/_lib/store")
    ]);

  const terminalStatus = buildTerminalStatusResponse(role);
  const chartControl = buildChartControlResponse(role);
  return { terminalStatus, chartControl, changeTimeframe, captureSnapshot, applyLayout, ensureChartInstrument };
}

function runById(runId: string) {
  const run = state.runs.find((entry) => entry.id === runId);
  if (!run) throw new Error("Automation run not found.");
  return run;
}

function activeRun() {
  return state.activeRunId ? state.runs.find((run) => run.id === state.activeRunId) ?? null : null;
}

async function executeStep(
  run: TopDownAnalysisRun,
  step: AutomationStep,
  deps: Awaited<ReturnType<typeof loadContext>>,
  role: Mt5Role,
  request?: Request
) {
  const terminal = deps.terminalStatus.terminals.find((item) => item.terminalId === run.terminalId);
  if (!terminal) throw new Error("Terminal no longer available for automation run.");

  const instrument =
    (run.instrumentId ? deps.chartControl.instruments.find((item) => item.id === run.instrumentId) : undefined) ??
    resolveInstrumentForSymbol(deps.chartControl.instruments, run.symbol, run.brokerName);
  if (!instrument && step.type !== "open_mt5_chart") {
    throw new Error("Chart instrument unavailable during automation run.");
  }

  step.status = "Running";
  step.startedAt = new Date().toISOString();
  run.currentStepId = step.id;
  run.status = "Running";

  const started = Date.now();

  try {
    if (step.type === "open_mt5_chart") {
      step.operatorCommands.push(
        buildOperatorCommand({
          runId: run.id,
          stepId: step.id,
          terminal,
          commandType: "FocusWindow",
          payload: { terminalPath: terminal.terminalPath, processId: terminal.processId ?? 0 },
          detail: "Focus MT5 terminal window on execution host."
        }),
        buildOperatorCommand({
          runId: run.id,
          stepId: step.id,
          terminal,
          commandType: "ChartOpen",
          payload: { accountLogin: terminal.accountLogin, brokerName: terminal.brokerName },
          detail: "Open chart workspace without human input."
        })
      );
      const activeLayout = deps.chartControl.layouts.find((layout) => layout.active) ?? deps.chartControl.layouts[0];
      if (activeLayout) {
        deps.applyLayout(activeLayout.id, role, true, request);
      }
      step.detail = `MT5 chart opened on ${terminal.hostMachine} for ${terminal.terminalName}.`;
    }

    if (step.type === "select_symbol") {
      if (!instrument) throw new Error("Instrument missing for symbol selection.");
      run.instrumentId = instrument.id;
      step.operatorCommands.push(
        buildOperatorCommand({
          runId: run.id,
          stepId: step.id,
          terminal,
          commandType: "SymbolSelect",
          payload: { symbol: instrument.symbol, normalizedSymbol: run.normalizedSymbol, brokerName: instrument.brokerName },
          detail: `Select ${instrument.symbol} in Market Watch and active chart.`
        })
      );
      step.detail = `${instrument.symbol} selected on ${instrument.brokerName} chart workspace.`;
    }

    if (step.type === "select_timeframe") {
      if (!instrument || !step.timeframe) throw new Error("Timeframe step misconfigured.");
      deps.changeTimeframe(instrument.id, step.timeframe, role, true, request);
      step.operatorCommands.push(
        buildOperatorCommand({
          runId: run.id,
          stepId: step.id,
          terminal,
          commandType: "TimeframeSelect",
          payload: { symbol: instrument.symbol, timeframe: step.timeframe },
          detail: `Autonomously switch chart to ${step.timeframe}.`
        })
      );
      step.detail = `${instrument.symbol} chart switched to ${step.timeframe}.`;
    }

    if (step.type === "capture_screenshot") {
      if (!instrument || !step.timeframe) throw new Error("Screenshot step misconfigured.");
      const snapshot = deps.captureSnapshot(
        instrument.id,
        `Top-down ${run.symbol} ${step.timeframe} capture for AI analysis`,
        role,
        true,
        request
      );
      step.snapshotId = snapshot.id;
      run.screenshotsCaptured += 1;
      step.operatorCommands.push(
        buildOperatorCommand({
          runId: run.id,
          stepId: step.id,
          terminal,
          commandType: "ScreenshotCapture",
          payload: { symbol: snapshot.symbol, timeframe: snapshot.timeframe, snapshotId: snapshot.id },
          detail: `Screenshot captured for ${snapshot.symbol} ${snapshot.timeframe}.`
        })
      );
      step.detail = `Screenshot ${snapshot.id} captured for ${snapshot.symbol} ${snapshot.timeframe}.`;
    }

    if (step.type === "queue_ai_analysis") {
      if (!instrument) throw new Error("Instrument missing for AI analysis.");
      attachAiAnalysisToStep(step, instrument);
      run.aiAnalysisQueued += 1;
    }

    step.status = "Completed";
    step.completedAt = new Date().toISOString();
    step.durationMs = Date.now() - started;
  } catch (error) {
    step.status = "Failed";
    step.error = error instanceof Error ? error.message : "Automation step failed.";
    step.completedAt = new Date().toISOString();
    step.durationMs = Date.now() - started;
    throw error;
  }
}

async function executeRunInternal(runId: string, role: Mt5Role, request?: Request) {
  const run = runById(runId);
  const deps = await loadContext(role);

  for (const step of run.steps) {
    if (step.status === "Completed") continue;
    try {
      await executeStep(run, step, deps, role, request);
    } catch {
      run.status = "Failed";
      run.summary = summarizeRun(run);
      run.completedAt = new Date().toISOString();
      state.activeRunId = null;
      throw new Error(run.summary);
    }
  }

  run.status = "Completed";
  run.currentStepId = null;
  run.completedAt = new Date().toISOString();
  run.summary = summarizeRun(run);
  state.activeRunId = null;
  state.lastCompletedAt = run.completedAt;
  return run;
}

export async function startTopDownAnalysis(input: TopDownAnalysisInput, role: Mt5Role, request?: Request) {
  authorize(role, "start");
  if (state.activeRunId) throw new Error("An automation run is already active. Cancel or wait for completion first.");

  const deps = await loadContext(role);
  const terminal = deps.terminalStatus.terminals.find((item) => item.terminalId === input.terminalId);
  if (!terminal) throw new Error("Terminal not found for automation run.");

  let instrument =
    resolveInstrumentForSymbol(deps.chartControl.instruments, input.symbol, terminal.brokerName) ??
    deps.ensureChartInstrument({
      symbol: input.symbol,
      brokerName: terminal.brokerName,
      brokerId: terminal.brokerId,
      role,
      confirmed: true,
      request
    });
  const timeframes = (input.timeframes?.length ? input.timeframes : [...DEFAULT_TIMEFRAMES]) as Timeframe[];

  validateTopDownRun({ terminal, instrument, symbol: input.symbol, timeframes });

  const runId = `tda-${Date.now()}`;
  const run = createRunSkeleton({
    runId,
    symbol: instrument!.symbol,
    terminal: terminal!,
    instrumentId: instrument!.id,
    timeframes,
    role
  });

  state.runs.unshift(run);
  state.activeRunId = run.id;

  if (input.autonomous !== false && state.autonomousMode) {
    await executeRunInternal(run.id, role, request);
  }

  return run;
}

export async function executeAutomationRun(runId: string, role: Mt5Role, request?: Request) {
  authorize(role, "start");
  return executeRunInternal(runId, role, request);
}

export function cancelAutomationRun(runId: string, role: Mt5Role) {
  authorize(role, "cancel");
  const run = runById(runId);
  if (run.status === "Completed") throw new Error("Completed runs cannot be cancelled.");
  run.status = "Cancelled";
  run.completedAt = new Date().toISOString();
  run.summary = `Run cancelled on ${run.symbol}.`;
  if (state.activeRunId === run.id) state.activeRunId = null;
  return run;
}

export async function buildDesktopAutomationHubResponse(
  role: Mt5Role = desktopAutomationHubRole(),
  highlightedTerminalId: string | null = null
): Promise<DesktopAutomationHubResponse> {
  authorize(role, "view");
  const deps = await loadContext(role);
  const timestamp = deps.terminalStatus.meta.timestamp;
  const terminals = buildTerminalTargets(deps.terminalStatus.terminals);
  const symbols = buildSymbolOptions(
    deps.chartControl.instruments,
    terminals.map((entry) => entry.brokerName)
  );
  const current = activeRun();
  const readiness = operatorReadinessScore(terminals, current);

  const highlight =
    highlightedTerminalId && terminals.some((terminal) => terminal.terminalId === highlightedTerminalId)
      ? highlightedTerminalId
      : null;

  return {
    meta: {
      timestamp,
      currentRole: role,
      streamEndpoint: "/api/autonomous-computer-operator/desktop-automation-hub/events-stream",
      monitoringMode: "Autonomous Desktop Operator — Top-Down Chart Analysis",
      highlightedTerminalId: highlight,
      operatorReadiness: readiness
    },
    kpis: buildAutomationKpis(terminals, state.runs, current, readiness, timestamp),
    operator: {
      autonomousMode: state.autonomousMode,
      activeRunId: state.activeRunId,
      lastCompletedAt: state.lastCompletedAt,
      description: "Operates MT5 without human input: open chart, select pair, walk timeframes, capture screenshots for AI."
    },
    topDownTimeframes: [...DEFAULT_TIMEFRAMES],
    terminals,
    symbols,
    activeRun: current,
    recentRuns: state.runs.slice(0, 12),
    permissions: {
      role,
      canStartAutomation: permissions.start.includes(role),
      canCancelAutomation: permissions.cancel.includes(role),
      canViewAiCaptures: permissions.view.includes(role)
    }
  };
}
