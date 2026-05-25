"use client";

import { Activity, AlertTriangle, Bot, Copy, Download, Eye, FolderCog, Menu, ShieldCheck, SlidersHorizontal, Upload } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { templateCompleteness } from "../algorithms/chart-templates.algorithms";
import { useChartTemplates } from "../hooks/use-chart-templates";
import type { TemplateSeverity, TemplateStatus, TemplateTone } from "../types/chart-templates.types";

const variants: Record<TemplateTone, "success" | "warning" | "destructive" | "secondary"> = { Healthy: "success", Watch: "warning", Degraded: "warning", Critical: "destructive", Inactive: "secondary" };
const borders: Record<TemplateTone, string> = { Healthy: "border-t-emerald-500", Watch: "border-t-amber-500", Degraded: "border-t-amber-500", Critical: "border-t-red-500", Inactive: "border-t-slate-400" };
const statusVariants: Record<TemplateStatus, "success" | "warning" | "default" | "secondary"> = { Published: "success", Draft: "secondary", "In Review": "warning", Archived: "secondary" };
const time = (value: string) => new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
function Status({ value }: { value: TemplateTone }) { return <Badge variant={variants[value]}>{value}</Badge>; }
function Publication({ value }: { value: TemplateStatus }) { return <Badge variant={statusVariants[value]}>{value}</Badge>; }
function Severity({ value }: { value: TemplateSeverity }) { return <Badge variant={value === "Critical" ? "destructive" : value === "Warning" ? "warning" : "secondary"}>{value}</Badge>; }
function Heading({ icon: Icon, title, detail }: { icon: typeof Activity; title: string; detail: string }) {
  return <CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-lg"><Icon className="h-5 w-5 text-blue-600" />{title}</CardTitle><p className="mt-1 text-xs text-slate-500">{detail}</p></CardHeader>;
}
function Meter({ label, value, tone = "bg-blue-600" }: { label: string; value: number; tone?: string }) {
  return <div><div className="mb-1 flex justify-between text-xs text-slate-600"><span>{label}</span><strong>{value}%</strong></div><div className="h-2 rounded-full bg-slate-100"><div className={cn("h-2 rounded-full", tone)} style={{ width: `${Math.min(100, value)}%` }} /></div></div>;
}

export function ChartTemplatesDashboard() {
  const query = useChartTemplates();
  const [selectedId, setSelectedId] = useState("template-risk");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");
  const [issueFilter, setIssueFilter] = useState("All");
  const [notice, setNotice] = useState<string | null>(null);
  if (query.isError) return <div className="mx-auto max-w-[1900px] px-4 py-6"><Card className="border-red-200 p-6"><h1 className="text-xl font-semibold">Chart Templates unavailable</h1><p className="mt-2 text-sm text-slate-600">Template registry could not be loaded; no publishing operation was issued.</p><Button className="mt-4" onClick={() => query.refetch()}>Retry</Button></Card></div>;
  if (query.isLoading || !query.data) return <div className="mx-auto max-w-[1900px] px-4 py-6 text-sm text-slate-600">Loading chart template registry...</div>;
  const data = query.data;
  const selected = data.templates.find((template) => template.id === selectedId) ?? data.templates[0];
  const rows = data.templates.filter((template) => `${template.name} ${template.category} ${template.owner} ${template.symbols.join(" ")}`.toLowerCase().includes(search.toLowerCase())).filter((template) => category === "All" || template.category === category).filter((template) => stateFilter === "All" || template.status === stateFilter || template.validationStatus === stateFilter);
  const visibleIssues = data.issues.filter((issue) => issueFilter === "All" || issue.issueType === issueFilter || issue.severity === issueFilter);
  const selectedDeployments = data.deployments.filter((deployment) => deployment.templateId === selected.id);
  const completeness = templateCompleteness(selected);
  async function command(label: string, path: string) {
    if (!window.confirm(`Confirm ${label.toLowerCase()}? This template registry action will be audit-logged.`)) return;
    setNotice(null);
    try {
      await query.action.mutateAsync({ path, body: { confirmed: true } });
      setNotice(`${label} completed and was recorded in the audit trail.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Template operation failed.");
    }
  }
  function exportRegistry() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = "chart-template-registry.json";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }
  const selectedActions = [
    { label: "Validate Selected", path: `/api/mt5/chart-templates/templates/${selected.id}/validate`, allowed: data.permissions.canValidate },
    { label: "Clone Template", path: `/api/mt5/chart-templates/templates/${selected.id}/clone`, allowed: data.permissions.canClone },
    { label: "Publish Version", path: `/api/mt5/chart-templates/templates/${selected.id}/publish`, allowed: data.permissions.canPublish && selected.status !== "Published" },
    { label: "Archive Template", path: `/api/mt5/chart-templates/templates/${selected.id}/archive`, allowed: data.permissions.canArchive && selected.activeDeployments === 0 }
  ];
  return <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-4 px-4 py-5 sm:px-6 lg:px-8">
    <section className="sticky top-14 z-20 rounded-2xl border border-slate-200 bg-white/95 shadow-card backdrop-blur">
      <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-blue-600 via-emerald-500 to-purple-600" />
      <div className="flex flex-col gap-5 p-5 xl:flex-row xl:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">MT5 Infrastructure &amp; Broker Connectivity / Chart Templates</p><div className="mt-2 flex flex-wrap items-center gap-2"><h1 className="text-3xl font-semibold tracking-tight text-slate-950">Chart Templates</h1><Badge variant={query.streamConnected ? "success" : "warning"}><Activity className="mr-1 h-3 w-3" />{query.streamConnected ? "Registry live" : "Reconnecting"}</Badge></div><p className="mt-2 max-w-4xl text-sm text-slate-600">Governed preset library for chart layouts, indicator packs, risk overlays, alert rules, version approval, and workspace deployments.</p><p className="mt-3 text-xs text-slate-500">Mode: {data.meta.monitoringMode} | Role: {data.permissions.role} | Selected: {selected.name} {selected.version} | Updated: {time(data.meta.timestamp)}</p></div>
        <div className="hidden flex-wrap justify-end gap-2 sm:flex">{selectedActions.map((action) => <Button key={action.label} variant="outline" disabled={!action.allowed || query.action.isPending} onClick={() => command(action.label, action.path)}>{action.label}</Button>)}<Button variant="outline" onClick={exportRegistry}><Download className="h-4 w-4" />Export Registry</Button></div>
        <div className="sm:hidden"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline"><Menu className="h-4 w-4" />Actions</Button></DropdownMenuTrigger><DropdownMenuContent align="end">{selectedActions.map((action) => <DropdownMenuItem key={action.label} disabled={!action.allowed} onSelect={() => command(action.label, action.path)}>{action.label}</DropdownMenuItem>)}<DropdownMenuItem onSelect={exportRegistry}>Export Registry</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
      </div>
      {notice ? <p className="border-t border-slate-100 px-5 py-2.5 text-xs font-semibold text-blue-700">{notice}</p> : null}
    </section>
    <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">{data.kpis.map((kpi) => <Card key={kpi.label} className={cn("border-t-4", borders[kpi.status])}><CardContent className="p-3.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{kpi.label}</p><p className="mt-2 truncate text-lg font-semibold">{kpi.value}</p><p className="mt-1 truncate text-[11px] text-slate-500">{kpi.detail}</p></CardContent></Card>)}</section>

    <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
      <Card>
        <Heading icon={FolderCog} title="Template Registry" detail="Searchable chart presets with lifecycle, validation, usage, and controlled configuration actions." />
        <CardContent>
          <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:justify-between"><label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm lg:w-80"><Eye className="h-4 w-4 text-slate-400" /><input aria-label="Search chart templates" className="w-full outline-none" placeholder="Search templates, owner, symbols..." value={search} onChange={(event) => setSearch(event.target.value)} /></label><div className="flex gap-2"><select aria-label="Filter template category" className="rounded-lg border border-slate-200 px-3 text-xs" value={category} onChange={(event) => setCategory(event.target.value)}><option>All</option><option>Execution</option><option>Scalping</option><option>Risk</option><option>Swing</option><option>Analysis</option></select><select aria-label="Filter template state" className="rounded-lg border border-slate-200 px-3 text-xs" value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}><option>All</option><option>Published</option><option>Draft</option><option>In Review</option><option>Archived</option><option>Healthy</option><option>Degraded</option><option>Critical</option></select></div></div>
          <div className="overflow-x-auto"><table aria-label="Chart template registry" className="w-full min-w-[1300px] text-left text-xs"><thead className="border-y border-slate-100 bg-slate-50"><tr>{["Template", "Category", "Version", "Lifecycle", "Owner / Visibility", "Layout", "Symbols / Frames", "Indicators", "Usage", "Deployments", "Validation", "Updated"].map((head) => <th key={head} className="px-3 py-3 uppercase text-slate-500">{head}</th>)}</tr></thead><tbody>{rows.map((template) => <tr key={template.id} className={cn("cursor-pointer border-b border-slate-100", template.id === selected.id && "bg-blue-50/30")} onClick={() => setSelectedId(template.id)}><td className="px-3 py-3 font-semibold">{template.name}<p className="max-w-56 truncate font-normal text-slate-500">{template.description}</p></td><td className="px-3 py-3">{template.category}</td><td className="px-3 py-3 font-mono">{template.version}</td><td className="px-3 py-3"><Publication value={template.status} /></td><td className="px-3 py-3">{template.owner}<p className="text-slate-500">{template.visibility}</p></td><td className="px-3 py-3">{template.slots} panels<p className="text-slate-500">{template.candleStyle} / {template.colorTheme}</p></td><td className="px-3 py-3">{template.symbols.join(", ")}<p className="text-slate-500">{template.timeframes.join(", ")}</p></td><td className="px-3 py-3">{template.indicators.map((indicator) => indicator.name).join(", ")}</td><td className="px-3 py-3">{template.usageCount}</td><td className="px-3 py-3">{template.activeDeployments}</td><td className="px-3 py-3"><Status value={template.validationStatus} /></td><td className="px-3 py-3">{time(template.updatedAt)}</td></tr>)}</tbody></table></div>
        </CardContent>
      </Card>
      <Card>
        <Heading icon={ShieldCheck} title="Registry Health" detail="Validation coverage and deployment approval posture." />
        <CardContent className="space-y-4"><div className="flex items-center justify-between"><div><p className="text-4xl font-semibold">{data.health.score}</p><p className="text-xs text-slate-500">{data.health.rating} library posture</p></div><Status value={data.health.score >= 75 ? "Healthy" : data.health.score >= 60 ? "Degraded" : "Critical"} /></div><Meter label="Validation coverage" value={Math.round(data.health.factors.validation)} tone="bg-emerald-500" /><Meter label="Governance readiness" value={Math.round(data.health.factors.governance)} /><Meter label="Alert coverage" value={Math.round(data.health.factors.alertCoverage)} tone="bg-purple-600" /><p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Critical findings block publishing until a validated preset and alert configuration are confirmed.</p></CardContent>
      </Card>
    </section>

    <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
      <Card>
        <Heading icon={SlidersHorizontal} title="Selected Template Definition" detail="Layout contract, style system, indicator parameters, and monitoring guards." />
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="text-lg font-semibold">{selected.name}</p><p className="text-xs text-slate-500">{selected.description}</p></div><div className="flex gap-2"><Publication value={selected.status} /><Status value={selected.validationStatus} /></div></div><div className="mt-4"><Meter label="Definition completeness" value={completeness} tone={completeness >= 80 ? "bg-emerald-500" : "bg-amber-500"} /></div></div>
          <div className="grid grid-cols-2 gap-2 text-xs">{[["Version", selected.version], ["Category", selected.category], ["Owner", selected.owner], ["Visibility", selected.visibility], ["Panels", String(selected.slots)], ["Appearance", `${selected.candleStyle} / ${selected.colorTheme}`]].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><p className="uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}</div>
          <div><p className="mb-2 text-xs font-semibold uppercase text-slate-500">Instrument Matrix</p><div className="flex flex-wrap gap-2">{selected.symbols.map((symbol, index) => <Badge key={symbol} variant="default">{symbol} / {selected.timeframes[index]}</Badge>)}</div></div>
          <div><p className="mb-2 text-xs font-semibold uppercase text-slate-500">Risk Overlays &amp; Alerts</p><div className="flex flex-wrap gap-2">{[...selected.riskOverlays, ...selected.alertRules].map((rule) => <Badge key={rule} variant="warning">{rule}</Badge>)}{!selected.riskOverlays.length && !selected.alertRules.length ? <p className="text-xs text-red-700">No risk overlays or alert rules configured.</p> : null}</div></div>
        </CardContent>
      </Card>
      <Card>
        <Heading icon={SlidersHorizontal} title="Indicator & Tool Stack" detail="Preset parameters provisioned when a template is applied to Chart Control." />
        <CardContent>
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-xs"><thead className="border-y border-slate-100 bg-slate-50"><tr>{["Indicator", "Parameters", "Pane", "Color", "Required"].map((head) => <th key={head} className="px-3 py-3 uppercase text-slate-500">{head}</th>)}</tr></thead><tbody>{selected.indicators.map((indicator) => <tr key={indicator.name} className="border-b border-slate-100"><td className="px-3 py-3 font-semibold">{indicator.name}</td><td className="px-3 py-3">{indicator.parameters}</td><td className="px-3 py-3">{indicator.pane}</td><td className="px-3 py-3"><span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: indicator.color }} /> <span className="ml-1 font-mono">{indicator.color}</span></td><td className="px-3 py-3"><Badge variant={indicator.required ? "success" : "secondary"}>{indicator.required ? "Required" : "Optional"}</Badge></td></tr>)}</tbody></table></div>
          <p className="mb-2 mt-5 text-xs font-semibold uppercase text-slate-500">Drawing Tools</p><div className="flex flex-wrap gap-2">{selected.drawingTools.map((tool) => <Badge key={tool} variant="secondary">{tool}</Badge>)}</div>
        </CardContent>
      </Card>
    </section>

    <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <Heading icon={Upload} title="Template Deployments" detail="Current assignments across live, review, and simulation chart workspaces." />
        <CardContent>{selectedDeployments.length ? <div className="space-y-3">{selectedDeployments.map((deployment) => <div key={deployment.id} className="rounded-xl border border-slate-100 p-3"><div className="flex items-center justify-between"><p className="font-semibold">{deployment.workspace}</p><Status value={deployment.status} /></div><p className="mt-1 text-xs text-slate-500">{deployment.assignedTo} / {deployment.environment}</p><p className="mt-2 text-xs text-slate-600">Deployed {time(deployment.deployedAt)} | Last used {time(deployment.lastUsedAt)}</p></div>)}</div> : <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">This template is not deployed to a workspace.</p>}</CardContent>
      </Card>
      <Card>
        <Heading icon={AlertTriangle} title="Validation & Governance Queue" detail="Preset weaknesses requiring validation, review, or incident resolution." />
        <CardContent><div className="mb-3 flex flex-wrap gap-2">{["All", "Critical", "Warning", "Stale Validation", "Offline Instrument", "Unsafe Alert Rule"].map((option) => <button key={option} className={cn("rounded-full border px-3 py-1 text-xs", issueFilter === option ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600")} onClick={() => setIssueFilter(option)}>{option}</button>)}</div><div className="overflow-x-auto"><table aria-label="Template governance findings" className="w-full min-w-[760px] text-left text-xs"><thead className="border-y border-slate-100 bg-slate-50"><tr>{["Template", "Finding", "Severity", "Detail", "Recommendation"].map((head) => <th key={head} className="px-3 py-3 uppercase text-slate-500">{head}</th>)}</tr></thead><tbody>{visibleIssues.map((issue) => <tr key={issue.id} className="border-b border-slate-100"><td className="px-3 py-3 font-semibold">{issue.templateName}</td><td className="px-3 py-3">{issue.issueType}</td><td className="px-3 py-3"><Severity value={issue.severity} /></td><td className="px-3 py-3">{issue.detail}</td><td className="px-3 py-3 text-purple-700">{issue.recommendation}</td></tr>)}</tbody></table></div></CardContent>
      </Card>
    </section>

    <Card>
      <Heading icon={Bot} title="Lifecycle Controls & Approval Guidance" detail="Controlled promotion path from private drafts to validated institution-wide chart standards." />
      <CardContent className="grid gap-3 md:grid-cols-4">{[
        { title: "Design", value: "Draft preset", note: "Compose chart panels, indicators, drawing tools, and alerts.", icon: Copy },
        { title: "Validate", value: "Technical check", note: "Confirm instrument feeds, alert guards, and completeness.", icon: ShieldCheck },
        { title: "Approve", value: "Publish version", note: "Risk or Trading Admin authorizes institution visibility.", icon: Upload },
        { title: "Deploy", value: "Workspace usage", note: "Track adoption, incidents, versions, and archival.", icon: Activity }
      ].map((step) => <div key={step.title} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4"><step.icon className="h-5 w-5 text-blue-600" /><p className="mt-3 text-xs font-semibold uppercase text-slate-500">{step.title}</p><p className="mt-1 font-semibold">{step.value}</p><p className="mt-2 text-xs text-slate-600">{step.note}</p></div>)}</CardContent>
    </Card>
  </div>;
}
