import { accounts, provisionAccountBinding, removeAccountBindingByLogin } from "../account-sync/_lib/store";
import { provisionEaBridgeInstance, publicBridgeInstances, removeBridgeInstancesByAccountLogin } from "../ea-bridge/_lib/store";
import { provisionEaTerminalHubFromOnboarding, removeTerminalHubLink } from "../ea-terminal-hub/_lib/store";
import { provisionTerminalMonitor, removeTerminalMonitorByUuid, terminalRecords } from "../terminal-status/_lib/store";
import { getAccounts, getTerminals } from "./store";

const INFRASTRUCTURE_RECONCILE_ROLE = "Infrastructure Admin" as const;

export function reconcileInfrastructureFromControlCenter() {
  const terminals = getTerminals();
  const accountsByTerminal = new Map(getAccounts().map((account) => [account.terminalId, account]));
  const repaired: string[] = [];

  for (const terminal of terminals) {
    const account = accountsByTerminal.get(terminal.id);
    if (!account) continue;

    if (!accounts().some((item) => item.accountLogin === account.accountLogin)) {
      provisionAccountBinding({
        accountId: account.id,
        terminalId: terminal.id,
        terminalName: terminal.terminalName,
        brokerId: terminal.brokerId,
        brokerName: terminal.brokerName,
        serverName: terminal.serverName,
        accountLogin: account.accountLogin,
        accountName: account.accountLogin,
        accountType: account.accountType,
        currency: account.currency,
        leverage: account.leverage
      }, INFRASTRUCTURE_RECONCILE_ROLE);
      repaired.push(`account-sync:${account.accountLogin}`);
    }

    if (!terminalRecords().some((item) => item.terminalId === terminal.id || item.terminalUuid === terminal.terminalUuid)) {
      provisionTerminalMonitor({
        terminal,
        accountId: account.id,
        currency: account.currency
      }, INFRASTRUCTURE_RECONCILE_ROLE);
      repaired.push(`terminal-status:${terminal.id}`);
    }

    if (!publicBridgeInstances().some((instance) => instance.terminalId === terminal.id || instance.accountLogin === terminal.accountLogin)) {
      provisionEaBridgeInstance({
        terminal,
        accountId: account.id,
        eaName: "NexusBridgeEA"
      }, INFRASTRUCTURE_RECONCILE_ROLE, true);
      repaired.push(`ea-bridge:${terminal.id}`);
    }

    try {
      provisionEaTerminalHubFromOnboarding({ terminal }, INFRASTRUCTURE_RECONCILE_ROLE);
    } catch {
      // Terminal hub profile may already exist.
    }
  }

  return { repaired };
}

export function releaseIncompleteOnboardingBindings(input: { accountLogin?: string; terminalUuid?: string }) {
  const accountLogin = input.accountLogin?.trim();
  const terminalUuid = input.terminalUuid?.trim().toUpperCase();
  if (!accountLogin && !terminalUuid) {
    return { released: [] as string[] };
  }

  const controlTerminals = getTerminals();
  const controlAccounts = getAccounts();
  const terminalRegistered = terminalUuid
    ? controlTerminals.some((terminal) => terminal.id === terminalUuid || terminal.terminalUuid === terminalUuid)
    : false;
  const accountRegistered = accountLogin
    ? controlAccounts.some((account) => account.accountLogin === accountLogin)
    : false;

  if (terminalRegistered || accountRegistered) {
    return { released: [] as string[] };
  }

  const released: string[] = [];
  if (accountLogin && removeAccountBindingByLogin(accountLogin)) {
    released.push(`account-sync:${accountLogin}`);
  }
  if (terminalUuid && removeTerminalMonitorByUuid(terminalUuid)) {
    released.push(`terminal-status:${terminalUuid}`);
  }
  if (terminalUuid && removeTerminalHubLink(terminalUuid)) {
    released.push(`ea-terminal-hub:${terminalUuid}`);
  }
  if (accountLogin && removeBridgeInstancesByAccountLogin(accountLogin)) {
    released.push(`ea-bridge:${accountLogin}`);
  }
  return { released };
}
