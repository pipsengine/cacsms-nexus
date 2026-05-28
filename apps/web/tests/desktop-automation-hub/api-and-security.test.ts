import { beforeEach, describe, expect, it } from "vitest";
import {
  buildDesktopAutomationHubResponse,
  desktopAutomationHubRole,
  resetDesktopAutomationState,
  startTopDownAnalysis
} from "@/app/api/autonomous-computer-operator/desktop-automation-hub/_lib/store";
import { resetChartControlState } from "@/app/api/mt5/chart-control/_lib/store";
import { seedChartControlStore, seedDesktopAutomationHubStore, seedTerminalStatusStore } from "@/tests/helpers/seed-api-stores";
import { createChartControlSeed } from "@/tests/fixtures/chart-control.fixture";
import { createTerminalStatusSeed } from "@/tests/fixtures/terminal-status.fixture";
import { TOP_DOWN_TIMEFRAMES } from "@/modules/autonomous-computer-operator/desktop-automation-hub/types/desktop-automation-hub.types";

describe("Desktop Automation Hub API domain and security", () => {
  beforeEach(() => {
    seedTerminalStatusStore();
    seedChartControlStore();
    seedDesktopAutomationHubStore();
  });

  it("defaults to infrastructure admin in local dev when no header provided", () => {
    expect(desktopAutomationHubRole(new Request("http://localhost/api/autonomous-computer-operator/desktop-automation-hub"))).toBe(
      "Infrastructure Admin"
    );
  });

  it("aggregates terminals and symbols for autonomous top-down analysis", async () => {
    const response = await buildDesktopAutomationHubResponse("Infrastructure Admin");
    expect(response.terminals.length).toBeGreaterThan(0);
    expect(response.symbols.length).toBeGreaterThan(0);
    expect(response.topDownTimeframes).toEqual([...TOP_DOWN_TIMEFRAMES]);
    expect(response.meta.streamEndpoint).toContain("desktop-automation-hub");
    expect(response.operator.autonomousMode).toBe(true);
  });

  it("honors highlighted terminal query parameter", async () => {
    const response = await buildDesktopAutomationHubResponse("Infrastructure Admin");
    const terminalId = response.terminals[0]?.terminalId;
    if (!terminalId) return;
    const highlighted = await buildDesktopAutomationHubResponse("Infrastructure Admin", terminalId);
    expect(highlighted.meta.highlightedTerminalId).toBe(terminalId);
  });

  it("executes a full top-down run without human input", async () => {
    const terminal = createTerminalStatusSeed().terminals[0]!;
    const run = await startTopDownAnalysis(
      { symbol: "EURUSD", terminalId: terminal.terminalId, autonomous: true },
      "Infrastructure Admin"
    );
    expect(run.status).toBe("Completed");
    expect(run.screenshotsCaptured).toBe(TOP_DOWN_TIMEFRAMES.length);
    expect(run.aiAnalysisQueued).toBe(TOP_DOWN_TIMEFRAMES.length);
    expect(run.steps.every((step) => step.status === "Completed")).toBe(true);
    expect(run.steps.some((step) => step.type === "open_mt5_chart" && step.operatorCommands.length > 0)).toBe(true);
  });

  it("provisions chart workspace instruments for catalog symbols", async () => {
    resetDesktopAutomationState();
    const seed = createChartControlSeed();
    resetChartControlState({
      instruments: seed.instruments.filter((item) => item.brokerName === "Pepperstone"),
      layouts: seed.layouts,
      drawings: seed.drawings,
      signals: seed.signals,
      snapshots: seed.snapshots
    });
    const { buildChartControlResponse } = await import("@/app/api/mt5/chart-control/_lib/store");
    expect(
      buildChartControlResponse("Infrastructure Admin").instruments.some(
        (item) => item.symbol === "EURUSD" && item.brokerName === "IC Markets"
      )
    ).toBe(false);

    const terminal = createTerminalStatusSeed().terminals[0]!;
    const run = await startTopDownAnalysis(
      { symbol: "EURUSD", terminalId: terminal.terminalId, autonomous: true },
      "Infrastructure Admin"
    );

    expect(run.symbol).toBe("EURUSD");
    expect(
      buildChartControlResponse("Infrastructure Admin").instruments.some(
        (item) => item.symbol === "EURUSD" && item.brokerName === "IC Markets"
      )
    ).toBe(true);
  });

  it("rejects overlapping automation runs", async () => {
    resetDesktopAutomationState({
      runs: [],
      activeRunId: "tda-active",
      autonomousMode: true,
      lastCompletedAt: null
    });
    const terminal = createTerminalStatusSeed().terminals[0]!;
    await expect(
      startTopDownAnalysis({ symbol: "EURUSD", terminalId: terminal.terminalId, autonomous: true }, "Infrastructure Admin")
    ).rejects.toThrow(/already active/i);
  });
});
