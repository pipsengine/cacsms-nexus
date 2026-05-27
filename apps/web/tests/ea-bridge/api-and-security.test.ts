import {describe, expect, it, beforeEach } from "vitest";
import { seedAccountSyncStore, seedEaBridgeStore, seedMt5ControlCenterStore, seedTerminalStatusStore } from "@/tests/helpers/seed-api-stores";

import {
  acknowledgeTradeCommand,
  acceptBridgeMessage,
  authorizeEaIngestion,
  autoRemediateBridge,
  bridgeAudits,
  buildEaBridgeResponse,
  eaBridgeRole,
  ingestSignedBridgeEvent,
  pendingTradeCommands,
  publicBridgeInstance,
  queueTradeCommand,
  resetEaBridgeState,
  rotateBridgeToken,
  reissueEaPairingCredentials,
  setBridgeTrading,
  signBridgeEnvelope,
  testEaPairingCredentials
} from "@/app/api/mt5/ea-bridge/_lib/store";
import { EaIngestionAuthError, hashIngestionToken } from "@/app/api/mt5/ea-bridge/_lib/ingestion-auth";
import { createEaBridgeSeed } from "@/tests/fixtures/ea-bridge.fixture";
import type { SignedBridgeEnvelope, TerminalMessageType, TradeCommand } from "@/modules/mt5-infrastructure-and-broker-connectivity/ea-bridge/types/ea-bridge.types";

function signedEnvelope(messageType: TerminalMessageType, payload: unknown, nonce: string): SignedBridgeEnvelope {
  const unsigned = {
    instanceId: "ea-ld4-01",
    messageType,
    timestamp: new Date().toISOString(),
    nonce,
    payloadJson: JSON.stringify(payload)
  };
  return { ...unsigned, signature: signBridgeEnvelope(unsigned, "terminal-signing-secret") };
}

function withTerminalCredentials<T>(work: (request: Request) => T) {
  const token = process.env.MT5_EA_INGESTION_TOKEN;
  const signingSecret = process.env.MT5_EA_SIGNING_SECRET_EA_LD4_01;
  process.env.MT5_EA_INGESTION_TOKEN = "terminal-ingestion-token";
  process.env.MT5_EA_SIGNING_SECRET_EA_LD4_01 = "terminal-signing-secret";
  try {
    return work(new Request("http://localhost/api/mt5/ea-bridge/ingest/heartbeat", { headers: { authorization: "Bearer terminal-ingestion-token" } }));
  } finally {
    if (token === undefined) delete process.env.MT5_EA_INGESTION_TOKEN; else process.env.MT5_EA_INGESTION_TOKEN = token;
    if (signingSecret === undefined) delete process.env.MT5_EA_SIGNING_SECRET_EA_LD4_01; else process.env.MT5_EA_SIGNING_SECRET_EA_LD4_01 = signingSecret;
  }
}

describe("EA bridge domain controls", () => {
  beforeEach(() => {
    seedMt5ControlCenterStore();
    seedTerminalStatusStore();
    seedAccountSyncStore();
    seedEaBridgeStore();
  });
  it("returns operational bridge sections", () => {
    const response = buildEaBridgeResponse("Infrastructure Admin");
    expect(response.kpis).toHaveLength(12);
    expect(response.workflow).toHaveLength(10);
    expect(response.instances.length).toBeGreaterThan(0);
    expect(response.sessions.length).toBeGreaterThan(0);
    expect(response.messages.length).toBeGreaterThan(0);
    expect(response.commands.length).toBeGreaterThan(0);
    expect(response.instances.every((instance) => instance.bridgeTokenHash === "[redacted]")).toBe(true);
  });

  it("protects token rotation and trading-channel writes by role and confirmation", () => {
    expect(eaBridgeRole(new Request("http://localhost/api/mt5/ea-bridge"))).toBe("Read-Only Viewer");
    expect(() => rotateBridgeToken("ea-ld4-01", "Read-Only Viewer", true)).toThrow(/not authorized/);
    expect(() => rotateBridgeToken("ea-ld4-01", "Infrastructure Admin", false)).toThrow(/Confirmation/);
    expect(() => reissueEaPairingCredentials("ea-ld4-01", "Read-Only Viewer", true)).toThrow(/not authorized/);
    expect(() => reissueEaPairingCredentials("ea-ld4-01", "Infrastructure Admin", false)).toThrow(/Confirmation/);
    const receipt = reissueEaPairingCredentials("ea-ld4-01", "Infrastructure Admin", true, new Request("http://localhost:3000/api/mt5/ea-bridge/instances/ea-ld4-01/reissue-pairing"));
    expect(receipt.ingestionToken).toBeTruthy();
    expect(receipt.signingSecret).toBeTruthy();
    expect(receipt.eaInstanceId).toBe("ea-ld4-01");
    expect(bridgeAudits().some((record) => record.action === "EA pairing credentials reissued")).toBe(true);
    expect(() => setBridgeTrading("ea-ld4-01", false, "Read-Only Viewer", true)).toThrow(/not authorized/);
  });

  it("rejects invalid payloads and duplicate commands", () => {
    const seed = createEaBridgeSeed();
    const invalidMessage = { ...seed.messages[0], id: "invalid-new", messageUuid: "invalid-new", nonce: "new-invalid", signed: false, createdAt: new Date().toISOString() };
    expect(acceptBridgeMessage(invalidMessage).accepted).toBe(false);
    expect(queueTradeCommand({ ...seed.commands[0] }, "Trading Admin", true).accepted).toBe(false);
  });

  it("fails closed for unauthenticated EA ingestion and command admission", () => {
    const original = process.env.MT5_EA_INGESTION_SECRET;
    delete process.env.MT5_EA_INGESTION_SECRET;
    expect(() => authorizeEaIngestion({
      request: new Request("http://localhost/api/mt5/ea-bridge/messages"),
      endpointName: "ingest/heartbeat",
      instanceId: "ea-ld4-01"
    })).toThrow(EaIngestionAuthError);
    process.env.MT5_EA_INGESTION_SECRET = "bridge-secret";
    expect(() => authorizeEaIngestion({
      request: new Request("http://localhost/api/mt5/ea-bridge/messages", { headers: { authorization: "Bearer bridge-secret" } }),
      endpointName: "ingest/heartbeat",
      instanceId: "ea-ld4-01"
    })).not.toThrow();
    if (original === undefined) delete process.env.MT5_EA_INGESTION_SECRET; else process.env.MT5_EA_INGESTION_SECRET = original;
    expect(() => queueTradeCommand({ ...createEaBridgeSeed().commands[0], commandUuid: "new-command" }, "Read-Only Viewer", true)).toThrow(/not authorized/);
  });

  it("accepts ingestion token when secrets store is missing but instance bridgeTokenHash matches", () => {
    const originalToken = process.env.MT5_EA_INGESTION_TOKEN;
    const originalSecret = process.env.MT5_EA_INGESTION_SECRET;
    delete process.env.MT5_EA_INGESTION_TOKEN;
    delete process.env.MT5_EA_INGESTION_SECRET;

    const seed = createEaBridgeSeed();
    const token = "bridge-secret";
    seed.instances[0] = { ...seed.instances[0], bridgeTokenHash: `sha256:${hashIngestionToken(token)}` };
    seed.issuedCredentialSecrets = {};
    resetEaBridgeState(seed);

    expect(() => authorizeEaIngestion({
      request: new Request("http://localhost/api/mt5/ea-bridge/ingest/heartbeat", { headers: { authorization: `Bearer ${token}` } }),
      endpointName: "ingest/heartbeat",
      instanceId: seed.instances[0].id
    })).not.toThrow();

    if (originalToken === undefined) delete process.env.MT5_EA_INGESTION_TOKEN; else process.env.MT5_EA_INGESTION_TOKEN = originalToken;
    if (originalSecret === undefined) delete process.env.MT5_EA_INGESTION_SECRET; else process.env.MT5_EA_INGESTION_SECRET = originalSecret;
  });

  it("accepts reissued pairing credentials through test pairing heartbeat", () => {
    const receipt = reissueEaPairingCredentials("ea-ld4-01", "Infrastructure Admin", true, new Request("http://127.0.0.1:3000/api/mt5/ea-bridge/instances/ea-ld4-01/reissue-pairing"));
    const result = testEaPairingCredentials(
      receipt.eaInstanceId,
      receipt.ingestionToken,
      receipt.signingSecret,
      "Infrastructure Admin",
      true,
      new Request("http://127.0.0.1:3000/api/mt5/ea-bridge/instances/ea-ld4-01/test-pairing")
    );
    expect(result.accepted).toBe(true);
    expect(result.code).toBe("accepted");
    expect(result.diagnostics?.matchedEaInstanceId).toBe("ea-ld4-01");
  });

  it("accepts ingestion tokens from x-ingestion-token header", () => {
    const receipt = reissueEaPairingCredentials("ea-ld4-01", "Infrastructure Admin", true);
    expect(() => authorizeEaIngestion({
      request: new Request("http://localhost/api/mt5/ea-bridge/ingest/heartbeat", {
        headers: { "x-ingestion-token": receipt.ingestionToken }
      }),
      endpointName: "ingest/heartbeat",
      instanceId: receipt.eaInstanceId,
      accountLogin: receipt.accountLogin
    })).not.toThrow();
  });

  it("ingests signed terminal telemetry and blocks replayed or tampered envelopes", () => {
    withTerminalCredentials((request) => {
      const nonce = `heartbeat-${Date.now()}`;
      const heartbeat = signedEnvelope("Heartbeat", {
        terminalName: "MT5-Live-01",
        accountLogin: "73018421",
        brokerConnected: true,
        marketDataActive: true,
        tradingEnabled: true,
        latencyMs: 29
      }, nonce);
      expect(ingestSignedBridgeEvent(heartbeat, "Heartbeat", request).accepted).toBe(true);
      expect(publicBridgeInstance("ea-ld4-01").tradingChannelEnabled).toBe(true);
      expect(() => ingestSignedBridgeEvent(heartbeat, "Heartbeat", request)).toThrow(/Nonce replay/);
      const tampered = signedEnvelope("Heartbeat", {
        terminalName: "MT5-Live-01",
        accountLogin: "73018421",
        brokerConnected: true,
        marketDataActive: true,
        tradingEnabled: true,
        latencyMs: 29
      }, `tampered-${Date.now()}`);
      tampered.payloadJson = tampered.payloadJson.replace("29", "900");
      expect(() => ingestSignedBridgeEvent(tampered, "Heartbeat", request)).toThrow(/Signed payload/);
      const snapshot = signedEnvelope("Account Snapshot", {
        accountLogin: "73018421",
        balance: 284200,
        equity: 286410,
        credit: 0,
        margin: 14280,
        freeMargin: 272130,
        marginLevel: 2005.7,
        floatingProfitLoss: 2210,
        openPositionsCount: 2,
        pendingOrdersCount: 1,
        tradingAllowed: true,
        expertTradingAllowed: true
      }, `snapshot-${Date.now()}`);
      expect(ingestSignedBridgeEvent(snapshot, "Account Snapshot", request).accountSync?.reconciliation?.reconciliationStatus).toBe("Matched");
    });
  });

  it("delivers only approved pending commands and accepts signed terminal feedback", () => {
    withTerminalCredentials((request) => {
      const timestamp = Date.now();
      const command: TradeCommand = {
        id: `cmd-live-${timestamp}`,
        commandUuid: `command-live-${timestamp}`,
        eaInstanceId: "ea-ld4-01",
        accountId: "acct-1",
        accountLogin: "73018421",
        symbol: "XAUUSD",
        commandType: "Limit",
        direction: "Sell",
        volume: 0.07,
        requestedPrice: 2358.5,
        riskApprovalStatus: "Approved",
        deliveryStatus: "Delivered",
        executionStatus: "Executed",
        responseTimeMs: 11,
        strategyId: `terminal-test-${timestamp}`,
        signalTimestamp: new Date(timestamp).toISOString(),
        createdAt: new Date(timestamp).toISOString()
      };
      expect(queueTradeCommand(command, "Trading Admin", true).accepted).toBe(true);
      expect(pendingTradeCommands("ea-ld4-01", signedEnvelope("Command Poll", {}, `poll-before-${timestamp}`), request).commands.some((item) => item.commandUuid === command.commandUuid)).toBe(true);
      const acknowledgement = signedEnvelope("Trade Execution Result", {
        commandUuid: command.commandUuid,
        status: "Executed",
        responseTimeMs: 42
      }, `ack-${timestamp}`);
      const result = acknowledgeTradeCommand("ea-ld4-01", acknowledgement, request);
      expect(result.command.executionStatus).toBe("Executed");
      expect(result.command.deliveryStatus).toBe("Delivered");
      expect(pendingTradeCommands("ea-ld4-01", signedEnvelope("Command Poll", {}, `poll-after-${timestamp}`), request).commands.some((item) => item.commandUuid === command.commandUuid)).toBe(false);
    });
  });

  it("ingests signed position and pending order updates into account sync", () => {
    withTerminalCredentials((request) => {
      const positions = signedEnvelope("Position Update", {
        schemaVersion: "1.0",
        accountLogin: "73018421",
        positions: [
          {
            positionTicket: "9001001",
            symbol: "EURUSD.raw",
            direction: "Buy",
            volume: 1.5,
            entryPrice: 1.0842,
            currentPrice: 1.0851,
            stopLoss: 1.081,
            takeProfit: 1.09,
            profitLoss: 135,
            swap: -2,
            commission: -4,
            openTime: new Date().toISOString()
          }
        ]
      }, `positions-${Date.now()}`);
      const positionResult = ingestSignedBridgeEvent(positions, "Position Update", request);
      expect(positionResult.accountSync?.positions).toBe(1);

      const orders = signedEnvelope("Pending Order Update", {
        schemaVersion: "1.0",
        accountLogin: "73018421",
        orders: [
          {
            orderTicket: "9002001",
            symbol: "GBPUSD.raw",
            orderType: "Buy Limit",
            direction: "Buy",
            volume: 0.5,
            price: 1.271,
            stopLoss: 1.265,
            takeProfit: 1.281,
            createdTime: new Date().toISOString(),
            expiryTime: new Date(Date.now() + 86_400_000).toISOString()
          }
        ]
      }, `orders-${Date.now()}`);
      const orderResult = ingestSignedBridgeEvent(orders, "Pending Order Update", request);
      expect(orderResult.accountSync?.orders).toBe(1);
    });
  });

  it("signs envelopes with short base64url pairing secrets (43-byte HMAC block padding)", () => {
    const secret = "v-wVxAXQ-qAOPqOSWCj11UFU77bnKyYhPhu6DAXt9XE";
    const unsigned = {
      instanceId: "ea-cacsms-mt5-0001",
      messageType: "Heartbeat" as const,
      timestamp: "2026-05-26T15:38:08.000Z",
      nonce: "mt5-heartbeat-test",
      payloadJson: "{\"terminalName\":\"Office Terminal\",\"accountLogin\":\"52877052\",\"brokerConnected\":true,\"marketDataActive\":true,\"tradingEnabled\":true,\"latencyMs\":12}"
    };
    expect(secret.length).toBe(43);
    expect(signBridgeEnvelope(unsigned, secret)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("retries only safe undelivered messages and audits changes", () => {
    const before = bridgeAudits().length;
    const result = autoRemediateBridge("bridge-diag-2", "Infrastructure Admin", true);
    rotateBridgeToken("ea-ny4-02", "Infrastructure Admin", true);
    expect(result.safeMessagesReplayed).toBeGreaterThanOrEqual(1);
    expect(bridgeAudits().length).toBeGreaterThanOrEqual(before + 2);
    expect(bridgeAudits().some((record) => record.action === "Bridge token rotated")).toBe(true);
    expect(JSON.stringify(bridgeAudits())).not.toContain("stored-hash-only");
    expect(publicBridgeInstance("ea-ny4-02").bridgeTokenHash).toBe("[redacted]");
  });
});
