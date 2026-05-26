export type BrokerAccountEnvironment = "Live" | "Demo" | "Prop";

export type BrokerCatalogEntry = {
  catalogId: string;
  brokerName: string;
  brokerCode: string;
  mt5ServerName: string;
  accountEnvironment: BrokerAccountEnvironment;
  serverRegion: string;
  connectionMode: "MT5 Terminal";
  /** Company name to search in MT5: File → Open an Account → Find your company */
  mt5CompanySearch: string;
  notes?: string;
};

/**
 * Known MT5 broker/server profiles for one-click registration.
 * Server names match what traders select in the MetaTrader 5 login dialog.
 * Always confirm the exact server against your broker welcome email or client area.
 */
export const MT5_BROKER_CATALOG: BrokerCatalogEntry[] = [
  {
    catalogId: "icm-sc-live",
    brokerName: "IC Markets",
    brokerCode: "ICM",
    mt5ServerName: "ICMarketsSC-MT5",
    accountEnvironment: "Live",
    serverRegion: "New York (Equinix NY4)",
    connectionMode: "MT5 Terminal",
    mt5CompanySearch: "Raw Trading Ltd",
    notes: "Primary IC Markets SC live MT5 server. IC may add numbered variants such as ICMarketsSC-MT5-6."
  },
  {
    catalogId: "icm-sc-live-6",
    brokerName: "IC Markets",
    brokerCode: "ICM",
    mt5ServerName: "ICMarketsSC-MT5-6",
    accountEnvironment: "Live",
    serverRegion: "New York (Equinix NY4)",
    connectionMode: "MT5 Terminal",
    mt5CompanySearch: "Raw Trading Ltd"
  },
  {
    catalogId: "icm-sc-demo",
    brokerName: "IC Markets",
    brokerCode: "ICM",
    mt5ServerName: "ICMarketsSC-Demo",
    accountEnvironment: "Demo",
    serverRegion: "New York (Equinix NY4)",
    connectionMode: "MT5 Terminal",
    mt5CompanySearch: "Raw Trading Ltd"
  },
  {
    catalogId: "pepper-live",
    brokerName: "Pepperstone",
    brokerCode: "PEP",
    mt5ServerName: "Pepperstone-MT5-Live01",
    accountEnvironment: "Live",
    serverRegion: "London (Equinix LD4)",
    connectionMode: "MT5 Terminal",
    mt5CompanySearch: "Pepperstone Group Limited",
    notes: "Host login may also appear as mt5-1.pepperstone.com in Pepperstone support docs."
  },
  {
    catalogId: "pepper-demo",
    brokerName: "Pepperstone",
    brokerCode: "PEP",
    mt5ServerName: "Pepperstone-Demo",
    accountEnvironment: "Demo",
    serverRegion: "London (Equinix LD4)",
    connectionMode: "MT5 Terminal",
    mt5CompanySearch: "Pepperstone Group Limited"
  },
  {
    catalogId: "ftmo-demo",
    brokerName: "FTMO",
    brokerCode: "FTMO",
    mt5ServerName: "FTMO-Demo",
    accountEnvironment: "Demo",
    serverRegion: "Prague",
    connectionMode: "MT5 Terminal",
    mt5CompanySearch: "FTMO Global Markets Ltd",
    notes: "Use for evaluation / demo accounts. Match the server shown in your FTMO Client Area credentials."
  },
  {
    catalogId: "ftmo-server",
    brokerName: "FTMO",
    brokerCode: "FTMO",
    mt5ServerName: "FTMO-Server",
    accountEnvironment: "Prop",
    serverRegion: "Prague",
    connectionMode: "MT5 Terminal",
    mt5CompanySearch: "FTMO Global Markets Ltd",
    notes: "Funded and challenge accounts may use FTMO-Server, FTMO-Server2, etc. Verify in Client Area before registering."
  },
  {
    catalogId: "ftmo-server-3",
    brokerName: "FTMO",
    brokerCode: "FTMO",
    mt5ServerName: "FTMO-Server3",
    accountEnvironment: "Prop",
    serverRegion: "Prague",
    connectionMode: "MT5 Terminal",
    mt5CompanySearch: "FTMO Global Markets Ltd"
  },
  {
    catalogId: "eightcap-live",
    brokerName: "Eightcap",
    brokerCode: "ECP",
    mt5ServerName: "Eightcap-Real",
    accountEnvironment: "Live",
    serverRegion: "London",
    connectionMode: "MT5 Terminal",
    mt5CompanySearch: "Eightcap"
  },
  {
    catalogId: "eightcap-demo",
    brokerName: "Eightcap",
    brokerCode: "ECP",
    mt5ServerName: "Eightcap-Demo",
    accountEnvironment: "Demo",
    serverRegion: "London",
    connectionMode: "MT5 Terminal",
    mt5CompanySearch: "Eightcap"
  }
];

export function getBrokerCatalogEntry(catalogId: string) {
  return MT5_BROKER_CATALOG.find((entry) => entry.catalogId === catalogId);
}

export function brokerRegistrationId(entry: BrokerCatalogEntry) {
  return `broker-${entry.catalogId}`;
}

export function formatBrokerCatalogLabel(entry: BrokerCatalogEntry) {
  return `${entry.brokerName} — ${entry.accountEnvironment} (${entry.mt5ServerName})`;
}

export const ONBOARDING_FORM_OPTIONS = {
  accountTypes: ["Demo", "Live", "Prop Firm"],
  currencies: ["USD", "EUR", "GBP", "AUD"],
  leverage: ["1:30", "1:50", "1:100", "1:200", "1:500", "1:1000", "1:2000"],
  operatingSystems: ["Windows Server 2022", "Windows Server 2019", "Windows 11", "Windows 10"],
  regions: ["Lagos", "London", "Frankfurt", "New York", "Sydney", "Singapore", "Tokyo"],
  timezones: ["Africa/Lagos", "UTC", "Europe/London", "America/New_York", "Asia/Singapore"],
  eaNames: ["NexusBridgeEA"],
  symbolScopes: ["EURUSD", "GBPUSD", "XAUUSD", "NAS100", "US30"],
  connectionModes: ["MT5 Terminal"] as const
} as const;
