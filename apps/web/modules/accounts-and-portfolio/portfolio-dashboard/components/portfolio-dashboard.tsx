"use client";

import Link from "next/link";
import { Activity, BarChart3, PieChart, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AUTONOMOUS_SYNC_NOTICE } from "@/lib/mt5-autonomous";
import { usePortfolioDashboard } from "../hooks/use-portfolio-dashboard";
import type { AccountTone } from "@/modules/mt5-infrastructure-and-broker-connectivity/account-sync/types/account-sync.types";

const variants: Record<AccountTone, "success" | "warning" | "destructive" | "default" | "secondary"> = {
  Healthy: "success",
  Watch: "warning",
  Degraded: "warning",
  Critical: "destructive",
  Offline: "destructive",
  Syncing: "default",
  Inactive: "secondary"
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

export function PortfolioDashboard() {
  const query = usePortfolioDashboard();

  if (query.isError) {
    return (
      <div className="mx-auto max-w-[1900px] px-4 py-6">
        <Card className="border-red-200 p-6">
          <h1 className="text-xl font-semibold">Portfolio Dashboard unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">Cross-account portfolio analytics could not be loaded.</p>
          <Button className="mt-4" onClick={() => query.refetch()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (query.isLoading || !query.data) {
    return <div className="mx-auto max-w-[1900px] px-4 py-6 text-sm text-slate-600">Loading portfolio dashboard...</div>;
  }

  const data = query.data;
  const highlight = data.meta.highlightedAccountId;

  return (
    <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <section className="sticky top-14 z-20 rounded-2xl border border-slate-200 bg-white/95 shadow-card backdrop-blur">
        <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500" />
        <div className="flex flex-col gap-5 p-5 xl:flex-row xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Accounts &amp; Portfolio / Portfolio Dashboard</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Portfolio Dashboard</h1>
              <Badge variant={query.streamConnected ? "success" : "warning"}>
                <Activity className="mr-1 h-3 w-3" />
                {query.streamConnected ? "Live stream" : "Polling"}
              </Badge>
              {data.activeAccount ? (
                <Badge variant="success">Active: {data.activeAccount.accountLogin}</Badge>
              ) : null}
            </div>
            <p className="mt-2 max-w-4xl text-sm text-slate-600">
              Cross-account equity, allocation coverage, and performance telemetry derived from Account Center inventory.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={data.quickLinks[0]?.href ?? "/accounts-and-portfolio/account-center"}>Open Account Center</Link>
            </Button>
          </div>
        </div>
        <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-600">{AUTONOMOUS_SYNC_NOTICE}</p>
      </section>

      {!data.accounts.length ? (
        <Card>
          <CardContent className="p-6 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">No portfolio accounts yet</p>
            <p className="mt-2">Link accounts through Account Sync, then manage workspace context in Account Center.</p>
            <Button asChild className="mt-4">
              <Link href="/accounts-and-portfolio/account-center">Open Account Center</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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

          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <PieChart className="h-5 w-5 text-indigo-600" />
                  Allocation Mix
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.allocations.map((slice) => (
                  <div
                    key={slice.accountId}
                    className={cn(
                      "rounded-xl border p-3",
                      highlight === slice.accountId ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{slice.accountLogin}</p>
                        <p className="text-xs text-slate-500">{slice.portfolioCategory}</p>
                      </div>
                      <Badge variant={slice.isActive ? "success" : "secondary"}>{slice.isActive ? "Active" : "Linked"}</Badge>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(slice.equitySharePercent, 100)}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      {slice.allocationPercent}% target · {slice.equitySharePercent}% equity share · {money(slice.equity)}
                    </p>
                    <Button asChild variant="link" className="h-auto px-0 text-xs">
                      <Link href={`/accounts-and-portfolio/account-center?accountId=${encodeURIComponent(slice.accountId)}`}>Manage in Account Center</Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  Performance Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm" aria-label="Portfolio performance">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-slate-500">
                        <th className="px-3 py-2">Account</th>
                        <th className="px-3 py-2">Equity</th>
                        <th className="px-3 py-2">Daily P/L</th>
                        <th className="px-3 py-2">Floating P/L</th>
                        <th className="px-3 py-2">Sync</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.performance.map((row) => (
                        <tr
                          key={row.accountId}
                          className={cn("border-b border-slate-100", highlight === row.accountId && "bg-indigo-50/40")}
                        >
                          <td className="px-3 py-3">
                            <p className="font-medium">{row.accountLogin}</p>
                            <p className="text-xs text-slate-500">{row.brokerName}</p>
                          </td>
                          <td className="px-3 py-3">{money(row.equity)}</td>
                          <td className="px-3 py-3">{money(row.dailyProfitLoss)}</td>
                          <td className="px-3 py-3">{money(row.floatingProfitLoss)}</td>
                          <td className="px-3 py-3">
                            <Badge variant={variants[row.syncStatus]}>{row.syncStatus}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Category Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
              {data.groups
                .filter((group) => group.category !== "All")
                .map((group) => (
                  <div key={group.category} className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">{group.category}</p>
                    <p className="mt-2 text-2xl font-semibold">{group.count}</p>
                    <p className="mt-1 text-xs text-slate-600">{money(group.totalEquity)} equity</p>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wallet className="h-5 w-5 text-emerald-600" />
                Related Modules
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {data.quickLinks.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-xl border border-slate-200 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/40">
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
