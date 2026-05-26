import type { AuditRecord } from "../../mt5-control-center/types/mt5-control-center.types";
import type {
  Mt5ErrorAiDiagnostic,
  Mt5ErrorIncident,
  Mt5ErrorKpi,
  Mt5ErrorLog,
  Mt5ErrorResolution,
  Mt5ErrorResolutionStatus,
  Mt5ErrorSeverity,
  Mt5ErrorSourceModule,
  Mt5ErrorType
} from "../types/mt5-error-logs.types";
import {
  buildCategories,
  buildFingerprints,
  buildTrends,
  buildWorkflow,
  escalationDecision,
  errorSeverityScore,
  fingerprintFor,
  incidentFrom,
  proposeDiagnostic,
  riskLevelFromSeverity
} from "../algorithms/mt5-error-logs.algorithms";

function isoNow(offsetMinutes = 0) {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString();
}

function stable(n: number) {
  const x = Math.sin(n * 911) * 10_000;
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

const modules: Mt5ErrorSourceModule[] = [
  "MT5 Terminal",
  "EA Bridge",
  "Broker Connection",
  "Account Sync",
  "Order Router",
  "Execution Queue",
  "Trade Synchronization",
  "Spread Monitor",
  "Slippage Monitor",
  "Latency Monitor",
  "Market Data",
  "Symbol Mapping",
  "Database/API",
  "Permission/Security"
];

type Template = {
  module: Mt5ErrorSourceModule;
  type: Mt5ErrorType;
  code: string | null;
  message: (n: number) => string;
  technical?: (n: number) => string;
  unsafe?: boolean;
};

const templates: Template[] = [
  {
    module: "Broker Connection",
    type: "Broker Disconnect",
    code: "10054",
    message: (n) => `Broker socket reset by peer during keep-alive cycle ${n}`,
    technical: (n) => `disconnect_reason=ECONNRESET; retry_backoff_ms=${500 + (n % 8) * 250}`,
    unsafe: true
  },
  {
    module: "MT5 Terminal",
    type: "Heartbeat Timeout",
    code: "HB-408",
    message: (n) => `Terminal heartbeat missed for ${25 + (n % 7) * 5}s on host VM-${(n % 5) + 1}`,
    technical: (n) => `heartbeat_interval=5s; missed=${(n % 6) + 1}; cpu=${50 + (n % 30)}%`
  },
  {
    module: "EA Bridge",
    type: "EA Auth Failed",
    code: "EA-401",
    message: (n) => `EA bridge rejected authentication token: session=${(n % 9) + 1000}`,
    technical: (n) => `auth_provider=bridge; reason=signature_mismatch; rotated=${n % 3 === 0}`
  },
  {
    module: "Order Router",
    type: "Order Routing Failure",
    code: "OR-503",
    message: (n) => `Order router could not route order ${100000 + n} due to upstream timeout`,
    technical: (n) => `route=mt5; upstream=execution-queue; timeout_ms=${1500 + (n % 4) * 500}`
  },
  {
    module: "Execution Queue",
    type: "Execution Queue Backpressure",
    code: "Q-429",
    message: (n) => `Execution queue backpressure: depth=${800 + (n % 400)}; rejected=${(n % 10) + 1}`,
    technical: (n) => `queue=approved->mt5; workers=${6 + (n % 4)}; p95_ms=${500 + (n % 6) * 120}`,
    unsafe: true
  },
  {
    module: "Trade Synchronization",
    type: "Trade Sync Mismatch",
    code: "SYNC-409",
    message: (n) => `Trade sync mismatch: ticket=${700000 + n} not found in MT5 snapshot`,
    technical: (n) => `reconcile_window_s=${60 + (n % 6) * 30}; delta_count=${(n % 5) + 1}`
  },
  {
    module: "Symbol Mapping",
    type: "Symbol Mapping Mismatch",
    code: "SYM-422",
    message: (n) => `Symbol mapping mismatch for EURUSD: brokerSymbol=EURUSD.${(n % 3) + 1} expected=EURUSD`,
    technical: (n) => `digits=5; contract=100000; map_version=${(n % 4) + 1}`
  },
  {
    module: "Database/API",
    type: "Database/API Failure",
    code: "DB-500",
    message: (n) => `DB write failed for error event batch ${n}: deadlock detected`,
    technical: (n) => `sqlstate=40P01; retries=${(n % 3) + 1}`
  },
  {
    module: "Permission/Security",
    type: "Permission Denied",
    code: "SEC-403",
    message: (n) => `Permission denied while updating risk gate: actor=svc-router-${(n % 3) + 1}`,
    technical: (n) => `policy=mt5:riskgate:update; env=prod; denied=true`,
    unsafe: true
  },
  {
    module: "Market Data",
    type: "Market Data Gap",
    code: "MD-410",
    message: (n) => `Market data gap detected: ${((n % 6) + 1) * 2}s with no ticks for XAUUSD`,
    technical: (n) => `feed=primary; reconnects=${(n % 4)}`
  }
];

function severitySeed(n: number): Mt5ErrorSeverity {
  const s = stable(n);
  if (s > 0.985) return "Emergency";
  if (s > 0.93) return "Critical";
  if (s > 0.78) return "High";
  if (s > 0.45) return "Warning";
  return "Info";
}

function resolutionSeed(n: number): Mt5ErrorResolutionStatus {
  const s = stable(n * 19);
  if (s > 0.84) return "Resolved";
  if (s > 0.7) return "In Progress";
  if (s > 0.62) return "Reopened";
  return "Unresolved";
}

export function createMt5ErrorLogsSeed() {
  const now = Date.now();
  const errors: Mt5ErrorLog[] = [];
  let n = 1;
  for (let i = 0; i < 140; i += 1) {
    const template = templates[i % templates.length]!;
    const broker = brokers[i % brokers.length]!;
    const brokerWide = i % 17 === 0;
    const affectedAccounts = brokerWide ? 12 : (i % 6) + 1;
    const repeatCount = (i % 9) + (template.unsafe ? 2 : 0);

    const occurredAt = new Date(now - i * 7 * 60_000).toISOString();
    const firstSeenAt = new Date(now - (i * 7 + repeatCount * 2) * 60_000).toISOString();
    const lastSeenAt = occurredAt;
    const createdAt = new Date(now - i * 6 * 60_000).toISOString();
    const updatedAt = isoNow(-i * 3);

    const resolutionStatus = resolutionSeed(i + template.module.length);
    const minutesUnresolved = resolutionStatus === "Resolved" ? 0 : Math.max(5, i * 7);
    const severityFromTemplate = severitySeed(i + template.type.length);
    const scoring = errorSeverityScore({
      sourceModule: template.module,
      errorType: template.type,
      repeatCount,
      minutesUnresolved,
      affectedAccounts,
      brokerWide,
      unsafeTrading: Boolean(template.unsafe)
    });

    const severity = (severityFromTemplate === "Info" && scoring.severity !== "Info") ? scoring.severity : severityFromTemplate;
    const riskLevel = riskLevelFromSeverity(severity, resolutionStatus, repeatCount);

    const error: Mt5ErrorLog = {
      id: id("err", n),
      errorId: `ERR-${String(1000 + i)}`,
      occurredAt,
      sourceModule: template.module,
      errorType: template.type,
      severity,
      brokerId: template.module === "Permission/Security" && i % 4 === 0 ? null : broker.brokerId,
      broker: template.module === "Permission/Security" && i % 4 === 0 ? null : broker.broker,
      accountId: `acct-${(i % 9) + 1}`,
      account: `A${(i % 9) + 1}-CHALLENGE`,
      terminalId: `term-${(i % 7) + 1}`,
      terminal: `Terminal-${(i % 7) + 1}`,
      eaInstanceId: template.module === "EA Bridge" ? `ea-${(i % 5) + 1}` : i % 3 === 0 ? `ea-${(i % 5) + 1}` : null,
      eaInstance: template.module === "EA Bridge" ? `EA-${(i % 5) + 1}` : i % 3 === 0 ? `EA-${(i % 5) + 1}` : null,
      symbol: template.type === "Symbol Mapping Mismatch" || template.type === "Market Data Gap" ? (i % 2 === 0 ? "EURUSD" : "XAUUSD") : i % 5 === 0 ? "XAUUSD" : null,
      orderId: template.type.includes("Order") || template.type.includes("Execution") ? `order-${100000 + i}` : null,
      tradeId: template.type.includes("Trade") ? `trade-${700000 + i}` : null,
      mt5Ticket: template.type.includes("Trade") || template.type.includes("Execution") ? String(700000 + i) : null,
      errorCode: template.code,
      errorMessage: template.message(i),
      technicalDetails: template.technical ? template.technical(i) : null,
      stackTrace: i % 4 === 0 ? `Error: ${template.type}\n  at Mt5Connector.handle\n  at Worker.run\n  at Scheduler.tick` : null,
      payloadHash: i % 6 === 0 ? `pl-${String(i).padStart(4, "0")}-${String(Math.floor(stable(i) * 1e8)).padStart(8, "0")}` : null,
      statusBefore: i % 5 === 0 ? "Healthy" : i % 3 === 0 ? "Degraded" : "Warning",
      statusAfter: template.unsafe ? "Unsafe" : i % 4 === 0 ? "Recovered" : "Degraded",
      repeatCount,
      firstSeenAt,
      lastSeenAt,
      resolutionStatus,
      assignedTo: resolutionStatus === "Unresolved" ? null : i % 2 === 0 ? "infra.oncall" : "trading.ops",
      riskLevel,
      environment: "Production",
      hostMachine: i % 3 === 0 ? `MT5-HOST-${(i % 6) + 1}` : `BRIDGE-${(i % 4) + 1}`,
      fingerprintHash: "",
      aiRiskScore: Math.min(100, Math.round(scoring.score + stable(i * 13) * 12)),
      createdAt,
      updatedAt
    };

    error.fingerprintHash = fingerprintFor(error);
    errors.push(error);
    n += 1;
  }

  const fingerprints = buildFingerprints(errors);
  const categories = buildCategories(errors);
  const trends = buildTrends(errors, 30);

  const diagnostics: Mt5ErrorAiDiagnostic[] = [];
  for (const e of errors.slice(0, 30)) {
    diagnostics.push(proposeDiagnostic(e));
  }

  const workflow = buildWorkflow(errors, diagnostics[0] ?? null);

  const incidents: Mt5ErrorIncident[] = [];
  for (const e of errors.filter((x) => x.severity === "Emergency" || x.severity === "Critical").slice(0, 12)) {
    const minutesUnresolved = e.resolutionStatus === "Resolved" ? 0 : Math.max(5, Math.floor((Date.now() - new Date(e.firstSeenAt).getTime()) / 60_000));
    const decision = escalationDecision({
      severity: e.severity,
      unsafeTrading: e.errorType === "Unsafe Trading Condition" || e.statusAfter === "Unsafe",
      repeatCount: e.repeatCount,
      affectedAccounts: e.brokerId ? 4 : 10,
      brokerWide: Boolean(e.brokerId && e.repeatCount >= 6),
      autoRemediationFailed: stable(e.repeatCount) > 0.85,
      minutesUnresolved
    });
    if (!decision.escalate) continue;
    incidents.push(incidentFrom(e, decision.assignedRole, "Triage immediately; run diagnostics; apply safe remediation; verify stability; audit action."));
  }

  const resolutions: Mt5ErrorResolution[] = errors
    .filter((e) => e.resolutionStatus === "Resolved")
    .slice(0, 30)
    .map((e, idx) => ({
      id: `res-${String(idx + 1).padStart(3, "0")}`,
      errorId: e.errorId,
      resolutionAction: e.sourceModule === "Broker Connection" ? "Restart broker session worker" : e.sourceModule === "EA Bridge" ? "Rotate bridge token" : "Run diagnostics and apply remediation",
      resolutionNote: "Resolution validated by stable heartbeat and successful test order routing.",
      resolvedBy: idx % 2 === 0 ? "infra.oncall" : "trading.ops",
      resolvedAt: e.updatedAt,
      reopenedBy: null,
      reopenedAt: null,
      reopenReason: null,
      createdAt: e.updatedAt
    }));

  const audit: AuditRecord[] = [
    {
      id: "audit-001",
      userId: "infra.oncall",
      timestamp: isoNow(-25),
      action: "SYNC_ERRORS",
      module: "MT5 Error Logs",
      entityId: "SYNC",
      oldValue: null,
      newValue: { syncedAt: isoNow(-25) },
      ipAddress: "system",
      userAgent: "autonomous-mt5-error-logs"
    },
    {
      id: "audit-002",
      userId: "risk.manager",
      timestamp: isoNow(-20),
      action: "ESCALATE_INCIDENT",
      module: "MT5 Error Logs",
      entityId: "INCIDENT",
      oldValue: null,
      newValue: { reason: "Unsafe trading condition due to repeated execution backpressure." },
      ipAddress: "system",
      userAgent: "autonomous-mt5-error-logs"
    },
    {
      id: "audit-003",
      userId: "trading.ops",
      timestamp: isoNow(-16),
      action: "MARK_RESOLVED",
      module: "MT5 Error Logs",
      entityId: "ERR-1018",
      oldValue: { resolutionStatus: "Unresolved" },
      newValue: { resolutionStatus: "Resolved" },
      ipAddress: "system",
      userAgent: "autonomous-mt5-error-logs"
    }
  ];

  const summaryNumbers = {
    total: errors.length,
    critical: errors.filter((e) => e.severity === "Critical" || e.severity === "Emergency").length,
    warning: errors.filter((e) => e.severity === "Warning").length,
    resolved: errors.filter((e) => e.resolutionStatus === "Resolved").length,
    unresolved: errors.filter((e) => e.resolutionStatus !== "Resolved").length,
    repeated: fingerprints.filter((f) => f.repeatCount >= 10).length,
    terminal: errors.filter((e) => e.sourceModule === "MT5 Terminal").length,
    broker: errors.filter((e) => e.sourceModule === "Broker Connection").length,
    bridge: errors.filter((e) => e.sourceModule === "EA Bridge").length,
    execution: errors.filter((e) => e.errorType.includes("Execution")).length,
    sync: errors.filter((e) => e.sourceModule === "Trade Synchronization" || e.sourceModule === "Account Sync").length,
    aiRisk: Math.round(errors.reduce((sum, e) => sum + e.aiRiskScore, 0) / Math.max(1, errors.length))
  };

  const aiRiskScore = {
    score: summaryNumbers.aiRisk,
    rating:
      summaryNumbers.aiRisk >= 85 ? ("Critical" as const) :
      summaryNumbers.aiRisk >= 70 ? ("High Risk" as const) :
      summaryNumbers.aiRisk >= 55 ? ("Degraded" as const) :
      summaryNumbers.aiRisk >= 40 ? ("Healthy" as const) :
      ("Excellent" as const),
    factors: { repeated: summaryNumbers.repeated, critical: summaryNumbers.critical, unresolved: summaryNumbers.unresolved }
  };

  const kpis: Mt5ErrorKpi[] = [
    { label: "Total Errors", value: String(summaryNumbers.total), status: "Healthy", detail: "All captured MT5-related errors in current window.", updatedAt: isoNow() },
    { label: "Critical Errors", value: String(summaryNumbers.critical), status: summaryNumbers.critical > 0 ? "Critical" : "Healthy", detail: "Critical/Emergency errors requiring urgent attention.", updatedAt: isoNow() },
    { label: "Warning Errors", value: String(summaryNumbers.warning), status: summaryNumbers.warning > 20 ? "Watch" : "Healthy", detail: "Warnings that may cascade into higher severity.", updatedAt: isoNow() },
    { label: "Resolved Errors", value: String(summaryNumbers.resolved), status: "Healthy", detail: "Errors marked resolved with an audit trail.", updatedAt: isoNow() },
    { label: "Unresolved Errors", value: String(summaryNumbers.unresolved), status: summaryNumbers.unresolved > 40 ? "Degraded" : "Watch", detail: "Errors still unresolved or reopened.", updatedAt: isoNow() },
    { label: "Repeated Errors", value: String(summaryNumbers.repeated), status: summaryNumbers.repeated > 8 ? "Degraded" : "Watch", detail: "High-frequency fingerprints indicating recurring issues.", updatedAt: isoNow() },
    { label: "Terminal Errors", value: String(summaryNumbers.terminal), status: "Healthy", detail: "MT5 terminal runtime/heartbeat errors.", updatedAt: isoNow() },
    { label: "Broker Errors", value: String(summaryNumbers.broker), status: summaryNumbers.broker > 15 ? "Watch" : "Healthy", detail: "Broker connectivity/login errors.", updatedAt: isoNow() },
    { label: "EA Bridge Errors", value: String(summaryNumbers.bridge), status: summaryNumbers.bridge > 12 ? "Watch" : "Healthy", detail: "Bridge authentication and routing errors.", updatedAt: isoNow() },
    { label: "Order Execution Errors", value: String(summaryNumbers.execution), status: summaryNumbers.execution > 10 ? "Degraded" : "Healthy", detail: "Execution/queue/order failures affecting fills.", updatedAt: isoNow() },
    { label: "Sync Errors", value: String(summaryNumbers.sync), status: summaryNumbers.sync > 10 ? "Watch" : "Healthy", detail: "Account/trade synchronization mismatches.", updatedAt: isoNow() },
    { label: "AI Risk Score", value: String(summaryNumbers.aiRisk), status: summaryNumbers.aiRisk >= 80 ? "Critical" : summaryNumbers.aiRisk >= 65 ? "Degraded" : summaryNumbers.aiRisk >= 50 ? "Watch" : "Healthy", detail: "Composite risk from severity, repeats, and blast radius.", updatedAt: isoNow() }
  ];

  return { errors, fingerprints, categories, trends, workflow, diagnostics, incidents, resolutions, audit, kpis, aiRiskScore };
}
