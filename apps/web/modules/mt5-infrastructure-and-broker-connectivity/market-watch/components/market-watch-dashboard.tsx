"use client";

import { Activity, AlertTriangle, Bot, Download, Globe2, Menu, Search, Star, TrendingUp, Waves } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AUTONOMOUS_SYNC_NOTICE, requiresOperatorConfirm } from "@/lib/mt5-autonomous";
import { dailyMovePercent, quoteStatus, spreadPoints } from "../algorithms/market-watch.algorithms";
import { useMarketWatch } from "../hooks/use-market-watch";
import type { MarketSeverity, MarketTone } from "../types/market-watch.types";

const variants: Record<MarketTone, "success" | "warning" | "destructive" | "secondary"> = { Healthy: "success", Watch: "warning", Degraded: "warning", Critical: "destructive", Offline: "destructive", Inactive: "secondary" };
const borders: Record<MarketTone, string> = { Healthy: "border-t-emerald-500", Watch: "border-t-amber-500", Degraded: "border-t-amber-500", Critical: "border-t-red-500", Offline: "border-t-red-500", Inactive: "border-t-slate-400" };
const price = (value: number, digits: number) => value.toFixed(digits);
const compact = (value: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
const time = (value: string) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
function Status({ value }: { value: MarketTone }) { return <Badge variant={variants[value]}>{value}</Badge>; }
function Severity({ value }: { value: MarketSeverity }) { return <Badge variant={value === "Critical" ? "destructive" : value === "Warning" ? "warning" : "secondary"}>{value}</Badge>; }
function Heading({ icon: Icon, title, detail }: { icon: typeof Activity; title: string; detail: string }) {
  return <CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-lg"><Icon className="h-5 w-5 text-blue-600" />{title}</CardTitle><p className="mt-1 text-xs text-slate-500">{detail}</p></CardHeader>;
}
function Meter({ label, value, tone = "bg-blue-600" }: { label: string; value: number; tone?: string }) {
  return <div><div className="mb-1 flex justify-between text-xs text-slate-600"><span>{label}</span><strong>{value}%</strong></div><div className="h-2 rounded-full bg-slate-100"><div className={cn("h-2 rounded-full", tone)} style={{ width: `${Math.min(100, value)}%` }} /></div></div>;
}

export function MarketWatchDashboard() {
  const query = useMarketWatch();
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState("All");
  const [view, setView] = useState("All");
  const [alertFilter, setAlertFilter] = useState("All");
  const [notice, setNotice] = useState<string | null>(null);
  if (query.isError) return <div className="mx-auto max-w-[1900px] px-4 py-6"><Card className="border-red-200 p-6"><h1 className="text-xl font-semibold">Market Watch unavailable</h1><p className="mt-2 text-sm text-slate-600">Quote telemetry could not be loaded; no trading state was changed.</p><Button className="mt-4" onClick={() => query.refetch()}>Retry</Button></Card></div>;
  if (query.isLoading || !query.data) return <div className="mx-auto max-w-[1900px] px-4 py-6 text-sm text-slate-600">Loading live market quotes...</div>;
  const data = query.data;
  const selected = data.instruments.find((instrument) => instrument.id === selectedId) ?? data.instruments[0];
  const selectedStatus = selected ? quoteStatus(selected) : "Pending";
  const selectedMove = selected ? dailyMovePercent(selected) : 0;
  const selectedSpread = selected ? spreadPoints(selected) : 0;
  const maxTrend = selected ? Math.max(...selected.trend) : 0;
  const minTrend = selected ? Math.min(...selected.trend) : 0;
  const rows = data.instruments
    .filter((instrument) => `${instrument.symbol} ${instrument.description} ${instrument.brokerName} ${instrument.assetClass}`.toLowerCase().includes(search.toLowerCase()))
    .filter((instrument) => assetFilter === "All" || instrument.assetClass === assetFilter)
    .filter((instrument) => view === "All" || (view === "Watchlist" ? instrument.watchlisted : quoteStatus(instrument) !== "Healthy"));
  const visibleAlerts = data.alerts.filter((alert) => alertFilter === "All" || alert.alertType === alertFilter || alert.severity === alertFilter);
  async function command(label: string, path: string) {
    if (requiresOperatorConfirm(label) && !window.confirm(`Confirm ${label.toLowerCase()}? This action will be audit-logged.`)) return;
    setNotice(null);
    try {
      await query.action.mutateAsync({ path, body: { confirmed: true } });
      setNotice(`${label} completed and was recorded in the audit trail.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Market-watch action failed.");
    }
  }
  function exportReport() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "market-watch-report.json";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }
  return <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
    <section className="sticky top-14 z-20 rounded-2xl border border-slate-200 bg-white/95 shadow-card backdrop-blur">
      <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-blue-600 via-emerald-500 to-purple-600" />
      <div className="flex flex-col gap-5 p-5 xl:flex-row xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">MT5 Infrastructure &amp; Broker Connectivity / Market Watch</p>
          <div className="mt-2 flex flex-wrap items-center gap-2"><h1 className="text-3xl font-semibold tracking-tight text-slate-950">Market Watch</h1><Badge variant={query.streamConnected ? "success" : "warning"}><Activity className="mr-1 h-3 w-3" />{query.streamConnected ? "Live quotes" : "Reconnecting"}</Badge></div>
          <p className="mt-2 max-w-4xl text-sm text-slate-600">Real-time instrument prices, session liquidity, quote freshness, spread surveillance, volatility signals, and operator watchlist controls.</p>
          <p className="mt-3 text-xs text-slate-500">Mode: {data.meta.monitoringMode} | Role: {data.permissions.role} | Selected: {selected?.symbol ?? "None"} | Updated: {time(data.meta.timestamp)}</p>
        </div>
        <div className="hidden flex-wrap justify-end gap-2 sm:flex">
          <Button variant="outline" disabled={!selected || !data.permissions.canManageWatchlist || query.action.isPending} onClick={() => selected && command(selected.watchlisted ? "Remove selected from watchlist" : "Add selected to watchlist", `/api/mt5/market-watch/instruments/${selected.id}/watchlist`)}><Star className="h-4 w-4" />{selected?.watchlisted ? "Unwatch Selected" : "Watch Selected"}</Button>
          <Button variant="outline" onClick={exportReport}><Download className="h-4 w-4" />Export Report</Button>
        </div>
        <div className="sm:hidden"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline"><Menu className="h-4 w-4" />Actions</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={!selected || !data.permissions.canManageWatchlist} onSelect={() => selected && command("Toggle watchlist", `/api/mt5/market-watch/instruments/${selected.id}/watchlist`)}>Toggle Watchlist</DropdownMenuItem><DropdownMenuItem onSelect={exportReport}>Export Report</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
      </div>
      <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-600">{AUTONOMOUS_SYNC_NOTICE}</p>
      {notice ? <p className="border-t border-slate-100 px-5 py-2.5 text-xs font-semibold text-blue-700">{notice}</p> : null}
    </section>

    <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">{data.kpis.map((kpi) => <Card key={kpi.label} className={cn("border-t-4", borders[kpi.status])}><CardContent className="p-3.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p><p className="mt-2 truncate text-xl font-semibold">{kpi.value}</p><p className="mt-1 truncate text-[11px] text-slate-500">{kpi.detail}</p></CardContent></Card>)}</section>

    <section className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
      <Card>
        <Heading icon={Globe2} title="Market Sessions & Liquidity" detail="Regional trading windows and current depth conditions supporting active quotes." />
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{data.sessions.map((session) => <div key={session.name} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"><div className="flex items-center justify-between"><p className="font-semibold">{session.name}</p><Status value={session.status} /></div><p className="mt-3 text-xs text-slate-500">{session.opensAt} - {session.closesAt}</p><p className="mt-1 text-xs text-slate-600">{session.instrumentsLive} live instruments</p><div className="mt-3"><Meter label="Liquidity" value={session.liquidityScore} tone={session.status === "Watch" ? "bg-amber-500" : "bg-emerald-500"} /></div><p className="mt-2 text-[11px] text-slate-500">{session.note}</p></div>)}</CardContent>
      </Card>
      <Card>
        <Heading icon={Waves} title="Market Health" detail="Composite data quality and execution-readiness state." />
        <CardContent className="space-y-3"><div className="flex items-end justify-between"><p className="text-4xl font-semibold">{data.health.score}</p><Status value={data.health.score >= 75 ? "Healthy" : data.health.score >= 60 ? "Degraded" : "Critical"} /></div><p className="text-xs text-slate-500">{data.health.rating} quote environment</p><Meter label="Live feeds" value={Math.round(data.health.factors.liveFeeds)} tone="bg-emerald-500" /><Meter label="Fresh quotes" value={Math.round(data.health.factors.freshQuotes)} /><Meter label="Stable spreads" value={Math.round(data.health.factors.stableSpreads)} tone="bg-purple-600" /></CardContent>
      </Card>
    </section>

    <Card>
      <Heading icon={Activity} title="Live Quote Board" detail="Streaming bid/ask prices, quote health, intraday movement, spread cost, and execution eligibility." />
      <CardContent>
        <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:justify-between">
          <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm lg:w-80"><Search className="h-4 w-4 text-slate-400" /><input aria-label="Search market instruments" className="w-full outline-none" placeholder="Search instrument or broker..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <div className="flex flex-wrap gap-2"><select aria-label="Filter asset class" className="rounded-lg border border-slate-200 px-3 text-xs" value={assetFilter} onChange={(event) => setAssetFilter(event.target.value)}><option>All</option><option>Forex</option><option>Metal</option><option>Index</option><option>Energy</option><option>Crypto</option></select>{["All", "Watchlist", "Exceptions"].map((option) => <button key={option} className={cn("rounded-lg border px-3 py-2 text-xs font-medium", view === option ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600")} onClick={() => setView(option)}>{option}</button>)}</div>
        </div>
        <div className="overflow-x-auto"><table aria-label="Market watch quote board" className="w-full min-w-[1380px] text-left text-xs"><thead className="border-y border-slate-100 bg-slate-50"><tr>{["Watch", "Instrument", "Broker", "Bid", "Ask", "Spread", "Daily Move", "High / Low", "Volume", "Volatility", "Latency", "Session", "Last Tick", "Feed", "Execution"].map((head) => <th key={head} className="px-3 py-3 uppercase text-slate-500">{head}</th>)}</tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={15} className="px-3 py-8 text-center text-slate-500">No live quotes yet. Ensure NexusBridgeEA is connected and sending heartbeats with chart tick data.</td></tr> : rows.map((instrument) => { const status = quoteStatus(instrument); const move = dailyMovePercent(instrument); return <tr key={instrument.id} className={cn("cursor-pointer border-b border-slate-100", instrument.id === selected?.id && "bg-blue-50/30")} onClick={() => setSelectedId(instrument.id)}><td className="px-3 py-3"><Star className={cn("h-4 w-4", instrument.watchlisted ? "fill-amber-400 text-amber-400" : "text-slate-300")} /></td><td className="px-3 py-3 font-semibold">{instrument.symbol}<p className="font-normal text-slate-500">{instrument.description}</p></td><td className="px-3 py-3">{instrument.brokerName}</td><td className="px-3 py-3 font-mono">{price(instrument.bid, instrument.digits)}</td><td className="px-3 py-3 font-mono">{price(instrument.ask, instrument.digits)}</td><td className={cn("px-3 py-3", spreadPoints(instrument) > instrument.spreadBaselinePoints * 2 && "font-semibold text-red-700")}>{spreadPoints(instrument)} pts</td><td className={cn("px-3 py-3 font-semibold", move >= 0 ? "text-emerald-700" : "text-red-700")}>{move > 0 ? "+" : ""}{move}%</td><td className="px-3 py-3">{price(instrument.dailyHigh, instrument.digits)} / {price(instrument.dailyLow, instrument.digits)}</td><td className="px-3 py-3">{compact(instrument.volume)}</td><td className="px-3 py-3">{instrument.volatilityPercent}%</td><td className="px-3 py-3">{instrument.latencyMs} ms</td><td className="px-3 py-3">{instrument.session}</td><td className="px-3 py-3">{time(instrument.lastTickAt)}</td><td className="px-3 py-3"><Status value={status} /></td><td className="px-3 py-3"><Badge variant={instrument.tradeEnabled ? "success" : "destructive"}>{instrument.tradeEnabled ? "Enabled" : "Blocked"}</Badge></td></tr>; })}</tbody></table></div>
      </CardContent>
    </Card>

    <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      {selected ? <Card>
        <Heading icon={TrendingUp} title={`${selected.symbol} Quote Detail`} detail="Selected instrument price range, trend, cost, and feed eligibility." />
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4"><div><p className="text-lg font-semibold">{selected.description}</p><p className="text-xs text-slate-500">{selected.brokerName} / {selected.session}</p></div><div className="text-right"><p className={cn("text-xl font-semibold", selectedMove >= 0 ? "text-emerald-700" : "text-red-700")}>{selectedMove > 0 ? "+" : ""}{selectedMove}%</p><Status value={selectedStatus} /></div></div>
          <div className="flex h-24 items-end gap-2 rounded-lg border border-slate-100 p-3">{selected.trend.map((tick, index) => <div key={`${tick}-${index}`} className={cn("flex-1 rounded-t", selectedMove >= 0 ? "bg-emerald-400" : "bg-red-400")} style={{ height: `${Math.max(12, ((tick - minTrend) / Math.max(0.00001, maxTrend - minTrend)) * 75 + 12)}%` }} />)}</div>
          <div className="grid grid-cols-3 gap-2 text-xs">{[["Bid", price(selected.bid, selected.digits)], ["Ask", price(selected.ask, selected.digits)], ["Spread", `${selectedSpread} pts`], ["Daily high", price(selected.dailyHigh, selected.digits)], ["Daily low", price(selected.dailyLow, selected.digits)], ["Latency", `${selected.latencyMs} ms`]].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><p className="text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}</div>
          <Meter label="Spread versus tolerance" value={Math.round(selectedSpread / (selected.spreadBaselinePoints * 2) * 100)} tone={selectedSpread > selected.spreadBaselinePoints * 2 ? "bg-red-500" : "bg-emerald-500"} />
        </CardContent>
      </Card> : <Card><Heading icon={TrendingUp} title="Quote Detail" detail="Select an instrument or wait for the first EA heartbeat quote." /><CardContent><p className="text-sm text-slate-600">Live quotes appear here once NexusBridgeEA sends heartbeat tick data for a chart symbol.</p></CardContent></Card>}
      <Card>
        <Heading icon={TrendingUp} title="Top Movers & Spread Monitor" detail="Largest price changes paired with liquidity and delivery conditions." />
        <CardContent><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="border-y border-slate-100 bg-slate-50"><tr>{["Instrument", "Asset", "Daily Move", "Bid / Ask", "Spread / Base", "Volatility", "Latency", "State"].map((head) => <th key={head} className="px-3 py-3 uppercase text-slate-500">{head}</th>)}</tr></thead><tbody>{data.movers.map((instrument) => { const move = dailyMovePercent(instrument); return <tr key={instrument.id} className="border-b border-slate-100"><td className="px-3 py-3 font-semibold">{instrument.symbol}</td><td className="px-3 py-3">{instrument.assetClass}</td><td className={cn("px-3 py-3 font-semibold", move >= 0 ? "text-emerald-700" : "text-red-700")}>{move > 0 ? "+" : ""}{move}%</td><td className="px-3 py-3 font-mono">{price(instrument.bid, instrument.digits)} / {price(instrument.ask, instrument.digits)}</td><td className="px-3 py-3">{spreadPoints(instrument)} / {instrument.spreadBaselinePoints}</td><td className="px-3 py-3">{instrument.volatilityPercent}%</td><td className="px-3 py-3">{instrument.latencyMs} ms</td><td className="px-3 py-3"><Status value={quoteStatus(instrument)} /></td></tr>; })}</tbody></table></div></CardContent>
      </Card>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <Card>
        <Heading icon={AlertTriangle} title="Quote Alerts & Execution Exceptions" detail="Freshness, spread, volatility, and blocked-trading conditions requiring review." />
        <CardContent>
          <div className="mb-3 flex flex-wrap gap-2">{["All", "Critical", "Warning", "Feed Offline", "Stale Quote", "Spread Expansion", "Volatility Surge"].map((option) => <button key={option} className={cn("rounded-full border px-3 py-1 text-xs", alertFilter === option ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600")} onClick={() => setAlertFilter(option)}>{option}</button>)}</div>
          <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="border-y border-slate-100 bg-slate-50"><tr>{["Symbol", "Type", "Severity", "Detected", "Detail", "Recommendation"].map((head) => <th key={head} className="px-3 py-3 uppercase text-slate-500">{head}</th>)}</tr></thead><tbody>{visibleAlerts.map((alert) => <tr key={alert.id} className="border-b border-slate-100"><td className="px-3 py-3 font-semibold">{alert.symbol}</td><td className="px-3 py-3">{alert.alertType}</td><td className="px-3 py-3"><Severity value={alert.severity} /></td><td className="px-3 py-3">{time(alert.detectedAt)}</td><td className="px-3 py-3">{alert.detail}</td><td className="px-3 py-3 text-purple-700">{alert.recommendation}</td></tr>)}</tbody></table></div>
        </CardContent>
      </Card>
      <Card>
        <Heading icon={Bot} title="AI Market Diagnostics" detail="Autonomous interpretation of quote failures and risky pricing conditions." />
        <CardContent className="space-y-3">{data.diagnostics.map((diagnostic) => <div key={diagnostic.id} className="rounded-xl border border-purple-100 bg-purple-50/40 p-4"><div className="flex items-center justify-between gap-2"><p className="font-semibold">{diagnostic.issue}</p><Severity value={diagnostic.severity} /></div><p className="mt-3 text-xs"><strong>Root cause:</strong> {diagnostic.rootCause}</p><p className="mt-2 text-xs"><strong>Trading impact:</strong> {diagnostic.tradingImpact}</p><p className="mt-2 text-xs font-medium text-purple-800"><strong>Recommendation:</strong> {diagnostic.recommendation}</p><div className="mt-3 flex items-center gap-2"><Badge variant="purple">Confidence {Math.round(diagnostic.confidenceScore * 100)}%</Badge>{diagnostic.autoFixEligible ? <Badge variant="warning">Approval required</Badge> : null}</div></div>)}</CardContent>
      </Card>
    </section>
  </div>;
}
