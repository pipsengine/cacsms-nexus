import { describe, expect, it } from "vitest";

import { heartbeatClassification, latencyAnomalyClass, packetLossClass, tradingPathSafety } from "@/modules/mt5-infrastructure-and-broker-connectivity/connection-health/algorithms/connection-health.algorithms";
import type { ConnectionComponent } from "@/modules/mt5-infrastructure-and-broker-connectivity/connection-health/types/connection-health.types";

function baseComponent(patch: Partial<ConnectionComponent>): ConnectionComponent {
  return {
    id: "cmp-1",
    componentId: "cmp-001",
    componentType: "MT5 Terminal",
    componentName: "MT5 Terminal 1",
    broker: null,
    account: null,
    terminal: "MT5-Terminal-1",
    eaInstance: null,
    hostMachine: "LD4-HOST-01",
    serverRegion: "LD4",
    environment: "Development",
    connectionStatus: "Healthy",
    heartbeatStatus: "Healthy",
    lastHeartbeat: new Date().toISOString(),
    expectedHeartbeatIntervalSeconds: 15,
    latencyMs: 25,
    packetLossPercent: 0,
    uptimePercent: 99.9,
    errorCount: 0,
    retryCount: 0,
    lastIncident: null,
    healthScore: 95,
    riskLevel: "Low",
    tradingPathActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...patch
  };
}

describe("Connection Health algorithms", () => {
  it("classifies heartbeat delays by thresholds", () => {
    expect(heartbeatClassification(0)).toBe("Healthy");
    expect(heartbeatClassification(30)).toBe("Healthy");
    expect(heartbeatClassification(31)).toBe("Watch");
    expect(heartbeatClassification(61)).toBe("Degraded");
    expect(heartbeatClassification(121)).toBe("Critical");
    expect(heartbeatClassification(301)).toBe("Offline");
  });

  it("classifies latency anomaly by rolling average ratio", () => {
    expect(latencyAnomalyClass(110, 100)).toBe("Normal");
    expect(latencyAnomalyClass(140, 100)).toBe("Watch");
    expect(latencyAnomalyClass(190, 100)).toBe("Degraded");
    expect(latencyAnomalyClass(260, 100)).toBe("Critical");
  });

  it("classifies packet loss by thresholds", () => {
    expect(packetLossClass(0.2)).toBe("Normal");
    expect(packetLossClass(1.0)).toBe("Watch");
    expect(packetLossClass(2.5)).toBe("Degraded");
    expect(packetLossClass(4.0)).toBe("Critical");
  });

  it("marks trading path unsafe when critical dependencies are missing or unhealthy", () => {
    const okMap = {
      "MT5 Terminal": baseComponent({ componentType: "MT5 Terminal", connectionStatus: "Healthy" }),
      "EA Bridge": baseComponent({ componentType: "EA Bridge", connectionStatus: "Healthy" }),
      "Broker Server": baseComponent({ componentType: "Broker Server", connectionStatus: "Healthy" }),
      "Trading Account": baseComponent({ componentType: "Trading Account", connectionStatus: "Healthy" }),
      "Market Data Feed": baseComponent({ componentType: "Market Data Feed", connectionStatus: "Healthy" }),
      "Order Router": baseComponent({ componentType: "Order Router", connectionStatus: "Healthy" }),
      "Execution Queue": baseComponent({ componentType: "Execution Queue", connectionStatus: "Healthy" }),
      "MT5 Feedback": baseComponent({ componentType: "MT5 Feedback", connectionStatus: "Healthy" }),
      "Audit Service": baseComponent({ componentType: "Audit Service", connectionStatus: "Healthy" })
    } satisfies Record<string, ConnectionComponent>;

    expect(tradingPathSafety(okMap as any, true).safe).toBe(true);
    const offlineTerminal = { ...okMap, "MT5 Terminal": baseComponent({ componentType: "MT5 Terminal", connectionStatus: "Offline" }) };
    expect(tradingPathSafety(offlineTerminal as any, true).safe).toBe(false);
    expect(tradingPathSafety(okMap as any, false).failures).toContain("Emergency stop active");
  });
});

