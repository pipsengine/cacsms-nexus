import { describe, expect, it } from "vitest";
import {
  buildAutomationKpis,
  buildSymbolOptions,
  buildTerminalTargets,
  buildTopDownSteps,
  createRunSkeleton,
  getTerminalAutomationBlockers,
  normalizeSymbol,
  operatorReadinessScore,
  resolveInstrumentForSymbol,
  summarizeRun,
  terminalAutomationReady,
  TOP_DOWN_TIMEFRAMES,
  validateTopDownRun
} from "@/modules/autonomous-computer-operator/desktop-automation-hub/algorithms/top-down-analysis.algorithms";
import { createChartControlSeed } from "@/tests/fixtures/chart-control.fixture";
import { createTerminalStatusSeed } from "@/tests/fixtures/terminal-status.fixture";

describe("Desktop Automation Hub top-down algorithms", () => {
  const terminals = createTerminalStatusSeed().terminals;
  const instruments = createChartControlSeed().instruments;
  const readyTerminal = terminals[0]!;
  const stoppedTerminal = terminals[3]!;

  it("normalizes trading symbols for matching", () => {
    expect(normalizeSymbol("EUR/USD")).toBe("EURUSD");
  });

  it("marks running terminals with market data as automation ready", () => {
    expect(terminalAutomationReady(readyTerminal)).toBe(true);
    expect(terminalAutomationReady(stoppedTerminal)).toBe(false);
  });

  it("builds top-down steps for each timeframe", () => {
    const steps = buildTopDownSteps([...TOP_DOWN_TIMEFRAMES]);
    expect(steps[0]?.type).toBe("open_mt5_chart");
    expect(steps[1]?.type).toBe("select_symbol");
    expect(steps.filter((step) => step.type === "capture_screenshot")).toHaveLength(TOP_DOWN_TIMEFRAMES.length);
    expect(steps.filter((step) => step.type === "queue_ai_analysis")).toHaveLength(TOP_DOWN_TIMEFRAMES.length);
  });

  it("creates a run skeleton with pending steps", () => {
    const instrument = resolveInstrumentForSymbol(instruments, "EURUSD", readyTerminal.brokerName)!;
    const run = createRunSkeleton({
      runId: "tda-test",
      symbol: instrument.symbol,
      terminal: readyTerminal,
      instrumentId: instrument.id,
      timeframes: [...TOP_DOWN_TIMEFRAMES],
      role: "Infrastructure Admin"
    });
    expect(run.steps.every((step) => step.status === "Pending")).toBe(true);
    expect(run.timeframes).toEqual([...TOP_DOWN_TIMEFRAMES]);
  });

  it("validates terminal, symbol, and timeframe availability", () => {
    const instrument = resolveInstrumentForSymbol(instruments, "EURUSD", readyTerminal.brokerName)!;
    expect(() =>
      validateTopDownRun({
        terminal: readyTerminal,
        instrument,
        symbol: "EURUSD",
        timeframes: [...TOP_DOWN_TIMEFRAMES]
      })
    ).not.toThrow();
    expect(() =>
      validateTopDownRun({
        terminal: stoppedTerminal,
        instrument,
        symbol: "EURUSD",
        timeframes: [...TOP_DOWN_TIMEFRAMES]
      })
    ).toThrow(/not ready/i);
  });

  it("lists blockers when MT5 is not running", () => {
    const blockers = getTerminalAutomationBlockers(stoppedTerminal);
    expect(blockers.some((blocker) => /stopped/i.test(blocker))).toBe(true);
  });

  it("builds KPI and readiness helpers", () => {
    const targets = buildTerminalTargets(terminals);
    const symbols = buildSymbolOptions(instruments, ["IC Markets"]);
    const readiness = operatorReadinessScore(targets, null);
    const kpis = buildAutomationKpis(targets, [], null, readiness, new Date().toISOString());
    expect(symbols.some((option) => option.symbol === "EURUSD")).toBe(true);
    expect(symbols.some((option) => option.symbol === "GBPUSD")).toBe(true);
    expect(kpis.length).toBeGreaterThan(6);
    expect(readiness.score).toBeGreaterThan(0);
  });

  it("summarizes completed runs with capture counts", () => {
    const run = createRunSkeleton({
      runId: "tda-done",
      symbol: "EURUSD",
      terminal: readyTerminal,
      instrumentId: "chart-eurusd",
      timeframes: ["D1", "H4"],
      role: "Infrastructure Admin"
    });
    run.status = "Completed";
    run.screenshotsCaptured = 2;
    run.aiAnalysisQueued = 2;
    expect(summarizeRun(run)).toMatch(/Captured 2 timeframe screenshots/i);
  });
});
