"use client";

import Link from "next/link";
import { Activity, AlertTriangle, Gauge, Layers, ShieldAlert, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AUTONOMOUS_SYNC_NOTICE } from "@/lib/mt5-autonomous";
import { useRiskAndExposure } from "../hooks/use-risk-and-exposure";
import type { AccountTone } from "@/modules/mt5-infrastructure-and-broker-connectivity/account-sync/types/account-sync.types";
import type { RiskLevel } from "../types/risk-and-exposure.types";

const variants: Record<AccountTone, "success" | "warning" | "destructive" | "default" | "secondary"> = {
  Healthy: "success",
  Watch: "warning",
  Degraded: "warning",
  Critical: "destructive",
  Offline: "destructive",
  Syncing: "default",
  Inactive: "secondary"
};

const riskVariants: Record<RiskLevel, "success" | "warning" | "destructive" | "default"> = {
  Low: "success",
  Moderate: "warning",
  Elevated: "warning",
  High: "destructive",
  Critical: "destructive"
};

const borders: Record<AccountTone, string> = {
  Healthy: "border-t-emerald-500",
  Watch: "border-t-amber-500",
  Degraded: "border-t-amber-500",
  Critical: "border-t-red-500",
  Offline: "border-t-red-500",
  Syncing: "border-t-blue-500",
  Inactive: "border-t-slate-400"
};

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export function RiskAndExposureDashboard() {
  const query = useRiskAndExposure();
  const [selectedId, setSelectedId] = useState("");
  const highlight = query.highlightedAccountId;

  const selected = useMemo(() => {
    const accounts = query.data?.accounts ?? [];
    return accounts.find((account) => account.accountId === (selectedId || highlight)) ?? accounts.find((a) => a.isActive) ?? accounts[0] ?? null;
  }, [query.data?.accounts, selectedId, highlight]);

  if (query.isError) {
    return (
      <div className="mx-auto max-w-[1900px] px-4 py-6">
        <Card className="border-red-200 p-6">
          <h1 className="text-xl font-semibold">Risk &amp; Exposure unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">Margin, leverage, and exposure telemetry could not be loaded.</p>
          <Button className="mt-4" onClick={() => query.refetch()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (query.isLoading || !query.data) {
    return <div className="mx-auto max-w-[1900px] px-4 py-6 text-sm text-slate-600">Loading risk and exposure monitor...</div>;
  }

  const data = query.data;

  return (
    <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <section className="sticky top-14 z-20 rounded-2xl border border-slate-200 bg-white/95 shadow-card backdrop-blur">
        <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-red-600 via-amber-500 to-orange-500" />
        <div className="flex flex-col gap-5 p-5 xl:flex-row xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Accounts &amp; Portfolio / Risk &amp; Exposure</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Risk &amp; Exposure</h1>
              <Badge variant={query.streamConnected ? "success" : "warning"}>
                <Activity className="mr-1 h-3 w-3" />
                {query.streamConnected ? "Live stream" : "Polling"}
              </Badge>
              {data.warnings.some((w) => w.severity === "Critical") ? (
                <Badge variant="destructive">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Emergency flags active
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 max-w-4xl text-sm text-slate-600">
              Combined margin, leverage, and cross-account exposure monitor derived from Account Sync and Account Center inventory.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/mt5-infrastructure-and-broker-connectivity/account-sync">Open Account Sync</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={data.quickLinks[0]?.href ?? "/accounts-and-portfolio/account-center"}>Account Center</Link>
            </Button>
          </div>
        </div>
        <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-600">{AUTONOMOUS_SYNC_NOTICE}</p>
      </section>

      {!data.accounts.length ? (
        <Card>
          <CardContent className="p-6 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">No accounts in risk scope</p>
            <p className="mt-2">Link accounts through Account Sync to populate margin, leverage, and exposure analytics.</p>
            <Button asChild className="mt-4">
              <Link href="/mt5-infrastructure-and-broker-connectivity/account-sync">Open Account Sync</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.kpis.map((kpi) => (
              <Card key={kpi.label} className={cn("border-t-4", borders[kpi.status])}>
                <CardContent className="p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
                  <p className="mt-2 text-xl font-semibold">{kpi.value}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{kpi.detail}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          {data.warnings.length ? (
            <Card className="border-amber-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShieldAlert className="h-5 w-5 text-amber-600" />
                  Active Risk Warnings
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-2">
                {data.warnings.map((warning) => (
                  <div key={warning.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={variants[warning.severity]}>{warning.severity}</Badge>
                      <span className="font-semibold">{warning.title}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      {warning.accountLogin} · {warning.detail}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Gauge className="h-5 w-5 text-red-600" />
                Risk Workflow
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.workflow.map((node) => (
                <div key={node.title} className="rounded-xl border border-slate-200 p-4">
                  <Badge variant={variants[node.status]}>{node.status}</Badge>
                  <p className="mt-3 text-sm font-semibold">{node.title}</p>
                  <p className="mt-2 text-xs text-slate-600">{node.detail}</p>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Accounts {node.accountCount} · Blocked {node.blockedCount}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <section className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingDown className="h-5 w-5 text-amber-600" />
                  Account Margin &amp; Leverage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm" aria-label="Account margin and leverage">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-slate-500">
                        <th className="px-3 py-2">Account</th>
                        <th className="px-3 py-2">Leverage</th>
                        <th className="px-3 py-2">Margin use</th>
                        <th className="px-3 py-2">Margin level</th>
                        <th className="px-3 py-2">Risk</th>
                        <th className="px-3 py-2">Exposure</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.accounts.map((account) => (
                        <tr
                          key={account.accountId}
                          className={cn(
                            "cursor-pointer border-b border-slate-100 hover:bg-slate-50",
                            (selected?.accountId === account.accountId || highlight === account.accountId) && "bg-amber-50/50"
                          )}
                          onClick={() => setSelectedId(account.accountId)}
                        >
                          <td className="px-3 py-3">
                            <p className="font-medium">{account.accountLogin}</p>
                            <p className="text-xs text-slate-500">{account.brokerName}</p>
                          </td>
                          <td className="px-3 py-3">{account.leverage}</td>
                          <td className="px-3 py-3">{account.marginUtilization}%</td>
                          <td className="px-3 py-3">{account.marginLevel.toFixed(1)}%</td>
                          <td className="px-3 py-3">
                            <Badge variant={riskVariants[account.exposure.riskLevel]}>{account.exposure.riskLevel}</Badge>
                          </td>
                          <td className="px-3 py-3">{money(account.exposure.totalExposure)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {selected ? (
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Selected Account</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p>
                    <strong>Login:</strong> {selected.accountLogin}
                  </p>
                  <p>
                    <strong>Category:</strong> {selected.portfolioCategory}
                  </p>
                  <p>
                    <strong>Equity:</strong> {money(selected.equity)}
                  </p>
                  <p>
                    <strong>Free margin:</strong> {money(selected.freeMargin)}
                  </p>
                  <p>
                    <strong>Margin utilization:</strong> {selected.marginUtilization}%
                  </p>
                  <p>
                    <strong>Concentration risk:</strong> {selected.exposure.concentrationRisk}%
                  </p>
                  <p>
                    <strong>Floating drawdown:</strong> {selected.exposure.floatingDrawdown}%
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Badge variant={variants[selected.syncStatus]}>{selected.syncStatus}</Badge>
                    {selected.exposure.emergencyRiskFlag ? <Badge variant="destructive">Emergency</Badge> : null}
                  </div>
                  <Button asChild variant="outline" size="sm" className="mt-2">
                    <Link href={`/accounts-and-portfolio/account-center?accountId=${encodeURIComponent(selected.accountId)}`}>Manage in Account Center</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : null}
          </section>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers className="h-5 w-5 text-orange-600" />
                Symbol Exposure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm" aria-label="Symbol exposure">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-slate-500">
                      <th className="px-3 py-2">Account</th>
                      <th className="px-3 py-2">Symbol</th>
                      <th className="px-3 py-2">Group</th>
                      <th className="px-3 py-2">Notional</th>
                      <th className="px-3 py-2">Margin</th>
                      <th className="px-3 py-2">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.symbolExposures.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100">
                        <td className="px-3 py-3">{row.accountLogin}</td>
                        <td className="px-3 py-3">{row.symbol}</td>
                        <td className="px-3 py-3">{row.correlationGroup}</td>
                        <td className="px-3 py-3">{money(row.notionalExposure)}</td>
                        <td className="px-3 py-3">{money(row.marginUsed)}</td>
                        <td className="px-3 py-3">{row.exposureRiskScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Related Modules</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {data.quickLinks.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-xl border border-slate-200 p-4 transition hover:border-amber-300 hover:bg-amber-50/40">
                  <p className="text-sm font-semibold text-slate-900">{link.label}</p>
                  <p className="mt-2 text-xs text-slate-600">{link.description}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
