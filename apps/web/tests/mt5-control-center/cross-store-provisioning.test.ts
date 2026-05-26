import { describe, expect, it, beforeEach } from "vitest";

import { accounts, buildAccountSyncResponse } from "@/app/api/mt5/account-sync/_lib/store";
import { brokerConnections, buildBrokerConnectionsResponse } from "@/app/api/mt5/broker-connections/_lib/store";
import { buildEaBridgeResponse, bridgeInstance, ingestSignedBridgeEvent, publicBridgeInstances, resetEaBridgeState, signBridgeEnvelope } from "@/app/api/mt5/ea-bridge/_lib/store";
import { buildEaTerminalHubResponse } from "@/app/api/mt5/ea-terminal-hub/_lib/store";
import { POST as registerBrokerRoute } from "@/app/api/mt5/brokers/route";
import { buildControlCenter, getAccounts, getBrokers, getTerminals } from "@/app/api/mt5/_lib/store";
import { POST as onboardTerminalRoute } from "@/app/api/mt5/onboarding/terminals/route";
import { buildTerminalStatusResponse, terminalRecord } from "@/app/api/mt5/terminal-status/_lib/store";
import { createAccountSyncSeed } from "@/modules/mt5-infrastructure-and-broker-connectivity/account-sync/data/account-sync.mock";
import { createBrokerConnectionsSeed } from "@/modules/mt5-infrastructure-and-broker-connectivity/broker-connections/data/broker-connections.mock";
import { createEaBridgeSeed } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/data/ea-bridge.mock";
import { createEaTerminalHubSeed } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-terminal-hub/data/ea-terminal-hub.mock";
import { createMt5Seed } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/data/mt5-control-center.mock";
import { createTerminalStatusSeed } from "@/modules/mt5-infrastructure-and-broker-connectivity/terminal-status/data/terminal-status.mock";
import type { SignedBridgeEnvelope } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";
import type { TerminalOnboardingInput, TerminalOnboardingReceipt } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";
import { resetAccountSyncState } from "@/app/api/mt5/account-sync/_lib/store";
import { resetBrokerConnectionsState } from "@/app/api/mt5/broker-connections/_lib/store";
import { resetEaTerminalHubState } from "@/app/api/mt5/ea-terminal-hub/_lib/store";
import { resetMt5ControlCenterState } from "@/app/api/mt5/_lib/store";
import { resetTerminalStatusState } from "@/app/api/mt5/terminal-status/_lib/store";

const adminHeaders = {
  "content-type": "application/json",
  "x-mt5-role": "Infrastructure Admin",
  "x-user-id": "infra-admin"
};

function resetInfrastructureStores() {
  resetMt5ControlCenterState(createMt5Seed());
  resetBrokerConnectionsState(createBrokerConnectionsSeed());
  resetAccountSyncState(createAccountSyncSeed());
  resetTerminalStatusState(createTerminalStatusSeed());
  resetEaBridgeState(createEaBridgeSeed());
  resetEaTerminalHubState(createEaTerminalHubSeed());
}

describe("infrastructure registration cross-store provisioning", () => {
  beforeEach(() => resetInfrastructureStores());

  it("registers a broker in control center and broker connections", async () => {
    const response = await registerBrokerRoute(new Request("http://localhost/api/mt5/brokers", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        brokerName: "IC Markets",
        brokerCode: "ICM",
        mt5ServerName: "ICMarketsSC-MT5",
        serverRegion: "London",
        connectionMode: "MT5 Gateway",
        confirmed: true
      })
    }));
    expect(response.status).toBe(201);
    const broker = await response.json() as { id: string; brokerName: string; mt5ServerName: string };

    expect(getBrokers()).toHaveLength(1);
    expect(getBrokers()[0]?.id).toBe(broker.id);
    expect(brokerConnections()).toHaveLength(1);
    expect(brokerConnections()[0]?.id).toBe(broker.id);
    expect(brokerConnections()[0]?.mt5ServerName).toBe("ICMarketsSC-MT5");

    const controlCenter = buildControlCenter("Infrastructure Admin");
    const brokerDashboard = buildBrokerConnectionsResponse("Infrastructure Admin");
    expect(controlCenter.brokers.some((item) => item.id === broker.id)).toBe(true);
    expect(brokerDashboard.brokers.some((item) => item.id === broker.id)).toBe(true);
  });

  it("onboards a terminal across all infrastructure module stores", async () => {
    const brokerResponse = await registerBrokerRoute(new Request("http://localhost/api/mt5/brokers", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        brokerName: "IC Markets",
        brokerCode: "ICM",
        mt5ServerName: "ICMarketsSC-MT5",
        serverRegion: "London",
        connectionMode: "MT5 Gateway",
        confirmed: true
      })
    }));
    const broker = await brokerResponse.json() as { id: string };

    const suffix = String(Date.now());
    const input: TerminalOnboardingInput = {
      terminalName: `Cross Store ${suffix}`,
      brokerId: broker.id,
      brokerName: "IC Markets",
      serverName: "ICMarketsSC-MT5",
      accountLogin: `88${suffix}`,
      accountName: `Account ${suffix}`,
      accountType: "Live",
      currency: "USD",
      leverage: "1:100",
      terminalVersion: "5.00 build 4770",
      hostMachine: `VPS-${suffix}`,
      eaName: "NexusBridgeEA",
      confirmed: true
    };

    const response = await onboardTerminalRoute(new Request("http://localhost/api/mt5/onboarding/terminals", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify(input)
    }));
    expect(response.status).toBe(201);
    const receipt = await response.json() as TerminalOnboardingReceipt;

    expect(getTerminals()).toHaveLength(1);
    expect(getTerminals()[0]?.id).toBe(receipt.terminal.id);
    expect(getAccounts()).toHaveLength(1);
    expect(getAccounts()[0]?.accountLogin).toBe(input.accountLogin);
    expect(accounts()).toHaveLength(1);
    expect(accounts()[0]?.terminalId).toBe(receipt.terminal.id);
    expect(terminalRecord(receipt.terminal.id).terminalUuid).toBe(receipt.terminal.terminalUuid);
    expect(publicBridgeInstances()).toHaveLength(1);
    expect(publicBridgeInstances()[0]?.id).toBe(receipt.eaInstanceId);

    const hub = await buildEaTerminalHubResponse("Infrastructure Admin");
    expect(hub.terminals.some((terminal) => terminal.terminalId === receipt.terminal.id)).toBe(true);

    const controlCenter = buildControlCenter("Infrastructure Admin");
    const accountSync = buildAccountSyncResponse("Infrastructure Admin");
    const terminalStatus = buildTerminalStatusResponse("Infrastructure Admin");
    const eaBridge = buildEaBridgeResponse("Infrastructure Admin");

    expect(controlCenter.terminals.some((terminal) => terminal.id === receipt.terminal.id)).toBe(true);
    expect(accountSync.accounts.some((account) => account.id === receipt.accountId)).toBe(true);
    expect(terminalStatus.terminals.some((terminal) => terminal.terminalId === receipt.terminal.id)).toBe(true);
    expect(eaBridge.instances.some((instance) => instance.id === receipt.eaInstanceId)).toBe(true);
  });

  it("recovers partial onboarding when satellite stores still hold orphan bindings", async () => {
    const brokerResponse = await registerBrokerRoute(new Request("http://localhost/api/mt5/brokers", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        brokerName: "IC Markets",
        brokerCode: "ICM",
        mt5ServerName: "ICMarketsSC-Demo",
        serverRegion: "London",
        connectionMode: "MT5 Gateway",
        confirmed: true
      })
    }));
    const broker = await brokerResponse.json() as { id: string };
    const suffix = String(Date.now() + 501);
    const accountLogin = `52${suffix}`;
    const terminalUuid = "CACSMS-MT5-0099";

    const { provisionAccountBinding } = await import("@/app/api/mt5/account-sync/_lib/store");
    const { provisionTerminalMonitor } = await import("@/app/api/mt5/terminal-status/_lib/store");
    provisionAccountBinding({
      accountId: `acct-orphan-${suffix}`,
      terminalId: terminalUuid,
      terminalName: "Orphan Terminal",
      brokerId: broker.id,
      brokerName: "IC Markets",
      serverName: "ICMarketsSC-Demo",
      accountLogin,
      accountName: "Orphan Account",
      accountType: "Demo",
      currency: "USD",
      leverage: "1:100"
    }, "Infrastructure Admin");
    provisionTerminalMonitor({
      terminal: {
        id: terminalUuid,
        terminalUuid,
        terminalName: "Orphan Terminal",
        brokerId: broker.id,
        brokerName: "IC Markets",
        serverName: "ICMarketsSC-Demo",
        accountLogin,
        accountType: "Demo",
        terminalVersion: "5.00 build 4770",
        hostMachine: "VPS",
        status: "Syncing",
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        latencyMs: 0,
        uptimeSeconds: 0,
        lastHeartbeatAt: new Date().toISOString(),
        autoRestartEnabled: true,
        tradingEnabled: false
      },
      accountId: `acct-orphan-${suffix}`,
      currency: "USD"
    }, "Infrastructure Admin");

    expect(getTerminals()).toHaveLength(0);
    expect(accounts()).toHaveLength(1);

    const response = await onboardTerminalRoute(new Request("http://localhost/api/mt5/onboarding/terminals", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        terminalName: "Recovered Terminal",
        brokerId: broker.id,
        brokerName: "IC Markets",
        serverName: "ICMarketsSC-Demo",
        accountLogin,
        accountName: "Recovered Account",
        accountType: "Demo",
        currency: "USD",
        leverage: "1:100",
        terminalVersion: "5.00 build 4770",
        hostMachine: "AdminCenter",
        eaName: "NexusBridgeEA",
        terminalUuid,
        confirmed: true
      } satisfies TerminalOnboardingInput)
    }));

    expect(response.status).toBe(201);
    const receipt = await response.json() as TerminalOnboardingReceipt;
    expect(receipt.terminal.terminalUuid).toBe(terminalUuid);
    expect(getTerminals()).toHaveLength(1);
    expect(getAccounts()).toHaveLength(1);
    expect(accounts()).toHaveLength(1);
    expect(publicBridgeInstances()).toHaveLength(1);
  });

  it("reconciles missing EA bridge instances from control center registrations", async () => {
    const brokerResponse = await registerBrokerRoute(new Request("http://localhost/api/mt5/brokers", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        brokerName: "IC Markets",
        brokerCode: "ICM",
        mt5ServerName: "ICMarketsSC-Demo",
        serverRegion: "London",
        connectionMode: "MT5 Gateway",
        confirmed: true
      })
    }));
    const broker = await brokerResponse.json() as { id: string };
    const suffix = String(Date.now() + 888);
    const accountLogin = `54${suffix}`;
    const terminalUuid = "CACSMS-MT5-0102";

    const { registerTerminal, bindRegisteredTerminalAccount } = await import("@/app/api/mt5/_lib/store");
    resetEaBridgeState(createEaBridgeSeed());
    resetTerminalStatusState(createTerminalStatusSeed());

    const terminal = registerTerminal({
      terminalUuid,
      terminalName: "Reconcile Terminal",
      brokerId: broker.id,
      brokerName: "IC Markets",
      serverName: "ICMarketsSC-Demo",
      accountLogin,
      accountType: "Demo"
    }, "Infrastructure Admin");
    bindRegisteredTerminalAccount({
      terminal,
      accountId: `acct-reconcile-${suffix}`,
      accountLogin,
      accountType: "Demo",
      currency: "USD",
      leverage: "1:100"
    }, "Infrastructure Admin");

    expect(publicBridgeInstances()).toHaveLength(0);

    const { reconcileInfrastructureFromControlCenter } = await import("@/app/api/mt5/_lib/onboarding-cleanup");
    const result = reconcileInfrastructureFromControlCenter();
    expect(result.repaired.some((entry) => entry.startsWith("ea-bridge:"))).toBe(true);
    expect(publicBridgeInstances()).toHaveLength(1);
    expect(terminalRecord(terminal.id).terminalUuid).toBe(terminalUuid);
  });

  it("retains EA bridge credentials in persisted module state after store reset", async () => {
    const brokerResponse = await registerBrokerRoute(new Request("http://localhost/api/mt5/brokers", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        brokerName: "IC Markets",
        brokerCode: "ICM",
        mt5ServerName: "ICMarketsSC-MT5",
        serverRegion: "London",
        connectionMode: "MT5 Gateway",
        confirmed: true
      })
    }));
    const broker = await brokerResponse.json() as { id: string };
    const suffix = String(Date.now() + 99);

    const onboardResponse = await onboardTerminalRoute(new Request("http://localhost/api/mt5/onboarding/terminals", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        terminalName: `Credential Persist ${suffix}`,
        brokerId: broker.id,
        brokerName: "IC Markets",
        serverName: "ICMarketsSC-MT5",
        accountLogin: `77${suffix}`,
        accountName: `Account ${suffix}`,
        accountType: "Live",
        currency: "USD",
        leverage: "1:100",
        terminalVersion: "5.00 build 4770",
        hostMachine: `VPS-${suffix}`,
        eaName: "NexusBridgeEA",
        confirmed: true
      } satisfies TerminalOnboardingInput)
    }));
    const receipt = await onboardResponse.json() as TerminalOnboardingReceipt;

    const snapshot = createEaBridgeSeed();
    snapshot.instances = [bridgeInstance(receipt.eaInstanceId)];
    snapshot.issuedCredentialSecrets = {
      [receipt.eaInstanceId]: {
        ingestionTokenHash: (await import("node:crypto")).createHash("sha256").update(receipt.ingestionToken).digest("hex"),
        signingSecret: receipt.signingSecret
      }
    };

    resetEaBridgeState(snapshot);

    const payload = {
      terminalName: receipt.terminal.terminalName,
      accountLogin: receipt.terminal.accountLogin,
      brokerConnected: true,
      marketDataActive: true,
      tradingEnabled: false,
      latencyMs: 42
    };
    const unsigned = {
      instanceId: receipt.eaInstanceId,
      messageType: "Heartbeat" as const,
      timestamp: new Date().toISOString(),
      nonce: `persist-heartbeat-${suffix}`,
      payloadJson: JSON.stringify(payload)
    };
    const envelope: SignedBridgeEnvelope = {
      ...unsigned,
      signature: signBridgeEnvelope(unsigned, receipt.signingSecret)
    };
    const heartbeat = new Request("http://localhost/api/mt5/ea-bridge/ingest/heartbeat", {
      method: "POST",
      headers: { authorization: `Bearer ${receipt.ingestionToken}` }
    });
    expect(ingestSignedBridgeEvent(envelope, "Heartbeat", heartbeat).accepted).toBe(true);
  });
});
