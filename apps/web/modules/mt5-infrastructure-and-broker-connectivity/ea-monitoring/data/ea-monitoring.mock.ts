import type { AuditRecord, ScoreResult } from "../../mt5-control-center/types/mt5-control-center.types";
import type {
  AiEaDiagnostic,
  EaAnalyticsPoint,
  EaCommand,
  EaExceptionRecord,
  EaInstance,
  EaKpi,
  EaLogRecord,
  EaStrategyBinding
} from "../types/ea-monitoring.types";
import { buildWorkflow, eaHealthScore, readinessValidation, strategyBindingIntegrity, suspiciousBehavior } from "../algorithms/ea-monitoring.algorithms";

function isoNow(offsetMinutes = 0) {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
}

function stable(n: number) {
  const x = Math.sin(n * 997) * 10_000;
  return x - Math.floor(x);
}

function id(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(3, "0")}`;
}

const brokers = [
  { brokerId: "broker-icm", broker: "IC Markets" },
  { brokerId: "broker-ftmo", broker: "FTMO" },
  { brokerId: "broker-pep", broker: "Pepperstone" }
];

const symbols = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "NAS100", "US30"];
const timeframes = ["M1", "M5", "M15", "H1"];

export function createEaMonitoringSeed() {
  const instances: EaInstance[] = [];
  const commands: EaCommand[] = [];
  const bindings: EaStrategyBinding[] = [];
  const logs: EaLogRecord[] = [];
  const exceptions: EaExceptionRecord[] = [];
  const analytics: EaAnalyticsPoint[] = [];
  const diagnostics: AiEaDiagnostic[] = [];
  const audit: AuditRecord[] = [];

  let n = 1;
  for (let i = 0; i < 32; i += 1) {
    const broker = brokers[i % brokers.length]!;
    const symbolScope = symbols.filter((_, idx) => idx % (i % 3 + 2) === 0).slice(0, 4);
    const timeframeScope = timeframes.slice(0, (i % 3) + 2);
    const offline = stable(i) > 0.92;
    const degraded = !offline && stable(i * 3) > 0.75;
    const heartbeatMissing = offline || stable(i * 5) > 0.88;
    const heartbeatDelaySeconds = heartbeatMissing ? 0 : Math.round(2 + stable(i * 11) * (degraded ? 18 : 6));
    const tradingEnabled = stable(i * 7) > 0.35;
    const emergencyStopActive = stable(i * 13) > 0.97;
    const riskRulesLoaded = stable(i * 17) > 0.12;
    const accountTradingAllowed = !offline && stable(i * 19) > 0.08;
    const symbolTradingAllowed = stable(i * 23) > 0.1;
    const bridgeStatus = offline ? "Disconnected" : degraded ? "Degraded" : "Connected";
    const commandChannelStatus = offline ? "Down" : degraded ? "Degraded" : "Ready";
    const executionFeedbackStatus = offline ? "Down" : stable(i * 29) > 0.86 ? "Degraded" : "Ready";
    const strategyId = stable(i * 31) > 0.12 ? `STR-${(i % 6) + 1}` : null;
    const strategyVersion = strategyId ? `v${(i % 3) + 1}.0.${(i % 9) + 1}` : null;
    const strategyName = strategyId ? `Strategy ${strategyId}` : null;
    const riskProfile = i % 3 === 0 ? "Conservative" : i % 3 === 1 ? "Balanced" : "Aggressive";
    const failedCommands = Math.floor(stable(i * 37) * (offline ? 20 : degraded ? 12 : 6));
    const commandSuccessRate = Math.max(0, Math.min(100, Math.round(100 - failedCommands * 4 - (degraded ? 10 : 0))));
    const averageLatencyMs = Math.round(120 + stable(i * 41) * (degraded ? 900 : 450));
    const lastError =
      offline ? "EA offline: no heartbeat" :
      heartbeatMissing ? "Heartbeat missing beyond threshold" :
      failedCommands >= 6 ? "Command delivery failures detected" :
      null;

    const baseRisk =
      emergencyStopActive ? "Critical" :
      offline ? "Critical" :
      degraded ? "High" :
      failedCommands >= 6 ? "Elevated" :
      "Moderate";

    const instance: EaInstance = {
      id: id("ea", n),
      eaId: `EA-${String(1000 + i)}`,
      eaName: i % 4 === 0 ? "NexusBridgeEA" : i % 4 === 1 ? "NexusScalpEA" : i % 4 === 2 ? "NexusSwingEA" : "NexusArbEA",
      eaVersion: `1.${(i % 9) + 1}.${(i % 30) + 1}`,
      buildNumber: String(8000 + i),
      magicNumber: String(100000 + i * 7),
      terminalId: `term-${(i % 10) + 1}`,
      terminal: `Terminal-${(i % 10) + 1}`,
      brokerId: broker.brokerId,
      broker: broker.broker,
      accountId: `acct-${(i % 14) + 1}`,
      accountLogin: `A${(i % 14) + 1}-LIVE`,
      hostMachine: `VPS-${(i % 8) + 1}`,
      environment: "Production",
      strategyId,
      strategyName,
      strategyVersion,
      symbolScope,
      timeframeScope,
      riskProfile,
      connectionStatus: offline ? "Offline" : degraded ? "Degraded" : "Online",
      heartbeatStatus: heartbeatMissing ? "Missing" : heartbeatDelaySeconds >= 10 ? "Delayed" : "Active",
      lastHeartbeatAt: heartbeatMissing ? null : isoNow(-heartbeatDelaySeconds / 60),
      heartbeatDelaySeconds,
      bridgeStatus,
      commandChannelStatus,
      executionFeedbackStatus,
      tradingEnabled,
      accountTradingAllowed,
      symbolTradingAllowed,
      riskRulesLoaded,
      duplicateProtectionActive: stable(i * 43) > 0.12,
      spreadFilterActive: stable(i * 47) > 0.18,
      slippageFilterActive: stable(i * 53) > 0.18,
      latencyFilterActive: stable(i * 59) > 0.18,
      emergencyStopActive,
      commandSuccessRate,
      failedCommands,
      averageLatencyMs,
      uptimeSeconds: Math.round(3600 * (6 + stable(i * 61) * 72)),
      restartCount: Math.floor(stable(i * 67) * (degraded ? 7 : 4)),
      lastError,
      riskLevel: baseRisk as any,
      healthScore: 0,
      readiness: {} as any,
      createdAt: isoNow(-(i * 120)),
      updatedAt: isoNow(-(i * 3))
    };
    instance.readiness = readinessValidation(instance);
    const bindingOk = Boolean(strategyId);
    instance.healthScore = eaHealthScore({
      heartbeatDelaySeconds: instance.heartbeatDelaySeconds,
      heartbeatStatus: instance.heartbeatStatus,
      bridgeStatus: instance.bridgeStatus,
      strategyBindingOk: bindingOk,
      commandSuccessRate: instance.commandSuccessRate,
      executionFeedbackStatus: instance.executionFeedbackStatus,
      riskRulesLoaded: instance.riskRulesLoaded,
      riskLevel: instance.riskLevel,
      restartCount: instance.restartCount,
      errorFrequency: failedCommands >= 6 ? 2 : failedCommands >= 3 ? 1 : 0
    });

    instances.push(instance);

    if (strategyId) {
      const binding: EaStrategyBinding = {
        id: `bind-${String(n).padStart(3, "0")}`,
        eaId: instance.eaId,
        eaInstance: instance.eaName,
        strategyId,
        strategyName: instance.strategyName ?? `Strategy ${strategyId}`,
        strategyVersion: instance.strategyVersion ?? "v1.0.0",
        symbolsAllowed: stable(i * 71) > 0.85 ? symbolScope.slice(0, Math.max(1, symbolScope.length - 1)) : symbolScope,
        timeframesAllowed: timeframeScope,
        riskProfile,
        maxRiskPerTrade: riskProfile === "Aggressive" ? 1.8 : riskProfile === "Balanced" ? 1.0 : 0.6,
        maxDailyRisk: riskProfile === "Aggressive" ? 6 : riskProfile === "Balanced" ? 4 : 2,
        tradeFrequencyLimit: riskProfile === "Aggressive" ? 40 : riskProfile === "Balanced" ? 24 : 12,
        tradingSessionRules: "LDN+NY only",
        newsRestrictionStatus: stable(i * 73) > 0.2 ? "Loaded" : "Missing",
        bindingStatus: stable(i * 79) > 0.12 ? "Bound" : "Mismatch",
        lastBindingUpdateAt: isoNow(-(i * 9)),
        createdAt: isoNow(-(i * 120)),
        updatedAt: isoNow(-(i * 9))
      };
      bindings.push(binding);
      const integrity = strategyBindingIntegrity(instance, binding);
      if (!integrity.ok) {
        exceptions.push({
          id: `exc-${String(n).padStart(3, "0")}`,
          timestamp: isoNow(-(i * 2)),
          eaId: instance.eaId,
          eaInstance: instance.eaName,
          terminal: instance.terminal,
          broker: instance.broker,
          account: instance.accountLogin,
          exceptionType: "Strategy Binding Error",
          severity: "Warning",
          rootCause: integrity.issues.join(", "),
          tradingImpact: "Strategy constraints may not be enforced; execution may be unsafe.",
          resolutionStatus: "Unresolved",
          assignedTo: null,
          aiExplanation: "Rebind strategy and reload restrictions; confirm symbol/timeframe scope matches binding.",
          resolvedAt: null,
          createdAt: isoNow(-(i * 2))
        });
      }
    }

    const cmdCount = 6 + (i % 8);
    for (let c = 0; c < cmdCount; c += 1) {
      const status = stable(i * 97 + c * 17) > 0.92 ? "Failed" : stable(i * 97 + c * 17) > 0.84 ? "Rejected" : stable(i * 97 + c * 17) > 0.6 ? "Executed" : "Delivered";
      const cmd: EaCommand = {
        id: `cmd-${String(i).padStart(3, "0")}-${String(c).padStart(2, "0")}`,
        commandId: `CMD-${String(900000 + i * 20 + c)}`,
        eaId: instance.eaId,
        eaInstance: instance.eaName,
        strategyId: instance.strategyId,
        strategyName: instance.strategyName,
        accountId: instance.accountId,
        account: instance.accountLogin,
        brokerId: instance.brokerId,
        broker: instance.broker,
        symbol: symbolScope[c % Math.max(1, symbolScope.length)] ?? "EURUSD",
        commandType: c % 6 === 0 ? "Heartbeat" : c % 6 === 1 ? "Status report" : c % 6 === 2 ? "Open order" : c % 6 === 3 ? "Modify SL" : c % 6 === 4 ? "Close position" : "Sync position",
        direction: c % 3 === 0 ? "Buy" : c % 3 === 1 ? "Sell" : "None",
        volume: c % 6 >= 2 ? 1 : null,
        commandStatus: status as any,
        riskApprovalStatus: c % 6 >= 2 ? (stable(i * 101 + c) > 0.12 ? "Approved" : "Blocked") : "Approved",
        deliveredAt: isoNow(-(i * 3 + c)),
        executedAt: status === "Executed" ? isoNow(-(i * 3 + c - 0.2)) : null,
        responseTimeMs: status === "Failed" ? null : Math.round(80 + stable(i * 103 + c) * 900),
        mt5Ticket: status === "Executed" ? String(700000 + i * 20 + c) : null,
        failureReason: status === "Failed" ? "Command not delivered" : status === "Rejected" ? "Risk blocked or broker rejected" : null,
        createdAt: isoNow(-(i * 3 + c + 1))
      };
      commands.push(cmd);
    }

    const suspicious = suspiciousBehavior(instance, { commandsOutsideStrategy: instance.strategyId ? 0 : 2, unauthorizedSymbols: stable(i * 107) > 0.9 ? 1 : 0, excessiveFrequency: stable(i * 109) > 0.94, duplicateOrders: stable(i * 113) > 0.92 ? 3 : 0 });
    if (suspicious.suspicious) {
      exceptions.push({
        id: `exc-s-${String(n).padStart(3, "0")}`,
        timestamp: isoNow(-(i * 2 + 1)),
        eaId: instance.eaId,
        eaInstance: instance.eaName,
        terminal: instance.terminal,
        broker: instance.broker,
        account: instance.accountLogin,
        exceptionType: "Suspicious Behavior",
        severity: instance.riskLevel === "Critical" ? "Critical" : "Warning",
        rootCause: suspicious.flags.join(", "),
        tradingImpact: "Potential policy violation; execution may be unsafe.",
        resolutionStatus: "Unresolved",
        assignedTo: "risk.manager",
        aiExplanation: "Disable trading if unsafe; verify binding integrity and command authorization scope.",
        resolvedAt: null,
        createdAt: isoNow(-(i * 2 + 1))
      });
    }

    if (lastError) {
      logs.unshift({
        id: `log-${String(n).padStart(3, "0")}`,
        timestamp: isoNow(-(i * 2)),
        eaId: instance.eaId,
        eaInstance: instance.eaName,
        terminal: instance.terminal,
        broker: instance.broker,
        account: instance.accountLogin,
        errorType: "Runtime Health",
        severity: instance.riskLevel === "Critical" ? "Critical" : "Warning",
        message: lastError,
        sourceModule: "EA Monitoring",
        repeatCount: 1 + Math.floor(stable(i * 131) * 6),
        resolutionStatus: "Unresolved",
        aiExplanation: "Correlate heartbeat, bridge session, and command failures; restart or disable trading if unsafe.",
        resolvedAt: null
      });
    }

    n += 1;
  }

  for (const inst of instances.slice(0, 24)) {
    for (let p = 0; p < 10; p += 1) {
      analytics.push({
        measuredAt: isoNow(-(p * 30)),
        eaId: inst.eaId,
        uptimePercent: Math.max(0, Math.min(100, 80 + stable(p * 7 + inst.eaId.length) * 20 - (inst.connectionStatus === "Offline" ? 40 : 0))),
        heartbeatDelaySeconds: Math.max(0, Math.round(inst.heartbeatDelaySeconds + (stable(p * 11) - 0.5) * 4)),
        commandSuccessRate: Math.max(0, Math.min(100, inst.commandSuccessRate + Math.round((stable(p * 13) - 0.5) * 12))),
        failedCommandRate: Math.max(0, Math.min(1, (100 - inst.commandSuccessRate) / 100)),
        averageLatencyMs: Math.max(40, Math.round(inst.averageLatencyMs + (stable(p * 17) - 0.5) * 180)),
        restartFrequency: Math.max(0, Math.round(inst.restartCount / 10 + stable(p * 19) * 2)),
        errorFrequency: Math.max(0, Math.round((inst.failedCommands / 10) + stable(p * 23) * 2)),
        executionFeedbackCompleteness: inst.executionFeedbackStatus === "Ready" ? 0.98 : inst.executionFeedbackStatus === "Degraded" ? 0.75 : 0.4
      });
    }
  }

  const total = instances.length;
  const active = instances.filter((e) => e.connectionStatus === "Online").length;
  const offline = instances.filter((e) => e.connectionStatus === "Offline").length;
  const degraded = instances.filter((e) => e.connectionStatus === "Degraded" || e.bridgeStatus === "Degraded" || e.heartbeatStatus !== "Active").length;
  const tradingEnabledCount = instances.filter((e) => e.tradingEnabled).length;
  const tradingDisabledCount = total - tradingEnabledCount;
  const avgHb = Math.round(instances.reduce((sum, e) => sum + e.heartbeatDelaySeconds, 0) / Math.max(1, total));
  const avgLatency = Math.round(instances.reduce((sum, e) => sum + e.averageLatencyMs, 0) / Math.max(1, total));
  const failedCommands = instances.reduce((sum, e) => sum + e.failedCommands, 0);
  const throughput = Math.round(commands.length / 5);
  const highest = instances.sort((a, b) => b.healthScore - a.healthScore)[0] ?? instances[0];
  const avgScore = Math.round(instances.reduce((sum, e) => sum + e.healthScore, 0) / Math.max(1, total));

  const score: ScoreResult = {
    score: avgScore,
    rating: avgScore >= 90 ? "Excellent" : avgScore >= 75 ? "Healthy" : avgScore >= 60 ? "Degraded" : avgScore >= 40 ? "High Risk" : "Critical",
    factors: { offline, degraded, failedCommands }
  };

  const kpis: EaKpi[] = [
    { label: "Total EA Instances", value: String(total), status: "Healthy", detail: "All EA instances registered and monitored.", updatedAt: isoNow() },
    { label: "Active EAs", value: String(active), status: active >= total * 0.85 ? "Healthy" : "Watch", detail: "Online EAs with active connectivity.", updatedAt: isoNow() },
    { label: "Offline EAs", value: String(offline), status: offline >= 6 ? "Critical" : offline >= 3 ? "Degraded" : offline >= 1 ? "Watch" : "Healthy", detail: "EAs with no heartbeat/connection.", updatedAt: isoNow() },
    { label: "Degraded EAs", value: String(degraded), status: degraded >= 10 ? "Degraded" : degraded >= 5 ? "Watch" : "Healthy", detail: "Degraded heartbeat, bridge, or channels.", updatedAt: isoNow() },
    { label: "Trading Enabled EAs", value: String(tradingEnabledCount), status: "Healthy", detail: "EAs allowed to trade under risk controls.", updatedAt: isoNow() },
    { label: "Trading Disabled EAs", value: String(tradingDisabledCount), status: tradingDisabledCount >= 10 ? "Watch" : "Healthy", detail: "Trading disabled by operator/rules.", updatedAt: isoNow() },
    { label: "Average EA Heartbeat Delay", value: `${avgHb}s`, status: avgHb >= 12 ? "Degraded" : avgHb >= 7 ? "Watch" : "Healthy", detail: "Average heartbeat delay across EAs.", updatedAt: isoNow() },
    { label: "Average Command Latency", value: `${avgLatency}ms`, status: avgLatency >= 900 ? "Degraded" : avgLatency >= 600 ? "Watch" : "Healthy", detail: "Average end-to-end command latency.", updatedAt: isoNow() },
    { label: "Failed Commands", value: String(failedCommands), status: failedCommands >= 60 ? "Degraded" : failedCommands >= 25 ? "Watch" : "Healthy", detail: "Command delivery/execution failures.", updatedAt: isoNow() },
    { label: "Message Throughput", value: `${throughput}/min`, status: throughput >= 200 ? "Healthy" : throughput >= 120 ? "Watch" : "Degraded", detail: "Command + heartbeat message throughput.", updatedAt: isoNow() },
    { label: "Highest Risk EA", value: highest?.eaId ?? "—", status: "Critical", detail: highest?.lastError ?? "Highest risk based on readiness and failures.", updatedAt: isoNow() },
    { label: "EA Health Score", value: `${avgScore}/100`, status: score.rating === "Critical" ? "Critical" : score.rating === "High Risk" ? "Degraded" : score.rating === "Degraded" ? "Watch" : "Healthy", detail: "Composite EA health score across readiness and failures.", updatedAt: isoNow() }
  ];

  for (const inst of instances.slice(0, 24)) {
    if (!inst.readiness.executionReady || inst.riskLevel === "Critical" || inst.heartbeatStatus !== "Active") {
      diagnostics.push({
        id: `aid-${inst.eaId}`,
        eaId: inst.eaId,
        eaInstance: inst.eaName,
        issueSummary: inst.heartbeatStatus !== "Active" ? "EA heartbeat missing/delayed" : !inst.readiness.executionReady ? "EA not execution-ready" : "High-risk EA state detected",
        severity: inst.riskLevel === "Critical" || inst.connectionStatus === "Offline" ? "Critical" : inst.riskLevel === "High" ? "Warning" : "Info",
        rootCause: inst.lastError ?? inst.readiness.blockers.join(", "),
        tradingImpact: inst.tradingEnabled && !inst.readiness.executionReady ? "Trading path unsafe; disable trading until recovered." : "Operational degradation; may impact execution quality.",
        recommendedFix: inst.connectionStatus === "Offline" ? "Restart EA session; verify terminal heartbeat and bridge session." : !inst.riskRulesLoaded ? "Reload risk rules and confirm restrictions loaded." : "Rebind strategy/terminal if mismatch; verify command channel readiness.",
        autoRemediationEligible: inst.connectionStatus !== "Offline" && !inst.emergencyStopActive,
        confidenceScore: Math.max(0.35, Math.min(0.95, 0.55 + inst.healthScore / 200)),
        escalationRequired: inst.riskLevel === "Critical" || inst.emergencyStopActive || inst.connectionStatus === "Offline",
        createdAt: isoNow(),
        resolvedAt: null
      });
    }
  }

  audit.unshift({
    id: "audit-001",
    userId: "system",
    action: "SYNC_EA_STATUS",
    module: "EA Monitoring",
    entityId: "SYNC",
    oldValue: null,
    newValue: { syncedAt: isoNow(-12) },
    ipAddress: "system",
    userAgent: "autonomous-ea-monitoring",
    timestamp: isoNow(-12)
  });

  const workflow = buildWorkflow(instances, diagnostics[0] ?? null);

  return { instances, commands, bindings, logs, exceptions, analytics, diagnostics, audit, workflow, kpis, eaHealthScore: score };
}

