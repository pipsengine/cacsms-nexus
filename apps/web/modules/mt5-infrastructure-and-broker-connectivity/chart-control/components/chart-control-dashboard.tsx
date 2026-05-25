"use client";

import { Activity, BarChart3, Bot, Camera, Download, Layers3, LineChart as LineChartIcon, Menu, RefreshCw, Settings2 } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { indicatorRecommendation, visibleCandles } from "../algorithms/chart-control.algorithms";
import { timeframes } from "../data/chart-control.mock";
import { useChartControl } from "../hooks/use-chart-control";
import type { ChartSeverity, ChartTone, Timeframe } from "../types/chart-control.types";

const variants: Record<ChartTone, "success" | "warning" | "destructive" | "secondary"> = { Healthy: "success", Watch: "warning", Degraded: "warning", Critical: "destructive", Offline: "destructive", Inactive: "secondary" };
const borders: Record<ChartTone, string> = { Healthy: "border-t-emerald-500", Watch: "border-t-amber-500", Degraded: "border-t-amber-500", Critical: "border-t-red-500", Offline: "border-t-red-500", Inactive: "border-t-slate-400" };
const time = (value: string) => new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const price = (value: number, digits: number) => value.toFixed(digits);
function Status({ value }: { value: ChartTone }) { return <Badge variant={variants[value]}>{value}</Badge>; }
function Severity({ value }: { value: ChartSeverity }) { return <Badge variant={value === "Critical" ? "destructive" : value === "Warning" ? "warning" : "secondary"}>{value}</Badge>; }
function Heading({ icon: Icon, title, detail }: { icon: typeof Activity; title: string; detail: string }) {
  return <CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-lg"><Icon className="h-5 w-5 text-blue-600" />{title}</CardTitle><p className="mt-1 text-xs text-slate-500">{detail}</p></CardHeader>;
}
export function ChartControlDashboard() {
  const query = useChartControl();
  const [selectedId, setSelectedId] = useState("chart-nas100");
  const [signalFilter, setSignalFilter] = useState("All");
  const [notice, setNotice] = useState<string | null>(null);
  if (query.isError) return <div className="mx-auto max-w-[1900px] px-4 py-6"><Card className="border-red-200 p-6"><h1 className="text-xl font-semibold">Chart Control unavailable</h1><p className="mt-2 text-sm text-slate-600">Chart telemetry could not be loaded; no workspace configuration was changed.</p><Button className="mt-4" onClick={() => query.refetch()}>Retry</Button></Card></div>;
  if (query.isLoading || !query.data) return <div className="mx-auto max-w-[1900px] px-4 py-6 text-sm text-slate-600">Loading chart-control workspace...</div>;
  const data = query.data;
  const selected = data.instruments.find((instrument) => instrument.id === selectedId) ?? data.instruments[0];
  const analysis = data.analysisByInstrument[selected.id];
  const series = visibleCandles(selected.candles, selected.timeframe);
  const activeLayout = data.layouts.find((layout) => layout.active)!;
  const visibleSignals = data.signals.filter((signal) => signalFilter === "All" || signal.severity === signalFilter || signal.signalType === signalFilter);
  const selectedDrawings = data.drawings.filter((drawing) => drawing.instrumentId === selected.id && drawing.visible);
  const indicators = ["EMA 9", "SMA 20", "RSI 14", "Volume", "ATR 14", "Bollinger Bands", "VWAP"];
  async function command(label: string, path: string, body?: Record<string, unknown>) {
    if (!window.confirm(`Confirm ${label.toLowerCase()}? This chart operation will be audit-logged.`)) return;
    setNotice(null);
    try {
      await query.action.mutateAsync({ path, body: { confirmed: true, ...body } });
      setNotice(`${label} completed and was recorded in the audit trail.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Chart action failed.");
    }
  }
  function exportWorkspace() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "chart-control-workspace.json";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }
  return <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
    <section className="sticky top-14 z-20 rounded-2xl border border-slate-200 bg-white/95 shadow-card backdrop-blur">
      <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-blue-600 via-emerald-500 to-purple-600" />
      <div className="flex flex-col gap-5 p-5 xl:flex-row xl:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">MT5 Infrastructure &amp; Broker Connectivity / Chart Control</p><div className="mt-2 flex flex-wrap items-center gap-2"><h1 className="text-3xl font-semibold tracking-tight text-slate-950">Chart Control</h1><Badge variant={query.streamConnected ? "success" : "warning"}><Activity className="mr-1 h-3 w-3" />{query.streamConnected ? "Live workspace" : "Reconnecting"}</Badge></div><p className="mt-2 max-w-4xl text-sm text-slate-600">Multi-symbol MT5 chart workspace for price structure, timeframe orchestration, indicator overlays, drawings, signal review, and auditable captures.</p><p className="mt-3 text-xs text-slate-500">Layout: {activeLayout.name} | Role: {data.permissions.role} | Selected: {selected.symbol} {selected.timeframe} | Updated: {time(data.meta.timestamp)}</p></div>
        <div className="hidden flex-wrap justify-end gap-2 sm:flex">
          <Button variant="outline" disabled={!data.permissions.canRefresh || query.action.isPending} onClick={() => command("Refresh chart feeds", "/api/mt5/chart-control/refresh")}><RefreshCw className="h-4 w-4" />Refresh Feeds</Button>
          <Button variant="outline" disabled={!data.permissions.canSnapshot || query.action.isPending} onClick={() => command("Capture chart snapshot", `/api/mt5/chart-control/instruments/${selected.id}/snapshots`, { note: `${selected.symbol} ${selected.timeframe} operator capture` })}><Camera className="h-4 w-4" />Capture Snapshot</Button>
          <Button variant="outline" onClick={exportWorkspace}><Download className="h-4 w-4" />Export Workspace</Button>
        </div>
        <div className="sm:hidden"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline"><Menu className="h-4 w-4" />Actions</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={!data.permissions.canRefresh} onSelect={() => command("Refresh chart feeds", "/api/mt5/chart-control/refresh")}>Refresh Feeds</DropdownMenuItem><DropdownMenuItem disabled={!data.permissions.canSnapshot} onSelect={() => command("Capture chart snapshot", `/api/mt5/chart-control/instruments/${selected.id}/snapshots`)}>Capture Snapshot</DropdownMenuItem><DropdownMenuItem onSelect={exportWorkspace}>Export Workspace</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
      </div>
      {notice ? <p className="border-t border-slate-100 px-5 py-2.5 text-xs font-semibold text-blue-700">{notice}</p> : null}
    </section>

    <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">{data.kpis.map((kpi) => <Card key={kpi.label} className={cn("border-t-4", borders[kpi.status])}><CardContent className="p-3.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p><p className="mt-2 truncate text-lg font-semibold">{kpi.value}</p><p className="mt-1 truncate text-[11px] text-slate-500">{kpi.detail}</p></CardContent></Card>)}</section>

    <section className="grid gap-4 xl:grid-cols-[1.55fr_0.45fr]">
      <Card>
        <Heading icon={LineChartIcon} title="Primary Chart Canvas" detail="Live close-price structure with moving-average overlays and controlled timeframe context." />
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="flex flex-wrap items-center gap-2">{data.instruments.map((instrument) => <button key={instrument.id} aria-label={`Select ${instrument.symbol} chart`} className={cn("rounded-lg border px-3 py-2 text-xs font-semibold", selected.id === instrument.id ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600")} onClick={() => setSelectedId(instrument.id)}>{instrument.symbol} <span className="ml-1 text-[10px]">{instrument.timeframe}</span></button>)}</div>
            <div className="flex flex-wrap gap-1">{timeframes.map((timeframe) => <Button key={timeframe} size="sm" variant={selected.timeframe === timeframe ? "default" : "outline"} disabled={!data.permissions.canConfigure || !selected.availableTimeframes.includes(timeframe)} onClick={() => command(`Switch timeframe to ${timeframe}`, `/api/mt5/chart-control/instruments/${selected.id}/timeframe`, { timeframe })}>{timeframe}</Button>)}</div>
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><div><p className="text-xl font-semibold">{selected.symbol}</p><p className="text-xs text-slate-500">{selected.description} / {selected.brokerName}</p></div><Status value={analysis.status} /></div><div className="flex gap-5 text-right text-xs"><div><p className="text-slate-500">Bid / Ask</p><p className="font-mono font-semibold">{price(selected.bid, selected.digits)} / {price(selected.ask, selected.digits)}</p></div><div><p className="text-slate-500">Change</p><p className={cn("font-semibold", analysis.changePercent >= 0 ? "text-emerald-700" : "text-red-700")}>{analysis.changePercent > 0 ? "+" : ""}{analysis.changePercent}%</p></div><div><p className="text-slate-500">Spread</p><p className="font-semibold">{selected.spreadPoints} pts</p></div></div></div>
          <div className="h-[390px] rounded-xl border border-slate-100 p-3">
            <ResponsiveContainer width="100%" height="100%"><ComposedChart data={series}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="timestamp" tickFormatter={time} tick={{ fontSize: 10 }} /><YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} width={62} /><ChartTooltip labelFormatter={(label) => time(String(label))} /><Area type="monotone" dataKey="close" stroke="#2563eb" fill="#dbeafe" fillOpacity={0.55} strokeWidth={2} name="Close" /><Line type="monotone" dataKey="ema9" stroke="#10b981" strokeWidth={1.8} dot={false} name="EMA 9" /><Line type="monotone" dataKey="sma20" stroke="#7c3aed" strokeWidth={1.8} dot={false} name="SMA 20" />{selectedDrawings.map((drawing) => <ReferenceLine key={drawing.id} y={drawing.price} stroke={drawing.color} strokeDasharray="5 4" label={drawing.label} />)}</ComposedChart></ResponsiveContainer>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[["Trend", analysis.trend], ["RSI (14)", String(analysis.rsi)], ["Support", price(analysis.support, selected.digits)], ["Resistance", price(analysis.resistance, selected.digits)], ["Volatility", `${analysis.volatilityPercent}%`]].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3 text-xs"><p className="uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}</div>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-4">
        <Card>
          <Heading icon={Settings2} title="Indicators" detail="Overlay visibility on the selected chart." />
          <CardContent className="flex flex-wrap gap-2">{indicators.map((indicator) => { const enabled = selected.visibleIndicators.includes(indicator); return <Button key={indicator} size="sm" variant={enabled ? "default" : "outline"} disabled={!data.permissions.canConfigure} onClick={() => command(`${enabled ? "Hide" : "Show"} ${indicator}`, `/api/mt5/chart-control/instruments/${selected.id}/indicators`, { indicator })}>{indicator}</Button>; })}<p className="mt-3 w-full text-xs font-medium text-purple-800">{indicatorRecommendation(analysis)}</p></CardContent>
        </Card>
        <Card>
          <Heading icon={Layers3} title="Drawings & Levels" detail="Visible annotations on the active instrument." />
          <CardContent className="space-y-2">{selectedDrawings.length ? selectedDrawings.map((drawing) => <div key={drawing.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-xs"><div><p className="font-semibold">{drawing.label}</p><p className="text-slate-500">{drawing.kind}</p></div><p className="font-mono">{price(drawing.price, selected.digits)}</p></div>) : <p className="text-xs text-slate-500">No visible drawing objects on this chart.</p>}</CardContent>
        </Card>
      </div>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1fr_0.75fr_0.75fr]">
      <Card>
        <Heading icon={BarChart3} title="Volume & Momentum" detail="Volume participation and RSI context for the active timeframe." />
        <CardContent className="grid gap-4 md:grid-cols-2"><div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={series}><XAxis dataKey="timestamp" tickFormatter={time} tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 10 }} /><ChartTooltip /><Bar dataKey="volume" fill="#2563eb" name="Volume" /></BarChart></ResponsiveContainer></div><div className="h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={series}><XAxis dataKey="timestamp" tickFormatter={time} tick={{ fontSize: 9 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 10 }} /><ChartTooltip /><ReferenceLine y={70} stroke="#dc2626" strokeDasharray="4 3" /><ReferenceLine y={30} stroke="#10b981" strokeDasharray="4 3" /><Area dataKey="rsi" stroke="#7c3aed" fill="#ede9fe" name="RSI 14" /></AreaChart></ResponsiveContainer></div></CardContent>
      </Card>
      <Card>
        <Heading icon={Layers3} title="Workspace Layouts" detail="Saved multi-chart arrangements and overlay stacks." />
        <CardContent className="space-y-3">{data.layouts.map((layout) => <div key={layout.id} className={cn("rounded-xl border p-3", layout.active ? "border-blue-200 bg-blue-50/40" : "border-slate-100")}><div className="flex justify-between gap-2"><div><p className="text-sm font-semibold">{layout.name}</p><p className="text-xs text-slate-500">{layout.slots} panels / {layout.instruments.join(", ")}</p></div>{layout.active ? <Badge variant="default">Active</Badge> : <Button size="sm" variant="outline" disabled={!data.permissions.canConfigure} onClick={() => command(`Apply ${layout.name}`, `/api/mt5/chart-control/layouts/${layout.id}/apply`)}>Apply</Button>}</div><p className="mt-2 text-[11px] text-slate-500">{layout.indicators.join(" / ")}</p></div>)}</CardContent>
      </Card>
      <Card>
        <Heading icon={Camera} title="Snapshot History" detail="Auditable chart captures for review and escalation." />
        <CardContent className="space-y-3">{data.snapshots.map((snapshot) => <div key={snapshot.id} className="rounded-xl border border-slate-100 p-3"><div className="flex justify-between"><p className="text-sm font-semibold">{snapshot.symbol} {snapshot.timeframe}</p><p className="text-[11px] text-slate-500">{time(snapshot.capturedAt)}</p></div><p className="mt-1 text-xs text-slate-500">{snapshot.layoutName} / {snapshot.capturedBy}</p><p className="mt-2 text-xs">{snapshot.note}</p></div>)}</CardContent>
      </Card>
    </section>

    <Card>
      <Heading icon={Bot} title="Chart Signals & AI Review" detail="Price-structure, momentum, volatility, and feed-quality signals mapped to chart evidence." />
      <CardContent>
        <div className="mb-3 flex flex-wrap gap-2">{["All", "Critical", "Warning", "Trend Shift", "Breakout", "Data Quality"].map((option) => <button key={option} className={cn("rounded-full border px-3 py-1 text-xs", signalFilter === option ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600")} onClick={() => setSignalFilter(option)}>{option}</button>)}</div>
        <div className="overflow-x-auto"><table aria-label="Chart signal review" className="w-full min-w-[940px] text-left text-xs"><thead className="border-y border-slate-100 bg-slate-50"><tr>{["Symbol", "Timeframe", "Signal", "Direction", "Severity", "Confidence", "Detected", "Analysis"].map((head) => <th key={head} className="px-3 py-3 uppercase text-slate-500">{head}</th>)}</tr></thead><tbody>{visibleSignals.map((signal) => <tr key={signal.id} className="border-b border-slate-100"><td className="px-3 py-3 font-semibold">{signal.symbol}</td><td className="px-3 py-3">{signal.timeframe}</td><td className="px-3 py-3">{signal.signalType}</td><td className={cn("px-3 py-3 font-semibold", signal.direction === "Bullish" ? "text-emerald-700" : signal.direction === "Bearish" ? "text-red-700" : "text-slate-600")}>{signal.direction}</td><td className="px-3 py-3"><Severity value={signal.severity} /></td><td className="px-3 py-3">{Math.round(signal.confidenceScore * 100)}%</td><td className="px-3 py-3">{time(signal.detectedAt)}</td><td className="px-3 py-3">{signal.detail}</td></tr>)}</tbody></table></div>
      </CardContent>
    </Card>
  </div>;
}
