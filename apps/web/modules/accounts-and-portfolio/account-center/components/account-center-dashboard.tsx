"use client";

import Link from "next/link";
import { Activity, ArrowRightLeft, BadgeCheck, Download, Pin, Search, Wallet, Workflow } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { PortfolioCategory } from "../types/account-center.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AUTONOMOUS_SYNC_NOTICE } from "@/lib/mt5-autonomous";
import { exportAccountCenterInventory } from "../services/account-center.service";
import { useAccountCenter } from "../hooks/use-account-center";
import { useAccountCenterStore } from "../stores/account-center.store";
import type { AccountTone, PortfolioAccount, PortfolioCategory } from "../types/account-center.types";

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

const money = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);

const time = (value?: string) =>
  value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Never";

function Status({ value }: { value: AccountTone }) {
  return <Badge variant={variants[value]}>{value}</Badge>;
}

function Heading({ icon: Icon, title, detail }: { icon: typeof Activity; title: string; detail: string }) {
  return (
    <CardHeader className="pb-4">
      <CardTitle className="flex items-center gap-2 text-lg">
        <Icon className="h-5 w-5 text-emerald-600" />
        {title}
      </CardTitle>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </CardHeader>
  );
}

const portfolioCategories: PortfolioCategory[] = ["Live", "Demo", "Prop Firm", "Broker", "Paper", "Unknown"];

function categoryFromSearchParam(value: string | null): PortfolioCategory | "All" {
  if (!value) return "All";
  const normalized = decodeURIComponent(value).trim();
  if (normalized === "All") return "All";
  return portfolioCategories.find((category) => category.toLowerCase() === normalized.toLowerCase()) ?? "All";
}

export function AccountCenterDashboard() {
  const query = useAccountCenter();
  const searchParams = useSearchParams();
  const deepLinkAccountId = searchParams.get("accountId");
  const deepLinkCategory = categoryFromSearchParam(searchParams.get("category"));
  const searchTerm = useAccountCenterStore((s) => s.searchTerm);
  const setSearchTerm = useAccountCenterStore((s) => s.setSearchTerm);
  const categoryFilter = useAccountCenterStore((s) => s.categoryFilter);
  const setCategoryFilter = useAccountCenterStore((s) => s.setCategoryFilter);
  const [selectedId, setSelectedId] = useState(deepLinkAccountId ?? "");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (deepLinkCategory !== "All") {
      setCategoryFilter(deepLinkCategory);
    }
  }, [deepLinkCategory, setCategoryFilter]);

  const filteredAccounts = useMemo(() => {
    const accounts = query.data?.accounts ?? [];
    return accounts
      .filter((account) => {
        const haystack = `${account.accountLogin} ${account.accountName} ${account.brokerName} ${account.terminalName} ${account.portfolioCategory}`.toLowerCase();
        return haystack.includes(searchTerm.toLowerCase());
      })
      .filter((account) => categoryFilter === "All" || account.portfolioCategory === categoryFilter);
  }, [query.data?.accounts, searchTerm, categoryFilter]);

  const selected =
    filteredAccounts.find((account) => account.id === selectedId) ??
    query.data?.activeAccount ??
    filteredAccounts[0] ??
    null;

  async function activate(account: PortfolioAccount) {
    if (!query.data?.permissions.canSwitch) return;
    if (!account.switchable) {
      setNotice(account.switchBlockReason ?? "This account cannot be activated.");
      return;
    }
    if (!window.confirm(`Activate ${account.accountLogin} as the workspace account?`)) return;
    setNotice(null);
    try {
      await query.action.mutateAsync({
        path: `/accounts/${account.id}/activate`,
        body: { confirmed: true, reason: "Operator workspace switch from Account Center" }
      });
      setSelectedId(account.id);
      setNotice(`${account.accountLogin} is now the active workspace account.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Account activation failed.");
    }
  }

  async function togglePin(account: PortfolioAccount) {
    if (!query.data?.permissions.canPin) return;
    setNotice(null);
    try {
      await query.action.mutateAsync({
        path: `/accounts/${account.id}/pin`,
        body: { confirmed: true, pinned: !account.isPinned }
      });
      setNotice(account.isPinned ? `${account.accountLogin} unpinned.` : `${account.accountLogin} pinned.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Pin action failed.");
    }
  }

  async function exportReport(format: "json" | "csv" = "json") {
    if (!query.data?.permissions.canExport) return;
    setNotice(null);
    try {
      const result = await exportAccountCenterInventory({
        format,
        category: categoryFilter === "All" ? undefined : categoryFilter,
        search: searchTerm || undefined
      });
      const blob = new Blob([result.message], { type: format === "csv" ? "text/csv" : "application/json" });
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(blob);
      anchor.download = result.filename;
      anchor.click();
      URL.revokeObjectURL(anchor.href);
      setNotice(`Exported ${result.total} account${result.total === 1 ? "" : "s"} as ${format.toUpperCase()}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Export failed.");
    }
  }

  if (query.isError) {
    return (
      <div className="mx-auto max-w-[1900px] px-4 py-6">
        <Card className="border-red-200 p-6">
          <h1 className="text-xl font-semibold">Account Center unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">Portfolio account inventory could not be loaded.</p>
          <Button className="mt-4" onClick={() => query.refetch()}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  if (query.isLoading || !query.data) {
    return <div className="mx-auto max-w-[1900px] px-4 py-6 text-sm text-slate-600">Loading account center inventory...</div>;
  }

  const data = query.data;

  return (
    <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
      <section className="sticky top-14 z-20 rounded-2xl border border-slate-200 bg-white/95 shadow-card backdrop-blur">
        <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-emerald-600 via-teal-500 to-blue-600" />
        <div className="flex flex-col gap-5 p-5 xl:flex-row xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Accounts &amp; Portfolio / Account Center</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Account Center</h1>
              <Badge variant={query.streamConnected ? "success" : "warning"}>
                <Activity className="mr-1 h-3 w-3" />
                {query.streamConnected ? "Live stream" : "Polling"}
              </Badge>
              {data.activeAccount ? (
                <Badge variant="success">
                  <BadgeCheck className="mr-1 h-3 w-3" />
                  Active: {data.activeAccount.accountLogin}
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 max-w-4xl text-sm text-slate-600">
              Unified account inventory, workspace switching, and portfolio context across live, demo, prop firm, and broker accounts.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Mode: {data.meta.monitoringMode} | Role: {data.permissions.role} | Updated: {time(data.meta.timestamp)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => exportReport("json")} disabled={!data.permissions.canExport}>
              <Download className="h-4 w-4" />
              Export JSON
            </Button>
            <Button variant="outline" onClick={() => exportReport("csv")} disabled={!data.permissions.canExport}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
        <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-600">{AUTONOMOUS_SYNC_NOTICE}</p>
        {notice ? <p className="border-t border-slate-100 px-5 py-2.5 text-xs font-semibold text-emerald-700">{notice}</p> : null}
      </section>

      {!data.accounts.length ? (
        <Card>
          <CardContent className="p-6 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">No linked accounts yet</p>
            <p className="mt-2">
              Account inventory is populated automatically from MT5 Account Sync when terminals and EA bridge instances are connected. Link a terminal
              through onboarding or open Account Sync to register your first account.
            </p>
            <Button asChild className="mt-4">
              <Link href="/mt5-infrastructure-and-broker-connectivity/account-sync">Open Account Sync</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            {data.kpis.map((kpi) => (
              <Card key={kpi.label} className={cn("border-t-4", borders[kpi.status])}>
                <CardContent className="p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p>
                  <p className="mt-2 truncate text-xl font-semibold">{kpi.value}</p>
                  <p className="mt-1 truncate text-[11px] text-slate-500">{kpi.detail}</p>
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {data.groups
              .filter((group) => group.category !== "All")
              .map((group) => (
                <button
                  key={group.category}
                  type="button"
                  className={cn(
                    "rounded-xl border p-4 text-left transition",
                    categoryFilter === group.category ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                  onClick={() => setCategoryFilter(group.category)}
                >
                  <p className="text-xs font-semibold uppercase text-slate-500">{group.category}</p>
                  <p className="mt-2 text-2xl font-semibold">{group.count}</p>
                  <p className="mt-1 text-xs text-slate-600">{money(group.totalEquity)} equity</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {group.tradingEnabledCount} trading | {group.healthyCount} healthy
                  </p>
                </button>
              ))}
            <button
              type="button"
              className={cn(
                "rounded-xl border p-4 text-left transition",
                categoryFilter === "All" ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"
              )}
              onClick={() => setCategoryFilter("All")}
            >
              <p className="text-xs font-semibold uppercase text-slate-500">All Accounts</p>
              <p className="mt-2 text-2xl font-semibold">{data.accounts.length}</p>
              <p className="mt-1 text-xs text-slate-600">{money(data.accounts.reduce((sum, account) => sum + account.equity, 0))} equity</p>
            </button>
          </section>

          <Card>
            <Heading icon={Workflow} title="Workspace Workflow" detail="Inventory aggregation through active workspace selection and audit logging." />
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.workflow.map((node) => (
                <div key={node.title} className="rounded-xl border border-slate-200 p-4">
                  <Status value={node.status} />
                  <p className="mt-3 text-sm font-semibold">{node.title}</p>
                  <p className="mt-2 text-xs text-slate-600">{node.detail}</p>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Accounts {node.accountCount} | Blocked {node.blockedCount}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <Heading icon={Wallet} title="Account Inventory" detail="Search, filter, pin, and activate workspace accounts across your portfolio." />
            <CardContent>
              <div className="mb-4 flex flex-col gap-2 md:flex-row md:justify-between">
                <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm md:w-96">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    aria-label="Search accounts"
                    className="w-full outline-none"
                    placeholder="Search login, broker, terminal..."
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </label>
                <select
                  aria-label="Filter account category"
                  className="rounded-lg border border-slate-200 px-3 text-xs"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value as PortfolioCategory | "All")}
                >
                  {data.groups.map((group) => (
                    <option key={group.category} value={group.category}>
                      {group.category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="overflow-x-auto">
                <table aria-label="Account inventory" className="w-full min-w-[1600px] text-left text-xs">
                  <thead className="border-y border-slate-100 bg-slate-50">
                    <tr>
                      {[
                        "Active",
                        "Login / Name",
                        "Category",
                        "Broker / Server",
                        "Terminal",
                        "Balance",
                        "Equity",
                        "Margin",
                        "Free Margin",
                        "P/L",
                        "Positions",
                        "Trading",
                        "Sync",
                        "Risk",
                        "Allocation",
                        "Actions"
                      ].map((head) => (
                        <th key={head} className="px-3 py-3 uppercase text-slate-500">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.map((account) => (
                      <tr
                        key={account.id}
                        className={cn("border-b border-slate-100", selected?.id === account.id && "bg-emerald-50/40")}
                        onClick={() => setSelectedId(account.id)}
                      >
                        <td className="px-3 py-3">{account.isActive ? <Badge variant="success">Active</Badge> : "—"}</td>
                        <td className="px-3 py-3 font-semibold">
                          {account.accountLogin}
                          <p className="font-normal text-slate-500">{account.accountName}</p>
                        </td>
                        <td className="px-3 py-3">{account.portfolioCategory}</td>
                        <td className="px-3 py-3">
                          {account.brokerName}
                          <p className="text-slate-500">{account.serverName}</p>
                        </td>
                        <td className="px-3 py-3">{account.terminalName}</td>
                        <td className="px-3 py-3">{money(account.balance, account.currency)}</td>
                        <td className="px-3 py-3">{money(account.equity, account.currency)}</td>
                        <td className="px-3 py-3">{money(account.margin, account.currency)}</td>
                        <td className="px-3 py-3">{money(account.freeMargin, account.currency)}</td>
                        <td className={cn("px-3 py-3", account.floatingProfitLoss < 0 && "text-red-700")}>{money(account.floatingProfitLoss, account.currency)}</td>
                        <td className="px-3 py-3">{account.openPositionsCount}</td>
                        <td className="px-3 py-3">
                          <Badge variant={account.tradingAllowed ? "success" : "destructive"}>{account.tradingAllowed ? "On" : "Off"}</Badge>
                        </td>
                        <td className="px-3 py-3">
                          <Status value={account.syncStatus} />
                        </td>
                        <td className="px-3 py-3">
                          <Status value={account.riskLevel} />
                        </td>
                        <td className="px-3 py-3">{account.allocationPercent}%</td>
                        <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" disabled={!data.permissions.canSwitch || !account.switchable || account.isActive} onClick={() => activate(account)}>
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                              Activate
                            </Button>
                            <Button size="sm" variant="secondary" disabled={!data.permissions.canPin} onClick={() => togglePin(account)}>
                              <Pin className="h-3.5 w-3.5" />
                              {account.isPinned ? "Unpin" : "Pin"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {selected ? (
            <section className="grid gap-4 xl:grid-cols-3">
              <Card>
                <Heading icon={Wallet} title="Selected Account" detail="Workspace context and operational profile." />
                <CardContent className="space-y-2 text-sm">
                  <p>
                    <strong>Login:</strong> {selected.accountLogin}
                  </p>
                  <p>
                    <strong>Name:</strong> {selected.accountName}
                  </p>
                  <p>
                    <strong>Category:</strong> {selected.portfolioCategory}
                  </p>
                  <p>
                    <strong>Broker:</strong> {selected.brokerName}
                  </p>
                  <p>
                    <strong>Terminal:</strong> {selected.terminalName}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {selected.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  {!selected.switchable && selected.switchBlockReason ? (
                    <p className="text-xs font-medium text-red-700">{selected.switchBlockReason}</p>
                  ) : null}
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link href={`/accounts-and-portfolio/portfolio-dashboard?accountId=${encodeURIComponent(selected.id)}`}>
                      View in Portfolio Dashboard
                    </Link>
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <Heading icon={Activity} title="Financial Snapshot" detail="Latest balance and margin state from account sync." />
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Balance", money(selected.balance, selected.currency)],
                    ["Equity", money(selected.equity, selected.currency)],
                    ["Margin", money(selected.margin, selected.currency)],
                    ["Free margin", money(selected.freeMargin, selected.currency)],
                    ["Margin level", `${selected.marginLevel}%`],
                    ["Daily P/L", money(selected.dailyProfitLoss, selected.currency)]
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-slate-50 p-2">
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="font-semibold">{value}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <Heading icon={ArrowRightLeft} title="Switch History" detail="Recent workspace activations recorded in the audit trail." />
                <CardContent className="space-y-3">
                  {data.switchHistory.length ? (
                    data.switchHistory.slice(0, 6).map((event) => (
                      <div key={event.id} className="rounded-lg border border-slate-100 p-3 text-xs">
                        <p className="font-semibold">
                          {event.accountLogin} · {event.brokerName}
                        </p>
                        <p className="mt-1 text-slate-500">
                          {time(event.switchedAt)} · {event.switchedBy}
                        </p>
                        <p className="mt-1 text-slate-600">{event.reason}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No workspace switches recorded yet.</p>
                  )}
                </CardContent>
              </Card>
            </section>
          ) : null}

          <Card>
            <Heading icon={Activity} title="Related Portfolio Modules" detail="Deep links into adjacent accounts and portfolio surfaces." />
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {data.quickLinks.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-xl border border-slate-200 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/40">
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
