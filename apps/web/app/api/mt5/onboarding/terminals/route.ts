import { accounts, provisionAccountBinding } from "../../account-sync/_lib/store";
import { provisionEaBridgeInstance, publicBridgeInstances } from "../../ea-bridge/_lib/store";
import { provisionEaTerminalHubFromOnboarding } from "../../ea-terminal-hub/_lib/store";
import { failure, ok } from "../../_lib/http";
import { bindRegisteredTerminalAccount, getAccounts, getBroker, getRole, getTerminals, registerTerminal } from "../../_lib/store";
import { provisionTerminalMonitor, terminalRecords } from "../../terminal-status/_lib/store";
import type { TerminalOnboardingInput, TerminalOnboardingReceipt } from "@/modules/mt5-infrastructure-and-broker-connectivity/mt5-control-center/types/mt5-control-center.types";

function validateInput(input: TerminalOnboardingInput) {
  const required = [
    input.terminalUuid, input.terminalName, input.brokerId, input.serverName, input.accountLogin, input.accountName,
    input.accountType, input.currency, input.leverage, input.terminalVersion, input.hostMachine, input.eaName
  ];
  if (required.some((value) => !value?.trim())) throw new Error("Terminal onboarding requires terminal, broker, account, host, and EA identity fields.");
  if (!input.confirmed) throw new Error("Confirmation is required for terminal onboarding.");
  const broker = getBroker(input.brokerId);
  if (!broker) throw new Error("Broker must be registered before onboarding a terminal.");
  if (broker.mt5ServerName !== input.serverName) throw new Error("Terminal server does not match the selected registered broker server.");
  if (getTerminals().some((terminal) => terminal.terminalUuid === input.terminalUuid)) throw new Error("Duplicate terminal registration or missing terminal UUID.");
  if (accounts().some((account) => account.accountLogin === input.accountLogin) || getAccounts().some((account) => account.accountLogin === input.accountLogin)) throw new Error("Duplicate terminal account binding.");
  if (terminalRecords().some((terminal) => terminal.terminalUuid === input.terminalUuid)) throw new Error("Duplicate terminal monitoring registration.");
  if (publicBridgeInstances().some((instance) => instance.accountLogin === input.accountLogin)) throw new Error("EA bridge instance is already bound to this terminal or account.");
  return broker;
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as TerminalOnboardingInput;
    const role = getRole(request);
    if (!["Super Admin", "Infrastructure Admin"].includes(role)) {
      throw new Error(`Role "${role}" is not authorized to perform terminal onboarding.`);
    }
    const broker = validateInput(input);
    const terminal = registerTerminal({ ...input, brokerName: broker.brokerName }, role, request);
    const accountId = `acct-onboard-${Date.now()}`;
    bindRegisteredTerminalAccount({
      terminal, accountId, accountLogin: input.accountLogin, accountType: input.accountType, currency: input.currency, leverage: input.leverage
    }, role, request);
    provisionAccountBinding({
      accountId, terminalId: terminal.id, terminalName: terminal.terminalName, brokerId: terminal.brokerId, brokerName: terminal.brokerName,
      serverName: terminal.serverName, accountLogin: input.accountLogin, accountName: input.accountName, accountType: input.accountType,
      currency: input.currency, leverage: input.leverage
    }, role, request);
    provisionTerminalMonitor({
      terminal, accountId, currency: input.currency, ipAddress: input.ipAddress, operatingSystem: input.operatingSystem, region: input.region,
      timezone: input.timezone, terminalPath: input.terminalPath
    }, role, request);
    const pairing = provisionEaBridgeInstance({ terminal, accountId, eaName: input.eaName, symbolScope: input.symbolScope }, role, true, request);
    provisionEaTerminalHubFromOnboarding({ terminal, terminalPath: input.terminalPath, eaInstanceId: pairing.instance.id }, role, request);
    const receipt: TerminalOnboardingReceipt = {
      terminal, accountId, eaInstanceId: pairing.instance.id, ingestionToken: pairing.ingestionToken, signingSecret: pairing.signingSecret,
      nexusBaseUrl: new URL(request.url).origin, state: "Awaiting Verified Heartbeat"
    };
    return ok(receipt, 201);
  } catch (error) {
    return failure(error);
  }
}
