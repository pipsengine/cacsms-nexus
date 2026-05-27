"use client";

/** Manual controls limited to operational start/stop — sync is always autonomous. */
export const MT5_MANUAL_CONTROL_ACTIONS = new Set([
  "pause routing",
  "resume routing",
  "emergency stop",
  "start routing",
  "stop routing",
  "connect terminal",
  "disconnect terminal",
  "enable trading channel",
  "disable trading channel",
  "disable account trading",
  "enable account trading",
  "disable trading"
]);

export function isManualControlAction(label: string) {
  return MT5_MANUAL_CONTROL_ACTIONS.has(label.trim().toLowerCase());
}

export function requiresOperatorConfirm(label: string) {
  return isManualControlAction(label);
}

export const AUTONOMOUS_SYNC_NOTICE =
  "Autonomous sync is active. Symbol, account, and routing state refresh automatically from live EA telemetry — no manual sync required.";

export const SLIPPAGE_AUTONOMOUS_NOTICE =
  "Autonomous slippage monitoring is active. Executions are captured automatically from order-router feedback when NexusBridgeEA confirms fills — no manual import required.";
