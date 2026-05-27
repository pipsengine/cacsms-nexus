"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatBrokerCatalogLabel,
  brokerRegistrationId,
  getBrokerCatalogEntry,
  MT5_BROKER_CATALOG,
  ONBOARDING_FORM_OPTIONS,
  type BrokerCatalogEntry
} from "../data/broker-catalog";
import type { Mt5ControlCenterResponse, TerminalOnboardingInput, TerminalOnboardingReceipt } from "../types/mt5-control-center.types";

type ActionMutation = {
  mutateAsync: (input: { path: string; method?: "POST" | "PATCH"; body?: unknown }) => Promise<unknown>;
  isPending: boolean;
};

type Props = {
  data: Mt5ControlCenterResponse;
  action: ActionMutation;
  onNotice: (message: string | null) => void;
  onReceipt: (receipt: TerminalOnboardingReceipt | null) => void;
  receipt: TerminalOnboardingReceipt | null;
};

function createDefaultOnboarding(): TerminalOnboardingInput {
  return {
    terminalName: "",
    brokerId: "",
    brokerName: "",
    serverName: "",
    accountLogin: "",
    accountName: "",
    accountType: "Live",
    currency: "USD",
    leverage: "1:100",
    terminalVersion: "5.00 build 4770",
    hostMachine: "",
    eaName: "NexusBridgeEA",
    operatingSystem: ONBOARDING_FORM_OPTIONS.operatingSystems[0],
    region: ONBOARDING_FORM_OPTIONS.regions[0],
    timezone: ONBOARDING_FORM_OPTIONS.timezones[0],
    terminalPath: "",
    symbolScope: ["EURUSD", "XAUUSD"]
  };
}

const selectClass = "mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50";
const inputClass = "mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-900 outline-none focus:border-blue-500";
const readOnlyClass = "mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs text-slate-700";

export function TerminalOnboardingPanel({ data, action, onNotice, onReceipt, receipt }: Props) {
  const [onboarding, setOnboarding] = useState<TerminalOnboardingInput>(createDefaultOnboarding);
  const [terminalUuid, setTerminalUuid] = useState("");
  const [catalog, setCatalog] = useState<BrokerCatalogEntry[]>(MT5_BROKER_CATALOG);
  const [catalogId, setCatalogId] = useState(MT5_BROKER_CATALOG[0]?.catalogId ?? "");
  const [customBroker, setCustomBroker] = useState(false);
  const [brokerDraft, setBrokerDraft] = useState<{
    brokerName: string;
    brokerCode: string;
    mt5ServerName: string;
    serverRegion: string;
    connectionMode: (typeof ONBOARDING_FORM_OPTIONS.connectionModes)[number];
  }>({
    brokerName: MT5_BROKER_CATALOG[0]?.brokerName ?? "",
    brokerCode: MT5_BROKER_CATALOG[0]?.brokerCode ?? "",
    mt5ServerName: MT5_BROKER_CATALOG[0]?.mt5ServerName ?? "",
    serverRegion: MT5_BROKER_CATALOG[0]?.serverRegion ?? "",
    connectionMode: MT5_BROKER_CATALOG[0]?.connectionMode ?? "MT5 Terminal"
  });

  const selectedCatalogEntry = useMemo(
    () => getBrokerCatalogEntry(catalogId),
    [catalogId]
  );

  const registeredBroker = useMemo(
    () => data.brokers.find((broker) => broker.id === onboarding.brokerId) ?? null,
    [data.brokers, onboarding.brokerId]
  );

  const matchingRegisteredBroker = useMemo(
    () => data.brokers.find(
      (broker) => broker.brokerName === brokerDraft.brokerName.trim() && broker.mt5ServerName === brokerDraft.mt5ServerName.trim()
    ) ?? null,
    [data.brokers, brokerDraft.brokerName, brokerDraft.mt5ServerName]
  );

  useEffect(() => {
    void refreshTerminalId();
    fetch("/api/mt5/brokers/catalog", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { catalog?: BrokerCatalogEntry[] }) => {
        if (payload.catalog?.length) {
          setCatalog(payload.catalog);
        }
      })
      .catch(() => undefined);
  }, []);

  async function refreshTerminalId() {
    try {
      const defaults = await fetch("/api/mt5/onboarding/defaults", { cache: "no-store" }).then((response) => response.json()) as {
        terminalUuid: string;
        terminalVersion: string;
        eaName: string;
        symbolScope: string[];
        timezone?: string;
        region?: string;
      };
      setTerminalUuid(defaults.terminalUuid);
      setOnboarding((current) => ({
        ...current,
        terminalVersion: defaults.terminalVersion,
        eaName: defaults.eaName,
        symbolScope: defaults.symbolScope,
        timezone: defaults.timezone ?? current.timezone,
        region: defaults.region ?? current.region
      }));
    } catch {
      setTerminalUuid("");
    }
  }

  useEffect(() => {
    if (!data.brokers.length) return;
    setOnboarding((current) => {
      if (current.brokerId && data.brokers.some((broker) => broker.id === current.brokerId)) {
        return current;
      }
      const preferred = data.brokers[0];
      return {
        ...current,
        brokerId: preferred.id,
        brokerName: preferred.brokerName,
        serverName: preferred.mt5ServerName
      };
    });
  }, [data.brokers]);

  useEffect(() => {
    const entry = getBrokerCatalogEntry(catalogId) ?? catalog.find((item) => item.catalogId === catalogId);
    if (!entry || customBroker) return;
    setBrokerDraft({
      brokerName: entry.brokerName,
      brokerCode: entry.brokerCode,
      mt5ServerName: entry.mt5ServerName,
      serverRegion: entry.serverRegion,
      connectionMode: entry.connectionMode
    });
  }, [catalogId, customBroker, catalog]);

  async function registerBrokerFromForm(event: FormEvent) {
    event.preventDefault();
    if (!window.confirm(`Register broker ${brokerDraft.brokerName} (${brokerDraft.mt5ServerName})?`)) return;
    onNotice(null);
    try {
      const catalogEntry = getBrokerCatalogEntry(catalogId) ?? catalog.find((item) => item.catalogId === catalogId);
      const created = await action.mutateAsync({
        path: "/api/mt5/brokers",
        body: {
          ...brokerDraft,
          id: customBroker ? undefined : catalogEntry ? brokerRegistrationId(catalogEntry) : undefined,
          catalogId: customBroker ? undefined : catalogId,
          confirmed: true
        }
      }) as { id: string; brokerName: string; mt5ServerName: string };
      setOnboarding((current) => ({
        ...current,
        brokerId: created.id,
        brokerName: created.brokerName,
        serverName: created.mt5ServerName
      }));
      onNotice(`Broker ${created.brokerName} registered. Continue with terminal provisioning below.`);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Broker registration failed.");
    }
  }

  async function submitOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onboarding.brokerId) {
      onNotice("Register or select a broker before provisioning a terminal.");
      return;
    }
    if (!window.confirm("Confirm terminal onboarding? Trading stays disabled until heartbeat verification completes.")) return;
    onNotice(null);
    onReceipt(null);
    try {
      const provisioned = await action.mutateAsync({
        path: "/api/mt5/onboarding/terminals",
        body: { ...onboarding, terminalUuid, confirmed: true }
      }) as TerminalOnboardingReceipt;
      onReceipt(provisioned);
      await refreshTerminalId();
      setOnboarding((current) => ({
        ...createDefaultOnboarding(),
        brokerId: current.brokerId,
        brokerName: current.brokerName,
        serverName: current.serverName,
        hostMachine: current.hostMachine,
        region: current.region,
        operatingSystem: current.operatingSystem
      }));
      onNotice("Terminal provisioned. Install NexusBridgeEA with the pairing receipt below.");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Terminal onboarding failed.");
    }
  }

  const canRegister = data.permissions.canRegisterTerminal;
  const canRegisterBroker = data.permissions.canRegisterBroker;

  return (
    <div className="mt-4 space-y-4">
      {!canRegister ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Registration is locked for role <strong>{data.permissions.role}</strong>. For local development, set{" "}
          <span className="font-mono">MT5_LOCAL_OPERATOR_MODE=true</span> and{" "}
          <span className="font-mono">MT5_LOCAL_OPERATOR_ROLE=Infrastructure Admin</span>, then restart the web server.
        </p>
      ) : null}

      <section className="rounded-xl border border-slate-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-950">Step 1 — Register broker</p>
            <p className="text-xs text-slate-500">Pick the MT5 server that matches your broker welcome email or client area, then register it once.</p>
          </div>
          <Badge variant={data.brokers.length ? "success" : "warning"}>{data.brokers.length} registered</Badge>
        </div>

        {data.brokers.length ? (
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs font-semibold text-slate-600 sm:col-span-2 lg:col-span-1">
              Active broker for terminal
              <select
                className={selectClass}
                value={onboarding.brokerId}
                onChange={(event) => {
                  const selected = data.brokers.find((broker) => broker.id === event.target.value);
                  if (!selected) return;
                  setOnboarding((current) => ({
                    ...current,
                    brokerId: selected.id,
                    brokerName: selected.brokerName,
                    serverName: selected.mt5ServerName
                  }));
                }}
              >
                {data.brokers.map((broker) => (
                  <option key={broker.id} value={broker.id}>
                    {broker.brokerName} — {broker.mt5ServerName}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-lg bg-slate-50 p-3 text-xs sm:col-span-2">
              <p><strong>Server:</strong> {registeredBroker?.mt5ServerName ?? "—"}</p>
              <p className="mt-1"><strong>Region:</strong> {registeredBroker?.serverRegion ?? "—"} | <strong>Mode:</strong> {registeredBroker?.connectionMode ?? "—"}</p>
            </div>
          </div>
        ) : null}

        {matchingRegisteredBroker ? (
          <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            <strong>{matchingRegisteredBroker.brokerName}</strong> on <strong>{matchingRegisteredBroker.mt5ServerName}</strong> is already registered.
            Select it in the dropdown above and continue to Step 2 — do not register it again.
          </p>
        ) : null}

        <form className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={registerBrokerFromForm}>
          <label className="text-xs font-semibold text-slate-600 lg:col-span-2">
            Broker profile
            <select
              className={selectClass}
              value={customBroker ? "custom" : catalogId}
              disabled={!canRegisterBroker}
              onChange={(event) => {
                if (event.target.value === "custom") {
                  setCustomBroker(true);
                  return;
                }
                setCustomBroker(false);
                setCatalogId(event.target.value);
              }}
            >
              {catalog.map((entry) => (
                <option key={entry.catalogId} value={entry.catalogId}>
                  {formatBrokerCatalogLabel(entry)}
                </option>
              ))}
              <option value="custom">Custom broker…</option>
            </select>
          </label>
          {!customBroker && selectedCatalogEntry ? (
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 text-xs text-slate-700 lg:col-span-2">
              <p><strong>MT5 company search:</strong> {selectedCatalogEntry.mt5CompanySearch}</p>
              <p className="mt-1"><strong>Server:</strong> {selectedCatalogEntry.mt5ServerName} · <strong>Environment:</strong> {selectedCatalogEntry.accountEnvironment}</p>
              {selectedCatalogEntry.notes ? <p className="mt-1 text-slate-600">{selectedCatalogEntry.notes}</p> : null}
            </div>
          ) : null}
          <label className="text-xs font-semibold text-slate-600">
            Broker code
            <input
              required
              disabled={!canRegisterBroker || !customBroker}
              className={inputClass}
              value={brokerDraft.brokerCode}
              onChange={(event) => setBrokerDraft((draft) => ({ ...draft, brokerCode: event.target.value.toUpperCase() }))}
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Connection mode
            <select
              disabled={!canRegisterBroker || !customBroker}
              className={selectClass}
              value={brokerDraft.connectionMode}
              onChange={(event) =>
                setBrokerDraft((draft) => ({
                  ...draft,
                  connectionMode: event.target.value as (typeof ONBOARDING_FORM_OPTIONS.connectionModes)[number]
                }))
              }
            >
              {ONBOARDING_FORM_OPTIONS.connectionModes.map((mode) => (
                <option key={mode} value={mode}>{mode}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600 lg:col-span-2">
            Broker name
            <input
              required
              disabled={!canRegisterBroker || !customBroker}
              className={inputClass}
              value={brokerDraft.brokerName}
              onChange={(event) => setBrokerDraft((draft) => ({ ...draft, brokerName: event.target.value }))}
            />
          </label>
          <label className="text-xs font-semibold text-slate-600 lg:col-span-2">
            MT5 server name
            <input
              required
              disabled={!canRegisterBroker || !customBroker}
              className={inputClass}
              value={brokerDraft.mt5ServerName}
              onChange={(event) => setBrokerDraft((draft) => ({ ...draft, mt5ServerName: event.target.value }))}
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Server region
            <input
              required
              disabled={!canRegisterBroker || !customBroker}
              className={inputClass}
              value={brokerDraft.serverRegion}
              onChange={(event) => setBrokerDraft((draft) => ({ ...draft, serverRegion: event.target.value }))}
            />
          </label>
          <div className="flex items-end">
            <Button type="submit" disabled={!canRegisterBroker || action.isPending || Boolean(matchingRegisteredBroker)}>
              {data.brokers.length ? "Register another broker" : "Register broker"}
            </Button>
          </div>
        </form>
      </section>

      <form aria-label="Terminal onboarding form" className="rounded-xl border border-slate-200 p-4" onSubmit={submitOnboarding}>
        <div className="mb-3">
          <p className="text-sm font-semibold text-slate-950">Step 2 — Provision terminal &amp; EA pairing</p>
          <p className="text-xs text-slate-500">Terminal ID is assigned automatically. Only MT5 account and host details are required.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold text-slate-600 lg:col-span-2">
            Terminal ID (auto-assigned)
            <input readOnly className={readOnlyClass} value={terminalUuid || "Generating…"} aria-label="Auto-assigned terminal ID" />
          </label>
          <label className="text-xs font-semibold text-slate-600 lg:col-span-2">
            Terminal display name
            <input
              required
              className={inputClass}
              placeholder="e.g. LD4 Execution Primary"
              value={onboarding.terminalName}
              onChange={(event) => setOnboarding((current) => ({ ...current, terminalName: event.target.value }))}
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Account login
            <input
              required
              className={inputClass}
              value={onboarding.accountLogin}
              onChange={(event) => setOnboarding((current) => ({ ...current, accountLogin: event.target.value }))}
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Account name
            <input
              required
              className={inputClass}
              value={onboarding.accountName}
              onChange={(event) => setOnboarding((current) => ({ ...current, accountName: event.target.value }))}
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Account type
            <select
              className={selectClass}
              value={onboarding.accountType}
              onChange={(event) => setOnboarding((current) => ({ ...current, accountType: event.target.value }))}
            >
              {ONBOARDING_FORM_OPTIONS.accountTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Currency
            <select
              className={selectClass}
              value={onboarding.currency}
              onChange={(event) => setOnboarding((current) => ({ ...current, currency: event.target.value }))}
            >
              {ONBOARDING_FORM_OPTIONS.currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Leverage
            <select
              className={selectClass}
              value={onboarding.leverage}
              onChange={(event) => setOnboarding((current) => ({ ...current, leverage: event.target.value }))}
            >
              {ONBOARDING_FORM_OPTIONS.leverage.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Host machine
            <input
              required
              className={inputClass}
              placeholder="e.g. VPS-LD4-01"
              value={onboarding.hostMachine}
              onChange={(event) => setOnboarding((current) => ({ ...current, hostMachine: event.target.value }))}
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Region
            <select
              className={selectClass}
              value={onboarding.region ?? ""}
              onChange={(event) => setOnboarding((current) => ({ ...current, region: event.target.value }))}
            >
              {ONBOARDING_FORM_OPTIONS.regions.map((region) => <option key={region} value={region}>{region}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Operating system
            <select
              className={selectClass}
              value={onboarding.operatingSystem ?? ONBOARDING_FORM_OPTIONS.operatingSystems[0]}
              onChange={(event) => setOnboarding((current) => ({ ...current, operatingSystem: event.target.value }))}
            >
              {ONBOARDING_FORM_OPTIONS.operatingSystems.map((os) => <option key={os} value={os}>{os}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Timezone
            <select
              className={selectClass}
              value={onboarding.timezone ?? ONBOARDING_FORM_OPTIONS.timezones[0]}
              onChange={(event) => setOnboarding((current) => ({ ...current, timezone: event.target.value }))}
            >
              {ONBOARDING_FORM_OPTIONS.timezones.map((tz) => (
                <option key={tz} value={tz}>{tz === "Africa/Lagos" ? "West Africa Time (Nigeria)" : tz}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600 lg:col-span-2">
            MT5 terminal executable (optional)
            <input
              className={inputClass}
              placeholder="C:\\Program Files\\MetaTrader 5 IC Markets Global\\terminal64.exe"
              value={onboarding.terminalPath ?? ""}
              onChange={(event) => setOnboarding((current) => ({ ...current, terminalPath: event.target.value }))}
            />
          </label>
          <label className="text-xs font-semibold text-slate-600 lg:col-span-2">
            MT5 data folder (recommended — File → Open Data Folder)
            <input
              className={inputClass}
              placeholder="C:\\Users\\you\\AppData\\Roaming\\MetaQuotes\\Terminal\\D0E8209F0C77CF8AD7BDDFDD2152314B"
              value={onboarding.mt5DataPath ?? ""}
              onChange={(event) => setOnboarding((current) => ({ ...current, mt5DataPath: event.target.value }))}
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            EA name
            <select
              className={selectClass}
              value={onboarding.eaName}
              onChange={(event) => setOnboarding((current) => ({ ...current, eaName: event.target.value }))}
            >
              {ONBOARDING_FORM_OPTIONS.eaNames.map((ea) => <option key={ea} value={ea}>{ea}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Broker / server
            <input readOnly className={readOnlyClass} value={registeredBroker ? `${registeredBroker.brokerName} / ${registeredBroker.mt5ServerName}` : "Register a broker in Step 1"} />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={!canRegister || !registeredBroker || action.isPending || !terminalUuid}>
            Provision Terminal &amp; EA Pairing
          </Button>
          <Badge variant="warning">Trading disabled during onboarding</Badge>
          {!registeredBroker ? <span className="text-xs text-amber-700">Click <strong>Register broker</strong> in Step 1 and wait for the success message before provisioning.</span> : null}
        </div>
      </form>

      {receipt ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-slate-950">One-Time EA Pairing Receipt: {receipt.eaInstanceId}</p>
            <Badge variant="warning">{receipt.state}</Badge>
          </div>
          <p className="mt-2 text-amber-800">Terminal <span className="font-mono">{receipt.terminal.terminalUuid}</span> — copy these EA inputs now. They are shown once and are not stored in Nexus after you leave this page.</p>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            <p className="rounded-lg bg-white p-3"><strong>NexusBaseUrl</strong><br /><span className="break-all font-mono">{receipt.nexusBaseUrl}</span></p>
            <p className="rounded-lg bg-white p-3"><strong>EaInstanceId</strong><br /><span className="break-all font-mono">{receipt.eaInstanceId}</span></p>
            <p className="rounded-lg bg-white p-3"><strong>IngestionToken</strong><br /><span className="break-all font-mono">{receipt.ingestionToken}</span></p>
            <p className="rounded-lg bg-white p-3"><strong>SigningSecret</strong><br /><span className="break-all font-mono">{receipt.signingSecret}</span></p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
