import { describe, expect, it, beforeEach } from "vitest";

import { accounts } from "@/app/api/mt5/account-sync/_lib/store";
import { bridgeSessions, ingestSignedBridgeEvent, publicBridgeInstance, signBridgeEnvelope } from "@/app/api/mt5/ea-bridge/_lib/store";
import { POST as onboardTerminal } from "@/app/api/mt5/onboarding/terminals/route";
import { getTerminal } from "@/app/api/mt5/_lib/store";
import { terminalRecord } from "@/app/api/mt5/terminal-status/_lib/store";
import type { SignedBridgeEnvelope } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";
import type { TerminalOnboardingInput, TerminalOnboardingReceipt } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import { seedAccountSyncStore, seedEaBridgeStore, seedEaTerminalHubStore, seedMt5ControlCenterStore, seedTerminalStatusStore } from "@/tests/helpers/seed-api-stores";

function onboardingInput(suffix: string): TerminalOnboardingInput {
  return {
    terminalUuid: "CACSMS-MT5-0001",
    terminalName: `MT5 Onboarding ${suffix}`,
    brokerId: "broker-icm",
    brokerName: "IC Markets",
    serverName: "ICMarketsSC-MT5",
    accountLogin: `91${suffix}`,
    accountName: `Onboard Account ${suffix}`,
    accountType: "Live",
    currency: "USD",
    leverage: "1:100",
    terminalVersion: "5.00 build 4770",
    hostMachine: `VPS-${suffix}`,
    eaName: "NexusBridgeEA",
    confirmed: true
  };
}

describe("terminal onboarding workflow", () => {
  beforeEach(() => {
    seedMt5ControlCenterStore();
    seedAccountSyncStore();
    seedEaBridgeStore();
    seedTerminalStatusStore();
    seedEaTerminalHubStore();
  });

  it("rejects anonymous terminal provisioning before disclosing registration state", async () => {
    const suffix = String(Date.now());
    const response = await onboardTerminal(new Request("http://localhost/api/mt5/onboarding/terminals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(onboardingInput(suffix))
    }));
    expect(response.status).toBe(403);
  });

  it("provisions terminal, account, monitor and EA pairing then activates only monitoring on signed heartbeat", async () => {
    const suffix = String(Date.now() + 1);
    const response = await onboardTerminal(new Request("http://localhost/api/mt5/onboarding/terminals", {
      method: "POST",
      headers: { "content-type": "application/json", "x-mt5-role": "Infrastructure Admin", "x-user-id": "infra-admin" },
      body: JSON.stringify(onboardingInput(suffix))
    }));
    expect(response.status).toBe(201);
    const receipt = await response.json() as TerminalOnboardingReceipt;
    expect(receipt.ingestionToken).toBeTruthy();
    expect(receipt.signingSecret).toBeTruthy();
    expect(receipt.state).toBe("Awaiting Verified Heartbeat");
    expect(getTerminal(receipt.terminal.id)?.tradingEnabled).toBe(false);
    expect(accounts().find((account) => account.id === receipt.accountId)?.tradingAllowed).toBe(false);
    expect(terminalRecord(receipt.terminal.id).processStatus).toBe("Stopped");
    expect(publicBridgeInstance(receipt.eaInstanceId).bridgeTokenHash).toBe("[redacted]");

    const payload = {
      terminalName: receipt.terminal.terminalName,
      accountLogin: receipt.terminal.accountLogin,
      brokerConnected: true,
      marketDataActive: true,
      tradingEnabled: false,
      latencyMs: 35
    };
    const unsigned = {
      instanceId: receipt.eaInstanceId,
      messageType: "Heartbeat" as const,
      timestamp: new Date().toISOString(),
      nonce: `onboarding-heartbeat-${suffix}`,
      payloadJson: JSON.stringify(payload)
    };
    const envelope: SignedBridgeEnvelope = { ...unsigned, signature: signBridgeEnvelope(unsigned, receipt.signingSecret) };
    const heartbeat = new Request("http://localhost/api/mt5/ea-bridge/ingest/heartbeat", {
      method: "POST",
      headers: { authorization: `Bearer ${receipt.ingestionToken}` }
    });
    expect(ingestSignedBridgeEvent(envelope, "Heartbeat", heartbeat).accepted).toBe(true);
    expect(getTerminal(receipt.terminal.id)?.status).toBe("Healthy");
    expect(getTerminal(receipt.terminal.id)?.tradingEnabled).toBe(false);
    expect(terminalRecord(receipt.terminal.id).processStatus).toBe("Running");
    expect(terminalRecord(receipt.terminal.id).tradingEnabled).toBe(false);
    expect(bridgeSessions().some((session) => session.eaInstanceId === receipt.eaInstanceId && session.authStatus === "Authenticated")).toBe(true);

    const snapshotUnsigned = {
      instanceId: receipt.eaInstanceId,
      messageType: "Account Snapshot" as const,
      timestamp: new Date().toISOString(),
      nonce: `onboarding-snapshot-${suffix}`,
      payloadJson: JSON.stringify({
        accountLogin: receipt.terminal.accountLogin, balance: 125000, equity: 125420, credit: 0, margin: 2100, freeMargin: 123320,
        marginLevel: 5972.38, floatingProfitLoss: 420, openPositionsCount: 1, pendingOrdersCount: 0, tradingAllowed: true, expertTradingAllowed: true
      })
    };
    const snapshot: SignedBridgeEnvelope = { ...snapshotUnsigned, signature: signBridgeEnvelope(snapshotUnsigned, receipt.signingSecret) };
    const synchronized = ingestSignedBridgeEvent(snapshot, "Account Snapshot", heartbeat);
    expect(synchronized.accountSync?.reconciliation.reconciliationStatus).toBe("Matched");
    expect(synchronized.accountSync?.account.tradingAllowed).toBe(false);
  });

  it("auto-generates terminal UUID when omitted from onboarding input", async () => {
    const suffix = String(Date.now() + 2);
    const input = onboardingInput(suffix);
    delete input.terminalUuid;
    const response = await onboardTerminal(new Request("http://localhost/api/mt5/onboarding/terminals", {
      method: "POST",
      headers: { "content-type": "application/json", "x-mt5-role": "Infrastructure Admin", "x-user-id": "infra-admin" },
      body: JSON.stringify(input)
    }));
    expect(response.status).toBe(201);
    const receipt = await response.json() as TerminalOnboardingReceipt;
    expect(receipt.terminal.terminalUuid).toMatch(/^CACSMS-MT5-\d{4}$/i);
    expect(receipt.terminal.id).toBe(receipt.terminal.terminalUuid);
  });
});
